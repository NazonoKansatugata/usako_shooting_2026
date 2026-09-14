export type GameMode = 'title' | 'playing' | 'stageClear' | 'gameOver' | 'clear';
export type Difficulty = 'normal' | 'hard';
/** 雑魚敵の見た目・当たり判定の形状。src/entities/enemies/配下の各クラスに対応する。 */
export type EnemyShape = 'triangle' | 'circle' | 'square' | 'star';

export interface DialogueItem {
  id: string;
  triggerPercent: number; // 0 ~ 100 (ステージ進行率)
  speaker: string; // 話者名 (例: "うさこ")
  text: string; // 本文
  portrait?: string; // 立ち絵・アイコンキー (将来用)
  portraitPosition?: 'left' | 'right'; // 立ち絵の左右位置 (将来用)
  voice?: string; // ボイスのサウンドキー (将来用)
  duration?: number; // 表示持続時間 (ミリ秒)
}

export interface ScenarioData {
  stageId: string;
  dialogues: DialogueItem[];
}
