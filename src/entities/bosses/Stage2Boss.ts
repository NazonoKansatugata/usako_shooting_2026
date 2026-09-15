import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Boss } from './Boss';
import { Bullet } from '../Bullet';
import { Hazard } from './Hazard';

type HitPlayerFn = (object1: any, object2: any) => void;

/**
 * ステージ2ボス：上下バウンドしながら、自機狙いの扇状弾幕を一定間隔で発射する。
 * HP50%未満で、赤い警告帯（横一直線）→ビームの攻撃も追加する。
 */
export class Stage2Boss extends Boss {
  static readonly TEXTURE_KEY = 'boss2';

  private static readonly FAN_BULLET_COUNT = 7;
  private static readonly FAN_SPREAD_DEG = 100;
  private static readonly BEAM_INTERVAL = 2600;
  private static readonly BEAM_WARNING_MS = 700;
  private static readonly BEAM_ACTIVE_MS = 320;
  private static readonly BEAM_HEIGHT = 70;
  private static readonly BEAM_HP_THRESHOLD = 0.5;
  private static readonly BEAM_Y_MARGIN = 60;

  private fanTimer = 0;
  private beamTimer = 0;
  private beamUnlocked = false;
  private beamHazards: Hazard[] = [];
  private beamInProgress = false;

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
    private readonly getPlayers: () => Phaser.Physics.Arcade.Sprite[],
    private readonly hitPlayer: HitPlayerFn,
    private readonly enemyBulletsPool: Phaser.Physics.Arcade.Group,
    private readonly fanInterval: number,
    private readonly fanSpeed: number,
  ) {
    Stage2Boss.ensureTexture(scene);
    super(scene, x, y, Stage2Boss.TEXTURE_KEY);
  }

  protected onSpawn(): void {
    this.fanTimer = 0;
    this.beamTimer = 0;
    this.beamUnlocked = false;
    this.beamHazards = [];
    this.beamInProgress = false;
    this.setVelocityY(80);
  }

  protected updateBehavior(_time: number, delta: number): void {
    this.fanTimer += delta;
    if (this.fanTimer >= this.fanInterval) {
      this.fanTimer = 0;
      this.fireFanBarrage();
    }

    if (!this.beamUnlocked && this.hpRatio < Stage2Boss.BEAM_HP_THRESHOLD) {
      this.beamUnlocked = true;
    }
    if (this.beamUnlocked) {
      this.beamTimer += delta;
      if (this.beamTimer >= Stage2Boss.BEAM_INTERVAL) {
        this.beamTimer = 0;
        this.fireBeam();
      }
    }

    if (this.beamHazards.length > 0) {
      this.beamHazards = this.beamHazards.filter((h) => !h.isDone);
      if (this.beamInProgress && this.beamHazards.length === 0) {
        this.beamInProgress = false;
        this.resumeVerticalMovement();
      }
    }
  }

  private fireFanBarrage(): void {
    const target = this.nearestPlayer(this.getPlayers());
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const count = Stage2Boss.FAN_BULLET_COUNT;
    const stepDeg = Stage2Boss.FAN_SPREAD_DEG / (count - 1);
    for (let i = 0; i < count; i++) {
      const offsetDeg = -Stage2Boss.FAN_SPREAD_DEG / 2 + stepDeg * i;
      const angle = baseAngle + Phaser.Math.DegToRad(offsetDeg);

      let bullet = this.enemyBulletsPool.getFirstDead(false) as Bullet;
      if (!bullet) {
        bullet = new Bullet(this.scene, this.x, this.y, 'enemyBullet');
        this.enemyBulletsPool.add(bullet);
      }
      bullet.fire(this.x, this.y, Math.cos(angle) * this.fanSpeed, Math.sin(angle) * this.fanSpeed);
    }
  }

  /** ビーム発射中に動くと警告位置とビームの座標がずれるため、警告〜発生の間は移動を止める */
  private fireBeam(): void {
    this.pauseVerticalMovement();
    this.beamInProgress = true;

    const players = this.getPlayers();
    // 横一直線ビームのy座標は、自機ではなくボス自身のy座標に合わせる
    const y = Phaser.Math.Clamp(this.y, Stage2Boss.BEAM_Y_MARGIN, GAME_CONFIG.PLAY_AREA.HEIGHT - Stage2Boss.BEAM_Y_MARGIN);
    const hazard = new Hazard(
      this.scene,
      { kind: 'rect', width: GAME_CONFIG.PLAY_AREA.WIDTH, height: Stage2Boss.BEAM_HEIGHT },
      players,
      this.hitPlayer,
    );
    hazard.trigger(GAME_CONFIG.PLAY_AREA.WIDTH / 2, y, Stage2Boss.BEAM_WARNING_MS, Stage2Boss.BEAM_ACTIVE_MS);
    this.beamHazards.push(hazard);
  }

  protected override onDestroyHazards(): void {
    this.beamHazards.forEach((h) => h.forceEnd());
    this.beamHazards = [];
  }
}
