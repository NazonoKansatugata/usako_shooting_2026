import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { DialogueItem } from '../types';

export class DialogueWindow extends Phaser.GameObjects.Container {
  private bgGraphics: Phaser.GameObjects.Graphics;
  private monitorGraphics: Phaser.GameObjects.Graphics;
  private dialogueOverlayGraphics: Phaser.GameObjects.Graphics;

  // テキストオブジェクト（モニター用）
  private leftTitleText: Phaser.GameObjects.Text;
  private leftInfoText: Phaser.GameObjects.Text;
  private centerTitleText: Phaser.GameObjects.Text;
  private rightTitleText: Phaser.GameObjects.Text;
  private systemLogText: Phaser.GameObjects.Text;

  // 会話用要素
  private dialogueContainer: Phaser.GameObjects.Container;
  private speakerText: Phaser.GameObjects.Text;
  private messageText: Phaser.GameObjects.Text;
  private portraitImage?: Phaser.GameObjects.Image;
  private currentVoice?: Phaser.Sound.BaseSound;
  private hideTimerEvent?: Phaser.Time.TimerEvent;
  private onDialogueComplete?: () => void;

  // アニメーション用変数
  private animTime = 0;
  private radarAngle = 0;
  private systemLogs = [
    'AREA SCANNING IN PROGRESS...',
    'RADAR: NO THREATS IN BLIND SPOT',
    'WEAPON SYSTEM: READY',
    'COMMUNICATION FREQUENCY: SECURE',
    'ENGINES: OPTIMAL OUTPUT',
  ];
  private currentLogIndex = 0;
  private logChangeTimer = 0;

  constructor(scene: Phaser.Scene) {
    const area = GAME_CONFIG.DIALOG_AREA;
    super(scene, area.X, area.Y);
    scene.add.existing(this);
    this.setDepth(10);

    // 背景描画オブジェクト
    this.bgGraphics = scene.add.graphics();
    this.monitorGraphics = scene.add.graphics();
    this.dialogueOverlayGraphics = scene.add.graphics();

    this.add(this.bgGraphics);
    this.add(this.monitorGraphics);

    // 1. 左コンパートメント (機体ステータス)
    this.leftTitleText = scene.add.text(20, 10, '[ SHIP STATUS ]', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#4cc9f0',
      fontStyle: 'bold',
    });
    this.leftInfoText = scene.add.text(20, 32, 'SYS: ONLINE\nPOWER: 100%\nMODE: COMBAT', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '12px',
      color: '#a9d6e5',
      lineSpacing: 4,
    });
    this.add(this.leftTitleText);
    this.add(this.leftInfoText);

    // 2. 中央コンパートメント (レーダー & アニメーション)
    this.centerTitleText = scene.add.text(320, 10, '[ TACTICAL SCANNER ]', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#4cc9f0',
      fontStyle: 'bold',
    });
    this.add(this.centerTitleText);

    // 3. 右コンパートメント (システムログ)
    this.rightTitleText = scene.add.text(680, 10, '[ SYSTEM LOG ]', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '13px',
      color: '#4cc9f0',
      fontStyle: 'bold',
    });
    this.systemLogText = scene.add.text(680, 32, this.systemLogs[0], {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '12px',
      color: '#72efdd',
      wordWrap: { width: 250 },
      lineSpacing: 4,
    });
    this.add(this.rightTitleText);
    this.add(this.systemLogText);

    // 4. 会話表示用コンテナ
    this.dialogueContainer = scene.add.container(0, 0);
    this.add(this.dialogueOverlayGraphics);
    this.add(this.dialogueContainer);

    this.speakerText = scene.add.text(24, 12, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '18px',
      color: '#ffd166',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });
    this.messageText = scene.add.text(24, 42, '', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '17px',
      color: '#ffffff',
      lineSpacing: 6,
      wordWrap: { width: area.WIDTH - 48 },
      stroke: '#000000',
      strokeThickness: 2,
    });

    this.dialogueContainer.add(this.speakerText);
    this.dialogueContainer.add(this.messageText);
    this.dialogueContainer.setVisible(false);

    this.drawStaticBase();
  }

  private drawStaticBase(): void {
    const area = GAME_CONFIG.DIALOG_AREA;
    this.bgGraphics.clear();

    // パネル全体背景 (ダークブルー・コックピット基調)
    this.bgGraphics.fillStyle(0x0a1128, 0.95);
    this.bgGraphics.fillRect(0, 0, area.WIDTH, area.HEIGHT);

    // 上部アクセント境界線
    this.bgGraphics.fillStyle(0x4cc9f0, 1.0);
    this.bgGraphics.fillRect(0, 0, area.WIDTH, 3);

    // コンパートメントの区切り枠線
    this.bgGraphics.lineStyle(1, 0x1f4058, 0.8);
    // 左・中央区切り
    this.bgGraphics.lineBetween(180, 8, 180, area.HEIGHT - 8);
    // 中央・右区切り
    this.bgGraphics.lineBetween(660, 8, 660, area.HEIGHT - 8);

    // 外枠
    this.bgGraphics.lineStyle(1, 0x3a0ca3, 0.6);
    this.bgGraphics.strokeRect(2, 2, area.WIDTH - 4, area.HEIGHT - 4);
  }

  /**
   * 毎フレームのコックピットUI更新・波形＆レーダーアニメーション
   */
  public update(delta: number, stageProgressPercent = 0): void {
    this.animTime += delta;
    this.radarAngle += delta * 0.003;
    this.logChangeTimer += delta;

    // 3.5秒ごとにシステムログを切り替え
    if (this.logChangeTimer > 3500) {
      this.logChangeTimer = 0;
      this.currentLogIndex = (this.currentLogIndex + 1) % this.systemLogs.length;
      this.systemLogText.setText(this.systemLogs[this.currentLogIndex]);
    }

    this.monitorGraphics.clear();

    // --- 左側: サイン波形イコライザー ---
    this.monitorGraphics.lineStyle(1, 0x4ef037, 0.8);
    const startX = 20;
    const baseY = 95;
    this.monitorGraphics.beginPath();
    for (let x = 0; x < 140; x += 3) {
      const wave = Math.sin(this.animTime * 0.008 + x * 0.1) * 8;
      if (x === 0) this.monitorGraphics.moveTo(startX + x, baseY + wave);
      else this.monitorGraphics.lineTo(startX + x, baseY + wave);
    }
    this.monitorGraphics.strokePath();

    // --- 中央: 円形レーダースキャナー ---
    const radarX = 230;
    const radarY = 65;
    const radarR = 35;
    // レーダー円枠
    this.monitorGraphics.lineStyle(1, 0x4cc9f0, 0.6);
    this.monitorGraphics.strokeCircle(radarX, radarY, radarR);
    this.monitorGraphics.strokeCircle(radarX, radarY, radarR * 0.5);
    this.monitorGraphics.lineBetween(radarX - radarR, radarY, radarX + radarR, radarY);
    this.monitorGraphics.lineBetween(radarX, radarY - radarR, radarX, radarY + radarR);

    // レーダー回転針
    const rx = radarX + Math.cos(this.radarAngle) * radarR;
    const ry = radarY + Math.sin(this.radarAngle) * radarR;
    this.monitorGraphics.lineStyle(2, 0x72efdd, 0.9);
    this.monitorGraphics.lineBetween(radarX, radarY, rx, ry);

    // レーダー上のスキャン点
    const blip1X = radarX + Math.cos(this.radarAngle - 0.8) * (radarR * 0.6);
    const blip1Y = radarY + Math.sin(this.radarAngle - 0.8) * (radarR * 0.6);
    this.monitorGraphics.fillStyle(0xff4d6d, 0.8);
    this.monitorGraphics.fillCircle(blip1X, blip1Y, 3);

    // --- 中央右: プログレスバー & 波形イコライザー ---
    const barX = 320;
    const barY = 40;
    const barW = 310;
    const barH = 14;

    // プログレスバー背景
    this.monitorGraphics.fillStyle(0x12263a, 1);
    this.monitorGraphics.fillRect(barX, barY, barW, barH);
    this.monitorGraphics.lineStyle(1, 0x4cc9f0, 0.8);
    this.monitorGraphics.strokeRect(barX, barY, barW, barH);

    // プログレスゲージ
    const fillW = Math.max(0, (barW - 4) * (stageProgressPercent / 100));
    this.monitorGraphics.fillStyle(0x4361ee, 0.9);
    this.monitorGraphics.fillRect(barX + 2, barY + 2, fillW, barH - 4);

    // オシロスコープバーアニメーション (縦マルチバー)
    const eqX = 320;
    const eqY = 105;
    for (let i = 0; i < 24; i++) {
      const h = Math.abs(Math.sin(this.animTime * 0.005 + i * 0.4)) * 25 + 4;
      this.monitorGraphics.fillStyle(i % 2 === 0 ? 0x4cc9f0 : 0x72efdd, 0.7);
      this.monitorGraphics.fillRect(eqX + i * 13, eqY - h, 8, h);
    }
  }

  /**
   * 対話アイテムを表示する
   * @param onComplete 表示時間が経過し自然にクローズした時に呼ばれるコールバック（イベント連続再生の進行制御に使用）
   */
  public showDialogue(item: DialogueItem, onComplete?: () => void): void {
    if (this.hideTimerEvent) {
      this.hideTimerEvent.remove(false);
      this.hideTimerEvent = undefined;
    }
    if (this.currentVoice && this.currentVoice.isPlaying) {
      this.currentVoice.stop();
    }
    this.onDialogueComplete = onComplete;

    // 会話メッセージオーバーレイ背景の描画
    const area = GAME_CONFIG.DIALOG_AREA;
    this.dialogueOverlayGraphics.clear();
    // 半透明ダークブルーでモニターを静かにカバー
    this.dialogueOverlayGraphics.fillStyle(0x0a1128, 0.92);
    this.dialogueOverlayGraphics.fillRect(0, 0, area.WIDTH, area.HEIGHT);

    // 上部境界線 (統一シアン)
    this.dialogueOverlayGraphics.fillStyle(0x4cc9f0, 1.0);
    this.dialogueOverlayGraphics.fillRect(0, 0, area.WIDTH, 3);

    // 会話情報セット
    this.speakerText.setText(`【${item.speaker}】`);
    this.messageText.setText(item.text);

    // 立ち絵対応
    if (item.portrait && this.scene.textures.exists(item.portrait)) {
      if (!this.portraitImage) {
        this.portraitImage = this.scene.add.image(0, 0, item.portrait);
        this.dialogueContainer.add(this.portraitImage);
      } else {
        this.portraitImage.setTexture(item.portrait);
        this.portraitImage.setVisible(true);
      }

      const isRight = item.portraitPosition === 'right';
      const posX = isRight ? area.WIDTH - 60 : 50;
      this.portraitImage.setPosition(posX, area.HEIGHT / 2);

      this.messageText.setWordWrapWidth(area.WIDTH - 140);
      if (isRight) {
        this.speakerText.setX(24);
        this.messageText.setX(24);
      } else {
        this.speakerText.setX(110);
        this.messageText.setX(110);
      }
    } else {
      if (this.portraitImage) {
        this.portraitImage.setVisible(false);
      }
      this.messageText.setWordWrapWidth(area.WIDTH - 48);
      this.speakerText.setX(24);
      this.messageText.setX(24);
    }

    // ボイス再生機能
    if (item.voice && this.scene.sound.get(item.voice)) {
      this.currentVoice = this.scene.sound.add(item.voice);
      this.currentVoice.play();
    }

    this.dialogueContainer.setVisible(true);

    const duration = item.duration ?? 4000;
    this.hideTimerEvent = this.scene.time.delayedCall(duration, () => {
      this.completeDialogue();
    });
  }

  /** 表示時間経過による自然な終了。登録されたコールバックを実行してから非表示にする */
  private completeDialogue(): void {
    const callback = this.onDialogueComplete;
    this.onDialogueComplete = undefined;
    this.hideDialogueVisual();
    callback?.();
  }

  /** 外部からの強制中断用。コールバックは発火させない（シーンリセット等での使用を想定） */
  public hideDialogue(): void {
    this.onDialogueComplete = undefined;
    this.hideDialogueVisual();
  }

  private hideDialogueVisual(): void {
    if (this.hideTimerEvent) {
      this.hideTimerEvent.remove(false);
      this.hideTimerEvent = undefined;
    }
    if (this.currentVoice && this.currentVoice.isPlaying) {
      this.currentVoice.stop();
    }
    this.dialogueOverlayGraphics.clear();
    this.dialogueContainer.setVisible(false);
  }
}
