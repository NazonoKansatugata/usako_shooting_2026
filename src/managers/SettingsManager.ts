export type Difficulty = 'normal' | 'hard';

export interface GameSettings {
  difficulty: Difficulty;
  bgmVolume: number; // 0 - 100
  seVolume: number; // 0 - 100
  voiceVolume: number; // 0 - 100
  keyConfig: {
    up: string;
    down: string;
    left: string;
    right: string;
    shot: string;
  };
}

const STORAGE_KEY = 'usako_shooting_settings_v1';

const DEFAULT_SETTINGS: GameSettings = {
  difficulty: 'normal',
  bgmVolume: 80,
  seVolume: 80,
  voiceVolume: 80,
  keyConfig: {
    up: 'W / ↑',
    down: 'S / ↓',
    left: 'A / ←',
    right: 'D / →',
    shot: 'SPACE',
  },
};

export class SettingsManager {
  private static instance: SettingsManager;
  private settings: GameSettings;

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public get difficulty(): Difficulty {
    return this.settings.difficulty;
  }

  public setDifficulty(difficulty: Difficulty): void {
    this.settings.difficulty = difficulty;
    this.saveSettings();
  }

  public get bgmVolume(): number {
    return this.settings.bgmVolume;
  }

  public setBgmVolume(val: number): void {
    this.settings.bgmVolume = Phaser.Math.Clamp(val, 0, 100);
    this.saveSettings();
  }

  public get seVolume(): number {
    return this.settings.seVolume;
  }

  public setSeVolume(val: number): void {
    this.settings.seVolume = Phaser.Math.Clamp(val, 0, 100);
    this.saveSettings();
  }

  public get voiceVolume(): number {
    return this.settings.voiceVolume;
  }

  public setVoiceVolume(val: number): void {
    this.settings.voiceVolume = Phaser.Math.Clamp(val, 0, 100);
    this.saveSettings();
  }

  public resetToDefault(): void {
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear settings from localStorage', e);
    }
  }

  private loadSettings(): GameSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage', e);
    }
  }
}
