// scene3: 本編0:03-0:05。青空の中で月が近づき、左右下の2人が驚きで縦に伸びる
import Phaser from 'phaser';
import { OpeningCutContext } from './OpeningCutContext';

export function renderMoon(context: OpeningCutContext, _elapsed: number): void {
  context.setBackgroundColor('#8ed8ff');

  const sky = context.scene.add.graphics().setDepth(-1);
  sky.fillStyle(0xffffff, 0.7).fillEllipse(125, 105, 170, 42).fillEllipse(830, 135, 220, 52);
  sky.fillStyle(0xffffff, 0.45).fillEllipse(460, 70, 240, 34);
  context.layer.add(sky);

  // 月は最初から画面内に置き、そこから手前へ大きく近づける。
  const moonGroup = context.scene.add.container(480, 165).setDepth(1);
  const moon = context.scene.add.graphics();
  moon.fillStyle(0xf6d365, 1).fillCircle(0, 0, 150);
  moon.fillStyle(0xd4a847, 0.35).fillCircle(-52, -34, 23).fillCircle(55, 42, 31).fillCircle(10, -68, 14);
  moonGroup.add(moon);

  const paper = context.scene.add.graphics();
  paper.fillStyle(0xfffdf5, 1).fillRect(-92, -34, 184, 88);
  paper.lineStyle(3, 0x493b2d, 1).strokeRect(-92, -34, 184, 88);
  moonGroup.add(paper);

  const notice = context.scene.add.text(0, 9, '月 (moon)\n衝突予定', {
    fontFamily: 'sans-serif',
    fontSize: '25px',
    color: '#24201c',
    fontStyle: 'bold',
    align: 'center',
  }).setOrigin(0.5);
  moonGroup.add(notice);
  context.layer.add(moonGroup);

  moonGroup.setScale(0.9);
  context.scene.tweens.add({
    targets: moonGroup,
    y: 205,
    scale: 3,
    duration: 1750,
    ease: 'Cubic.easeIn',
  });

  // 画面端に配置し、胸元より下は画面外に残したまま、驚きで全身をがたがた震わせる。
  // 元画像が小さいため、scene2と同じ表示サイズに留めて拡大によるぼやけを抑える。
  const usako = context.scene.add.image(120, 390, 'opening_usako_scene3_5')
    .setDisplaySize(300, 375).setOrigin(0.5, 0.5).setAngle(12).setDepth(2);
  const nekoko = context.scene.add.image(840, 390, 'opening_nekoko_scene3_5')
    .setDisplaySize(260, 347).setOrigin(0.5, 0.5).setAngle(-12).setDepth(2);
  context.layer.add([usako, nekoko]);

  const usakoBaseX = usako.x;
  const nekokoBaseX = nekoko.x;
  context.scene.tweens.add({
    targets: usako,
    x: { from: usakoBaseX - 14, to: usakoBaseX + 14 },
    y: { from: 374, to: 406 },
    angle: { from: 4, to: 20 },
    duration: 28,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  context.scene.tweens.add({
    targets: nekoko,
    x: { from: nekokoBaseX - 14, to: nekokoBaseX + 14 },
    y: { from: 374, to: 406 },
    angle: { from: -20, to: -4 },
    duration: 50,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}
