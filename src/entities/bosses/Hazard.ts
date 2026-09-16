import Phaser from 'phaser';

export type HazardShape =
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'circle'; radius: number };

type HitPlayerFn = (object1: any, object2: any) => void;

/**
 * 「警告表示→発生→自動消滅」を行う汎用の当たり判定ゾーン（矩形 or 円）。
 * ステージ2の警告ビーム・爆弾の爆風、ステージ3の縦ビームで共用する。
 * フェーズ遷移はscene.time.delayedCallで自走するため、生成側は毎フレームの更新呼び出しを行う必要はない。
 */
export class Hazard {
  private readonly scene: Phaser.Scene;
  private readonly players: Phaser.Physics.Arcade.Sprite[];
  private readonly hitPlayer: HitPlayerFn;
  private readonly visual: Phaser.GameObjects.Shape;
  private colliders: Phaser.Physics.Arcade.Collider[] = [];
  private pendingTimer?: Phaser.Time.TimerEvent;
  private flickerTween?: Phaser.Tweens.Tween;
  private state: 'idle' | 'warning' | 'active' | 'done' = 'idle';

  /** depth省略時は4（ボスのdepth=0より手前）。ボス画像を隠したくない横一直線ビームなどはボスより奥のdepthを指定する */
  constructor(
    scene: Phaser.Scene,
    shape: HazardShape,
    players: Phaser.Physics.Arcade.Sprite[],
    hitPlayer: HitPlayerFn,
    depth = 4,
  ) {
    this.scene = scene;
    this.players = players;
    this.hitPlayer = hitPlayer;

    this.visual =
      shape.kind === 'rect'
        ? scene.add.rectangle(0, 0, shape.width, shape.height, 0xff3b3b, 0.35)
        : scene.add.circle(0, 0, shape.radius, 0xff3b3b, 0.35);
    this.visual.setDepth(depth).setVisible(false);

    scene.physics.add.existing(this.visual, false);
    const body = this.visual.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
    body.enable = false;
  }

  public get isDone(): boolean {
    return this.state === 'done' || this.state === 'idle';
  }

  /**
   * x,yを中心に警告→発生を開始する。warningMs<=0なら警告なしで即active（爆弾の爆風用）。
   * flicker=trueにすると、警告表示が点滅する（通常の半透明表示より視認性・緊迫感を高めたい攻撃用）。
   */
  public trigger(x: number, y: number, warningMs: number, activeMs: number, flicker = false): void {
    this.visual.setPosition(x, y);
    if (warningMs > 0) {
      this.enterWarning(warningMs, activeMs, flicker);
    } else {
      this.enterActive(activeMs);
    }
  }

  /** ボス撃破・破棄時などに即座に終了させる */
  public forceEnd(): void {
    this.pendingTimer?.remove();
    this.pendingTimer = undefined;
    this.flickerTween?.stop();
    this.flickerTween = undefined;
    if (this.state !== 'idle') this.enterDone();
  }

  private enterWarning(warningMs: number, activeMs: number, flicker: boolean): void {
    this.state = 'warning';
    // シーン破棄（ボス撃破直後のクリア演出やゲームオーバー遷移）でthis.visualが先に破棄されていると
    // bodyがundefinedになる。破棄後にタイマーが遅れて発火することがあるため、ここで安全に無視する。
    if (!this.visual.active) return;
    this.visual.setVisible(true);
    this.visual.setAlpha(1);
    (this.visual as Phaser.GameObjects.Rectangle).setFillStyle(0xff3b3b, 0.35);
    const body = this.visual.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
    if (flicker) {
      this.flickerTween = this.scene.tweens.add({
        targets: this.visual,
        alpha: { from: 1, to: 0.2 },
        duration: 130,
        yoyo: true,
        repeat: -1,
      });
    }
    this.pendingTimer = this.scene.time.delayedCall(warningMs, () => this.enterActive(activeMs));
  }

  private enterActive(activeMs: number): void {
    this.state = 'active';
    this.flickerTween?.stop();
    this.flickerTween = undefined;
    if (!this.visual.active) return;
    this.visual.setVisible(true);
    this.visual.setAlpha(1);
    (this.visual as Phaser.GameObjects.Rectangle).setFillStyle(0x39ff14, 0.75);
    const body = this.visual.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = true;
    this.colliders = this.players.map((player) =>
      this.scene.physics.add.overlap(player, this.visual, this.hitPlayer, undefined, this.scene),
    );
    this.pendingTimer = this.scene.time.delayedCall(activeMs, () => this.enterDone());
  }

  private enterDone(): void {
    this.state = 'done';
    this.colliders.forEach((collider) => collider.destroy());
    this.colliders = [];
    if (!this.visual.active) return;
    this.visual.setVisible(false);
    const body = this.visual.body as Phaser.Physics.Arcade.Body | null;
    if (body) body.enable = false;
  }
}
