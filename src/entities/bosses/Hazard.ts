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
  private state: 'idle' | 'warning' | 'active' | 'done' = 'idle';

  constructor(scene: Phaser.Scene, shape: HazardShape, players: Phaser.Physics.Arcade.Sprite[], hitPlayer: HitPlayerFn) {
    this.scene = scene;
    this.players = players;
    this.hitPlayer = hitPlayer;

    this.visual =
      shape.kind === 'rect'
        ? scene.add.rectangle(0, 0, shape.width, shape.height, 0xff3b3b, 0.35)
        : scene.add.circle(0, 0, shape.radius, 0xff3b3b, 0.35);
    this.visual.setDepth(4).setVisible(false);

    scene.physics.add.existing(this.visual, false);
    const body = this.visual.body as Phaser.Physics.Arcade.Body;
    body.setImmovable(true);
    body.setAllowGravity(false);
    body.enable = false;
  }

  public get isDone(): boolean {
    return this.state === 'done' || this.state === 'idle';
  }

  /** x,yを中心に警告→発生を開始する。warningMs<=0なら警告なしで即active（爆弾の爆風用） */
  public trigger(x: number, y: number, warningMs: number, activeMs: number): void {
    this.visual.setPosition(x, y);
    if (warningMs > 0) {
      this.enterWarning(warningMs, activeMs);
    } else {
      this.enterActive(activeMs);
    }
  }

  /** ボス撃破・破棄時などに即座に終了させる */
  public forceEnd(): void {
    this.pendingTimer?.remove();
    this.pendingTimer = undefined;
    if (this.state !== 'idle') this.enterDone();
  }

  private enterWarning(warningMs: number, activeMs: number): void {
    this.state = 'warning';
    this.visual.setVisible(true);
    (this.visual as Phaser.GameObjects.Rectangle).setFillStyle(0xff3b3b, 0.35);
    const body = this.visual.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.pendingTimer = this.scene.time.delayedCall(warningMs, () => this.enterActive(activeMs));
  }

  private enterActive(activeMs: number): void {
    this.state = 'active';
    this.visual.setVisible(true);
    (this.visual as Phaser.GameObjects.Rectangle).setFillStyle(0xff3b3b, 0.75);
    const body = this.visual.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    this.colliders = this.players.map((player) =>
      this.scene.physics.add.overlap(player, this.visual, this.hitPlayer, undefined, this.scene),
    );
    this.pendingTimer = this.scene.time.delayedCall(activeMs, () => this.enterDone());
  }

  private enterDone(): void {
    this.state = 'done';
    this.visual.setVisible(false);
    const body = this.visual.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    this.colliders.forEach((collider) => collider.destroy());
    this.colliders = [];
  }
}
