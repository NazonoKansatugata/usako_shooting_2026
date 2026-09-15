import Phaser from 'phaser';
import { Enemy } from '../Enemy';

/** 直進し、画面内に入ったあと自機狙い弾を1発撃つHP1の敵。 */
export class StraightShooterEnemy extends Enemy {
  static readonly TEXTURE_KEY = 'enemyStraightShooter';

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(StraightShooterEnemy.TEXTURE_KEY)) return;

    const graphics = scene.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xff6b6b).fillRoundedRect(2, 6, 34, 20, 5);
    graphics.fillStyle(0xfef3c7).fillRect(8, 11, 20, 5);
    graphics.generateTexture(StraightShooterEnemy.TEXTURE_KEY, 38, 32);
    graphics.destroy();
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    StraightShooterEnemy.ensureTexture(scene);
    super(scene, x, y, StraightShooterEnemy.TEXTURE_KEY);
  }

  protected setupHitbox(): void {
    (this.body as Phaser.Physics.Arcade.Body).setSize(28, 18).setOffset(5, 7);
  }

  public override spawn(
    x: number,
    y: number,
    speedX = -120,
    _speedY = 0,
    _crossX?: number,
    canShoot = true,
    shootDelay = 0,
    hp = 1,
    texture?: string,
  ): void {
    super.spawn(x, y, speedX, 0, undefined, canShoot, shootDelay, hp, texture);
  }
}