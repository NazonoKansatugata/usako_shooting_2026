# うさこシューティング

Phaser + TypeScript + Vite で作る 2D 横スクロールシューティングです。

## 起動

```sh
npm install
npm run dev
```

ブラウザで表示された URL を開き、タイトル画面で `Enter` を押すと開始します。

## 操作

- `矢印キー` / `WASD`: プレイヤー移動
- `Space`: 通常弾を発射
- `Enter`: 開始、またはゲームオーバー／クリア後に再開

## フェーズ0の進行

敵を倒しながら 25 秒進むとボスが出現します。ボスを倒すと `STAGE CLEAR!`、HP が 0 になると `GAME OVER` です。

## ディレクトリ構成（フェーズ1並行開発対応）

```
src/
├── config.ts              # ゲーム全体設定（解像度、スピード、HP等）
├── types/                 # 共通型定義
├── entities/              # ゲームオブジェクト（Player, Enemy, Boss, Bullet）
├── managers/              # 各種マネージャー（EnemyFactory 等）
├── scenes/                # シーン（ShootingScene 等）
└── main.ts                # ゲームエントリーポイント
```

## フェーズ1 開発分担の参考
- **A：ゲーム内容** (`src/entities/Enemy.ts`, `src/entities/Boss.ts`, `src/managers/EnemyFactory.ts` やステージデータ等)
- **B：演出・ストーリー** (会話UI, イベント演出, データ等)
- **C：基盤・ロード** (`AssetManager`, `ObjectPool`, `EventManager` 等)