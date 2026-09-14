// scene4: 本編0:05-0:10。中央で地球と月が衝突し、大爆発。うさことねここはゆっくり吹き飛ぶ
import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderImpact(context: OpeningCutContext): void {
  context.setBackgroundColor('#080b1c');

  const stars = context.scene.add.graphics().setDepth(-1);
  for (let i = 0; i < 36; i++) {
    const x = (i * 157) % GAME_CONFIG.WIDTH;
    const y = (i * 83) % GAME_CONFIG.HEIGHT;
    stars.fillStyle(i % 3 === 0 ? 0xf6d365 : 0xb9d9ff, 0.7).fillCircle(x, y, (i % 3) + 1);
  }
  context.layer.add(stars);

  // シーン開始時点で、月が大きな地球へぶつかっている。
  const earth = context.scene.add.container(410, 275).setDepth(2);
  const earthBody = context.scene.add.graphics();
  earthBody.fillStyle(0x3478c2, 1).fillCircle(0, 0, 155);
  earthBody.fillStyle(0x56b870, 0.95).fillEllipse(-45, -48, 96, 56).fillEllipse(50, 36, 112, 66).fillEllipse(-64, 65, 58, 35);
  earthBody.lineStyle(7, 0x9be7ff, 0.8).strokeCircle(0, 0, 155);
  earth.add(earthBody);

  const moon = context.scene.add.container(525, 275).setDepth(3);
  const moonBody = context.scene.add.graphics();
  moonBody.fillStyle(0xf6d365, 1).fillCircle(0, 0, 68);
  moonBody.fillStyle(0xb98e43, 0.38).fillCircle(-24, -20, 13).fillCircle(28, 22, 18).fillCircle(14, -36, 9);
  moonBody.lineStyle(5, 0xffefad, 0.9).strokeCircle(0, 0, 68);
  moon.add(moonBody);

  context.layer.add([earth, moon]);

  const explosion = context.scene.add.graphics().setDepth(4).setAlpha(0).setScale(0.15);
  explosion.fillStyle(0xffffff, 0.98).fillCircle(480, 275, 52);
  explosion.fillStyle(0xffd166, 0.95).fillCircle(480, 275, 125);
  explosion.fillStyle(0xff6b35, 0.85).fillCircle(480, 275, 190);
  context.layer.add(explosion);

  const flash = context.scene.add.rectangle(480, 275, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT, 0xffffff, 0).setDepth(10);
  context.layer.add(flash);
  context.scene.time.delayedCall(120, () => {
    earth.setVisible(false);
    moon.setVisible(false);
    createDebris(context);
  });
  context.scene.tweens.add({ targets: explosion, alpha: 1, scale: 1.35, duration: 260, ease: 'Cubic.easeOut' });
  context.scene.tweens.add({ targets: flash, alpha: 0.72, duration: 70, yoyo: true, hold: 130 });

  const usako = context.scene.add.image(405, 400, 'opening_usako_scene3_5')
    .setDisplaySize(125, 157).setAngle(12).setDepth(5);
  const nekoko = context.scene.add.image(555, 400, 'opening_nekoko_scene3_5')
    .setDisplaySize(108, 145).setAngle(-12).setDepth(5);
  context.layer.add([usako, nekoko]);
  context.scene.tweens.add({ targets: usako, x: -100, y: 330, angle: -28, duration: 4000, ease: 'Sine.easeIn' });
  context.scene.tweens.add({ targets: nekoko, x: 1060, y: 345, angle: 26, duration: 4000, ease: 'Sine.easeIn' });

  // 爆発後、画面奥からタイトルがゆっくりとアップで現れる。
  const title = context.scene.add.image(GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2, 'opening_title')
    .setDisplaySize(780, 410).setScale(0.3).setAlpha(0).setDepth(11);
  context.layer.add(title);
  context.scene.time.delayedCall(1450, () => {
    context.scene.tweens.add({
      targets: title,
      alpha: 1,
      scale: 0.5,
      duration: 1500,
      ease: 'Sine.easeOut',
    });
  });
}

function createDebris(context: OpeningCutContext): void {
  for (let i = 0; i < 30; i++) {
    const angle = (Math.PI * 2 * i) / 30;
    const distance = 80 + (i % 5) * 35;
    const shard = context.scene.add.rectangle(480, 275, 8 + (i % 4) * 3, 8 + (i % 3) * 4, i % 2 ? 0xff6b35 : 0xf6d365).setDepth(6);
    context.layer.add(shard);
    context.scene.tweens.add({
      targets: shard,
      x: 480 + Math.cos(angle) * distance,
      y: 275 + Math.sin(angle) * distance,
      angle: Phaser.Math.RadToDeg(angle) + 180,
      alpha: 0,
      duration: 1500 + (i % 4) * 180,
      ease: 'Cubic.easeOut',
    });
  }
}
