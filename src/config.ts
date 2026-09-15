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
  PLAYER_FIRE_INTERVAL: 100, // 弾の連射間隔（ミリ秒）
  BOSS_HP_MULTIPLIER_2P: 2, // 2人プレイ時にボスHPへ掛ける倍率
  DEX_FIRE_INTERVAL_STEP: 6, // DEX 1Lvごとに連射間隔を短縮する量（ミリ秒）
  MIN_PLAYER_FIRE_INTERVAL: 40, // 連射間隔の下限（ミリ秒）
  WEP_DAMAGE_PER_LEVEL: 1, // WEP 1Lvごとに弾の威力（ダメージ量）が増える量
  STR_EXTRA_SHOT_EVERY: 3, // STRがこのレベル数貯まるごとに同時発射弾が1本増える
  FONT_FAMILY: "'M PLUS 1p', 'Yu Gothic', 'Meiryo', sans-serif",
  // 起動時にフルオープニング（シーン1〜9）を再生するかどうか
  ENABLE_STARTUP_FULL_OPENING: false,
} as const;
