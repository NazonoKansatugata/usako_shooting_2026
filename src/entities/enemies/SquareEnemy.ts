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

  /** 斜め移動はせず、常に水平方向の直進のみ行う（ステージJSON側のvy/crossX指定は無視する）。 */
  public override spawn(x: number, y: number, speedX = -120, _speedY = 0, _crossX?: number, canShoot = false, shootDelay = 0): void {
    super.spawn(x, y, speedX, 0, undefined, canShoot, shootDelay);
  }
}
