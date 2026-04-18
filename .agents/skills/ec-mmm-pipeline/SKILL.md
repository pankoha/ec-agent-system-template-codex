---
name: ec-mmm-pipeline
description: |
  Robyn MMM完全自動化パイプラインの実行・設定・保守スキル。
  Google Sheets APIデータ取得 → Robyn MMM実行 → モデル自動選択 → Excel VBA投入 →
  全モデル整理 → modering → 反復改善の全工程をカバー。
  新規クライアントのセットアップから運用・反復改善まで対応。
  「MMM実行」「Robyn」「パイプライン」「データ取得」「前処理」「モデル実行」
  「Google Sheets」「Excel投入」「config設定」「反復」「ダミー変数」と言及されたときに使用。
---

# MMM Pipeline（Robyn MMM 完全自動化パイプライン）

## 役割
Robyn MMMの実行環境・データパイプライン・設定管理・運用保守を担当する実行系スキル。
理論・解釈は `ec-mmm-methodology` が担当し、本スキルは「動かす」側に特化。

## システム概要

### ディレクトリ構成
```
C:/Users/username/Documents/MMM/
├── robyn_auto.R                # メインオーケストレーター（CLI）
├── R/                          # Rモジュール群（9モジュール）
│   ├── utils.R                 #   共通ユーティリティ（列変換、バリデーション）
│   ├── config_parser.R         #   YAML設定ファイル解析
│   ├── data_preprocessor.R     #   Google Sheets API → CSV変換
│   ├── data_loader.R           #   CSV/Excel読み込み・バリデーション
│   ├── robyn_builder.R         #   Robyn InputCollect構築・実行・出力
│   ├── model_selector.R        #   Paretoモデル自動スコアリング（講義/加重2モード）
│   ├── excel_populator.R       #   Excel VBAワークブックへデータ投入
│   ├── zenmodel_populator.R    #   全モデル整理.xlsm 元データ投入（VBA前）
│   ├── postprocess_zenmodel.R  #   全モデル整理.xlsm 一覧/まとめ/突合用更新（VBA後）
│   ├── modering_populator.R    #   modering.xlsm 自動データ投入
│   └── iteration_manager.R     #   反復改善サイクル管理
├── configs/                    # プロジェクト別YAML設定
│   ├── default_config.yaml     #   テンプレート（新規はこれをコピー）
│   └── project_config.yaml     #   プロジェクト設定（8チャネル）
├── data/                       # 入力データ（CSV/Excel）
│   └── myproject_mmm.csv       #   前処理済みMMM用データ
├── scripts/                    # ユーティリティスクリプト
│   └── google_auth.R           #   Google OAuth認証ヘルパー
├── docs/                       # 設計ドキュメント
│   └── requirements.md         #   全Phase仕様書（1315行）
├── Robyn_YYYYMMDDHHMI_init/    # Robyn出力フォルダ（実行ごとに生成）
│   ├── optimize.xlsm           #   予算最適化ワークブック
│   ├── predict.xlsm            #   予測ワークブック
│   ├── modering.xlsm           #   モデリング支援ワークブック
│   ├── 全モデル整理.xlsm        #   全Paretoモデル統計整理
│   ├── residual_analysis.csv   #   残差分析レポート（反復改善時）
│   ├── suggested_dummies.csv   #   ダミー変数提案（反復改善時）
│   ├── pareto_*.csv            #   Robyn出力CSV群
│   ├── *.png                   #   可視化プロット群
│   └── RobynModel-models.json  #   モデル定義
├── model_evolution.csv         #   モデル進化追跡（イテレーション履歴）
└── templates/                  # Excelテンプレート（講義配布物）
```

### パイプライン全体フロー（10ステップ）
```
[Step 0] --config で YAML設定ファイル指定
    ↓
[Step 1] モジュール読み込み（R/*.R × 9モジュール）
    ↓
[Step 2] 設定ファイル解析・バリデーション
    ↓
[Step 2.5] --preprocess 指定時: Google Sheets API → CSV変換
    ↓
[Step 3] データ読み込み・バリデーション・欠損値補完・ダミー変数自動検出
    ↓
[Step 4] Robyn実行（InputCollect構築 → robyn_run → robyn_outputs）
    ↓
[Step 5] モデルスコアリング・自動選択（講義/加重2モード対応）
    ↓
[Step 6] 既存Excel互換更新（モデル選択用.xlsm, 全モデル整理.xlsm）
    ↓
[Step 6.5] 全モデル整理の完全生成（HistData/SpreadSummary/まとめ/一覧）
    ↓
[Step 7] Excel VBAワークブックへデータ投入（optimize.xlsm, predict.xlsm）
         レスポンスカーブ・予測実績・HoldOutTestも含む
    ↓
[Step 7.5] modering.xlsm データ投入（残差分析/ラグ相関/相関行列/ダミー/進化/ハイパーP）
    ↓
[Step 8] 反復改善分析（iteration.enabled=true時のみ）
    ↓
[完了] Excelを開いて Ctrl+Shift+F9 → Solver → 結果確認
```

---

## Skill 1: パイプライン実行コマンド

### 基本コマンド
```bash
# フル実行（データ取得 + MMM + Excel）
Rscript robyn_auto.R --config configs/project_config.yaml --preprocess

# CSVが既にある場合（Robyn実行 + Excel）
Rscript robyn_auto.R --config configs/project_config.yaml

# 設定・データ検証のみ（Robyn実行なし）
Rscript robyn_auto.R --config configs/project_config.yaml --dry-run

# 既存Robyn出力からExcel再投入のみ
Rscript robyn_auto.R --config configs/project_config.yaml \
  --skip-robyn --robyn-folder Robyn_202602230120_init

# 特定モデルを指定して使用
Rscript robyn_auto.R --config configs/project_config.yaml \
  --skip-robyn --model 4_180_9

# VBA実行後の後処理（一覧/まとめ/突合用を更新）
Rscript robyn_auto.R --config configs/project_config.yaml --postprocess

# 後処理: フォルダ・モデル指定
Rscript robyn_auto.R --config configs/project_config.yaml \
  --postprocess --robyn-folder Robyn_202602250140_init --model 1_145_9
```

### CLIオプション一覧
| オプション | 説明 |
|-----------|------|
| `--config` | YAML設定ファイルのパス（必須） |
| `--preprocess` | Google Sheets API前処理を実行 |
| `--dry-run` | データバリデーションのみ（Robyn実行なし） |
| `--skip-robyn` | Robyn実行をスキップし既存出力を使用 |
| `--robyn-folder` | 使用するRobynフォルダ名（`--skip-robyn`時） |
| `--model` | 使用するモデルID（自動選択をスキップ） |
| `--postprocess` | VBA実行後の後処理（一覧/まとめ/突合用を更新） |

### 実行環境の前提条件
```
R パッケージ:
├── Robyn (Meta公式MMMパッケージ)
├── reticulate (Python連携、nevergrad最適化用)
├── yaml (YAML設定解析)
├── openxlsx (Excel読み書き)
├── dplyr (データ操作)
├── optparse (CLI引数解析)
├── googlesheets4 (Google Sheets API)
├── googledrive (Google Drive API)
└── gargle (Google認証)

Python環境:
└── conda env: r-reticulate (nevergrad インストール済み)

Google認証:
└── 初回は RStudio で source('scripts/google_auth.R') → ブラウザ認証
    認証トークンはキャッシュされ、以降は自動で再利用
```

> 詳細は `references/system-architecture.md` を参照

---

## Skill 2: YAML設定ファイルの構成

### 設定ファイルのセクション構成
```yaml
project:        # プロジェクト基本情報（name, output_dir, mmm_dir）
preprocess:     # [オプション] Google Sheets API前処理設定
data:           # データファイル設定（file, date_col, dep_var）
prophet:        # Prophet分解設定（vars, country）
context_vars:   # コンテキスト変数リスト
channels:       # メディアチャネル定義（media_var, spend_var）
hyperparameters: # ハイパーパラメータ範囲（defaults + overrides）
robyn:          # Robyn実行パラメータ（iterations, trials, seed）
model_selection: # モデル選択基準（weights, top_n）
window:         # 分析ウィンドウ（start, end）
templates:      # Excelテンプレートパス
```

### チャネル定義の基本パターン
```yaml
channels:
  # IMP（インプレッション）をmedia_varとして使用（推奨）
  - name: "Meta"
    media_var: "Meta_imp"       # Robynがアドストック変換する変数
    spend_var: "Meta_cost"      # 費用変数

  # IMPがない場合はcostで代用（Amazon, 楽天等）
  - name: "Amazon_Ads"
    media_var: "amazon_cost"    # cost = media_var（代用パターン）
    spend_var: "amazon_cost"
```

### ハイパーパラメータのYAML型注意
```yaml
# ⚠️ 重要: 整数と小数が混在するとRで list 型になり Robyn がクラッシュする
hyperparameters:
  defaults:
    alphas: [0.8, 1.5]
    gammas: [0.8, 1.0]
    thetas: [0.0, 0.949]    # ← 0 ではなく 0.0 と書く（型統一）
```

> 詳細は `references/config-reference.md` を参照

---

## Skill 3: Google Sheets APIデータ前処理

### 仕組み
```
1. googledrive::drive_cp() でスプレッドシートを一時コピー（セル保護回避）
2. 各月について:
   a. A2 ← year, A3 ← month を googlesheets4::range_write() で書き込み
   b. Sys.sleep(2) でVLOOKUP再計算待ち
   c. データ行を range_read() で読み取り
3. 全月分を rbind → 値クリーニング → 日付キーで merge
4. CFダミー変数自動生成（makuake_revenue > 0 の期間を検出）
5. CSV出力 → 一時コピー削除
```

### 設定ファイルの前処理セクション
```yaml
preprocess:
  spreadsheet_id: "YOUR_SPREADSHEET_ID"   # Google SheetsのID
  output_file: "data/project_mmm.csv" # 出力先
  sleep_sec: 2                        # VLOOKUP再計算待ち秒数

  sogo_sheet:                         # 総合デイリーシート
    name: "総合デイリー"
    header_row: 3                     # ヘッダー行番号
    date_col: "A"                     # 日付の列文字
    orders_col: "G"                   # 注文数の列文字
    revenue_col: "D"                  # 売上の列文字
    pv_col: "X"                       # PVの列文字
    extra_cols:                        # 追加取得列
      amazon_cost: "AJ"
      rakuten_cost: "AP"

  platforms:                           # プラットフォーム別デイリーシート
    - name: "Meta"
      sheet: "Meta_デイリー（→shopify）"
      header_row: 2
      date_col: "A"
      imp_col: "E"                    # IMP列
      cost_col: "C"                   # 費用列
      # click_col: "F"               # Click列（オプション）
```

### Google認証の初回セットアップ
```r
# RStudio で実行（ブラウザが開く）
source("C:/Users/username/Documents/MMM/scripts/google_auth.R")
# → Google アカウントでログイン → 権限許可
# → トークンがキャッシュされ、以降 Rscript でも自動認証
```

> 詳細は `references/data-preprocessing.md` を参照

---

## Skill 4: 新規クライアントのセットアップ手順

### 手順
```
1. configs/default_config.yaml をコピーして新規YAML作成
   cp configs/default_config.yaml configs/newclient_config.yaml

2. Google Sheetsの場合:
   a. スプレッドシートの構造を調査（タブ名、ヘッダー行、列マッピング）
   b. preprocess セクションを追記
   c. 各シートの列文字を正確にマッピング

3. CSV/Excelの場合:
   a. data.file にパスを指定
   b. 列名を確認して channels, context_vars を設定

4. channels セクションでメディアチャネルを定義
   - IMP列があれば media_var: "{Name}_imp"
   - なければ media_var: "{name}_cost"（費用で代用）

5. window セクションで分析期間を設定
   - 広告データが存在する日付範囲に合わせる

6. dry-run で検証
   Rscript robyn_auto.R --config configs/newclient_config.yaml --dry-run

7. フル実行
   Rscript robyn_auto.R --config configs/newclient_config.yaml --preprocess
```

### 必要データ量の目安
| 日数 | 評価 | 推奨アクション |
|------|------|-------------|
| 60日未満 | 不十分 | データ蓄積を待つ |
| 60-90日 | 最低限 | 初回実行可能。精度は低い |
| 90-180日 | 良好 | 標準的な分析が可能 |
| 180-365日 | 優良 | 季節性も捕捉可能 |
| 365日+ | 理想 | フル機能で高精度分析 |

> 詳細は `references/project-setup.md` を参照

---

## Skill 5: トラブルシューティング

### よくあるエラーと対処法

**1. YAML型の不一致（thetas: [0, 0.949]）**
```
エラー: "comparison of these types is not implemented"
原因: YAML で [0, 0.949] → R で int と double の混在 → list型になる
対処: [0.0, 0.949] と明示的に double にする
防御: config_parser.R の build_hyperparameters() で as.numeric() ラッパー済み
```

**2. Google Sheetsの列マッピングミス**
```
症状: 特定チャネルの cost が全日 0
原因: 列文字（B, C, D...）がシートの実際の列と一致していない
対処: Google Sheetsのシートを手動で確認し、正しい列文字に修正
検証: scripts/check_data.R でチャネル別の非ゼロ日数・合計を確認
```

**3. Google認証エラー（non-interactive）**
```
エラー: "Can't get Google credentials in non-interactive session"
原因: Rscript（非対話モード）でトークンキャッシュがない
対処: RStudio で source('scripts/google_auth.R') を先に実行
```

**4. Robyn Prophet警告**
```
警告: "Currently, there's a known issue with prophet that may crash"
対処: 通常は無視して問題なし（Robyn #472 の既知問題）
```

**5. Weak relationship for media_var and spend**
```
警告: Weak relationship for: "Meta_imp", "Google_imp" and their spend
意味: IMP と cost の相関が低い（min.adj.R2 < 0.8）
対処: 通常は問題なし。Robynの推奨通りチャネル分割を検討
```

**6. Zero Coefficient が多い**
```
症状: 8チャネル中4つ以上の係数が0
原因: データ期間が短い / チャネルのデータが少ない / 多重共線性
対処: データ蓄積を待つ / チャネルを減らす / 支出バリエーションを確認
```

**7. R segfault（Rscript -e でインラインR実行時）**
```
症状: Rscript -e "..." でクラッシュ
対処: .R ファイルに書き出して Rscript file.R で実行
```

> 詳細は `references/troubleshooting.md` を参照

---

## Skill 6: モデル選択基準（2モード対応）

### モード A: 講義準拠 段階的フィルタリング（mode="lecture"）
```
Step 1: ゼロ係数フィルタ → 最小ゼロ数のモデルを残す
Step 2: 効果合計上位50% → メディアン以上のモデルを残す
Step 3: 符号チェック → 正であるべき変数の違反が最少のモデルを残す
Step 4: R²×(1-RSSD) → バランススコアで最終ランキング

講義の手動選択プロセスを忠実に再現。
少量データでもロバストな選択が可能。
```

### モード B: 加重スコアリング（mode="weighted"）
```
total_score = Σ(正規化指標 × 重み)

デフォルト重み:
├── zero_coef_penalty: 0.30   # 係数0のチャネル数（少ないほど良い）
├── effect_total:      0.25   # メディア効果の合計（大きいほど良い）
├── rsq_train:         0.20   # 訓練R²（高いほど良い）
├── decomp_rssd:       0.15   # 分解RSSD（低いほど良い）
└── sign_violation:    0.10   # 符号違反の数（少ないほど良い）
```

### 結果の読み方
```
Rank solID         Score     R²    RSSD  Zero Sign  Effect
--------------------------------------------------------------
1    4_180_9       0.933  0.7975  0.9746     4    0    4930
│    │             │      │       │          │    │    │
│    │             │      │       │          │    │    └─ メディア効果合計
│    │             │      │       │          │    └──── 符号違反数（0=良好）
│    │             │      │       │          └─────── 係数0のチャネル数
│    │             │      │       └────────────── 分解RSSD（1.0に近いほど良い）
│    │             │      └───────────────────── 訓練R²
│    │             └──────────────────────────── 総合スコア（1.0に近いほど良い）
│    └────────────────────────────────────────── モデルID
└──────────────────────────────────────────────── 順位
```

---

## Skill 7: 出力ファイルの活用

### Excelワークブック
```
optimize.xlsm:
├── 選択シート: B2=モデルID, B4=フォルダ名
├── Actualシート: 日次の実績データ（DATE, dep_var, 各チャネルcost/media_var）
│   ├── Row 2: 各チャネルのcost合計
│   ├── Row 3: 各チャネルのcost合計（=Row2）
│   └── Row 4: ヘッダー名（チャネル名）
├── パラメータ1シート: ハイパーパラメータ（アドストック係数等）
├── ALLDECOMPシート: 日次チャネル分解マトリクス
├── モデル1シート: モデル係数・効果量サマリー
├── Adstock(Row4)/正規化(Row3)/変形(Row7): ヘッダーがActualと一致必須
│   └── 変形シートのXLOOKUPがパラメータ1を参照（alpha/gamma/theta取得）
└── 試算シート: Solver で予算最適化実行
    ├── Row 1: マージン値（利益率）
    ├── Row 8: COST = Actual!B3 × B12
    ├── Row 9: LIFT = SUM(B14:B850) ← 変形値 × 係数
    ├── Row 10: 係数 = XLOOKUP(B13, モデル1!$B:$B, モデル1!$C:$C)
    ├── Row 12: 実績比率（Solver変数セル）← ★ここをSolverが最適化
    ├── Row 13: チャネル名 = Actual!$B4（動的参照）
    ├── AC3: CPA = AC8/AC9
    ├── AC8: 総予算 = SUM(B8:Z8)
    └── AC9: 総LIFT = SUM(B9:Z9)
```

### 数式パイプライン（講義テンプレートの核心）
```
Actual → Adstock → 正規化 → 変形 → 試算
(生IMP)  (幾何減衰)  (正規化×比率)  (Hill飽和)  (×係数=LIFT)
                                                      ↓
                                              Solver: LIFT最大化
                                              制約: 総予算一定
```

### Solver手動実行手順（講義ワークフロー）
```
Step 1: optimize.xlsm をExcelで開く
        → 修復ダイアログが出たら「はい」で進む

Step 2: Ctrl+Shift+F9 で全数式を再計算
        → 試算シートのAC8(総予算), AC9(総LIFT)に値が入ることを確認

Step 3: Solver実行（試算シート）
        → データ > ソルバー を開く
        → 目的セル:       $AC$9
        → 目標値:         最大値
        → 変数セル:       $B$12:$I$12（チャネル数に応じて調整）
        → 制約条件の追加:
          (1) $AC$8 = [再計算後のAC8の値]（予算一定制約）
          (2) $B$12:$I$12 >= 0（非負制約）
        → 解決方法:       GRG非線形
        → 「解決」ボタンを押す

Step 4: 結果確認
        → 「ソルバーによって解が見つかりました」→ OK
        → 試算シートのRow12(実績比率)が変化していることを確認
        → CPA(AC3)が改善していることを確認
        → Ctrl+S で保存
```

### ★ Excel投入の重要修正（2026-02検証済み）
```
excel_populator.R で以下3件の不具合を修正済み。
テンプレートのチャネル数(25)より少ないチャネル(8等)を投入する際に発生。

■ Fix 1: Actual Row 1 平均行のクリア漏れ
  症状: 試算AC8(総予算)に旧テンプレートの過大値が残存
  原因: write_actual_sheet で avg_row(Row1) がクリア対象に含まれていなかった
  修正: avg_row = act$media_totals_row - 1 を clear_rows に追加

■ Fix 2: 変形シート パラメータ行(α/γ/θ)のクリア漏れ
  症状: 変形 Row 4-6 の J列以降に旧テンプレートの α/γ/θ 値が残存
  原因: update_transform_headers の sheet_param_rows に変形シートが未定義
  修正: 変形 rows = c(4, 5, 6) を sheet_param_rows に追加
  注意: openxlsx の read.xlsx は空行を折り畳む → Row 1-3は空(Row 4=α)

■ Fix 3: 試算 Row 13 データヘッダーの更新漏れ
  症状: 試算の日次データXLOOKUPが旧チャネル名で変形シートを参照→チェーン破損
  原因: sheet_header_map に試算シートが含まれていなかった
  修正: 試算 row = ss$summary_rows + 1 (=13) を sheet_header_map に追加

XLOOKUPチェーン全体:
  Actual(B4) = Adstock(B4) = 正規化(B3) = 変形(B7) = 試算(B13) ← 全一致必須
```

### ★ Solver自動化は断念（教訓）
```
pywin32 COM経由でのSolver自動化を複数アプローチで試行したが断念:
1. openxlsx生成の.xlsmはXML欠落でCOM Workbooks.Open()が失敗
2. os.startfile()→GetActiveObject()でGUI修復経由は成功するが:
   - excel.Run("SolverOk", ...) のEngine=2がLP(code 7)にフォールバック
   - VBA注入アプローチはVBProjectアクセス信頼設定が必要
   - レジストリ経由で信頼設定を変更してもRun("RunSolverAuto")がCOMエラー
3. Solver設定の不整合で講義と異なる結果が出るリスクが高い

→ Solver実行は手動（講義ワークフロー通り）が最善。
  自動化範囲はデータ投入まで、Solver以降は手動判断。
```

### Robyn出力ファイル
```
pareto_aggregated.csv:       モデル別の変数効果量・R²・RSSD等
pareto_hyperparameters.csv:  モデル別のハイパーパラメータ値
pareto_alldecomp_matrix.csv: 日次のチャネル分解マトリクス（全モデル）
pareto_media_transform_matrix.csv: メディア変換後の値
pareto_clusters.csv:         クラスタリング結果
RobynModel-models.json:      全モデルの定義（再現用）

可視化:
pareto_front.png:           Paretoフロント（NRMSE vs DECOMP.RSSD）
pareto_clusters_detail.png: クラスター別の詳細
CPA_convergence1/2.png:     収束プロット
prophet_decomp.png:         Prophet分解（トレンド/曜日/祝日）
hypersampling.png:          ハイパーパラメータ探索空間
```

---

## 運用サイクル

### 月次更新フロー
```
1. window.end を更新（project_config.yaml）
2. パイプライン実行:
   Rscript robyn_auto.R --config configs/project_config.yaml --preprocess
3. 結果比較:
   前回の Robyn_*_init フォルダと比較してモデル精度の推移を確認
4. Excel確認:
   optimize.xlsm を開いて Solver → 予算最適化推奨値を確認
5. アクション:
   ec-mmm-methodology スキルの解釈基準に基づき予算配分を判断
```

### データ蓄積に伴う改善ポイント
```
初期（60-90日）:
├── Zero Coef が多い（正常）
├── 全体的な方向性のみ参考に
└── 毎月再実行してモデル改善を確認

中期（180-365日）:
├── Zero Coef が減少し始める
├── チャネル別の比較が意味を持ち始める
└── 季節性の影響が捕捉可能に

安定期（365日+）:
├── 全チャネルの効果が安定
├── 限界ROI・飽和曲線が信頼できる精度に
└── 予算最適化の推奨を実行に移せる
```

---

## Skill 8: 全モデル整理（zenmodel_populator.R + postprocess_zenmodel.R）

### 投入先: 全モデル整理.xlsm（2段階ワークフロー）
```
全Paretoモデルの効果をマトリクス化し、統計整理・CPA/効果%を自動計算。
ビジネス判断に必要なデータを4+2シートに投入。

■ Phase 1: VBA前（zenmodel_populator.R — パイプライン実行時に自動）
├── HistData: 行=モデルID × 列=変数名 のxDecompAggマトリクス（Rで直接生成）
├── 一覧: 変数分類（base/trend_dummy/promotion）— 仮データ
└── まとめ: 選択モデルのCPA/Spend%/効果% — 仮データ

■ VBA手動実行（ユーザー操作）
└── Excelで「全モデルの整理()」VBAマクロを実行 → 保存・閉じる
    → HistData から SpreadSummary が生成される

■ Phase 2: VBA後（postprocess_zenmodel.R — --postprocess で実行）
├── 一覧: SpreadSummary + pareto_aggregated.csv で正式更新（10列）
├── まとめ: プロモーション施策のCPA/Spend%/効果%/COST/効果（13列+合計行）
└── 突合用: プロモーション施策の統計値（5列）

コマンド:
  Rscript robyn_auto.R --config configs/project_config.yaml --postprocess
  Rscript robyn_auto.R --config configs/project_config.yaml \
    --postprocess --robyn-folder Robyn_YYYYMMDD_init --model <モデルID>

自動検出:
├── --robyn-folder 省略時: 最新のRobyn出力フォルダを自動検出
└── --model 省略時: optimize.xlsm の「選択モデル」シート B2 から取得
```

---

## Skill 9: modering.xlsm連携（modering_populator.R）

### 投入先: modering.xlsm（モデリング支援ワークブック）
```
講義の反復改善ワークフローを支援する7シートに自動データ投入。

シート構成:
├── NO2: 残差分析（日付/実績/予測/残差/フラグ/UP・DOWN）
├── ラグ相関比較: チャネル別ラグなし相関 vs 1日ラグ相関
├── soukan: 全変数間の相関行列
├── ダミー: 既存UP/DOWN/CFダミー変数一覧
├── モデル進化: イテレーション別R²/RSSD/NRMSE追跡
├── ハイパーP: チャネル別Alpha/Gamma/Theta値
├── コード作成: Robyn設定コード自動生成
└── 最終モデル選択: 選択モデルID・フォルダ名
```

---

## Skill 10: 反復改善サイクル（iteration_manager.R）

### 反復改善の3ステップ
```
D-1: 残差分析レポート
├── actual - predicted を日次計算
├── |residual| / actual > threshold（デフォルト30%）の大乖離日を抽出
└── 出力: residual_analysis.csv

D-2: ダミー変数提案
├── 大乖離日のうち既存ダミーでカバーされていない日を抽出
├── UP/DOWN を残差符号で自動判定（UP=実績>予測, DOWN=実績<予測）
├── 提案はCSV出力のみ → 自動追加はしない（講義準拠）
└── 出力: suggested_dummies.csv

D-3: モデル進化追跡
├── R², RSSD, NRMSE, ゼロ係数数, モデルIDを記録
├── 前回イテレーションとの比較（改善/悪化判定）
└── 出力: model_evolution.csv（イテレーション履歴）
```

### 有効化
```yaml
# config.yaml
iteration:
  enabled: true               # falseのままだとStep 8はスキップ
  max_iterations: 3
  residual_threshold: 0.3     # 30%超で大乖離
```

### 反復改善ワークフロー（講義準拠）
```
1. 初回Robyn実行 → モデル選択 → Excel投入
2. config.yaml の iteration.enabled: true に変更
3. 再実行 → 残差分析 → suggested_dummies.csv を確認
4. 必要なダミーをCSVに手動追加（UP_YYYYMMDD, DOWN_YYYYMMDD）
5. config.yaml の context_vars に自動検出されるので追加設定不要
6. Robyn再実行 → モデル進化を比較 → R²改善を確認
7. 繰り返し（最大3回程度）
```

---

## 連携スキル
- **ec-mmm-methodology**: MMM結果の解釈・予算最適化判断・飽和曲線分析
- **ec-insight**: データ品質チェック・異常検知・レポーティング
- **ec-acquisition**: チャネル別予算配分の実行
- **cfo**: ROI/CPA の財務的妥当性評価
