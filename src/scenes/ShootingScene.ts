import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { GameMode, EnemyShape } from '../types';
import { Player } from '../entities/Player';
import { Boss } from '../entities/bosses/Boss';
import { Stage1Boss } from '../entities/bosses/Stage1Boss';
import { Stage2Boss } from '../entities/bosses/Stage2Boss';
import { Stage3Boss } from '../entities/bosses/Stage3Boss';
import { Bullet } from '../entities/Bullet';
import { HomingBullet } from '../entities/HomingBullet';
import { WaveBullet } from '../entities/WaveBullet';
import { Enemy } from '../entities/Enemy';
import { CircleEnemy } from '../entities/enemies/CircleEnemy';
import { SquareEnemy } from '../entities/enemies/SquareEnemy';
import { StarEnemy } from '../entities/enemies/StarEnemy';
import { EnemyFactory } from '../managers/EnemyFactory';
import { StageManager } from '../managers/StageManager';
import { SettingsManager } from '../managers/SettingsManager';
import { SaveManager } from '../managers/SaveManager';
import { StatusManager } from '../managers/StatusManager';
import { preloadPostStageAssets, preloadStage1Assets } from '../managers/AssetPreloader';
import { DialogueWindow } from '../ui/DialogueWindow';
import { StoryManager } from '../managers/StoryManager';

const ENEMY_SHAPES: EnemyShape[] = ['triangle', 'circle', 'square', 'star'];

interface CloudFlow {
  x: number;
  y: number;
  scale: number;
  alpha: number;
}

export class ShootingScene extends Phaser.Scene {
  /** shooterタイプの雑魚敵が画面内に入ってから発射するまでの遅延(ms) */
  private static readonly SHOOT_DELAY_AFTER_ENTRY = 500;
  private static readonly BGM_LOOP_ADVANCE_SECONDS = 0.1;
  private static readonly GAME_OVER_TRANSITION_DELAY = 3000;
  /** 雑魚敵の移動速度（ステージJSONのspeed/vy）に一律で掛ける倍率 */
  private static readonly SPEED_MULTIPLIER = 1.5;

  private player1!: Player;
  private player2?: Player;
  private twoPlayer = false;
  private bullets!: Phaser.Physics.Arcade.Group;
  /** 敵の形状（見た目・当たり判定）ごとに分けたプール。異なる形状の個体が混ざらないようにするため。 */
  private enemyGroups!: Record<EnemyShape, Phaser.Physics.Arcade.Group>;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  /** 正方形の敵が撃つ追尾弾専用のプール（通常弾とクラスが異なるため分けている） */
  private enemyHomingBullets!: Phaser.Physics.Arcade.Group;
  /** 丸の敵が撃つ波形弾専用のプール（通常弾とクラスが異なるため分けている） */
  private enemyWaveBullets!: Phaser.Physics.Arcade.Group;
  /** ステージ1ボスの渦巻き弾幕専用のプール（高レートで大量に撒くため専用にしている） */
  private bossBallBullets!: Phaser.Physics.Arcade.Group;
  private boss?: Boss;
  private stageManager = new StageManager();
  private settingsManager = SettingsManager.getInstance();
  private saveManager = SaveManager.getInstance();
  private statusManager = StatusManager.getInstance();
  private dialogueWindow!: DialogueWindow;
  private storyManager!: StoryManager;
  private stageBgm?: Phaser.Sound.BaseSound;
  private bossBgm?: Phaser.Sound.BaseSound;
  private bgmLoopTimer?: Phaser.Time.TimerEvent;
  private gameOverTransitionTimer?: Phaser.Time.TimerEvent;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mode: GameMode = 'playing';

  private stageTime = 0;
  private fireTimer1 = 0;
  private fireTimer2 = 0;
  private bossPreEventTriggered = false;
  private bossDefeated = false;
  private score = 0;
  private static readonly SCORE_ENEMY_DEFEAT = 100;
  private static readonly SCORE_BOSS_DEFEAT = 3000;
  private backgroundOffset = 0;
  private foregroundOffset = 0;
  private backgroundGraphics?: Phaser.GameObjects.Graphics;
  private foregroundGraphics?: Phaser.GameObjects.Graphics;
  private readonly skyClouds: CloudFlow[] = [
    { x: 140, y: 76, scale: 0.52, alpha: 0.48 },
    { x: 760, y: 286, scale: 0.78, alpha: 0.62 },
    { x: 1380, y: 154, scale: 0.4, alpha: 0.42 },
    { x: 2110, y: 335, scale: 0.62, alpha: 0.58 },
    { x: 2740, y: 98, scale: 0.7, alpha: 0.5 },
  ];
  private readonly nightClouds: CloudFlow[] = [
    { x: 330, y: 88, scale: 0.42, alpha: 0.2 },
    { x: 1010, y: 230, scale: 0.66, alpha: 0.26 },
    { x: 1850, y: 58, scale: 0.5, alpha: 0.18 },
    { x: 2590, y: 180, scale: 0.72, alpha: 0.24 },
  ];
  private readonly skyForegroundClouds: CloudFlow[] = [
    { x: 780, y: 130, scale: 1.25, alpha: 0.7 },
    { x: 3160, y: 295, scale: 1.05, alpha: 0.66 },
  ];
  private readonly nightForegroundClouds: CloudFlow[] = [
    { x: 1120, y: 105, scale: 1.3, alpha: 0.32 },
    { x: 3540, y: 288, scale: 1.1, alpha: 0.3 },
  ];

  private hpText!: Phaser.GameObjects.Text;
  private hpText2!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private instruction!: Phaser.GameObjects.Text;
  private stageClearPanel?: Phaser.GameObjects.Container;
  private pauseOverlay?: Phaser.GameObjects.Container;
  private escapeKeyHandler?: (event: KeyboardEvent) => void;

  constructor() {
    super('shooting');
  }

  init(data?: { twoPlayer?: boolean }): void {
    this.twoPlayer = data?.twoPlayer ?? false;
  }

  preload(): void {
    preloadStage1Assets(this);
    StageManager.getEnemyImagePaths().forEach((path) => {
      const key = `stage-enemy-${path}`;
      if (!this.textures.exists(key)) this.load.image(key, path);
    });
  }

  create(): void {
    // 物理ワールドの範囲をプレイエリア (960 x 420) に設定
    this.physics.world.setBounds(0, 0, GAME_CONFIG.PLAY_AREA.WIDTH, GAME_CONFIG.PLAY_AREA.HEIGHT);
    // シーン遷移で破棄されたGraphicsへの参照を捨て、再挑戦時に背景レイヤーを作り直す
    this.backgroundGraphics = undefined;
    this.foregroundGraphics = undefined;
    this.backgroundOffset = 0;
    this.foregroundOffset = 0;

    this.createTextures();
    this.createPlayerAnimation();
    this.createGroups();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,SPACE,SHIFT,ENTER,ESC,P,T') as Record<string, Phaser.Input.Keyboard.Key>;

    this.dialogueWindow = new DialogueWindow(this);
    this.storyManager = new StoryManager(this.dialogueWindow);

    this.createHud();
    this.startGame();

    // プレイ開始後に次の遷移先の素材をロードし、ゲーム進行を止めない。
    this.time.delayedCall(500, () => {
      preloadPostStageAssets(this);
      if (!this.load.isLoading()) this.load.start();
    });

    // ステージクリア後のステータス画面（'status'シーン）が完了すると本シーンがresumeされる。
    // その時点で次ステージ開始処理を行う。
    this.events.on('resume', () => {
      if (this.mode === 'stageClear') this.startNextStage();
    });

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.mode === 'stageClear') {
        this.scene.pause();
        this.scene.launch('status', {
          mode: 'stageClear',
          twoPlayer: this.twoPlayer,
          score: this.score,
          stageNumber: this.stageManager.stageNumber,
        });
      } else if (this.mode === 'gameOver' || this.mode === 'clear') {
        this.startGame();
      }
    });

    this.escapeKeyHandler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.code !== 'Escape') return;
      if (!this.sys.isActive()) return;
      event.preventDefault();
      this.togglePauseOrReturnToTitle();
    };
    window.addEventListener('keydown', this.escapeKeyHandler, { capture: true });

    this.input.keyboard!.on('keydown-T', () => {
      if (this.mode === 'gameOver' || this.mode === 'clear') {
        this.scene.start('title');
      }
    });

    // デバッグ用：1/2/3でステージ1/2/3の先頭へ、G/H/Jでそれぞれのボス戦へ直接ジャンプする
    this.input.keyboard!.on('keydown-ONE', () => this.debugJumpToStage(0));
    this.input.keyboard!.on('keydown-TWO', () => this.debugJumpToStage(1));
    this.input.keyboard!.on('keydown-THREE', () => this.debugJumpToStage(2));
    this.input.keyboard!.on('keydown-G', () => this.debugJumpToStage(0, true));
    this.input.keyboard!.on('keydown-H', () => this.debugJumpToStage(1, true));
    this.input.keyboard!.on('keydown-J', () => this.debugJumpToStage(2, true));

    this.events.once('shutdown', () => {
      if (this.escapeKeyHandler) {
        window.removeEventListener('keydown', this.escapeKeyHandler, { capture: true });
        this.escapeKeyHandler = undefined;
      }
      this.time.paused = false;
      this.tweens.resumeAll();
      // Arcade Physicsプラグイン自身のshutdown処理（this.physics.worldの破棄）は
      // シーン起動時に登録されるため、create()内で登録した本ハンドラより先に走る。
      // そのため通常のゲームオーバー等によるシーン終了時にはthis.physics.worldが
      // 既にnullになっており、無条件にresume()を呼ぶと例外を投げてシーン遷移処理自体を
      // 中断させ、ゲームオーバー画面が出ないままフリーズする原因になっていた。
      if (this.physics.world) this.physics.resume();
      this.stopBgm();
      this.gameOverTransitionTimer?.remove(false);
      this.gameOverTransitionTimer = undefined;
    });
  }

  private togglePauseOrReturnToTitle(): void {
    if (this.mode === 'playing') {
      this.pauseGame();
    } else if (this.mode === 'paused') {
      this.resumeGame();
    } else {
      this.scene.start('title');
    }
  }

  update(_time: number, delta: number): void {
    if (this.mode === 'paused') return;

    this.drawBackground(delta);

    // 下画面の戦況モニターはゲームモードに関わらず（あるいはplaying時に）常時更新
    const stageDuration = this.stageManager.current.duration;
    const stageProgressPct = Math.min(100, (this.stageTime / stageDuration) * 100);
    this.dialogueWindow.update(delta, stageProgressPct);

    if (this.mode !== 'playing') return;

    if (this.bossDefeated) {
      this.updateHud();
      return;
    }

    // イベント再生中（ステージ開始直後演出・イベント進捗率停止・ボス前演出）はステージ進行率の加算を止める
    const progressBlocked = this.storyManager.isBlockingProgress();
    if (!progressBlocked) {
      this.stageTime += delta;
    }
    this.fireTimer1 -= delta;
    this.fireTimer2 -= delta;

    this.updateMovement();
    const p1FireDown = this.twoPlayer ? this.keys.SHIFT.isDown : this.keys.SPACE.isDown;
    this.firePlayerBullet(this.player1, p1FireDown, 1);
    if (this.twoPlayer && this.player2) this.firePlayerBullet(this.player2, this.keys.SPACE.isDown, 2);
    this.updateEnemies();
    this.updateHud();
    if (!progressBlocked) {
      this.storyManager.update(this.stageTime, stageDuration);
    }

    if (!progressBlocked && this.stageTime >= stageDuration && (!this.boss || !this.boss.active) && !this.bossPreEventTriggered) {
      this.bossPreEventTriggered = true;
      this.storyManager.triggerBossPreEvent(() => this.spawnBoss());
    }
  }

  private createTextures(): void {
    // 雑魚敵（三角形・丸・正方形・星）・各ボスのテクスチャは各サブクラスが自前で生成する
    if (this.textures.exists('bullet')) return;

    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x9aa0a6).fillRect(0, 0, 10, 10).generateTexture('player-air-cannon', 10, 10);
    graphics.clear().fillStyle(0xffc857).fillCircle(12, 12, 12).generateTexture('bullet', 24, 24);
    graphics.clear().fillStyle(0xff4d6d).fillCircle(8, 8, 8).generateTexture('enemyBullet', 16, 16);
    graphics.destroy();
  }

  private createPlayerAnimation(): void {
    if (!this.anims.exists('player-flight')) {
      this.anims.create({
        key: 'player-flight',
        frames: [{ key: 'player-wing-1' }, { key: 'player-wing-3' }],
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists('player2-flight')) {
      this.anims.create({
        key: 'player2-flight',
        frames: [{ key: 'player2-wing-1' }, { key: 'player2-wing-3' }],
        frameRate: 12,
        repeat: -1,
      });
    }
  }

  private createGroups(): void {
    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
    this.enemyGroups = {} as Record<EnemyShape, Phaser.Physics.Arcade.Group>;
    for (const shape of ENEMY_SHAPES) {
      this.enemyGroups[shape] = this.physics.add.group({ maxSize: 20 });
    }
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 40 });
    this.enemyHomingBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 20 });
    this.enemyWaveBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 20 });
    this.bossBallBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 200 });
  }

  private forEachEnemyGroup(fn: (group: Phaser.Physics.Arcade.Group) => void): void {
    for (const shape of ENEMY_SHAPES) {
      fn(this.enemyGroups[shape]);
    }
  }

  private createHud(): void {
    this.hpText = this.add.text(24, 20, '', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '20px', color: '#f6d365' }).setDepth(5);
    this.hpText2 = this.add.text(24, 46, '', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '20px', color: '#f6a3d3' }).setDepth(5).setVisible(false);
    this.scoreText = this.add.text(24, 46, '', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '16px', color: '#f8f7f2' }).setDepth(5);
    this.progressText = this.add.text(GAME_CONFIG.WIDTH - 24, 20, '', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '18px', color: '#a9d6e5' }).setOrigin(1, 0).setDepth(5);
    this.banner = this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.PLAY_AREA.HEIGHT / 2 - 35, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '48px', color: '#f8f7f2', align: 'center', stroke: '#12263a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(6);
    this.instruction = this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.PLAY_AREA.HEIGHT / 2 + 55, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '19px', color: '#a9d6e5', align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(6);
  }

  private startGame(): void {
    this.hideStageClearPanel();
    this.mode = 'playing';
    this.stageManager.reset();
    this.stageTime = 0;
    this.fireTimer1 = 0;
    this.fireTimer2 = 0;
    this.bossPreEventTriggered = false;
    this.bossDefeated = false;
    this.score = 0;

    if (this.boss?.active) this.boss.destroy();
    this.boss = undefined;

    this.bullets.clear(true, true);
    this.forEachEnemyGroup((group) => group.clear(true, true));
    this.enemyBullets.clear(true, true);
    this.enemyHomingBullets.clear(true, true);
    this.enemyWaveBullets.clear(true, true);
    this.bossBallBullets.clear(true, true);

    if (this.player1?.active) this.player1.destroy();
    if (this.player2?.active) this.player2.destroy();
    const centerY = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;
    this.player1 = new Player(this, 130, this.twoPlayer ? centerY - 40 : centerY, 'p1', this.twoPlayer ? '1P' : undefined);
    this.player1.resetStats();
    if (this.twoPlayer) {
      this.player2 = new Player(this, 130, centerY + 40, 'p2', '2P');
      this.player2.resetStats();
    } else {
      this.player2 = undefined;
    }

    this.forEachEnemyGroup((group) => {
      this.physics.add.overlap(this.bullets, group, this.hitEnemy, undefined, this);
    });
    for (const player of this.activePlayers()) {
      this.forEachEnemyGroup((group) => {
        this.physics.add.overlap(group, player, this.hitPlayer, undefined, this);
      });
      this.physics.add.overlap(this.enemyBullets, player, this.hitPlayer, undefined, this);
      this.physics.add.overlap(this.enemyHomingBullets, player, this.hitPlayer, undefined, this);
      this.physics.add.overlap(this.enemyWaveBullets, player, this.hitPlayer, undefined, this);
      this.physics.add.overlap(this.bossBallBullets, player, this.hitPlayer, undefined, this);
    }

    this.banner.setVisible(false);
    this.instruction.setVisible(false);
    this.hpText.setVisible(true);
    this.hpText2.setVisible(this.twoPlayer);
    this.scoreText.setY(this.twoPlayer ? 72 : 46);
    this.progressText.setVisible(true);

    this.storyManager.loadScenario(this.stageManager.current.id);
    this.playStageBgm();
    this.updateHud();

    if (this.twoPlayer) this.showTwoPlayerControlHint();
  }

  private pauseGame(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.physics.pause();
    this.time.paused = true;
    this.tweens.pauseAll();
    this.stageBgm?.pause();
    this.bossBgm?.pause();
    this.showPauseOverlay();
  }

  private resumeGame(): void {
    if (this.mode !== 'paused') return;
    this.hidePauseOverlay();
    this.mode = 'playing';
    this.physics.resume();
    this.time.paused = false;
    this.tweens.resumeAll();
    if (this.stageBgm?.isPaused) this.stageBgm.resume();
    if (this.bossBgm?.isPaused) this.bossBgm.resume();
  }

  private showPauseOverlay(): void {
    this.hidePauseOverlay();

    const overlay = this.add.container(0, 0).setDepth(60);
    this.pauseOverlay = overlay;

    overlay.add(this.add.rectangle(
      0,
      0,
      GAME_CONFIG.WIDTH,
      GAME_CONFIG.PLAY_AREA.HEIGHT,
      0x050914,
      0.56,
    ).setOrigin(0));

    overlay.add(this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.PLAY_AREA.HEIGHT / 2 - 18, 'PAUSE', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '48px',
      color: '#f8f7f2',
      fontStyle: 'bold',
      stroke: '#07111f',
      strokeThickness: 7,
    }).setOrigin(0.5));

    overlay.add(this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.PLAY_AREA.HEIGHT / 2 + 44, 'ESC：ゲームに戻る', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '18px',
      color: '#a9d6e5',
      stroke: '#07111f',
      strokeThickness: 4,
    }).setOrigin(0.5));
  }

  private hidePauseOverlay(): void {
    if (!this.pauseOverlay) return;
    this.pauseOverlay.destroy(true);
    this.pauseOverlay = undefined;
  }

  private showTwoPlayerControlHint(): void {
    this.banner.setText('2 PLAYERS').setVisible(true);
    this.instruction.setText('P1：WASD + 左Shift　　P2：↑↓←→ + SPACE').setVisible(true);
    this.time.delayedCall(2500, () => {
      if (this.mode !== 'playing') return;
      this.banner.setVisible(false);
      this.instruction.setVisible(false);
    });
  }

  /** HPが残っている（生存中の）プレイヤーのみを返す。死亡演出中でも即座に除外される。 */
  private livingPlayers(): Player[] {
    return [this.player1, this.player2].filter((p): p is Player => !!p && p.hp > 0);
  }

  /** 当たり判定登録・狙い撃ち計算用。生存者がいれば生存者のみ、全滅時はフォールバックとしてplayer1を含める。 */
  private activePlayers(): Player[] {
    const players = this.livingPlayers();
    return players.length > 0 ? players : [this.player1];
  }

  /** 座標(x, y)に最も近い生存中のプレイヤーを返す（雑魚敵・ボスの狙い撃ち用）。 */
  private nearestPlayer(x: number, y: number): Player {
    const players = this.activePlayers();
    return players.reduce((a, b) =>
      Phaser.Math.Distance.Between(x, y, a.x, a.y) <= Phaser.Math.Distance.Between(x, y, b.x, b.y) ? a : b,
    );
  }

  /** 2人プレイ時は基礎HPを2倍にしたボスの最大HP */
  private get bossMaxHp(): number {
    return this.stageManager.current.boss.hp * (this.twoPlayer ? GAME_CONFIG.BOSS_HP_MULTIPLIER_2P : 1);
  }

  /** ボス撃破後、次ステージへ進む前に見やすいリザルトカードを表示してプレイヤーの入力を待つ。 */
  private enterStageClear(clearedStage: number): void {
    // ボス撃破演出（爆発→会話→吸い込み）はカメラフェード完了までの非同期処理を挟むため、
    // その間に自機が力尽きてfinish('gameOver')が先に呼ばれているケースがありうる。
    // ここで無条件にmodeを上書きすると、finish()側で予約された
    // gameOverシーンへの遅延遷移が(`if (this.mode !== 'gameOver') return;`により)
    // 無効化されフリーズしたように見えるため、既にplaying以外へ遷移済みなら何もしない。
    if (this.mode !== 'playing') return;
    this.mode = 'stageClear';
    this.stopBgm();
    if (this.player1?.active) this.player1.setVelocity(0, 0);
    if (this.player2?.active) this.player2.setVelocity(0, 0);

    // 会話ウィンドウをクリアしてからステージクリア後演出を再生する
    this.dialogueWindow.hideDialogue();
    this.storyManager.triggerStageClearEvent();

    // 残っている雑魚・弾を片付けてリザルト画面らしい見た目にする
    this.bullets.clear(true, true);
    this.forEachEnemyGroup((group) => group.clear(true, true));
    this.enemyBullets.clear(true, true);
    this.enemyHomingBullets.clear(true, true);
    this.enemyWaveBullets.clear(true, true);
    this.bossBallBullets.clear(true, true);

    const clearSeconds = (this.stageTime / 1000).toFixed(1);
    const hp1 = Math.max(0, this.player1.hp);
    this.saveManager.reportStageCleared(clearedStage, this.settingsManager.difficulty);
    const hpLine = this.twoPlayer
      ? `P1 ${hp1}/${this.player1.maxHp}\nP2 ${Math.max(0, this.player2?.hp ?? 0)}/${this.player2?.maxHp ?? GAME_CONFIG.PLAYER_HP}`
      : `${hp1} / ${this.player1.maxHp}`;

    this.banner.setVisible(false);
    this.instruction.setVisible(false);
    this.showStageClearPanel(clearedStage, clearSeconds, hpLine);
  }

  /** 近未来SF風の洗練されたステージクリアリザルトパネルを生成・表示 */
  private showStageClearPanel(clearedStage: number, clearSeconds: string, hpLine: string): void {
    this.hideStageClearPanel();

    const panel = this.add.container(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.PLAY_AREA.HEIGHT / 2).setDepth(25);
    this.stageClearPanel = panel;

    const g = this.add.graphics();
    panel.add(g);

    const w = 580;
    const h = 300;
    const halfW = w / 2;
    const halfH = h / 2;

    // パネル外枠シャドウ & 背景
    g.fillStyle(0x0a1128, 0.96);
    g.fillRoundedRect(-halfW, -halfH, w, h, 14);
    g.lineStyle(2, 0x4cc9f0, 0.9);
    g.strokeRoundedRect(-halfW, -halfH, w, h, 14);

    // ヘッダー上部帯
    g.fillStyle(0x12263a, 1);
    g.fillRoundedRect(-halfW + 2, -halfH + 2, w - 4, 52, { tl: 12, tr: 12, bl: 0, br: 0 });
    // ヘッダー区切り線 (ゴールド)
    g.fillStyle(0xffd166, 1);
    g.fillRect(-halfW + 20, -halfH + 54, w - 40, 2);

    // 3連スタッツカードの背景スロット
    const cardW = 166;
    const cardH = 96;
    const cardY = -78;
    const cardXs = [-260, -83, 94];

    for (const cx of cardXs) {
      g.fillStyle(0x0e1f38, 0.95);
      g.fillRoundedRect(cx, cardY, cardW, cardH, 8);
      g.lineStyle(1, 0x224a73, 0.9);
      g.strokeRoundedRect(cx, cardY, cardW, cardH, 8);
    }

    // フッターガイド帯
    g.fillStyle(0x102844, 0.9);
    g.fillRoundedRect(-halfW + 30, 48, w - 60, 44, 8);
    g.lineStyle(1, 0x2b6cb0, 0.8);
    g.strokeRoundedRect(-halfW + 30, 48, w - 60, 44, 8);

    // タイトルテキスト
    const titleText = this.add.text(0, -halfH + 27, `★ STAGE ${clearedStage} CLEAR ★`, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '24px',
      color: '#ffd166',
      fontStyle: 'bold',
      stroke: '#060d1b',
      strokeThickness: 4,
    }).setOrigin(0.5);
    panel.add(titleText);

    // カード1: クリアタイム
    const timeLabel = this.add.text(cardXs[0] + cardW / 2, cardY + 20, '⏱ CLEAR TIME', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#a9d6e5',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const timeValue = this.add.text(cardXs[0] + cardW / 2, cardY + 58, `${clearSeconds}s`, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '24px',
      color: '#72efdd',
      fontStyle: 'bold',
      stroke: '#060d1b',
      strokeThickness: 3,
    }).setOrigin(0.5);
    panel.add(timeLabel);
    panel.add(timeValue);

    // カード2: 残りHP
    const hpLabel = this.add.text(cardXs[1] + cardW / 2, cardY + 20, '💖 SURVIVAL HP', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#a9d6e5',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const hpValue = this.add.text(cardXs[1] + cardW / 2, cardY + 58, hpLine, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: this.twoPlayer ? '16px' : '24px',
      color: '#ffd166',
      align: 'center',
      fontStyle: 'bold',
      lineSpacing: 4,
      stroke: '#060d1b',
      strokeThickness: 3,
    }).setOrigin(0.5);
    panel.add(hpLabel);
    panel.add(hpValue);

    // カード3: スコア
    const scoreLabel = this.add.text(cardXs[2] + cardW / 2, cardY + 20, '🏆 SCORE', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#a9d6e5',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const scoreValue = this.add.text(cardXs[2] + cardW / 2, cardY + 58, `${this.score.toLocaleString()}`, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '22px',
      color: '#f6d365',
      fontStyle: 'bold',
      stroke: '#060d1b',
      strokeThickness: 3,
    }).setOrigin(0.5);
    panel.add(scoreLabel);
    panel.add(scoreValue);

    // フッター操作案内（パルス点滅）
    const promptText = this.add.text(0, 70, '▶ [ ENTER ] を押して次のステージへ ◀', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '17px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#060d1b',
      strokeThickness: 3,
    }).setOrigin(0.5);
    panel.add(promptText);

    this.tweens.add({
      targets: promptText,
      alpha: 0.4,
      duration: 750,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // パネル出現アニメーション
    panel.setScale(0.85);
    panel.setAlpha(0);
    this.tweens.add({
      targets: panel,
      scale: 1,
      alpha: 1,
      duration: 350,
      ease: 'Back.easeOut',
    });
  }

  private hideStageClearPanel(): void {
    if (this.stageClearPanel) {
      this.stageClearPanel.destroy(true);
      this.stageClearPanel = undefined;
    }
  }

  private startNextStage(): void {
    this.hideStageClearPanel();
    this.mode = 'playing';
    this.stageTime = 0;
    this.fireTimer1 = 0;
    this.fireTimer2 = 0;
    this.bossPreEventTriggered = false;
    this.bossDefeated = false;
    this.boss = undefined;
    this.forEachEnemyGroup((group) => group.clear(true, true));
    this.enemyBullets.clear(true, true);
    this.enemyHomingBullets.clear(true, true);
    this.enemyWaveBullets.clear(true, true);
    this.bossBallBullets.clear(true, true);

    const centerY = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;
    this.player1.resetStats();
    this.player1.setPosition(130, this.twoPlayer ? centerY - 40 : centerY);
    if (this.twoPlayer && this.player2) {
      this.player2.resetStats();
      this.player2.setPosition(130, centerY + 40);
    }

    this.banner.setVisible(false);
    this.instruction.setVisible(false);

    this.storyManager.loadScenario(this.stageManager.current.id);
    this.playStageBgm();
    this.updateHud();
  }

  /** デバッグ用：指定ステージ（0始まり）へ直接ジャンプする。toBoss=trueならそのステージのボス戦へ即座に突入する。 */
  private debugJumpToStage(stageIndex: number, toBoss = false): void {
    this.hideStageClearPanel();
    this.mode = 'playing';
    this.stopBgm();
    this.stageManager.jumpToStage(stageIndex);
    this.stageTime = 0;
    this.fireTimer1 = 0;
    this.fireTimer2 = 0;
    this.bossPreEventTriggered = false;
    this.bossDefeated = false;

    if (this.boss?.active) this.boss.destroy();
    this.boss = undefined;

    this.bullets.clear(true, true);
    this.forEachEnemyGroup((group) => group.clear(true, true));
    this.enemyBullets.clear(true, true);
    this.enemyHomingBullets.clear(true, true);
    this.enemyWaveBullets.clear(true, true);
    this.bossBallBullets.clear(true, true);

    const centerY = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;
    this.player1.resetStats();
    this.player1.setPosition(130, this.twoPlayer ? centerY - 40 : centerY);
    if (this.twoPlayer && this.player2) {
      this.player2.resetStats();
      this.player2.setPosition(130, centerY + 40);
    }

    this.banner.setVisible(false);
    this.instruction.setVisible(false);
    this.hpText.setVisible(true);
    this.hpText2.setVisible(this.twoPlayer);
    this.progressText.setVisible(true);

    if (toBoss) {
      this.storyManager.reset();
      this.stageManager.skipAllSpawnEvents();
      this.stageTime = this.stageManager.current.duration;
      this.bossPreEventTriggered = true;
      this.spawnBoss();
    } else {
      this.storyManager.loadScenario(this.stageManager.current.id);
      this.playStageBgm();
    }
    this.updateHud();
  }

  /** 1人プレイ時は矢印・WASD両方をOR、2人プレイ時はplayer1=WASD/player2=矢印キーに分離する。 */
  private updateMovement(): void {
    if (!this.twoPlayer) {
      this.player1.move(
        this.cursors.left.isDown || this.keys.A.isDown,
        this.cursors.right.isDown || this.keys.D.isDown,
        this.cursors.up.isDown || this.keys.W.isDown,
        this.cursors.down.isDown || this.keys.S.isDown,
      );
      return;
    }

    this.player1.move(this.keys.A.isDown, this.keys.D.isDown, this.keys.W.isDown, this.keys.S.isDown);
    this.player2?.move(this.cursors.left.isDown, this.cursors.right.isDown, this.cursors.up.isDown, this.cursors.down.isDown);
  }

  /** 中心角度(rad)を中心に、count本の弾をangleStep(rad)間隔の扇形に均等展開した角度配列を返す。 */
  private static fanAngles(centerAngle: number, count: number, angleStep: number): number[] {
    const angles: number[] = [];
    const offsetStart = -((count - 1) / 2) * angleStep;
    for (let i = 0; i < count; i++) {
      angles.push(centerAngle + offsetStart + i * angleStep);
    }
    return angles;
  }

  private firePlayerBullet(player: Player, isDown: boolean, slot: 1 | 2): void {
    if (!player.active || !isDown) return;
    const timer = slot === 1 ? this.fireTimer1 : this.fireTimer2;
    if (timer > 0) return;
    if (slot === 1) this.fireTimer1 = GAME_CONFIG.PLAYER_FIRE_INTERVAL;
    else this.fireTimer2 = GAME_CONFIG.PLAYER_FIRE_INTERVAL;

    const status = this.statusManager.getData(player.variant);
    const angleStep = Phaser.Math.DegToRad(GAME_CONFIG.FAN_ANGLE_STEP_DEG);
    const speed = GAME_CONFIG.PLAYER_BULLET_SPEED;

    // WEP: 前方弾。1発が基本形で、WEPレベルごとに1発追加され、複数になると扇形に広がる。
    const forwardCount = 1 + status.wep;
    for (const angle of ShootingScene.fanAngles(0, forwardCount, angleStep)) {
      this.firePlayerBulletAt(player.x + 20, player.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
    }

    // DEX: 後方弾。レベル0では発射せず、レベルごとに1発ずつ増え、複数になると扇形に広がる。
    if (status.dex > 0) {
      for (const angle of ShootingScene.fanAngles(Math.PI, status.dex, angleStep)) {
        this.firePlayerBulletAt(player.x - 20, player.y, Math.cos(angle) * speed, Math.sin(angle) * speed);
      }
    }
  }

  private firePlayerBulletAt(x: number, y: number, vx: number, vy: number): void {
    let bullet = this.bullets.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this, x, y, 'bullet');
      this.bullets.add(bullet);
    }
    bullet.fire(x, y, vx, vy);
  }

  private updateEnemies(): void {
    if (this.stageTime < this.stageManager.current.duration) {
      const dueEvents = this.stageManager.collectDueSpawnEvents(this.stageTime);
      for (const event of dueEvents) {
        const fromLeft = event.from === 'left';
        const spawnX = fromLeft ? -30 : GAME_CONFIG.WIDTH + 30;
        const shape = event.shape ?? 'triangle';
        // 高速進入敵はステージJSONで低速値を指定しても最低500px/秒で突入する。
        const speed = shape === 'dashRetreat' ? Math.max(event.speed, 500) : event.speed;
        const velocityX = (fromLeft ? speed : -speed) * ShootingScene.SPEED_MULTIPLIER;
        const velocityY = (event.vy ?? 0) * ShootingScene.SPEED_MULTIPLIER;
        const canShoot = event.type === 'shooter' || event.shape === 'straightShooter';
        const texturePath = this.stageManager.current.enemyImages?.[shape];
        const textureKey = texturePath ? `stage-enemy-${texturePath}` : undefined;
        const defaultHp = shape === 'dashRetreat' ? 10 : 1;
        EnemyFactory.create(
          this, this.enemyGroups[shape], shape, spawnX, event.y, velocityX, velocityY,
          event.crossX, canShoot, ShootingScene.SHOOT_DELAY_AFTER_ENTRY, event.hp ?? defaultHp, textureKey,
        );
      }
    }

    this.bullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && sprite.x > GAME_CONFIG.WIDTH + 30) {
        sprite.disableBody(true, true);
      }
      return true;
    });

    this.forEachEnemyGroup((group) => {
      group.children.each((child: Phaser.GameObjects.GameObject) => {
        const enemy = child as Enemy;
        if (!enemy.active) return true;

        if (enemy.pendingShot) {
          enemy.pendingShot = false;
          if (enemy instanceof StarEnemy) {
            this.fireEnemyFanShot(enemy.x, enemy.y);
          } else if (enemy instanceof SquareEnemy) {
            this.fireEnemyHomingShot(enemy.x, enemy.y);
          } else if (enemy instanceof CircleEnemy) {
            this.fireEnemyWaveShot(enemy.x, enemy.y);
          } else {
            this.fireEnemyAimedShot(enemy.x, enemy.y);
          }
        }

        if (enemy.x < -40 || enemy.x > GAME_CONFIG.WIDTH + 40 || enemy.y < -40 || enemy.y > GAME_CONFIG.PLAY_AREA.HEIGHT + 40) {
          enemy.disableBody(true, true);
        }
        return true;
      });
    });

    this.enemyBullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && (sprite.x < -30 || sprite.x > GAME_CONFIG.WIDTH + 30 || sprite.y < -30 || sprite.y > GAME_CONFIG.PLAY_AREA.HEIGHT + 30)) {
        sprite.disableBody(true, true);
      }
      return true;
    });

    this.enemyHomingBullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && (sprite.x < -30 || sprite.x > GAME_CONFIG.WIDTH + 30 || sprite.y < -30 || sprite.y > GAME_CONFIG.PLAY_AREA.HEIGHT + 30)) {
        sprite.disableBody(true, true);
      }
      return true;
    });

    this.enemyWaveBullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && (sprite.x < -30 || sprite.x > GAME_CONFIG.WIDTH + 30 || sprite.y < -30 || sprite.y > GAME_CONFIG.PLAY_AREA.HEIGHT + 30)) {
        sprite.disableBody(true, true);
      }
      return true;
    });

    this.bossBallBullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && (sprite.x < -30 || sprite.x > GAME_CONFIG.WIDTH + 30 || sprite.y < -30 || sprite.y > GAME_CONFIG.PLAY_AREA.HEIGHT + 30)) {
        sprite.disableBody(true, true);
      }
      return true;
    });
  }

  private spawnBoss(): void {
    const bx = GAME_CONFIG.WIDTH - 100;
    const by = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;
    const bossConfig = this.stageManager.current.boss;
    const hitPlayer = this.hitPlayer.bind(this);
    const getPlayers = () => this.activePlayers();

    switch (this.stageManager.stageNumber) {
      case 1:
        this.boss = new Stage1Boss(this, bx, by, this.bossBallBullets, bossConfig.bulletSpeed);
        break;
      case 2:
        this.boss = new Stage2Boss(
          this, bx, by, getPlayers, hitPlayer, this.enemyBullets,
          bossConfig.bulletInterval, bossConfig.bulletSpeed,
        );
        break;
      default:
        this.boss = new Stage3Boss(
          this, bx, by, getPlayers, hitPlayer, this.enemyBullets,
          bossConfig.bulletInterval, bossConfig.bulletSpeed,
        );
        break;
    }
    this.boss.spawn(bx, by, this.bossMaxHp);
    this.stopBgm();
    const alertSound = this.sound.add('se_boss_alert', { volume: this.seVolume(0.7) });
    alertSound.once('complete', () => {
      if (this.mode === 'playing' && this.boss?.active) this.playBossBgm();
    });
    alertSound.play();

    this.banner.setText('BOSS INCOMING').setVisible(true);
    this.time.delayedCall(1300, () => this.banner.setVisible(false));

    this.physics.add.overlap(this.bullets, this.boss, this.hitBoss, undefined, this);
    for (const player of this.activePlayers()) {
      this.physics.add.overlap(this.boss, player, this.hitPlayer, undefined, this);
    }
  }

  /** type:'shooter'の雑魚敵が出現した瞬間に、その場から最寄りプレイヤーへの角度で1発だけ自機狙い弾を撃つ。 */
  private fireEnemyAimedShot(x: number, y: number): void {
    const target = this.nearestPlayer(x, y);
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    const bulletSpeed = 430;

    let bullet = this.enemyBullets.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this, x, y, 'enemyBullet');
      this.enemyBullets.add(bullet);
    }
    bullet.fire(x, y, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
  }

  /** 星型の雑魚敵：最寄りプレイヤー方向を中心に±40度を5等分した扇状に5発同時発射する。 */
  private fireEnemyFanShot(x: number, y: number): void {
    const target = this.nearestPlayer(x, y);
    const baseAngle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    const bulletSpeed = 415;
    const spreadDeg = 80;
    const count = 5;
    const stepDeg = spreadDeg / (count - 1);

    for (let i = 0; i < count; i++) {
      const offsetDeg = -spreadDeg / 2 + stepDeg * i;
      const angle = baseAngle + Phaser.Math.DegToRad(offsetDeg);

      let bullet = this.enemyBullets.getFirstDead(false) as Bullet;
      if (!bullet) {
        bullet = new Bullet(this, x, y, 'enemyBullet');
        this.enemyBullets.add(bullet);
      }
      bullet.fire(x, y, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
    }
  }

  /** 正方形の雑魚敵：発射後1秒だけ緩く最寄りプレイヤーへ軌道補正する弾を1発撃つ。 */
  private fireEnemyHomingShot(x: number, y: number): void {
    const target = this.nearestPlayer(x, y);
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    const bulletSpeed = 390;

    let bullet = this.enemyHomingBullets.getFirstDead(false) as HomingBullet;
    if (!bullet) {
      bullet = new HomingBullet(this, x, y, 'enemyBullet');
      this.enemyHomingBullets.add(bullet);
    }
    bullet.fireHoming(x, y, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed, target);
  }

  /** 丸の雑魚敵：最寄りプレイヤー方向へ直進しつつ、進行方向に対して垂直にサイン波で揺れる弾を1発撃つ。 */
  private fireEnemyWaveShot(x: number, y: number): void {
    const target = this.nearestPlayer(x, y);
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y);
    const bulletSpeed = 400;

    let bullet = this.enemyWaveBullets.getFirstDead(false) as WaveBullet;
    if (!bullet) {
      bullet = new WaveBullet(this, x, y, 'enemyBullet');
      this.enemyWaveBullets.add(bullet);
    }
    bullet.fireWave(x, y, angle, bulletSpeed);
  }

  private hitEnemy(object1: any, object2: any): void {
    // overlap(this.bullets, group, ...)で登録しているため、常にobject1=弾, object2=敵
    const bullet = object1;
    const enemy = object2;
    if (!bullet || !enemy || !bullet.active || !enemy.active) return;
    bullet.disableBody(true, true);
    if (enemy.takeDamage()) {
      enemy.disableBody(true, true);
      this.sound.play('se_enemy_defeat', { volume: this.seVolume(0.45) });
      this.score += ShootingScene.SCORE_ENEMY_DEFEAT;
      this.updateHud();
    }
  }

  private hitBoss(object1: any, object2: any): void {
    // 自機が同時被弾などで既にゲームオーバー/クリア済みの場合、ボス撃破処理（爆発演出→ステージクリア遷移）を
    // 開始してしまうと、その中のenterStageClear()がthis.modeを'gameOver'から'stageClear'へ上書きしてしまい、
    // finish('gameOver')が仕込んだ「3秒後にgameOverシーンへ遷移」の予約が
    // (`if (this.mode !== 'gameOver') return;`のチェックに引っかかって)キャンセルされ、
    // ゲームオーバー画面が出ないままフリーズしたように見えるバグになるため、ここで確実に弾く。
    if (this.mode !== 'playing') return;
    if (this.bossDefeated) return;
    const bullet = (object1 === this.boss) ? object2 : object1;
    if (!bullet || !bullet.active || !this.boss || !this.boss.active) return;
    bullet.disableBody(true, true);
    const defeated = this.boss.takeDamage(1);
    if (defeated) {
      this.bossDefeated = true;
      this.score += ShootingScene.SCORE_BOSS_DEFEAT;
      // takeDamage()内でactiveが即falseになりupdateHud()の分岐に乗らなくなるため、撃破時点のHPを明示的に0で反映する
      this.progressText.setText(`BOSS  0 / ${this.bossMaxHp}`);
      this.scoreText.setText(`SCORE  ${this.score}`);

      // ボス撃破直後：敵弾・雑魚敵を一掃し、自機を無敵化して被弾事故を防ぐ
      for (const player of [this.player1, this.player2]) {
        if (!player?.active) continue;
        player.setInvulnerable(true);
        player.setVelocity(0, 0);
      }
      this.bullets.clear(true, true);
      this.forEachEnemyGroup((group) => group.clear(true, true));
      this.enemyBullets.clear(true, true);
      this.enemyHomingBullets.clear(true, true);
      this.enemyWaveBullets.clear(true, true);
      this.bossBallBullets.clear(true, true);
      this.stopBgm();

      const clearedStage = this.stageManager.stageNumber;
      const bx = this.boss.x;
      const by = this.boss.y;

      // 1. ボス大爆発演出
      this.playBossExplosion(bx, by, () => {
        // 2. ボス撃破後シナリオ（StoryManager）を確実に最後まで再生
        this.storyManager.triggerBossDefeatEvent(
          () => {
            // 3. 全会話完了後：隕石発光＆吸い込まれ演出 -> クリア画面へ
            this.playSuckInAndClearSequence(clearedStage);
          },
          (item) => {
            if (item.speaker === '演出' || item.text.includes('光')) {
              this.playMeteorGlowEffect();
            }
          },
        );
      });
    }
  }

  /** ボス撃破時の迫力ある連続大爆発演出 */
  private playBossExplosion(x: number, y: number, onComplete: () => void): void {
    const explosionCount = 8;
    this.cameras.main.shake(700, 0.018);

    for (let i = 0; i < explosionCount; i++) {
      this.time.delayedCall(i * 80, () => {
        const offsetX = Phaser.Math.Between(-55, 55);
        const offsetY = Phaser.Math.Between(-40, 40);
        const radius = Phaser.Math.Between(25, 55);

        const boom = this.add.circle(x + offsetX, y + offsetY, radius, 0xff7b00, 0.9).setDepth(8);
        const core = this.add.circle(x + offsetX, y + offsetY, radius * 0.55, 0xffffff, 1).setDepth(9);

        this.tweens.add({
          targets: [boom, core],
          scale: 1.6,
          alpha: 0,
          duration: 350,
          ease: 'Quad.easeOut',
          onComplete: () => {
            boom.destroy();
            core.destroy();
          },
        });

        if (i % 2 === 0) {
          this.sound.play('se_enemy_defeat', { volume: this.seVolume(0.6) });
        }
      });
    }

    // クライマックスの特大爆発
    this.time.delayedCall(explosionCount * 80 + 100, () => {
      const bigBoom = this.add.circle(x, y, 85, 0xffd166, 0.95).setDepth(8);
      const flash = this.add.circle(x, y, 115, 0xffffff, 1).setDepth(9);
      this.sound.play('se_enemy_defeat', { volume: this.seVolume(0.8) });
      this.cameras.main.flash(350, 255, 255, 255);

      this.tweens.add({
        targets: [bigBoom, flash],
        scale: 2.2,
        alpha: 0,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => {
          bigBoom.destroy();
          flash.destroy();
          onComplete();
        },
      });
    });
  }

  /** 「隕石が光る」シナリオ連動の発光演出 */
  private playMeteorGlowEffect(): void {
    this.cameras.main.flash(600, 255, 255, 255);
    const centerX = GAME_CONFIG.PLAY_AREA.WIDTH / 2;
    const centerY = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;

    const glow = this.add.circle(centerX, centerY, 70, 0x4cc9f0, 0.6).setDepth(7);
    const glowCore = this.add.circle(centerX, centerY, 35, 0xffffff, 0.9).setDepth(7);

    this.tweens.add({
      targets: [glow, glowCore],
      scale: 3.8,
      alpha: 0,
      duration: 1300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glow.destroy();
        glowCore.destroy();
      },
    });
  }

  /** 「吸い込まれるウサー！」後のストーリー吸い込み＆ホワイトアウトクリア演出 */
  private playSuckInAndClearSequence(clearedStage: number): void {
    const targetX = GAME_CONFIG.PLAY_AREA.WIDTH / 2;
    const targetY = GAME_CONFIG.PLAY_AREA.HEIGHT / 2;

    // 自機本体と羽・空気砲を一緒に中心へ回転・縮小しながら吸い込み
    for (const player of [this.player1, this.player2]) {
      if (!player?.active) continue;
      player.startSuckInAnimation(targetX, targetY, 1100);
    }

    // 強烈なホワイトアウトで次のステージ/リザルトへ移行
    this.cameras.main.fade(1200, 255, 255, 255, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
      if (progress === 1) {
        if (this.stageManager.advance()) {
          this.enterStageClear(clearedStage);
        } else {
          this.finish('clear');
        }
        this.cameras.main.fadeIn(600, 255, 255, 255);
      }
    });
  }

  private hitPlayer(object1: any, object2: any): void {
    if (this.mode !== 'playing') return;
    const player: Player | undefined = object1 instanceof Player ? object1 : (object2 instanceof Player ? object2 : undefined);
    if (!player || !player.active || player.isInvulnerable) return;

    const hazard = (object1 === player) ? object2 : object1;
    // Hazard（警告ビーム・爆風）のvisualはSprite/Imageではない（Rectangle/Arc）のでdisableBody()を持たない。
    // そうしたhazardは接触しても消えず、自身のタイマーで自然に終了する仕様なのでここでは何もしない。
    if (hazard && hazard.active && hazard !== this.boss && !(hazard instanceof Player) && typeof hazard.disableBody === 'function') {
      hazard.disableBody(true, true);
    }

    const dead = player.damage();
    this.sound.play('se_player_hit', { volume: this.seVolume(0.6) });
    this.updateHud();

    if (dead) {
      const survivors = this.livingPlayers().filter((p) => p !== player);
      if (survivors.length > 0) {
        // このプレイヤーは撃墜されたが、相方が生きているのでゲームは続行する。
        player.startDeathAnimation();
      } else {
        this.sound.play('se_player_game_over', { volume: this.seVolume(0.8) });
        this.finish('gameOver', player);
      }
    }
  }

  private finish(mode: 'clear' | 'gameOver', lastPlayer?: Player): void {
    // 残った重なり判定や死亡演出中の接触から終了処理が重複しないようにする。
    if (this.mode !== 'playing') return;
    this.hideStageClearPanel();
    this.mode = mode;
    this.stopBgm();
    if (this.player1?.active) this.player1.setVelocity(0, 0);
    if (this.player2?.active) this.player2.setVelocity(0, 0);
    this.bullets.setVelocityX(0);
    this.enemyBullets.setVelocity(0, 0);
    this.dialogueWindow.hideDialogue();

    const difficulty = this.settingsManager.difficulty;
    if (mode === 'clear') {
      this.saveManager.reportStageCleared(this.stageManager.stageNumber, difficulty);
      this.saveManager.reportAllCleared(difficulty);
    }
    const isNewHighScore = this.saveManager.reportScore(this.score);

    if (mode === 'gameOver') {
      this.hpText.setVisible(false);
      this.hpText2.setVisible(false);
      this.scoreText.setVisible(false);
      this.progressText.setVisible(false);
      // ゲームオーバーのたびに、参加していた各プレイヤーへステータスポイントを1つ付与する
      this.statusManager.addPoint(this.player1.variant);
      if (this.twoPlayer && this.player2) this.statusManager.addPoint(this.player2.variant);
      (lastPlayer ?? this.player1).startDeathAnimation(() => {
        this.gameOverTransitionTimer = this.time.delayedCall(ShootingScene.GAME_OVER_TRANSITION_DELAY, () => {
          this.gameOverTransitionTimer = undefined;
          if (this.mode !== 'gameOver') return;
          this.scene.start('gameOver', {
            score: this.score,
            highScore: this.saveManager.highScore,
            isNewHighScore,
            twoPlayer: this.twoPlayer,
          });
        });
      });
      return;
    }

    this.banner.setText('ALL STAGE CLEAR!').setVisible(true);
    const highScoreLine = isNewHighScore ? '\n★ NEW HIGH SCORE ★' : `\nハイスコア：${this.saveManager.highScore}`;
    this.instruction.setText(
      `SCORE：${this.score}${highScoreLine}\n\nENTER：もう一度プレイ　　ESC / T：タイトルへ戻る`,
    ).setVisible(true);
  }

  private playStageBgm(): void {
    this.stopBgm();
    if (!this.stageBgm) this.stageBgm = this.createBgm('stage_bgm');
    (this.stageBgm as Phaser.Sound.WebAudioSound).setVolume(this.settingsManager.bgmVolume / 100);
    this.stageBgm.play();
    this.scheduleBgmLoop(this.stageBgm, 'stage_bgm');
  }

  private playBossBgm(): void {
    this.stopBgm();
    if (!this.bossBgm) this.bossBgm = this.createBgm('boss_bgm');
    (this.bossBgm as Phaser.Sound.WebAudioSound).setVolume(this.settingsManager.bgmVolume / 100);
    this.bossBgm.play();
    this.scheduleBgmLoop(this.bossBgm, 'boss_bgm');
  }

  private createBgm(key: string): Phaser.Sound.BaseSound {
    return this.sound.add(key, {
      loop: false,
      volume: this.settingsManager.bgmVolume / 100,
    });
  }

  /** SEの基準音量(0〜1)にオプションのSE音量設定を掛け合わせる。 */
  private seVolume(baseVolume: number): number {
    return baseVolume * (this.settingsManager.seVolume / 100);
  }

  private scheduleBgmLoop(sound: Phaser.Sound.BaseSound, key: string): void {
    const audio = this.cache.audio.get(key) as { duration?: number } | undefined;
    const duration = audio?.duration;
    if (!duration || !Number.isFinite(duration) || duration <= ShootingScene.BGM_LOOP_ADVANCE_SECONDS) {
      (sound as Phaser.Sound.WebAudioSound).setLoop(true);
      return;
    }

    this.bgmLoopTimer = this.time.delayedCall(
      (duration - ShootingScene.BGM_LOOP_ADVANCE_SECONDS) * 1000,
      () => {
        if (!sound.isPlaying) return;
        sound.stop();
        sound.play();
        this.scheduleBgmLoop(sound, key);
      },
    );
  }

  private stopBgm(): void {
    this.bgmLoopTimer?.remove(false);
    this.bgmLoopTimer = undefined;
    this.stageBgm?.stop();
    this.bossBgm?.stop();
  }

  private hpLabel(label: string, hp: number, maxHp: number): string {
    return `${label}${'●'.repeat(hp)}${'○'.repeat(Math.max(0, maxHp - hp))}`;
  }

  private updateHud(): void {
    const hp1 = this.player1 ? Math.max(0, this.player1.hp) : GAME_CONFIG.PLAYER_HP;
    if (this.twoPlayer) {
      this.hpText.setText(this.hpLabel('P1 HP  ', hp1, this.player1?.maxHp ?? GAME_CONFIG.PLAYER_HP));
      const hp2 = this.player2 ? Math.max(0, this.player2.hp) : 0;
      this.hpText2.setText(this.hpLabel('P2 HP  ', hp2, this.player2?.maxHp ?? GAME_CONFIG.PLAYER_HP));
    } else {
      this.hpText.setText(this.hpLabel('HP  ', hp1, this.player1?.maxHp ?? GAME_CONFIG.PLAYER_HP));
    }
    this.scoreText.setText(`SCORE  ${this.score}`);

    if (this.boss && this.boss.active) {
      this.progressText.setText(`BOSS  ${this.boss.hp} / ${this.bossMaxHp}`);
    } else {
      const pct = Math.min(100, Math.floor(this.stageTime / this.stageManager.current.duration * 100));
      this.progressText.setText(`STAGE ${this.stageManager.stageNumber}/${this.stageManager.totalStages}  ${pct}%`);
    }
  }

  private drawBackground(delta: number): void {
    this.backgroundOffset = (this.backgroundOffset + delta * 0.035) % 3600;
    this.foregroundOffset = (this.foregroundOffset + delta * 0.15) % 4800;
    if (!this.backgroundGraphics) this.backgroundGraphics = this.add.graphics().setDepth(-1);
    if (!this.foregroundGraphics) this.foregroundGraphics = this.add.graphics().setDepth(2);

    const background = this.backgroundGraphics.clear();
    const foreground = this.foregroundGraphics.clear();
    const stage = this.stageManager.stageNumber;

    if (stage === 1) {
      this.drawSkyBackground(background, foreground);
    } else if (stage === 2) {
      this.drawTimeTravelBackground(background, foreground);
    } else {
      this.drawNightCityBackground(background, foreground);
    }
  }

  private drawSkyBackground(background: Phaser.GameObjects.Graphics, foreground: Phaser.GameObjects.Graphics): void {
    this.cameras.main.setBackgroundColor('#67c5e8');
    background.fillStyle(0x67c5e8).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.PLAY_AREA.HEIGHT);
    background.fillStyle(0xd8f4ff, 0.5).fillCircle(760, 72, 48).fillCircle(790, 72, 35);

    const mountainOffset = this.backgroundOffset * 0.28;
    for (let x = -360 - mountainOffset; x < GAME_CONFIG.WIDTH + 360; x += 360) {
      background.fillStyle(0x4d9a87).fillTriangle(x, 420, x + 175, 165, x + 350, 420);
      background.fillStyle(0x34796f).fillTriangle(x + 155, 420, x + 310, 230, x + 490, 420);
      background.fillStyle(0x8fcf93).fillTriangle(x + 175, 165, x + 204, 210, x + 147, 210);
    }

    this.drawCloudFlow(background, this.skyClouds, this.backgroundOffset * 0.55);
    this.drawCloudFlow(foreground, this.skyForegroundClouds, this.foregroundOffset);
  }

  private drawTimeTravelBackground(background: Phaser.GameObjects.Graphics, foreground: Phaser.GameObjects.Graphics): void {
    this.cameras.main.setBackgroundColor('#f3b4c5');
    background.fillStyle(0xf3b4c5).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.PLAY_AREA.HEIGHT);
    const ringX = 700 - this.backgroundOffset * 0.12;
    background.lineStyle(8, 0x9c7cc5, 0.48).strokeCircle(ringX, 205, 180);
    background.lineStyle(4, 0xf08b45, 0.62).strokeCircle(ringX, 205, 135);
    background.fillStyle(0x304867, 0.9).fillCircle(ringX, 205, 112);
    background.lineStyle(5, 0xfff2d8, 0.95).strokeCircle(ringX, 205, 98);
    for (let tick = 0; tick < 12; tick++) {
      const angle = Phaser.Math.DegToRad(tick * 30 - 90);
      background.lineStyle(3, 0xfff2d8, 0.86).lineBetween(
        ringX + Math.cos(angle) * 79, 205 + Math.sin(angle) * 79,
        ringX + Math.cos(angle) * 91, 205 + Math.sin(angle) * 91,
      );
    }
    background.lineStyle(6, 0xffbc42, 0.95).lineBetween(ringX, 205, ringX + 38, 205 - 50);
    background.lineStyle(4, 0x76c9c5, 0.95).lineBetween(ringX, 205, ringX - 52, 205 + 20);

    for (let x = -120 - this.backgroundOffset; x < GAME_CONFIG.WIDTH + 180; x += 180) {
      background.fillStyle(0x6baeb5, 0.38).fillRect(x, 55 + ((x / 180) % 3) * 90, 58, 3);
      background.fillStyle(0xf18c45, 0.4).fillRect(x + 62, 270 - ((x / 180) % 2) * 110, 34, 3);
    }
    for (const shard of [{ x: 1180, y: 65 }, { x: 3690, y: 225 }]) {
      const x = this.flowX(shard.x, this.foregroundOffset);
      foreground.fillStyle(0xe4d5fa, 0.42).fillTriangle(x, shard.y, x + 95, shard.y + 135, x + 12, shard.y + 260);
      foreground.fillStyle(0x76c9c5, 0.35).fillRect(x + 70, 0, 7, 420);
    }
  }

  private drawNightCityBackground(background: Phaser.GameObjects.Graphics, foreground: Phaser.GameObjects.Graphics): void {
    this.cameras.main.setBackgroundColor('#101b46');
    background.fillStyle(0x101b46).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.PLAY_AREA.HEIGHT);
    for (let star = 0; star < 38; star++) {
      const x = (star * 83) % GAME_CONFIG.WIDTH;
      const y = 18 + (star * 47) % 245;
      background.fillStyle(star % 4 === 0 ? 0xf6d365 : 0xdbe9ff, 0.45 + (star % 3) * 0.18).fillCircle(x, y, star % 5 === 0 ? 2 : 1);
    }
    this.drawCloudFlow(background, this.nightClouds, this.backgroundOffset * 0.35);

    const cityOffset = this.backgroundOffset * 0.5;
    for (let x = -100 - cityOffset; x < GAME_CONFIG.WIDTH + 120; x += 100) {
      const height = 90 + (Math.floor((x + cityOffset) / 100) % 3 + 3) * 32;
      background.fillStyle(0x17243f).fillRect(x, 420 - height, 78, height);
      background.fillStyle(0xffd56b, 0.58);
      for (let windowY = 420 - height + 18; windowY < 405; windowY += 28) {
        background.fillRect(x + 15, windowY, 8, 10).fillRect(x + 48, windowY, 8, 10);
      }
    }
    this.drawCloudFlow(foreground, this.nightForegroundClouds, this.foregroundOffset);
  }

  private drawCloudFlow(graphics: Phaser.GameObjects.Graphics, clouds: CloudFlow[], offset: number): void {
    for (const cloud of clouds) {
      const x = this.flowX(cloud.x, offset);
      graphics.fillStyle(0xffffff, cloud.alpha).fillEllipse(x + 72 * cloud.scale, cloud.y, 145 * cloud.scale, 44 * cloud.scale);
      graphics.fillCircle(x + 30 * cloud.scale, cloud.y + 4 * cloud.scale, 28 * cloud.scale)
        .fillCircle(x + 70 * cloud.scale, cloud.y - 18 * cloud.scale, 38 * cloud.scale)
        .fillCircle(x + 108 * cloud.scale, cloud.y, 31 * cloud.scale);
    }
  }

  private flowX(baseX: number, offset: number): number {
    return ((baseX - offset + 220) % 4800 + 4800) % 4800 - 220;
  }
}
