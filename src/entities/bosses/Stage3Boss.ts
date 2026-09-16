import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Boss } from './Boss';
import { Bullet } from '../Bullet';
import { Hazard } from './Hazard';

type HitPlayerFn = (object1: any, object2: any) => void;

/**
 * ステージ3ボス：上下バウンドしながら、自機狙いの扇状弾幕を一定間隔で発射する。
 * 戦闘開始直後から常に一定間隔で、赤い警告帯（横一直線）→ビームの攻撃も発動する。
 * さらに、同じく戦闘開始直後から常に一定間隔で「画面左から720pxの範囲を3分割した縦レーンの
 * うち1本が点滅→その全域に極太の縦ビームが発生する」攻撃も他の攻撃と並行して発動する。
 * どのレーンが危険になるかは乱数ではなく、黄金比を使った加法的数列（Weyl sequence）で
 * 決めている。単純な巡回（左→中央→右→…）だと数手で読まれてしまうが、この数列は同じ
 * レーンが短い周期で規則的に繰り返さないため、再現性を保ったまま予測しにくいパターンになる。
 */
export class Stage3Boss extends Boss {
  static readonly TEXTURE_KEY = 'boss3';

  private static readonly FAN_BULLET_COUNT = 7;
  private static readonly FAN_SPREAD_DEG = 100;
  private static readonly BEAM_INTERVAL = 2600;
  private static readonly BEAM_WARNING_MS = 700;
  private static readonly BEAM_ACTIVE_MS = 320;
  private static readonly BEAM_HEIGHT = 70;
  private static readonly BEAM_Y_MARGIN = 60;

  /** 縦レーン極太ビーム関連。画面左からCOLUMN_RANGE_WIDTHまでの範囲だけをCOLUMN_COUNT分割する（ボスのいる右側は対象外） */
  private static readonly COLUMN_COUNT = 3;
  private static readonly COLUMN_RANGE_WIDTH = 720;
  private static readonly COLUMN_BEAM_INTERVAL = 3200;
  private static readonly COLUMN_BEAM_WARNING_MS = 900;
  private static readonly COLUMN_BEAM_ACTIVE_MS = 350;

  /** 実写画像は解像度が大きいため、他のボスと見た目のサイズが揃うようこの高さ(px)に縮小表示する */
  private static readonly DISPLAY_HEIGHT = 150;
  /** 当たり判定サイズ（見た目の縦長な写真に合わせて、他のボスより少し大きめ・縦長にしている） */
  private static readonly HITBOX_WIDTH = 110;
  private static readonly HITBOX_HEIGHT = 130;

  private fanTimer = 0;
  private beamTimer = 0;
  private beamHazards: Hazard[] = [];
  private beamInProgress = false;

  private columnBeamTimer = 0;
  private columnCycleCounter = 0;
  private columnHazards: Hazard[] = [];

  /** 画像アセット読み込み失敗時（プリロード漏れ等）のフォールバック用に生成テクスチャも用意しておく */
  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(Stage3Boss.TEXTURE_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x6a3093).fillRect(0, 0, 116, 76).generateTexture(Stage3Boss.TEXTURE_KEY, 116, 76);
    g.destroy();
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly getPlayers: () => Phaser.Physics.Arcade.Sprite[],
    private readonly hitPlayer: HitPlayerFn,
    private readonly enemyBulletsPool: Phaser.Physics.Arcade.Group,
    private readonly bulletInterval: number,
    private readonly bulletSpeed: number,
  ) {
    Stage3Boss.ensureTexture(scene);
    super(scene, x, y, Stage3Boss.TEXTURE_KEY);

    // 実写画像は元解像度のままだと大きすぎるため見た目だけ縮小する。setScale()は当たり判定の
    // setSize()より先に呼ぶ必要がある（setSize()は呼び出し時点のスケールを当たり判定へ焼き込むため）。
    const scale = Stage3Boss.DISPLAY_HEIGHT / this.height;
    this.setScale(scale);
    (this.body as Phaser.Physics.Arcade.Body).setSize(Stage3Boss.HITBOX_WIDTH, Stage3Boss.HITBOX_HEIGHT);
  }

  protected onSpawn(): void {
    this.fanTimer = 0;
    this.beamTimer = 0;
    this.beamHazards = [];
    this.beamInProgress = false;
    this.columnBeamTimer = 0;
    this.columnCycleCounter = 0;
    this.columnHazards = [];
    this.setVelocityY(80);
  }

  protected updateBehavior(_time: number, delta: number): void {
    this.fanTimer += delta;
    if (this.fanTimer >= this.bulletInterval) {
      this.fanTimer = 0;
      this.fireFanBarrage();
    }

    this.beamTimer += delta;
    if (this.beamTimer >= Stage3Boss.BEAM_INTERVAL) {
      this.beamTimer = 0;
      this.fireBeam();
    }

    if (this.beamHazards.length > 0) {
      this.beamHazards = this.beamHazards.filter((h) => !h.isDone);
      if (this.beamInProgress && this.beamHazards.length === 0) {
        this.beamInProgress = false;
        this.resumeVerticalMovement();
      }
    }

    // 縦レーン極太ビームはHPに関係なく戦闘開始直後から常に一定間隔で発動する（他の攻撃と並行）
    this.columnBeamTimer += delta;
    if (this.columnBeamTimer >= Stage3Boss.COLUMN_BEAM_INTERVAL) {
      this.columnBeamTimer = 0;
      this.fireColumnBeam();
    }
    if (this.columnHazards.length > 0) {
      this.columnHazards = this.columnHazards.filter((h) => !h.isDone);
    }
  }

  private fireFanBarrage(): void {
    const target = this.nearestPlayer(this.getPlayers());
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const count = Stage3Boss.FAN_BULLET_COUNT;
    const stepDeg = Stage3Boss.FAN_SPREAD_DEG / (count - 1);
    for (let i = 0; i < count; i++) {
      const offsetDeg = -Stage3Boss.FAN_SPREAD_DEG / 2 + stepDeg * i;
      const angle = baseAngle + Phaser.Math.DegToRad(offsetDeg);

      let bullet = this.enemyBulletsPool.getFirstDead(false) as Bullet;
      if (!bullet) {
        bullet = new Bullet(this.scene, this.x, this.y, 'enemyBullet');
        this.enemyBulletsPool.add(bullet);
      }
      bullet.fire(this.x, this.y, Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
    }
  }

  /** ビーム発射中に動くと警告位置とビームの座標がずれるため、警告〜発生の間は移動を止める */
  private fireBeam(): void {
    this.pauseVerticalMovement();
    this.beamInProgress = true;

    const players = this.getPlayers();
    // 横一直線ビームのy座標は、自機ではなくボス自身のy座標に合わせる
    const y = Phaser.Math.Clamp(this.y, Stage3Boss.BEAM_Y_MARGIN, GAME_CONFIG.PLAY_AREA.HEIGHT - Stage3Boss.BEAM_Y_MARGIN);
    // ボスのx座標より後ろ（画面右端側）までビームが伸びて見えないよう、ボスの位置までで留める
    // depthをボス本体（0）より奥にして、ビームでボスの立ち絵が隠れないようにする
    const hazard = new Hazard(
      this.scene,
      { kind: 'rect', width: this.x, height: Stage3Boss.BEAM_HEIGHT },
      players,
      this.hitPlayer,
      -0.5,
    );
    hazard.trigger(this.x / 2, y, Stage3Boss.BEAM_WARNING_MS, Stage3Boss.BEAM_ACTIVE_MS);
    this.beamHazards.push(hazard);
  }

  /**
   * 画面を3分割した縦レーンのうち1本を点滅させて警告し、その全域に極太の縦ビームを発生させる。
   * どのレーンにするかはWeyl sequenceで固定的に決める（乱数不使用・単純巡回でもない）。
   * ボス本体の移動には影響を与えず、他の攻撃と完全に並行して進行する。
   */
  private fireColumnBeam(): void {
    this.columnCycleCounter += 1;
    const columnIndex = Boss.nextWeylIndex(this.columnCycleCounter, Stage3Boss.COLUMN_COUNT);
    const columnWidth = Stage3Boss.COLUMN_RANGE_WIDTH / Stage3Boss.COLUMN_COUNT;
    const centerX = columnWidth * (columnIndex + 0.5);

    const hazard = new Hazard(
      this.scene,
      { kind: 'rect', width: columnWidth, height: GAME_CONFIG.PLAY_AREA.HEIGHT },
      this.getPlayers(),
      this.hitPlayer,
    );
    hazard.trigger(
      centerX, GAME_CONFIG.PLAY_AREA.HEIGHT / 2,
      Stage3Boss.COLUMN_BEAM_WARNING_MS, Stage3Boss.COLUMN_BEAM_ACTIVE_MS, true,
    );
    this.columnHazards.push(hazard);
  }

  protected override onDestroyHazards(): void {
    this.beamHazards.forEach((h) => h.forceEnd());
    this.beamHazards = [];
    this.columnHazards.forEach((h) => h.forceEnd());
    this.columnHazards = [];
  }
}
