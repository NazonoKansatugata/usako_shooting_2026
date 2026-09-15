export const GAME_CONFIG = {
  WIDTH: 960,
  HEIGHT: 540,
  PLAY_AREA: {
    X: 0,
    Y: 0,
    WIDTH: 960,
    HEIGHT: 420,
  },
  DIALOG_AREA: {
    X: 0,
    Y: 420,
    WIDTH: 960,
    HEIGHT: 120,
  },
  PLAYER_SPEED: 300,
  PLAYER_HP: 5,
  PLAYER_FIRE_INTERVAL: 150, // 弾の連射間隔（ミリ秒）
  BOSS_HP_MULTIPLIER_2P: 2, // 2人プレイ時にボスHPへ掛ける倍率
  FONT_FAMILY: "'M PLUS 1p', 'Yu Gothic', 'Meiryo', sans-serif",
  // 起動時にフルオープニング（シーン1〜9）を再生するかどうか
  ENABLE_STARTUP_FULL_OPENING: false,
} as const;
