import Phaser from 'phaser';

const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_SPEED = 300;
const PLAYER_HP = 5;
const STAGE_DURATION = 25_000;
const FONT_FAMILY = "'M PLUS 1p', 'Yu Gothic', 'Meiryo', sans-serif";

type GameMode = 'title' | 'playing' | 'gameOver' | 'clear';

class ShootingScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private bullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private boss?: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mode: GameMode = 'title';
  private hp = PLAYER_HP;
  private isInvulnerable = false;
  private stageTime = 0;
  private spawnTimer = 0;
  private bossHp = 40;
  private bossShotTimer = 0;
  private backgroundOffset = 0;
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
      if (this.mode !== 'playing') this.startGame();
    });
  }

  update(_time: number, delta: number): void {
    this.drawBackground(delta);
    if (this.mode !== 'playing') return;

    this.stageTime += delta;
    this.spawnTimer += delta;
    this.bossShotTimer += delta;
    this.movePlayer();
    this.firePlayerBullet();
    this.updateEnemies();
    this.updateHud();

    if (this.stageTime >= STAGE_DURATION && !this.boss) this.spawnBoss();
    if (this.boss && this.boss.active && this.bossShotTimer > 900) this.fireBossPattern();
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
    this.hpText = this.add.text(24, 20, '', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#f6d365' }).setDepth(5);
    this.progressText = this.add.text(WIDTH - 24, 20, '', { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#a9d6e5' }).setOrigin(1, 0).setDepth(5);
    this.banner = this.add.text(WIDTH / 2, HEIGHT / 2 - 35, '', {
      fontFamily: FONT_FAMILY, fontSize: '48px', color: '#f8f7f2', align: 'center', stroke: '#12263a', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(6);
    this.instruction = this.add.text(WIDTH / 2, HEIGHT / 2 + 55, '', {
      fontFamily: FONT_FAMILY, fontSize: '19px', color: '#a9d6e5', align: 'center', lineSpacing: 8,
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
    this.hp = PLAYER_HP;
    this.isInvulnerable = false;
    this.stageTime = 0;
    this.spawnTimer = 0;
    this.bossHp = 40;
    if (this.boss?.active) this.boss.destroy();
    this.boss = undefined;
    this.bullets.clear(true, true);
    this.enemies.clear(true, true);
    this.enemyBullets.clear(true, true);
    if (this.player?.active) this.player.destroy();
    this.player = this.physics.add.sprite(130, HEIGHT / 2, 'player').setCollideWorldBounds(true);
    // 喰らい判定を中央の小さな円（半径8px）に設定
    (this.player.body as Phaser.Physics.Arcade.Body).setCircle(8, 10, 10);

    this.physics.add.overlap(this.bullets, this.enemies, this.hitEnemy, undefined, this);
    this.physics.add.overlap(this.enemyBullets, this.player, this.hitPlayer, undefined, this);
    this.physics.add.overlap(this.enemies, this.player, this.hitPlayer, undefined, this);
    this.banner.setVisible(false);
    this.instruction.setVisible(false);
    this.hpText.setVisible(true);
    this.progressText.setVisible(true);
    this.updateHud();
  }

  private movePlayer(): void {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;
    this.player.setVelocity((right ? 1 : 0) * PLAYER_SPEED - (left ? 1 : 0) * PLAYER_SPEED, (down ? 1 : 0) * PLAYER_SPEED - (up ? 1 : 0) * PLAYER_SPEED);
  }

  private firePlayerBullet(): void {
    if (!Phaser.Input.Keyboard.JustDown(this.keys.SPACE)) return;
    const bx = this.player.x + 20;
    const by = this.player.y;
    let bullet = this.bullets.getFirstDead(false) as Phaser.Physics.Arcade.Sprite;
    if (!bullet) {
      bullet = this.bullets.create(bx, by, 'bullet');
      (bullet.body as Phaser.Physics.Arcade.Body).setCircle(6, 4, 4);
    } else {
      bullet.enableBody(true, bx, by, true, true);
    }
    bullet.setVelocityX(520);
  }

  private updateEnemies(): void {
    if (this.spawnTimer > 900 && this.stageTime < STAGE_DURATION) {
      this.spawnTimer = 0;
      const spawnY = Phaser.Math.Between(70, HEIGHT - 70);
      let enemy = this.enemies.getFirstDead(false) as Phaser.Physics.Arcade.Sprite;
      if (!enemy) {
        enemy = this.enemies.create(WIDTH + 30, spawnY, 'enemy');
        (enemy.body as Phaser.Physics.Arcade.Body).setCircle(12, 5, 8);
      } else {
        enemy.enableBody(true, WIDTH + 30, spawnY, true, true);
      }
      enemy.setVelocityX(-Phaser.Math.Between(90, 150));
    }
    this.bullets.children.each((child: Phaser.GameObjects.GameObject) => {
      const sprite = child as Phaser.Physics.Arcade.Sprite;
      if (sprite.active && sprite.x > WIDTH + 30) {
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
      if (sprite.active && (sprite.x < -30 || sprite.x > WIDTH + 30 || sprite.y < -30 || sprite.y > HEIGHT + 30)) {
        sprite.disableBody(true, true);
      }
      return true;
    });
  }

  private spawnBoss(): void {
    this.boss = this.physics.add.sprite(WIDTH - 100, HEIGHT / 2, 'boss').setImmovable(true).setCollideWorldBounds(true).setBounce(1);
    (this.boss.body as Phaser.Physics.Arcade.Body).setSize(100, 60);
    this.boss.setVelocityY(80);
    this.bossHp = 40;
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
    let bullet = this.enemyBullets.getFirstDead(false) as Phaser.Physics.Arcade.Sprite;
    if (!bullet) {
      bullet = this.enemyBullets.create(bx, by, 'enemyBullet');
      (bullet.body as Phaser.Physics.Arcade.Body).setCircle(5, 3, 3);
    } else {
      bullet.enableBody(true, bx, by, true, true);
    }
    bullet.setVelocity(Math.cos(angle) * 230, Math.sin(angle) * 230);
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
    this.bossHp -= 1;
    if (this.bossHp <= 0) {
      this.boss.disableBody(true, true);
      this.finish('clear');
    }
  }

  private hitPlayer(object1: any, object2: any): void {
    if (!this.player || !this.player.active || this.isInvulnerable) return;

    // object1 と object2 のうち player ではない方を hazard として特定する
    const hazard = (object1 === this.player) ? object2 : object1;

    if (hazard && hazard.active) {
      // 雑魚敵・敵弾に当たったときは無効化（プールへ返却）。ボスやプレイヤー自身は消さない
      if (hazard !== this.boss && hazard !== this.player) {
        hazard.disableBody(true, true);
      }
    }

    this.hp -= 1;
    this.updateHud();
    if (this.hp <= 0) {
      this.finish('gameOver');
      return;
    }

    // 被弾後の無敵時間（約1.2秒間、移動や攻撃はそのまま可能で点滅演出のみ）
    this.isInvulnerable = true;
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 100,
      ease: 'Linear',
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        if (this.player && this.player.active) {
          this.player.setAlpha(1);
        }
        this.isInvulnerable = false;
      }
    });
  }

  private finish(mode: 'clear' | 'gameOver'): void {
    this.mode = mode;
    this.player.setVelocity(0, 0);
    this.bullets.setVelocityX(0);
    this.enemyBullets.setVelocity(0, 0);
    this.banner.setText(mode === 'clear' ? 'STAGE CLEAR!' : 'GAME OVER').setVisible(true);
    this.instruction.setText('ENTER：もう一度プレイ').setVisible(true);
  }

  private updateHud(): void {
    this.hpText.setText(`HP  ${'●'.repeat(this.hp)}${'○'.repeat(PLAYER_HP - this.hp)}`);
    if (this.boss && this.boss.active) this.progressText.setText(`BOSS  ${this.bossHp} / 40`);
    else this.progressText.setText(`STAGE  ${Math.min(100, Math.floor(this.stageTime / STAGE_DURATION * 100))}%`);
  }

  private drawBackground(delta: number): void {
    this.backgroundOffset = (this.backgroundOffset + delta * 0.04) % 48;
    this.cameras.main.setBackgroundColor('#12263a');
    if (!this.backgroundGrid) this.backgroundGrid = this.add.graphics().setDepth(-1);
    this.backgroundGrid.clear().lineStyle(1, 0x1f4058, 0.7);
    for (let x = -48 + this.backgroundOffset; x < WIDTH + 48; x += 48) this.backgroundGrid.lineBetween(x, 0, x, HEIGHT);
    for (let y = 0; y < HEIGHT; y += 48) this.backgroundGrid.lineBetween(0, y, WIDTH, y);
  }

  private backgroundGrid?: Phaser.GameObjects.Graphics;
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: WIDTH,
  height: HEIGHT,
  parent: 'game',
  backgroundColor: '#12263a',
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: ShootingScene,
});