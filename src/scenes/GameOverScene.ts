import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';

interface GameOverData {
  score?: number;
  highScore?: number;
  isNewHighScore?: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private score = 0;
  private highScore = 0;
  private isNewHighScore = false;

  constructor() {
    super('gameOver');
  }

  init(data: GameOverData): void {
    this.score = data.score ?? 0;
    this.highScore = data.highScore ?? 0;
    this.isNewHighScore = data.isNewHighScore ?? false;
  }

  preload(): void {
    this.load.image('game-over-illustration', 'assets/sprites/DefineSprite_1191/2.png');
    this.load.audio('game-over-bgm', 'assets/bgm/残念.mp3');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    this.add.rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0x000000).setOrigin(0);
    const bgm = this.sound.add('game-over-bgm', { volume: 0.65 });
    bgm.play();
    this.events.once('shutdown', () => bgm.stop());

    this.add.image(280, GAME_CONFIG.HEIGHT / 2, 'game-over-illustration')
      .setDisplaySize(390, 390);

    this.add.rectangle(500, 72, 2, 396, 0x6b7280, 0.55).setOrigin(0);

    this.add.text(730, 142, 'GAME OVER', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#f5f5f5',
      stroke: '#802333',
      strokeThickness: 7,
    }).setOrigin(0.5);

    this.add.text(730, 225, `SCORE  ${this.score}`, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '27px',
      color: '#ffd56b',
    }).setOrigin(0.5);

    const highScoreText = this.isNewHighScore
      ? 'NEW HIGH SCORE!'
      : `HIGH SCORE  ${this.highScore}`;
    this.add.text(730, 270, highScoreText, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '20px',
      color: this.isNewHighScore ? '#ff8db5' : '#cbd5e1',
    }).setOrigin(0.5);

    this.add.text(730, 395, 'ENTER: もう一度プレイ\nESC: タイトルへ', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '18px',
      color: '#d1d5db',
      align: 'center',
      lineSpacing: 10,
    }).setOrigin(0.5);

    this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('shooting'));
    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('title'));
  }
}