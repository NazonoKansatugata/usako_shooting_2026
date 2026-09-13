// scene4: 本編0:05-0:10。月の衝突と、2026年の謎の軍団の飛び出し
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderImpact(context: OpeningCutContext): void {
  context.setBackgroundColor('#21152b');
  const flash = context.scene.add.graphics();
  flash.fillStyle(0xf6d365, 0.18).fillCircle(GAME_CONFIG.WIDTH / 2, 275, 190);
  context.layer.add(flash);
  for (let i = 0; i < 26; i++) {
    const angle = (Math.PI * 2 * i) / 26;
    const length = 120 + (i % 4) * 34;
    const line = context.scene.add.graphics().lineStyle(3, i % 2 ? 0xff6b6b : 0xf6d365, 0.85);
    line.lineBetween(480 + Math.cos(angle) * 55, 275 + Math.sin(angle) * 55, 480 + Math.cos(angle) * length, 275 + Math.sin(angle) * length);
    context.layer.add(line);
  }
  context.addText('ドゴォォォン！！！', GAME_CONFIG.WIDTH / 2, 125, 38, '#ff8b6b');
  context.addText('隕石が割れた。\n中から「2026」があふれ出す。', GAME_CONFIG.WIDTH / 2, 445, 18, '#f8d9a0');
}