import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager } from '../managers/SettingsManager';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private static readonly HIT_IMAGE_OFFSET_X = 0;
  private static readonly HIT_IMAGE_OFFSET_Y = -30;

  private _isInvulnerable = false;
  private _hp: number = GAME_CONFIG.PLAYER_HP;
  private readonly wingSprite: Phaser.GameObjects.Sprite;
  private readonly airCannon: Phaser.GameObjects.Sprite;
  private readonly hitSprite: Phaser.GameObjects.Sprite;
  private isDying = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-base');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.wingSprite = scene.add.sprite(x, y - 2, 'player-wing-1');
    this.wingSprite.play('player-flight');
    this.airCannon = scene.add.sprite(x + 15, y + 4, 'player-air-cannon');
    this.hitSprite = scene.add.sprite(x, y, 'player-hit');
    this.hitSprite.setVisible(false);

    this.setCollideWorldBounds(true);
    // 喰らい判定を中央の小さな円（半径8px, オフセット10, 10）に設定
    (this.body as Phaser.Physics.Arcade.Body).setCircle(8, 10, 10);
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.wingSprite.setPosition(this.x, this.y - 3);
    this.wingSprite.setRotation(this.rotation);
    this.wingSprite.setAlpha(this.alpha);
    this.wingSprite.setVisible(this.visible);
    this.airCannon.setPosition(this.x + 15, this.y +4 );
    this.airCannon.setRotation(this.rotation);
    this.airCannon.setAlpha(this.alpha);
    this.airCannon.setVisible(this.visible);
  }

  public destroy(fromScene?: boolean): void {
    this.wingSprite.destroy(fromScene);
    this.airCannon.destroy(fromScene);
    this.hitSprite.destroy(fromScene);
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
    this.isDying = false;
    this.setAlpha(1);
    this.setActive(true);
    this.setVisible(true);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.hitSprite.setVisible(false);
  }

  public move(cursors: Phaser.Types.Input.Keyboard.CursorKeys, keys: Record<string, Phaser.Input.Keyboard.Key>): void {
    if (!this.active || this.isDying) return;
    const left = cursors.left.isDown || keys.A.isDown;
    const right = cursors.right.isDown || keys.D.isDown;
    const up = cursors.up.isDown || keys.W.isDown;
    const down = cursors.down.isDown || keys.S.isDown;

    const vx = (right ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED - (left ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED;
    const vy = (down ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED - (up ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED;
    this.setVelocity(vx, vy);
  }

  public startDeathAnimation(): void {
    if (this.isDying) return;
    this.isDying = true;
    this.setVelocity(0, 0);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.setVisible(false);
    this.wingSprite.setVisible(false);
    this.airCannon.setVisible(false);
    this.hitSprite.setPosition(
      this.x + Player.HIT_IMAGE_OFFSET_X,
      this.y + Player.HIT_IMAGE_OFFSET_Y,
    ).setAlpha(1).setVisible(true);

    this.scene.tweens.add({
      targets: this.hitSprite,
      x: this.x + Player.HIT_IMAGE_OFFSET_X + 64,
      duration: 360,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: 4,
    });
    this.scene.tweens.add({
      targets: this.hitSprite,
      y: this.y + 180,
      alpha: 0,
      duration: 1800,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.hitSprite.setVisible(false);
        this.setActive(false);
      },
    });
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

    this.showHitImage();

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

  private showHitImage(): void {
    this.setVisible(false);
    this.wingSprite.setVisible(false);
    this.airCannon.setVisible(false);
    this.hitSprite.setPosition(
      this.x + Player.HIT_IMAGE_OFFSET_X,
      this.y + Player.HIT_IMAGE_OFFSET_Y,
    ).setAlpha(1).setVisible(true);

    this.scene.time.delayedCall(180, () => {
      if (this.isDying || !this.active) return;
      this.hitSprite.setVisible(false);
      this.setVisible(true);
      this.wingSprite.setVisible(true);
      this.airCannon.setVisible(true);
    });
  }
}
