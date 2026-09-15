import Phaser from 'phaser';

export class Bullet extends Phaser.Physics.Arcade.Sprite {
  /** 残り貫通回数。0になると通常弾と同様に命中時に消える。 */
  public pierceRemaining = 0;
  /** 貫通中にすでに命中した対象。同じ相手に多重ヒットしないようにする。 */
  private hitTargets = new Set<Phaser.GameObjects.GameObject>();

  constructor(scene: Phaser.Scene, x: number, y: number, key: string) {
    super(scene, x, y, key);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    if (key === 'bullet') {
      (this.body as Phaser.Physics.Arcade.Body).setCircle(8, 4, 4);
    } else {
      (this.body as Phaser.Physics.Arcade.Body).setCircle(4, 2, 2);
    }
  }

  public fire(x: number, y: number, vx: number, vy = 0, pierce = 0): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(vx, vy);
    this.pierceRemaining = pierce;
    this.hitTargets.clear();
  }

  /** 命中判定。未命中の対象ならtrueを返し、命中済みとして記録する（貫通中の多重ヒット防止）。 */
  public registerHit(target: Phaser.GameObjects.GameObject): boolean {
    if (this.hitTargets.has(target)) return false;
    this.hitTargets.add(target);
    return true;
  }
}
