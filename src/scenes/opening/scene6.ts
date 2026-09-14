// scene6: うさこ、ねここ、けろこを各1.5秒で紹介し、最後に立ち絵が画面を覆う
import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

type CharacterProfile = {
  name: string;
  imageKey: string;
  imageX: number;
  imageY: number;
  imageWidth: number;
  imageHeight: number;
  textX: number;
  textOrigin: number;
  accentColor: string;
  description: string[];
};

const PROFILES: CharacterProfile[] = [
  {
    name: 'うさこ', imageKey: 'opening_usako_scene6_1', imageX: 260, imageY: 300,
    imageWidth: 390, imageHeight: 490, textX: 615, textOrigin: 0, accentColor: '#ff5c9a',
    description: ['いつもの世界に暮らす主人公。', 'よく分からないものは、とりあえずシバく。'],
  },
  {
    name: 'ねここ', imageKey: 'opening_nekoko_scene6_3', imageX: 700, imageY: 300,
    imageWidth: 370, imageHeight: 490, textX: 355, textOrigin: 1, accentColor: '#61b9ff',
    description: ['うさこの相棒。', '知らないものを見ても、だいたい落ち着いている。'],
  },
  {
    name: 'けろこ', imageKey: 'opening_keroko_scene6_4', imageX: 330, imageY: 300,
    imageWidth: 400, imageHeight: 400, textX: 620, textOrigin: 0, accentColor: '#75dd67',
    description: ['何かと冷静な第三の仲間。', '今回も多分、事情をよく分かっていない。'],
  },
];

export function renderCharacters(context: OpeningCutContext): void {
  context.setBackgroundColor('#ffffff');
  showProfile(context, PROFILES[0]);
  context.scene.time.delayedCall(1500, () => showProfile(context, PROFILES[1]));
  context.scene.time.delayedCall(3000, () => showProfile(context, PROFILES[2]));
  context.scene.time.delayedCall(4500, () => coverWithCharacters(context));
}

function showProfile(context: OpeningCutContext, profile: CharacterProfile): void {
  context.layer.removeAll(true);
  const backdrop = context.scene.add.graphics();
  backdrop.fillStyle(0xffffff, 1).fillRect(0, 0, GAME_CONFIG.WIDTH, GAME_CONFIG.HEIGHT);
  backdrop.fillStyle(Phaser.Display.Color.HexStringToColor(profile.accentColor).color, 0.18)
    .fillTriangle(0, 0, 640, 0, 0, GAME_CONFIG.HEIGHT);
  backdrop.fillStyle(Phaser.Display.Color.HexStringToColor(profile.accentColor).color, 1)
    .fillRect(0, 0, GAME_CONFIG.WIDTH, 14);
  context.layer.add(backdrop);

  const portrait = context.scene.add.image(profile.imageX, profile.imageY, profile.imageKey)
    .setDisplaySize(profile.imageWidth, profile.imageHeight);
  context.layer.add(portrait);

  const name = context.scene.add.text(profile.textX, 170, profile.name, {
    fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '58px', fontStyle: 'bold', color: profile.accentColor,
    stroke: '#ffffff', strokeThickness: 7,
  }).setOrigin(profile.textOrigin, 0.5).setAlpha(0);
  const body = context.scene.add.text(profile.textX, 265, profile.description.join('\n'), {
    fontFamily: GAME_CONFIG.FONT_FAMILY, fontSize: '20px', color: '#25324a', lineSpacing: 14,
    align: profile.textOrigin === 0 ? 'left' : 'right',
  }).setOrigin(profile.textOrigin, 0).setAlpha(0);
  context.layer.add([name, body]);
  context.scene.tweens.add({ targets: [name, body], alpha: 1, duration: 220, delay: 110, ease: 'Sine.easeOut' });
}

function coverWithCharacters(context: OpeningCutContext): void {
  context.layer.removeAll(true);
  context.setBackgroundColor('#f7e2eb');
  const entries = [
    { key: 'opening_usako_scene6_1', width: 185, height: 232 },
    { key: 'opening_nekoko_scene6_3', width: 170, height: 225 },
    { key: 'opening_keroko_scene6_4', width: 190, height: 190 },
  ];
  for (let index = 0; index < 75; index++) {
    context.scene.time.delayedCall(index * 7, () => {
      const entry = entries[index % entries.length];
      const portrait = context.scene.add.image(
        Phaser.Math.Between(40, GAME_CONFIG.WIDTH - 40), Phaser.Math.Between(20, GAME_CONFIG.HEIGHT - 20), entry.key,
      ).setDisplaySize(entry.width, entry.height).setAngle(Phaser.Math.Between(-14, 14));
      context.layer.add(portrait);
    });
  }
}
