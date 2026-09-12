import Phaser from 'phaser';

export class Boss extends Phaser.Physics.Arcade.Sprite {
  private _hp = 40;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'boss');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setImmovable(true);
    this.setCollideWorldBounds(true);
    this.setBounce(1);
    (this.body as Phaser.Physics.Arcade.Body).setSize(100, 60);
  }

  get hp(): number {
    return this._hp;
  }

  public spawn(x: number, y: number, hp = 40): void {
    this._hp = hp;
    this.enableBody(true, x, y, true, true);
    this.setVelocityY(80);
  }

  public takeDamage(amount = 1): boolean {
    this._hp -= amount;
    if (this._hp <= 0) {
      this.disableBody(true, true);
      return true; // 撃破
    }
    return false;
  }
}
