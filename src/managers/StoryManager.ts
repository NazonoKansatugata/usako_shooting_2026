import { DialogueItem, DialogueTriggerType, ScenarioData } from '../types';
import { DialogueWindow } from '../ui/DialogueWindow';
import stage01Scenario from '../data/scenarios/stage01.json';
import stage02Scenario from '../data/scenarios/stage02.json';
import stage03Scenario from '../data/scenarios/stage03.json';

const SCENARIO_MAP: Record<string, ScenarioData> = {
  stage01: stage01Scenario as ScenarioData,
  stage02: stage02Scenario as ScenarioData,
  stage03: stage03Scenario as ScenarioData,
};

interface TrackedProgressDialogue {
  item: DialogueItem;
  triggered: boolean;
}

interface EventGroup {
  key: string;
  triggerPercent: number;
  items: DialogueItem[];
  triggered: boolean;
}

/** イベント系ダイアログを開始順に1本ずつ連続再生する */
function playSequence(dialogueWindow: DialogueWindow, items: DialogueItem[], onComplete?: () => void): void {
  if (items.length === 0) {
    onComplete?.();
    return;
  }
  let index = 0;
  const showNext = (): void => {
    if (index >= items.length) {
      onComplete?.();
      return;
    }
    const item = items[index];
    index += 1;
    dialogueWindow.showDialogue(item, showNext);
  };
  showNext();
}

export class StoryManager {
  private dialogueWindow: DialogueWindow;

  // triggerType='progress'（従来通り、進行率停止なしで発火する会話）
  private progressDialogues: TrackedProgressDialogue[] = [];
  // triggerType='event'（発火中はステージ進行率の進行を停止する）。同一eventId(未指定時はtriggerPercent)ごとにグルーピング
  private eventGroups: EventGroup[] = [];
  // タイミング固定イベント
  private stageStartDialogues: DialogueItem[] = [];
  private bossPreDialogues: DialogueItem[] = [];
  private bossDefeatDialogues: DialogueItem[] = [];
  private stageClearDialogues: DialogueItem[] = [];

  // 現在イベント系ダイアログ（進行率を止めるべきもの）を再生中かどうか
  private blocking = false;
  // 通常の進行率連動ダイアログは、表示完了後に次の項目を再生する
  private progressDialoguePlaying = false;

  constructor(dialogueWindow: DialogueWindow) {
    this.dialogueWindow = dialogueWindow;
  }

  /**
   * ステージIDに基づいて独立したシナリオデータをロードする
   */
  public loadScenario(stageId: string): void {
    this.dialogueWindow.hideDialogue();
    this.blocking = false;
    this.progressDialogues = [];
    this.eventGroups = [];
    this.stageStartDialogues = [];
    this.bossPreDialogues = [];
    this.bossDefeatDialogues = [];
    this.stageClearDialogues = [];
    this.progressDialoguePlaying = false;

    const scenario = SCENARIO_MAP[stageId];
    if (!scenario || !scenario.dialogues || scenario.dialogues.length === 0) return;

    const eventGroupMap = new Map<string, EventGroup>();

    for (const item of scenario.dialogues) {
      const type: DialogueTriggerType = item.triggerType ?? 'progress';
      switch (type) {
        case 'stageStart':
          this.stageStartDialogues.push(item);
          break;
        case 'bossPre':
          this.bossPreDialogues.push(item);
          break;
        case 'bossDefeat':
          this.bossDefeatDialogues.push(item);
          break;
        case 'stageClear':
          this.stageClearDialogues.push(item);
          break;
        case 'event': {
          const percent = item.triggerPercent ?? 0;
          const key = item.eventId ?? `p${percent}`;
          let group = eventGroupMap.get(key);
          if (!group) {
            group = { key, triggerPercent: percent, items: [], triggered: false };
            eventGroupMap.set(key, group);
            this.eventGroups.push(group);
          }
          group.items.push(item);
          break;
        }
        case 'progress':
        default:
          this.progressDialogues.push({ item, triggered: false });
          break;
      }
    }

    this.progressDialogues.sort((a, b) => (a.item.triggerPercent ?? 0) - (b.item.triggerPercent ?? 0));
    this.eventGroups.sort((a, b) => a.triggerPercent - b.triggerPercent);

    // ステージ開始直後イベントは即座に再生を開始する（表示中は進行率停止）
    if (this.stageStartDialogues.length > 0) {
      this.blocking = true;
      playSequence(this.dialogueWindow, this.stageStartDialogues, () => {
        this.blocking = false;
      });
    }
  }

  /**
   * 毎フレーム進行率を更新・チェックする。イベント再生中(isBlockingProgress()=true)は呼び出し側で
   * ステージ進行率(stageTime)自体の加算を止めること。
   */
  public update(stageTime: number, totalDuration: number): void {
    if (this.blocking || totalDuration <= 0) return;

    const progressPercent = Math.min(100, (stageTime / totalDuration) * 100);

    // 通常会話を最後まで表示してから、次のイベント判定へ進む
    if (this.progressDialoguePlaying) return;

    // イベント進捗率停止：該当%に到達したら再生し、完了するまで進行率を止める
    for (const group of this.eventGroups) {
      if (!group.triggered && progressPercent >= group.triggerPercent) {
        group.triggered = true;
        this.blocking = true;
        playSequence(this.dialogueWindow, group.items, () => {
          this.blocking = false;
        });
        return;
      }
    }

    // 通常の進行率連動会話（進行率は止めない）
    for (const entry of this.progressDialogues) {
      if (!entry.triggered && progressPercent >= (entry.item.triggerPercent ?? 0)) {
        entry.triggered = true;
        this.progressDialoguePlaying = true;
        this.dialogueWindow.showDialogue(entry.item, () => {
          this.progressDialoguePlaying = false;
        });
        break; // 表示完了後、次回のupdateで次の未発火項目を再生する
      }
    }
  }

  /** イベント系ダイアログ再生中かどうか。trueの間はステージ進行率(stageTime)の加算を止める想定 */
  public isBlockingProgress(): boolean {
    return this.blocking;
  }

  /**
   * ボス出現直前に呼び出す。演出ダイアログがあれば再生し、完了時にonCompleteを呼ぶ（再生中は進行率停止）。
   * ダイアログが無い場合は同期的にonCompleteを呼ぶ。
   */
  public triggerBossPreEvent(onComplete: () => void): void {
    if (this.bossPreDialogues.length === 0) {
      onComplete();
      return;
    }
    this.blocking = true;
    playSequence(this.dialogueWindow, this.bossPreDialogues, () => {
      this.blocking = false;
      onComplete();
    });
  }

  /** ボス撃破直後に呼び出す。ダイアログ再生完了後にonCompleteを呼ぶ */
  public triggerBossDefeatEvent(onComplete: () => void): void {
    if (this.bossDefeatDialogues.length === 0) {
      onComplete();
      return;
    }
    playSequence(this.dialogueWindow, this.bossDefeatDialogues, onComplete);
  }

  /** ステージクリア画面表示時に呼び出す */
  public triggerStageClearEvent(): void {
    if (this.stageClearDialogues.length === 0) return;
    playSequence(this.dialogueWindow, this.stageClearDialogues);
  }

  public reset(): void {
    this.dialogueWindow.hideDialogue();
    this.blocking = false;
    this.progressDialogues = [];
    this.eventGroups = [];
    this.stageStartDialogues = [];
    this.bossPreDialogues = [];
    this.bossDefeatDialogues = [];
    this.stageClearDialogues = [];
    this.progressDialoguePlaying = false;
  }
}
