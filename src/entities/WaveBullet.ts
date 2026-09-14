import Phaser from 'phaser';
import { Bullet } from './Bullet';

/** 丸の敵専用の弾。発射方向に直進しつつ、進行方向に対して垂直にサイン波で揺れながら飛ぶ。 */
export class WaveBullet extends Bullet {
  /** 波の振幅(px) */
  private static readonly AMPLITUDE = 25;
  /** 波の周期(ms) */
  private static readonly PERIOD = 350;

  private dirX = 0;
  private dirY = 0;
  private perpX = 0;
  private perpY = 0;
  private baseSpeed = 0;
  private waveSpawnTime = 0;

  public fireWave(x: number, y: number, angle: number, speed: number): void {
    this.fire(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    this.dirX = Math.cos(angle);
    this.dirY = Math.sin(angle);
    // 進行方向を90度回転させた単位ベクトル（波の揺れ方向）
    this.perpX = -this.dirY;
    this.perpY = this.dirX;
    this.baseSpeed = speed;
    this.waveSpawnTime = this.scene.time.now;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    // omegaは"1msあたりのラジアン"。速度はpx/秒単位のため、微分値(px/ms)を1000倍してpx/秒に変換する。
    const omega = (2 * Math.PI) / WaveBullet.PERIOD;
    const elapsed = time - this.waveSpawnTime;
    const perpSpeed = WaveBullet.AMPLITUDE * omega * 1000 * Math.cos(omega * elapsed);

    const vx = this.dirX * this.baseSpeed + this.perpX * perpSpeed;
    const vy = this.dirY * this.baseSpeed + this.perpY * perpSpeed;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
  }
}
