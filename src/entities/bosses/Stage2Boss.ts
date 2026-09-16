import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Boss } from './Boss';
import { Bullet } from '../Bullet';

/**
 * ステージ2ボス：登場直後は無敵状態で画面中央へ直進し、到達すると停止して無敵が解除される。
 * 以降はその場に留まったまま、0度・90度・180度・270度から弾を発射しつつ発射のたびに角度を
 * 少しずつずらしていく「回転十字弾」と、上下（90度・270度）を除いた6方向へ角度固定で
 * 一斉発射する「非回転6方向弾」を組み合わせて攻撃する。
 */
export class Stage2Boss extends Boss {
  static readonly TEXTURE_KEY = 'boss2';

  /** 実写画像(QRコード)は正方形なので、見た目の高さをこの値に揃えて表示する */
  private static readonly DISPLAY_HEIGHT = 100;
  /** QRコードは正方形なので、当たり判定も他のボスより少し正方形寄りにする */
  private static readonly HITBOX_WIDTH = 90;
  private static readonly HITBOX_HEIGHT = 90;

  /** 登場時、無敵のまま画面中央へ直進する速度(px/s) */
  private static readonly ENTER_SPEED = 220;
  /** この距離まで中央へ近づいたら到達とみなし、停止・無敵解除する */
  private static readonly ARRIVE_THRESHOLD_PX = 6;

  /** 回転十字弾：発射のたびにこの角度(度)だけ回転方向へずらしていく */
  private static readonly ROTATE_STEP_DEG = 3;

  /** 非回転6方向弾の発射間隔(ms)。回転十字弾の間隔とは独立して固定の頻度にする */
  private static readonly SIDE_BURST_INTERVAL_MS = 1000;
  /** 8方向から上（270度）・下（90度）を除いた6方向 */
  private static readonly SIDE_BURST_ANGLES_DEG = [0, 45, 135, 180, 225, 315];

  private phase: 'entering' | 'active' = 'entering';
  private isInvulnerable = true;

  private rotateAngleDeg = 0;
  private rotateTimer = 0;
  private sideBurstTimer = 0;

  /** 画像アセット読み込み失敗時（プリロード漏れ等）のフォールバック用に生成テクスチャも用意しておく */
  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(Stage2Boss.TEXTURE_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xe67e22).fillRect(0, 0, 116, 76).generateTexture(Stage2Boss.TEXTURE_KEY, 116, 76);
    g.destroy();
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly enemyBulletsPool: Phaser.Physics.Arcade.Group,
    private readonly rotateInterval: number,
    private readonly bulletSpeed: number,
  ) {
    Stage2Boss.ensureTexture(scene);
    super(scene, x, y, Stage2Boss.TEXTURE_KEY);

    // 実写画像は元解像度のままだと大きすぎるため見た目だけ縮小する。setScale()は当たり判定の
    // setSize()より先に呼ぶ必要がある（setSize()は呼び出し時点のスケールを当たり判定へ焼き込むため）。
    const scale = Stage2Boss.DISPLAY_HEIGHT / this.height;
    this.setScale(scale);
    (this.body as Phaser.Physics.Arcade.Body).setSize(Stage2Boss.HITBOX_WIDTH, Stage2Boss.HITBOX_HEIGHT);
  }

  /** 無敵中はダメージを一切受けない */
  public override takeDamage(amount = 1): boolean {
    if (this.isInvulnerable) return false;
    return super.takeDamage(amount);
  }

  protected onSpawn(): void {
    this.phase = 'entering';
    this.isInvulnerable = true;
    this.setAlpha(0.55);
    this.rotateAngleDeg = 0;
    this.rotateTimer = 0;
    this.sideBurstTimer = 0;

    const targetX = GAME_CONFIG.PLAY_AREA.WIDTH / 2;
    const targetY = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    this.setVelocity(Math.cos(angle) * Stage2Boss.ENTER_SPEED, Math.sin(angle) * Stage2Boss.ENTER_SPEED);
  }

  protected updateBehavior(_time: number, delta: number): void {
    if (this.phase === 'entering') {
      const targetX = GAME_CONFIG.PLAY_AREA.WIDTH / 2;
      const targetY = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;
      if (Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY) <= Stage2Boss.ARRIVE_THRESHOLD_PX) {
        this.setPosition(targetX, targetY);
        this.setVelocity(0, 0);
        this.setAlpha(1);
        this.isInvulnerable = false;
        this.phase = 'active';
      }
      return;
    }

    this.rotateTimer += delta;
    if (this.rotateTimer >= this.rotateInterval) {
      this.rotateTimer = 0;
      this.fireRotatingCross();
    }

    this.sideBurstTimer += delta;
    if (this.sideBurstTimer >= Stage2Boss.SIDE_BURST_INTERVAL_MS) {
      this.sideBurstTimer = 0;
      this.fireSideBurst();
    }
  }

  /** 0/90/180/270度の十字方向に弾を発射し、発射のたびに角度を少しずつ回転させていく */
  private fireRotatingCross(): void {
    for (let i = 0; i < 4; i++) {
      const angleDeg = this.rotateAngleDeg + i * 90;
      this.fireBulletAt(Phaser.Math.DegToRad(angleDeg));
    }
    this.rotateAngleDeg = (this.rotateAngleDeg + Stage2Boss.ROTATE_STEP_DEG) % 360;
  }

  /** 上下を除いた6方向へ、角度を固定したまま一斉発射する */
  private fireSideBurst(): void {
    for (const angleDeg of Stage2Boss.SIDE_BURST_ANGLES_DEG) {
      this.fireBulletAt(Phaser.Math.DegToRad(angleDeg));
    }
  }

  private fireBulletAt(angle: number): void {
    let bullet = this.enemyBulletsPool.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this.scene, this.x, this.y, 'enemyBullet');
      this.enemyBulletsPool.add(bullet);
    }
    bullet.fire(this.x, this.y, Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
  }
}
