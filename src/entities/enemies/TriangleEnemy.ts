import Phaser from 'phaser';
import { Enemy } from '../Enemy';

/** 既存の三角形の雑魚敵。見た目・当たり判定は従来のEnemy実装を踏襲する。 */
export class TriangleEnemy extends Enemy {
  static readonly TEXTURE_KEY = 'enemyTriangle';
  static readonly TEXTURE_KEY_RED = 'enemyTriangleRed';

  static ensureTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(TriangleEnemy.TEXTURE_KEY)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xff6b6b).fillTriangle(0, 20, 34, 0, 34, 40).generateTexture(TriangleEnemy.TEXTURE_KEY, 34, 40);
    g.clear().fillStyle(0xdc2626).fillTriangle(0, 20, 34, 0, 34, 40).generateTexture(TriangleEnemy.TEXTURE_KEY_RED, 34, 40);
    g.destroy();
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    TriangleEnemy.ensureTextures(scene);
    super(scene, x, y, TriangleEnemy.TEXTURE_KEY);
  }

  protected setupHitbox(): void {
    (this.body as Phaser.Physics.Arcade.Body).setCircle(12, 5, 8);
  }
}
