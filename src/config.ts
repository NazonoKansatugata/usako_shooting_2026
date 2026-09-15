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
  PLAYER_BULLET_SPEED: 520, // 自機弾の速さ
  BOSS_HP_MULTIPLIER_2P: 2, // 2人プレイ時にボスHPへ掛ける倍率
  STR_SPEED_PER_LEVEL: 20, // STR 1Lvごとに自機の移動速度が増える量
  DEF_HP_PER_LEVEL: 1, // DEF 1Lvごとに自機の最大HPが増える量
  FAN_ANGLE_STEP_DEG: 8, // WEP/DEXの弾が複数になったときの、隣接する弾同士の角度差（度）
  FONT_FAMILY: "'M PLUS 1p', 'Yu Gothic', 'Meiryo', sans-serif",
  // 起動時にフルオープニング（シーン1〜9）を再生するかどうか
  ENABLE_STARTUP_FULL_OPENING: false,
} as const;
