# データ前処理 — Google Sheets APIインテグレーション

## アーキテクチャ

### なぜ Google Sheets API を使うのか
```
スプレッドシートの構造:
├── 表示用デイリーシート: A2(年)/A3(月) のプルダウンで月を切替 → VLOOKUP で1ヶ月分表示
├── 生データタブ: キャンペーン×日単位（集約が必要、構造がバラバラ）
└── マンスリーシート: 月次集計（日次データが取れない）

→ 表示用デイリーシートのA2/A3を書き換えて月別日次データを取得するのが最も安定
```

### セル保護回避のコピー方式
```
問題: 元スプレッドシートのA2/A3は保護されている場合がある
解決: drive_cp() で一時コピーを作成 → コピーに書き込み → 完了後 drive_trash()

フロー:
1. drive_cp(original_id) → temp copy 作成
2. temp copy の A2/A3 に書き込み → 読み取り → 次の月...
3. 全月完了後 drive_trash(temp_copy_id)
```

## Google認証セットアップ

### 初回認証（対話モード必須）
```r
# scripts/google_auth.R の内容:
library(googlesheets4)
library(googledrive)

gs4_auth(
  scopes = c(
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ),
  cache = TRUE
)
drive_auth(token = gs4_token())
cat("認証成功!\n")
```

**実行方法:**
```bash
# RStudio で実行（推奨）
# コンソールで: source("scripts/google_auth.R")

# ターミナルで実行（ブラウザが開く）
R -e "source('C:/Users/hamer/Documents/MMM/scripts/google_auth.R')"
```

### トークンキャッシュ
```
場所: ~/.cache/gargle/ （Windows: %LOCALAPPDATA%/gargle/gargle/Cache/）
有効期間: 通常数日〜数週間
期限切れ: 再度 source('scripts/google_auth.R') を実行
```

## データ取得フロー詳細

### 総合デイリーシートの取得
```
config.preprocess.sogo_sheet で定義:
├── name: "総合デイリー" （シート名）
├── header_row: 3 （Row3がヘッダー）
├── date_col: "A" → DATE
├── orders_col: "G" → total_orders (dep_var)
├── revenue_col: "D" → total_revenue
├── pv_col: "X" → shopify_pv (context_var)
└── extra_cols: → 追加取得列（動的に展開）
    ├── amazon_cost: "AJ"
    ├── rakuten_cost: "AP"
    ├── makuake_revenue: "AT" （CFダミー自動生成用）
    └── LINE_friends: "AW"

取得範囲: Row4 〜 Row34 （最大31日分/月）
```

### プラットフォーム別デイリーシートの取得
```
config.preprocess.platforms[].で定義:
├── name: "Meta" → Meta_imp, Meta_cost 列名に使用
├── sheet: "Meta_デイリー（→shopify）" （完全一致必須）
├── header_row: 2 （Metaだけ2行目がヘッダー）
├── date_col: "A"
├── imp_col: "E" → {name}_imp
├── cost_col: "C" → {name}_cost
└── click_col: "F" → {name}_click （オプション）
```

### 値クリーニング（clean_numeric関数）
```
入力 → 出力の変換ルール:
├── "¥557,910" → 557910 （通貨記号・カンマ除去）
├── "0.74%" → 0.0074 （%除去して÷100）
├── "-" → 0
├── "" → 0
├── NA → 0
├── "NULL" → 0
└── カンマ入り数字 → カンマ除去
```

### 日付パース（parse_date_col関数）
```
対応フォーマット:
├── "2025/10/01" → %Y/%m/%d
├── "2025-10-01" → %Y-%m-%d
├── "10/01/2025" → %m/%d/%Y
├── "2025/10/01 00:00:00" → %Y/%m/%d %H:%M:%S
└── Excelシリアル値 → origin=1899-12-30
```

## CFダミー変数の自動生成

### 仕組み
```
1. makuake_revenue 列を検出
2. makuake_revenue > 0 の日を CF期間とする
3. UP_CF = 1/0 のダミー変数を作成
4. 14日以上離れたCF期間は別キャンペーンとみなす
5. 各キャンペーンの個別ダミー: UP_CF_1, UP_CF_2, ...
```

### detect_dummy_vars による自動検出
```
config_parser.R の build_context_vars() が実行時に:
1. データの列名を走査
2. ^(UP|DOWN)\d+ にマッチする列をcontext_varsに追加
3. 明示指定のcontext_varsと結合して重複排除
→ UP_CF, UP_CF_1 等が自動的にRobynのコンテキスト変数になる
```

## 新しいスプレッドシートへの対応手順

### Step 1: シート構造の調査
```
Google Sheetsを開いて確認する項目:
├── シート名（タブ名）の完全な文字列
├── ヘッダー行の位置（Row 2? Row 3?）
├── 各列のデータ内容と列文字（A, B, C...）
├── A2/A3 のプルダウン（年/月切替の仕組み）
└── データが表示される行範囲（通常 header_row+1 〜 header_row+31）
```

### Step 2: 列マッピングの確認方法
```
1. Google Sheetsで対象シートを開く
2. 任意の月のデータを表示
3. 各列の内容を確認:
   - IMP列（インプレッション数）
   - Cost列（費用）
   - Click列（クリック数、あれば）
   - 注意: CPC, CTR, CPA は使わない（割合データはMMMに不向き）
4. 列文字（A, B, C...）をメモ
```

### Step 3: YAMLに反映
```yaml
platforms:
  - name: "NewPlatform"
    sheet: "NewPlatform_デイリー"  # ← シート名を完全一致で
    header_row: 3                   # ← 確認したヘッダー行
    date_col: "A"
    imp_col: "D"                    # ← 確認したIMP列
    cost_col: "C"                   # ← 確認した費用列
```

### よくある落とし穴
```
1. 列文字のズレ: B列がラベル列で、実際の費用はC列だった
   → Google Sheetsで実データを目視確認する

2. CTR/CPCをClick/Costと間違える
   → 値が小数（0.003）ならCTR、整数（5000）ならClick

3. シート名の全角/半角不一致
   → "Yahoo!_デイリー" と "Yahoo！_デイリー" は別物

4. ヘッダー行の位置がシートごとに異なる
   → Meta は Row2、他は Row3 のケースがある
```

## データ品質チェックスクリプト

### check_data.R テンプレート
```r
# 前処理後のCSVを検証するスクリプト
df <- read.csv("data/project_mmm.csv", check.names = FALSE)

# 基本情報
cat("行数:", nrow(df), "\n")
cat("列数:", ncol(df), "\n")
cat("日付範囲:", range(df$DATE), "\n")

# 各チャネルのサマリー
for (col in names(df)) {
  if (col == "DATE") next
  vals <- df[[col]]
  non_zero <- sum(vals != 0, na.rm = TRUE)
  cat(sprintf("%-25s: 非ゼロ=%d日, 合計=%.0f, 平均=%.1f\n",
              col, non_zero, sum(vals, na.rm = TRUE), mean(vals, na.rm = TRUE)))
}
```

## API レート制限への対応
```
Google Sheets API:
├── 読み取り: 300リクエスト/分
├── 書き込み: 60リクエスト/分
└── 対策: sleep_sec (デフォルト2秒) で各月の間にウェイト

429エラー（Too Many Requests）が出た場合:
├── data_preprocessor.R の range_read にはリトライロジックなし
├── sleep_sec を 3-5 に増やして再実行
└── Google Driveのクォータリセットを待つ（通常1分）
```
