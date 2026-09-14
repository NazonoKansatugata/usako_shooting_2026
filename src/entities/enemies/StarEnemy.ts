import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Enemy } from '../Enemy';

type StarPhase = 'entering' | 'holding' | 'exiting';

/**
 * 星型の雑魚敵。画面の隅（左右どちらか）から出現し、少し進んだところで停止して攻撃、
 * その後は反対の隅へ向けて斜めに移動しながら画面外へ消えていく。
 */
export class StarEnemy extends Enemy {
  static readonly TEXTURE_KEY = 'enemyStar';

  /** 停止している時間(ms) */
  private static readonly HOLD_DURATION = 700;
  /** 停止してから発射するまでの時間(ms) */
  private static readonly FIRE_AT = 300;

  private phase: StarPhase = 'entering';
  private holdTimer = 0;
  private hasFiredThisHold = false;
  private stopX = 0;
  private exitVX = 0;
  private exitVY = 0;

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

  /**
   * 発射タイミングは自前のholding状態で管理するため、基底クラスの自動発射(canShoot)は使わない。
   * 進入方向(speedXの符号)から画面内での停止X座標を、出現Y(上半分/下半分)から抜け先の対角方向を決める。
   * crossXを指定すると、その値を停止X座標として使う（同じ辺から複数体出すときに横方向の停止位置をずらし、
   * 縦一列に並ばず横に広がって見えるようにするため）。省略時は辺ごとの既定位置（端から180px）を使う。
   */
  public override spawn(x: number, y: number, speedX = -120, speedY = 0, crossX?: number, canShoot = false, shootDelay = 0): void {
    super.spawn(x, y, speedX, 0, undefined, false, shootDelay);
    void canShoot;
    void speedY;

    this.phase = 'entering';
    this.holdTimer = 0;
    this.hasFiredThisHold = false;
    this.stopX = crossX ?? (speedX < 0 ? GAME_CONFIG.WIDTH - 180 : 180);

    const exitSpeed = Math.abs(speedX);
    this.exitVX = speedX; // 同じ水平方向のまま進み続け、反対の隅を抜けて画面外へ
    this.exitVY = y < GAME_CONFIG.PLAY_AREA.HEIGHT / 2 ? exitSpeed : -exitSpeed; // 上から来たら下へ、下から来たら上へ
  }

  protected override updateMovement(_time: number, delta: number): void {
    if (this.phase === 'entering') {
      const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
      const reachedStop = vx < 0 ? this.x <= this.stopX : this.x >= this.stopX;
      if (reachedStop) {
        this.setVelocity(0, 0);
        this.phase = 'holding';
        this.holdTimer = 0;
        this.hasFiredThisHold = false;
      }
      return;
    }

    if (this.phase === 'holding') {
      this.holdTimer += delta;
      if (!this.hasFiredThisHold && this.holdTimer >= StarEnemy.FIRE_AT) {
        this.hasFiredThisHold = true;
        this.pendingShot = true;
      }
      if (this.holdTimer >= StarEnemy.HOLD_DURATION) {
        this.phase = 'exiting';
        this.setVelocity(this.exitVX, this.exitVY);
      }
      return;
    }

    // exiting: 対角方向へ進んだまま。画面外に出たら呼び出し側(ShootingScene)のオフスクリーン判定で自動的に消える。
  }

  /** 発射は上のupdateMovement()内でholding状態にあわせて自前管理するため、基底クラスの自動発射は無効化する。 */
  protected override updateShooting(_time: number, _delta: number): void {
    // no-op
  }
}
