// scene9: 本編0:42-0:43。タイトルを再表示してゲームスタートへつなぐ
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderFinalTitle(context: OpeningCutContext): void {
  context.addText('新・うさこシューティング', GAME_CONFIG.WIDTH / 2, 214, 46, '#f8f7f2');
  context.addText('2026', GAME_CONFIG.WIDTH / 2, 278, 27, '#f6d365');
  context.addText('GAME START', GAME_CONFIG.WIDTH / 2, 388, 28, '#7dd3fc');
}