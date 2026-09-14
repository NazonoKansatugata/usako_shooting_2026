// scene7: 本編0:17-0:29。テロップごとに背景も切り替わる、黄色いフィルム調の回想パート
import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

const FLASHBACKS = [
  '昔々、悪いロボット軍団を倒したうさこ達',
  'ある日突然、空から隕石が降ってきた！？！？',
  '興味本位で様子を見に行くうさこ達、そこには...',
  '未来へとつながる、タイムマシンがあったのでした！',
];

export function renderStory(context: OpeningCutContext): void {
  context.setBackgroundColor('#463b1b');
  const backgroundLayer = context.scene.add.container();
  context.layer.add(backgroundLayer);
  createFilmOverlay(context);
  const captionLayer = context.scene.add.container();
  context.layer.add(captionLayer);

  showFlashback(context, backgroundLayer, captionLayer, 0);
  FLASHBACKS.slice(1).forEach((_line, index) => {
    context.scene.time.delayedCall((index + 1) * 3000, () => showFlashback(context, backgroundLayer, captionLayer, index + 1));
  });
}

function showFlashback(
  context: OpeningCutContext,
  backgroundLayer: Phaser.GameObjects.Container,
  captionLayer: Phaser.GameObjects.Container,
  index: number,
): void {
  backgroundLayer.removeAll(true);
  captionLayer.removeAll(true);
  switch (index) {
    case 0: drawRobotVictory(context, backgroundLayer); break;
    case 1: drawMeteorFall(context, backgroundLayer); break;
    case 2: drawInvestigation(context, backgroundLayer); break;
    case 3: drawTimeMachine(context, backgroundLayer); break;
  }
  drawCaption(context, captionLayer, FLASHBACKS[index]);
}

function drawRobotVictory(context: OpeningCutContext, layer: Phaser.GameObjects.Container): void {
  const ground = context.scene.add.graphics();
  ground.fillStyle(0x446b55, 1).fillRect(0, 370, GAME_CONFIG.WIDTH, 170);
  for (let index = 0; index < 8; index++) {
    const x = 90 + index * 120;
    ground.fillStyle(0x59606b, 1).fillRect(x, 230 + (index % 2) * 34, 58, 92);
    ground.fillStyle(0xff7856, 1).fillCircle(x + 29, 222 + (index % 2) * 34, 29);
    ground.lineStyle(5, 0x272d36, 1).lineBetween(x + 10, 260, x - 12, 300).lineBetween(x + 48, 260, x + 72, 300);
  }
  const usako = context.scene.add.image(315, 340, 'opening_usako_scene6_1').setDisplaySize(260, 326);
  const nekoko = context.scene.add.image(600, 340, 'opening_nekoko_scene6_3').setDisplaySize(240, 318);
  layer.add([ground, usako, nekoko]);
}

function drawMeteorFall(context: OpeningCutContext, layer: Phaser.GameObjects.Container): void {
  const sky = context.scene.add.graphics();
  sky.fillStyle(0x7dccf1, 1).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
  sky.fillStyle(0xffffff, 0.65).fillEllipse(150, 110, 210, 45).fillEllipse(760, 160, 250, 50);
  const meteor = context.scene.add.graphics();
  meteor.fillStyle(0xf6d365, 1).fillCircle(660, 155, 125);
  meteor.fillStyle(0xb98e43, 0.4).fillCircle(620, 120, 20).fillCircle(700, 190, 28);
  meteor.lineStyle(16, 0xff8a4c, 0.9).lineBetween(540, 55, 420, -80).lineBetween(575, 85, 485, -60);
  layer.add([sky, meteor]);
}

function drawInvestigation(context: OpeningCutContext, layer: Phaser.GameObjects.Container): void {
  const backdrop = context.scene.add.graphics();
  backdrop.fillStyle(0xe9edf2, 1).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
  const lens = context.scene.add.graphics();
  lens.fillStyle(0x9be7ff, 0.4).fillCircle(480, 280, 150);
  lens.lineStyle(18, 0x526783, 1).strokeCircle(480, 280, 150);
  lens.lineStyle(5, 0xe6fbff, 0.9).strokeCircle(480, 280, 132);
  const usako = context.scene.add.image(210, 355, 'opening_usako_scene2_1').setDisplaySize(300, 375);
  const nekoko = context.scene.add.image(750, 355, 'opening_nekoko_scene2_1').setDisplaySize(260, 347);
  layer.add([backdrop, lens, usako, nekoko]);
}

function drawTimeMachine(context: OpeningCutContext, layer: Phaser.GameObjects.Container): void {
  const backdrop = context.scene.add.graphics();
  backdrop.fillStyle(0x14264f, 1).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
  for (let radius = 205; radius >= 60; radius -= 36) {
    backdrop.lineStyle(11, radius % 2 === 0 ? 0x83e8ff : 0x7a81ff, 0.8).strokeCircle(480, 270, radius);
  }
  const clock = context.scene.add.text(480, 270, 'TIME\nMACHINE', {
    fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '38px', fontStyle: 'bold', color: '#e6f8ff', align: 'center',
    stroke: '#13244b', strokeThickness: 7,
  }).setOrigin(0.5);
  const logo = context.scene.add.image(760, 110, 'opening_logo_2026').setDisplaySize(155, 155).setAlpha(0.65);
  layer.add([backdrop, clock, logo]);
}

function createFilmOverlay(context: OpeningCutContext): void {
  const filter = context.scene.add.graphics().setDepth(5);
  filter.fillStyle(0xe6b83d, 0.45).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
  filter.fillStyle(0x5b4211, 0.18).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);

  const noise = context.scene.add.graphics().setDepth(6);
  for (let y = 0; y < GAME_CONFIG.HEIGHT; y += 5) {
    noise.lineStyle(1, 0x4c3810, Phaser.Math.FloatBetween(0.08, 0.25));
    noise.lineBetween(0, y, GAME_CONFIG.WIDTH, y);
  }
  for (let index = 0; index < 260; index++) {
    noise.fillStyle(Phaser.Math.Between(0x563d10, 0xffefac), Phaser.Math.FloatBetween(0.08, 0.28));
    noise.fillRect(Phaser.Math.Between(0, GAME_CONFIG.WIDTH), Phaser.Math.Between(0, GAME_CONFIG.HEIGHT), Phaser.Math.Between(1, 5), Phaser.Math.Between(1, 3));
  }
  context.layer.add([filter, noise]);
  context.scene.tweens.add({ targets: noise, alpha: { from: 0.35, to: 0.8 }, duration: 75, yoyo: true, repeat: -1 });
}

function drawCaption(context: OpeningCutContext, layer: Phaser.GameObjects.Container, text: string): void {
  const band = context.scene.add.graphics();
  band.fillStyle(0x2a1d08, 0.72).fillRect(70, 205, GAME_CONFIG.WIDTH - 140, 130);
  band.lineStyle(2, 0xffe38b, 0.75).strokeRect(70, 205, GAME_CONFIG.WIDTH - 140, 130);
  const caption = context.scene.add.text(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2, text, {
    fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '32px', color: '#fff5c8', align: 'center',
    stroke: '#4b3310', strokeThickness: 6, wordWrap: { width: GAME_CONFIG.WIDTH - 180 },
  }).setOrigin(0.5);
  layer.add([band, caption]);
}
