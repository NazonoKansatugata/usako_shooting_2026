import type { PlayerVariant } from '../entities/Player';

export type StatKey = 'wep' | 'str' | 'def' | 'dex';

export interface PlayerStatusData {
  /** 未使用のステータスポイント */
  points: number;
  wep: number;
  str: number;
  def: number;
  dex: number;
}

export interface StatusSaveData {
  p1: PlayerStatusData;
  p2: PlayerStatusData;
}

/** 各ステータスの上限レベル */
export const STATUS_MAX_LEVEL = 10;

const STORAGE_KEY = 'usako_shooting_status_v1';

const DEFAULT_PLAYER_STATUS: PlayerStatusData = { points: 0, wep: 0, str: 0, def: 0, dex: 0 };

const DEFAULT_STATUS_DATA: StatusSaveData = {
  p1: { ...DEFAULT_PLAYER_STATUS },
  p2: { ...DEFAULT_PLAYER_STATUS },
};

/** ゲームオーバーのたびに貯まるステータスポイントと、WEP/STR/DEF/DEXへの割り振りを永続化するマネージャー */
export class StatusManager {
  private static instance: StatusManager;
  private data: StatusSaveData;

  private constructor() {
    this.data = this.loadData();
  }

  public static getInstance(): StatusManager {
    if (!StatusManager.instance) {
      StatusManager.instance = new StatusManager();
    }
    return StatusManager.instance;
  }

  public getData(player: PlayerVariant): PlayerStatusData {
    return { ...this.data[player] };
  }

  /** ゲームオーバー時に呼ぶ。ポイントを加算して即保存する。 */
  public addPoint(player: PlayerVariant, amount = 1): void {
    this.data[player].points += amount;
    this.saveData();
  }

  /** ポイントを1消費してstatを1レベル上げる。成功したらtrue。 */
  public allocate(player: PlayerVariant, stat: StatKey): boolean {
    const status = this.data[player];
    if (status.points <= 0 || status[stat] >= STATUS_MAX_LEVEL) return false;
    status.points -= 1;
    status[stat] += 1;
    this.saveData();
    return true;
  }

  /** statを1レベル下げてポイントを1返す。成功したらtrue。 */
  public deallocate(player: PlayerVariant, stat: StatKey): boolean {
    const status = this.data[player];
    if (status[stat] <= 0) return false;
    status[stat] -= 1;
    status.points += 1;
    this.saveData();
    return true;
  }

  /** ステータス・ポイントをすべて消去する */
  public clearAll(): void {
    this.data = JSON.parse(JSON.stringify(DEFAULT_STATUS_DATA));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear status data from localStorage', e);
    }
  }

  private loadData(): StatusSaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          p1: { ...DEFAULT_PLAYER_STATUS, ...parsed.p1 },
          p2: { ...DEFAULT_PLAYER_STATUS, ...parsed.p2 },
        };
      }
    } catch (e) {
      console.warn('Failed to load status data from localStorage', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_STATUS_DATA));
  }

  private saveData(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save status data to localStorage', e);
    }
  }
}
