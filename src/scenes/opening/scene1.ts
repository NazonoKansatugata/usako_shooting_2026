// scene1: 本編0:00-0:01。うさことねここが望遠鏡を見つける前の導入
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderDedication(context: OpeningCutContext): void {
  context.addText('2026 情報技術研究部', GAME_CONFIG.WIDTH / 2, 190, 34, '#d5e5ff');
  context.addText('2006  →  2026', GAME_CONFIG.WIDTH / 2, 252, 23, '#f6d365');
  context.addText('この作品を うさこ原作者\nシンヒガシ氏・yuko氏に捧ぐ', GAME_CONFIG.WIDTH / 2, 368, 16, '#9eb4d0');
}