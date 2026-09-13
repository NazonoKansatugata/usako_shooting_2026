import Phaser from 'phaser';
import { GAME_CONFIG } from '../config';
import { SettingsManager } from '../managers/SettingsManager';
import { OPENING_TIMELINE, OpeningSegmentId, getOpeningSegment } from './opening/OpeningTimeline';
import { OpeningCutContext } from './opening/OpeningCutContext';
import { renderPrelude as renderPreludeCut } from './opening/scene0';
import { renderDedication } from './opening/scene1';
import { renderTelescope } from './opening/scene2';
import { renderMoon } from './opening/scene3';
import { renderImpact } from './opening/scene4';
import { renderTitle } from './opening/scene5';
import { renderFinalTitle } from './opening/scene9';
import { renderCharacters } from './opening/scene6';
import { renderStory } from './opening/scene7';
import { renderGameplay } from './opening/scene8';

export class OpeningScene extends Phaser.Scene {
  private openingMusic?: Phaser.Sound.BaseSound;
  private visualLayer!: Phaser.GameObjects.Container;
  private stars: Phaser.GameObjects.Arc[] = [];
  private elapsed = 0;
  private preludeElapsed = 0;
  private activeSegment: OpeningSegmentId | null = null;
  private hasStarted = false;
  private musicStarted = false;
  private prompt!: Phaser.GameObjects.Text;
  private promptBackground!: Phaser.GameObjects.Graphics;
  private progressBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super('opening');
  }

  preload(): void {
    this.load.audio('opening_bgm', 'assets/bgm/300_36-1514(オープニング).mp3');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#070b18');
    this.visualLayer = this.add.container(0, 0);
    this.createStars();
    this.createChrome();
    this.promptBackground = this.add.graphics().setDepth(19);
    this.promptBackground.fillStyle(0x0b1730, 0.92).fillRoundedRect(250, GAME_CONFIG.HEIGHT - 62, 460, 42, 8);
    this.promptBackground.lineStyle(1, 0xf6d365, 0.8).strokeRoundedRect(250, GAME_CONFIG.HEIGHT - 62, 460, 42, 8);
    this.prompt = this.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT - 41, '画面をクリック / ENTER：オープニング開始', {
      fontFamily: GAME_CONFIG.FONT_FAMILY,
      fontSize: '16px',
      color: '#f6d365',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(20);

    this.input.on('pointerdown', () => this.handlePointerDown());
    this.input.keyboard?.once('keydown-ENTER', () => this.beginOpening());
    this.input.keyboard?.on('keydown-SPACE', () => this.skipOpening());

    if (!this.sound.locked) this.beginOpening();
  }

  update(_time: number, delta: number): void {
    this.updateStars(delta);
    if (!this.hasStarted) return;

    if (!this.musicStarted) {
      this.preludeElapsed += delta / 1000;
      renderPreludeCut(this.getCutContext(), this.preludeElapsed, OPENING_TIMELINE.preludeDuration);
      if (this.preludeElapsed >= OPENING_TIMELINE.preludeDuration) this.startMusic();
      return;
    }

    const musicSeek = (this.openingMusic as Phaser.Sound.WebAudioSound | undefined)?.seek;
    const musicPosition = this.openingMusic?.isPlaying && typeof musicSeek === 'number' ? musicSeek : undefined;
    this.elapsed = Math.max(this.elapsed + delta / 1000, musicPosition ?? 0);
    this.progressBar.clear().fillStyle(0xf6d365, 0.9).fillRect(0, GAME_CONFIG.HEIGHT - 5, GAME_CONFIG.WIDTH * Math.min(this.elapsed / OPENING_TIMELINE.duration, 1), 5);

    const segment = getOpeningSegment(this.elapsed);
    if (segment !== this.activeSegment) {
      this.activeSegment = segment;
      this.renderSegment(segment);
    }
    this.animateSegment(delta);

    if (this.elapsed >= OPENING_TIMELINE.duration) this.finishOpening();
  }

  private beginOpening(): void {
    if (this.hasStarted) return;
    this.hasStarted = true;
    this.prompt.setVisible(false);
    this.promptBackground.setVisible(false);
    renderPreludeCut(this.getCutContext(), 0, OPENING_TIMELINE.preludeDuration);
  }

  private handlePointerDown(): void {
    if (!this.hasStarted) {
      this.beginOpening();
      return;
    }
    this.skipOpening();
  }

  private startMusic(): void {
    if (this.musicStarted) return;
    this.musicStarted = true;
    this.openingMusic = this.sound.add('opening_bgm', { volume: SettingsManager.getInstance().bgmVolume / 100 });
    this.openingMusic.play();
    this.elapsed = 0;
    this.activeSegment = null;
    this.renderSegment('dedication');
  }

  private skipOpening(): void {
    if (!this.hasStarted) {
      this.beginOpening();
      return;
    }
    this.finishOpening();
  }

  private finishOpening(): void {
    this.openingMusic?.stop();
    this.prompt.setVisible(false);
    this.promptBackground.setVisible(false);
    this.scene.start('title');
  }

  private renderSegment(segment: OpeningSegmentId): void {
    this.visualLayer.removeAll(true);
    const context = this.getCutContext();
    switch (segment) {
      case 'dedication': renderDedication(context); break;
      case 'telescope': renderTelescope(context); break;
      case 'moon': renderMoon(context, this.elapsed); break;
      case 'impact': renderImpact(context); break;
      case 'title': renderTitle(context); break;
      case 'characters': renderCharacters(context); break;
      case 'story': renderStory(context); break;
      case 'gameplay': renderGameplay(context); break;
      case 'final-title': renderFinalTitle(context); break;
    }
  }

  private getCutContext(): OpeningCutContext {
    return {
      scene: this,
      layer: this.visualLayer,
      addText: this.addText.bind(this),
      drawHorizon: this.drawHorizon.bind(this),
      drawCharacter: this.drawCharacter.bind(this),
      drawGameplayFrame: this.drawGameplayFrame.bind(this),
      setBackgroundColor: (color) => this.cameras.main.setBackgroundColor(color),
    };
  }

  private createStars(): void {
    for (let i = 0; i < 54; i++) {
      const star = this.add.circle(Phaser.Math.Between(0, GAME_CONFIG.WIDTH), Phaser.Math.Between(0, GAME_CONFIG.HEIGHT), Phaser.Math.FloatBetween(0.5, 2.2), i % 7 === 0 ? 0xf6d365 : 0xb9d9ff, Phaser.Math.FloatBetween(0.2, 0.75)).setDepth(-2);
      (star as any).speed = Phaser.Math.FloatBetween(0.08, 0.35);
      this.stars.push(star);
    }
  }

  private updateStars(delta: number): void {
    this.stars.forEach((star) => {
      star.x -= (star as any).speed * delta;
      if (star.x < -4) star.x = GAME_CONFIG.WIDTH + 4;
    });
  }

  private createChrome(): void {
    this.progressBar = this.add.graphics().setDepth(20);
    this.add.text(22, 18, 'INFORMATION TECHNOLOGY CLUB / 2026', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '11px', color: '#526783', letterSpacing: 2 }).setDepth(20);
    this.add.text(GAME_CONFIG.WIDTH - 22, 18, 'OPENING FILM', { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '11px', color: '#526783', letterSpacing: 2 }).setOrigin(1, 0).setDepth(20);
  }

  private addText(text: string, x: number, y: number, size: number, color = '#f8f7f2'): Phaser.GameObjects.Text {
    const object = this.add.text(x, y, text, { fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: `${size}px`, color, align: 'center', stroke: '#050914', strokeThickness: size > 30 ? 7 : 3, lineSpacing: 9 }).setOrigin(0.5);
    this.visualLayer.add(object);
    return object;
  }

  private drawHorizon(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x13233d, 1).fillRect(0, 330, GAME_CONFIG.WIDTH, 210);
    graphics.lineStyle(2, 0x3e638c, 0.65).lineBetween(0, 330, GAME_CONFIG.WIDTH, 330);
    this.visualLayer.add(graphics);
  }

  private drawCharacter(x: number, y: number, color: string, label: string): void {
    const graphics = this.add.graphics();
    const tint = Phaser.Display.Color.HexStringToColor(color).color;
    graphics.fillStyle(tint, 1).fillCircle(x, y - 85, 38).fillEllipse(x, y - 32, 72, 100);
    graphics.fillTriangle(x - 28, y - 112, x - 8, y - 175, x - 2, y - 110);
    graphics.fillTriangle(x + 28, y - 112, x + 8, y - 175, x + 2, y - 110);
    this.visualLayer.add(graphics);
    this.addText(label, x, y + 48, 18, color);
  }

  private drawGameplayFrame(): void {
    const graphics = this.add.graphics();
    graphics.lineStyle(2, 0x3e638c, 0.8).strokeRect(58, 135, 844, 270);
    graphics.fillStyle(0xf6d365, 1).fillCircle(165, 270, 18);
    graphics.fillStyle(0xff6b6b, 1).fillTriangle(760, 245, 825, 270, 760, 295);
    for (let i = 0; i < 11; i++) graphics.fillStyle(i % 2 ? 0xff6b6b : 0xf6d365, 0.9).fillCircle(270 + i * 42, 185 + (i % 3) * 44, 5);
    this.visualLayer.add(graphics);
  }

  private animateSegment(delta: number): void {
    this.visualLayer.setAlpha(Phaser.Math.Clamp(this.visualLayer.alpha + delta / 180, 0, 1));
    if (this.activeSegment === 'moon') this.visualLayer.setScale(1 + Math.sin(this.elapsed * 4) * 0.012);
    else if (this.activeSegment === 'gameplay') this.visualLayer.x = Math.sin(this.elapsed * 9) * 3;
  }
}