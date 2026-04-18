# トラブルシューティング — MMM パイプライン

## カテゴリ別エラー対処

---

### A. YAML設定エラー

#### A1. ハイパーパラメータの型不一致
```
エラーメッセージ: "comparison of these types is not implemented"
発生箇所: robyn_inputs() の hyperparameters 設定時

原因:
  YAML の [0, 0.949] → R で int 0 と double 0.949 の混在 → list型
  Robynは numeric vector を期待するため比較演算で失敗

修正:
  # BAD:  thetas: [0, 0.949]
  # GOOD: thetas: [0.0, 0.949]

防御コード（config_parser.R に実装済み）:
  hp_list[[paste0(media_var, "_alphas")]] <- as.numeric(alphas)
  hp_list[[paste0(media_var, "_gammas")]] <- as.numeric(gammas)
  hp_list[[paste0(media_var, "_thetas")]] <- as.numeric(thetas)
```

#### A2. 必須セクション不足
```
エラーメッセージ: "設定ファイルに必須セクションがありません: xxx"
原因: YAMLファイルに必須セクションがない
修正: default_config.yaml と比較して不足セクションを追加
必須: project, data, prophet, channels, hyperparameters, robyn, model_selection, window
```

#### A3. 日付形式エラー
```
エラーメッセージ: "window.start / window.end の日付形式が不正です"
修正: "2025-10-01" 形式（YYYY-MM-DD）で指定
```

---

### B. Google Sheets API エラー

#### B1. 認証エラー（非対話モード）
```
エラーメッセージ: "Can't get Google credentials in non-interactive session"

原因: Rscript（バッチモード）でトークンキャッシュが存在しない
修正:
  1. RStudio を開く
  2. source("C:/Users/username/Documents/MMM/scripts/google_auth.R")
  3. ブラウザで Google アカウント認証
  4. 再度 Rscript robyn_auto.R --preprocess を実行
```

#### B2. スプレッドシートアクセス拒否
```
エラーメッセージ: "403 Forbidden" or "404 Not Found"

原因:
  - スプレッドシートIDが間違っている
  - 認証アカウントに閲覧/編集権限がない
修正:
  - spreadsheet_id を確認（URLの /d/ と /edit の間の文字列）
  - Google Sheets の共有設定で認証アカウントにアクセス権付与
```

#### B3. レート制限（429 Too Many Requests）
```
エラーメッセージ: "429" or "RESOURCE_EXHAUSTED"

原因: Google Sheets API のクォータ超過
修正:
  - config の sleep_sec を 3-5 に増やす
  - 1分待ってから再実行
  - 取得月数が多い場合は window を分割して段階的に取得
```

#### B4. シート名不一致
```
エラーメッセージ: "Sheet 'xxx' not found"

原因: YAML の sheet 名とスプレッドシートのタブ名が一致しない
修正:
  - 全角/半角の違い（!と！、()と（）等）
  - 空白の有無
  - Google Sheets でタブ名を正確にコピーして YAML に貼り付ける
```

---

### C. データエラー

#### C1. 特定チャネルの cost が全日 0
```
原因: 列マッピングが間違っている（よくある）
診断:
  Rscript scripts/check_data.R で各列の非ゼロ日数を確認
修正:
  Google Sheets で実際のシートを開き、正しい列文字を確認
  config の cost_col / imp_col を修正
  --preprocess で再実行
```

#### C2. Click列がCTR値（小数）
```
症状: {Platform}_click の値が 0.001-0.05 程度の小数
原因: Click列と思っていた列がCTR（%値）だった
修正:
  - click_col を削除（click はMMMに必須ではない）
  - または正しいClick列を指定
```

#### C3. データ行数が想定より少ない
```
症状: 5ヶ月指定なのに100行しかない
原因:
  - 一部の月でデータが取得できていない
  - 日付パースに失敗している行がある
  - total_orders が 0 の日が除外されている
診断:
  - パイプラインログで各月の取得行数を確認
  - df$DATE のNA数を確認
```

#### C4. データファイルが見つからない
```
エラーメッセージ: "データファイルが見つかりません"

原因:
  - preprocess セクションがあるのに --preprocess を付けていない
  - output_file のパスが間違っている
修正:
  - --preprocess オプションを付けて実行
  - config の data.file と preprocess.output_file が一致していることを確認
```

---

### D. Robyn実行エラー

#### D1. Prophet クラッシュ警告
```
警告: "Currently, there's a known issue with prophet that may crash"
対処: 通常は無視して問題なし（Robyn GitHub #472）
     実際にクラッシュした場合:
     - prophet_vars から "holiday" を一時的に除外してテスト
     - R/Python環境を最新に更新
```

#### D2. train_size 自動追加警告
```
警告: "Automatically added missing hyperparameter range: 'train_size'"
対処: 無視してOK（Robynが自動で c(0.5, 0.8) を追加）
```

#### D3. Weak relationship 警告
```
警告: Weak relationship for: "Meta_imp", "Google_imp" and their spend
意味: IMP と cost の相関が低い（R² < 0.8）
原因:
  - IMPの変動がcostに比例しない（ターゲティング変更等）
  - 一部期間でデータが0
対処:
  - 通常は問題なし（Robynの推奨通知）
  - 深刻な場合はチャネル分割を検討
```

#### D4. DECOMP.RSSD 未収束
```
メッセージ: "DECOMP.RSSD NOT converged"
意味: チャネル分解の安定性が不十分
原因:
  - データ期間が短い
  - チャネル数に対してデータポイントが少ない
対処:
  - iterations を増やす（2000→5000）
  - trials を増やす（5→8）
  - データ蓄積を待つ
  - チャネル数を減らす
```

#### D5. Zero Coefficient が多い
```
症状: 8チャネル中4+の係数が0（model_selector の Zero列）
意味: Robynがそのチャネルに効果を検出できなかった
原因:
  - データ期間が短い（154日ではチャネル8つは多い）
  - チャネルの支出バリエーションが少ない（毎日同額）
  - 実際にそのチャネルの効果が小さい
対処:
  - データ蓄積に伴い自然に改善
  - データが少ないチャネルを一時的にコメントアウト
  - model_selection.weights.zero_coef_penalty を調整
```

---

### E. Excel投入エラー

#### E1. テンプレートが見つからない
```
エラーメッセージ: "optimize.xlsmテンプレートが見つかりません"
修正:
  - config.templates.dir が正しいパスか確認
  - テンプレートファイルが存在するか確認
  - パスに日本語が含まれる場合は / で統一
```

#### E2. Excel書き込みエラー
```
エラーメッセージ: openxlsx 関連のエラー
原因: Excelファイルが別プロセスで開かれている
修正: Excelを閉じてから再実行
```

#### E3. 変形シートのXLOOKUPが全て「該当なし」
```
症状: 変形シートのalpha/gamma/theta欄に「該当なし」と表示
原因: テンプレートのヘッダー名不一致
  - テンプレート旧チャネル名: SEM_PC_cl, Pmax_MOBILE_cl, META_imp...
  - 我々の新チャネル名: Meta_imp, Google_imp, Pinterest_imp...
  - 変形シートのXLOOKUP: 変形!B7("SEM_PC_cl")をパラメータ1で検索→マッチしない

対処（実装済み: excel_populator.R の update_transform_headers()）:
  - Adstock Row4 / 正規化 Row3 / 変形 Row7 のヘッダーをActualと一致させる
  - 不要列（チャネル数+2 ～ 26列目）を空白化

検証: Excelで開いて変形シートのB4(alpha), B5(gamma), B6(theta)に数値が表示されること
```

#### E4. ゴーストコストデータ（試算AC8に過大な予算値）
```
症状: 試算シートのAC8(総予算)が実際より大きい値を示す
原因: テンプレートが25チャネル対応（B-Z列）で、我々は8チャネル（B-I列）のみ。
  未使用のJ-Z列にテンプレート元のcostデータが残っている:
  - Actual Row 2-3: 旧チャネルのcost合計が残存
  - 試算 Row 1(マージン): 1のまま（COST計算に影響）
  - 試算 Row 12(実績比率): 1のまま（COST計算に影響）
  → AC8 = SUM(B8:Z8) にゴーストcostが加算される

対処（実装済み: excel_populator.R の write_actual_sheet() + update_transform_headers()）:
  - Actual Row 2-4: 不要列を0/空白でクリア
  - 試算 Row 1, Row 12: 不要列を0に設定

検証: 試算AC8 = 各チャネルRow8の合計と一致すること
```

#### E5. openxlsxの制限（XMLドロップ問題）
```
症状: openxlsx(R)で保存した.xlsmファイルに以下の問題:
  - Excel GUI で開くと「修復しますか？」ダイアログが表示される
  - Python openpyxl で開けない（"no item named 'xl/drawings/drawing1.xml'"）
  - pywin32 COM の Workbooks.Open() で失敗（エラー -2146827284）

原因: openxlsx はマクロ対応だが、Drawing XML等一部のXML要素を保存時にドロップする

対処:
  - Excel GUIで開く（自動修復が働く）→ 動作に問題なし
  - COM経由で開く場合は os.startfile() でGUI起動→GetActiveObject()で接続
  - 「修復しますか？」は「はい」で進めて問題なし

根本解決（不可）: openxlsx の仕様。writexl等の代替は.xlsx専用で.xlsmに対応しない
```

#### E6. ifelse() でSpend%/効果%が全施策同一値
```
症状: まとめシートのSpend%/効果%が全行同じ値
原因: R の ifelse() はスカラー条件+ベクター値で最初の1要素しか返さない
  ifelse(total_cost > 0, promo_detail$cost / total_cost, 0)
  → total_cost > 0 はスカラーTRUEなので、ベクターの1要素目だけが返る

対処（修正済み: zenmodel_populator.R + postprocess_zenmodel.R）:
  # BAD:  ifelse(total_cost > 0, promo_detail$cost / total_cost, 0)
  # GOOD: if (total_cost > 0) promo_detail$cost / total_cost else rep(0, nrow(promo_detail))
```

#### E7. clear_old_data のtemplate_max_rowが大きすぎて数式破壊
```
症状: Actualシート以外の数式が壊れる
原因: clear_old_data() の template_max_row=841 が、数式セルにまでNA上書きを行う
対処（実装済み）: template_max_row を 250 に変更（データ範囲+バッファに制限）
```

---

### E-POST. 後処理（--postprocess）エラー

#### EP1. SpreadSummary が空
```
エラーメッセージ: "[postprocess] SpreadSummary が空です。
  → Excelで「全モデルの整理()」VBAマクロを実行し、保存・閉じてから再実行してください。"

原因: VBAマクロ未実行、またはExcelを保存せずに閉じた
対処:
  1. 全モデル整理.xlsm をExcelで開く
  2. Alt+F8 → 「全モデルの整理」を選択 → 実行
  3. Ctrl+S で保存
  4. ファイルを閉じる
  5. --postprocess を再実行
```

#### EP2. モデルIDが見つからない
```
エラーメッセージ: "[postprocess] モデルID 'xxx' が pareto_aggregated.csv に存在しません。"
対処: --model で正しいモデルIDを指定
  Rscript robyn_auto.R --config configs/project_config.yaml \
    --postprocess --model 4_180_9
```

#### EP3. optimize.xlsm からモデルIDを読み取れない
```
エラーメッセージ: "[postprocess] optimize.xlsm に '選択モデル' シートがありません。"
対処: --model でモデルIDを直接指定
```

---

### F. 環境エラー

#### F1. Rscript -e でセグフォ
```
症状: Rscript -e "library(Robyn); ..." でクラッシュ
原因: Windows環境でのRscriptインライン実行の既知問題
対処: .R ファイルに書き出して Rscript file.R で実行
```

#### F2. conda環境が見つからない
```
エラーメッセージ: "conda environment 'r-reticulate' not found"
修正:
  conda create -n r-reticulate python=3.10
  conda activate r-reticulate
  pip install nevergrad
```

#### F3. nevergrad インポートエラー
```
エラーメッセージ: "nevergrad" not available
修正:
  conda activate r-reticulate
  pip install nevergrad
  # R内で確認:
  reticulate::use_condaenv("r-reticulate")
  reticulate::py_module_available("nevergrad")
```

---

## デバッグ手順

### 段階的デバッグスクリプト
問題が発生した場合、以下の順序でデバッグ:

```r
# Step 1: 設定とデータの検証
Rscript robyn_auto.R --config configs/project_config.yaml --dry-run

# Step 2: robyn_inputs() のテスト
# scripts/debug_robyn.R を作成して実行
library(Robyn); library(reticulate)
source("R/config_parser.R"); source("R/data_loader.R")
config <- parse_config("configs/project_config.yaml")
df <- load_data(config)
use_condaenv("r-reticulate")
# robyn_inputs() を個別に実行...

# Step 3: hyperparameters のテスト
str(config$hyperparameter_list)  # list ではなく num [1:2] であること

# Step 4: robyn_run() のテスト（outputs=FALSE で高速）
OutputModels <- robyn_run(InputCollect, iterations=100, trials=1, outputs=FALSE)

# Step 5: フル実行
Rscript robyn_auto.R --config configs/project_config.yaml
```

### データ品質チェック
```r
# scripts/check_data.R で全列のサマリーを出力
df <- read.csv("data/myproject_mmm.csv")
for (col in names(df)) {
  if (col == "DATE") next
  cat(sprintf("%-25s: non-zero=%d, sum=%.0f\n",
              col, sum(df[[col]] != 0), sum(df[[col]])))
}
```
