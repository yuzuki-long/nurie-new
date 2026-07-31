# おえかきぬりえ

iPhone / iPad で遊べる、知育向け塗り絵アプリです。React + Vite で作られています。

## できること

- 5種類の下絵（チューリップ・さかな・いぬ・プリン・りんご）
- 指(またはマウス)でなぞって色を塗る、ピンチイン/ピンチアウトで拡大縮小
- ひとふでごとに自動保存（アプリを閉じても続きから塗れる）
- 元に戻す / やり直す
- メインメニュー：あたらしいぬりえ / つづきからぬる / ぬりえをみる（本棚表示） / ぬりえをつくる（未実装・準備中表示のみ）
- 塗った絵は Vercel Blob に保存（トークン未設定時は自動でブラウザのlocalStorageにフォールバック）

## フォルダ構成

```
coloring-app/
├── api/                 Vercel サーバーレス関数(Blobの読み書き)
│   ├── current.js       「つづきからぬる」用の作業中データ
│   └── gallery.js       「ぬりえをみる」用の本棚データ
├── public/templates/    5種類の下絵SVG
├── src/
│   ├── App.jsx           画面遷移・メインメニュー・下絵選択・本棚
│   ├── ColoringCanvas.jsx 塗り絵キャンバス本体(描画・ズーム・undo/redo)
│   ├── storage.js         保存まわりの共通処理(Blob優先、失敗時はlocalStorage)
│   ├── data/templates.js  下絵の一覧データ
│   └── index.css          デザイン(トークン・レイアウト)
├── index.html
├── package.json
├── vite.config.js
└── vercel.json
```

## セットアップ手順

### 1. ローカルで動作確認（見た目・操作感だけ）

```bash
npm install
npm run dev
```

ブラウザで表示されたURL（例: http://localhost:5173）を開いてください。
この状態では `/api/*` は動かないので、保存はブラウザの localStorage に自動的に切り替わります（動作確認には十分です）。

### 2. GitHubに登録

```bash
git init
git add .
git commit -m "first commit"
git branch -M main
git remote add origin <あなたのGitHubリポジトリURL>
git push -u origin main
```

### 3. Vercelにデプロイ

1. https://vercel.com で「New Project」→ 上記のGitHubリポジトリをインポート
2. Framework Preset は自動で "Vite" と検出されます（`vercel.json` で明示済み）
3. そのままデプロイでOK（この時点ではまだBlobは未設定でも動きます＝localStorage保存になります）

### 4. Vercel Blob を有効にする（保存をクラウドにする場合）

1. Vercelのプロジェクト画面 → **Storage** タブ → **Create Database** → **Blob** を選択して作成
2. 作成すると自動的に環境変数 `BLOB_READ_WRITE_TOKEN` がプロジェクトに追加されます
3. 何もコード変更は不要です。再デプロイ（Redeploy）すれば `/api/current` `/api/gallery` がBlobを使って動き始めます

ローカルでBlobまで含めて確認したい場合は、Vercel CLIを使います。

```bash
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

## カスタマイズのヒント

- **下絵を増やしたい**：`public/templates/` にSVGを追加して、`src/data/templates.js` に1行追加するだけです。
- **色を変えたい**：`src/ColoringCanvas.jsx` の `COLORS` 配列を編集してください。
- **ブラシの太さ**：同ファイルの `BRUSH_SIZES` を編集してください。
- **「ぬりえをつくる」機能**：今回は仕様通り未実装（ボタンはグレーアウト表示のみ）です。実装する際は `App.jsx` の `MainMenu` から新しい画面を追加してください。

## 技術メモ

- 塗り絵は Canvas 2D に「ストローク（線や点の配列）」として記録し、undo/redoは配列の出し入れで実現しています。下絵SVGは `mix-blend-mode: multiply` で上に重ねているだけなので、キャンバス自体はシンプルな白背景+色付きの線です。
- ピンチズームは2本指の距離とその中点から拡大率とパン位置を計算し、CSSの `transform` で実現しています（指で触れている点がなるべく動かないように計算しています）。
- 保存データは「作業中(current)」と「本棚(gallery)」の2種類。あたらしいぬりえを始めるときに、直前の作業中データを本棚に確定保存してからリセットします。
