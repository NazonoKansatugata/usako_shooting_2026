// scene8: 本編0:29-0:42。ゲーム画面、敵、弾幕を見せる高速カット
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderGameplay(context: OpeningCutContext): void {
  context.setBackgroundColor('#10192e');
  context.drawGameplayFrame();
  context.addText('撃って、避けて、進め。', GAME_CONFIG.WIDTH / 2, 92, 27, '#f8f7f2');
  context.addText('敵も、弾幕も、身内ネタも。', GAME_CONFIG.WIDTH / 2, 463, 18, '#a9d6e5');
}