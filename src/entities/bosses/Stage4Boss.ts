import Phaser from 'phaser';
import { Boss } from './Boss';
import { Bullet } from '../Bullet';
import { GAME_CONFIG } from '../../config';

/**
 * 高難易度限定のボーナスステージ（ステージ4）用ボス。
 * 本体（画面右端）と分身1体（画面左端）が、それぞれ縦に往復移動しながら
 * 同時に自機狙いの扇状弾幕を放つ。被弾判定を持つのは本体のみで、
 * 分身は見た目上の攻撃源（自弾は素通りする）。
 */
export class Stage4Boss extends Boss {
  static readonly TEXTURE_KEY = 'boss4';

  private static readonly FAN_BULLET_COUNT = 5;
  private static readonly FAN_SPREAD_DEG = 80;
  /** 上下往復移動の速度 */
  private static readonly PATROL_SPEED = 80;
  /**
   * 分身の初期Y座標を本体からずらす量。自機の初期出現位置（画面左端付近）と
   * 分身（画面左端）がほぼ同じ座標になり開幕即被弾してしまうのを避けるための調整。
   */
  private static readonly CLONE_Y_START_OFFSET = -150;

  private fanTimer = 0;
  private cloneLeft!: Phaser.Physics.Arcade.Sprite;

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(Stage4Boss.TEXTURE_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x3a0d0d).fillRect(0, 0, 116, 76);
    g.lineStyle(3, 0xff4d4d, 1).strokeRect(1, 1, 114, 74);
    g.generateTexture(Stage4Boss.TEXTURE_KEY, 116, 76);
    g.destroy();
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly getPlayers: () => Phaser.Physics.Arcade.Sprite[],
    private readonly enemyBulletsPool: Phaser.Physics.Arcade.Group,
    private readonly bulletInterval: number,
    private readonly bulletSpeed: number,
  ) {
    Stage4Boss.ensureTexture(scene);
    super(scene, x, y, Stage4Boss.TEXTURE_KEY);

    // 本体は呼び出し側が渡す画面右端寄りの座標。分身はそれを画面中央で反転した左端寄りの座標に置く。
    // Yは自機の初期出現位置と重ならないよう上方向にずらす（往復移動でいずれ全域をカバーする）。
    const cloneX = GAME_CONFIG.PLAY_AREA.WIDTH - x;
    const cloneY = Phaser.Math.Clamp(
      y + Stage4Boss.CLONE_Y_START_OFFSET, 40, GAME_CONFIG.PLAY_AREA.HEIGHT - 40,
    );
    this.cloneLeft = scene.physics.add.sprite(cloneX, cloneY, Stage4Boss.TEXTURE_KEY);
    this.cloneLeft.setCollideWorldBounds(true);
    this.cloneLeft.setBounce(1);
  }

  /** 本体撃破後に一緒に片付ける分身。プレイヤーとの当たり判定は呼び出し側で登録する。 */
  public get clones(): Phaser.Physics.Arcade.Sprite[] {
    return [this.cloneLeft];
  }

  protected onSpawn(): void {
    this.fanTimer = 0;
    this.setVelocityY(Stage4Boss.PATROL_SPEED);
    this.cloneLeft.enableBody(true, this.cloneLeft.x, this.cloneLeft.y, true, true);
    this.cloneLeft.setVelocityY(-Stage4Boss.PATROL_SPEED);
  }

  protected updateBehavior(_time: number, delta: number): void {
    this.fanTimer += delta;
    if (this.fanTimer >= this.bulletInterval) {
      this.fanTimer = 0;
      this.fireFanFrom(this.x, this.y);
      if (this.cloneLeft.active) this.fireFanFrom(this.cloneLeft.x, this.cloneLeft.y);
    }
  }

  private fireFanFrom(sx: number, sy: number): void {
    const target = this.nearestPlayer(this.getPlayers());
    const baseAngle = Phaser.Math.Angle.Between(sx, sy, target.x, target.y);
    const count = Stage4Boss.FAN_BULLET_COUNT;
    const stepDeg = Stage4Boss.FAN_SPREAD_DEG / (count - 1);
    for (let i = 0; i < count; i++) {
      const offsetDeg = -Stage4Boss.FAN_SPREAD_DEG / 2 + stepDeg * i;
      const angle = baseAngle + Phaser.Math.DegToRad(offsetDeg);

      let bullet = this.enemyBulletsPool.getFirstDead(false) as Bullet;
      if (!bullet) {
        bullet = new Bullet(this.scene, sx, sy, 'enemyBullet');
        this.enemyBulletsPool.add(bullet);
      }
      bullet.fire(sx, sy, Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
    }
  }

  /**
   * 本体撃破時・シーン破棄時に分身も片付ける。Hazardの過去の不具合と同様、
   * シーン破棄時は個別に追加したGameObject同士の破棄順序が保証されないため、
   * .activeを確認してから.bodyに触れるガードを入れる。
   */
  protected override onDestroyHazards(): void {
    if (this.cloneLeft?.active) this.cloneLeft.disableBody(true, true);
  }
}
