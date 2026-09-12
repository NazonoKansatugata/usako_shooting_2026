import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private _isInvulnerable = false;
  private _hp = GAME_CONFIG.PLAYER_HP;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    // 喰らい判定を中央の小さな円（半径8px, オフセット10, 10）に設定
    (this.body as Phaser.Physics.Arcade.Body).setCircle(8, 10, 10);
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

  public damage(): boolean {
    if (this._isInvulnerable || !this.active) return false;

    this._hp -= 1;
    if (this._hp <= 0) {
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
