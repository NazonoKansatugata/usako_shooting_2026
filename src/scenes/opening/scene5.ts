// scene5: 本編0:10-0:12。「新・うさこシューティング2026」のタイトル表示
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderTitle(context: OpeningCutContext): void {
  context.setBackgroundColor('#070b18');
  context.addText('新・うさこシューティング', GAME_CONFIG.WIDTH / 2, 245, 48, '#f8f7f2');
  context.addText('2026', GAME_CONFIG.WIDTH / 2, 310, 26, '#f6d365');
}

