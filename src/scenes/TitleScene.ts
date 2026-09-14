import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager } from '../managers/SettingsManager';
import { SaveManager } from '../managers/SaveManager';

interface MenuItem {
  text: string;
  action: () => void;
  description: string;
}

export class TitleScene extends Phaser.Scene {
  private selectedIndex = 0;
  private menuItems: MenuItem[] = [];
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private menuBackplates: Phaser.GameObjects.Graphics[] = [];
  private menuHitAreas: Phaser.GameObjects.Zone[] = [];
  private cursorIcon!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private backgroundGrid?: Phaser.GameObjects.Graphics;
  private titleIcon?: Phaser.GameObjects.Image;
  private titleLogo?: Phaser.GameObjects.Image;
  private backgroundOffset = 0;
  private stars: Phaser.GameObjects.Arc[] = [];
  private flameParticles: Phaser.GameObjects.Arc[] = [];
  private flameTimer = 0;
  private flameBadgeX = 0;
  private flameBadgeY = 0;
  private isHardDifficulty = false;

  private modalContainer?: Phaser.GameObjects.Container;
  private modalOpen = false;

  constructor() {
    super('title');
  }

  preload(): void {
    this.load.image('titleIcon', '/assets/picture/icon.png');
    this.load.image('titleLogo', '/assets/picture/title.png');
    this.load.audio('titleSelect', '/assets/se/301(選択画面).mp3');
    this.load.audio('titleConfirm', '/assets/se/302(決定音).mp3');
  }

  create(): void {
    this.modalOpen = false;
    this.selectedIndex = 0;
    this.menuTexts = [];
    this.menuBackplates = [];
    this.menuHitAreas = [];
    this.stars = [];
    this.flameParticles = [];
    this.flameTimer = 0;

    this.isHardDifficulty = SettingsManager.getInstance().difficulty === 'hard';

    this.createBackgroundStars();
    this.createTitleVisuals();
    this.createMenu();
    this.setupInput();
    this.updateSelection();
  }

  update(_time: number, delta: number): void {
    this.drawBackground(delta);
    this.updateStars(delta);
    if (this.isHardDifficulty) {
      this.updateFlameParticles(delta);
    }
  }

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

  private createTitleVisuals(): void {
    const leftX = 270;
    const logoY = 115;

    this.titleIcon = this.add.image(726, 270, 'titleIcon')
      .setDisplaySize(438, 438)
      .setDepth(1);

    const imageGlow = this.add.graphics().setDepth(-1);
    imageGlow.fillStyle(0x0755b8, 0.2);
    imageGlow.fillCircle(726, 270, 270);
    imageGlow.fillStyle(0x22d3ee, 0.08);
    imageGlow.fillCircle(726, 270, 315);

    this.tweens.add({
      targets: this.titleIcon,
      y: 264,
      angle: { from: -1.5, to: 1.5 },
      duration: 2600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const imageFrame = this.add.graphics().setDepth(0);
    imageFrame.lineStyle(3, 0x22d3ee, 0.65);
    imageFrame.strokeCircle(726, 270, 225);
    imageFrame.lineStyle(2, 0xfacc15, 0.6);
    imageFrame.strokeCircle(726, 270, 238);

    // タイトルと副題を含んだ完成ロゴ画像
    this.titleLogo = this.add.image(leftX, logoY, 'titleLogo')
      .setDisplaySize(414, 216)
      .setDepth(2);

    this.tweens.add({
      targets: this.titleLogo,
      y: logoY + 4,
      duration: 2200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // 難易度「難」設定時の燃える「難!」表示
    if (this.isHardDifficulty) {
      this.createFlameHardBadge(leftX + 190, logoY + 56);
    }
  }

  private createFlameHardBadge(x: number, y: number): void {
    this.flameBadgeX = x;
    this.flameBadgeY = y;

    // 燃え盛る「難!」テキスト
    const hardText = this.add.text(x, y, '難 !', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '28px',
      color: '#fef08a',
      fontStyle: 'bold',
      stroke: '#dc2626',
      strokeThickness: 6,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: '#ff4500',
        blur: 10,
        stroke: true,
        fill: true,
      },
    }).setOrigin(0.5).setDepth(3);

    // 激しく揺らめくアニメーション
    this.tweens.add({
      targets: hardText,
      scaleX: 1.18,
      scaleY: 1.18,
      angle: { from: -4, to: 4 },
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateFlameParticles(delta: number): void {
    this.flameTimer += delta;
    if (this.flameTimer >= 60) {
      this.flameTimer = 0;
      // 炎の火の粉（パーティクル）を生成
      const colors = [0xff4500, 0xf97316, 0xfacc15, 0xef4444];
      const color = Phaser.Utils.Array.GetRandom(colors);
      const px = this.flameBadgeX + Phaser.Math.Between(-18, 18);
      const py = this.flameBadgeY + Phaser.Math.Between(-5, 15);
      const p = this.add.circle(px, py, Phaser.Math.Between(2, 5), color, 0.9).setDepth(2);
      (p as any).vy = Phaser.Math.FloatBetween(-0.8, -2.0);
      (p as any).vx = Phaser.Math.FloatBetween(-0.4, 0.4);
      (p as any).life = 1.0;
      this.flameParticles.push(p);
    }

    // パーティクルの更新と消滅
    for (let i = this.flameParticles.length - 1; i >= 0; i--) {
      const p = this.flameParticles[i];
      p.y += (p as any).vy * (delta / 16);
      p.x += (p as any).vx * (delta / 16);
      (p as any).life -= 0.03 * (delta / 16);
      p.setAlpha(Math.max(0, (p as any).life));
      p.setScale(Math.max(0, (p as any).life));

      if ((p as any).life <= 0) {
        p.destroy();
        this.flameParticles.splice(i, 1);
      }
    }
  }

  private createMenu(): void {
    this.menuItems = [
      {
        text: 'ゲーム開始 (1P)',
        description: '一人でステージを攻略するメインモードを開始します。',
        action: () => this.scene.start('shooting'),
      },
      {
        text: '二人プレイ (2P)',
        description: '2人で協力してステージを攻略できるモードです。',
        action: () => this.showTwoPlayerModal(),
      },
      {
        text: '遊び方 (How to Play)',
        description: '基本操作、攻撃方法、ゲームルールや敵の説明を確認します。',
        action: () => this.showHowToPlayModal(),
      },
      {        text: '記録 (Records)',
        description: 'ハイスコアやクリア状況などのプレイ記録を確認します。',
        action: () => this.showRecordsModal(),
      },
      {        text: 'オプション (Options)',
        description: '難易度、音量、キー設定、クレジットなどを変更・確認します。',
        action: () => this.scene.start('option'),
      },
    ];

    const startY = 245;
    const itemHeight = 42;

    this.add.text(132, startY - 30, 'SELECT MENU', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '12px',
      color: '#22d3ee',
      letterSpacing: 2,
    }).setOrigin(0, 0.5);

    this.cursorIcon = this.add.text(104, startY, '▶', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '20px',
      color: '#f6d365',
    }).setOrigin(0.5);

    this.menuItems.forEach((item, index) => {
      const y = startY + index * itemHeight;

      const backplate = this.add.graphics().setDepth(1);
      this.menuBackplates.push(backplate);

      const hitArea = this.add.zone(273, y, 302, 36).setDepth(1.5).setInteractive({ useHandCursor: true });
      hitArea.on('pointerover', () => this.selectMenuItem(index));
      hitArea.on('pointerdown', () => {
        this.selectMenuItem(index);
        this.executeSelect();
      });
      this.menuHitAreas.push(hitArea);

      const btn = this.add.text(132, y, item.text, {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '22px',
        color: '#e2e8f0',
        stroke: '#0f172a',
        strokeThickness: 4,
      }).setOrigin(0, 0.5).setDepth(2);

      this.menuTexts.push(btn);
    });

    // 説明文表示
    this.descText = this.add.text(270, GAME_CONFIG.HEIGHT - 62, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#94a3b8',
      align: 'center',
      wordWrap: { width: 500 },
    }).setOrigin(0.5);

    // 操作ガイド
    this.add.text(270, GAME_CONFIG.HEIGHT - 22, '↑↓ / WS：選択　　ENTER / SPACE / クリック：決定', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
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
      if (this.modalOpen) this.closeModal();
    });
  }

  private navigate(delta: number): void {
    if (this.modalOpen) return;
    this.selectedIndex = (this.selectedIndex + delta + this.menuItems.length) % this.menuItems.length;
    this.updateSelection();
    this.playSound('titleSelect');
  }

  private selectMenuItem(index: number): void {
    if (this.modalOpen) return;
    if (this.selectedIndex === index) return;

    this.selectedIndex = index;
    this.updateSelection();
    this.playSound('titleSelect');
  }

  private executeSelect(): void {
    if (this.modalOpen) return;
    this.playSound('titleConfirm');
    this.menuItems[this.selectedIndex].action();
  }

  private playSound(key: string): void {
    this.sound.play(key, { volume: SettingsManager.getInstance().seVolume / 100 });
  }

  private updateSelection(): void {
    const startY = 245;
    const itemHeight = 42;
    const targetY = startY + this.selectedIndex * itemHeight;

    this.cursorIcon.setY(targetY);

    this.menuTexts.forEach((text, i) => {
      if (i === this.selectedIndex) {
        text.setColor('#f6d365').setFontSize(24).setStyle({ fontStyle: 'bold' });
        this.menuBackplates[i].clear();
        this.menuBackplates[i].fillStyle(0x0d4fa6, 0.9);
        this.menuBackplates[i].fillRoundedRect(122, startY + i * itemHeight - 18, 302, 36, 8);
        this.menuBackplates[i].lineStyle(2, 0xfacc15, 0.9);
        this.menuBackplates[i].strokeRoundedRect(122, startY + i * itemHeight - 18, 302, 36, 8);
      } else {
        text.setColor('#cbd5e1').setFontSize(22).setStyle({ fontStyle: 'normal' });
        this.menuBackplates[i].clear();
        this.menuBackplates[i].fillStyle(0x061a4a, 0.5);
        this.menuBackplates[i].fillRoundedRect(122, startY + i * itemHeight - 18, 302, 36, 8);
        this.menuBackplates[i].lineStyle(1, 0x1e55b7, 0.4);
        this.menuBackplates[i].strokeRoundedRect(122, startY + i * itemHeight - 18, 302, 36, 8);
      }
    });

    this.descText.setText(this.menuItems[this.selectedIndex].description);
  }

  private showTwoPlayerModal(): void {
    this.showModal('二人プレイ (2 PLAYERS)', [
      '【2人協力プレイモード】',
      '',
      '現在開発中の機能です！',
      '',
      '・2人で協力して迫り来る敵ステージを攻略',
      '・2人プレイ専用の掛け合い会話演出',
      '・バランス調整とコンビネーションアタック',
      '',
      '※今後のアップデートで開放予定となります。お楽しみに！',
    ]);
  }

  private showHowToPlayModal(): void {
    this.showModal('遊び方 (HOW TO PLAY)', [
      '【基本操作】',
      '・移動　　： [↑ ↓ ← →] または [W / A / S / D] キー',
      '・ショット： [SPACE] キー (押し続けると連射)',
      '・ポーズ　： [ESC] または [P] キー',
      '',
      '【ゲームルール】',
      '・迫り来る敵をショットで撃破しながら進みましょう。',
      '・敵や敵弾に当たるとHPが減少します（HPが0になるとゲームオーバー）。',
      '・ステージ進行度が100%になると巨大ボスが出現！ボス撃破でステージクリア！',
      '・オプションで「難易度」や「音量」のカスタマイズが可能です。',
    ]);
  }

  private showRecordsModal(): void {
    const saveManager = SaveManager.getInstance();
    const describe = (difficulty: 'normal' | 'hard'): string => {
      const maxCleared = saveManager.getMaxClearedStage(difficulty);
      if (saveManager.isAllCleared(difficulty)) return 'ALL CLEAR';
      return maxCleared > 0 ? `STAGE ${maxCleared} までクリア済` : '未クリア';
    };

    this.showModal('記録 (RECORDS)', [
      `ハイスコア：${saveManager.highScore}`,
      '',
      `クリア状況（普通）：${describe('normal')}`,
      `クリア状況（難）　：${describe('hard')}`,
      '',
      '※記録はオプションの「データ削除」からいつでも消去できます。',
    ]);
  }

  private showModal(title: string, lines: string[]): void {
    if (this.modalContainer) this.modalContainer.destroy();
    this.modalOpen = true;

    const container = this.add.container(0, 0).setDepth(20);
    this.modalContainer = container;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    container.add(overlay);

    const boxW = 620;
    const boxH = 340;
    const boxX = (GAME_CONFIG.WIDTH - boxW) / 2;
    const boxY = (GAME_CONFIG.HEIGHT - boxH) / 2;

    const box = this.add.graphics();
    box.fillStyle(0x1e293b, 0.95);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 12);
    box.lineStyle(2, 0x38bdf8, 0.8);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 12);
    container.add(box);

    const titleText = this.add.text(GAME_CONFIG.WIDTH / 2, boxY + 28, title, {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '22px',
      color: '#38bdf8',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(titleText);

    const bodyText = this.add.text(boxX + 35, boxY + 65, lines.join('\n'), {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '15px',
      color: '#e2e8f0',
      lineSpacing: 6,
    });
    container.add(bodyText);

    const closeBtn = this.add.text(GAME_CONFIG.WIDTH / 2, boxY + boxH - 30, '【 閉じる (ESC / クリック) 】', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '15px',
      color: '#f6d365',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeModal());
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', () => this.closeModal());

    container.add(closeBtn);
  }

  private closeModal(): void {
    if (this.modalContainer) {
      this.modalContainer.destroy();
      this.modalContainer = undefined;
    }
    this.modalOpen = false;
  }

  private drawBackground(delta: number): void {
    this.backgroundOffset = (this.backgroundOffset + delta * 0.03) % 48;
    this.cameras.main.setBackgroundColor('#06143d');
    if (!this.backgroundGrid) this.backgroundGrid = this.add.graphics().setDepth(-2);
    this.backgroundGrid.clear();
    this.backgroundGrid.fillStyle(0x06143d, 1).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    this.backgroundGrid.fillStyle(0x0a2866, 0.38).fillRect(500, 0, GAME_CONFIG.WIDTH - 500, GAME_CONFIG.HEIGHT);
    this.backgroundGrid.fillStyle(0x03102f, 0.65).fillRect(0, 0, 500, GAME_CONFIG.HEIGHT);
    this.backgroundGrid.lineStyle(1, 0x1c4a91, 0.25);
    for (let x = -48 + this.backgroundOffset; x < GAME_CONFIG.WIDTH + 48; x += 48) {
      this.backgroundGrid.lineBetween(x, 0, x, GAME_CONFIG.HEIGHT);
    }
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += 48) {
      this.backgroundGrid.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
    }
    this.backgroundGrid.lineStyle(2, 0x38bdf8, 0.28);
    this.backgroundGrid.lineBetween(500, 38, 500, GAME_CONFIG.HEIGHT - 38);
    this.backgroundGrid.lineStyle(1, 0xf6d365, 0.25);
    this.backgroundGrid.lineBetween(524, GAME_CONFIG.HEIGHT - 42, GAME_CONFIG.WIDTH - 40, GAME_CONFIG.HEIGHT - 42);
  }
}
