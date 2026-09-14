import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager, Difficulty } from '../managers/SettingsManager';
import { SaveManager } from '../managers/SaveManager';

type OptionItemKey =
  | 'difficulty'
  | 'bgm'
  | 'se'
  | 'voice'
  | 'keyconfig'
  | 'credits'
  | 'omake'
  | 'reset'
  | 'back';

interface OptionItem {
  key: OptionItemKey;
  label: string;
  description: string;
  getValueText?: () => string;
  onChange?: (delta: number) => void;
  onSelect?: () => void;
}

export class OptionScene extends Phaser.Scene {
  private settingsManager = SettingsManager.getInstance();
  private saveManager = SaveManager.getInstance();
  private selectedIndex = 0;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private valueTexts: Phaser.GameObjects.Text[] = [];
  private cursorIcon!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private backgroundGrid?: Phaser.GameObjects.Graphics;
  private backgroundOffset = 0;

  private modalContainer?: Phaser.GameObjects.Container;
  private modalOpen = false;

  private items: OptionItem[] = [];

  constructor() {
    super('option');
  }

  create(): void {
    this.modalOpen = false;
    this.selectedIndex = 0;
    this.menuTexts = [];
    this.valueTexts = [];

    this.setupItems();
    this.createUI();
    this.setupInput();
    this.updateSelection();
  }

  update(_time: number, delta: number): void {
    this.drawBackground(delta);
  }

  private setupItems(): void {
    this.items = [
      {
        key: 'difficulty',
        label: '難易度設定',
        description: 'ゲームの難易度を選択します。\n※「難」では敵や敵弾から受けるダメージが2倍になります。',
        getValueText: () => (this.settingsManager.difficulty === 'normal' ? '普通 (Normal)' : '難 (Hard) ★'),
        onChange: (delta) => {
          const current = this.settingsManager.difficulty;
          const next: Difficulty = delta > 0 ? (current === 'normal' ? 'hard' : 'normal') : (current === 'hard' ? 'normal' : 'hard');
          this.settingsManager.setDifficulty(next);
        },
        onSelect: () => {
          const next: Difficulty = this.settingsManager.difficulty === 'normal' ? 'hard' : 'normal';
          this.settingsManager.setDifficulty(next);
        },
      },
      {
        key: 'bgm',
        label: 'BGM 音量',
        description: 'ステージやボス戦で流れるBGMの音量を調整します。(0% 〜 100%)',
        getValueText: () => `${this.settingsManager.bgmVolume}%`,
        onChange: (delta) => {
          this.settingsManager.setBgmVolume(this.settingsManager.bgmVolume + delta * 10);
        },
        onSelect: () => {
          this.settingsManager.setBgmVolume((this.settingsManager.bgmVolume + 10) % 110);
        },
      },
      {
        key: 'se',
        label: 'SE 音量',
        description: '射撃音、被弾音、爆発音などの効果音音量を調整します。(0% 〜 100%)',
        getValueText: () => `${this.settingsManager.seVolume}%`,
        onChange: (delta) => {
          this.settingsManager.setSeVolume(this.settingsManager.seVolume + delta * 10);
        },
        onSelect: () => {
          this.settingsManager.setSeVolume((this.settingsManager.seVolume + 10) % 110);
        },
      },
      {
        key: 'voice',
        label: 'ボイス音量',
        description: 'ゲーム中のキャラクター会話・ボイス音量を調整します。(0% 〜 100%)',
        getValueText: () => `${this.settingsManager.voiceVolume}%`,
        onChange: (delta) => {
          this.settingsManager.setVoiceVolume(this.settingsManager.voiceVolume + delta * 10);
        },
        onSelect: () => {
          this.settingsManager.setVoiceVolume((this.settingsManager.voiceVolume + 10) % 110);
        },
      },
      {
        key: 'keyconfig',
        label: 'キーコンフィグ',
        description: 'ゲームの操作キー割り当てを確認します。',
        getValueText: () => '▶ 確認',
        onSelect: () => {
          this.showKeyConfigModal();
        },
      },
      {
        key: 'credits',
        label: 'クレジット',
        description: '開発メンバーおよびスタッフクレジットを表示します。',
        getValueText: () => '▶ 表示',
        onSelect: () => {
          this.showCreditsModal();
        },
      },
      {
        key: 'omake',
        label: 'おまけ視聴',
        description: '設定資料やキャラクターの秘密メッセージなどを閲覧します。',
        getValueText: () => '▶ 視聴',
        onSelect: () => {
          this.showOmakeModal();
        },
      },
      {
        key: 'reset',
        label: 'データ削除 (リセット)',
        description: 'ハイスコア・クリア状況・設定などすべての保存データを消去します。',
        getValueText: () => '▶ 実行',
        onSelect: () => {
          this.showResetConfirmModal();
        },
      },
      {
        key: 'back',
        label: 'タイトルへ戻る',
        description: 'オプションを終了してタイトル画面に戻ります。',
        getValueText: () => '◀ BACK',
        onSelect: () => {
          this.scene.start('title');
        },
      },
    ];
  }

  private createUI(): void {
    const title = this.add.text(GAME_CONFIG.WIDTH / 2, 45, 'O P T I O N S', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '32px',
      color: '#f8f7f2',
      stroke: '#0f172a',
      strokeThickness: 6,
    }).setOrigin(0.5);

    const subTitle = this.add.text(GAME_CONFIG.WIDTH / 2, 80, '設定メニュー', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '16px',
      color: '#94a3b8',
    }).setOrigin(0.5);

    const startY = 120;
    const itemHeight = 36;

    this.cursorIcon = this.add.text(180, startY, '▶', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '18px',
      color: '#f6d365',
    }).setOrigin(0.5);

    this.items.forEach((item, index) => {
      const y = startY + index * itemHeight;

      const label = this.add.text(210, y, item.label, {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '18px',
        color: '#e2e8f0',
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

      const value = this.add.text(GAME_CONFIG.WIDTH - 210, y, item.getValueText ? item.getValueText() : '', {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '18px',
        color: '#38bdf8',
      }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });

      label.on('pointerover', () => {
        if (!this.modalOpen) {
          this.selectedIndex = index;
          this.updateSelection();
        }
      });
      label.on('pointerdown', () => {
        if (!this.modalOpen) {
          this.selectedIndex = index;
          this.updateSelection();
          this.executeSelect();
        }
      });

      value.on('pointerdown', () => {
        if (!this.modalOpen) {
          this.selectedIndex = index;
          this.updateSelection();
          this.executeSelect();
        }
      });

      this.menuTexts.push(label);
      this.valueTexts.push(value);
    });

    // 説明文パネル
    const descPanelY = GAME_CONFIG.HEIGHT - 65;
    const descBg = this.add.graphics();
    descBg.fillStyle(0x0f172a, 0.7);
    descBg.fillRoundedRect(120, descPanelY - 24, GAME_CONFIG.WIDTH - 240, 56, 8);
    descBg.lineStyle(1, 0x334155, 0.8);
    descBg.strokeRoundedRect(120, descPanelY - 24, GAME_CONFIG.WIDTH - 240, 56, 8);

    this.descText = this.add.text(GAME_CONFIG.WIDTH / 2, descPanelY + 4, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '14px',
      color: '#94a3b8',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);

    // 操作ガイドフッター
    this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT - 12, '↑↓ / WS：選択　　←→ / AD：値変更　　ENTER / クリック：決定　　ESC：戻る', {
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

    this.input.keyboard?.on('keydown-LEFT', () => this.changeValue(-1));
    this.input.keyboard?.on('keydown-A', () => this.changeValue(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.changeValue(1));
    this.input.keyboard?.on('keydown-D', () => this.changeValue(1));

    this.input.keyboard?.on('keydown-ENTER', () => this.executeSelect());
    this.input.keyboard?.on('keydown-SPACE', () => this.executeSelect());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.modalOpen) {
        this.closeModal();
      } else {
        this.scene.start('title');
      }
    });
  }

  private navigate(delta: number): void {
    if (this.modalOpen) return;
    this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
    this.updateSelection();
  }

  private changeValue(delta: number): void {
    if (this.modalOpen) return;
    const item = this.items[this.selectedIndex];
    if (item.onChange) {
      item.onChange(delta);
      this.refreshValues();
    }
  }

  private executeSelect(): void {
    if (this.modalOpen) return;
    const item = this.items[this.selectedIndex];
    if (item.onSelect) {
      item.onSelect();
      this.refreshValues();
    }
  }

  private updateSelection(): void {
    const startY = 120;
    const itemHeight = 36;
    const targetY = startY + this.selectedIndex * itemHeight;

    this.cursorIcon.setY(targetY);

    this.menuTexts.forEach((text, i) => {
      if (i === this.selectedIndex) {
        text.setColor('#f6d365').setFontSize(20).setStyle({ fontStyle: 'bold' });
      } else {
        text.setColor('#e2e8f0').setFontSize(18).setStyle({ fontStyle: 'normal' });
      }
    });

    this.descText.setText(this.items[this.selectedIndex].description);
  }

  private refreshValues(): void {
    this.items.forEach((item, index) => {
      if (this.valueTexts[index] && item.getValueText) {
        this.valueTexts[index].setText(item.getValueText());
      }
    });
  }

  private showKeyConfigModal(): void {
    this.showModal('キーコンフィグ (操作設定)', [
      '【プレイヤー1P 操作】',
      '移動　　　： 矢印キー (↑ ↓ ← →) または [W / A / S / D]',
      'ショット　： [SPACE] キー (押しっぱなしで連射)',
      'ポーズ　　： [ESC] または [P] キー',
      '決定　　　： [ENTER] または [SPACE]',
      '',
      '※今後のアップデートでキーバインドの個別変更機能に対応予定です。',
    ]);
  }

  private showCreditsModal(): void {
    this.showModal('クレジット (CREDITS)', [
      '【新・うさこシューティング 2026】',
      '',
      '■ プロジェクトコンセプト',
      '　「撃って、避けて、しゃべる」横スクロールSTG',
      '',
      '■ 開発チーム',
      '　Game Designer & Programmer: うさこ開発チーム',
      '　Framework: Phaser 3 + TypeScript + Vite',
      '',
      '■ スペシャルサンクス',
      '　2005年・2026年 歴代うさこファンのみなさま',
    ]);
  }

  private showOmakeModal(): void {
    this.showModal('おまけ視聴 (EXTRAS)', [
      '【おまけコンテンツ】',
      '',
      '★ 設定資料集 #01: うさこ号の秘密',
      '　うさこ号の最高速度はマッハ3！前方への集中拡散ショットを搭載。',
      '',
      '★ ボイスドラマ「うさこの日常」 (準備中)',
      '　※全ステージを難易度「難」でクリアすると完全版が解放されます！',
    ]);
  }

  private showResetConfirmModal(): void {
    if (this.modalContainer) this.modalContainer.destroy();
    this.modalOpen = true;

    const container = this.add.container(0, 0).setDepth(20);
    this.modalContainer = container;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    container.add(overlay);

    const box = this.add.graphics();
    box.fillStyle(0x1e293b, 0.95);
    box.fillRoundedRect(GAME_CONFIG.WIDTH / 2 - 220, GAME_CONFIG.HEIGHT / 2 - 100, 440, 200, 12);
    box.lineStyle(2, 0xef4444, 1);
    box.strokeRoundedRect(GAME_CONFIG.WIDTH / 2 - 220, GAME_CONFIG.HEIGHT / 2 - 100, 440, 200, 12);
    container.add(box);

    const title = this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 - 60, 'セーブデータの削除', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '22px',
      color: '#ef4444',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(title);

    const msg = this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2 - 20, 'ハイスコア・クリア状況・設定など\nすべての保存データを削除しますか？(元に戻せません)', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '15px',
      color: '#e2e8f0',
      align: 'center',
    }).setOrigin(0.5);
    container.add(msg);

    const btnReset = this.add.text(GAME_CONFIG.WIDTH / 2 - 80, GAME_CONFIG.HEIGHT / 2 + 45, '【初期化する】', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '16px',
      color: '#f87171',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const btnCancel = this.add.text(GAME_CONFIG.WIDTH / 2 + 80, GAME_CONFIG.HEIGHT / 2 + 45, '【キャンセル】', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '16px',
      color: '#94a3b8',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btnReset.on('pointerdown', () => {
      this.settingsManager.resetToDefault();
      this.saveManager.clearAll();
      this.refreshValues();
      this.closeModal();
    });

    btnCancel.on('pointerdown', () => {
      this.closeModal();
    });

    container.add([btnReset, btnCancel]);
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

    const boxW = 600;
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
    this.backgroundOffset = (this.backgroundOffset + delta * 0.02) % 48;
    this.cameras.main.setBackgroundColor('#0b132b');
    if (!this.backgroundGrid) this.backgroundGrid = this.add.graphics().setDepth(-1);
    this.backgroundGrid.clear().lineStyle(1, 0x1c2541, 0.5);
    for (let x = -48 + this.backgroundOffset; x < GAME_CONFIG.WIDTH + 48; x += 48) {
      this.backgroundGrid.lineBetween(x, 0, x, GAME_CONFIG.HEIGHT);
    }
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += 48) {
      this.backgroundGrid.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
    }
  }
}
