import Phaser from 'phaser';
import { Bullet } from './Bullet';

/** 発射後しばらくの間だけ緩やかに自機へ軌道補正する、正方形の敵専用の弾。 */
export class HomingBullet extends Bullet {
  /** この時間(ms)が経過するまでだけ軌道補正する */
  private static readonly HOMING_DURATION = 1000;
  /** 旋回速度(rad/s)。小さいほど「少しだけ」追尾する緩い動きになる */
  private static readonly TURN_RATE = Math.PI * 0.8;

  private target?: Phaser.GameObjects.Sprite;
  private homingSpawnTime = 0;

  public fireHoming(x: number, y: number, vx: number, vy: number, target: Phaser.GameObjects.Sprite): void {
    this.fire(x, y, vx, vy);
    this.target = target;
    this.homingSpawnTime = this.scene.time.now;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active || !this.target || !this.target.active) return;
    if (time - this.homingSpawnTime > HomingBullet.HOMING_DURATION) return;

    const body = this.body as Phaser.Physics.Arcade.Body;
    const currentAngle = body.velocity.angle();
    const targetAngle = Phaser.Math.Angle.Between(this.x, this.y, this.target.x, this.target.y);
    const maxStep = HomingBullet.TURN_RATE * (delta / 1000);
    const newAngle = Phaser.Math.Angle.RotateTo(currentAngle, targetAngle, maxStep);
    const speed = body.velocity.length();
    body.velocity.setToPolar(newAngle, speed);
  }
}
