import Phaser from 'phaser';

export interface OpeningCutContext {
  scene: Phaser.Scene;
  layer: Phaser.GameObjects.Container;
  addText: (text: string, x: number, y: number, size: number, color?: string) => Phaser.GameObjects.Text;
  drawHorizon: () => void;
  drawCharacter: (x: number, y: number, color: string, label: string) => void;
  drawGameplayFrame: () => void;
  setBackgroundColor: (color: string) => void;
}