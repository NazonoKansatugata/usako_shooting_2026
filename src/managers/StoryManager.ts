import { DialogueItem, ScenarioData } from '../types';
import { DialogueWindow } from '../ui/DialogueWindow';
import stage01Scenario from '../data/scenarios/stage01.json';
import stage02Scenario from '../data/scenarios/stage02.json';
import stage03Scenario from '../data/scenarios/stage03.json';

const SCENARIO_MAP: Record<string, ScenarioData> = {
  stage01: stage01Scenario as ScenarioData,
  stage02: stage02Scenario as ScenarioData,
  stage03: stage03Scenario as ScenarioData,
};

interface TrackedDialogue {
  item: DialogueItem;
  triggered: boolean;
}

export class StoryManager {
  private trackedDialogues: TrackedDialogue[] = [];
  private dialogueWindow: DialogueWindow;

  constructor(dialogueWindow: DialogueWindow) {
    this.dialogueWindow = dialogueWindow;
  }

  /**
   * ステージIDに基づいて独立したシナリオデータをロードする
   */
  public loadScenario(stageId: string): void {
    this.dialogueWindow.hideDialogue();
    const scenario = SCENARIO_MAP[stageId];
    if (!scenario || !scenario.dialogues || scenario.dialogues.length === 0) {
      this.trackedDialogues = [];
      return;
    }

    // triggerPercent昇順にソートして保持
    this.trackedDialogues = scenario.dialogues
      .slice()
      .sort((a, b) => a.triggerPercent - b.triggerPercent)
      .map((item) => ({
        item,
        triggered: false,
      }));
  }

  /**
   * 毎フレーム進行率を更新・チェックする
   */
  public update(stageTime: number, totalDuration: number): void {
    if (this.trackedDialogues.length === 0 || totalDuration <= 0) return;

    const progressPercent = Math.min(100, (stageTime / totalDuration) * 100);

    for (const entry of this.trackedDialogues) {
      if (!entry.triggered && progressPercent >= entry.item.triggerPercent) {
        entry.triggered = true;
        this.dialogueWindow.showDialogue(entry.item);
        break; // 1つのフレームで同時に複数出ないように1つずつ処理
      }
    }
  }

  public reset(): void {
    this.dialogueWindow.hideDialogue();
    this.trackedDialogues = [];
  }
}
