import Phaser from 'phaser';
import stage01 from '../data/stages/stage01.json';
import stage02 from '../data/stages/stage02.json';
import stage03 from '../data/stages/stage03.json';

export interface BossConfig {
  hp: number;
  bulletInterval: number;
  bulletSpeed: number;
}

export interface StageData {
  id: string;
  name: string;
  duration: number;
  spawnInterval: number;
  speedMultiplier: number;
  enemyPool: string[];
  boss: BossConfig;
}

const STAGES: StageData[] = [stage01, stage02, stage03];

export class StageManager {
  private index = 0;

  public reset(): void {
    this.index = 0;
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
    return true;
  }

  public pickEnemyType(): string {
    const pool = this.current.enemyPool;
    return pool[Phaser.Math.Between(0, pool.length - 1)];
  }
}
