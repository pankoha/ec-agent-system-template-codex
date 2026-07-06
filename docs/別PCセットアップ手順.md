# 別PC・別Amazonアカウントで自動化を使う手順

この手順は、別PC・別Amazonセラーアカウントで、同じ「Amazon注文メール取込＋仕入れ候補リサーチ自動化」を使うためのものです。

重要なのは、GitHubアカウントを分けることではありません。  
Amazonセラーアカウントごとに、注文通知メールを受け取るGoogleアカウント、Googleスプレッドシート、Apps Script権限を分けることです。

## 全体像

```text
AmazonセラーアカウントA
  → Gmail A に注文通知メールが届く
  → スプレッドシートA
  → Apps Script A

AmazonセラーアカウントB
  → Gmail B に注文通知メールが届く
  → スプレッドシートB
  → Apps Script B
```

コードはGitHubから共通で取得します。  
ただし、実行するGoogleアカウントとスプレッドシートはAmazonアカウントごとに分けます。

## 1. 別Amazonアカウント側の前提確認

別Amazonセラーアカウントで、注文通知メールがどのGmailに届くか確認してください。

この自動化は、Amazonセラーセントラルへ直接ログインするのではなく、Gmail内のAmazon注文通知メールを読み取ります。

確認すること:

```text
注文通知メールが届くGmailでログインできる
seller-notification@amazon.co.jp からの注文メールがGmail内にある
件名や本文に「注文確定」「新規の注文」「注文番号」が含まれる
```

注文通知メールがGmailに届いていない場合は、Amazonセラーセントラル側で通知先メールを設定してください。

## 2. 新しいGoogleスプレッドシートを作る

別Amazonアカウント用のGoogleアカウントで、新しいGoogleスプレッドシートを作ります。

例:

```text
Amazon注文確定商品リサーチ表_アカウントB
```

既存アカウントAのスプレッドシートを使い回さないでください。  
注文データ、リサーチ結果、削除済み注文の管理が混ざるためです。

## 3. GitHubから最新版コードを取得する

別PCで PowerShell またはターミナルを開き、作業したいフォルダで次を実行します。

```powershell
git clone https://github.com/pankoha/ec-agent-system-template-codex.git
cd ec-agent-system-template-codex
```

すでに clone 済みの場合は、リポジトリフォルダで次を実行して最新版にします。

```powershell
git pull
```

GitHubが見られない場合は、リポジトリのオーナーアカウントで対象GitHubアカウントを collaborator または organization member として追加してください。

## 4. Apps Scriptを開く

手順2で作ったGoogleスプレッドシートを開きます。

```text
拡張機能 → Apps Script
```

Apps Scriptプロジェクトが開いたら、以下のファイルを作成または更新します。

```text
Code.gs
Research.gs
Research_2.gs
Research_3.gs
Research_4.gs
```

## 5. Code.gsを貼り付ける

文字化け防止のため、ASCII版を使います。

Apps Script側の `Code.gs` を開き、全選択して次のファイル内容を貼り付けます。

```text
apps-script/amazon-order-importer/Code.paste.ascii.gs
```

貼り付けたら保存します。

```text
Ctrl + S
```

## 6. Research分割ファイルを貼り付ける

Apps Script側に、以下の対応で貼り付けます。

```text
Research.gs   ← tmp/apps-script-paste/Research_1.ascii.gs
Research_2.gs ← tmp/apps-script-paste/Research_2.ascii.gs
Research_3.gs ← tmp/apps-script-paste/Research_3.ascii.gs
Research_4.gs ← tmp/apps-script-paste/Research_4.ascii.gs
```

各ファイルごとに次を行います。

```text
Ctrl + A
Ctrl + V
Ctrl + S
```

## 7. 関数が表示されるか確認する

Apps Scriptの上部にある関数プルダウンで、次が表示されるか確認します。

```text
setupAmazonOrderImporterAndTrigger
importAmazonOrderEmails
syncResearchManagementSheet
researchAllVisibleManagementRowsNow
```

`researchAllVisibleManagementRowsNow` が表示されない場合は、`Research_3.gs` を開いて `Ctrl + F` で次を検索します。

```text
researchAllVisibleManagementRowsNow
```

見つからない場合は、`Research_3.gs` に `tmp/apps-script-paste/Research_3.ascii.gs` が正しく貼れていません。

## 8. 初期セットアップを実行する

Apps Scriptで次の関数を選んで実行します。

```text
setupAmazonOrderImporterAndTrigger
```

初回はGoogleの権限許可が出ます。

必ず、別Amazonアカウントの注文通知メールが届くGoogleアカウントで許可してください。

この関数で行われること:

```text
スプレッドシート名・シート構成の初期化
注文確定商品リサーチ表の作成
リサーチ管理表の作成
確認用シートの作成
削除済み注文シートの作成
定期実行トリガーの作成
```

## 9. 注文メールを取り込む

Apps Scriptで次を実行します。

```text
importAmazonOrderEmails
```

Gmail内のAmazon注文通知メールを読み取り、`注文確定商品リサーチ表` に行を追加します。

注文メールが取り込まれない場合は、次を確認してください。

```text
実行しているGoogleアカウントが正しい
GmailにAmazon注文通知メールがある
メール送信元が seller-notification@amazon.co.jp
メール本文や件名に注文番号がある
```

## 10. リサーチ管理表へ同期する

Apps Scriptで次を実行します。

```text
syncResearchManagementSheet
```

これで、`注文確定商品リサーチ表` の内容が `リサーチ管理表` に同期されます。

## 11. リサーチを実行する

Apps Scriptで次を実行します。

```text
researchAllVisibleManagementRowsNow
```

この関数は、`リサーチ管理表` で表示中の行を対象に、Amazon、ヤフオク、メルカリ、ジモティ、楽天市場、その他サイトを検索します。

## 12. 結果を見る場所

リサーチ結果は、原則として次のシートで確認します。

```text
リサーチ管理表
```

候補URL、送料要確認、状態要確認などのメモも `リサーチ管理表` 側に追記されます。

メインの `注文確定商品リサーチ表` は、注文情報と検索ワードの基準表として使います。

## 13. 既存行の検索ワードを作り直す場合

コード更新後、既存行のD列「検索ワード」を新ルールで作り直す場合は、次の順で実行します。

```text
refreshExistingOrderDetailsFromGmail
syncResearchManagementSheet
researchAllVisibleManagementRowsNow
```

各関数の役割:

```text
refreshExistingOrderDetailsFromGmail
  メイン表の既存行をGmailから再取得し、検索ワードも再生成する

syncResearchManagementSheet
  メイン表のD列検索ワードをリサーチ管理表へ同期する

researchAllVisibleManagementRowsNow
  リサーチ管理表の表示行を検索する
```

## 14. アカウントを増やすときの考え方

Amazonセラーアカウントが増えるたびに、次を1セットとして作ります。

```text
専用Gmail
専用Googleスプレッドシート
専用Apps Scriptプロジェクト
専用の初回セットアップ実行
```

コードはGitHubの同じリポジトリから取得して構いません。

ただし、複数Amazonアカウントの注文メールを同じGmail、同じスプレッドシート、同じApps Scriptに混ぜる運用は避けてください。注文番号、削除済み注文、リサーチ結果が混在し、誤同期や誤削除の原因になります。

## 15. よく使う実行順

初回:

```text
setupAmazonOrderImporterAndTrigger
importAmazonOrderEmails
syncResearchManagementSheet
researchAllVisibleManagementRowsNow
```

通常運用:

```text
importAmazonOrderEmails
syncResearchManagementSheet
researchAllVisibleManagementRowsNow
```

既存行の検索ワード再生成:

```text
refreshExistingOrderDetailsFromGmail
syncResearchManagementSheet
researchAllVisibleManagementRowsNow
```
