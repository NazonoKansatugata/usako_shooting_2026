import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { GameMode } from '../types';
import { Player } from '../entities/Player';
import { Boss } from '../entities/Boss';
import { Bullet } from '../entities/Bullet';
import { Enemy } from '../entities/Enemy';
import { EnemyFactory } from '../managers/EnemyFactory';
import { StageManager } from '../managers/StageManager';
import { SettingsManager } from '../managers/SettingsManager';
import { DialogueWindow } from '../ui/DialogueWindow';
import { StoryManager } from '../managers/StoryManager';

export class ShootingScene extends Phaser.Scene {
  /** shooterタイプの雑魚敵が画面内に入ってから発射するまでの遅延(ms) */
  private static readonly SHOOT_DELAY_AFTER_ENTRY = 500;
  private static readonly BGM_LOOP_ADVANCE_SECONDS = 0.1;

  private player!: Player;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private boss?: Boss;
  private stageManager = new StageManager();
  private settingsManager = SettingsManager.getInstance();
  private dialogueWindow!: DialogueWindow;
  private storyManager!: StoryManager;
  private stageBgm?: Phaser.Sound.BaseSound;
  private bossBgm?: Phaser.Sound.BaseSound;
  private bgmLoopTimer?: Phaser.Time.TimerEvent;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mode: GameMode = 'playing';

  private stageTime = 0;
  private bossShotTimer = 0;
  private fireTimer = 0;
  private backgroundOffset = 0;
  private backgroundGrid?: Phaser.GameObjects.Graphics;

  private hpText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;
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

    this.events.once('shutdown', () => this.stopBgm());
  }

  update(_time: number, delta: number): void {
    this.drawBackground(delta);

    // 下画面の戦況モニターはゲームモードに関わらず（あるいはplaying時に）常時更新
    const stageDuration = this.stageManager.current.duration;
    const stageProgressPct = Math.min(100, (this.stageTime / stageDuration) * 100);
    this.dialogueWindow.update(delta, stageProgressPct);

    if (this.mode !== 'playing') return;

    this.stageTime += delta;
    this.bossShotTimer += delta;
    this.fireTimer -= delta;

    this.player.move(this.cursors, this.keys);
    this.firePlayerBullet();
    this.updateEnemies();
    this.updateHud();
    this.storyManager.update(this.stageTime, stageDuration);

    if (this.stageTime >= stageDuration && (!this.boss || !this.boss.active)) {
      this.spawnBoss();
    }
    if (this.boss && this.boss.active && this.bossShotTimer > this.stageManager.current.boss.bulletInterval) {
      this.fireBossPattern();
    }
  }

  private createTextures(): void {
    if (this.textures.exists('enemy')) return;

    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x9aa0a6).fillRect(0, 0, 10, 10).generateTexture('player-air-cannon', 10, 10);
    graphics.clear().fillStyle(0xff6b6b).fillTriangle(0, 20, 34, 0, 34, 40).generateTexture('enemy', 34, 40);
    graphics.clear().fillStyle(0xdc2626).fillTriangle(0, 20, 34, 0, 34, 40).generateTexture('enemyRed', 34, 40);
    graphics.clear().fillStyle(0xffc857).fillCircle(10, 10, 10).generateTexture('bullet', 20, 20);
    graphics.clear().fillStyle(0xff4d6d).fillCircle(8, 8, 8).generateTexture('enemyBullet', 16, 16);
    graphics.clear().fillStyle(0xc44569).fillRect(0, 0, 116, 76).generateTexture('boss', 116, 76);
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
    this.enemies = this.physics.add.group({ defaultKey: 'enemy', maxSize: 20 });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 40 });
  }

  private createHud(): void {
    this.hpText = this.add.text(24, 20, '', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '20px', color: '#f6d365' }).setDepth(5);
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

    if (this.boss?.active) this.boss.destroy();
    this.boss = undefined;

    this.bullets.clear(true, true);
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);

    if (this.player?.active) this.player.destroy();
    this.player = new Player(this, 130, GAME_CONFIG.PLAY_AREA.HEIGHT / 2);
    this.player.resetStats();

    this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayer, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.hitPlayer, undefined, this);

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

    // 会話ウィンドウをクリア
    this.dialogueWindow.hideDialogue();

    // 残っている雑魚・弾を片付けてリザルト画面らしい見た目にする
    this.bullets.clear(true, true);
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);

    const clearSeconds = (this.stageTime / 1000).toFixed(1);
    const hp = Math.max(0, this.player.hp);

    this.banner.setText(`STAGE ${clearedStage} CLEAR`).setVisible(true);
    this.instruction.setText(
      `クリアタイム：${clearSeconds}秒　　残りHP：${hp}/${GAME_CONFIG.PLAYER_HP}\n\nENTER：次のステージへ`,
    ).setVisible(true);
  }

  private startNextStage(): void {
    this.mode = 'playing';
    this.stageTime = 0;
    this.bossShotTimer = 0;
    this.fireTimer = 0;
    this.boss = undefined;
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);

    this.banner.setVisible(false);
    this.instruction.setVisible(false);

    this.storyManager.loadScenario(this.stageManager.current.id);
    this.playStageBgm();
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
        const velocityX = fromLeft ? event.speed : -event.speed;
        const velocityY = event.vy ?? 0;
        const canShoot = event.type === 'shooter';
        EnemyFactory.create(
          this, this.enemies, spawnX, event.y, event.type, velocityX, velocityY,
          event.crossX, event.texture ?? 'enemy', canShoot, ShootingScene.SHOOT_DELAY_AFTER_ENTRY,
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

    this.enemies.children.each((child: Phaser.GameObjects.GameObject) => {
      const enemy = child as Enemy;
      if (!enemy.active) return true;

      if (enemy.pendingShot) {
        enemy.pendingShot = false;
        this.fireEnemyAimedShot(enemy.x, enemy.y);
      }

      if (enemy.x < -40 || enemy.x > GAME_CONFIG.WIDTH + 40 || enemy.y < -40 || enemy.y > GAME_CONFIG.PLAY_AREA.HEIGHT + 40) {
        enemy.disableBody(true, true);
      }
      return true;
    });

    this.enemyBullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && (sprite.x < -30 || sprite.x > GAME_CONFIG.WIDTH + 30 || sprite.y < -30 || sprite.y > GAME_CONFIG.PLAY_AREA.HEIGHT + 30)) {
        sprite.disableBody(true, true);
      }
      return true;
    });
  }

  private spawnBoss(): void {
    this.boss = new Boss(this, GAME_CONFIG.WIDTH - 100, GAME_CONFIG.PLAY_AREA.HEIGHT / 2);
    this.boss.spawn(GAME_CONFIG.WIDTH - 100, GAME_CONFIG.PLAY_AREA.HEIGHT / 2, this.stageManager.current.boss.hp);
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

  private fireBossPattern(): void {
    if (!this.boss || !this.boss.active) return;
    this.bossShotTimer = 0;
    const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y, this.player.x, this.player.y);
    const bx = this.boss.x - 55;
    const by = this.boss.y;

    let bullet = this.enemyBullets.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this, bx, by, 'enemyBullet');
      this.enemyBullets.add(bullet);
    }
    const bulletSpeed = this.stageManager.current.boss.bulletSpeed;
    bullet.fire(bx, by, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
  }

  /** type:'shooter'の雑魚敵が出現した瞬間に、その場からプレイヤーへの角度で1発だけ自機狙い弾を撃つ。 */
  private fireEnemyAimedShot(x: number, y: number): void {
    const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    const bulletSpeed = 250;

    let bullet = this.enemyBullets.getFirstDead(false) as Bullet;
    if (!bullet) {
      bullet = new Bullet(this, x, y, 'enemyBullet');
      this.enemyBullets.add(bullet);
    }
    bullet.fire(x, y, Math.cos(angle) * bulletSpeed, Math.sin(angle) * bulletSpeed);
  }

  private hitEnemy(object1: any, object2: any): void {
    let bullet = object1;
    let enemy = object2;
    if (this.enemies.contains(object1)) {
      enemy = object1;
      bullet = object2;
    }
    if (!bullet || !enemy || !bullet.active || !enemy.active) return;
    bullet.disableBody(true, true);
    enemy.disableBody(true, true);
    this.sound.play('se_enemy_defeat', { volume: 0.45 });
  }

  private hitBoss(object1: any, object2: any): void {
    const bullet = (object1 === this.boss) ? object2 : object1;
    if (!bullet || !bullet.active || !this.boss || !this.boss.active) return;
    bullet.disableBody(true, true);
    const defeated = this.boss.takeDamage(1);
    if (defeated) {
      // takeDamage()内でactiveが即falseになりupdateHud()の分岐に乗らなくなるため、撃破時点のHPを明示的に0で反映する
      this.progressText.setText(`BOSS  0 / ${this.stageManager.current.boss.hp}`);
      const clearedStage = this.stageManager.stageNumber;
      if (this.stageManager.advance()) {
        this.enterStageClear(clearedStage);
      } else {
        this.finish('clear');
      }
    }
  }

  private hitPlayer(object1: any, object2: any): void {
    if (!this.player || !this.player.active || this.player.isInvulnerable) return;

    const hazard = (object1 === this.player) ? object2 : object1;
    if (hazard && hazard.active && hazard !== this.boss && hazard !== this.player) {
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
    if (mode === 'gameOver') this.player.startDeathAnimation();
    this.banner.setText(mode === 'clear' ? 'ALL STAGE CLEAR!' : 'GAME OVER').setVisible(true);
    this.instruction.setText('ENTER：もう一度プレイ　　ESC / T：タイトルへ戻る').setVisible(true);
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

    if (this.boss && this.boss.active) {
      this.progressText.setText(`BOSS  ${this.boss.hp} / ${this.stageManager.current.boss.hp}`);
    } else {
      const pct = Math.min(100, Math.floor(this.stageTime / this.stageManager.current.duration * 100));
      this.progressText.setText(`STAGE ${this.stageManager.stageNumber}/${this.stageManager.totalStages}  ${pct}%`);
    }
  }

  private drawBackground(delta: number): void {
    this.backgroundOffset = (this.backgroundOffset + delta * 0.04) % 48;
    this.cameras.main.setBackgroundColor('#12263a');
    if (!this.backgroundGrid) this.backgroundGrid = this.add.graphics().setDepth(-1);
    this.backgroundGrid.clear().lineStyle(1, 0x1f4058, 0.7);
    for (let x = -48 + this.backgroundOffset; x < GAME_CONFIG.WIDTH + 48; x += 48) {
      this.backgroundGrid.lineBetween(x, 0, x, GAME_CONFIG.PLAY_AREA.HEIGHT);
    }
    for (let y = 0; y <= GAME_CONFIG.PLAY_AREA.HEIGHT; y += 48) {
      this.backgroundGrid.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
    }
  }
}
