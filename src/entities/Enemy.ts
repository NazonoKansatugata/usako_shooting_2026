import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  /** このX座標を通過したらvyを0にする境界。undefinedなら斜め移動の切り替えは行わない。 */
  private crossX?: number;

  private canShoot = false;
  private shootDelay = 0;
  private hasEnteredScreen = false;
  private shootTimer = 0;
  /** trueになったらShootingScene側が発射処理を行い、falseに戻す。 */
  public pendingShot = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'enemy') {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(12, 5, 8);
  }

  /**
   * speedY・crossXを指定すると、crossXを通過するまで斜めに移動し、
   * 通過した瞬間に垂直速度を0にして水平移動へ切り替える（V字型の交差軌道用）。
   * canShoot・shootDelayを指定すると、画面内に入ってからshootDelay(ms)後に
   * pendingShotがtrueになる（1体につき1回だけ）。
   */
  public spawn(x: number, y: number, speedX = -120, speedY = 0, crossX?: number, canShoot = false, shootDelay = 0): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(speedX, speedY);
    this.crossX = crossX;
    // テクスチャは左向きが正面のため、右向きに進む場合は反転させる
    this.setFlipX(speedX > 0);

    this.canShoot = canShoot;
    this.shootDelay = shootDelay;
    this.hasEnteredScreen = false;
    this.shootTimer = 0;
    this.pendingShot = false;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    if (this.crossX !== undefined) {
      const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
      const crossed = vx < 0 ? this.x <= this.crossX : this.x >= this.crossX;
      if (crossed) {
        this.setVelocityY(0);
        this.crossX = undefined;
      }
    }

    if (this.canShoot) {
      if (!this.hasEnteredScreen) {
        if (this.x >= 0 && this.x <= GAME_CONFIG.WIDTH) {
          this.hasEnteredScreen = true;
          this.shootTimer = this.shootDelay;
        }
      } else if (this.shootTimer > 0) {
        this.shootTimer -= delta;
        if (this.shootTimer <= 0) {
          this.pendingShot = true;
          this.canShoot = false; // 1体につき1回だけ
        }
      }
    }
  }
}
