import Phaser from 'phaser';

/** 敵撃破時にドロップし、自機が接触するとステータスポイントを1つ渡すアイテム。 */
export class PickupItem extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'pickup-point');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    (this.body as Phaser.Physics.Arcade.Body).setCircle(8, 0, 0);
  }

  public spawn(x: number, y: number): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(-40, 30);
  }
}
