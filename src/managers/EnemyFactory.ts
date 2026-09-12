import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';

export class EnemyFactory {
  public static create(scene: Phaser.Scene, group: Phaser.Physics.Arcade.Group, x: number, y: number, type = 'basic'): Enemy {
    let enemy = group.getFirstDead(false) as Enemy;
    if (!enemy) {
      enemy = new Enemy(scene, x, y, 'enemy');
      group.add(enemy);
    }
    const speedX = type === 'fast' ? -220 : -Phaser.Math.Between(90, 150);
    enemy.spawn(x, y, speedX);
    return enemy;
  }
}
