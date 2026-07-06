# 別PC・別アカウントで自動化を使う手順

この手順は、GitHub の `main` に入っている最新版を別PC・別GitHubアカウントで取得し、Google Apps Script に貼り付けて使える状態にするためのものです。

## 1. GitHub から最新版を取得する

別PCで PowerShell またはターミナルを開き、作業したいフォルダで次を実行します。

```powershell
git clone https://github.com/pankoha/ec-agent-system-template-codex.git
cd ec-agent-system-template-codex
```

これで `main` の最新版が取得されます。以前のように `git checkout codex/continuous-research-spec` を実行する必要はありません。

## 2. リポジトリが見られない場合

別アカウントで clone できない場合は、そのGitHubアカウントにリポジトリ閲覧権限がありません。

GitHubのオーナーアカウントで、対象アカウントを collaborator または organization member として追加してください。

## 3. Apps Script に貼り付けるファイル

Googleスプレッドシートを開き、`拡張機能` → `Apps Script` を開きます。

文字化けを避けるため、貼り付けには `.ascii.gs` 版を使うのが安全です。

### Code.gs

Apps Script 側の `Code.gs` を開き、全選択して次の内容を貼り付けます。

```text
apps-script/amazon-order-importer/Code.paste.ascii.gs
```

貼り付け後、`Ctrl + S` で保存します。

### Research 分割ファイル

Apps Script 側に以下の4ファイルを作成または更新し、それぞれ対応する内容を貼り付けます。

```text
Research.gs   ← tmp/apps-script-paste/Research_1.ascii.gs
Research_2.gs ← tmp/apps-script-paste/Research_2.ascii.gs
Research_3.gs ← tmp/apps-script-paste/Research_3.ascii.gs
Research_4.gs ← tmp/apps-script-paste/Research_4.ascii.gs
```

各ファイルで、全選択 → 貼り付け → `Ctrl + S` で保存します。

## 4. 関数が表示されるか確認する

Apps Script の関数プルダウンで次が表示されるか確認します。

```text
researchAllVisibleManagementRowsNow
```

表示されない場合は、`Research_3.gs` を開き、`Ctrl + F` で次を検索します。

```text
researchAllVisibleManagementRowsNow
```

見つからない場合は、`Research_3.gs` に `tmp/apps-script-paste/Research_3.ascii.gs` が正しく貼れていません。

## 5. 初回実行の順番

既存行の検索ワードを作り直してからリサーチする場合は、次の順で実行します。

```text
refreshExistingOrderDetailsFromGmail
syncResearchManagementSheet
researchAllVisibleManagementRowsNow
```

`refreshExistingOrderDetailsFromGmail` は、メイン表のD列「検索ワード」を再生成します。

`syncResearchManagementSheet` は、メイン表の内容を `リサーチ管理表` に同期します。

`researchAllVisibleManagementRowsNow` は、`リサーチ管理表` の表示中の行を対象にリサーチを実行します。

## 6. 結果を見る場所

リサーチ結果は、メインの `注文確定商品リサーチ表` ではなく、原則として次のシートで確認します。

```text
リサーチ管理表
```

候補URLや確認メモは `リサーチ管理表` 側に追記されます。

## 7. 更新版を取り直す場合

すでに clone 済みの別PCで最新版を取り直す場合は、リポジトリフォルダで次を実行します。

```powershell
git pull
```

その後、必要に応じて Apps Script へ `Code.paste.ascii.gs` と `Research_1〜4.ascii.gs` を貼り直します。
