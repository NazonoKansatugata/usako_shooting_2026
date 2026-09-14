import Phaser from 'phaser';
import { Enemy } from '../Enemy';

/** 丸い雑魚敵。 */
export class CircleEnemy extends Enemy {
  static readonly TEXTURE_KEY = 'enemyCircle';

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(CircleEnemy.TEXTURE_KEY)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x4dd0e1).fillCircle(16, 16, 16).generateTexture(CircleEnemy.TEXTURE_KEY, 32, 32);
    g.destroy();
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    CircleEnemy.ensureTexture(scene);
    super(scene, x, y, CircleEnemy.TEXTURE_KEY);
  }

  protected setupHitbox(): void {
    (this.body as Phaser.Physics.Arcade.Body).setCircle(10, 6, 6);
  }
}
