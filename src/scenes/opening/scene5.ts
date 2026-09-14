// scene5: 本編0:10-0:12。「新・うさこシューティング2026」のタイトル表示
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderTitle(context: OpeningCutContext): void {
  context.setBackgroundColor('#070b18');
  context.addText('新・うさこシューティング', GAME_CONFIG.WIDTH / 2, 245, 48, '#f8f7f2');
  context.addText('2026', GAME_CONFIG.WIDTH / 2, 310, 26, '#f6d365');
  addPreparingCaption(context, 405);
}

function addPreparingCaption(context: OpeningCutContext, y: number): void {
  const band = context.scene.add.graphics();
  band.fillStyle(0x050914, 0.82).fillRect(120, y - 40, GAME_CONFIG.WIDTH - 240, 80);
  context.layer.add(band);
  context.addText('ただいま準備中', GAME_CONFIG.WIDTH / 2, y, 48, '#f6d365');
}

