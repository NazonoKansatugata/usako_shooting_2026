# シナリオJSON仕様書

シューティング中に表示する会話シナリオの定義方法をまとめる。

## ファイル配置

シナリオJSONは`src/data/scenarios/`にステージ単位で配置する。

現在のファイル:

- `stage01.json`
- `stage02.json`
- `stage03.json`

新しいステージを追加する場合は、JSONを作成したうえで`src/managers/StoryManager.ts`の`SCENARIO_MAP`にも登録する。

## JSON全体の形式

```json
{
  "stageId": "stage01",
  "dialogues": [
    {
      "id": "s1_01",
      "triggerType": "stageStart",
      "speaker": "うさこ",
      "text": "作戦開始ウサー！",
      "duration": 1000
    }
  ]
}
```

### トップレベル項目

| 項目 | 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| `stageId` | `string` | 必須 | ステージID。ステージデータのIDと一致させる。 |
| `dialogues` | `DialogueItem[]` | 必須 | 表示する会話項目の配列。 |

## 会話項目のプロパティ

| 項目 | 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| `id` | `string` | 必須 | 会話項目を識別する一意なID。 |
| `triggerType` | `string` | 任意 | 発火タイミング。省略時は`progress`。 |
| `triggerPercent` | `number` | 条件付き | `progress`または`event`で使用するステージ進捗率。`0`～`100`。 |
| `eventId` | `string` | 任意 | `event`をまとめるID。同じIDの項目は連続再生される。 |
| `speaker` | `string` | 必須 | 話者名。 |
| `text` | `string` | 必須 | 表示する本文。 |
| `portrait` | `string` | 任意 | 立ち絵・アイコンのテクスチャキー。現在は対応テクスチャがある場合に表示する。 |
| `portraitPosition` | `"left" \| "right"` | 任意 | 立ち絵の表示位置。省略時は左扱い。 |
| `voice` | `string` | 任意 | ボイスのサウンドキー。現在は対応サウンドがある場合に再生する。 |
| `duration` | `number` | 任意 | 表示時間（ミリ秒）。省略時は`1000`。 |

## `triggerType`の種類

### `progress`: 進捗率に連動する通常会話

ステージ進捗率が`triggerPercent`以上になったときに表示する。

表示中もステージ進捗率は進み続ける。これまでの仕様と同じ動作である。

`triggerType`を省略した場合も`progress`として扱われるため、既存のJSONはそのまま利用できる。

```json
{
  "id": "s2_02",
  "triggerType": "progress",
  "triggerPercent": 60,
  "speaker": "けろこ",
  "text": "前方より大型熱源反応をキャッチしたケロ！",
  "duration": 1000
}
```

次のように`triggerType`を省略しても同じである。

```json
{
  "id": "s2_02",
  "triggerPercent": 60,
  "speaker": "けろこ",
  "text": "前方より大型熱源反応をキャッチしたケロ！",
  "duration": 1000
}
```

### `event`: 進捗率を停止するイベント

ステージ進捗率が`triggerPercent`以上になった時点でイベントを開始する。

イベント会話の再生中は、ステージ進捗率とステージ時間の加算が停止する。会話が完了すると、停止した位置から再開する。

```json
{
  "id": "s1_event_50",
  "triggerType": "event",
  "eventId": "s1_midpoint",
  "triggerPercent": 50,
  "speaker": "けろこ",
  "text": "ステージ中盤ケロ！",
  "duration": 1000
}
```

#### 複数行のイベント

同じ`eventId`を指定した項目は、配列に書いた順番で連続再生される。すべての会話が終わるまで進捗率は停止する。

```json
{
  "id": "s1_event_50_01",
  "triggerType": "event",
  "eventId": "s1_midpoint",
  "triggerPercent": 50,
  "speaker": "けろこ",
  "text": "大型反応を確認したケロ！",
  "duration": 2500
},
{
  "id": "s1_event_50_02",
  "triggerType": "event",
  "eventId": "s1_midpoint",
  "triggerPercent": 50,
  "speaker": "うさこ",
  "text": "迎撃するウサ！",
  "duration": 2500
}
```

`eventId`を省略した場合は、同じ`triggerPercent`の項目が同じイベントとしてまとめられる。意図を明確にするため、複数行のイベントでは`eventId`を指定することを推奨する。

### `stageStart`: ステージ開始直後

ステージ開始時に即座に再生される。再生中はステージ進捗率が停止する。

```json
{
  "id": "s1_01",
  "triggerType": "stageStart",
  "speaker": "うさこ",
  "text": "作戦開始だウサ！",
  "duration": 1000
}
```

複数項目を置いた場合は、配列順に連続再生される。

### `bossPre`: ボス出現前

ステージ進捗率が`100`%に到達したときに再生される。会話が終わるまでボスは出現しない。

この種類では`triggerPercent`は使用しない。

```json
{
  "id": "s1_bosspre",
  "triggerType": "bossPre",
  "speaker": "たぬきボス",
  "text": "ここから先は通さんぽん！",
  "duration": 1000
}
```

### `bossDefeat`: ボス撃破直後

ボス撃破直後、ステージクリア処理の前に再生される。会話が終わってからステージクリア画面、または全ステージクリア処理へ進む。

この種類では`triggerPercent`は使用しない。

```json
{
  "id": "s1_bossdefeat",
  "triggerType": "bossDefeat",
  "speaker": "うさこ",
  "text": "やったウサ！",
  "duration": 1000
}
```

### `stageClear`: ステージクリア後

ステージクリア画面を表示するタイミングで再生される。

この種類では`triggerPercent`は使用しない。

```json
{
  "id": "s1_stageclear",
  "triggerType": "stageClear",
  "speaker": "けろこ",
  "text": "次のエリアへ進むケロ",
  "duration": 1000
}
```

## 発火タイミング一覧

| `triggerType` | 発火条件 | 進捗率の停止 | ボス・ステージへの影響 |
| --- | --- | --- | --- |
| `progress` | `triggerPercent`到達 | しない | なし |
| `event` | `triggerPercent`到達 | する | 会話完了後に再開 |
| `stageStart` | ステージ開始時 | する | 会話完了後に開始進行 |
| `bossPre` | ボス出現条件到達後 | する | 会話完了後にボス出現 |
| `bossDefeat` | ボス撃破時 | 実質停止 | 会話完了後にクリア処理 |
| `stageClear` | ステージクリア画面表示時 | ステージ進行終了後 | なし |

## 作成時の注意

1. `id`は同じステージ内で重複させない。
2. `progress`と`event`の`triggerPercent`は`0`～`100`の範囲で指定する。
3. `progress`は進捗率を停止しない。停止したい会話には必ず`"triggerType": "event"`を指定する。
4. 複数行を順番に再生したいイベントには、同じ`eventId`を指定する。
5. JSONの文字列内に`"`を含める場合は`\"`とエスケープする。
6. 会話の表示時間はミリ秒で指定する。例えば4秒は`1000`。

## 現在の使用例

- `stage01.json`: `stageStart`、`event`、`bossPre`、`bossDefeat`、`stageClear`を使用。
- `stage02.json`: `triggerType`を省略した従来形式。すべて`progress`として動作する。
- `stage03.json`: `triggerType`を省略した従来形式。すべて`progress`として動作する。