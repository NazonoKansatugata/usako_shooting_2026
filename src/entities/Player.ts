import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager } from '../managers/SettingsManager';

export type PlayerVariant = 'p1' | 'p2';

interface PlayerTextureSet {
  base: string;
  wing1: string;
  wing3: string;
  hit: string;
  flightAnim: string;
  /** base画像の見た目上のズレ補正(px、正の値で左にずらす)。画像ごとに余白が違うため個別に調整する。 */
  baseOffsetX: number;
  /** base画像の見た目上のズレ補正(px、正の値で上にずらす)。 */
  baseOffsetY: number;
  /** wing画像の表示位置のズレ補正(px、正の値で上にずらす)。 */
  wingOffsetY: number;
  /** wing画像の重ね順。本体(depth 1)より前に出すか後ろに出すか（画像ごとに構図が違うため個別に指定する）。 */
  wingDepth: number;
}

/** 2人プレイ時、P1(うさこ色)とP2(ねここ色)で別々のテクスチャ・アニメーションキーを使う。 */
const PLAYER_TEXTURES: Record<PlayerVariant, PlayerTextureSet> = {
  p1: { base: 'player-base', wing1: 'player-wing-1', wing3: 'player-wing-3', hit: 'player-hit', flightAnim: 'player-flight', baseOffsetX: 0, baseOffsetY: 0, wingOffsetY: 0, wingDepth: 2 },
  p2: { base: 'player2-base', wing1: 'player2-wing-1', wing3: 'player2-wing-3', hit: 'player2-hit', flightAnim: 'player2-flight', baseOffsetX: 5, baseOffsetY: 0, wingOffsetY: 20, wingDepth: 0 },
};

export class Player extends Phaser.Physics.Arcade.Sprite {
  /** プレイヤー画像全体（本体・羽・砲）の拡大率 */
  private static readonly SCALE = 1.4;
  private static readonly HIT_IMAGE_OFFSET_X = 0;
  private static readonly HIT_IMAGE_OFFSET_Y = -30;
  private static readonly LABEL_OFFSET_Y = -28;

  private _isInvulnerable = false;
  private _hp: number = GAME_CONFIG.PLAYER_HP;
  private readonly wingSprite: Phaser.GameObjects.Sprite;
  private readonly airCannon: Phaser.GameObjects.Sprite;
  private readonly hitSprite: Phaser.GameObjects.Sprite;
  private readonly labelText?: Phaser.GameObjects.Text;
  private readonly wingOffsetY: number;
  private isDying = false;

  /** label（例:"1P"/"2P"）を渡すと、機体の少し上に追従する識別ラベルを表示する（2人プレイでの見分け用）。 */
  constructor(scene: Phaser.Scene, x: number, y: number, variant: PlayerVariant = 'p1', label?: string) {
    const textures = PLAYER_TEXTURES[variant];
    super(scene, x, y, textures.base);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(Player.SCALE);
    this.setDepth(1);

    if (textures.baseOffsetX !== 0 || textures.baseOffsetY !== 0) {
      // originを動かすと見た目と物理ボディ（当たり判定）が連動してズレる（this.x/this.yは変わらない）ため、
      // キャラごとの画像余白差を吸収する見た目調整にはsetSize/setOffsetではなくこちらを使う。
      this.setOrigin(
        0.5 + textures.baseOffsetX / (Player.SCALE * this.width),
        0.5 + textures.baseOffsetY / (Player.SCALE * this.height),
      );
    }

    this.wingOffsetY = textures.wingOffsetY;
    this.wingSprite = scene.add.sprite(x, y - 2 * Player.SCALE - this.wingOffsetY, textures.wing1).setScale(Player.SCALE).setDepth(textures.wingDepth);
    this.wingSprite.play(textures.flightAnim);
    this.airCannon = scene.add.sprite(x + 15 * Player.SCALE, y + 4 * Player.SCALE, 'player-air-cannon').setScale(Player.SCALE).setDepth(2);
    this.hitSprite = scene.add.sprite(x, y, textures.hit).setDepth(2);
    this.hitSprite.setVisible(false);

    if (label) {
      this.labelText = scene.add.text(x, y + Player.LABEL_OFFSET_Y, label, {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '14px',
        color: variant === 'p2' ? '#f6a3d3' : '#f6d365',
        stroke: '#12263a',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(3);
    }

    this.setCollideWorldBounds(true);
    // player-base画像(31x43px)のシルエットに大まかに合わせた長方形（幅20px×高さ30px、オフセット6, 8）
    // setScale()を先に呼んでいるため、拡大率(SCALE)は自動的に反映される
    (this.body as Phaser.Physics.Arcade.Body).setSize(20, 30).setOffset(6, 8);
  }

  public preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    const rad = this.rotation;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // 羽のオフセット (基準スケール時の相対座標: x=0, y=-3*SCALE-wingOffsetY) を現在のスケールと回転に合わせて計算
    const wingLocalX = 0;
    const wingLocalY = -(3 * Player.SCALE + this.wingOffsetY) * (this.scaleY / Player.SCALE);
    const wingWorldX = this.x + (wingLocalX * cos - wingLocalY * sin);
    const wingWorldY = this.y + (wingLocalX * sin + wingLocalY * cos);

    this.wingSprite.setPosition(wingWorldX, wingWorldY);
    this.wingSprite.setRotation(this.rotation);
    this.wingSprite.setScale(this.scaleX, this.scaleY);
    this.wingSprite.setAlpha(this.alpha);
    this.wingSprite.setVisible(this.visible);

    // 空気砲のオフセット (基準スケール時の相対座標: x=15*SCALE, y=4*SCALE) を現在のスケールと回転に合わせて計算
    const cannonLocalX = 15 * (this.scaleX / Player.SCALE) * Player.SCALE;
    const cannonLocalY = 4 * (this.scaleY / Player.SCALE) * Player.SCALE;
    const cannonWorldX = this.x + (cannonLocalX * cos - cannonLocalY * sin);
    const cannonWorldY = this.y + (cannonLocalX * sin + cannonLocalY * cos);

    this.airCannon.setPosition(cannonWorldX, cannonWorldY);
    this.airCannon.setRotation(this.rotation);
    this.airCannon.setScale(this.scaleX, this.scaleY);
    this.airCannon.setAlpha(this.alpha);
    this.airCannon.setVisible(this.visible);
    this.labelText?.setPosition(this.x, this.y + Player.LABEL_OFFSET_Y);
  }

  public destroy(fromScene?: boolean): void {
    this.wingSprite.destroy(fromScene);
    this.airCannon.destroy(fromScene);
    this.hitSprite.destroy(fromScene);
    this.labelText?.destroy(fromScene);
    super.destroy(fromScene);
  }

  get isInvulnerable(): boolean {
    return this._isInvulnerable;
  }

  public setInvulnerable(value: boolean): void {
    this._isInvulnerable = value;
  }

  get hp(): number {
    return this._hp;
  }

  public resetStats(): void {
    this._hp = GAME_CONFIG.PLAYER_HP;
    this._isInvulnerable = false;
    this.isDying = false;
    this.setAlpha(1);
    this.setScale(Player.SCALE);
    this.setAngle(0);
    this.setActive(true);
    this.setVisible(true);
    this.wingSprite.setVisible(true);
    this.wingSprite.setAlpha(1);
    this.wingSprite.setScale(Player.SCALE);
    this.airCannon.setVisible(true);
    this.airCannon.setAlpha(1);
    this.airCannon.setScale(Player.SCALE);
    (this.body as Phaser.Physics.Arcade.Body).enable = true;
    this.hitSprite.setVisible(false);
    this.labelText?.setVisible(true);
  }

  public move(left: boolean, right: boolean, up: boolean, down: boolean): void {
    if (!this.active || this.isDying) return;

    const vx = (right ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED - (left ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED;
    const vy = (down ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED - (up ? 1 : 0) * GAME_CONFIG.PLAYER_SPEED;
    this.setVelocity(vx, vy);
  }

  public startDeathAnimation(onComplete?: () => void): void {
    if (this.isDying) return;
    this.isDying = true;
    this.setVelocity(0, 0);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.setVisible(false);
    this.wingSprite.setVisible(false);
    this.airCannon.setVisible(false);
    this.labelText?.setVisible(false);
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
        onComplete?.();
      },
    });
  }

  /**
   * ボス討伐後、隕石の中心へ回転・縮小しながら吸い込まれ、完全に消える演出
   */
  public startSuckInAnimation(targetX: number, targetY: number, duration: number, onComplete?: () => void): void {
    if (this.isDying) return;
    this.isDying = true;
    this.setVelocity(0, 0);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;

    this.scene.tweens.add({
      targets: this,
      x: targetX,
      y: targetY,
      scaleX: 0,
      scaleY: 0,
      angle: 1080,
      alpha: 0,
      duration,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.setVisible(false);
        this.setActive(false);
        this.wingSprite.setVisible(false);
        this.airCannon.setVisible(false);
        onComplete?.();
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
