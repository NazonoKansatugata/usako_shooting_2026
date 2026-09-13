// scene3: 本編0:03-0:05。「2026」と書かれた月が降ってくる
import Phaser from 'phaser';
import { GAME_CONFIG } from '../../config';
import { OpeningCutContext } from './OpeningCutContext';

export function renderMoon(context: OpeningCutContext, elapsed: number): void {
  context.drawHorizon();
  const moon = context.scene.add.graphics();
  moon.fillStyle(0xf6d365, 1).fillCircle(GAME_CONFIG.WIDTH / 2, 210, 92);
  moon.fillStyle(0xd4a847, 0.35).fillCircle(430, 180, 15).fillCircle(526, 240, 22).fillCircle(485, 150, 9);
  context.layer.add(moon);
  context.addText('2026', GAME_CONFIG.WIDTH / 2, 202, 36, '#16233a');
  context.addText('空から、何かが降ってくる。', GAME_CONFIG.WIDTH / 2, 430, 20, '#f6d365');
  moon.y = Phaser.Math.Clamp((elapsed - 3) * 60, 0, 150);
}