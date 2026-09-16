import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Boss } from './Boss';
import { Hazard } from './Hazard';

type HitPlayerFn = (object1: any, object2: any) => void;
type InstaKillPlayerFn = (player: Phaser.Physics.Arcade.Sprite) => void;

/**
 * 高難易度限定のボーナスステージ（ステージ4）用ボス。画面右側に単体で出現する。
 * HP50%以上：通常攻撃として、横一直線ビーム＋自機のX座標を狙う縦ビームを同時に発射する
 * （横だけだと安全地帯を見つけやすく簡単すぎるため、縦も組み合わせて十字に交差させる）。
 * 横ビームのY座標はステージ2と同様「発射時点のボス自身のY座標」、縦ビームのX座標は
 * 「発射時点の自機のX座標」を使う。どちらも乱数ではなく実際の座標をそのまま使うため、
 * 同じ動き・同じ操作をすれば同じ結果になる再現性のあるパターンになる。
 *
 * HP50%未満：通常攻撃をやめ、必殺技フェーズに入る。ステージ上の4箇所を固定の順番で巡回する
 * 「安置」を警告表示し、発生時に安置の外にいるプレイヤーは無敵時間等を無視して即ゲームオーバーになる
 * （乱数を使うと運ゲーになるため、安置の位置は固定パターンで巡回させ再現性を持たせている）。
 */
export class Stage4Boss extends Boss {
  static readonly TEXTURE_KEY = 'boss4';

  /** 実写画像は正方形なので、見た目の高さをこの値に揃えて表示する */
  private static readonly DISPLAY_HEIGHT = 150;
  /** 画像が正方形なのに合わせて、当たり判定も正方形寄りにする */
  private static readonly HITBOX_WIDTH = 100;
  private static readonly HITBOX_HEIGHT = 100;

  private static readonly PATROL_SPEED = 130;

  private static readonly BEAM_HP_THRESHOLD = 0.5;
  private static readonly BEAM_INTERVAL = 1700;
  private static readonly BEAM_WARNING_MS = 700;
  private static readonly BEAM_ACTIVE_MS = 320;
  private static readonly BEAM_HEIGHT = 70;
  private static readonly BEAM_Y_MARGIN = 60;
  private static readonly VERTICAL_BEAM_WIDTH = 150;

  // 必殺技（安置以外即死）の固定巡回位置。プレイエリア(960x420)を4分割した各中心。
  private static readonly SAFE_ZONE_CENTERS: { x: number; y: number }[] = [
    { x: 240, y: 105 },
    { x: 720, y: 105 },
    { x: 720, y: 315 },
    { x: 240, y: 315 },
  ];
  private static readonly SAFE_ZONE_WIDTH = 220;
  private static readonly SAFE_ZONE_HEIGHT = 150;
  private static readonly ULTIMATE_INTERVAL = 3200;
  private static readonly ULTIMATE_WARNING_MS = 1400;
  private static readonly ULTIMATE_ACTIVE_MS = 500;

  private beamTimer = 0;
  private beamHazards: Hazard[] = [];
  private beamInProgress = false;

  private ultimatePhase = false;
  private ultimateState: 'idle' | 'warning' | 'active' = 'idle';
  private ultimateTimer = 0;
  private safeZoneIndex = 0;
  private dangerOverlay?: Phaser.GameObjects.Rectangle;
  private safeZoneVisual?: Phaser.GameObjects.Rectangle;

  /** 画像アセット読み込み失敗時（プリロード漏れ等）のフォールバック用に生成テクスチャも用意しておく */
  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(Stage4Boss.TEXTURE_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x3a0d0d).fillRect(0, 0, 116, 76);
    g.lineStyle(3, 0xff4d4d, 1).strokeRect(1, 1, 114, 74);
    g.generateTexture(Stage4Boss.TEXTURE_KEY, 116, 76);
    g.destroy();
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly getPlayers: () => Phaser.Physics.Arcade.Sprite[],
    private readonly hitPlayer: HitPlayerFn,
    private readonly instaKillPlayer: InstaKillPlayerFn,
  ) {
    Stage4Boss.ensureTexture(scene);
    super(scene, x, y, Stage4Boss.TEXTURE_KEY);

    // 実写画像は元解像度のままだと大きすぎるため見た目だけ縮小する。setScale()は当たり判定の
    // setSize()より先に呼ぶ必要がある（setSize()は呼び出し時点のスケールを当たり判定へ焼き込むため）。
    const scale = Stage4Boss.DISPLAY_HEIGHT / this.height;
    this.setScale(scale);
    (this.body as Phaser.Physics.Arcade.Body).setSize(Stage4Boss.HITBOX_WIDTH, Stage4Boss.HITBOX_HEIGHT);
  }

  protected onSpawn(): void {
    this.beamTimer = 0;
    this.beamHazards = [];
    this.beamInProgress = false;
    this.ultimatePhase = false;
    this.ultimateState = 'idle';
    this.ultimateTimer = 0;
    this.safeZoneIndex = 0;
    this.setVelocityY(Stage4Boss.PATROL_SPEED);
  }

  protected updateBehavior(_time: number, delta: number): void {
    if (!this.ultimatePhase && this.hpRatio <= Stage4Boss.BEAM_HP_THRESHOLD) {
      this.ultimatePhase = true;
      this.ultimateTimer = 0;
      // 通常攻撃（十字ビーム）は必殺技フェーズに入ったら止め、進行中のものは強制終了する
      this.beamHazards.forEach((h) => h.forceEnd());
      this.beamHazards = [];
      if (this.beamInProgress) {
        this.beamInProgress = false;
        this.resumeVerticalMovement();
      }
    }

    if (!this.ultimatePhase) {
      this.beamTimer += delta;
      if (this.beamTimer >= Stage4Boss.BEAM_INTERVAL) {
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
    } else {
      this.updateUltimate(delta);
    }
  }

  /** ビーム発射中に動くと警告位置とビームの座標がずれるため、警告〜発生の間は移動を止める */
  private fireBeam(): void {
    this.pauseVerticalMovement();
    this.beamInProgress = true;

    const players = this.getPlayers();
    const target = this.nearestPlayer(players);

    // 横一直線ビームのy座標は、自機や乱数ではなくボス自身の（決定的に動く）y座標に合わせる
    // ボスのx座標より後ろ（画面右端側）までビームが伸びて見えないよう、ボスの位置までで留める
    const y = Phaser.Math.Clamp(this.y, Stage4Boss.BEAM_Y_MARGIN, GAME_CONFIG.PLAY_AREA.HEIGHT - Stage4Boss.BEAM_Y_MARGIN);
    const horizontalHazard = new Hazard(
      this.scene,
      { kind: 'rect', width: this.x, height: Stage4Boss.BEAM_HEIGHT },
      players,
      this.hitPlayer,
    );
    horizontalHazard.trigger(this.x / 2, y, Stage4Boss.BEAM_WARNING_MS, Stage4Boss.BEAM_ACTIVE_MS);
    this.beamHazards.push(horizontalHazard);

    // 横だけだと安全地帯を見つけやすく簡単すぎるため、発射時点の自機のx座標に縦ビームも同時に出す
    const x = Phaser.Math.Clamp(
      target.x, Stage4Boss.VERTICAL_BEAM_WIDTH / 2, GAME_CONFIG.PLAY_AREA.WIDTH - Stage4Boss.VERTICAL_BEAM_WIDTH / 2,
    );
    const verticalHazard = new Hazard(
      this.scene,
      { kind: 'rect', width: Stage4Boss.VERTICAL_BEAM_WIDTH, height: GAME_CONFIG.PLAY_AREA.HEIGHT },
      players,
      this.hitPlayer,
    );
    verticalHazard.trigger(x, GAME_CONFIG.PLAY_AREA.HEIGHT / 2, Stage4Boss.BEAM_WARNING_MS, Stage4Boss.BEAM_ACTIVE_MS);
    this.beamHazards.push(verticalHazard);
  }

  private updateUltimate(delta: number): void {
    this.ultimateTimer += delta;
    switch (this.ultimateState) {
      case 'idle':
        if (this.ultimateTimer >= Stage4Boss.ULTIMATE_INTERVAL) {
          this.ultimateTimer = 0;
          this.beginUltimateWarning();
        }
        break;
      case 'warning':
        if (this.ultimateTimer >= Stage4Boss.ULTIMATE_WARNING_MS) {
          this.ultimateTimer = 0;
          this.activateUltimate();
        }
        break;
      case 'active':
        this.checkUltimateHits();
        if (this.ultimateTimer >= Stage4Boss.ULTIMATE_ACTIVE_MS) {
          this.ultimateTimer = 0;
          this.endUltimate();
        }
        break;
    }
  }

  private ensureUltimateVisuals(): void {
    if (!this.dangerOverlay) {
      this.dangerOverlay = this.scene.add
        .rectangle(
          GAME_CONFIG.PLAY_AREA.WIDTH / 2, GAME_CONFIG.PLAY_AREA.HEIGHT / 2,
          GAME_CONFIG.PLAY_AREA.WIDTH, GAME_CONFIG.PLAY_AREA.HEIGHT, 0xff0000, 0.35,
        )
        .setDepth(4)
        .setVisible(false);
    }
    if (!this.safeZoneVisual) {
      this.safeZoneVisual = this.scene.add
        .rectangle(0, 0, Stage4Boss.SAFE_ZONE_WIDTH, Stage4Boss.SAFE_ZONE_HEIGHT, 0x39ff14, 0.55)
        .setStrokeStyle(3, 0x39ff14, 1)
        .setDepth(5)
        .setVisible(false);
    }
  }

  /** 必殺技：安置（固定パターンで巡回）を警告表示する。警告〜発生の間は移動を止める */
  private beginUltimateWarning(): void {
    this.ensureUltimateVisuals();
    this.pauseVerticalMovement();
    this.ultimateState = 'warning';

    const center = Stage4Boss.SAFE_ZONE_CENTERS[this.safeZoneIndex];
    this.dangerOverlay!.setFillStyle(0xff0000, 0.3).setVisible(true);
    this.safeZoneVisual!.setPosition(center.x, center.y).setVisible(true);
  }

  private activateUltimate(): void {
    this.ultimateState = 'active';
    this.dangerOverlay!.setFillStyle(0xff0000, 0.8);
  }

  /** 安置の外にいるプレイヤーを無敵時間等を無視して即ゲームオーバーにする */
  private checkUltimateHits(): void {
    const center = Stage4Boss.SAFE_ZONE_CENTERS[this.safeZoneIndex];
    const halfW = Stage4Boss.SAFE_ZONE_WIDTH / 2;
    const halfH = Stage4Boss.SAFE_ZONE_HEIGHT / 2;
    for (const player of this.getPlayers()) {
      const inSafeZone =
        Math.abs(player.x - center.x) <= halfW && Math.abs(player.y - center.y) <= halfH;
      if (!inSafeZone) this.instaKillPlayer(player);
    }
  }

  private endUltimate(): void {
    this.ultimateState = 'idle';
    this.dangerOverlay?.setVisible(false);
    this.safeZoneVisual?.setVisible(false);
    this.resumeVerticalMovement();
    this.safeZoneIndex = (this.safeZoneIndex + 1) % Stage4Boss.SAFE_ZONE_CENTERS.length;
  }

  protected override onDestroyHazards(): void {
    this.beamHazards.forEach((h) => h.forceEnd());
    this.beamHazards = [];
    if (this.dangerOverlay?.active) this.dangerOverlay.destroy();
    if (this.safeZoneVisual?.active) this.safeZoneVisual.destroy();
    this.dangerOverlay = undefined;
    this.safeZoneVisual = undefined;
  }
}
