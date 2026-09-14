export type GameMode = 'title' | 'playing' | 'stageClear' | 'gameOver' | 'clear';
export type Difficulty = 'normal' | 'hard';

/**
 * ダイアログの発火タイミング種別
 * - progress: 従来通りステージ進行率(triggerPercent)で発火。進行率の停止は行わない
 * - event: ステージ進行率(triggerPercent)で発火。表示中は進行率の進行を停止する（イベント進捗率停止機能）
 * - stageStart: ステージ開始直後に発火（進行率の進行を停止する）
 * - bossPre: ボス出現直前に発火。表示が終わるまでボスの出現を遅らせる
 * - bossDefeat: ボス撃破直後、ステージクリア処理に進む前に発火
 * - stageClear: ステージクリア画面表示時に発火
 */
export type DialogueTriggerType = 'progress' | 'event' | 'stageStart' | 'bossPre' | 'bossDefeat' | 'stageClear';

export interface DialogueItem {
  id: string;
  triggerType?: DialogueTriggerType; // 省略時は'progress'
  triggerPercent?: number; // 0 ~ 100 (ステージ進行率)。triggerType='progress'|'event'で使用
  eventId?: string; // 同じeventIdを持つ項目は1つのイベントとして連続再生される（triggerType='event'で使用、省略時はtriggerPercent単位でグルーピング）
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
