import Phaser from 'phaser';

/**
 * ボスの抽象基底クラス。HP管理・被弾処理などの共通部分のみを持ち、
 * 実際の移動・攻撃パターンは各ステージのサブクラス（Stage1Boss等）が
 * updateBehavior()内で完全に自己完結して実装する。
 */
export abstract class Boss extends Phaser.Physics.Arcade.Sprite {
  protected _hp = 40;
  protected maxHp = 40;
  private savedVelocityY = 80;

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setImmovable(true);
    this.setCollideWorldBounds(true);
    this.setBounce(1);
    (this.body as Phaser.Physics.Arcade.Body).setSize(100, 60);
  }

  get hp(): number {
    return this._hp;
  }

  get hpRatio(): number {
    return this.maxHp > 0 ? this._hp / this.maxHp : 0;
  }

  public spawn(x: number, y: number, hp = 40): void {
    this.maxHp = hp;
    this._hp = hp;
    this.enableBody(true, x, y, true, true);
    this.onSpawn();
  }

  /** 各ボス固有のフェーズ・タイマーの初期化 */
  protected abstract onSpawn(): void;

  public takeDamage(amount = 1): boolean {
    this._hp -= amount;
    if (this._hp <= 0) {
      this._hp = 0;
      this.onDestroyHazards();
      this.disableBody(true, true);
      return true; // 撃破
    }
    return false;
  }

  override preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    if (!this.active) return;
    this.updateBehavior(time, delta);
  }

  /** 各ボス固有の移動・攻撃ロジック */
  protected abstract updateBehavior(time: number, delta: number): void;

  override destroy(fromScene?: boolean): void {
    this.onDestroyHazards();
    super.destroy(fromScene);
  }

  /** 進行中のハザード（爆風・警告ビーム等）やタイマーを破棄する。既定では何もしない */
  protected onDestroyHazards(): void {}

  /** ビーム発射中に動くと警告位置とビームの座標がずれるため、警告〜発生の間だけ上下移動を止めるのに使う */
  protected pauseVerticalMovement(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.y !== 0) this.savedVelocityY = body.velocity.y;
    this.setVelocity(0, 0);
  }

  protected resumeVerticalMovement(): void {
    this.setVelocityY(this.savedVelocityY);
  }
}
