// scene7: 本編0:17-0:29。2026の謎の軍団と今回の事件のあらすじ
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderStory(context: OpeningCutContext): void {
  context.addText('STORY', GAME_CONFIG.WIDTH / 2, 82, 18, '#f6d365');
  context.addText('いつもの世界に、\n突然「2026」が落ちてきた。', GAME_CONFIG.WIDTH / 2, 190, 34, '#f8f7f2');
  context.addText('隕石から飛び出した、謎の軍団。\n意味の分からない道具、流行、身内ネタ。\nうさこたちには、ただの「変なやつら」。', GAME_CONFIG.WIDTH / 2, 335, 18, '#a9c0dc');
  context.addText('知らん。\nでも、シバく。', GAME_CONFIG.WIDTH / 2, 458, 23, '#ffca7a');
  addPreparingCaption(context, 92);
}

function addPreparingCaption(context: OpeningCutContext, y: number): void {
  const band = context.scene.add.graphics();
  band.fillStyle(0x050914, 0.82).fillRect(120, y - 40, GAME_CONFIG.WIDTH - 240, 80);
  context.layer.add(band);
  context.addText('ただいま準備中', GAME_CONFIG.WIDTH / 2, y, 48, '#f6d365');
}