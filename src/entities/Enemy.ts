import Phaser from 'phaser';

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, texture = 'enemy') {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(12, 5, 8);
  }

  public spawn(x: number, y: number, speedX = -120): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocityX(speedX);
  }
}
