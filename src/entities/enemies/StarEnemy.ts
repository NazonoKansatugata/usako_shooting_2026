import Phaser from 'phaser';
import { Enemy } from '../Enemy';

/** 星型の雑魚敵。 */
export class StarEnemy extends Enemy {
  static readonly TEXTURE_KEY = 'enemyStar';

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(StarEnemy.TEXTURE_KEY)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });
    const points = StarEnemy.buildStarPoints(16, 16, 5, 16, 7);
    g.fillStyle(0xffe066).fillPoints(points, true).generateTexture(StarEnemy.TEXTURE_KEY, 32, 32);
    g.destroy();
  }

  /** 5方向に尖った星型の頂点座標を計算する（外側の頂点と内側の頂点を交互に配置） */
  private static buildStarPoints(cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number): Phaser.Geom.Point[] {
    const points: Phaser.Geom.Point[] = [];
    let rotation = (Math.PI / 2) * 3;
    const step = Math.PI / spikes;

    for (let i = 0; i < spikes; i++) {
      points.push(new Phaser.Geom.Point(cx + Math.cos(rotation) * outerRadius, cy + Math.sin(rotation) * outerRadius));
      rotation += step;
      points.push(new Phaser.Geom.Point(cx + Math.cos(rotation) * innerRadius, cy + Math.sin(rotation) * innerRadius));
      rotation += step;
    }
    return points;
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    StarEnemy.ensureTexture(scene);
    super(scene, x, y, StarEnemy.TEXTURE_KEY);
  }

  protected setupHitbox(): void {
    (this.body as Phaser.Physics.Arcade.Body).setCircle(8, 8, 8);
  }
}
