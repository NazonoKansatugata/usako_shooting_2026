import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Boss } from './Boss';
import { Bullet } from '../Bullet';
import { Hazard } from './Hazard';

type HitPlayerFn = (object1: any, object2: any) => void;

/**
 * ステージ1ボス：上下にゆっくり往復移動しながら、自機のいる左方向を中心に単発弾を発射し続ける。
 * 発射のたびに角度を少しずつ広げていき、一定角度まで達したら逆方向へ戻す（左右にスイープする単発弾）。
 * 一定間隔で、警告→発生の細い横一直線ビーム（ボス自身のY座標に追従）も発射する。
 */
export class Stage1Boss extends Boss {
  static readonly TEXTURE_KEY = 'boss1';

  /** 発射間隔(ms) */
  private static readonly SHOT_INTERVAL = 140;
  /** 基準となる発射角度（画面右のボスから左＝プレイエリア側へ向く角度） */
  private static readonly BASE_ANGLE_DEG = 180;
  /** 基準角度からの振れ幅（±この角度の範囲でスイープする） */
  private static readonly SWEEP_RANGE_DEG = 60;
  /** 発射のたびに角度をこの分だけ変化させる */
  private static readonly SWEEP_STEP_DEG = 6;

  /** 実写画像は解像度が大きいため、他のボスと見た目のサイズが揃うようこの高さ(px)に縮小表示する */
  private static readonly DISPLAY_HEIGHT = 150;
  /** 当たり判定サイズ（見た目の縦長な写真に合わせて、他のボスより少し大きめ・縦長にしている） */
  private static readonly HITBOX_WIDTH = 110;
  private static readonly HITBOX_HEIGHT = 130;

  private static readonly PATROL_SPEED = 130;
  private static readonly BEAM_INTERVAL = 3000;
  private static readonly BEAM_WARNING_MS = 900;
  private static readonly BEAM_ACTIVE_MS = 300;
  private static readonly BEAM_HEIGHT = 30;
  private static readonly BEAM_Y_MARGIN = 60;

  private shotTimer = 0;
  private sweepOffsetDeg = 0;
  private sweepDirection: 1 | -1 = 1;

  private beamTimer = 0;
  private beamHazards: Hazard[] = [];
  private beamInProgress = false;

  /** 画像アセット読み込み失敗時（プリロード漏れ等）のフォールバック用に生成テクスチャも用意しておく */
  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(Stage1Boss.TEXTURE_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xc44569).fillRect(0, 0, 116, 76).generateTexture(Stage1Boss.TEXTURE_KEY, 116, 76);
    g.destroy();
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bulletsPool: Phaser.Physics.Arcade.Group,
    private readonly bulletSpeed: number,
    private readonly getPlayers: () => Phaser.Physics.Arcade.Sprite[],
    private readonly hitPlayer: HitPlayerFn,
  ) {
    Stage1Boss.ensureTexture(scene);
    super(scene, x, y, Stage1Boss.TEXTURE_KEY);

    // 実写画像は元解像度のままだと大きすぎるため見た目だけ縮小する。setScale()は当たり判定の
    // setSize()より先に呼ぶ必要がある（setSize()は呼び出し時点のスケールを当たり判定へ焼き込むため）。
    const scale = Stage1Boss.DISPLAY_HEIGHT / this.height;
    this.setScale(scale);
    // 見た目の縦長画像に対して当たり判定が小さすぎたため、scale適用後に改めて大きめのサイズで設定し直す。
    (this.body as Phaser.Physics.Arcade.Body).setSize(Stage1Boss.HITBOX_WIDTH, Stage1Boss.HITBOX_HEIGHT);
  }

  protected onSpawn(): void {
    this.shotTimer = 0;
    this.sweepOffsetDeg = 0;
    this.sweepDirection = 1;
    this.beamTimer = 0;
    this.beamHazards = [];
    this.beamInProgress = false;
    this.setVelocityY(Stage1Boss.PATROL_SPEED);
  }

  protected updateBehavior(_time: number, delta: number): void {
    this.shotTimer += delta;
    if (this.shotTimer >= Stage1Boss.SHOT_INTERVAL) {
      this.shotTimer = 0;
      this.fireSweepShot();
    }

    this.beamTimer += delta;
    if (this.beamTimer >= Stage1Boss.BEAM_INTERVAL) {
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
  }

  private fireSweepShot(): void {
    const angleDeg = Stage1Boss.BASE_ANGLE_DEG + this.sweepOffsetDeg;
    this.fireBulletAt(Phaser.Math.DegToRad(angleDeg));

    this.sweepOffsetDeg += Stage1Boss.SWEEP_STEP_DEG * this.sweepDirection;
    if (this.sweepOffsetDeg >= Stage1Boss.SWEEP_RANGE_DEG) {
      this.sweepOffsetDeg = Stage1Boss.SWEEP_RANGE_DEG;
      this.sweepDirection = -1;
    } else if (this.sweepOffsetDeg <= -Stage1Boss.SWEEP_RANGE_DEG) {
      this.sweepOffsetDeg = -Stage1Boss.SWEEP_RANGE_DEG;
      this.sweepDirection = 1;
    }
  }

  private fireBulletAt(angle: number): void {
    let bullet = this.bulletsPool.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this.scene, this.x, this.y, 'enemyBullet');
      this.bulletsPool.add(bullet);
    }
    bullet.fire(this.x, this.y, Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
  }

  /** ビーム発射中に動くと警告位置とビームの座標がずれるため、警告〜発生の間は移動を止める */
  private fireBeam(): void {
    this.pauseVerticalMovement();
    this.beamInProgress = true;

    const y = Phaser.Math.Clamp(this.y, Stage1Boss.BEAM_Y_MARGIN, GAME_CONFIG.PLAY_AREA.HEIGHT - Stage1Boss.BEAM_Y_MARGIN);
    const hazard = new Hazard(
      this.scene,
      { kind: 'rect', width: GAME_CONFIG.PLAY_AREA.WIDTH, height: Stage1Boss.BEAM_HEIGHT },
      this.getPlayers(),
      this.hitPlayer,
    );
    hazard.trigger(GAME_CONFIG.PLAY_AREA.WIDTH / 2, y, Stage1Boss.BEAM_WARNING_MS, Stage1Boss.BEAM_ACTIVE_MS);
    this.beamHazards.push(hazard);
  }

  protected override onDestroyHazards(): void {
    this.beamHazards.forEach((h) => h.forceEnd());
    this.beamHazards = [];
  }
}
