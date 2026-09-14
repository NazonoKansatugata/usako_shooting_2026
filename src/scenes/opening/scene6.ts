// scene6: 本編0:12-0:17。うさこ、ねここ、けろこのキャラクター紹介
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderCharacters(context: OpeningCutContext): void {
  context.addText('CHARACTERS', GAME_CONFIG.WIDTH / 2, 82, 18, '#f6d365');
  context.drawCharacter(245, 310, '#f6d365', 'うさこ');
  context.drawCharacter(480, 310, '#b9d9ff', 'ねここ');
  context.drawCharacter(715, 310, '#ff9f9f', 'けろこ');
  context.addText('よく分からないけど、\nシバきに行こう。', GAME_CONFIG.WIDTH / 2, 445, 22, '#e3ecfb');
  addPreparingCaption(context, 500);
}

function addPreparingCaption(context: OpeningCutContext, y: number): void {
  const band = context.scene.add.graphics();
  band.fillStyle(0x050914, 0.82).fillRect(120, y - 40, GAME_CONFIG.WIDTH - 240, 80);
  context.layer.add(band);
  context.addText('ただいま準備中', GAME_CONFIG.WIDTH / 2, y, 48, '#f6d365');
}