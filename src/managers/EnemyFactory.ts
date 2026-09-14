import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';

export class EnemyFactory {
  /**
   * speedXは符号付きの水平速度（左向きなら負、右向きなら正）。呼び出し側（ShootingScene）が
   * ステージデータのspeed/from/vy/crossXから計算した値をそのまま渡す。
   */
  public static create(
    scene: Phaser.Scene,
    group: Phaser.Physics.Arcade.Group,
    x: number,
    y: number,
    type = 'basic',
    speedX = -120,
    speedY = 0,
    crossX?: number,
  ): Enemy {
    let enemy = group.getFirstDead(false) as Enemy;
    if (!enemy) {
      enemy = new Enemy(scene, x, y, 'enemy');
      group.add(enemy);
    }
    enemy.spawn(x, y, speedX, speedY, crossX);
    return enemy;
  }
}
