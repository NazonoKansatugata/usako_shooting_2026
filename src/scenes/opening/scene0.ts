// scene0: BGM開始前のサークルロゴと原作者への献辞
import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderPrelude(context: OpeningCutContext, seconds: number, duration: number): void {
  context.layer.removeAll(true);
  context.setBackgroundColor('#070b18');
  context.layer.setAlpha(Math.min(
    Phaser.Math.Clamp(seconds * 2, 0, 1),
    Phaser.Math.Clamp((duration - seconds) * 2, 0, 1),
  ));

  const oldLogo = context.addText('2006', 360 - Math.min(seconds * 90, 175), 180, 48, '#8b9bb5');
  oldLogo.setStyle({ fontStyle: 'bold' });

  const newLogo = context.addText('2026', 600 + Math.min(seconds * 90, 175), 180, 56, '#f6d365');
  newLogo.setStyle({ fontStyle: 'bold' });

  const divider = context.scene.add.graphics();
  divider.lineStyle(2, 0x526783, 0.8).lineBetween(260, 252, 700, 252);
  context.layer.add(divider);
  context.addText('情報技術研究部', GAME_CONFIG.WIDTH / 2, 295, 23, '#d5e5ff').setStyle({ letterSpacing: 5 });
  context.addText('この作品を うさこ原作者\nシンヒガシ氏・yuko氏に捧ぐ', GAME_CONFIG.WIDTH / 2, 405, 16, '#9eb4d0');
}