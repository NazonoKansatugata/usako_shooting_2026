import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Boss } from './Boss';
import { Bullet } from '../Bullet';

type Phase = 'movingToCenter' | 'spiraling';

/**
 * ステージ1ボス：出現後まず画面中央へ移動し、そこに留まって0度・90度・180度・270度（十字4方向）へ弾を発射する。
 * 発射のたびにこの4方向を少しずつ回転させることで、全体として渦巻き状の弾幕になる。
 */
export class Stage1Boss extends Boss {
  static readonly TEXTURE_KEY = 'boss1';

  private static readonly CENTER_X = GAME_CONFIG.PLAY_AREA.WIDTH / 2;
  private static readonly CENTER_Y = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;
  private static readonly MOVE_SPEED = 300;
  private static readonly ARRIVAL_DISTANCE = 6;
  /** 発射間隔(ms) */
  private static readonly VOLLEY_INTERVAL = 180;
  /** 発射のたびに十字4方向の向きをこの角度ずつ回転させ、渦巻き状に見せる */
  private static readonly ROTATION_STEP = Phaser.Math.DegToRad(10);
  private static readonly SPOKE_ANGLES = [0, 90, 180, 270].map((deg) => Phaser.Math.DegToRad(deg));

  private phase: Phase = 'movingToCenter';
  private volleyTimer = 0;
  private ringAngleOffset = 0;

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(Stage1Boss.TEXTURE_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xc44569).fillRect(0, 0, 116, 76).generateTexture(Stage1Boss.TEXTURE_KEY, 116, 76);
    g.destroy();
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly bulletsPool: Phaser.Physics.Arcade.Group,
    private readonly bulletSpeed: number,
  ) {
    Stage1Boss.ensureTexture(scene);
    super(scene, x, y, Stage1Boss.TEXTURE_KEY);
  }

  protected onSpawn(): void {
    this.phase = 'movingToCenter';
    this.volleyTimer = 0;
    this.ringAngleOffset = 0;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, Stage1Boss.CENTER_X, Stage1Boss.CENTER_Y);
    this.setVelocity(Math.cos(angle) * Stage1Boss.MOVE_SPEED, Math.sin(angle) * Stage1Boss.MOVE_SPEED);
  }

  protected updateBehavior(_time: number, delta: number): void {
    if (this.phase === 'movingToCenter') {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, Stage1Boss.CENTER_X, Stage1Boss.CENTER_Y);
      if (dist <= Stage1Boss.ARRIVAL_DISTANCE) {
        this.setPosition(Stage1Boss.CENTER_X, Stage1Boss.CENTER_Y);
        this.setVelocity(0, 0);
        this.phase = 'spiraling';
      }
      return;
    }
    this.tickSpiral(delta);
  }

  private tickSpiral(delta: number): void {
    this.volleyTimer += delta;
    if (this.volleyTimer < Stage1Boss.VOLLEY_INTERVAL) return;
    this.volleyTimer = 0;

    for (const spoke of Stage1Boss.SPOKE_ANGLES) {
      this.fireBulletAt(this.ringAngleOffset + spoke);
    }
    this.ringAngleOffset += Stage1Boss.ROTATION_STEP;
  }

  private fireBulletAt(angle: number): void {
    let bullet = this.bulletsPool.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this.scene, this.x, this.y, 'enemyBullet');
      this.bulletsPool.add(bullet);
    }
    bullet.fire(this.x, this.y, Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
  }
}
