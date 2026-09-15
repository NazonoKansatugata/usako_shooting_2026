import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { Boss } from './Boss';
import { Bullet } from '../Bullet';
import { Hazard } from './Hazard';

type HitPlayerFn = (object1: any, object2: any) => void;

/**
 * ステージ3ボス：上下バウンドしながら、自機狙いの扇状弾幕（ステージ2と同種）を常時発射する。
 * 一定間隔で、左・中央・右の3レーンのうち2つに赤い警告→縦ビーム、それと同時に横一直線の警告→ビームも発射する
 * （縦は警告が出なかった1レーンが安全地帯、横は警告帯の外が安全地帯になる）。
 * ビーム発射中（警告〜発生）は座標のずれを避けるため上下移動を止める。
 */
export class Stage3Boss extends Boss {
  static readonly TEXTURE_KEY = 'boss3';

  private static readonly LANE_X = [190, 480, 770];
  private static readonly BEAM_WIDTH = 150;
  private static readonly WARNING_MS_BASE = 1100;
  private static readonly WARNING_MS_LOW = 850;
  private static readonly ACTIVE_MS = 350;
  private static readonly HP_THRESHOLD = 0.5;
  private static readonly HORIZONTAL_BEAM_HEIGHT = 70;
  private static readonly BEAM_Y_MARGIN = 60;
  private static readonly FAN_BULLET_COUNT = 7;
  private static readonly FAN_SPREAD_DEG = 100;

  private cycleTimer = 0;
  private readonly cycleInterval: number;
  private fanTimer = 0;
  private activeHazards: Hazard[] = [];
  private beamInProgress = false;

  static ensureTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(Stage3Boss.TEXTURE_KEY)) return;
    const g = scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0x6a3093).fillRect(0, 0, 116, 76).generateTexture(Stage3Boss.TEXTURE_KEY, 116, 76);
    g.destroy();
  }

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly getPlayers: () => Phaser.Physics.Arcade.Sprite[],
    private readonly hitPlayer: HitPlayerFn,
    private readonly enemyBulletsPool: Phaser.Physics.Arcade.Group,
    private readonly bulletInterval: number,
    private readonly bulletSpeed: number,
  ) {
    Stage3Boss.ensureTexture(scene);
    super(scene, x, y, Stage3Boss.TEXTURE_KEY);
    this.cycleInterval = Math.max(1800, bulletInterval * 3);
  }

  protected onSpawn(): void {
    this.cycleTimer = 0;
    this.fanTimer = 0;
    this.activeHazards = [];
    this.beamInProgress = false;
    this.setVelocityY(80);
  }

  protected updateBehavior(_time: number, delta: number): void {
    this.fanTimer += delta;
    if (this.fanTimer >= this.bulletInterval) {
      this.fanTimer = 0;
      this.fireFanBarrage();
    }

    this.cycleTimer += delta;
    if (this.cycleTimer >= this.cycleInterval) {
      this.cycleTimer = 0;
      this.triggerCycle();
    }
    if (this.activeHazards.length > 0) {
      this.activeHazards = this.activeHazards.filter((h) => !h.isDone);
      if (this.beamInProgress && this.activeHazards.length === 0) {
        this.beamInProgress = false;
        this.resumeVerticalMovement();
      }
    }
  }

  private fireFanBarrage(): void {
    const target = this.nearestPlayer(this.getPlayers());
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
    const count = Stage3Boss.FAN_BULLET_COUNT;
    const stepDeg = Stage3Boss.FAN_SPREAD_DEG / (count - 1);
    for (let i = 0; i < count; i++) {
      const offsetDeg = -Stage3Boss.FAN_SPREAD_DEG / 2 + stepDeg * i;
      const angle = baseAngle + Phaser.Math.DegToRad(offsetDeg);

      let bullet = this.enemyBulletsPool.getFirstDead(false) as Bullet;
      if (!bullet) {
        bullet = new Bullet(this.scene, this.x, this.y, 'enemyBullet');
        this.enemyBulletsPool.add(bullet);
      }
      bullet.fire(this.x, this.y, Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
    }
  }

  /** ビーム発射中に敵（ボス）が動くと警告位置とビームの座標がずれるため、警告〜ビーム発生の間は移動を止める */
  private triggerCycle(): void {
    this.pauseVerticalMovement();
    this.beamInProgress = true;

    const warningMs = this.hpRatio < Stage3Boss.HP_THRESHOLD ? Stage3Boss.WARNING_MS_LOW : Stage3Boss.WARNING_MS_BASE;
    const players = this.getPlayers();
    const target = this.nearestPlayer(players);

    // 縦：3レーンから2つを選んで縦ビーム（残り1レーンが安全地帯）
    const laneIndices = Phaser.Utils.Array.Shuffle([0, 1, 2]).slice(0, 2);
    for (const idx of laneIndices) {
      const hazard = new Hazard(
        this.scene,
        { kind: 'rect', width: Stage3Boss.BEAM_WIDTH, height: GAME_CONFIG.PLAY_AREA.HEIGHT },
        players,
        this.hitPlayer,
      );
      hazard.trigger(Stage3Boss.LANE_X[idx], GAME_CONFIG.PLAY_AREA.HEIGHT / 2, warningMs, Stage3Boss.ACTIVE_MS);
      this.activeHazards.push(hazard);
    }

    // 横：縦ビームと同時に、自機の高さ付近に横一直線のビームも発射（警告帯の外が安全地帯）
    const beamY = Phaser.Math.Clamp(target.y, Stage3Boss.BEAM_Y_MARGIN, GAME_CONFIG.PLAY_AREA.HEIGHT - Stage3Boss.BEAM_Y_MARGIN);
    const horizontalHazard = new Hazard(
      this.scene,
      { kind: 'rect', width: GAME_CONFIG.PLAY_AREA.WIDTH, height: Stage3Boss.HORIZONTAL_BEAM_HEIGHT },
      players,
      this.hitPlayer,
    );
    horizontalHazard.trigger(GAME_CONFIG.PLAY_AREA.WIDTH / 2, beamY, warningMs, Stage3Boss.ACTIVE_MS);
    this.activeHazards.push(horizontalHazard);
  }

  protected override onDestroyHazards(): void {
    this.activeHazards.forEach((h) => h.forceEnd());
    this.activeHazards = [];
  }
}
