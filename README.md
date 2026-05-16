# EC Marketing AI Agent System Pro — Codex CLI Edition

OpenAI Codex CLI 上で動作する、**EC事業のマーケティング業務を統括するAIエージェントシステムのテンプレート**。

0→13億円 フェーズ対応型 / 全30部門 140Agent構成（30 Leaders + 110 Sub-Agents）

> **🚨 最初に**: [`SECURITY.md`](./SECURITY.md) を読んでください。`.env` の扱いを間違えるとAPIキーが GitHub に公開される事故になります。

---

## 🚀 3分でスタート

```bash
# 1. リポジトリをクローン
git clone https://github.com/<YOUR_ORG_OR_USER>/ec-agent-system-template-codex.git my-ec-agents
cd my-ec-agents

# 2. セキュリティフックをインストール
bash setup/install-hooks.sh

# 3. 環境変数を準備
cp .env.example .env  # 必要なAPIキーを記入

# 4. Codex CLI を起動
codex
```

起動後、Codexは自動で `AGENTS.md` を読み込み、あなたのEC事業AIエージェントとして動作します。

---

## 目次

- [これは何？](#これは何)
- [前提条件](#前提条件)
- [セットアップ詳細](#セットアップ詳細)
- [使い方 — Codex CLIでエージェントを呼び出す](#使い方--codex-cliでエージェントを呼び出す)
- [利用可能なエージェント・スキル一覧](#利用可能なエージェントスキル一覧)
- [セキュリティ（必読）](#セキュリティ必読)
- [カスタマイズ](#カスタマイズ)
- [トラブルシューティング](#トラブルシューティング)
- [FAQ](#faq)
- [Claude Code版との違い](#claude-code版との違い)
- [ディレクトリ構成](#ディレクトリ構成)
- [ライセンス](#ライセンス)

---

## これは何？

OpenAI Codex CLI 上で動作する、EC事業のマーケティング業務を統括するAIエージェントシステムです。

- **30部門・140体のエージェント/スキル定義**（`.agents/skills/`）
- **運用ルール・ワークフロー・品質ゲート** を標準化（`AGENTS.md`）
- **コマンドショートカット**（`codex-prompts/` で事前登録可能）で各領域の専門判断を呼び出し

**想定ユーザー**: EC事業者 / マーケ担当者 / EC支援コンサルタント / マーケスクール受講生

---

## 前提条件

### 必須

| ツール | バージョン | インストール |
|---|---|---|
| **OpenAI Codex CLI** | 最新 | `npm install -g @openai/codex` |
| **Git** | 2.30+ | 事前インストール |
| **Node.js** | 18+ | Codex CLIに必要 |
| **OpenAI API キー** | - | [platform.openai.com](https://platform.openai.com/) で取得 |

### 推奨

| ツール | 用途 |
|---|---|
| **gitleaks** | `.env`等の機密漏洩防止（pre-commit hook で自動実行） |
| **Python 3.10+** | 分析・データ処理スキルで使用 |

### 任意（使用スキルに応じて）

- Google Analytics 4 サービスアカウント
- Shopify Admin API キー
- Meta Graph API / X API トークン
- Amazon SP-API 認証情報
- Notion API トークン

---

## セットアップ詳細

### ステップ 1. Codex CLI のインストール

```bash
npm install -g @openai/codex
codex --version  # 確認
```

OpenAI API キーを環境変数または `~/.codex/auth.json` に設定してください（Codex CLI の公式ドキュメント参照）。

### ステップ 2. リポジトリクローン

```bash
git clone https://github.com/<YOUR_ORG_OR_USER>/ec-agent-system-template-codex.git my-ec-agents
cd my-ec-agents
```

### ステップ 3. セキュリティフックのインストール（推奨）

```bash
bash setup/install-hooks.sh
```

- gitleaks インストール（未導入なら brew で自動）
- `.git/hooks/pre-commit` に機密スキャン設置
- `~/.gitignore_global` の設定

### ステップ 4. 環境変数の準備

```bash
cp .env.example .env
```

`.env` を開いて、使用するスキルに対応するAPIキーを記入してください（全て記入する必要はありません）。

**⚠️ `.env` は絶対に git commit しないでください**（`.gitignore`で除外済）

### ステップ 5. Codex 承認モード設定（お好みで）

`.codex/config.toml` を編集して、Codex CLIの動作モードを調整できます。

```toml
[default]
approval_mode = "auto"  # "auto" | "manual" | "read-only"
```

### ステップ 6. 自社情報にカスタマイズ

`AGENTS.md` を開き、以下セクションを自社に合わせて書き換え:
- ビジネスコンテキスト（目標売上・チャネル構成・フェーズ）
- プロジェクト構図（自社チーム体制）

### ステップ 7. Codex を起動

```bash
codex
```

起動すると自動で `AGENTS.md` が読み込まれ、30部門のエージェント定義がContextに入ります。

---

## 使い方 — Codex CLIでエージェントを呼び出す

Codex CLIには Claude Code のような自動slash-command機能はありませんが、**3つの方法**で同等の使い勝手を実現できます。

### 方法1. 自然言語で呼び出す（推奨）

```
commanderスキルを使って、現状のフェーズを分析してください
```

```
.agents/skills/ec-acquisition/SKILL.md を読んで、
月広告予算500万円のチャネル配分案を設計してください
```

Codexは`AGENTS.md`を既に読み込んでいるので、スキル名を指定するだけで該当ファイルを自動で参照します。

### 方法2. Codex saved prompts（事前登録）

`codex-prompts/` ディレクトリに用途別のプロンプトを保存してあります。

```bash
# ~/.codex/prompts/ へコピーしておけば、Codex内で @commander 等で呼び出し可能
cp codex-prompts/*.md ~/.codex/prompts/
```

以降、Codex起動中に:
```
@commander フェーズ判定お願いします
```

のように呼び出せます。

### 方法3. 直接ファイル参照

```
@.agents/skills/ec-lpo/SKILL.md に従ってLP改善案を作成してください
```

---

## 利用可能なエージェント・スキル一覧

全30部門・140Agent の詳細は [`AGENTS.md`](./AGENTS.md) を参照。代表的なものを以下に。

### ビジネス部門
| スキル | 役割 |
|---|---|
| `ec-commander` | 戦略・フェーズ判定・競合 |
| `pm` | 進行管理・WBS・リスク・品質 |
| `ec-acquisition` | 広告・SEO・集客 |
| `ec-creative` | コンテンツ・SNS |
| `ec-amazon-image-generator` | Amazon商品画像・Aプラス画像生成 |
| `pox-analysis` | POD/POP/POFによる競合比較・ポジショニング分析 |
| `ec-insight` | 分析・予測 |
| `ec-engagement` | CRM・メール・CS |
| `ec-operations` | CVR・価格・在庫 |
| `ec-lpo` | LP最適化 |
| `ec-drm` | セールスファネル・コピーライティング |

### コーポレート部門
| スキル | 役割 |
|---|---|
| `cfo` | 財務・P&L |
| `cto` | 技術戦略 |
| `chro` | 人事・組織 |
| `clo` | 法務・コンプライアンス |

### ワークフロー
| スキル | 用途 |
|---|---|
| `ec-weekly-workflow` | 週次最適化 |
| `ec-launch-workflow` | 新商品ローンチ |
| `ec-crowdfunding` | クラウドファンディング |
| `ec-amazon-strategy` | Amazon自社ブランド攻略 |
| `ec-solo` | ひとりEC運営 |

### 横断リサーチ・ポジショニング
| スキル | 用途 |
|---|---|
| `lazyweb-design-research` | Lazyweb MCP / Chrome / Webを使ったLP・UI参考調査 |
| `sns-research` | 無料枠優先のSNS・YouTube公開データ調査 |
| `pox-analysis` | Points of X（POD/POP/POF）による1対1競合ポジショニング分析 |

全コマンド一覧は `AGENTS.md` 内「コマンド一覧」セクション参照。

---

## セキュリティ（必読）

本テンプレートは、AIが誤って `.env` 等の機密情報を外部送信しないよう多層防御を設計しています。

### 優先度

| 層 | 目的 |
|---|---|
| 1. `.gitignore`（最優先） | そもそも git に乗せない |
| 2. `~/.gitignore_global` | 新規リポジトリでも自動除外 |
| 3. Codex承認モード | AIが破壊的操作する前に承認を求める |
| 4. pre-commit hook（gitleaks） | commit 時の自動スキャン |

### 絶対に守ってほしいこと

- ❌ `.env` を commit しない
- ❌ API キーをコード内にハードコードしない
- ❌ `git add -A` / `git add .` を確認せずに実行しない
- ✅ コミット前に `git status` を確認する癖をつける

詳細は [`SECURITY.md`](./SECURITY.md) を参照。

---

## カスタマイズ

### 最低限カスタマイズすべきファイル

1. **`AGENTS.md`**
   - ビジネスコンテキスト（目標売上・チャネル・フェーズ）
   - プロジェクト構図（自社チーム）

2. **`.agents/skills/ec-brand-strategy/SKILL.md`**
   - 自社ブランドの KBF → KSF → KGI → KPI

3. **`.agents/skills/notion-meeting-tasks/SKILL.md`**
   - Notion連携する場合のクライアントマッピング

### プロンプト改善フロー

1. スキルを実行する
2. 出力に不満があれば該当 `SKILL.md` を編集
3. 運用ルールに追加したいことは `AGENTS.md` に追記
4. ユーザー固有の指示は `AGENTS.local.md` に（`.gitignore` で除外済）

---

## トラブルシューティング

### 「AGENTS.md が認識されない」

- Codex CLI がリポジトリルートで起動されているか確認
- `codex --version` で最新版か確認（AGENTS.md対応は新しめのバージョンが必要）
- 起動後に `AGENTS.md を読み込んでいますか？` と直接聞いて確認

### 「スキルを呼び出しても期待通り動かない」

- スキル名が正確か確認（例: `commander` ではなく `ec-commander`）
- 対象SKILL.mdのパスを明示的に指定: `@.agents/skills/ec-commander/SKILL.md を使って…`

### 「commit しようとすると gitleaks でブロックされる」

- **これは正しい動作です**。機密情報が検出されています
- 該当ファイルから鍵を削除するか `.gitignore` に追加
- 緊急時のみ: `git commit --no-verify`（非推奨）

### 「`.env` が誤って commit されてしまった」

1. **まず該当APIキーを revoke（再発行）** — これが最優先
2. ローカルで: `git rm --cached .env` → `.gitignore` に `.env` 追加 → commit
3. 既に push 済みの場合、履歴削除（`git filter-repo` 等）を検討
4. 履歴削除しても漏洩した鍵は記録されているため、**必ず revoke**

### 「Codex CLIの承認モードを変えたい」

`.codex/config.toml` を編集:
```toml
[default]
approval_mode = "manual"  # 全操作に承認を求める
```

---

## FAQ

### Q. 商用利用可能ですか？

A. はい。MIT License で配布しています（[LICENSE](./LICENSE)）。

### Q. Claude Code 版との違いは？

A. [Claude Code版との違い](#claude-code版との違い) セクションを参照。機能的にはほぼ同等です。

### Q. Claude CodeとCodex CLI を併用できますか？

A. はい。併用する場合は `CLAUDE.md` を `AGENTS.md` のsymlinkにするか、同一内容をコピーしてください。

### Q. スキルを追加・削除できますか？

A. はい。`.agents/skills/` 配下に独自スキルを追加できます。不要なスキルは削除してもOK。

### Q. OpenAI API 料金はかかりますか？

A. はい。Codex CLI 経由で OpenAI のモデルを呼び出すため、使用量に応じた API 料金が発生します。料金は [OpenAI pricing](https://openai.com/api/pricing/) を参照。

---

## Claude Code版との違い

| 項目 | Claude Code版 | Codex版（本リポジトリ） |
|---|---|---|
| プロジェクト指示ファイル | `CLAUDE.md` | `AGENTS.md`（標準） |
| スキル配置 | `.claude/skills/` | `.agents/skills/` |
| 設定ファイル | `.claude/settings.json` | `.codex/config.toml` |
| スキル起動 | `/commander` 等のslash自動起動 | 「commanderスキルを使って」明示 or saved prompts |
| Hooks | `settings.json` にて定義 | 現状なし（pre-commitのみ） |
| モデル | Anthropic Claude | OpenAI GPT系 |

Claude Code版リポジトリ: `<YOUR_ORG_OR_USER>/ec-agent-system-template`

---

## ディレクトリ構成

```
.
├── .gitignore              # 機密ファイル除外（最優先）
├── .env.example            # 環境変数テンプレート
├── .codex/
│   └── config.toml         # Codex CLI設定（承認モード等）
├── AGENTS.md               # エージェント定義・運用ルール・コマンド一覧
├── README.md               # 本ファイル
├── SECURITY.md             # セキュリティポリシー
├── LICENSE                 # MIT License
├── CHANGELOG.md            # バージョン履歴
├── setup/
│   └── install-hooks.sh    # pre-commit hook セットアップ
├── codex-prompts/          # Codex saved prompts（@commander 等）
│   ├── commander.md
│   ├── weekly.md
│   └── ...
└── .agents/
    └── skills/
        ├── ec-commander/
        │   └── SKILL.md
        ├── ec-acquisition/
        │   ├── SKILL.md
        │   └── references/
        │       ├── bid-management.md
        │       └── ...
        └── ... （30+ スキル）
```

---

## ライセンス

[MIT License](./LICENSE)

## 更新履歴

[CHANGELOG.md](./CHANGELOG.md)
