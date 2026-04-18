# システムアーキテクチャ — MMM パイプライン

## Rモジュール詳細

### robyn_auto.R（メインオーケストレーター）
- CLI引数解析 → 各モジュール呼び出し → 結果出力
- `get_script_dir()` でスクリプト位置を自動検出（Rscript/RStudio/source対応）
- `update_legacy_excel()` で「モデル選択用.xlsm」「全モデル整理.xlsm」を更新
- エラーは `tryCatch` で捕捉し、`traceback()` を出力

### R/config_parser.R
| 関数 | 役割 |
|------|------|
| `parse_config(yaml_path)` | YAML読み込み → 必須セクション検証 → チャネル定義展開 |
| `build_context_vars(config, col_names)` | 明示指定 + UP/DOWNダミー自動検出 → バリデーション |
| `build_hyperparameters(config)` | チャネル定義からRobyn用ハイパーパラメータリスト構築 |
| `validate_config(config)` | データファイル存在・チャネル定義・日付・パラメータ範囲チェック |
| `resolve_data_path(config)` | 相対/絶対パス解決 |
| `detect_dummy_vars(col_names)` | `^(UP\|DOWN)\d+` パターンの自動検出 |

**注意**: `build_hyperparameters()` で `as.numeric()` ラッパーを適用し、YAML型不一致を防御。

### R/data_preprocessor.R
| 関数 | 役割 |
|------|------|
| `preprocess_gsheets(config)` | メインエントリ: 認証→コピー→取得→統合→CSV出力→一時コピー削除 |
| `generate_year_months(start, end)` | window期間から年月リスト生成 |
| `fetch_sogo_all_months(ss_id, config, ym, sleep)` | 総合デイリーシートから全月取得 |
| `fetch_platform_all_months(ss_id, config, ym, sleep)` | プラットフォーム別デイリーから全月取得 |
| `write_year_month(ss_id, sheet, year, month)` | A2/A3セルに年月書き込み |
| `merge_all_daily(sogo_df, platform_dfs)` | 日付キーで全データ統合 |
| `generate_cf_dummies(df)` | makuake_revenue > 0 の期間からCFダミー生成 |
| `clean_numeric(x)` | 通貨・カンマ・%・"-"等の文字列→数値変換 |
| `parse_date_col(x)` | 複数日付フォーマット対応パーサー |
| `col_letter_to_num(letter)` / `num_to_col_letter(num)` | A=1, B=2, ..., AA=27 の変換 |

**セル保護回避**: `drive_cp()` でスプレッドシートを一時コピーし、コピー先に書き込む。
完了後 `drive_trash()` で一時コピーを削除。

### R/data_loader.R
| 関数 | 役割 |
|------|------|
| `load_data(config)` | ファイル読み込み → 日付パース → バリデーション |
| `load_excel(path, sheet)` | openxlsxでExcel読み込み |
| `load_csv(path, encoding)` | エンコーディング自動判定CSV読み込み |
| `fill_missing_values(df, config)` | 欠損値補完（0埋め） |
| `validate_data(df, config)` | 必須列存在・数値型チェック |

### R/robyn_builder.R
| 関数 | 役割 |
|------|------|
| `build_inputs(config, df)` | InputCollect構築（robyn_inputs × 2回：基本 + ハイパーパラメータ） |
| `run_robyn(InputCollect, config)` | robyn_run()実行（seed固定、outputs=FALSE） |
| `export_outputs(InputCollect, OutputModels, config)` | robyn_outputs() → CSV/PNG出力 |
| `detect_latest_robyn_folder(mmm_dir)` | Robyn_*_init フォルダの最新を検出 |
| `use_existing_folder(mmm_dir, name)` | --skip-robyn用の既存フォルダ指定 |

### R/model_selector.R
| 関数 | 役割 |
|------|------|
| `score_models(folder_path, config)` | メイン: CSV読み込み→スコアリング→ランキング |
| `compute_variable_effects(decomp, media_vars, config)` | モデル別・変数別効果量集計 |
| `score_all_models(metrics, effects, vars, positive, weights)` | 全モデルスコア計算 |
| `print_model_summary(scores, top_n)` | ランキングテーブル出力 |

### R/utils.R（共通ユーティリティ）
| 関数 | 役割 |
|------|------|
| `num_to_col_letter(num)` | 数値→Excel列文字変換（1=A, 27=AA） |
| `col_letter_to_num(letter)` | Excel列文字→数値変換 |
| `validate_required_cols(df, required_cols, source_name)` | データフレームの必須列存在チェック |
| `apply_template_defaults(config)` | テンプレート設定のデフォルト値適用 |

### R/excel_populator.R
| 関数 | 役割 |
|------|------|
| `populate_excel_workbooks(folder, model, config, data)` | メイン: テンプレートコピー→データ投入 |
| `populate_single_workbook(path, model, folder, actual, csv, config)` | 1冊のワークブック処理 |
| `load_robyn_csvs(folder, model, config, data)` | Robyn CSV群を読み込みモデル1データ構築 |
| `build_actual_data(config, data)` | Actual用データ（日次実績）構築 |
| `write_selection_sheet(wb, model, folder)` | 選択シートにB2=model, B4=folder |
| `write_actual_sheet(wb, actual)` | Actualシートに日次データ + 不要列ゴーストデータクリア |
| `update_transform_headers(wb, actual)` | Adstock/正規化/変形のヘッダーをActualと一致させる |
| `write_params_sheet(wb, hyperparams)` | パラメータ1シートにハイパーパラメータ |
| `write_alldecomp_sheet(wb, alldecomp)` | ALLDECOMPシートに日次分解 |
| `write_model_sheet(wb, model1)` | モデル1シートに係数・効果量 |
| `clear_old_data(wb, sheet, start_row, start_col, max_row)` | テンプレート旧データ消去（max_row=250に制限） |

**重要な修正履歴**:
- `update_transform_headers()`: テンプレートの旧チャネル名（SEM_PC_cl等）を新チャネル名（Meta_imp等）に置換。変形シートのXLOOKUPがパラメータ1とマッチしない問題を解決。
- `write_actual_sheet()`: 不要列（J-Z）のRow2-4をクリアしゴーストコスト除去。試算Row1(マージン)/Row12(比率)も0に設定。
- `clear_old_data()`: template_max_row を841→250に変更（数式セル破壊防止）。

### R/zenmodel_populator.R（全モデル整理.xlsm完全投入）
| 関数 | 役割 |
|------|------|
| `populate_zenmodel(folder_path, best_model, config, input_data)` | メイン: 全モデル整理の完全生成（4シート投入） |
| `load_pareto_agg(folder_path)` | pareto_aggregated.csv読み込み（CP932対応） |
| `build_histdata_matrix(pareto_agg, sol_ids, var_names)` | モデルID×変数名のxDecompAggマトリクス構築 |
| `build_spreadsummary(histdata)` | 変数別の最小/最大/平均/標準偏差 統計計算 |
| `build_matome_sheet(pareto_agg, best_model, input_data, config, spreadsummary)` | 選択モデルのCPA/Spend%/効果% サマリー構築 |
| `build_ichiran_sheet(var_names)` | 変数分類（base/trend_dummy/promotion）生成 |
| `write_zenmodel_sheets(cv_file, folder_path, histdata, spreadsummary, matome, ichiran)` | 4シートへの一括書き込み |
| `ensure_sheet(wb, existing_sheets, sheet_name)` | シート存在チェック・不在なら作成 |
| `clear_sheet_data(wb, sheet_name, max_row, max_col)` | シートの既存データクリア |

**投入先シート構成（VBA前 — Phase 1）**:
- **HistData**: 行=モデルID × 列=変数名 のxDecompAggマトリクス
- **SpreadSummary**: 変数別の最小/最大/平均/標準偏差
- **まとめ**: 選択モデルのCPA/Spend%/効果%（条件付き書式）— 仮データ
- **一覧**: 変数分類（base/trend_dummy/promotion）— 仮データ

**注意**: `build_matome_sheet()` の Spend%/効果% は `if/else` で計算（`ifelse()` はスカラー条件+ベクター値で1要素しか返さないバグがあるため修正済み）。

### R/postprocess_zenmodel.R（VBA後処理 — Phase 2）
| 関数 | 役割 |
|------|------|
| `postprocess_zenmodel(folder_path, best_model, config)` | メイン: SpreadSummary + pareto_aggregated.csv から一覧/まとめ/突合用を正式更新 |
| `read_best_model_from_excel(folder_path, config)` | optimize.xlsm の「選択モデル」シート B2 からベストモデルID取得 |
| `clear_postprocess_sheet(wb, sheet_name)` | シートの既存データをクリアするヘルパー |

**投入先シート構成（VBA後 — Phase 2）**:
- **一覧**: 番号/施策名/種類/最小値/最大値/平均値/標準偏差/CV/構成比/注記（10列）
- **まとめ**: 施策名/統計値/CPA/Spend%/効果%/COST/効果/伸びしろ/補足（13列+合計行）
- **突合用**: 施策名/最小値/最大値/平均値/標準偏差（5列、プロモーション施策のみ）

**変数分類ロジック**: `(Intercept)` → ベース（切片）、`media_vars`（total_spend > 0）→ プロモーション等、その他 → トレンド等

**コマンド**: `Rscript robyn_auto.R --config configs/project_config.yaml --postprocess`

### R/modering_populator.R（modering.xlsm自動投入）
| 関数 | 役割 |
|------|------|
| `populate_modering(folder_path, best_model, config, input_data)` | メイン: テンプレートコピー→7シート投入 |
| `read_alldecomp(folder_path, best_model)` | alldecomp_matrixから選択モデル抽出 |
| `write_lag_correlation_sheet(wb, existing_sheets, input_data, config)` | チャネル別ラグなし vs 1日ラグ相関比較 |
| `write_soukan_sheet(wb, existing_sheets, input_data, config)` | 全変数間の相関行列 |
| `write_dummy_sheet(wb, existing_sheets, config, data_cols)` | 既存UP/DOWN/CFダミー変数一覧 |
| `write_evolution_sheet(wb, existing_sheets, folder_path, best_model, model_hp)` | イテレーション別R²/RSSD/NRMSE追跡（追記型） |
| `write_hyperp_sheet(wb, existing_sheets, model_hp, config)` | チャネル別Alpha/Gamma/Theta値 |
| `write_code_sheet(wb, existing_sheets, config)` | Robyn設定コード自動生成（paid_media_vars等） |
| `write_final_selection_sheet(wb, existing_sheets, best_model, folder_name)` | 選択モデルID・フォルダ名・タイムスタンプ |

**投入先シート構成**: NO2, ラグ相関比較, soukan, ダミー, モデル進化, ハイパーP, コード作成, 最終モデル選択

**ラグ相関の実装**: `cor(x[1:(n-1)], y[2:n])` で1日ラグの相関を計算し、ラグなし相関と比較。

### R/iteration_manager.R（反復改善サイクル管理）
| 関数 | 役割 |
|------|------|
| `run_iteration_analysis(folder_path, best_model, config, input_data)` | メイン: D-1→D-2→D-3の3ステップ実行 |
| `analyze_residuals(folder_path, best_model, threshold)` | D-1: 日次残差分析（大乖離日抽出） |
| `detect_existing_dummies(config, data_cols)` | 既存UP/DOWN/CFダミーの検出 |
| `extract_date_from_dummy(dummy_name)` | ダミー変数名からYYYYMMDD日付抽出 |
| `suggest_dummies(residual_df, existing_dummies)` | D-2: 未カバー大乖離日のダミー提案 |
| `track_model_evolution(folder_path, best_model, config)` | D-3: R²/RSSD/NRMSE記録+前回比較 |
| `output_results(folder_path, residual_df, suggested, evolution)` | CSV出力+ユーザーガイダンス表示 |

**重要な設計判断**:
- ダミー変数の自動追加は行わない（CSV提案のみ = 講義準拠）
- `iteration.enabled: true` 時のみ実行（デフォルトfalse）
- model_evolution.csv はプロジェクトルートに蓄積（イテレーション間比較用）

## 依存パッケージ

### R パッケージ
```r
# コア
library(Robyn)          # Meta公式MMMパッケージ
library(reticulate)     # Python連携（nevergrad）
library(yaml)           # YAML設定解析
library(openxlsx)       # Excel読み書き
library(dplyr)          # データ操作
library(optparse)       # CLI引数

# Google連携（前処理時のみ）
library(googlesheets4)  # Google Sheets API
library(googledrive)    # Google Drive API
library(gargle)         # Google認証
```

### Python環境
```bash
# conda環境の確認
conda activate r-reticulate
pip list | grep nevergrad

# nevergrad がなければインストール
pip install nevergrad
```

## Robyn実行パフォーマンス

### 参考値（D2C ECプロジェクト実測例）
```
データ: 154日 × 33列（8チャネル）
設定: 2000 iterations × 5 trials = 10,000 モデル
ハイパーパラメータ: 26個（25 iterable + 1 fixed）
並列: 11コア
実行時間: 11-12分（Robyn本体）、17分（全パイプライン）
Paretoモデル数: 109
クラスター数: 6
```

### 実行時間の目安
| データ規模 | チャネル数 | iterations × trials | 概算時間 |
|-----------|-----------|-------------------|---------|
| 100-200日 | 5-8 | 2000 × 5 | 10-15分 |
| 200-365日 | 5-8 | 2000 × 5 | 15-25分 |
| 365日+ | 10+ | 5000 × 5 | 30-60分 |
