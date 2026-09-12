import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { GameMode } from '../types';
import { Player } from '../entities/Player';
import { Boss } from '../entities/Boss';
import { Bullet } from '../entities/Bullet';
import { EnemyFactory } from '../managers/EnemyFactory';
import { StageManager } from '../managers/StageManager';

export class ShootingScene extends Phaser.Scene {
  private player!: Player;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private boss?: Boss;
  private stageManager = new StageManager();

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mode: GameMode = 'title';

  private stageTime = 0;
  private spawnTimer = 0;
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

  create(): void {
    this.createTextures();
    this.createGroups();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,SPACE,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;

    this.createHud();
    this.showTitle();

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (this.mode === 'stageClear') {
        this.startNextStage();
      } else if (this.mode !== 'playing') {
        this.startGame();
      }
    });
  }

  update(_time: number, delta: number): void {
    this.drawBackground(delta);
    if (this.mode !== 'playing') return;

    this.stageTime += delta;
    this.spawnTimer += delta;
    this.bossShotTimer += delta;
    this.fireTimer -= delta;

    this.player.move(this.cursors, this.keys);
    this.firePlayerBullet();
    this.updateEnemies();
    this.updateHud();

    if (this.stageTime >= this.stageManager.current.duration && (!this.boss || !this.boss.active)) {
      this.spawnBoss();
    }
    if (this.boss && this.boss.active && this.bossShotTimer > this.stageManager.current.boss.bulletInterval) {
      this.fireBossPattern();
    }
  }

  private createTextures(): void {
    const graphics = this.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0xf6d365).fillCircle(18, 18, 16).generateTexture('player', 36, 36);
    graphics.clear().fillStyle(0xff6b6b).fillTriangle(0, 20, 34, 0, 34, 40).generateTexture('enemy', 34, 40);
    graphics.clear().fillStyle(0xffc857).fillCircle(10, 10, 10).generateTexture('bullet', 20, 20);
    graphics.clear().fillStyle(0xff4d6d).fillCircle(8, 8, 8).generateTexture('enemyBullet', 16, 16);
    graphics.clear().fillStyle(0xc44569).fillRect(0, 0, 116, 76).generateTexture('boss', 116, 76);
    graphics.destroy();
  }

  private createGroups(): void {
    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 30 });
    this.enemies = this.physics.add.group({ defaultKey: 'enemy', maxSize: 20 });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'enemyBullet', maxSize: 40 });
  }

  private createHud(): void {
    this.hpText = this.add.text(24, 20, '', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '20px', color: '#f6d365' }).setDepth(5);
    this.progressText = this.add.text(GAME_CONFIG.WIDTH - 24, 20, '', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '18px', color: '#a9d6e5' }).setOrigin(1, 0).setDepth(5);
    this.banner = this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 - 35, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '48px', color: '#f8f7f2', align: 'center', stroke: '#12263a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(6);
    this.instruction = this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 + 55, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '19px', color: '#a9d6e5', align: 'center', lineSpacing: 8,
    }).setOrigin(0.5).setDepth(6);
  }

  private showTitle(): void {
    this.banner.setText('うさこシューティング').setVisible(true);
    this.instruction.setText('矢印キー / WASD：移動\nSPACE：発射　　 ENTER：ゲーム開始').setVisible(true);
    this.hpText.setVisible(false);
    this.progressText.setVisible(false);
  }

  private startGame(): void {
    this.mode = 'playing';
    this.stageManager.reset();
    this.stageTime = 0;
    this.spawnTimer = 0;
    this.fireTimer = 0;

    if (this.boss?.active) this.boss.destroy();
    this.boss = undefined;

    this.bullets.clear(true, true);
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);

    if (this.player?.active) this.player.destroy();
    this.player = new Player(this, 130, GAME_CONFIG.HEIGHT / 2);
    this.player.resetStats();

    this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayer, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.hitPlayer, undefined, this);

    this.banner.setVisible(false);
    this.instruction.setVisible(false);
    this.hpText.setVisible(true);
    this.progressText.setVisible(true);
    this.updateHud();
  }

  /** ボス撃破後、次ステージへ進む前にリザルトを表示してプレイヤーの入力を待つ。 */
  private enterStageClear(): void {
    this.mode = 'stageClear';
    if (this.player?.active) this.player.setVelocity(0, 0);

    // 残っている雑魚・弾を片付けてリザルト画面らしい見た目にする
    this.bullets.clear(true, true);
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);

    const clearedStage = this.stageManager.stageNumber - 1;
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
    this.spawnTimer = 0;
    this.bossShotTimer = 0;
    this.fireTimer = 0;
    this.boss = undefined;
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);

    this.banner.setVisible(false);
    this.instruction.setVisible(false);
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
    const stage = this.stageManager.current;
    if (this.spawnTimer > stage.spawnInterval && this.stageTime < stage.duration) {
      this.spawnTimer = 0;
      const spawnY = Phaser.Math.Between(70, GAME_CONFIG.HEIGHT - 70);
      const enemyType = this.stageManager.pickEnemyType();
      EnemyFactory.create(this, this.enemies, GAME_CONFIG.WIDTH + 30, spawnY, enemyType, stage.speedMultiplier);
    }

    this.bullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && sprite.x > GAME_CONFIG.WIDTH + 30) {
        sprite.disableBody(true, true);
      }
      return true;
    });

    this.enemies.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && sprite.x < -40) {
        sprite.disableBody(true, true);
      }
      return true;
    });

    this.enemyBullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && (sprite.x < -30 || sprite.x > GAME_CONFIG.WIDTH + 30 || sprite.y < -30 || sprite.y > GAME_CONFIG.HEIGHT + 30)) {
        sprite.disableBody(true, true);
      }
      return true;
    });
  }

  private spawnBoss(): void {
    this.boss = new Boss(this, GAME_CONFIG.WIDTH - 100, GAME_CONFIG.HEIGHT / 2);
    this.boss.spawn(GAME_CONFIG.WIDTH - 100, GAME_CONFIG.HEIGHT / 2, this.stageManager.current.boss.hp);

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
  }

  private hitBoss(object1: any, object2: any): void {
    const bullet = (object1 === this.boss) ? object2 : object1;
    if (!bullet || !bullet.active || !this.boss || !this.boss.active) return;
    bullet.disableBody(true, true);
    const defeated = this.boss.takeDamage(1);
    if (defeated) {
      // takeDamage()内でactiveが即falseになりupdateHud()の分岐に乗らなくなるため、撃破時点のHPを明示的に0で反映する
      this.progressText.setText(`BOSS  0 / ${this.stageManager.current.boss.hp}`);
      if (this.stageManager.advance()) {
        this.enterStageClear();
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
    this.updateHud();

    if (dead) {
      this.finish('gameOver');
    }
  }

  private finish(mode: 'clear' | 'gameOver'): void {
    this.mode = mode;
    if (this.player?.active) this.player.setVelocity(0, 0);
    this.bullets.setVelocityX(0);
    this.enemyBullets.setVelocity(0, 0);
    this.banner.setText(mode === 'clear' ? 'ALL STAGE CLEAR!' : 'GAME OVER').setVisible(true);
    this.instruction.setText('ENTER：もう一度プレイ').setVisible(true);
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
      this.backgroundGrid.lineBetween(x, 0, x, GAME_CONFIG.HEIGHT);
    }
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += 48) {
      this.backgroundGrid.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
    }
  }
}
