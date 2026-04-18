# Shopify App Store 審査提出ガイド

## 審査提出の全体フロー

```
Step 1: 予備ステップ（自動チェック）クリア
  ↓
Step 2: App Listing 作成（英語）
  ↓
Step 3: スクリーンショット・アイコン準備
  ↓
Step 4: プライバシーポリシー・サポート情報設定
  ↓
Step 5: 要件確認（機能性・App Storeリスト・埋め込み式）
  ↓
Step 6: 「審査用に提出」クリック
  ↓
Step 7: Shopifyレビューチーム審査（5〜10営業日）
```

## 予備ステップ（自動チェック）

Partners Dashboard → 配布 → App Storeの審査 で確認。全項目にチェックが必要。

| チェック項目 | 内容 | 対処法 |
|------------|------|--------|
| クエリに対応しているAPIのバージョン | `shopify.app.toml` の `api_version` が最新か | `2025-01` 以降を使用 |
| 設定の要件に関する問題 | アプリ設定に不整合がないか | `shopify app deploy` で同期 |
| アカウントに緊急連絡先を追加 | Partners Dashboard設定 | 組織設定 → 連絡先追加 |
| リストを作成済み（英語） | 英語リスティングが完成しているか | App listing編集 |
| リスティングのよくある問題チェック | AIによる文言チェック | ガイドライン違反を修正 |
| 保護された顧客データへのアクセスリクエスト | `read_orders` 等を使う場合に必要 | APIアクセス要求 → 理由記載 |
| 一般的なエラーの自動チェック | HMAC検証、TLS証明書 | デプロイ完了後に再実行 |
| アプリの選択された機能：埋め込み式 | embedded app設定 | `shopify.app.toml` で `embedded = true` |
| 埋め込み式アプリのチェック | App Bridge正常動作 | 開発ストアでテスト |

### 自動チェック失敗時の主な原因と対策

#### HMAC署名でWebhookを確認する — 失敗
```
原因: 本番サーバーが稼働していない or SHOPIFY_API_SECRET が未設定
対策:
1. サーバーが https:// で応答するか curl -sI で確認
2. SHOPIFY_API_SECRET が正しく設定されているか確認
3. Webhook URLが到達可能か確認
```

#### 有効なTLS証明書を使用する — 失敗
```
原因: HTTPS設定がない、自己署名証明書を使用
対策:
1. Fly.io の場合: force_https = true で自動TLS
2. カスタムドメインの場合: Let's Encrypt等でTLS証明書取得
3. *.fly.dev ドメインなら自動で有効なTLS付与
```

## App Listing 作成

### 必須フィールド

| フィールド | 要件 | 例 |
|-----------|------|---|
| App name | 最大30文字、ユニーク | `MMM Analytics` |
| Tagline | 最大100文字 | `Measure each marketing channel's true revenue contribution with MMM` |
| Detailed description | 機能説明、How it works、プラン情報 | 下記テンプレート参照 |
| App icon | 512 x 512px PNG | ブランドカラー、シンプル |
| Screenshots | 1600 x 900px PNG、最大6枚 | UI画面キャプチャ |
| Category | 1つ選択 | `Analytics` |
| Support email | サポート窓口 | `support@example.com` |
| Privacy policy URL | アプリ内または外部URL | `https://app.fly.dev/app/privacy` |

### 説明文テンプレート

```
[1行で何ができるか]

[2-3行で課題と解決策]

How It Works

1. [ステップ1] — [説明]
2. [ステップ2] — [説明]
3. [ステップ3] — [説明]

Key Features

[機能名1]
[1-2行の説明]

[機能名2]
[1-2行の説明]

Plans

Free: [含まれる機能]
Starter ($XX/mo): [含まれる機能]
Pro ($XX/mo): [含まれる機能]

All paid plans include a 7-day free trial. Cancel anytime.
```

## スクリーンショット要件

### サイズ・フォーマット
- **Desktop**: 1600 x 900 px（必須）
- **Mobile**: 750 x 1334 px（任意）
- フォーマット: PNG
- 最大: 6枚

### 推奨構成（6枚）
1. ダッシュボード概要
2. プラン・料金ページ
3. メイン機能画面 1
4. メイン機能画面 2
5. 高度な機能画面
6. データセットアップ画面

### Puppeteerによる自動生成

```javascript
// capture-screenshots.mjs
import puppeteer from "puppeteer";

const PAGES = [
  { name: "01-dashboard", file: "dashboard.html", width: 1600, height: 900 },
  // ...
];

const browser = await puppeteer.launch({ headless: true });
for (const page of PAGES) {
  const p = await browser.newPage();
  // deviceScaleFactor: 1 で正確な1600x900を生成
  await p.setViewport({ width: page.width, height: page.height, deviceScaleFactor: 1 });
  await p.goto(`file:///${htmlPath}`, { waitUntil: "networkidle0" });
  await p.screenshot({ path: outputPath, fullPage: false });
}
```

**注意:** `deviceScaleFactor: 2` を使うと2倍サイズ（3200x1800）になる。App Storeは正確に1600x900を要求するため、`deviceScaleFactor: 1` を使うか、sharpでリサイズすること。

## リスティングAIチェック — 禁止表現と対策

Shopifyはリスティング提出時にAIで文言・スクリーンショットをチェックする。

### 禁止カテゴリと具体例

| カテゴリ | 禁止表現例 | 修正例 |
|---------|-----------|--------|
| **根拠なし統計** | `Expected Revenue $284,500 → $319,800` | 削除 or 説明テキストに置換 |
| **未実証の主張** | `Most Popular`, `Best`, `#1` | `Recommended` |
| **予測金額** | `Revenue Lift +$35,300` | パーセンテージ表示 or 説明文 |
| **比較優位** | `Better than competitors` | 削除 |
| **保証表現** | `Guaranteed results` | `Data-driven insights` |

### スクリーンショット内のUI表示で注意すべき点

```
❌ NG: 具体的な予測売上金額を表示
❌ NG: "Most Popular" バッジ
❌ NG: "#1 Marketing Tool" 的な文言
❌ NG: 他社との比較で優位を示す表現

✅ OK: "Recommended" バッジ
✅ OK: パーセンテージ変化（-7%, +56%）
✅ OK: 機能説明テキスト（"Reallocate from saturated → high-ROI channels"）
✅ OK: モデル精度指標（R² 0.92, MAPE 8.3%）
✅ OK: 分析期間・チャネル数などの事実情報
```

### AIチェック失敗時の対応フロー

```
1. エラーメッセージを確認（どのスクリーンショット・どの表現が問題か）
2. screenshot-pages/ のHTMLを修正
3. スクリーンショット再生成（1600x900で）
4. Partners Dashboardに再アップロード
5. 「リストを編集」→ 保存 → 再チェック
```

## 保護された顧客データへのアクセス

`read_orders` 等の顧客データにアクセスするスコープを使用する場合:

1. Partners Dashboard → APIアクセス要求 → 保護された顧客データ
2. アクセスの目的・使用方法を記載
3. データ保持ポリシーを記載
4. 承認を待つ（審査とは別プロセス）

## 審査後のフォロー

### 承認された場合
- App Storeに自動公開
- 初期レビュー・インストール数をモニタリング

### フィードバック（差し戻し）の場合
- 具体的な修正要求がメールで届く
- 修正後に再提出
- よくある差し戻し理由:
  - アプリが正常にインストール・動作しない
  - GDPR webhook が正しく処理されない
  - UIがShopify Polaris準拠でない
  - セキュリティ上の問題（XSS, CSRF等）
