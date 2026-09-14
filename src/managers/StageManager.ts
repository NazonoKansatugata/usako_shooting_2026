import stage01 from '../data/stages/stage01.json';
import stage02 from '../data/stages/stage02.json';
import stage03 from '../data/stages/stage03.json';
import { EnemyShape } from '../types';

export interface BossConfig {
  hp: number;
  bulletInterval: number;
  bulletSpeed: number;
}

export interface SpawnEvent {
  time: number;
  type: string;
  y: number;
  speed: number; // 水平方向の速さ（常に正の値）
  from?: 'left' | 'right'; // 出現する画面端。省略時は'right'（右から左へ）
  vy?: number; // 垂直方向の速度（正で下、負で上）。省略時は0（水平移動のみ）
  crossX?: number; // このX座標を通過した瞬間にvyを0にして水平移動へ切り替える
  texture?: string; // レガシー項目（現在は未使用。shapeで見た目のクラスを選ぶ）
  shape?: EnemyShape; // 敵の形状。省略時は'triangle'
}

export interface StageData {
  id: string;
  name: string;
  duration: number;
  spawnEvents: SpawnEvent[];
  boss: BossConfig;
}

const STAGES: StageData[] = [stage01, stage02, stage03];

export class StageManager {
  private index = 0;
  private spawnCursor = 0;

  public reset(): void {
    this.index = 0;
    this.spawnCursor = 0;
  }

  public get current(): StageData {
    return STAGES[this.index];
  }

  public get stageNumber(): number {
    return this.index + 1;
  }

  public get totalStages(): number {
    return STAGES.length;
  }

  public get isFinalStage(): boolean {
    return this.index >= STAGES.length - 1;
  }

  /** 次のステージへ進む。進めた場合はtrue、最終ステージなら何もせずfalseを返す。 */
  public advance(): boolean {
    if (this.isFinalStage) return false;
    this.index += 1;
    this.spawnCursor = 0;
    return true;
  }

  /** デバッグ用：指定インデックスのステージへ直接ジャンプする（範囲外は端にクランプ）。 */
  public jumpToStage(index: number): void {
    this.index = Math.max(0, Math.min(index, STAGES.length - 1));
    this.spawnCursor = 0;
  }

  /** デバッグ用：残りの雑魚敵出現イベントをすべて消化済み扱いにする（ボス直行用）。 */
  public skipAllSpawnEvents(): void {
    this.spawnCursor = this.current.spawnEvents.length;
  }

  /** stageTime(ms)時点で発生済みになった、まだ消化していない出現イベントをまとめて返す。 */
  public collectDueSpawnEvents(stageTime: number): SpawnEvent[] {
    const events = this.current.spawnEvents;
    const due: SpawnEvent[] = [];
    while (this.spawnCursor < events.length && events[this.spawnCursor].time <= stageTime) {
      due.push(events[this.spawnCursor]);
      this.spawnCursor += 1;
    }
    return due;
  }
}
