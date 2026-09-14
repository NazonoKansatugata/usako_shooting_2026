import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager } from '../managers/SettingsManager';

interface GameOverData {
  score?: number;
  highScore?: number;
  isNewHighScore?: boolean;
}

interface GameOverMenuItem {
  text: string;
  action: () => void;
}

export class GameOverScene extends Phaser.Scene {
  private score = 0;
  private highScore = 0;
  private isNewHighScore = false;
  private bgm?: Phaser.Sound.BaseSound;

  private selectedIndex = 0;
  private menuItems: GameOverMenuItem[] = [];
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private menuBackplates: Phaser.GameObjects.Graphics[] = [];
  private menuHitAreas: Phaser.GameObjects.Zone[] = [];
  private cursorIcon!: Phaser.GameObjects.Text;

  constructor() {
    super('gameOver');
  }

  init(data: GameOverData): void {
    this.score = data.score ?? 0;
    this.highScore = data.highScore ?? 0;
    this.isNewHighScore = data.isNewHighScore ?? false;
    this.selectedIndex = 0;
  }

  preload(): void {
    this.load.image('game-over-illustration', 'assets/sprites/DefineSprite_1191/2.png');
    this.load.audio('game-over-bgm', 'assets/bgm/残念.mp3');
    this.load.audio('gameOverSelect', '/assets/se/301(選択画面).mp3');
    this.load.audio('gameOverConfirm', '/assets/se/302(決定音).mp3');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x000000).setOrigin(0);

    const seVolume = SettingsManager.getInstance().seVolume / 100;
    const bgmVolume = SettingsManager.getInstance().bgmVolume / 100;

    this.bgm = this.sound.add('game-over-bgm', { volume: bgmVolume * 0.75 });
    this.bgm.play();
    this.events.once('shutdown', () => this.bgm?.stop());

    this.add.image(280, GAME_CONFIG.HEIGHT / 2, 'game-over-illustration')
      .setDisplaySize(390, 390);

    this.add.rectangle(500, 72, 2, 396, 0x6b7280, 0.55).setOrigin(0);

    this.add.text(730, 120, 'GAME OVER', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '48px',
      fontStyle: 'bold',
      color: '#f5f5f5',
      stroke: '#802333',
      strokeThickness: 7,
    }).setOrigin(0.5);

    this.add.text(730, 195, `SCORE  ${this.score}`, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '24px',
      color: '#ffd56b',
    }).setOrigin(0.5);

    const highScoreText = this.isNewHighScore
      ? '★ NEW HIGH SCORE! ★'
      : `HIGH SCORE  ${this.highScore}`;
    this.add.text(730, 235, highScoreText, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '18px',
      color: this.isNewHighScore ? '#ff8db5' : '#94a3b8',
    }).setOrigin(0.5);

    this.createButtons();
    this.setupInput();
    this.updateSelection();
  }

  private createButtons(): void {
    this.menuItems = [
      {
        text: 'もう一度プレイ (Retry)',
        action: () => {
          this.bgm?.stop();
          this.scene.start('shooting');
        },
      },
      {
        text: 'タイトルへ戻る (Title)',
        action: () => {
          this.bgm?.stop();
          this.scene.start('title', { playIntro: false });
        },
      },
    ];

    const startY = 320;
    const itemHeight = 52;
    const btnW = 340;
    const btnX = 730;

    this.cursorIcon = this.add.text(btnX - btnW / 2 - 16, startY, '▶', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '20px',
      color: '#f6d365',
    }).setOrigin(0.5);

    this.menuItems.forEach((item, index) => {
      const y = startY + index * itemHeight;

      const backplate = this.add.graphics();
      this.menuBackplates.push(backplate);

      const hitArea = this.add.zone(btnX, y, btnW, 44)
        .setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => {
        if (this.selectedIndex !== index) {
          this.selectedIndex = index;
          this.updateSelection();
          this.playSound('gameOverSelect');
        }
      });

      hitArea.on('pointerdown', () => {
        this.selectedIndex = index;
        this.updateSelection();
        this.executeSelect();
      });

      this.menuHitAreas.push(hitArea);

      const text = this.add.text(btnX, y, item.text, {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '19px',
        color: '#e2e8f0',
        stroke: '#0f172a',
        strokeThickness: 3,
      }).setOrigin(0.5);

      this.menuTexts.push(text);
    });

    // ガイド表示
    this.add.text(730, GAME_CONFIG.HEIGHT - 40, '↑↓ / WS：選択　　ENTER / SPACE / クリック：決定', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '12px',
      color: '#64748b',
    }).setOrigin(0.5);
  }

  private setupInput(): void {
    this.input.keyboard?.on('keydown-UP', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-W', () => this.navigate(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.navigate(1));
    this.input.keyboard?.on('keydown-S', () => this.navigate(1));

    this.input.keyboard?.on('keydown-ENTER', () => this.executeSelect());
    this.input.keyboard?.on('keydown-SPACE', () => this.executeSelect());
    this.input.keyboard?.on('keydown-ESC', () => {
      this.playSound('gameOverConfirm');
      this.bgm?.stop();
      this.scene.start('title', { playIntro: false });
    });
  }

  private navigate(delta: number): void {
    this.selectedIndex = (this.selectedIndex + delta + this.menuItems.length) % this.menuItems.length;
    this.updateSelection();
    this.playSound('gameOverSelect');
  }

  private executeSelect(): void {
    this.playSound('gameOverConfirm');
    this.menuItems[this.selectedIndex].action();
  }

  private playSound(key: string): void {
    this.sound.play(key, { volume: SettingsManager.getInstance().seVolume / 100 });
  }

  private updateSelection(): void {
    const startY = 320;
    const itemHeight = 52;
    const btnW = 340;
    const btnX = 730;
    const targetY = startY + this.selectedIndex * itemHeight;

    this.cursorIcon.setY(targetY);

    this.menuTexts.forEach((text, i) => {
      const y = startY + i * itemHeight;
      const backplate = this.menuBackplates[i];
      backplate.clear();

      if (i === this.selectedIndex) {
        text.setColor('#f6d365').setFontSize(21).setStyle({ fontStyle: 'bold' });
        backplate.fillStyle(0x0d4fa6, 0.9);
        backplate.fillRoundedRect(btnX - btnW / 2, y - 22, btnW, 44, 8);
        backplate.lineStyle(2, 0xfacc15, 0.9);
        backplate.strokeRoundedRect(btnX - btnW / 2, y - 22, btnW, 44, 8);
      } else {
        text.setColor('#cbd5e1').setFontSize(19).setStyle({ fontStyle: 'normal' });
        backplate.fillStyle(0x061a4a, 0.5);
        backplate.fillRoundedRect(btnX - btnW / 2, y - 22, btnW, 44, 8);
        backplate.lineStyle(1, 0x1e55b7, 0.4);
        backplate.strokeRoundedRect(btnX - btnW / 2, y - 22, btnW, 44, 8);
      }
    });
  }
}