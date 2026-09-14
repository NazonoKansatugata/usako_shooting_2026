// scene2: 白背景。望遠鏡を見つけた後、中央の大きなレンズを左右から覗き込む
import Phaser from 'phaser';
import { OpeningCutContext } from './OpeningCutContext';

export function renderTelescope(context: OpeningCutContext): void {
  context.setBackgroundColor('#ffffff');

  const usako = context.scene.add.image(1120, 315, 'opening_usako_scene2_1').setDisplaySize(300, 375);
  const nekoko = context.scene.add.image(1320, 315, 'opening_nekoko_scene2_1').setDisplaySize(260, 347);
  let smallTelescope: Phaser.GameObjects.Graphics | undefined;
  context.layer.add([usako, nekoko]);

  context.scene.tweens.add({
    targets: usako,
    x: 520,
    duration: 430,
    ease: 'Cubic.easeOut',
  });
  context.scene.tweens.add({
    targets: nekoko,
    x: 780,
    duration: 430,
    ease: 'Cubic.easeOut',
  });

  context.scene.time.delayedCall(390, () => {
    if (!usako.active || !nekoko.active) return;
    context.scene.tweens.killTweensOf([usako, nekoko]);
    usako.setTexture('opening_usako_scene2_3');
    nekoko.setTexture('opening_nekoko_scene2_3');
    // 差し替え後は望遠鏡を見下ろすように右上へ移し、2人を隣り合わせにする。
    usako.setPosition(750, 190).setScale(1);
    nekoko.setPosition(830, 190).setScale(1.1);
    smallTelescope = createTelescope(context);
  });

  // scene2後半0.45秒。中央の大きなレンズを左右から覗き込む。
  context.scene.time.delayedCall(800, () => {
    if (!usako.active || !nekoko.active) return;
    smallTelescope?.destroy();
    context.scene.tweens.killTweensOf([usako, nekoko]);
    usako.setTexture('opening_usako_scene2_1').setDisplaySize(300, 375).setPosition(-150, 330).setDepth(2);
    nekoko.setTexture('opening_nekoko_scene2_1').setDisplaySize(260, 347).setPosition(1110, 330).setDepth(2);
    createLargeLens(context);

    context.scene.tweens.add({
      targets: usako,
      x: 345,
      duration: 450,
      ease: 'Cubic.easeOut',
    });
    context.scene.tweens.add({
      targets: nekoko,
      x: 635,
      duration: 450,
      ease: 'Cubic.easeOut',
    });
  });
}

function createTelescope(context: OpeningCutContext): Phaser.GameObjects.Graphics {
  const telescope = context.scene.add.graphics();
  telescope.fillStyle(0x6f8198, 1).fillRoundedRect(35, 415, 300, 48, 20);
  telescope.fillStyle(0xcbd5e1, 1).fillRoundedRect(55, 425, 220, 28, 12);
  telescope.fillStyle(0x34465d, 1).fillCircle(45, 439, 34);
  telescope.fillStyle(0x8ee7ff, 0.9).fillCircle(45, 439, 22);
  telescope.lineStyle(9, 0x526783, 1).lineBetween(175, 460, 125, 540).lineBetween(245, 460, 295, 540);
  telescope.lineStyle(4, 0x34465d, 1).lineBetween(210, 463, 210, 540);
  context.layer.add(telescope);
  return telescope;
}

function createLargeLens(context: OpeningCutContext): void {
  const lens = context.scene.add.graphics().setDepth(1);
  lens.fillStyle(0x9be7ff, 0.32).fillCircle(480, 282, 155);
  lens.lineStyle(16, 0x526783, 1).strokeCircle(480, 282, 155);
  lens.lineStyle(5, 0xdff8ff, 0.9).strokeCircle(480, 282, 137);
  lens.fillStyle(0xffffff, 0.35).fillEllipse(430, 225, 82, 34);
  lens.lineStyle(8, 0x34465d, 0.9).lineBetween(400, 420, 360, 540).lineBetween(560, 420, 600, 540);
  context.layer.add(lens);
}