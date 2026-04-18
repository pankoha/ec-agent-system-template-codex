# 新規プロジェクトセットアップガイド

## 概要
新しいクライアント/プロジェクトのMMM分析をセットアップする手順。

---

## Step 1: データソースの確認

### パターン A: Google Spreadsheet（推奨）
```
確認事項:
├── スプレッドシートのURL → spreadsheet_id を抽出
├── 閲覧/編集権限の有無
├── 表示用デイリーシートの構造:
│   ├── A2/A3 が年/月のプルダウン切替になっているか
│   ├── ヘッダー行の位置（Row 2? Row 3?）
│   └── データの列マッピング（日付, IMP, Cost, Click 等）
├── プラットフォームの種類と数
├── 売上/注文データの所在（総合デイリー等）
└── 分析可能な日付範囲（いつからデータがあるか）
```

### パターン B: CSV/Excel ファイル
```
確認事項:
├── ファイル形式（.csv, .xlsx, .xlsm）
├── エンコーディング（UTF-8, CP932/Shift-JIS）
├── 列名一覧
├── 日付列の形式（YYYY-MM-DD, YYYY/MM/DD, Excel serial等）
├── 目的変数の列名（注文数, 売上, CV数等）
└── 各メディアチャネルの列名（{Platform}_imp, {Platform}_cost 等）
```

---

## Step 2: YAML設定ファイルの作成

### テンプレートからコピー
```bash
cd C:/Users/username/Documents/MMM
cp configs/default_config.yaml configs/newproject_config.yaml
```

### 最低限の変更箇所
```yaml
# 1. プロジェクト名
project:
  name: "newproject"

# 2. データファイル
data:
  file: "data/newproject.csv"   # or "data/newproject.xlsx"
  date_col: "DATE"              # 日付列名を確認
  dep_var: "total_orders"       # 目的変数の列名
  dep_var_type: "conversion"    # or "revenue"

# 3. チャネル定義（プロジェクト固有）
channels:
  - name: "ChannelA"
    media_var: "ChannelA_imp"
    spend_var: "ChannelA_cost"
  # ... 他のチャネル

# 4. コンテキスト変数
context_vars:
  - "pv"
  - "organic_sessions"

# 5. 分析ウィンドウ
window:
  start: "2025-01-01"
  end: "2025-12-31"
```

### Google Sheets連携を追加する場合
```yaml
# preprocess セクションを追加
preprocess:
  spreadsheet_id: "YOUR_SPREADSHEET_ID"
  output_file: "data/newproject_mmm.csv"
  sleep_sec: 2

  sogo_sheet:
    name: "シート名"
    header_row: 3
    date_col: "A"
    orders_col: "G"
    revenue_col: "D"
    pv_col: "X"

  platforms:
    - name: "Meta"
      sheet: "Meta_デイリー"
      header_row: 2
      date_col: "A"
      imp_col: "E"
      cost_col: "C"
```

---

## Step 3: 列マッピング調査（Google Sheets の場合）

### 調査チェックリスト
```
□ 総合デイリーシート
  □ シート名（完全一致）: _______________
  □ ヘッダー行: Row ___
  □ 日付列: ___ 列
  □ 注文数列: ___ 列
  □ 売上列: ___ 列
  □ PV列: ___ 列
  □ 追加列: ___________ = ___ 列

□ プラットフォーム_デイリーシート
  □ Meta シート名: _______________
    □ ヘッダー行: Row ___ / IMP: ___ 列 / Cost: ___ 列
  □ Google シート名: _______________
    □ ヘッダー行: Row ___ / IMP: ___ 列 / Cost: ___ 列
  □ ... (各プラットフォーム)
```

### 列の見分け方
```
IMP（インプレッション）:
├── 整数で大きい値（1,000〜1,000,000）
├── "表示回数", "imp", "impression" 等のヘッダー
└── 日によって大きく変動

Cost（費用）:
├── 円単位の値（¥1,000〜¥500,000）
├── "費用", "消化", "cost", "金額" 等のヘッダー
└── カンマ区切りや¥記号付きの場合あり

Click（クリック）:
├── 整数で中程度の値（10〜10,000）
├── "クリック", "click", "CL" 等のヘッダー
└── ⚠️ CTR（0.001-0.05）と間違えやすい

⚠️ 使わない列:
├── CTR（クリック率）: 0.74% → 割合データは使わない
├── CPC（クリック単価）: ¥150 → 単価データは使わない
├── CPA/ROAS: 集計指標は使わない
└── ラベル列: "キャンペーン名" 等のテキスト列
```

---

## Step 4: バリデーション

### dry-run で検証
```bash
Rscript robyn_auto.R --config configs/newproject_config.yaml --dry-run
```

### 確認項目
```
✅ "設定ファイル検証OK" が表示される
✅ データ行数が想定通り
✅ チャネル数が正しい
✅ コンテキスト変数が正しく検出されている
✅ 日付範囲が正しい
```

### データ品質チェック
```bash
# check_data スクリプトで各列のサマリーを確認
Rscript scripts/check_data.R
```

```
確認項目:
├── 各チャネルの cost に非ゼロ日が十分あるか（最低30日+）
├── 各チャネルの imp に非ゼロ日があるか
├── dep_var (注文数/売上) が全日0でないか
├── 異常に大きい/小さい値がないか
├── 日付の欠損（歯抜け）がないか
└── 全期間でデータが存在するチャネルはどれか
```

---

## Step 5: 初回実行

### 前処理付きフル実行
```bash
# Google Sheets データ取得 + MMM実行
Rscript robyn_auto.R --config configs/newproject_config.yaml --preprocess
```

### CSV直接実行
```bash
# CSVが既にある場合
Rscript robyn_auto.R --config configs/newproject_config.yaml
```

### 実行後の確認
```
□ "全処理完了" が表示された
□ 選択モデルのスコアが 0.7+ ある
□ R² が 0.50+ ある
□ optimize.xlsm が生成された
□ Excelを開いて Ctrl+Shift+F9 が正常に動く
```

---

## Step 6: VBA後処理（全モデル整理.xlsm の一覧/まとめ/突合用）

### VBAマクロ実行
```
1. 全モデル整理.xlsm をExcelで開く
2. Alt+F8 → 「全モデルの整理」を選択 → 実行
   → HistData から SpreadSummary が自動生成される
3. Ctrl+S で保存
4. ファイルを閉じる（Rが書き込むため）
```

### 後処理の実行
```bash
# 最新フォルダ + optimize.xlsm からモデルID自動検出
Rscript robyn_auto.R --config configs/newproject_config.yaml --postprocess

# フォルダ・モデルを明示指定
Rscript robyn_auto.R --config configs/newproject_config.yaml \
  --postprocess --robyn-folder Robyn_YYYYMMDD_init --model <モデルID>
```

### 確認項目
```
□ 一覧シート: 全変数が種類（ベース/トレンド/プロモーション）で分類されている
□ まとめシート: プロモーション施策ごとにCPA/Spend%/効果%が異なる値
□ まとめシート: 合計行の Spend%=1, 効果%=1
□ 突合用シート: プロモーション施策の統計値が入っている
```

---

## プロジェクト設定例

### サンプルプロジェクト — D2C EC
```
データソース: Google Spreadsheet
商品: D2C商品
販売: Shopify + Amazon + 楽天
dep_var: total_orders
チャネル: Meta, Google, Pinterest, Yahoo, Logicad, LINE, Amazon_Ads, Rakuten_Ads
context: shopify_pv, LINE_friends, amazon_orders, rakuten_orders + CFダミー
window: 分析対象期間 (最低90日推奨)
注意点:
  - Google cost_col は C列（B列はラベル列の場合あり）
  - click_col が存在しないプラットフォームはコメントアウト
  - データなしチャネルはコメントアウト
  - thetas は 0.0 で指定（型不一致防止）
```

### デフォルト（default）— テンプレート
```
データソース: Excel直接読み込み
チャネル: SEM(PC/Mobile/Tablet), MOVIE(PC/Mobile/Tablet), DEMAND(PC), GDN, Meta等
context: コンテキスト変数 + UP/DOWNダミー
参照用テンプレートとして使用
```
