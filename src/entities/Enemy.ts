import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

/**
 * 全ての雑魚敵の基底クラス。移動（水平＋斜め交差）と自機狙い弾の発射タイミング管理を担当する。
 * 見た目（テクスチャ）と当たり判定の形状は、形ごとのサブクラス（entities/enemies/配下）が用意する。
 */
export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  /** このX座標を通過したらvyを0にする境界。undefinedなら斜め移動の切り替えは行わない。 */
  private crossX?: number;
  /** 形状ごとの移動速度倍率。サブクラスでオーバーライドする（例: 三角形を高速化）。 */
  protected speedMultiplier = 1;
  /** spawn()が呼ばれた時刻(ms)。形状ごとの時間依存の移動（波形移動など）に使う。 */
  protected spawnTime = 0;

  private canShoot = false;
  private shootDelay = 0;
  private hasEnteredScreen = false;
  private shootTimer = 0;
  /** trueになったらShootingScene側が発射処理を行い、falseに戻す。 */
  public pendingShot = false;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setupHitbox();
  }

  /** 見た目の形状に合わせた当たり判定を設定する（各サブクラスで実装） */
  protected abstract setupHitbox(): void;

  /**
   * speedY・crossXを指定すると、crossXを通過するまで斜めに移動し、
   * 通過した瞬間に垂直速度を0にして水平移動へ切り替える（V字型の交差軌道用）。
   * canShoot・shootDelayを指定すると、画面内に入ってからshootDelay(ms)後に
   * pendingShotがtrueになる（1体につき1回だけ）。
   */
  public spawn(x: number, y: number, speedX = -120, speedY = 0, crossX?: number, canShoot = false, shootDelay = 0): void {
    this.enableBody(true, x, y, true, true);
    this.setVelocity(speedX * this.speedMultiplier, speedY * this.speedMultiplier);
    this.crossX = crossX;
    this.spawnTime = this.scene.time.now;
    // テクスチャは左向きが正面のため、右向きに進む場合は反転させる
    this.setFlipX(speedX > 0);

    this.canShoot = canShoot;
    this.shootDelay = shootDelay;
    this.hasEnteredScreen = false;
    this.shootTimer = 0;
    this.pendingShot = false;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;

    this.updateMovement(time, delta);
    this.updateShooting(time, delta);
  }

  /**
   * 発射タイミングの管理。既定では「画面内に入ってからshootDelay(ms)後に1回だけpendingShotを立てる」。
   * 独自の発射タイミングを持たせたいサブクラス（例: 星の停止攻撃）はこれをオーバーライドする。
   */
  protected updateShooting(_time: number, delta: number): void {
    if (!this.canShoot) return;

    if (!this.hasEnteredScreen) {
      if (this.x >= 0 && this.x <= GAME_CONFIG.WIDTH) {
        this.hasEnteredScreen = true;
        this.shootTimer = this.shootDelay;
      }
    } else if (this.shootTimer > 0) {
      this.shootTimer -= delta;
      if (this.shootTimer <= 0) {
        this.pendingShot = true;
        this.canShoot = false; // 1体につき1回だけ
      }
    }
  }

  /**
   * 毎フレームの移動処理。既定では斜め交差移動（crossX到達でvyを0にする）のみ。
   * 形状ごとに違う動きをさせたいサブクラス（例: 丸の波形移動）はこれをオーバーライドする。
   */
  protected updateMovement(_time: number, _delta: number): void {
    if (this.crossX !== undefined) {
      const vx = (this.body as Phaser.Physics.Arcade.Body).velocity.x;
      const crossed = vx < 0 ? this.x <= this.crossX : this.x >= this.crossX;
      if (crossed) {
        this.setVelocityY(0);
        this.crossX = undefined;
      }
    }
  }
}
