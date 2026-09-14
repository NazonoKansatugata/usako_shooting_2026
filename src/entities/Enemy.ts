import Phaser from 'phaser';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  /** このX座標を通過したらvyを0にする境界。undefinedなら斜め移動の切り替えは行わない。 */
  private crossX?: number;

  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'enemy') {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(12, 5, 8);
  }

  /**
   * speedY・crossXを指定すると、crossXを通過するまで斜めに移動し、
   * 通過した瞬間に垂直速度を0にして水平移動へ切り替える（V字型の交差軌道用）。
   */
  public spawn(x: number, y: number, speedX = -120, speedY = 0, crossX?: number): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(speedX, speedY);
    this.crossX = crossX;
    // テクスチャは左向きが正面のため、右向きに進む場合は反転させる
    this.setFlipX(speedX > 0);
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (this.crossX === undefined || !this.active) return;

    const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
    const crossed = vx < 0 ? this.x <= this.crossX : this.x >= this.crossX;
    if (crossed) {
      this.setVelocityY(0);
      this.crossX = undefined;
    }
  }
}
