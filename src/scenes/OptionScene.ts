import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager } from '../managers/SettingsManager';
import { SaveManager } from '../managers/SaveManager';
import { StatusManager } from '../managers/StatusManager';

type OptionItemKey =
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
  private statusManager = StatusManager.getInstance();
  private selectedIndex = 0;
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private valueTexts: Phaser.GameObjects.Text[] = [];
  private menuBackplates: Phaser.GameObjects.Graphics[] = [];
  private menuHitAreas: Phaser.GameObjects.Zone[] = [];

  // 音量スライダー
  private volumeSliders: Map<OptionItemKey, Phaser.GameObjects.Graphics> = new Map();
  private volumeSliderHitAreas: Map<OptionItemKey, Phaser.GameObjects.Zone> = new Map();
  private draggingVolumeKey: 'bgm' | 'se' | 'voice' | null = null;

  private cursorIcon!: Phaser.GameObjects.Text;
  private descText!: Phaser.GameObjects.Text;
  private backgroundGrid?: Phaser.GameObjects.Graphics;
  private backgroundOffset = 0;
  private stars: Phaser.GameObjects.Arc[] = [];

  private modalContainer?: Phaser.GameObjects.Container;
  private modalOpen = false;

  private items: OptionItem[] = [];

  constructor() {
    super('option');
  }

  preload(): void {
    this.load.audio('optSelect', '/assets/se/301(選択画面).mp3');
    this.load.audio('optConfirm', '/assets/se/302(決定音).mp3');
  }

  create(): void {
    this.modalOpen = false;
    this.selectedIndex = 0;
    this.menuTexts = [];
    this.valueTexts = [];
    this.menuBackplates = [];
    this.menuHitAreas = [];
    this.volumeSliders.clear();
    this.volumeSliderHitAreas.clear();
    this.stars = [];
    this.createBackgroundStars();
    this.setupItems();
    this.createUI();
    this.setupInput();
    this.updateSelection();
  }

  update(_time: number, delta: number): void {
    this.drawBackground(delta);
    this.updateStars(delta);
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

  private setupItems(): void {
    this.items = [
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
          this.scene.start('title', { playIntro: false });
        },
      },
    ];
  }

  private createUI(): void {
    const title = this.add.text(GAME_CONFIG.WIDTH / 2, 40, 'O P T I O N S', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '30px',
      color: '#f8f7f2',
      fontStyle: 'bold',
      stroke: '#0f172a',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(2);

    const subTitle = this.add.text(GAME_CONFIG.WIDTH / 2, 70, 'OPTION MENU', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '12px',
      color: '#22d3ee',
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(2);

    const startY = 104;
    const itemHeight = 36;
    const boxW = 720;
    const boxX = (GAME_CONFIG.WIDTH - boxW) / 2;

    this.cursorIcon = this.add.text(boxX - 18, startY, '▶', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '18px',
      color: '#f6d365',
    }).setOrigin(0.5).setDepth(2);

    this.items.forEach((item, index) => {
      const y = startY + index * itemHeight;

      const backplate = this.add.graphics().setDepth(1);
      this.menuBackplates.push(backplate);

      const hitArea = this.add.zone(GAME_CONFIG.WIDTH / 2, y, boxW, itemHeight - 4)
        .setDepth(1.5)
        .setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => {
        if (!this.modalOpen && this.selectedIndex !== index) {
          this.selectedIndex = index;
          this.updateSelection();
          this.playSound('optSelect');
        }
      });
      hitArea.on('pointerdown', () => {
        if (!this.modalOpen) {
          this.selectedIndex = index;
          this.updateSelection();
          this.executeSelect();
        }
      });
      this.menuHitAreas.push(hitArea);

      const label = this.add.text(boxX + 24, y, item.label, {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '19px',
        color: '#e2e8f0',
        stroke: '#0f172a',
        strokeThickness: 3,
      }).setOrigin(0, 0.5).setDepth(2);

      const value = this.add.text(boxX + boxW - 24, y, item.getValueText ? item.getValueText() : '', {
        fontFamily: GAME_CONFIG.FONT_FAMILY,
        fontSize: '19px',
        color: '#38bdf8',
        stroke: '#0f172a',
        strokeThickness: 3,
      }).setOrigin(1, 0.5).setDepth(2);

      // BGM / SE / ボイスの場合はスライダーを表示
      if (
        item.key === 'bgm' ||
        item.key === 'se' ||
        item.key === 'voice'
      ) {
        const sliderX = boxX + 400;
        const sliderWidth = 180;

        // スライダー本体
        const slider = this.add.graphics().setDepth(2);

        this.volumeSliders.set(item.key, slider);

        let volume = 0;

        if (item.key === 'bgm') {
          volume = this.settingsManager.bgmVolume;
        } else if (item.key === 'se') {
          volume = this.settingsManager.seVolume;
        } else {
          volume = this.settingsManager.voiceVolume;
        }

        this.drawVolumeSlider(
          slider,
          sliderX,
          y,
          sliderWidth,
          volume
        );

        // --------------------------------
        // スライダーのクリック判定
        // --------------------------------
        const sliderHitArea = this.add
          .zone(
            sliderX + sliderWidth / 2,
            y,
            sliderWidth + 20,
            30
          )
          .setDepth(3)
          .setInteractive({ useHandCursor: true });

        this.volumeSliderHitAreas.set(item.key, sliderHitArea);

        // スライダーをクリックしたとき
        sliderHitArea.on(
          'pointerdown',
          (pointer: Phaser.Input.Pointer) => {

            // 音量項目以外なら何もしない
            if (
              item.key !== 'bgm' &&
              item.key !== 'se' &&
              item.key !== 'voice'
            ) {
              return;
            }

            // 現在このスライダーをドラッグ中にする
            this.draggingVolumeKey = item.key;

            // 選択中の項目も変更
            this.selectedIndex = index;

            // クリックした位置に音量を変更
            this.updateVolumeFromPointer(
              item.key,
              pointer.x,
              sliderX,
              sliderWidth
            );

            this.updateSelection();

            // 操作音
            this.playSound('optSelect');
          }
        );

        sliderHitArea.on(
          'pointermove',
          (pointer: Phaser.Input.Pointer) => {

            // このスライダーをドラッグ中でなければ何もしない
            if (this.draggingVolumeKey !== item.key) {
              return;
            }

            // マウスボタンを押していなければ何もしない
            if (!pointer.isDown) {
              return;
            }

            // マウス位置に合わせて音量変更
            this.updateVolumeFromPointer(
              item.key,
              pointer.x,
              sliderX,
              sliderWidth
            );
          }
        );
        sliderHitArea.on(
          'pointerup',
          () => {
            this.draggingVolumeKey = null;
          }
        );

        sliderHitArea.on(
          'pointerout',
          (pointer: Phaser.Input.Pointer) => {

            // ボタンを離している場合だけドラッグ終了
            if (!pointer.isDown) {
              this.draggingVolumeKey = null;
            }
          }
        );
      }
      this.menuTexts.push(label);
      this.valueTexts.push(value);
    });

    // 説明文表示
    this.descText = this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT - 62, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '16px',
      color: '#94a3b8',
      align: 'center',
      wordWrap: { width: 700 },
    }).setOrigin(0.5).setDepth(2);

    // 操作ガイドフッター
    this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT - 22, '↑↓ / WS：選択　　←→ / AD：値変更　　ENTER / SPACE / クリック：決定　　ESC：戻る', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#64748b',
    }).setOrigin(0.5).setDepth(2);
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
        this.playSound('optConfirm');
        this.scene.start('title', { playIntro: false });
      }
    });
    // ========================================
    // 音量スライダーのドラッグ操作
    // ========================================

    this.input.on(
      'pointermove',
      (pointer: Phaser.Input.Pointer) => {

        // ドラッグ中でなければ何もしない
        if (this.draggingVolumeKey === null) {
          return;
        }

        // マウスボタンが押されていなければ終了
        if (!pointer.isDown) {
          this.draggingVolumeKey = null;
          return;
        }

        const boxW = 720;
        const boxX = (GAME_CONFIG.WIDTH - boxW) / 2;

        const sliderX = boxX + 400;
        const sliderWidth = 180;

        this.updateVolumeFromPointer(
          this.draggingVolumeKey,
          pointer.x,
          sliderX,
          sliderWidth
        );
      }
    );

    // マウスボタンを離したらドラッグ終了
    this.input.on(
      'pointerup',
      () => {
        this.draggingVolumeKey = null;
      }
    );
  }

  private navigate(delta: number): void {
    if (this.modalOpen) return;
    this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
    this.updateSelection();
    this.playSound('optSelect');
  }

  private changeValue(delta: number): void {
    if (this.modalOpen) return;
    const item = this.items[this.selectedIndex];
    if (item.onChange) {
      item.onChange(delta);
      this.refreshValues();
      this.playSound('optSelect');
    }
  }

  private executeSelect(): void {
    if (this.modalOpen) return;
    this.playSound('optConfirm');
    const item = this.items[this.selectedIndex];
    if (item.onSelect) {
      item.onSelect();
      this.refreshValues();
    }
  }

  private playSound(key: string): void {
    this.sound.play(key, { volume: this.settingsManager.seVolume / 100 });
  }

  private updateSelection(): void {
    const startY = 104;
    const itemHeight = 36;
    const boxW = 720;
    const boxX = (GAME_CONFIG.WIDTH - boxW) / 2;
    const targetY = startY + this.selectedIndex * itemHeight;

    this.cursorIcon.setY(targetY);

    this.menuTexts.forEach((text, i) => {
      const y = startY + i * itemHeight;
      const backplate = this.menuBackplates[i];
      backplate.clear();

      if (i === this.selectedIndex) {
        text.setColor('#f6d365').setFontSize(20).setStyle({ fontStyle: 'bold' });
        if (this.valueTexts[i]) this.valueTexts[i].setColor('#fde047').setFontSize(20).setStyle({ fontStyle: 'bold' });

        backplate.fillStyle(0x0d4fa6, 0.9);
        backplate.fillRoundedRect(boxX, y - (itemHeight - 4) / 2, boxW, itemHeight - 4, 8);
        backplate.lineStyle(2, 0xfacc15, 0.9);
        backplate.strokeRoundedRect(boxX, y - (itemHeight - 4) / 2, boxW, itemHeight - 4, 8);
      } else {
        text.setColor('#cbd5e1').setFontSize(19).setStyle({ fontStyle: 'normal' });
        if (this.valueTexts[i]) this.valueTexts[i].setColor('#38bdf8').setFontSize(19).setStyle({ fontStyle: 'normal' });

        backplate.fillStyle(0x061a4a, 0.5);
        backplate.fillRoundedRect(boxX, y - (itemHeight - 4) / 2, boxW, itemHeight - 4, 8);
        backplate.lineStyle(1, 0x1e55b7, 0.4);
        backplate.strokeRoundedRect(boxX, y - (itemHeight - 4) / 2, boxW, itemHeight - 4, 8);
      }
    });

    this.descText.setText(this.items[this.selectedIndex].description);
  }

  /**
   * 音量スライダーを描画する
   */
  private drawVolumeSlider(
    graphics: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    width: number,
    volume: number
  ): void {
    graphics.clear();

    // 0～100の範囲に制限
    const safeVolume = Phaser.Math.Clamp(volume, 0, 100);

    // 現在の音量からつまみのX座標を計算
    const knobX = x + (safeVolume / 100) * width;

    // スライダーの背景
    graphics.lineStyle(6, 0x334155, 1);
    graphics.lineBetween(x, y, x + width, y);

    // 現在の音量部分
    graphics.lineStyle(6, 0x38bdf8, 1);
    graphics.lineBetween(x, y, knobX, y);

    // 10%ごとの目盛り
    for (let i = 0; i <= 10; i++) {
      const tickX = x + (i / 10) * width;

      graphics.lineStyle(2, 0x94a3b8, 0.8);
      graphics.lineBetween(
        tickX,
        y - 6,
        tickX,
        y + 6
      );
    }

    // 現在位置のつまみ
    graphics.fillStyle(0xfde047, 1);
    graphics.fillCircle(knobX, y, 8);

    graphics.lineStyle(2, 0xffffff, 1);
    graphics.strokeCircle(knobX, y, 8);
  }

  /**
   * マウスのX座標から音量を変更する
   */
  private updateVolumeFromPointer(
    key: 'bgm' | 'se' | 'voice',
    pointerX: number,
    sliderX: number,
    sliderWidth: number
  ): void {

    // マウス位置をスライダーの範囲内に制限
    const clickX = Phaser.Math.Clamp(
      pointerX - sliderX,
      0,
      sliderWidth
    );

    // 0～10のどの目盛りに近いか計算
    const step = Math.round(
      (clickX / sliderWidth) * 10
    );

    // 0, 10, 20 ... 100 にする
    const newVolume = step * 10;

    // 設定を変更
    if (key === 'bgm') {
      this.settingsManager.setBgmVolume(newVolume);
    } else if (key === 'se') {
      this.settingsManager.setSeVolume(newVolume);
    } else {
      this.settingsManager.setVoiceVolume(newVolume);
    }

    // 数字とスライダーを更新
    this.refreshValues();
  }

  private refreshValues(): void {
    this.items.forEach((item, index) => {

      // 数字表示を更新
      if (this.valueTexts[index] && item.getValueText) {
        this.valueTexts[index].setText(item.getValueText());
      }

      // 音量スライダーを更新
      if (
        item.key === 'bgm' ||
        item.key === 'se' ||
        item.key === 'voice'
      ) {
        const slider = this.volumeSliders.get(item.key);

        if (!slider) {
          return;
        }

        let volume = 0;

        if (item.key === 'bgm') {
          volume = this.settingsManager.bgmVolume;
        } else if (item.key === 'se') {
          volume = this.settingsManager.seVolume;
        } else {
          volume = this.settingsManager.voiceVolume;
        }

        const startY = 104;
        const itemHeight = 36;
        const boxW = 720;
        const boxX = (GAME_CONFIG.WIDTH - boxW) / 2;

        const y = startY + index * itemHeight;

        this.drawVolumeSlider(
          slider,
          boxX + 400,
          y,
          180,
          volume
        );
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
    if (this.modalContainer) this.modalContainer.destroy();
    this.modalOpen = true;

    const container = this.add.container(0, 0).setDepth(20);
    this.modalContainer = container;

    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
    container.add(overlay);

    const boxW = 620;
    const boxH = 360;
    const boxX = (GAME_CONFIG.WIDTH - boxW) / 2;
    const boxY = (GAME_CONFIG.HEIGHT - boxH) / 2;

    const box = this.add.graphics();
    box.fillStyle(0x1e293b, 0.95);
    box.fillRoundedRect(boxX, boxY, boxW, boxH, 12);
    box.lineStyle(2, 0x38bdf8, 0.8);
    box.strokeRoundedRect(boxX, boxY, boxW, boxH, 12);
    container.add(box);

    const titleText = this.add.text(GAME_CONFIG.WIDTH / 2, boxY + 28, 'おまけ視聴 (EXTRAS)', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '22px',
      color: '#38bdf8',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    container.add(titleText);

    const bodyLines = [
      '★ オープニングアニメーション (フルバージョン)',
      '　ゲーム本編のプロローグアニメーションを視聴できます。',
      '',
      '★ 設定資料集 #01: うさこ号の秘密',
      '　うさこ号の最高速度はマッハ3！前方への集中拡散ショットを搭載。',
      '',
      '★ ボイスドラマ「うさこの日常」 (準備中)',
      '　※全ステージを難易度「難」でクリアすると完全版が解放されます！',
    ];

    const bodyText = this.add.text(boxX + 35, boxY + 58, bodyLines.join('\n'), {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '14px',
      color: '#e2e8f0',
      lineSpacing: 5,
    });
    container.add(bodyText);

    // オープニング再生ボタン
    const playOpBtnBg = this.add.graphics();
    const playOpBtnY = boxY + 245;
    playOpBtnBg.fillStyle(0x0284c7, 0.9);
    playOpBtnBg.fillRoundedRect(boxX + 130, playOpBtnY, 360, 40, 8);
    playOpBtnBg.lineStyle(1.5, 0x38bdf8, 1);
    playOpBtnBg.strokeRoundedRect(boxX + 130, playOpBtnY, 360, 40, 8);
    container.add(playOpBtnBg);

    const playOpBtn = this.add.text(GAME_CONFIG.WIDTH / 2, playOpBtnY + 20, '▶ オープニングアニメーションを再生', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '15px',
      color: '#f8fafc',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    playOpBtn.on('pointerdown', () => {
      this.closeModal();
      this.scene.start('opening', { fullOpening: true, returnScene: 'option' });
    });
    container.add(playOpBtn);

    const closeBtn = this.add.text(GAME_CONFIG.WIDTH / 2, boxY + boxH - 25, '【 閉じる (ESC / クリック) 】', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '14px',
      color: '#f6d365',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeModal());
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', () => this.closeModal());

    container.add(closeBtn);
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
      this.statusManager.clearAll();
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

    const closeBtn = this.add.text(GAME_CONFIG.WIDTH / 2, boxY + boxH + 24, '【 閉じる (ESC / クリック) 】', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '15px',
      color: '#f6d365',
      stroke: '#000',
      strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => this.closeModal());
    overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT), Phaser.Geom.Rectangle.Contains);
    overlay.on('pointerdown', () => this.closeModal());

    container.add(closeBtn);
  }

  private closeModal(): void {
    if (this.modalContainer) {
      this.playSound('optSelect');
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
    this.backgroundGrid.lineStyle(1, 0x1c4a91, 0.18);
    // 横のグリッドラインのみ描画（タイトル画面と統一）
    for (let y = 0; y < GAME_CONFIG.HEIGHT; y += 48) {
      this.backgroundGrid.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
    }
  }
}
