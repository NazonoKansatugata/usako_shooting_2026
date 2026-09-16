import Phaser from 'phaser';

type ImageAsset = readonly [key: string, url: string];
type AudioAsset = readonly [key: string, url: string];

const STAGE1_IMAGES: readonly ImageAsset[] = [
  ['player-base', 'assets/picture/player/DefineSprite_145/1.png'],
  ['player-wing-1', 'assets/picture/player/DefineSprite_149/1.png'],
  ['player-wing-3', 'assets/picture/player/DefineSprite_149/3.png'],
  ['player-hit', 'assets/picture/player/DefineSprite_168/90.png'],
  // 2人プレイ時のP2用（ねここ色）
  ['player2-base', 'assets/picture/player/DefineSprite_174/1.png'],
  ['player2-wing-1', 'assets/picture/player/DefineSprite_178/1.png'],
  ['player2-wing-3', 'assets/picture/player/DefineSprite_178/3.png'],
  ['player2-hit', 'assets/picture/player/DefineSprite_183/90.png'],
  ['dialogue-usako', 'assets/picture/player/DefineSprite_44/1.png'],
  ['dialogue-nekoko', 'assets/picture/player/DefineSprite_54/1.png'],
  ['dialogue-keroko', 'assets/picture/player/DefineSprite_190/4.png'],
  ['boss1', 'assets/picture/boss/boss1.png'],
  ['boss2', 'assets/picture/boss/boss2.png'],
  ['boss4', 'assets/picture/boss/boss4.png'],
];

const STAGE1_AUDIO: readonly AudioAsset[] = [
  ['stage_bgm', 'assets/bgm/1226(ステージテーマ).mp3'],
  ['boss_bgm', 'assets/bgm/1283(ボス出現).mp3'],
  ['se_enemy_defeat', 'assets/se/311(敵撃破音).mp3'],
  ['se_player_hit', 'assets/se/153(被弾).mp3'],
  ['se_player_game_over', 'assets/se/307(やられちゃった).mp3'],
  ['se_boss_alert', 'assets/se/1266(ボス出現アラート).mp3'],
];

const GAME_OVER_IMAGES: readonly ImageAsset[] = [
  ['game-over-illustration', 'assets/sprites/DefineSprite_1191/2.png'],
];

const GAME_OVER_AUDIO: readonly AudioAsset[] = [
  ['game-over-bgm', 'assets/bgm/残念.mp3'],
  ['gameOverSelect', 'assets/se/301(選択画面).mp3'],
  ['gameOverConfirm', 'assets/se/302(決定音).mp3'],
];

function queueAssets(scene: Phaser.Scene, images: readonly ImageAsset[], audio: readonly AudioAsset[]): void {
  images.forEach(([key, url]) => {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  });
  audio.forEach(([key, url]) => {
    if (!scene.cache.audio.exists(key)) scene.load.audio(key, url);
  });
}

/** 起動中に取得する、ステージ1のプレイ開始に必要な素材。 */
export function preloadStage1Assets(scene: Phaser.Scene): void {
  queueAssets(scene, STAGE1_IMAGES, STAGE1_AUDIO);
}

/** ステージ開始後にバックグラウンドで取得する、ゲームオーバー画面の素材。 */
export function preloadPostStageAssets(scene: Phaser.Scene): void {
  // 現在のステージ2・3はステージ1と同じランタイム生成テクスチャを利用する。
  queueAssets(scene, GAME_OVER_IMAGES, GAME_OVER_AUDIO);
}