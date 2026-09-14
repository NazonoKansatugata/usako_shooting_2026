import Phaser from 'phaser';
import { Enemy } from '../Enemy';

/** 正方形の雑魚敵。 */
export class SquareEnemy extends Enemy {
  static readonly TEXTURE_KEY = 'enemySquare';

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(SquareEnemy.TEXTURE_KEY)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffa500).fillRect(0, 0, 32, 32).generateTexture(SquareEnemy.TEXTURE_KEY, 32, 32);
    g.destroy();
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    SquareEnemy.ensureTexture(scene);
    super(scene, x, y, SquareEnemy.TEXTURE_KEY);
  }

  protected setupHitbox(): void {
    (this.body as Phaser.Physics.Arcade.Body).setSize(16, 16).setOffset(8, 8);
  }
}
