import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { StatusManager, STATUS_MAX_LEVEL, StatKey } from '../managers/StatusManager';
import { PlayerVariant } from '../entities/Player';

interface StatusSceneData {
  mode: 'gameStart' | 'stageClear';
  twoPlayer: boolean;
  score?: number;
  stageNumber?: number;
}

interface StatRow {
  key: StatKey;
  label: string;
}

const STAT_ROWS: StatRow[] = [
  { key: 'wep', label: 'WEP' },
  { key: 'str', label: 'STR' },
  { key: 'def', label: 'DEF' },
  { key: 'dex', label: 'DEX' },
];

/** 「ガレージケロ」ステータス画面。ゲーム開始時・ステージクリア後に呼ばれ、
 *  敵撃破ドロップで貯めたポイントをWEP/STR/DEF/DEXへ割り振る。 */
export class StatusScene extends Phaser.Scene {
  private statusManager = StatusManager.getInstance();
  private sceneData!: StatusSceneData;
  private currentPlayer: PlayerVariant = 'p1';

  private barGraphics: Partial<Record<StatKey, Phaser.GameObjects.Graphics>> = {};
  private levelTexts: Partial<Record<StatKey, Phaser.GameObjects.Text>> = {};
  private pointsText!: Phaser.GameObjects.Text;
  private playerTabTexts: Phaser.GameObjects.Text[] = [];

  private static readonly BAR_X = 300;
  private static readonly BAR_WIDTH = 420;
  private static readonly ROW_START_Y = 210;
  private static readonly ROW_HEIGHT = 68;

  constructor() {
    super('status');
  }

  init(data: StatusSceneData): void {
    this.sceneData = data;
    this.currentPlayer = 'p1';
  }

  create(): void {
    this.barGraphics = {};
    this.levelTexts = {};
    this.playerTabTexts = [];

    this.cameras.main.setBackgroundColor('#3d3d3d');
    this.createBackgroundGrid();
    this.createHeader();
    this.createSummary();
    if (this.sceneData.twoPlayer) this.createPlayerTabs();
    this.createStatRows();
    this.createDoneButton();

    this.input.keyboard?.on('keydown-ENTER', () => this.finish());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());

    this.refresh();
  }

  private createBackgroundGrid(): void {
    const grid = this.add.graphics().setDepth(-1);
    grid.lineStyle(1, 0x555555, 0.4);
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += 40) {
      grid.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
    }
  }

  private createHeader(): void {
    const title = this.sceneData.mode === 'gameStart' ? 'ステータス' : `NEXT STAGE ${this.sceneData.stageNumber ?? ''}`;
    this.add.text(GAME_CONFIG.WIDTH / 2, 32, title, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '30px',
      color: '#f8f7f2',
      fontStyle: 'bold',
      stroke: '#12263a',
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(GAME_CONFIG.WIDTH / 2, 70, 'ここはガレージケロ！好きなようにパワーアップさせるケロ！！', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '14px',
      color: '#e2e8f0',
    }).setOrigin(0.5);
  }

  private createSummary(): void {
    const lines = [
      `Score          ${this.sceneData.score ?? 0}`,
      `Stage          ${this.sceneData.stageNumber ?? 1}`,
    ];
    this.add.text(40, 110, lines.join('\n'), {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '18px',
      color: '#fde047',
      lineSpacing: 10,
    });

    this.pointsText = this.add.text(40, 170, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '18px',
      color: '#fde047',
    });
  }

  private createPlayerTabs(): void {
    const players: PlayerVariant[] = ['p1', 'p2'];
    const labels: Record<PlayerVariant, string> = { p1: 'プレイヤー1', p2: 'プレイヤー2' };
    players.forEach((variant, index) => {
      const text = this.add.text(GAME_CONFIG.WIDTH / 2 - 100 + index * 200, 130, labels[variant], {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '20px',
        color: '#f8f7f2',
        backgroundColor: '#12263a',
        padding: { x: 16, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      text.on('pointerdown', () => {
        this.currentPlayer = variant;
        this.refresh();
      });

      this.playerTabTexts.push(text);
    });
  }

  private createStatRows(): void {
    STAT_ROWS.forEach((row, index) => {
      const y = StatusScene.ROW_START_Y + index * StatusScene.ROW_HEIGHT;

      this.add.text(40, y, row.label, {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '28px',
        color: '#f8f7f2',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5);

      const leftArrow = this.add.text(160, y, '◀', {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '26px',
        color: '#f8f7f2',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      leftArrow.on('pointerdown', () => {
        if (this.statusManager.deallocate(this.currentPlayer, row.key)) this.refresh();
      });

      const rightArrow = this.add.text(210, y, '▶', {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '26px',
        color: '#f8f7f2',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      rightArrow.on('pointerdown', () => {
        if (this.statusManager.allocate(this.currentPlayer, row.key)) this.refresh();
      });

      const bar = this.add.graphics();
      this.barGraphics[row.key] = bar;

      const levelText = this.add.text(StatusScene.BAR_X + StatusScene.BAR_WIDTH + 20, y, '', {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '18px',
        color: '#f8f7f2',
      }).setOrigin(0, 0.5);
      this.levelTexts[row.key] = levelText;
    });
  }

  private createDoneButton(): void {
    const btn = this.add.text(GAME_CONFIG.WIDTH - 90, 40, '完了', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '22px',
      color: '#12263a',
      backgroundColor: '#fde047',
      padding: { x: 20, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerdown', () => this.finish());

    this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT - 24, 'ENTER / クリック：完了', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#cbd5e1',
    }).setOrigin(0.5);
  }

  private drawStatBar(graphics: Phaser.GameObjects.Graphics, y: number, level: number): void {
    graphics.clear();
    const x = StatusScene.BAR_X;
    const width = StatusScene.BAR_WIDTH;

    graphics.fillStyle(0x555555, 1);
    graphics.fillRect(x, y - 10, width, 20);

    const filledWidth = (level / STATUS_MAX_LEVEL) * width;
    graphics.fillStyle(0xf8f7f2, 1);
    graphics.fillRect(x, y - 10, filledWidth, 20);

    graphics.lineStyle(2, 0x12263a, 1);
    graphics.strokeRect(x, y - 10, width, 20);
    for (let i = 1; i < STATUS_MAX_LEVEL; i++) {
      const tickX = x + (i / STATUS_MAX_LEVEL) * width;
      graphics.lineBetween(tickX, y - 10, tickX, y + 10);
    }
  }

  private refresh(): void {
    const status = this.statusManager.getData(this.currentPlayer);
    this.pointsText.setText(
      this.sceneData.twoPlayer
        ? `${this.currentPlayer === 'p1' ? 'P1' : 'P2'} Point     ${status.points}`
        : `Point          ${status.points}`,
    );

    STAT_ROWS.forEach((row) => {
      const y = StatusScene.ROW_START_Y + STAT_ROWS.indexOf(row) * StatusScene.ROW_HEIGHT;
      const bar = this.barGraphics[row.key]!;
      this.drawStatBar(bar, y, status[row.key]);
      this.levelTexts[row.key]!.setText(`${status[row.key]} / ${STATUS_MAX_LEVEL}`);
    });

    this.playerTabTexts.forEach((text, index) => {
      const variant: PlayerVariant = index === 0 ? 'p1' : 'p2';
      text.setBackgroundColor(variant === this.currentPlayer ? '#0d4fa6' : '#12263a');
    });
  }

  private finish(): void {
    if (this.sceneData.mode === 'gameStart') {
      this.scene.start('shooting', { twoPlayer: this.sceneData.twoPlayer });
    } else {
      this.scene.stop();
      this.scene.resume('shooting');
    }
  }
}
