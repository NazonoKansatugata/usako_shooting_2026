import Phaser from 'phaser';
import { GAME_CONFIG } from './config';
import { TitleScene } from './scenes/TitleScene';
import { OptionScene } from './scenes/OptionScene';
import { ShootingScene } from './scenes/ShootingScene';

new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  parent: 'game',
  backgroundColor: '#12263a',
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [TitleScene, OptionScene, ShootingScene],
});
