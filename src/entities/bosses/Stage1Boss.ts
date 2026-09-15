import Phaser from 'phaser';
import { Boss } from './Boss';
import { Bullet } from '../Bullet';

/**
 * ステージ1ボス：画面右側に留まったまま、自機のいる左方向を中心に単発弾を発射し続ける。
 * 発射のたびに角度を少しずつ広げていき、一定角度まで達したら逆方向へ戻す（左右にスイープする単発弾）。
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

  private shotTimer = 0;
  private sweepOffsetDeg = 0;
  private sweepDirection: 1 | -1 = 1;

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
  ) {
    Stage1Boss.ensureTexture(scene);
    super(scene, x, y, Stage1Boss.TEXTURE_KEY);
  }

  protected onSpawn(): void {
    this.shotTimer = 0;
    this.sweepOffsetDeg = 0;
    this.sweepDirection = 1;
    this.setVelocity(0, 0);
  }

  protected updateBehavior(_time: number, delta: number): void {
    this.shotTimer += delta;
    if (this.shotTimer < Stage1Boss.SHOT_INTERVAL) return;
    this.shotTimer = 0;
    this.fireSweepShot();
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
}
