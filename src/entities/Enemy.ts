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
  /** 見た目・当たり判定の拡大率。画像/当たり判定が小さすぎたため底上げしている。形状ごとに調整したい場合はサブクラスで上書きする。 */
  protected spriteScale = 1.6;
  /** spawn()が呼ばれた時刻(ms)。形状ごとの時間依存の移動（波形移動など）に使う。 */
  protected spawnTime = 0;

  private canShoot = false;
  private shootDelay = 0;
  private hasEnteredScreen = false;
  private shootTimer = 0;
  /** trueになったらShootingScene側が発射処理を行い、falseに戻す。 */
  public pendingShot = false;
  private hp = 1;
  private readonly defaultTexture: string;
  /** 既定（生成テクスチャ）の縦横最大辺。ステージ側で差し替えるカスタム画像の解像度がまちまちなため、
   *  これを基準に敵ごとの見た目サイズを正規化する（例: 極端に高解像度な画像が他の敵より大きく見えるのを防ぐ）。 */
  private readonly defaultMaxDim: number;
  /** setupHitbox()が既定テクスチャに対して設定した当たり判定の基準値（後でカスタム画像の解像度差を補正するために保持する）。 */
  private baseHitbox!: { isCircle: boolean; radius: number; width: number; height: number; offsetX: number; offsetY: number };

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    this.defaultTexture = texture;
    this.defaultMaxDim = Math.max(this.width, this.height);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    // setSize/setCircleは呼び出し時点のスケールを当たり判定に反映するため、setupHitbox()より先にscaleを適用する
    this.setScale(this.spriteScale);
    this.setupHitbox();

    const body = this.body as Phaser.Physics.Arcade.Body;
    this.baseHitbox = {
      isCircle: body.isCircle,
      radius: body.radius,
      width: body.sourceWidth,
      height: body.sourceHeight,
      offsetX: body.offset.x,
      offsetY: body.offset.y,
    };
  }

  /** 見た目の形状に合わせた当たり判定を設定する（各サブクラスで実装） */
  protected abstract setupHitbox(): void;

  /**
   * speedY・crossXを指定すると、crossXを通過するまで斜めに移動し、
   * 通過した瞬間に垂直速度を0にして水平移動へ切り替える（V字型の交差軌道用）。
   * canShoot・shootDelayを指定すると、画面内に入ってからshootDelay(ms)後に
   * pendingShotがtrueになる（1体につき1回だけ）。
   */
  public spawn(
    x: number,
    y: number,
    speedX = -120,
    speedY = 0,
    crossX?: number,
    canShoot = false,
    shootDelay = 0,
    hp = 1,
    texture?: string,
  ): void {
    this.enableBody(true, x, y, true, true);
    this.setTexture(texture && this.scene.textures.exists(texture) ? texture : this.defaultTexture);
    // ステージ側で差し替える画像の解像度は統一されていないため、既定テクスチャとの縦横最大辺の比率でスケールを補正し、
    // どの画像でも他の敵と見た目のサイズが揃うようにする。
    const actualMaxDim = Math.max(this.width, this.height);
    const sizeRatio = this.defaultMaxDim / actualMaxDim;
    this.setScale(this.spriteScale * sizeRatio);
    // 当たり判定はsetupHitbox()が既定テクスチャの解像度基準で設定した値のままだと、
    // 上のスケール補正と掛け合わさって極端に小さく（実質当たらなく）なってしまうため、
    // 見た目のスケール補正と逆比になるよう当たり判定側も同じ比率で補正し、結果として
    // 常に「spriteScale基準の元の当たり判定サイズ」が保たれるようにする。
    const hitboxCompensation = 1 / sizeRatio;
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (this.baseHitbox.isCircle) {
      body.setCircle(
        this.baseHitbox.radius * hitboxCompensation,
        this.baseHitbox.offsetX * hitboxCompensation,
        this.baseHitbox.offsetY * hitboxCompensation,
      );
    } else {
      body
        .setSize(this.baseHitbox.width * hitboxCompensation, this.baseHitbox.height * hitboxCompensation)
        .setOffset(this.baseHitbox.offsetX * hitboxCompensation, this.baseHitbox.offsetY * hitboxCompensation);
    }
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
    this.hp = hp;
  }

  /** ダメージを与え、撃破された場合にtrueを返す。 */
  public takeDamage(amount = 1): boolean {
    this.hp -= amount;
    return this.hp <= 0;
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
