# YAML設定ファイル リファレンス

## 完全なセクション定義

### project（必須）
```yaml
project:
  name: "myproject"                   # プロジェクト識別名
  output_dir: "results"               # 出力ディレクトリ（未使用、将来用）
  mmm_dir: "C:/Users/username/Documents/MMM"  # MMMベースディレクトリ
```

### preprocess（オプション — Google Sheets APIデータ取得）
```yaml
preprocess:
  spreadsheet_id: "YOUR_SPREADSHEET_ID"  # Google SheetsのスプレッドシートID
  output_file: "data/myproject_mmm.csv" # 出力先（mmm_dirからの相対パス可）
  sleep_sec: 2                        # VLOOKUP再計算待ち秒数（1-5推奨）

  # 総合デイリーシート（dep_var + context取得用）
  sogo_sheet:
    name: "総合デイリー"              # シート名（完全一致）
    header_row: 3                     # ヘッダー行番号（1始まり）
    date_col: "A"                     # 日付の列文字
    orders_col: "G"                   # 注文数の列文字 → total_orders
    revenue_col: "D"                  # 売上の列文字 → total_revenue
    pv_col: "X"                       # PVの列文字 → shopify_pv

    # 追加取得列（オプション）
    extra_cols:
      amazon_cost: "AJ"              # 列名: 列文字 のマッピング
      rakuten_cost: "AP"
      makuake_revenue: "AT"           # CFダミー自動生成に使用
      LINE_friends: "AW"

  # プラットフォーム別デイリーシート
  platforms:
    - name: "Meta"                    # プラットフォーム名（出力列名に使用）
      sheet: "Meta_デイリー（→shopify）"  # シート名（完全一致）
      header_row: 2                   # ヘッダー行（シートごとに異なる場合あり）
      date_col: "A"                   # 日付列
      imp_col: "E"                    # IMP列 → {name}_imp
      cost_col: "C"                   # 費用列 → {name}_cost
      # click_col: "F"               # Click列（オプション）→ {name}_click
```

### data（必須）
```yaml
data:
  file: "data/myproject_mmm.csv"       # データファイルパス（相対/絶対）
  sheet: 1                            # Excelのシート番号/名（CSV時は不要）
  encoding: "UTF-8"                   # "auto", "UTF-8", "CP932", "Shift-JIS"
  date_col: "DATE"                    # 日付列名
  dep_var: "total_orders"             # 目的変数の列名
  dep_var_type: "conversion"          # "conversion" or "revenue"
```

### prophet（必須）
```yaml
prophet:
  vars:
    - "weekday"                       # 曜日効果
    - "holiday"                       # 祝日効果
  country: "JP"                       # 祝日カレンダーの国コード
```

### context_vars（オプション）
```yaml
# 明示指定する変数。UP*/DOWN*ダミーはデータから自動検出される。
context_vars:
  - "shopify_pv"
  - "LINE_friends"
  - "amazon_orders"
  - "rakuten_orders"
```
**自動検出ルール**: データの列名が `^(UP|DOWN)\d+` にマッチするものは自動でcontext_varsに追加される。

### channels（必須）
```yaml
channels:
  # パターン1: IMP + cost（推奨）
  - name: "Meta"
    media_var: "Meta_imp"             # Robynがアドストック変換する変数
    spend_var: "Meta_cost"            # 費用変数（予算最適化に使用）

  # パターン2: cost = media_var（IMP不在時の代用）
  - name: "Amazon_Ads"
    media_var: "amazon_cost"
    spend_var: "amazon_cost"          # 同じ変数を指定

  # コメントアウト: データがないチャネルを無効化
  # - name: "TikTok"
  #   media_var: "TikTok_cost"
  #   spend_var: "TikTok_cost"
```
**制約**: `media_var` と `spend_var` はデータに存在する列名でなければならない。

### hyperparameters（必須）
```yaml
hyperparameters:
  defaults:
    alphas: [0.8, 1.5]               # Hill曲線のS（急峻度）の範囲
    gammas: [0.8, 1.0]               # Hill曲線のK（半飽和点）の範囲
    thetas: [0.0, 0.949]             # Geometric Adstock 減衰率の範囲
    # ⚠️ 0 ではなく 0.0 と書くこと（YAML整数/浮動小数点混在防止）
  overrides:                          # チャネル別上書き（オプション）
    Meta:
      thetas: [0.3, 0.8]             # Metaだけ減衰率範囲を変更
```
**tech detail**: `config_parser.R` の `build_hyperparameters()` は各チャネルのmedia_varに対して
`{media_var}_alphas`, `{media_var}_gammas`, `{media_var}_thetas` を自動生成する。
`as.numeric()` で型安全化済み。

### robyn（必須）
```yaml
robyn:
  iterations: 2000                    # Nevergrad最適化のイテレーション数
  trials: 5                          # トライアル数（独立した最適化ラン）
  seed: 123                          # 乱数シード（再現性）
  ts_validation: false                # 時系列バリデーション（true/false）
  rssd_zero_penalty: true             # 係数0ペナルティ（RSSD計算時）
  pareto_fronts: "auto"               # Paretoフロント数（"auto" or 整数）
  min_candidates: 100                 # 最小候補モデル数
  plot_pareto: false                  # Pareto個別プロット生成（時間がかかる）
```

### model_selection（必須）
```yaml
model_selection:
  weights:
    zero_coef_penalty: 0.30           # 係数0チャネル数ペナルティ（低いほど良い）
    effect_total: 0.25                # メディア効果合計（高いほど良い）
    rsq_train: 0.20                   # 訓練R²（高いほど良い）
    decomp_rssd: 0.15                 # 分解RSSD（低いほど良い）
    sign_violation: 0.10              # 符号違反数（少ないほど良い）
  positive_expected: []               # 正の効果を期待する変数リスト
  top_n: 5                           # Top Nモデル表示数
```

### window（必須）
```yaml
window:
  start: "2025-10-01"                # 分析開始日（YYYY-MM-DD）
  end: "2026-02-21"                  # 分析終了日
```
**注意**: データに存在する日付範囲内でなければならない。
広告データが存在しない期間を含めるとモデル精度が低下する。

### templates（必須）
```yaml
templates:
  dir: "C:/Users/username/Desktop/templates..."  # テンプレート格納先
  optimize: "optimize.xlsm"          # 最適化ワークブック
  predict: "predict.xlsm"            # 予測ワークブック（オプション）
  modering: "modering.xlsm"          # モデリングワークブック（未使用）
```

---

## プロジェクト設定例

### サンプルプロジェクト（project_config.yaml）
```
データソース: Google Spreadsheet
dep_var: total_orders（総注文数）
チャネル: Meta, Google, Pinterest, Yahoo, Logicad, LINE, Amazon_Ads, Rakuten_Ads（8ch）
context: shopify_pv, LINE_friends, amazon_orders, rakuten_orders + UP_CF*自動検出
window: 分析対象期間（最低90日推奨）
```

### デフォルトテンプレート（default_config.yaml）
```
データソース: Excel/CSV直接読み込み
dep_var: CV_UU（コンバージョンユニークユーザー）
チャネル: SEM(PC/Mobile/Tablet), MOVIE(PC/Mobile/Tablet), DEMAND(PC), GDN(PC/Mobile), Meta等
context: コンテキスト変数 + ダミー自動検出
```
