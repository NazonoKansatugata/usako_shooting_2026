import Phaser from 'phaser';

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, key: string) {
    super(scene, x, y, key);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (key === 'bullet') {
      (this.body as Phaser.Physics.Arcade.Body).setCircle(6, 4, 4);
    } else {
      (this.body as Phaser.Physics.Arcade.Body).setCircle(5, 3, 3);
    }
  }

  public fire(x: number, y: number, vx: number, vy = 0): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(vx, vy);
  }
}
