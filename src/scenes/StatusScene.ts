import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { StatusManager, STATUS_MAX_LEVEL, StatKey, PlayerStatusData, costForLevel } from '../managers/StatusManager';
import { SettingsManager, Difficulty } from '../managers/SettingsManager';
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
  color: number;
  description: string;
}

const STAT_ROWS: StatRow[] = [
  { key: 'wep', label: 'WEP', color: 0xff8a3d, description: 'WEP：自弾の見た目と当たり判定が大きくなる。Lvが上がるほど弾が太くなり、敵に当てやすくなる。' },
  { key: 'str', label: 'STR', color: 0xff5d7a, description: 'STR：自機の移動速度が上がる。避けにも攻めにも使える基礎ステータス。' },
  { key: 'def', label: 'DEF', color: 0x4dd0e1, description: 'DEF：自機の最大HPが増える。ステージ開始・クリア時に全回復する。' },
  { key: 'dex', label: 'DEX', color: 0x9d7bff, description: 'DEX：被弾した際の無敵時間が伸びる。連続被弾からの生存率が上がる。' },
];

const MAX_LEVEL = STATUS_MAX_LEVEL;

/** 「ガレージケロ」ステータス画面。ゲーム開始時・ステージクリア後・ゲームオーバー後のリトライ時に呼ばれ、
 *  貯めたステータスポイントをWEP/STR/DEF/DEXへ割り振る。 */
export class StatusScene extends Phaser.Scene {
  private statusManager = StatusManager.getInstance();
  private settingsManager = SettingsManager.getInstance();
  private sceneData!: StatusSceneData;
  private currentPlayer: PlayerVariant = 'p1';
  private selectedRow = 0;

  private barGraphics: Partial<Record<StatKey, Phaser.GameObjects.Graphics>> = {};
  private rowBackplates: Partial<Record<StatKey, Phaser.GameObjects.Graphics>> = {};
  private levelTexts: Partial<Record<StatKey, Phaser.GameObjects.Text>> = {};
  private leftArrows: Partial<Record<StatKey, Phaser.GameObjects.Text>> = {};
  private rightArrows: Partial<Record<StatKey, Phaser.GameObjects.Text>> = {};
  private displayedLevel: Record<StatKey, number> = { wep: 0, str: 0, def: 0, dex: 0 };
  private levelTweens: Partial<Record<StatKey, Phaser.Tweens.Tween>> = {};
  private pointsText!: Phaser.GameObjects.Text;
  private playerTabTexts: Phaser.GameObjects.Text[] = [];
  private descText!: Phaser.GameObjects.Text;
  private difficultyButtonBg!: Phaser.GameObjects.Graphics;
  private difficultyButtonText!: Phaser.GameObjects.Text;
  private stars: Phaser.GameObjects.Arc[] = [];
  private backgroundGrid?: Phaser.GameObjects.Graphics;

  /** 右カラム（ステータス行）の開始X座標。左カラム（サマリー・マスコット）と重ならないようにする。 */
  private static readonly COL_X = 300;
  private static readonly BAR_X = StatusScene.COL_X + 150;
  private static readonly BAR_WIDTH = 380;
  private static readonly ROW_START_Y = 170;
  private static readonly ROW_HEIGHT = 58;

  constructor() {
    super('status');
  }

  init(data: StatusSceneData): void {
    this.sceneData = data;
    this.currentPlayer = 'p1';
    this.selectedRow = 0;
  }

  preload(): void {
    if (!this.cache.audio.exists('optSelect')) this.load.audio('optSelect', '/assets/se/301(選択画面).mp3');
    if (!this.cache.audio.exists('optConfirm')) this.load.audio('optConfirm', '/assets/se/302(決定音).mp3');
    if (!this.textures.exists('dialogue-keroko')) this.load.image('dialogue-keroko', 'assets/picture/player/DefineSprite_190/4.png');
  }

  create(): void {
    this.barGraphics = {};
    this.rowBackplates = {};
    this.levelTexts = {};
    this.leftArrows = {};
    this.rightArrows = {};
    this.playerTabTexts = [];
    this.stars = [];
    this.selectedRow = 0;

    const status = this.statusManager.getData(this.currentPlayer);
    STAT_ROWS.forEach((row) => { this.displayedLevel[row.key] = status[row.key]; });

    this.cameras.main.setBackgroundColor('#06143d');
    this.createBackgroundStars();
    this.createHeader();
    this.createSummaryPanel();
    this.createMascot();
    if (this.sceneData.twoPlayer) this.createPlayerTabs();
    this.createStatRows();
    this.createDoneButton();
    this.createTitleButton();
    this.createDifficultyButton();
    this.setupInput();

    this.refresh(true);
  }

  update(_time: number, delta: number): void {
    this.drawBackground(delta);
    this.updateStars(delta);
  }

  // ---------------------------------------------------------------------
  // 背景演出（OptionSceneと統一感を持たせた流れ星＋グリッド背景）
  // ---------------------------------------------------------------------

  private createBackgroundStars(): void {
    for (let i = 0; i < 40; i++) {
      const x = Phaser.Math.Between(0, GAME_CONFIG.WIDTH);
      const y = Phaser.Math.Between(0, GAME_CONFIG.HEIGHT);
      const radius = Phaser.Math.FloatBetween(1, 2.5);
      const star = this.add.circle(x, y, radius, 0xffffff, Phaser.Math.FloatBetween(0.3, 0.9)).setDepth(-1);
      (star as any).speed = Phaser.Math.FloatBetween(0.2, 0.8);
      this.stars.push(star);
    }
  }

  private updateStars(delta: number): void {
    this.stars.forEach((star) => {
      star.x -= (star as any).speed * (delta / 16);
      if (star.x < 0) {
        star.x = GAME_CONFIG.WIDTH + 5;
        star.y = Phaser.Math.Between(0, GAME_CONFIG.HEIGHT);
      }
    });
  }

  private backgroundOffset = 0;
  private drawBackground(delta: number): void {
    this.backgroundOffset = (this.backgroundOffset + delta * 0.03) % 48;
    if (!this.backgroundGrid) this.backgroundGrid = this.add.graphics().setDepth(-2);
    this.backgroundGrid.clear();
    this.backgroundGrid.fillStyle(0x06143d, 1).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    this.backgroundGrid.lineStyle(1, 0x1c4a91, 0.18);
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += 48) {
      this.backgroundGrid.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
    }
  }

  // ---------------------------------------------------------------------
  // ヘッダー・サマリー・マスコット
  // ---------------------------------------------------------------------

  /** 消えかけの蛍光灯看板をイメージしたネオン管風フォント（Google Fonts「Stick」。日本語グリフあり） */
  private static readonly NEON_FONT_FAMILY = "'Stick', 'M PLUS 1p', 'Yu Gothic', 'Meiryo', sans-serif";

  private createHeader(): void {
    const titleMap: Record<StatusSceneData['mode'], string> = {
      gameStart: 'ケロコガレージ',
      stageClear: `NEXT STAGE ${this.sceneData.stageNumber ?? ''}`,
    };

    const titleBack = this.add.graphics().setDepth(1);
    titleBack.fillStyle(0x0d4fa6, 0.35);
    titleBack.fillRoundedRect(GAME_CONFIG.WIDTH / 2 - 220, 12, 440, 46, 10);

    const isGameStart = this.sceneData.mode === 'gameStart';
    const title = titleMap[this.sceneData.mode];
    const titleText = this.add.text(GAME_CONFIG.WIDTH / 2, 35, title, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: isGameStart ? '32px' : '28px',
      color: isGameStart ? '#a19361' : '#f8f7f2', // 油色（日本の伝統色）
      fontStyle: 'bold',
      stroke: '#0f172a',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(2);

    if (isGameStart) {
      this.scheduleNeonFlicker(titleText);
      // CanvasテキストはDOM上のテキストと違いWebフォントの自動読み込みをトリガーしないため、
      // (特にGoogle FontsのCJKサブセットは)明示的にロードしてから差し替える。
      this.loadNeonFont(title).then(() => {
        if (titleText.active) titleText.setFontFamily(StatusScene.NEON_FONT_FAMILY);
      });
    }

    this.add.text(GAME_CONFIG.WIDTH / 2, 70, 'ステータスポイントを好きなように振り分けて、うさこ号をパワーアップさせよう！', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#a9d6e5',
    }).setOrigin(0.5).setDepth(2);
  }

  /**
   * Canvasへのテキスト描画はDOM表示と違いWebフォントの読み込みを自動トリガーしないため、
   * CSS Font Loading APIで明示的にロードする。Google FontsのCJKはUnicode範囲ごとの
   * サブセットに分割されているため、実際に表示する文字列を渡して該当サブセットを読ませる。
   */
  private async loadNeonFont(sampleText: string): Promise<void> {
    try {
      await document.fonts.load(`700 32px "Stick"`, sampleText);
    } catch (e) {
      console.warn('Failed to load neon font', e);
    }
  }

  /** 消えかけの蛍光灯のように、不規則な間隔で1〜3回すばやく明滅させ続ける演出。 */
  private scheduleNeonFlicker(text: Phaser.GameObjects.Text): void {
    const nextDelay = Phaser.Math.Between(200, 2400);
    this.time.delayedCall(nextDelay, () => {
      if (!text.active) return;
      this.playNeonFlickerBurst(text, () => this.scheduleNeonFlicker(text));
    });
  }

  private playNeonFlickerBurst(text: Phaser.GameObjects.Text, onComplete: () => void): void {
    const dips = Phaser.Math.Between(1, 3);
    let completed = 0;

    const runDip = () => {
      if (!text.active) return;
      this.tweens.add({
        targets: text,
        alpha: Phaser.Math.FloatBetween(0.15, 0.45),
        duration: Phaser.Math.Between(25, 70),
        ease: 'Linear',
        yoyo: true,
        onComplete: () => {
          completed += 1;
          if (completed < dips) {
            this.time.delayedCall(Phaser.Math.Between(30, 90), runDip);
          } else if (text.active) {
            text.setAlpha(1);
            onComplete();
          }
        },
      });
    };
    runDip();
  }

  private createSummaryPanel(): void {
    const panel = this.add.graphics().setDepth(1);
    panel.fillStyle(0x061a4a, 0.7);
    panel.fillRoundedRect(24, 96, 230, 118, 10);
    panel.lineStyle(1.5, 0x1e55b7, 0.8);
    panel.strokeRoundedRect(24, 96, 230, 118, 10);

    const lines = [
      `Score   ${this.sceneData.score ?? 0}`,
      `Stage   ${this.sceneData.stageNumber ?? 1}`,
    ];
    this.add.text(42, 112, lines.join('\n'), {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '16px',
      color: '#e2e8f0',
      lineSpacing: 12,
    }).setDepth(2);

    this.pointsText = this.add.text(42, 172, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '19px',
      color: '#fde047',
      fontStyle: 'bold',
    }).setDepth(2);
  }

  private createMascot(): void {
    if (this.textures.exists('dialogue-keroko')) {
      this.add.image(80, 280, 'dialogue-keroko').setDisplaySize(110, 110).setDepth(1);
    }

    const bubble = this.add.graphics().setDepth(1);
    bubble.fillStyle(0xf8f7f2, 0.92);
    bubble.fillRoundedRect(150, 240, 130, 90, 10);
    bubble.lineStyle(2, 0x12263a, 1);
    bubble.strokeRoundedRect(150, 240, 130, 90, 10);

    this.add.text(162, 252, 'ここは\nガレージケロ！\n好きなように\nパワーアップ\nさせるケロ！！', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '11px',
      color: '#12263a',
      lineSpacing: 3,
    }).setDepth(2);
  }

  // ---------------------------------------------------------------------
  // プレイヤータブ（2人プレイ時のみ）
  // ---------------------------------------------------------------------

  private createPlayerTabs(): void {
    const players: PlayerVariant[] = ['p1', 'p2'];
    const labels: Record<PlayerVariant, string> = { p1: 'プレイヤー1', p2: 'プレイヤー2' };

    players.forEach((variant, index) => {
      const x = 470 + index * 170;
      const y = 108;

      const backplate = this.add.graphics().setDepth(1);
      const hit = this.add.zone(x, y, 150, 34).setDepth(2).setInteractive({ useHandCursor: true });
      const text = this.add.text(x, y, labels[variant], {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '16px',
        color: '#f8f7f2',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(2);

      hit.on('pointerover', () => { if (this.currentPlayer !== variant) this.playSound('optSelect'); });
      hit.on('pointerdown', () => {
        if (this.currentPlayer === variant) return;
        this.currentPlayer = variant;
        this.selectedRow = 0;
        this.playSound('optSelect');
        this.refresh(true);
      });

      (text as any).__backplate = backplate;
      (text as any).__x = x;
      (text as any).__y = y;
      this.playerTabTexts.push(text);
    });
  }

  private redrawPlayerTabs(): void {
    this.playerTabTexts.forEach((text) => {
      const variant: PlayerVariant = text.text === 'プレイヤー1' ? 'p1' : 'p2';
      const backplate: Phaser.GameObjects.Graphics = (text as any).__backplate;
      const x: number = (text as any).__x;
      const y: number = (text as any).__y;
      const active = variant === this.currentPlayer;

      backplate.clear();
      backplate.fillStyle(active ? 0x0d4fa6 : 0x061a4a, active ? 0.95 : 0.5);
      backplate.fillRoundedRect(x - 75, y - 17, 150, 34, 8);
      backplate.lineStyle(active ? 2 : 1, active ? 0xfacc15 : 0x1e55b7, active ? 0.9 : 0.4);
      backplate.strokeRoundedRect(x - 75, y - 17, 150, 34, 8);
      text.setColor(active ? '#fde047' : '#cbd5e1');
    });
  }

  // ---------------------------------------------------------------------
  // ステータス行（WEP/STR/DEF/DEX）
  // ---------------------------------------------------------------------

  private createStatRows(): void {
    STAT_ROWS.forEach((row, index) => {
      const y = StatusScene.ROW_START_Y + index * StatusScene.ROW_HEIGHT;

      const backplate = this.add.graphics().setDepth(0.5);
      this.rowBackplates[row.key] = backplate;

      const rowHit = this.add.zone((StatusScene.COL_X + GAME_CONFIG.WIDTH - 40) / 2, y, GAME_CONFIG.WIDTH - 40 - StatusScene.COL_X, StatusScene.ROW_HEIGHT - 8)
        .setDepth(0.6)
        .setInteractive({ useHandCursor: true });
      rowHit.on('pointerover', () => {
        if (this.selectedRow !== index) {
          this.selectedRow = index;
          this.playSound('optSelect');
          this.refreshSelectionOnly();
        }
      });

      const badge = this.add.graphics().setDepth(1);
      badge.fillStyle(row.color, 1);
      badge.fillRoundedRect(StatusScene.COL_X, y - 18, 62, 36, 8);

      this.add.text(StatusScene.COL_X + 31, y, row.label, {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '18px',
        color: '#12263a',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(2);

      const leftArrow = this.add.text(StatusScene.COL_X + 90, y, '◀', {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '24px',
        color: '#f8f7f2',
      }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });
      leftArrow.on('pointerover', () => leftArrow.setScale(1.2));
      leftArrow.on('pointerout', () => leftArrow.setScale(1));
      leftArrow.on('pointerdown', () => {
        this.selectedRow = index;
        this.tryDeallocate(row.key);
      });
      this.leftArrows[row.key] = leftArrow;

      const rightArrow = this.add.text(StatusScene.COL_X + 136, y, '▶', {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '24px',
        color: '#f8f7f2',
      }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });
      rightArrow.on('pointerover', () => rightArrow.setScale(1.2));
      rightArrow.on('pointerout', () => rightArrow.setScale(1));
      rightArrow.on('pointerdown', () => {
        this.selectedRow = index;
        this.tryAllocate(row.key);
      });
      this.rightArrows[row.key] = rightArrow;

      const bar = this.add.graphics().setDepth(2);
      this.barGraphics[row.key] = bar;

      const levelText = this.add.text(StatusScene.BAR_X + StatusScene.BAR_WIDTH + 16, y, '', {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '17px',
        color: '#f8f7f2',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5).setDepth(2);
      this.levelTexts[row.key] = levelText;
    });

    this.descText = this.add.text(GAME_CONFIG.WIDTH / 2 + 20, StatusScene.ROW_START_Y + STAT_ROWS.length * StatusScene.ROW_HEIGHT + 6, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '16px',
      color: '#fde047',
      align: 'center',
      lineSpacing: 4,
      wordWrap: { width: 660, useAdvancedWrap: true },
    }).setOrigin(0.5, 0).setDepth(2);

    // 暗い背景に対して文字色が沈んで見づらかったため、タイトルと同じ蛍光灯風フォント＋点滅演出にする。
    // 表示内容が行ごとに変わるため、全STAT_ROWSの説明文＋コスト表記に登場しうる文字をまとめてロードする。
    this.scheduleNeonFlicker(this.descText);
    const descSampleText = `${STAT_ROWS.map((row) => row.description).join('')}次のLvまで：0123456789pt（MAX）`;
    this.loadNeonFont(descSampleText).then(() => {
      if (this.descText.active) this.descText.setFontFamily(StatusScene.NEON_FONT_FAMILY);
    });
  }

  private drawSegmentedBar(graphics: Phaser.GameObjects.Graphics, y: number, color: number, level: number): void {
    graphics.clear();
    const x = StatusScene.BAR_X;
    const width = StatusScene.BAR_WIDTH;
    const gap = 3;
    const segW = (width - gap * (MAX_LEVEL - 1)) / MAX_LEVEL;
    const filledSegments = Phaser.Math.Clamp(level, 0, MAX_LEVEL);

    for (let i = 0; i < MAX_LEVEL; i++) {
      const segX = x + i * (segW + gap);
      const filled = i < filledSegments;
      const partial = !filled && i < Math.ceil(filledSegments) && filledSegments % 1 !== 0;

      graphics.fillStyle(filled ? color : 0x2a3a55, 1);
      graphics.fillRoundedRect(segX, y - 12, segW, 24, 3);
      if (partial) {
        const partialW = segW * (filledSegments % 1);
        graphics.fillStyle(color, 1);
        graphics.fillRoundedRect(segX, y - 12, partialW, 24, 3);
      }
      graphics.lineStyle(1, 0x0f172a, 0.8);
      graphics.strokeRoundedRect(segX, y - 12, segW, 24, 3);
    }
  }

  private createDoneButton(): void {
    const btnX = GAME_CONFIG.WIDTH - 100;
    const btnY = 35;
    // Graphicsはbtnと違い原点(0,0)からの絶対座標で描画すると、setScale()が画面左上を基点に
    // 拡縮してしまいホバー時にボックスだけ位置がズレる。position(btnX, btnY)に置いた上で
    // ローカル原点(0,0)基準の相対座標で描画し、テキストと同じ中心を基点に拡縮させる。
    const btnBg = this.add.graphics().setPosition(btnX, btnY).setDepth(1);
    btnBg.fillStyle(0xfde047, 1);
    btnBg.fillRoundedRect(-65, -22, 130, 44, 10);

    const btn = this.add.text(btnX, btnY, '完了', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '22px',
      color: '#12263a',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => { btn.setScale(1.1); btnBg.setScale(1.1); });
    btn.on('pointerout', () => { btn.setScale(1); btnBg.setScale(1); });
    btn.on('pointerdown', () => this.finish());

    // 画面左下に「高難易度」ボタンを置くスペースを確保するため、通常より少し右へ寄せる
    this.add.text(GAME_CONFIG.WIDTH / 2 + 90, GAME_CONFIG.HEIGHT - 20, '↑↓：選択　←→：割り振り　ENTER / クリック：完了　　T：タイトルへ戻る', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '12px',
      color: '#64748b',
    }).setOrigin(0.5).setDepth(2);
  }

  private createDifficultyButton(): void {
    const btnX = 100;
    const btnY = GAME_CONFIG.HEIGHT - 35;
    const btnBg = this.add.graphics().setPosition(btnX, btnY).setDepth(1);
    this.difficultyButtonBg = btnBg;

    const btn = this.add.text(btnX, btnY, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '15px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });
    this.difficultyButtonText = btn;

    this.redrawDifficultyButton();

    btn.on('pointerover', () => btnBg.setScale(1.06));
    btn.on('pointerout', () => btnBg.setScale(1));
    btn.on('pointerdown', () => {
      const next: Difficulty = this.settingsManager.difficulty === 'hard' ? 'normal' : 'hard';
      this.settingsManager.setDifficulty(next);
      this.playSound('optSelect');
      this.redrawDifficultyButton();
    });
  }

  private redrawDifficultyButton(): void {
    const isHard = this.settingsManager.difficulty === 'hard';
    const bg = this.difficultyButtonBg;
    bg.clear();
    bg.fillStyle(isHard ? 0x7f1d1d : 0x1e293b, 1);
    bg.fillRoundedRect(-75, -20, 150, 40, 10);
    bg.lineStyle(1.5, isHard ? 0xf87171 : 0x64748b, 0.9);
    bg.strokeRoundedRect(-75, -20, 150, 40, 10);

    this.difficultyButtonText.setText(isHard ? '高難易度：ON' : '高難易度：OFF');
    this.difficultyButtonText.setColor(isHard ? '#fecaca' : '#cbd5e1');
  }

  private createTitleButton(): void {
    const btnX = 100;
    const btnY = 35;
    // 完了ボタンと同じ理由（Graphicsは絶対座標で描画するとsetScale()の基点が画面左上になる）で
    // ホバー時にボックスがズレていたため、position(btnX, btnY)＋ローカル原点基準の相対座標に変更。
    const btnBg = this.add.graphics().setPosition(btnX, btnY).setDepth(1);
    btnBg.fillStyle(0x1e293b, 1);
    btnBg.fillRoundedRect(-75, -20, 150, 40, 10);
    btnBg.lineStyle(1.5, 0x64748b, 0.9);
    btnBg.strokeRoundedRect(-75, -20, 150, 40, 10);

    const btn = this.add.text(btnX, btnY, 'タイトルへ戻る', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '15px',
      color: '#cbd5e1',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => { btn.setColor('#fde047'); btnBg.setScale(1.06); });
    btn.on('pointerout', () => { btn.setColor('#cbd5e1'); btnBg.setScale(1); });
    btn.on('pointerdown', () => this.returnToTitle());
  }

  // ---------------------------------------------------------------------
  // 入力・操作
  // ---------------------------------------------------------------------

  private setupInput(): void {
    this.input.keyboard?.on('keydown-UP', () => this.navigateRow(-1));
    this.input.keyboard?.on('keydown-W', () => this.navigateRow(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.navigateRow(1));
    this.input.keyboard?.on('keydown-S', () => this.navigateRow(1));
    this.input.keyboard?.on('keydown-LEFT', () => this.tryDeallocate(STAT_ROWS[this.selectedRow].key));
    this.input.keyboard?.on('keydown-A', () => this.tryDeallocate(STAT_ROWS[this.selectedRow].key));
    this.input.keyboard?.on('keydown-RIGHT', () => this.tryAllocate(STAT_ROWS[this.selectedRow].key));
    this.input.keyboard?.on('keydown-D', () => this.tryAllocate(STAT_ROWS[this.selectedRow].key));
    this.input.keyboard?.on('keydown-TAB', () => {
      if (!this.sceneData.twoPlayer) return;
      this.currentPlayer = this.currentPlayer === 'p1' ? 'p2' : 'p1';
      this.selectedRow = 0;
      this.playSound('optSelect');
      this.refresh(true);
    });
    this.input.keyboard?.on('keydown-ENTER', () => this.finish());
    this.input.keyboard?.on('keydown-ESC', () => this.finish());
    this.input.keyboard?.on('keydown-T', () => this.returnToTitle());
  }

  private navigateRow(delta: number): void {
    this.selectedRow = (this.selectedRow + delta + STAT_ROWS.length) % STAT_ROWS.length;
    this.playSound('optSelect');
    this.refreshSelectionOnly();
  }

  private tryAllocate(stat: StatKey): void {
    if (this.statusManager.allocate(this.currentPlayer, stat)) {
      this.playSound('optSelect');
      this.refresh(false);
    }
  }

  private tryDeallocate(stat: StatKey): void {
    if (this.statusManager.deallocate(this.currentPlayer, stat)) {
      this.playSound('optSelect');
      this.refresh(false);
    }
  }

  private playSound(key: string): void {
    if (this.cache.audio.exists(key)) this.sound.play(key, { volume: 0.6 });
  }

  // ---------------------------------------------------------------------
  // 再描画
  // ---------------------------------------------------------------------

  private refresh(resetTabs: boolean): void {
    const status = this.statusManager.getData(this.currentPlayer);

    const pointsLabel = this.sceneData.twoPlayer
      ? `${this.currentPlayer === 'p1' ? 'P1' : 'P2'} のポイント：${status.points}`
      : `ポイント：${status.points}`;
    this.pointsText.setText(pointsLabel);
    this.tweens.killTweensOf(this.pointsText);
    if (status.points > 0) {
      this.tweens.add({
        targets: this.pointsText,
        scale: 1.08,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      this.pointsText.setScale(1);
    }

    STAT_ROWS.forEach((row) => {
      const y = StatusScene.ROW_START_Y + STAT_ROWS.indexOf(row) * StatusScene.ROW_HEIGHT;
      const bar = this.barGraphics[row.key]!;
      const targetLevel = status[row.key];

      // this.displayedLevelは4ステータス共有の1オブジェクトのため、killTweensOf(オブジェクト全体)で
      // 止めてしまうと他のステータスの進行中tweenまで巻き込んで止まってしまう。
      // 必ずこの行専用に保持したTweenインスタンスだけをstop()する。
      this.levelTweens[row.key]?.stop();
      this.levelTweens[row.key] = this.tweens.add({
        targets: this.displayedLevel,
        [row.key]: targetLevel,
        duration: 220,
        ease: 'Cubic.easeOut',
        onUpdate: () => this.drawSegmentedBar(bar, y, row.color, this.displayedLevel[row.key]),
      });

      this.levelTexts[row.key]!.setText(`${targetLevel} / ${MAX_LEVEL}`);
      this.updateArrowState(row.key, status);
    });

    if (resetTabs && this.sceneData.twoPlayer) this.redrawPlayerTabs();
    this.refreshSelectionOnly();
  }

  private updateArrowState(stat: StatKey, status: PlayerStatusData): void {
    const left = this.leftArrows[stat]!;
    const right = this.rightArrows[stat]!;
    const canDeallocate = status[stat] > 0;
    const canAllocate = status[stat] < MAX_LEVEL && status.points >= costForLevel(status[stat]);

    left.setColor(canDeallocate ? '#f8f7f2' : '#3d4d6b');
    left.disableInteractive();
    if (canDeallocate) left.setInteractive({ useHandCursor: true });

    right.setColor(canAllocate ? '#f8f7f2' : '#3d4d6b');
    right.disableInteractive();
    if (canAllocate) right.setInteractive({ useHandCursor: true });
  }

  private refreshSelectionOnly(): void {
    STAT_ROWS.forEach((row, index) => {
      const y = StatusScene.ROW_START_Y + index * StatusScene.ROW_HEIGHT;
      const backplate = this.rowBackplates[row.key]!;
      backplate.clear();
      if (index === this.selectedRow) {
        backplate.fillStyle(0x0d4fa6, 0.35);
        backplate.fillRoundedRect(
          StatusScene.COL_X - 20,
          y - (StatusScene.ROW_HEIGHT - 8) / 2,
          GAME_CONFIG.WIDTH - 40 - StatusScene.COL_X + 20,
          StatusScene.ROW_HEIGHT - 8,
          10,
        );
      }
    });
    const selected = STAT_ROWS[this.selectedRow];
    const status = this.statusManager.getData(this.currentPlayer);
    const currentLevel = status[selected.key];
    const costHint = currentLevel >= MAX_LEVEL
      ? '（MAX）'
      : `（次のLvまで：${costForLevel(currentLevel)}pt）`;
    this.descText.setText(`${selected.description}\n${costHint}`);
  }

  private finish(): void {
    this.playSound('optConfirm');
    if (this.sceneData.mode === 'gameStart') {
      // 高難易度がONの状態でゲームを開始する場合、ステージ1からではなく即ボーナスステージ4のボス戦へ突入する
      const startAtBonusStage = this.settingsManager.difficulty === 'hard';
      this.scene.start('shooting', { twoPlayer: this.sceneData.twoPlayer, startAtBonusStage });
    } else {
      this.scene.stop();
      this.scene.resume('shooting');
    }
  }

  private returnToTitle(): void {
    this.playSound('optConfirm');
    // stageClear経由の場合、裏で一時停止中のshootingシーンが残っているため、
    // タイトルへ戻る際は明示的に停止して破棄する（gameStart経由ではshootingは未起動なので無害）。
    this.scene.stop('shooting');
    this.scene.start('title');
  }
}
