import { Difficulty } from './SettingsManager';

export interface SaveData {
  highScore: number;
  /** 難易度ごとにクリア済みの最大ステージ番号 (0 = 未クリア) */
  maxClearedStage: Record<Difficulty, number>;
  /** 難易度ごとに全ステージクリア済みかどうか */
  allCleared: Record<Difficulty, boolean>;
}

const STORAGE_KEY = 'usako_shooting_save_v1';

const DEFAULT_SAVE_DATA: SaveData = {
  highScore: 0,
  maxClearedStage: { normal: 0, hard: 0 },
  allCleared: { normal: false, hard: false },
};

/** クリア状況・ハイスコアなどの進行データを永続化するマネージャー */
export class SaveManager {
  private static instance: SaveManager;
  private data: SaveData;

  private constructor() {
    this.data = this.loadData();
  }

  public static getInstance(): SaveManager {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  public get highScore(): number {
    return this.data.highScore;
  }

  public getMaxClearedStage(difficulty: Difficulty): number {
    return this.data.maxClearedStage[difficulty];
  }

  public isAllCleared(difficulty: Difficulty): boolean {
    return this.data.allCleared[difficulty];
  }

  /** スコアを記録する。ハイスコアを更新した場合はtrueを返す */
  public reportScore(score: number): boolean {
    if (score > this.data.highScore) {
      this.data.highScore = score;
      this.saveData();
      return true;
    }
    return false;
  }

  public reportStageCleared(stageNumber: number, difficulty: Difficulty): void {
    if (stageNumber > this.data.maxClearedStage[difficulty]) {
      this.data.maxClearedStage[difficulty] = stageNumber;
      this.saveData();
    }
  }

  public reportAllCleared(difficulty: Difficulty): void {
    if (!this.data.allCleared[difficulty]) {
      this.data.allCleared[difficulty] = true;
      this.saveData();
    }
  }

  /** ハイスコア・クリア状況などのセーブデータをすべて消去する */
  public clearAll(): void {
    this.data = JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear save data from localStorage', e);
    }
  }

  private loadData(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SAVE_DATA,
          ...parsed,
          maxClearedStage: { ...DEFAULT_SAVE_DATA.maxClearedStage, ...parsed.maxClearedStage },
          allCleared: { ...DEFAULT_SAVE_DATA.allCleared, ...parsed.allCleared },
        };
      }
    } catch (e) {
      console.warn('Failed to load save data from localStorage', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SAVE_DATA));
  }

  private saveData(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save data to localStorage', e);
    }
  }
}
