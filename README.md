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