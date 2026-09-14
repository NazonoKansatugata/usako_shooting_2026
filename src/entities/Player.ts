import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager } from '../managers/SettingsManager';

export class Player extends Phaser.Physics.Arcade.Sprite {
  /** プレイヤー画像全体（本体・羽・砲）の拡大率 */
  private static readonly SCALE = 1.4;

  private _isInvulnerable = false;
  private _hp: number = GAME_CONFIG.PLAYER_HP;
  private readonly wingSprite: Phaser.GameObjects.Sprite;
  private readonly airCannon: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-base');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(Player.SCALE);

    this.wingSprite = scene.add.sprite(x, y - 2 * Player.SCALE, 'player-wing-1').setScale(Player.SCALE);
    this.wingSprite.play('player-flight');
    this.airCannon = scene.add.sprite(x + 15 * Player.SCALE, y + 4 * Player.SCALE, 'player-air-cannon').setScale(Player.SCALE);

    this.setCollideWorldBounds(true);
    // player-base画像(31x43px)のシルエットに大まかに合わせた長方形（幅20px×高さ30px、オフセット6, 8）
    // setScale()を先に呼んでいるため、拡大率(SCALE)は自動的に反映される
    (this.body as Phaser.Physics.Arcade.Body).setSize(20, 30).setOffset(6, 8);
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.wingSprite.setPosition(this.x, this.y - 3 * Player.SCALE);
    this.wingSprite.setRotation(this.rotation);
    this.wingSprite.setAlpha(this.alpha);
    this.wingSprite.setVisible(this.visible);
    this.airCannon.setPosition(this.x + 15 * Player.SCALE, this.y + 4 * Player.SCALE);
    this.airCannon.setRotation(this.rotation);
    this.airCannon.setAlpha(this.alpha);
    this.airCannon.setVisible(this.visible);
  }

  public destroy(fromScene?: boolean): void {
    this.wingSprite.destroy(fromScene);
    this.airCannon.destroy(fromScene);
    super.destroy(fromScene);
  }

  get isInvulnerable(): boolean {
    return this._isInvulnerable;
  }

  get hp(): number {
    return this._hp;
  }

  public resetStats(): void {
    this._hp = GAME_CONFIG.PLAYER_HP;
    this._isInvulnerable = false;
    this.setAlpha(1);
    this.setActive(true);
    this.setVisible(true);
  }

  public move(cursors: Phaser.Types.Input.Keyboard.CursorKeys, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    if (!this.active) return;
    const left = cursors.left.isDown || keys.A.isDown;
    const right = cursors.right.isDown || keys.D.isDown;
    const up = cursors.up.isDown || keys.W.isDown;
    const down = cursors.down.isDown || keys.S.isDown;

    const vx = (right ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED - (left ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED;
    const vy = (down ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED - (up ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED;
    this.setVelocity(vx, vy);
  }

  public damage(customDamage?: number): boolean {
    if (this._isInvulnerable || !this.active) return false;

    const settings = SettingsManager.getInstance();
    // 難易度設定(難だと敵から受けるダメージが2倍になる)
    const baseDamage = customDamage ?? (settings.difficulty === 'hard' ? 2 : 1);
    this._hp -= baseDamage;
    if (this._hp <= 0) {
      this._hp = 0;
      return true; // 死亡
    }

    // 被弾後の無敵時間（約1.2秒間、点滅演出）
    this._isInvulnerable = true;
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 100,
      ease: 'Linear',
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        if (this.active) {
          this.setAlpha(1);
        }
        this._isInvulnerable = false;
      },
    });

    return false;
  }
}
