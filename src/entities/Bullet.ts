import Phaser from 'phaser';

const BASE_RADIUS: Record<string, number> = { bullet: 8, enemyBullet: 4 };

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number, key: string) {
    super(scene, x, y, key);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const radius = BASE_RADIUS[key] ?? 4;
    (this.body as Phaser.Physics.Arcade.Body).setCircle(radius, radius / 2, radius / 2);
  }

  /**
   * scale > 1 の場合、見た目と当たり判定の両方を拡大する（WEP強化用）。
   * Arcade BodyのsetCircle()は呼び出し時点のGameObjectスケールを基準にサイズを確定するため、
   * 見た目のsetScale()を先に呼んでからsetCircle()を呼び直す必要がある。
   */
  public fire(x: number, y: number, vx: number, vy = 0, scale = 1): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(vx, vy);
    this.setScale(scale);
    const radius = BASE_RADIUS[this.texture.key] ?? 4;
    (this.body as Phaser.Physics.Arcade.Body).setCircle(radius, radius / 2, radius / 2);
  }
}
