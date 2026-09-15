import Phaser from 'phaser';
import { Enemy } from '../Enemy';

/** 丸い雑魚敵。水平移動しながらサイン波でY座標が上下に揺れる。 */
export class CircleEnemy extends Enemy {
  static readonly TEXTURE_KEY = 'enemyCircle';
  /** 波の振幅(px) */
  private static readonly WAVE_AMPLITUDE = 70;
  /** 波の周期(ms) */
  private static readonly WAVE_PERIOD = 1200;

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(CircleEnemy.TEXTURE_KEY)) return;

    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x4dd0e1).fillCircle(16, 16, 16).generateTexture(CircleEnemy.TEXTURE_KEY, 32, 32);
    g.destroy();
  }

  constructor(scene: Phaser.Scene, x: number, y: number) {
    CircleEnemy.ensureTexture(scene);
    super(scene, x, y, CircleEnemy.TEXTURE_KEY);
  }

  protected setupHitbox(): void {
    (this.body as Phaser.Physics.Arcade.Body).setCircle(10, 6, 6);
  }

  /**
   * ステージJSON側のvy/crossX指定は使わず、常に固定の振幅・周期でY座標をサイン波状に揺らす。
   * 速度が位置の微分(A*ω*cos(ωt))になるようにvyを毎フレーム設定することで、物理エンジンの
   * 速度駆動の移動と衝突せずに滑らかな波形軌道を作る。
   */
  protected override updateMovement(time: number): void {
    // omegaは"1msあたりのラジアン"。setVelocityYはpx/秒単位のため、
    // 微分値(px/ms)を1000倍してpx/秒に変換する。
    const omega = (2 * Math.PI) / CircleEnemy.WAVE_PERIOD;
    const elapsed = time - this.spawnTime;
    this.setVelocityY(CircleEnemy.WAVE_AMPLITUDE * omega * 1000 * Math.cos(omega * elapsed));
  }
}
