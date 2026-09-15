import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Enemy } from '../Enemy';

type DashRetreatPhase = 'entering' | 'holding' | 'returning';

/** 高速で中央付近へ進入し、少し滞在してから来た方向へ帰るHP10の敵。 */
export class DashRetreatEnemy extends Enemy {
  static readonly TEXTURE_KEY = 'enemyDashRetreat';
  private static readonly HOLD_DURATION = 1600;

  private phase: DashRetreatPhase = 'entering';
  private holdElapsed = 0;
  private stopX = 0;
  private returnSpeedX = 0;

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(DashRetreatEnemy.TEXTURE_KEY)) return;

    const graphics = scene.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x8b5cf6).fillTriangle(2, 16, 30, 2, 30, 30);
    graphics.fillStyle(0xc4b5fd).fillCircle(19, 16, 6);
    graphics.lineStyle(2, 0xfef08a).strokeTriangle(2, 16, 30, 2, 30, 30);
    graphics.generateTexture(DashRetreatEnemy.TEXTURE_KEY, 32, 32);
    graphics.destroy();
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    DashRetreatEnemy.ensureTexture(scene);
    super(scene, x, y, DashRetreatEnemy.TEXTURE_KEY);
  }

  protected setupHitbox(): void {
    (this.body as Phaser.Physics.Arcade.Body).setCircle(12, 5, 4);
  }

  public override spawn(
    x: number,
    y: number,
    speedX = -600,
    _speedY = 0,
    crossX?: number,
    _canShoot = false,
    _shootDelay = 0,
    hp = 10,
    texture?: string,
  ): void {
    super.spawn(x, y, speedX, 0, undefined, false, 0, hp, texture);
    this.phase = 'entering';
    this.holdElapsed = 0;
    this.stopX = crossX ?? GAME_CONFIG.WIDTH / 2;
    this.returnSpeedX = -speedX;
  }

  protected override updateMovement(_time: number, delta: number): void {
    if (this.phase === 'entering') {
      const velocityX = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
      const reachedStop = velocityX < 0 ? this.x <= this.stopX : this.x >= this.stopX;
      if (reachedStop) {
        this.setVelocity(0, 0);
        this.phase = 'holding';
      }
      return;
    }

    if (this.phase === 'holding') {
      this.holdElapsed += delta;
      if (this.holdElapsed >= DashRetreatEnemy.HOLD_DURATION) {
        this.phase = 'returning';
        this.setVelocityX(this.returnSpeedX);
        this.setFlipX(this.returnSpeedX > 0);
      }
    }
  }
}