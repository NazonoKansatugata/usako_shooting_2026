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
  private static readonly SPEED_MULTIPLIER = 1.3;

  private player!: Player;
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
  private dialogueWindow!: DialogueWindow;
  private storyManager!: StoryManager;
  private stageBgm?: Phaser.Sound.BaseSound;
  private bossBgm?: Phaser.Sound.BaseSound;
  private bgmLoopTimer?: Phaser.Time.TimerEvent;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mode: GameMode = 'playing';

  private stageTime = 0;
  private fireTimer = 0;
  private bossPreEventTriggered = false;
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
  private progressText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private instruction!: Phaser.GameObjects.Text;

  constructor() {
    super('shooting');
  }

  preload(): void {
    this.load.image('player-base', 'assets/picture/player/DefineSprite_145/1.png');
    this.load.image('player-wing-1', 'assets/picture/player/DefineSprite_149/1.png');
    this.load.image('player-wing-3', 'assets/picture/player/DefineSprite_149/3.png');
    this.load.image('player-hit', 'assets/picture/player/DefineSprite_168/90.png');
    this.load.image('dialogue-usako', 'assets/picture/player/DefineSprite_44/1.png');
    this.load.image('dialogue-nekoko', 'assets/picture/player/DefineSprite_54/1.png');
    this.load.image('dialogue-keroko', 'assets/picture/player/DefineSprite_190/4.png');
    this.load.audio('stage_bgm', 'assets/bgm/1226(ステージテーマ).mp3');
    this.load.audio('boss_bgm', 'assets/bgm/1283(ボス出現).mp3');
    this.load.audio('se_enemy_defeat', 'assets/se/311(敵撃破音).mp3');
    this.load.audio('se_player_hit', 'assets/se/153(被弾).mp3');
    this.load.audio('se_player_game_over', 'assets/se/307(やられちゃった).mp3');
    this.load.audio('se_boss_alert', 'assets/se/1266(ボス出現アラート).mp3');
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
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,SPACE,ENTER,ESC,P,T') as Record<string, Phaser.Input.Keyboard.Key>;

    this.dialogueWindow = new DialogueWindow(this);
    this.storyManager = new StoryManager(this.dialogueWindow);

    this.createHud();
    this.startGame();

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.mode === 'stageClear') {
        this.startNextStage();
      } else if (this.mode === 'gameOver' || this.mode === 'clear') {
        this.startGame();
      }
    });

    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.start('title');
    });

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

    this.events.once('shutdown', () => this.stopBgm());
  }

  update(_time: number, delta: number): void {
    this.drawBackground(delta);

    // 下画面の戦況モニターはゲームモードに関わらず（あるいはplaying時に）常時更新
    const stageDuration = this.stageManager.current.duration;
    const stageProgressPct = Math.min(100, (this.stageTime / stageDuration) * 100);
    this.dialogueWindow.update(delta, stageProgressPct);

    if (this.mode !== 'playing') return;

    // イベント再生中（ステージ開始直後演出・イベント進捗率停止・ボス前演出）はステージ進行率の加算を止める
    const progressBlocked = this.storyManager.isBlockingProgress();
    if (!progressBlocked) {
      this.stageTime += delta;
    }
    this.fireTimer -= delta;

    this.player.move(this.cursors, this.keys);
    this.firePlayerBullet();
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
    graphics.clear().fillStyle(0xffc857).fillCircle(10, 10, 10).generateTexture('bullet', 20, 20);
    graphics.clear().fillStyle(0xff4d6d).fillCircle(10, 10, 10).generateTexture('enemyBullet', 20, 20);
    graphics.destroy();
  }

  private createPlayerAnimation(): void {
    if (this.anims.exists('player-flight')) return;

    this.anims.create({
      key: 'player-flight',
      frames: [{ key: 'player-wing-1' }, { key: 'player-wing-3' }],
      frameRate: 12,
      repeat: -1,
    });
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
    this.mode = 'playing';
    this.stageManager.reset();
    this.stageTime = 0;
    this.fireTimer = 0;
    this.bossPreEventTriggered = false;
    this.score = 0;

    if (this.boss?.active) this.boss.destroy();
    this.boss = undefined;

    this.bullets.clear(true, true);
    this.forEachEnemyGroup((group) => group.clear(true, true));
    this.enemyBullets.clear(true, true);
    this.enemyHomingBullets.clear(true, true);
    this.enemyWaveBullets.clear(true, true);
    this.bossBallBullets.clear(true, true);

    if (this.player?.active) this.player.destroy();
    this.player = new Player(this, 130, GAME_CONFIG.PLAY_AREA.HEIGHT / 2);
    this.player.resetStats();

    this.forEachEnemyGroup((group) => {
      this.physics.add.overlap(this.bullets, group, this.hitEnemy, undefined, this);
      this.physics.add.overlap(group, this.player, this.hitPlayer, undefined, this);
    });
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayer, undefined, this);
    this.physics.add.overlap(this.enemyHomingBullets, this.player, this.hitPlayer, undefined, this);
    this.physics.add.overlap(this.enemyWaveBullets, this.player, this.hitPlayer, undefined, this);
    this.physics.add.overlap(this.bossBallBullets, this.player, this.hitPlayer, undefined, this);

    this.banner.setVisible(false);
    this.instruction.setVisible(false);
    this.hpText.setVisible(true);
    this.progressText.setVisible(true);

    this.storyManager.loadScenario(this.stageManager.current.id);
    this.playStageBgm();
    this.updateHud();
  }

  /** ボス撃破後、次ステージへ進む前にリザルトを表示してプレイヤーの入力を待つ。 */
  private enterStageClear(clearedStage: number): void {
    this.mode = 'stageClear';
    this.stopBgm();
    if (this.player?.active) this.player.setVelocity(0, 0);

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
    const hp = Math.max(0, this.player.hp);
    this.saveManager.reportStageCleared(clearedStage, this.settingsManager.difficulty);

    this.banner.setText(`STAGE ${clearedStage} CLEAR`).setVisible(true);
    this.instruction.setText(
      `クリアタイム：${clearSeconds}秒　　残りHP：${hp}/${GAME_CONFIG.PLAYER_HP}\n\nENTER：次のステージへ`,
    ).setVisible(true);
  }

  private startNextStage(): void {
    this.mode = 'playing';
    this.stageTime = 0;
    this.fireTimer = 0;
    this.bossPreEventTriggered = false;
    this.boss = undefined;
    this.forEachEnemyGroup((group) => group.clear(true, true));
    this.enemyBullets.clear(true, true);
    this.enemyHomingBullets.clear(true, true);
    this.enemyWaveBullets.clear(true, true);
    this.bossBallBullets.clear(true, true);

    this.banner.setVisible(false);
    this.instruction.setVisible(false);

    this.storyManager.loadScenario(this.stageManager.current.id);
    this.playStageBgm();
    this.updateHud();
  }

  /** デバッグ用：指定ステージ（0始まり）へ直接ジャンプする。toBoss=trueならそのステージのボス戦へ即座に突入する。 */
  private debugJumpToStage(stageIndex: number, toBoss = false): void {
    this.mode = 'playing';
    this.stopBgm();
    this.stageManager.jumpToStage(stageIndex);
    this.stageTime = 0;
    this.fireTimer = 0;
    this.bossPreEventTriggered = false;

    if (this.boss?.active) this.boss.destroy();
    this.boss = undefined;

    this.bullets.clear(true, true);
    this.forEachEnemyGroup((group) => group.clear(true, true));
    this.enemyBullets.clear(true, true);
    this.enemyHomingBullets.clear(true, true);
    this.enemyWaveBullets.clear(true, true);
    this.bossBallBullets.clear(true, true);

    this.player.resetStats();
    this.player.setPosition(130, GAME_CONFIG.PLAY_AREA.HEIGHT / 2);

    this.banner.setVisible(false);
    this.instruction.setVisible(false);
    this.hpText.setVisible(true);
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

  private firePlayerBullet(): void {
    if (!this.keys.SPACE.isDown || this.fireTimer > 0) return;
    this.fireTimer = GAME_CONFIG.PLAYER_FIRE_INTERVAL;

    const bx = this.player.x + 20;
    const by = this.player.y;

    let bullet = this.bullets.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this, bx, by, 'bullet');
      this.bullets.add(bullet);
    }
    bullet.fire(bx, by, 520, 0);
  }

  private updateEnemies(): void {
    if (this.stageTime < this.stageManager.current.duration) {
      const dueEvents = this.stageManager.collectDueSpawnEvents(this.stageTime);
      for (const event of dueEvents) {
        const fromLeft = event.from === 'left';
        const spawnX = fromLeft ? -30 : GAME_CONFIG.WIDTH + 30;
        const velocityX = (fromLeft ? event.speed : -event.speed) * ShootingScene.SPEED_MULTIPLIER;
        const velocityY = (event.vy ?? 0) * ShootingScene.SPEED_MULTIPLIER;
        const canShoot = event.type === 'shooter';
        const shape = event.shape ?? 'triangle';
        EnemyFactory.create(
          this, this.enemyGroups[shape], shape, spawnX, event.y, velocityX, velocityY,
          event.crossX, canShoot, ShootingScene.SHOOT_DELAY_AFTER_ENTRY,
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

    switch (this.stageManager.stageNumber) {
      case 1:
        this.boss = new Stage1Boss(this, bx, by, this.bossBallBullets, bossConfig.bulletSpeed);
        break;
      case 2:
        this.boss = new Stage2Boss(
          this, bx, by, this.player, hitPlayer, this.enemyBullets,
          bossConfig.bulletInterval, bossConfig.bulletSpeed,
        );
        break;
      default:
        this.boss = new Stage3Boss(
          this, bx, by, this.player, hitPlayer, this.enemyBullets,
          bossConfig.bulletInterval, bossConfig.bulletSpeed,
        );
        break;
    }
    this.boss.spawn(bx, by, bossConfig.hp);
    this.stopBgm();
    const alertSound = this.sound.add('se_boss_alert', { volume: 0.7 });
    alertSound.once('complete', () => {
      if (this.mode === 'playing' && this.boss?.active) this.playBossBgm();
    });
    alertSound.play();

    this.banner.setText('BOSS INCOMING').setVisible(true);
    this.time.delayedCall(1300, () => this.banner.setVisible(false));

    this.physics.add.overlap(this.bullets, this.boss, this.hitBoss, undefined, this);
    this.physics.add.overlap(this.boss, this.player, this.hitPlayer, undefined, this);
  }

  /** type:'shooter'の雑魚敵が出現した瞬間に、その場からプレイヤーへの角度で1発だけ自機狙い弾を撃つ。 */
  private fireEnemyAimedShot(x: number, y: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    const bulletSpeed = 455;

    let bullet = this.enemyBullets.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this, x, y, 'enemyBullet');
      this.enemyBullets.add(bullet);
    }
    bullet.fire(x, y, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
  }

  /** 星型の雑魚敵：自機方向を中心に±40度を5等分した扇状に5発同時発射する。 */
  private fireEnemyFanShot(x: number, y: number): void {
    const baseAngle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
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

  /** 正方形の雑魚敵：発射後1秒だけ緩く自機へ軌道補正する弾を1発撃つ。 */
  private fireEnemyHomingShot(x: number, y: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    const bulletSpeed = 390;

    let bullet = this.enemyHomingBullets.getFirstDead(false) as HomingBullet;
    if (!bullet) {
      bullet = new HomingBullet(this, x, y, 'enemyBullet');
      this.enemyHomingBullets.add(bullet);
    }
    bullet.fireHoming(x, y, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed, this.player);
  }

  /** 丸の雑魚敵：自機方向へ直進しつつ、進行方向に対して垂直にサイン波で揺れる弾を1発撃つ。 */
  private fireEnemyWaveShot(x: number, y: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
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
    enemy.disableBody(true, true);
    this.sound.play('se_enemy_defeat', { volume: 0.45 });
    this.score += ShootingScene.SCORE_ENEMY_DEFEAT;
    this.updateHud();
  }

  private hitBoss(object1: any, object2: any): void {
    const bullet = (object1 === this.boss) ? object2 : object1;
    if (!bullet || !bullet.active || !this.boss || !this.boss.active) return;
    bullet.disableBody(true, true);
    const defeated = this.boss.takeDamage(1);
    if (defeated) {
      this.score += ShootingScene.SCORE_BOSS_DEFEAT;
      // takeDamage()内でactiveが即falseになりupdateHud()の分岐に乗らなくなるため、撃破時点のHPを明示的に0で反映する
      this.progressText.setText(`BOSS  0 / ${this.stageManager.current.boss.hp}`);
      this.scoreText.setText(`SCORE  ${this.score}`);
      const clearedStage = this.stageManager.stageNumber;
      this.storyManager.triggerBossDefeatEvent(() => {
        if (this.stageManager.advance()) {
          this.enterStageClear(clearedStage);
        } else {
          this.finish('clear');
        }
      });
    }
  }

  private hitPlayer(object1: any, object2: any): void {
    if (!this.player || !this.player.active || this.player.isInvulnerable) return;

    const hazard = (object1 === this.player) ? object2 : object1;
    // Hazard（警告ビーム・爆風）のvisualはSprite/Imageではない（Rectangle/Arc）のでdisableBody()を持たない。
    // そうしたhazardは接触しても消えず、自身のタイマーで自然に終了する仕様なのでここでは何もしない。
    if (hazard && hazard.active && hazard !== this.boss && hazard !== this.player && typeof hazard.disableBody === 'function') {
      hazard.disableBody(true, true);
    }

    const dead = this.player.damage();
    this.sound.play('se_player_hit', { volume: 0.6 });
    this.updateHud();

    if (dead) {
      this.sound.play('se_player_game_over', { volume: 0.8 });
      this.finish('gameOver');
    } else {
      this.sound.play('se_player_hit', { volume: 0.6 });
    }
  }

  private finish(mode: 'clear' | 'gameOver'): void {
    this.mode = mode;
    this.stopBgm();
    if (this.player?.active) this.player.setVelocity(0, 0);
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
      this.scoreText.setVisible(false);
      this.progressText.setVisible(false);
      this.player.startDeathAnimation(() => {
        this.time.delayedCall(ShootingScene.GAME_OVER_TRANSITION_DELAY, () => {
          this.scene.start('gameOver', {
            score: this.score,
            highScore: this.saveManager.highScore,
            isNewHighScore,
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
    this.stageBgm.play();
    this.scheduleBgmLoop(this.stageBgm, 'stage_bgm');
  }

  private playBossBgm(): void {
    this.stopBgm();
    if (!this.bossBgm) this.bossBgm = this.createBgm('boss_bgm');
    this.bossBgm.play();
    this.scheduleBgmLoop(this.bossBgm, 'boss_bgm');
  }

  private createBgm(key: string): Phaser.Sound.BaseSound {
    return this.sound.add(key, {
      loop: false,
      volume: this.settingsManager.bgmVolume / 100,
    });
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

  private updateHud(): void {
    const hp = this.player ? Math.max(0, this.player.hp) : GAME_CONFIG.PLAYER_HP;
    this.hpText.setText(`HP  ${'●'.repeat(hp)}${'○'.repeat(GAME_CONFIG.PLAYER_HP - hp)}`);
    this.scoreText.setText(`SCORE  ${this.score}`);

    if (this.boss && this.boss.active) {
      this.progressText.setText(`BOSS  ${this.boss.hp} / ${this.stageManager.current.boss.hp}`);
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
