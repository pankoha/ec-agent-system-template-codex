# みんなのミニ島リサイクル工房 - MVP

親子向け企画書「親子でつくる Roblox ゲーム事業」の推奨MVPを、Roblox Studioへ同期できるRojoプロジェクトとして実装したものです。

## 遊び方

1. 島に落ちている「木のかけら」「プラスチック」「金属」をトングで拾う
2. オレンジ色のリサイクル工房へ行き、レシピを選ぶ
3. 3つのかざり台から置き場所を選んで制作する
4. 作るたびに次のレシピが開く。5種類すべてを発見する

材料ノードはプレイヤーごとに2.5秒で再取得できます。友達に先に拾われても、自分の材料が取れなくなることはありません。

## MVPに含まれるもの

- 小さな島1つ、材料3種、レシピ5種、回収用トング演出
- 1〜4人向けサーバー権威の収集・制作・配置
- 初回3画面チュートリアル、材料HUD、工房UI、通知
- 飾り3枠、段階的なレシピ解放
- DataStoreによる材料・解放・飾り・案内完了の保存
- PCとモバイルのProximityPrompt操作
- 課金、交換、ランキング、独自チャット、外部アセットなし

## Studioで起動する

このPCにはRoblox StudioとRojo 7.6.1を導入済みです。

1. `scripts/start-rojo.ps1` を実行する。
2. `build/minijima-recycle-workshop.rbxlx` をRoblox Studioで開く。
3. Studio上部のPluginsからRojoを開き、`localhost:34872` に接続する。
4. StudioのPlayで1人テスト、`Test > Server & Clients` で2〜4人テストを行う。

公開操作は行わず、まずPrivateのまま確認してください。StudioでDataStoreを試す場合だけ、公開済みテストExperienceで `Game Settings > Security > Enable Studio Access to API Services` を有効にします。本番ExperienceとはDataStore名を分けることを推奨します。

## 主要ファイル

- `default.project.json`: Rojoマッピング
- `src/shared/Config.luau`: 材料・上限・時間設定
- `src/shared/Recipes.luau`: 5レシピ
- `src/server/GameServer.server.luau`: 収集、制作、解放、Remote検証
- `src/server/DataService.luau`: 保存と入力サニタイズ
- `src/server/WorldBuilder.luau`: 島・工房・落とし物・飾りの自動生成
- `src/client/GameClient.client.luau`: HUD、工房、案内、通知
- `scripts/start-rojo.ps1`: Rojo同期サーバーの起動

## テスト観点

- 新規プレイヤーが木1・プラスチック1を集め、90秒以内に1ボタンでボトルプランターを作って飾れる
- 工房から離れた状態、未知のレシピ、範囲外スロットでは制作できない
- 材料不足やロック中の制作で材料が減らない
- 制作成功時だけ必要材料が1回減り、次レシピが1回だけ開く
- 4人同時でも材料、解放、飾りが混ざらない
- 退出・再参加で材料、解放、飾り3枠、案内完了が戻る
- スマートフォンでHUDやボタンが重ならず、閉じる操作まで完了できる

詳細は `docs/ACCEPTANCE.md` を参照してください。
