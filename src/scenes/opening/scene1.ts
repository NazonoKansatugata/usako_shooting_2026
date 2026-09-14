// scene1: BGM開始直後。歌詞「are you ready?」に合わせて文字を表示
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderDedication(context: OpeningCutContext): void {
  context.setBackgroundColor('#ffffff');
  const text = context.addText('are you ready?', GAME_CONFIG.WIDTH / 2, GAME_CONFIG.HEIGHT / 2, 92, '#ff3f91');
  text.setStroke('#ffc1d9', 6);
  text.setScale(0.04, 1).setAngle(-3);
  text.setShadow(0, 0, '#ff9ac2', 18, true, true);

  // 歌詞の一撃に合わせ、文字が横方向へ一気に伸びる。
  context.scene.tweens.add({
    targets: text,
    scaleX: { from: 0.04, to: 1.18 },
    scaleY: { from: 1, to: 1.04 },
    angle: { from: -3, to: 0 },
    duration: 420,
    ease: 'Expo.easeOut',
    onComplete: () => {
      context.scene.tweens.add({
        targets: text,
        scaleX: 1,
        scaleY: 1,
        x: { from: GAME_CONFIG.WIDTH / 2 - 12, to: GAME_CONFIG.WIDTH / 2 + 12 },
        duration: 90,
        yoyo: true,
        repeat: 2,
        ease: 'Sine.easeInOut',
      });
    },
  });
}