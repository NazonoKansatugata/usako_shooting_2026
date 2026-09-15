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
export const STATUS_MAX_LEVEL = 5;

const STORAGE_KEY = 'usako_shooting_status_v1';

const DEFAULT_PLAYER_STATUS: PlayerStatusData = { points: 0, wep: 0, str: 0, def: 0, dex: 0 };

const DEFAULT_STATUS_DATA: StatusSaveData = {
  p1: { ...DEFAULT_PLAYER_STATUS },
  p2: { ...DEFAULT_PLAYER_STATUS },
};

/** 現在のレベル(0始まり)から1レベル上げるのに必要なポイント数。上がるごとに倍々で重くなる
 *  （Lv0→1:1pt, 1→2:2pt, 2→3:4pt, 3→4:8pt, 4→5:16pt、合計31ptで最大Lv5に到達）。 */
export function costForLevel(currentLevel: number): number {
  return 2 ** currentLevel;
}

/** 上限レベル引き下げ前のセーブデータで現在の上限を超えているレベルがあれば、
 *  超過分をこのコスト表に基づいて未使用ポイントへ払い戻しつつ現行のPlayerStatusData形状に正規化する。 */
function normalizePlayerStatus(parsed: unknown): PlayerStatusData {
  const source = (parsed ?? {}) as Partial<PlayerStatusData>;
  const merged: PlayerStatusData = { ...DEFAULT_PLAYER_STATUS, ...source };

  (['wep', 'str', 'def', 'dex'] as const).forEach((stat) => {
    while (merged[stat] > STATUS_MAX_LEVEL) {
      merged[stat] -= 1;
      merged.points += costForLevel(merged[stat]);
    }
  });

  return merged;
}

/** ゲームオーバーのたびに貯まるステータスポイントと、WEP/STR/DEF/DEXへの割り振りを永続化するマネージャー */
export class StatusManager {
  private static instance: StatusManager;
  private data: StatusSaveData;

  private constructor() {
    this.data = this.loadData();
    // 旧WEPレベルのポイント払い戻しなど、loadData()での正規化結果を確実に永続化する
    // （ポイント振り分け操作が一度も行われないままアプリを終了しても失われないようにする）
    this.saveData();
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

  /** 現在のレベルに応じたコスト（costForLevel参照。倍々で重くなる）を消費してstatを1レベル上げる。成功したらtrue。 */
  public allocate(player: PlayerVariant, stat: StatKey): boolean {
    const status = this.data[player];
    if (status[stat] >= STATUS_MAX_LEVEL) return false;
    const cost = costForLevel(status[stat]);
    if (status.points < cost) return false;
    status.points -= cost;
    status[stat] += 1;
    this.saveData();
    return true;
  }

  /** statを1レベル下げて、そのレベルに支払ったコスト分のポイントを返す。成功したらtrue。 */
  public deallocate(player: PlayerVariant, stat: StatKey): boolean {
    const status = this.data[player];
    if (status[stat] <= 0) return false;
    status[stat] -= 1;
    status.points += costForLevel(status[stat]);
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
          p1: normalizePlayerStatus(parsed.p1),
          p2: normalizePlayerStatus(parsed.p2),
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
