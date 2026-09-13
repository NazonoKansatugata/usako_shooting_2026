// scene2: 本編0:01-0:03。うさことねここが望遠鏡を覗き込む
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderTelescope(context: OpeningCutContext): void {
  context.drawHorizon();
  context.drawCharacter(330, 382, '#e7edf7', 'うさこ');
  context.drawCharacter(610, 382, '#a5b7d0', 'ねここ');
  const telescope = context.scene.add.graphics();
  telescope.fillStyle(0x5f789c, 1).fillRoundedRect(397, 286, 174, 24, 12);
  telescope.fillStyle(0xdce9ff, 1).fillCircle(405, 298, 18);
  telescope.lineStyle(4, 0x5f789c, 1).lineBetween(470, 310, 445, 420).lineBetween(525, 310, 550, 420);
  context.layer.add(telescope);
  context.addText('いつもの夜。\n空を見上げる。', GAME_CONFIG.WIDTH / 2, 100, 21, '#c4d5ec');
}