---
name: ec-amazon-research-order-importer
description: GmailのAmazon注文確定メールをGoogleスプレッドシートのAmazon Research用リサーチ表へ自動取り込みするApps Script業務スキル。Amazon注文メール、注文確定、Gmail取り込み、スプレッドシート自動入力、検索ワード生成、SKU/売上金抽出、既存行の売上金更新、処理済みラベル、確認用シート、Apps Script修正・検証・運用トラブル対応を依頼されたときに使用。
---

# Amazon Research Order Importer

## 2026-07-01 Update: Order-number synchronization

- Treat the order number as the only key shared by `注文確定商品リサーチ表` and `リサーチ管理表`.
- `researchListedItemsHourly` researches rows from the main sheet, then mirrors status, new candidate URLs, review notes, and the last-researched timestamp to the unique matching management row.
- Delete a management row only when its order number no longer exists in the main sheet. Never delete existing URLs or results merely because a later search returns no candidates.
- If the management sheet is missing or hidden, continue processing the main sheet and record the condition in `確認用`.
- If the management sheet contains duplicate rows for one order number, record `注文番号重複` and do not update those duplicate rows independently.
- New blank sheets use the A:J PDF layout. Existing A:K layouts that include `お届け先` remain supported by header-based column detection; never reorder or recreate existing columns.
- Use `setupOnChangeTrigger` to detect manual row deletion and `syncResearchManagementByOrderNumber` for manual repair.

## 2026-06-12 Update: Apps Script Paste File

- When giving the user code to paste into Google Apps Script, use `apps-script/amazon-order-importer/Code.paste.gs` first.
- `Code.paste.gs` is the paste-safe version compressed to fewer physical lines, created to avoid Apps Script paste truncation around line 100.
- If the user reports `SyntaxError: Unexpected end of input 行: 100 ファイル: コード.gs`, treat it as a cut-off paste and instruct them to replace the whole Apps Script file with `Code.paste.gs`.
- Keep `Code.compact.gs` as the editable compact source, but after code changes regenerate or verify `Code.paste.gs` before telling the user to paste.
- After pasting `Code.paste.gs`, run `setupAmazonOrderImporter` and then `repairAll` once to fix existing B/D column duplicates, then use `importAmazonOrderEmails` for normal operation.
- Current duplicate prevention rule: new rows from `importAmazonOrderEmails` and `reprocessReviewRowsFromGmail` must run B/D cell duplicate repair immediately after insertion.
- B column duplicate key is normalized SKU + normalized sales amount digits only. D column duplicate key is normalized search-word block text.

## 2026-06-12 Final Column Spec Supplement

- The final spreadsheet layout is A:K, not the older A:C or A:J layout.
- A column = 出荷予定日.
- B column = 注文情報. Include order number, product name, and SKU. Do not treat B as the sales amount column.
- C column = 売上金. Store the extracted sales amount as numeric digits only when possible, such as `25800`.
- D column = 検索ワード. All search-word generation and duplicate removal must target D column.
- E column = お届け先.
- F column = リサーチ状況.
- G column = Amazon.
- H column = ヤフオク.
- I column = メルカリ.
- J column = ジモティ.
- K column = その他サイト.
- Older notes or files that say C column is 検索ワード are obsolete. Always follow C=売上金 and D=検索ワード.
- Older notes or files that say E column is 住所 or リサーチ状況 are obsolete. Always follow E=お届け先 and F=リサーチ状況.
- Existing duplicate repair must repair B column order-info blocks and D column search-word blocks.
- Research condition: 状態は「傷や汚れあり」も含めてOK。Do not exclude candidates solely because the condition says 傷や汚れあり.
- Preserve manual user input after import. Automation may write only A:D for imported order data and may repair B/D/C sales amount fields as explicitly designed; it must not overwrite E:K or any user-added columns to the right.
- When sorting by 出荷予定日, sort through `getLastColumn()` instead of a fixed A:K range so manually entered research/status/URL fields stay attached to the same order row.
- Do not mark parse-failed emails as processed. If an email cannot be parsed, write it to 確認用 but leave it without the 処理済み label so a later parser fix can pick it up.
- If product name or SKU cannot be extracted from the email body, fall back to the email subject format `注文確定： SKU 商品名`.
- Use `recoverProcessedAmazonOrderEmails` to recover past missed orders that were already labeled 処理済み. It searches processed Amazon order-confirmation emails, skips order numbers already present in the main sheet, and imports only missing rows.
- A column must contain both 注文日 and 出荷予定日 in one wrapped cell. Format: first line `注文日：YYYY/MM/DD`, second line `出荷予定日：YYYY/MM/DD`. If one date is missing, leave that line out and do not guess.
- Extract 注文日 from the Amazon order-confirmation email body separately from 出荷予定日.
- Sort rows by the A-column first-line 注文日, ascending from oldest to newest. Do not sort by 出荷予定日.
- When multiple rows have the same 注文日, newly imported rows should be ordered by Gmail received datetime from oldest to newest before insertion. Existing same-date rows preserve their current relative order during sheet sorting.
- Sheet sorting must move the entire row through `getLastColumn()` plus temporary helper columns, so manually entered columns remain attached to the correct order.

## Overview

Gmailに届くAmazonセラー通知メールから注文情報を抽出し、Amazon Research用のGoogleスプレッドシートへ自動追記する仕組みを設定・修正・検証する。

正本コードは `apps-script/amazon-order-importer/Code.compact.gs`。長い版は `apps-script/amazon-order-importer/Code.gs`。ユーザーがApps Scriptへ貼り付ける場合は、原則として短縮版の `Code.compact.gs` を案内する。

## Workflow

1. 依頼内容を確認する
   - 対象スプレッドシートID
   - Gmail検索条件
   - 出力列
   - 検索ワード生成ルール
   - 確認用シートに落ちたエラー内容

2. 既存コードを確認する
   - `apps-script/amazon-order-importer/Code.compact.gs`
   - 必要に応じて `apps-script/amazon-order-importer/README.md`
   - 長い版も同期する必要がある場合のみ `Code.gs`

3. Apps Script側の運用手順を案内する
   - `コード.gs` を全削除
   - `Code.compact.gs` を全貼り付け
   - 保存
   - 自動化まで一括設定する場合は `setupAmazonOrderImporterAndTrigger`
   - `testKeywordGeneration`
   - `setupAmazonOrderImporter`
   - 新規取り込みをやり直す場合はGmailの `処理済み` ラベルを外して再テスト
   - `importAmazonOrderEmails`
   - `確認用` に落ちた注文を再処理する場合は `reprocessReviewRowsFromGmail`
   - 既存行のB列/C列を複数商品対応形式で再作成する場合は `refreshExistingOrderDetailsFromGmail`
   - 既存行のB列売上金だけを直す場合は `refreshExistingSalesAmountsFromGmail`

4. 検証する
   - Nodeで `Code.compact.gs` の構文確認を行う
   - `testKeywordGeneration()` をローカル実行する
   - 具体例があればテストケースへ追加する

## Current Business Rules

対象メール:

- 送信元: `seller-notification@amazon.co.jp`
- 件名に `注文確定` を含む
- Gmailラベル `処理済み` が付いていないメールのみ処理

出力先:

- スプレッドシート名: `★注文確定商品リサーチ表★`
- 通常シート: `注文確定商品リサーチ表`
- 確認用シート: `確認用`

通常シート:

- A列: 出荷予定日
- B列: 注文情報
- C列: 検索ワード

B列の注文情報:

```text
注文番号：...
商品名：...
SKU：...
売上金：...
```

同じ注文番号のメール内に複数商品がある場合:

- 1通のメール内に `出荷予定日` / `商品` / `SKU` / `売上金` の商品ブロックが複数ある場合は、1行にまとめる
- B列の同じセル内に `【1】`、`【2】`、`【3】` のような通番を付ける
- 各通番の下に、通常注文時と同じ `商品名`、`SKU`、`売上金` を記載する
- C列の検索ワードも同じ通番でまとめる
- Gmailのプレーン本文とHTML本文の両方に同じ商品が重複して含まれる場合があるため、商品名・SKU・売上金が同じ商品ブロックは1件に重複排除する
- SKUの先頭に `*` / `＊` / `・` / `-` / 空白が付く場合があるため、重複判定前にSKUを正規化する
- `* pricetar-gakki-0326` と `pricetar-gakki-0326` のような表記ゆれは同じSKUとして扱う
- 同じSKU + 同じ売上金のブロックは同一商品として重複削除する
- 重複排除後に1点だけなら、`【1】` は付けず通常注文時と同じ表示にする
- 重複防止は注文番号単位で行い、同じ注文番号がB列に既にある場合は再追加しない

商品名と検索ワードの先頭にある `*` / `＊` / `・` / `-` は除去する。

SKU・売上金がメールから取得できない場合は、確認用に落とさず `取得不可` として通常シートへ入れる。AmazonメールにSKUや金額が含まれない形式があるため、検索ワード作成を優先する。

売上金:

- B列は `売上金：○○円` 形式で出力する
- メール本文に複数の金額がある場合は、ラベル付きの `売上金：○○円` を最優先する
- `売 上 金：○○円` のように文字間にスペースが入る場合も拾う
- ラベル付き売上金が複数ある場合は、本文内で一番下にあるものを採用する
- ラベル付き売上金が見つからない場合のみ、最後に現れる円表記をフォールバックとして使う

既存行の売上金更新:

- `refreshExistingSalesAmountsFromGmail` は通常取り込みとは別の補修関数
- `注文確定商品リサーチ表` のB列から注文番号を読み取り、Gmailを注文番号で再検索してB列の売上金行だけを更新する
- 対象はA列の出荷予定日が `2026/06/01` 以降の行
- 処理時間対策として1回あたり最大80注文を確認する。対象が多い場合は再実行する
- この関数は注文番号で直接Gmail検索するため、Gmailの `処理済み` ラベルを外す必要はない

既存行の注文情報再作成:

- `refreshExistingOrderDetailsFromGmail` は、既にシートに入っている注文番号をもとにGmailを再検索し、A列/B列/C列を作り直す補修関数
- B列は `注文番号` の下に、複数商品なら `【1】`、`【2】`、`【3】` の通番付きで `商品名`、`SKU`、`売上金` を記載する
- C列も同じ通番付きで検索ワードを再作成する
- Gmailの `処理済み` ラベルを外す必要はない
- 1回あたり最大50注文を確認する。対象が多い場合は再実行する

既存B列の重複修正:

- `repairAll` は、通常シート全体のB列だけを確認し、セル内の商品ブロック重複を削除する補修関数
- A列/C列は触らない
- `(1)` / `（1）` / `【1】` の通番表記を認識する
- SKUの先頭 `*` / `＊` / `・` / `-` / 空白を除去して比較する
- 同じSKU + 同じ売上金なら同一商品として1件にまとめる
- 1点だけになった場合は通番を削除し、通常注文と同じB列表示にする
- 違うSKUまたは違う売上金の商品が同一注文内に複数ある場合だけ、通番を振り直して残す
- 範囲限定で直す場合は `repairRows2240To2440` のような専用関数を作るが、全体修正は `repairAll` を案内する

確認用シートからの再処理:

- `reprocessReviewRowsFromGmail` は、`確認用` シートD列の取得済み情報JSONから注文番号を読み取り、Gmailを再検索して通常シートへ追加する補修関数
- `shipDate, items` で確認用に落ちた注文を再処理するときに使う
- 既に通常シートB列に同じ注文番号がある場合は重複として追加しない
- Gmail本文は `getPlainBody()` とHTML本文をテキスト化したものを結合して解析する

## Search Word Rules

通常商品:

- 型番らしい英数字コードを抽出する
- 末尾カラー表記 `-W/-K/-B/-S/-R/-N/-P/-H/-T/-C` は削除する
- 括弧内の `WS` などは削除する
- 型番が取れない場合は商品名を簡易整形した検索ワードを入れる

DVD/レンタル落ち/全巻セット系:

- 商品名に `レンタル落ち`、`全○巻`、`全巻セット`、`DVD`、`Blu-ray`、`ブルーレイ`、`マーケットプレイスDVDセット商品` が含まれる場合にDVD系として扱う
- ただし `ブルーレイディスクレコーダー` などの機器名は通常商品として扱う
- C列は3行で出力する

```text
作品名 全
作品名 巻数
作品名 レンタル
```

DVDタイトル整形:

- `【】`、`[]`
- `レンタル落ち`
- `全○巻セット`
- `全巻セット`
- `マーケットプレイスDVDセット商品`
- `DVD`
- `Blu-ray`
- `ブルーレイ`
- `中古`
- `セット商品`
- 末尾の `1、2、3、4` のような巻数列挙
- 先頭の `*`

を検索ワードから除去する。

## Troubleshooting

`Unexpected end of input`:

- Apps Scriptへの貼り付けが途中で切れている
- `Code.compact.gs` を使う
- `コード.gs` を全削除してから貼り直す

`Cannot call SpreadsheetApp.showNotification() from this context`:

- 単独作成のApps Scriptから `toast` を呼んだときのエラー
- 現行の `Code.compact.gs` は `Logger.log` に置き換え済み

`確認用` にだけ入る:

- `確認用` のE列とF列を確認する
- `sku, amount` のみなら、現行コードでは通常シートへ入る。Apps Script側へ最新版が貼れていない可能性を疑う
- `shipDate, items` なら、同一注文番号の複数商品メールで `出荷予定日` / `商品` ブロックを拾えていない。ラベル文字間のスペース、HTML由来の改行崩れ、`商品` から次ラベルまでの抽出を疑い、`Code.compact.gs` の `blocks_` / `name_` / `ship_` を調整する
- 再処理にはGmail側の `処理済み` ラベルを外す
- 通常シートB列に同じ注文番号があると重複防止でスキップされる

新規取り込みが更新されない:

- Gmailの対象メールに `処理済み` ラベルが残っている
- 通常シートB列に同じ注文番号が既にある
- Apps Scriptの `実行数` で `追加: 0件 / 確認用: 0件` になっていないか確認する

既存行のB列売上金が更新されない:

- `処理済み` ラベルを外す必要はない
- Apps Scriptの `実行数` で `refreshExistingSalesAmountsFromGmail` のログを見る
- ログ形式は `既存行の売上金更新: ○件 / 売上金検出: ○注文 / Gmail確認: ○注文`
- `Gmail確認: 0注文`: B列から注文番号を読めていない、または対象行が `2026/06/01` 以降として認識されていない
- `Gmail確認: 80注文` かつ `売上金検出: 0注文`: Gmail検索はできているが、本文内の売上金表記が抽出ルールと違う。メール本文下部の売上金周辺だけをユーザーに伏せ字で共有してもらい、抽出正規表現を追加する
- `売上金検出: ○注文` かつ `更新: 0件`: 既存のB列売上金とGmailから取れた売上金が同じ、または表示対象外・フィルタ・非表示行を見ている可能性を確認する

自動実行を設定したい:

- 30分ごとの自動実行まで一括で設定する場合は `setupAmazonOrderImporterAndTrigger` を実行する
- 間隔を選びたい場合は `installTimeDrivenTriggerEvery15Minutes`、`installTimeDrivenTriggerEvery30Minutes`、`installTimeDrivenTriggerEveryHour` を実行する

## Validation Command

PowerShellで短縮版を検証する:

```powershell
& 'C:\Users\pansm\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' -e "const fs=require('fs'); const code=fs.readFileSync('apps-script/amazon-order-importer/Code.compact.gs','utf8'); new Function(code); new Function(code+'\ntestKeywordGeneration();')(); console.log('compact checks ok');"
```

成功条件:

```text
compact checks ok
```

## Editing Rules

- `Code.compact.gs` を優先して修正する
- ユーザーがApps Scriptへ貼る前提なので、行数をできるだけ増やしすぎない
- 実メール例が出たら `testKeywordGeneration` に近いテストケースを追加する
- `Code.gs` も更新する場合は、短縮版と挙動がずれないようにする
- `.env` や認証情報は読まない、書かない、出力しない
