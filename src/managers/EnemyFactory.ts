import Phaser from 'phaser';
import { Enemy } from '../entities/Enemy';
import { TriangleEnemy } from '../entities/enemies/TriangleEnemy';
import { CircleEnemy } from '../entities/enemies/CircleEnemy';
import { SquareEnemy } from '../entities/enemies/SquareEnemy';
import { StarEnemy } from '../entities/enemies/StarEnemy';
import { EnemyShape } from '../types';

export class EnemyFactory {
  /**
   * speedXは符号付きの水平速度（左向きなら負、右向きなら正）。呼び出し側（ShootingScene）が
   * ステージデータのspeed/from/vy/crossXから計算した値をそのまま渡す。
   * shapeで見た目・当たり判定の形状（クラス）を選ぶ。groupは形状ごとに分けたものを渡すこと
   * （プール内で異なる形状の個体が混ざらないようにするため）。
   */
  public static create(
    scene: Phaser.Scene,
    group: Phaser.Physics.Arcade.Group,
    shape: EnemyShape,
    x: number,
    y: number,
    speedX = -120,
    speedY = 0,
    crossX?: number,
    canShoot = false,
    shootDelay = 0,
  ): Enemy {
    let enemy = group.getFirstDead(false) as Enemy;
    if (!enemy) {
      enemy = EnemyFactory.instantiate(scene, shape, x, y);
      group.add(enemy);
    }
    enemy.spawn(x, y, speedX, speedY, crossX, canShoot, shootDelay);
    return enemy;
  }

  private static instantiate(scene: Phaser.Scene, shape: EnemyShape, x: number, y: number): Enemy {
    switch (shape) {
      case 'circle':
        return new CircleEnemy(scene, x, y);
      case 'square':
        return new SquareEnemy(scene, x, y);
      case 'star':
        return new StarEnemy(scene, x, y);
      case 'triangle':
      default:
        return new TriangleEnemy(scene, x, y);
    }
  }
}
