import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager } from '../managers/SettingsManager';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private _isInvulnerable = false;
  private _hp: number = GAME_CONFIG.PLAYER_HP;
  private readonly wingSprite: Phaser.GameObjects.Sprite;
  private readonly airCannon: Phaser.GameObjects.Sprite;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player-base');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.wingSprite = scene.add.sprite(x, y - 2, 'player-wing-1');
    this.wingSprite.play('player-flight');
    this.airCannon = scene.add.sprite(x + 15, y + 4, 'player-air-cannon');

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
