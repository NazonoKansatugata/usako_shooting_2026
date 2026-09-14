// scene0: BGM開始前。2006年ロゴを2026年ロゴが吹き飛ばし、最後に献辞を表示
import Phaser from 'phaser';
import { OpeningCutContext } from './OpeningCutContext';

export function renderPrelude(context: OpeningCutContext, seconds: number, duration: number): void {
  context.layer.removeAll(true);
  context.setBackgroundColor('#000000');

  // 元画像は856x265の横長ロゴなので、高さを固定せず比率を保つ。
  const oldLogo = context.scene.add.image(480, 270, 'opening_logo_2006').setDisplaySize(900, 278);
  const newLogo = context.scene.add.image(-420, 270, 'opening_logo_2026').setDisplaySize(300, 300);
  context.layer.add([oldLogo, newLogo]);

  // 2006年ロゴを見せてから、2026年ロゴが画面外から一気に突入して押し出す。
  const oldFadeIn = Phaser.Math.Clamp((seconds - 0.1) / 1.1, 0, 1);
  oldLogo.setAlpha(oldFadeIn);
  const approachProgress = Phaser.Math.Clamp((seconds - 1.55) / 0.6, 0, 1);
  const easedApproach = Phaser.Math.Clamp(1 - Math.pow(1 - approachProgress, 3), 0, 1);
  const pushProgress = Phaser.Math.Clamp((seconds - 2.15) / 0.55, 0, 1);
  const easedPush = Phaser.Math.Clamp(1 - Math.pow(1 - pushProgress, 2), 0, 1);
  // 2026ロゴの右端が旧ロゴの左端に届くまで、旧ロゴは動かさない。
  newLogo.x = approachProgress < 1
    ? Phaser.Math.Linear(-420, 105, easedApproach)
    : Phaser.Math.Linear(105, 480, easedPush);
  oldLogo.x = Phaser.Math.Linear(480, 1320, easedPush);
  const impactProgress = Math.max(approachProgress, pushProgress);
  newLogo.setAlpha(Phaser.Math.Clamp(impactProgress * 2.5, 0, 1));

  // 衝突後、新ロゴを約1.5秒見せてから両方を消す。
  const logoFade = Phaser.Math.Clamp((seconds - 4.15) / 0.65, 0, 1);
  oldLogo.setAlpha(oldFadeIn * (1 - logoFade));
  newLogo.setAlpha(Phaser.Math.Clamp(impactProgress * 2.5, 0, 1) * (1 - logoFade));

  const dedicationFadeIn = Phaser.Math.Clamp((seconds - 4.95) / 0.8, 0, 1);
  const dedicationFadeOut = Phaser.Math.Clamp((duration - seconds) / 1.5, 0, 1);
  const dedication = context.addText('スペシャルさんくす うさこ原作者\nシンヒガシ氏・yuko氏', 480, 270, 19, '#f4f4f4');
  dedication.setAlpha(dedicationFadeIn * dedicationFadeOut);
}