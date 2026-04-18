# Codex Saved Prompts

このディレクトリには、Codex CLI で `@コマンド名` として呼び出せるプロンプトテンプレートを収録しています。

## インストール方法

```bash
mkdir -p ~/.codex/prompts
cp codex-prompts/*.md ~/.codex/prompts/
```

## 使い方

Codex CLI 起動中に以下のように呼び出します:

```
@commander 現状のフェーズ判定をお願いします
```

```
@weekly 先週のKPIをまとめて、今週のアクション提案をお願いします
```

```
@launch 新商品「食材保存容器XYZ」、6月発売予定
```

## 収録プロンプト

| プロンプト | 対応スキル | 用途 |
|---|---|---|
| `commander.md` | `ec-commander` | 戦略・フェーズ判定・競合分析 |
| `weekly.md` | `ec-weekly-workflow` | 週次最適化（9ステップ） |
| `launch.md` | `ec-launch-workflow` | 新商品ローンチ（8フェーズ） |

## 独自プロンプトの追加

既存プロンプトをコピーして編集し、`~/.codex/prompts/` に配置すると新しい `@コマンド名` として使えます。

テンプレートの書式:

```markdown
---
name: コマンド名
description: 説明文
---

プロンプト本文。{{input}} はユーザーからの入力で置換される。
```

## 注意

- Codex CLI のバージョンにより saved prompts の仕様が変わる可能性があります
- 現行仕様は `codex --help` で確認してください
- saved prompts が使えない環境では、直接「commanderスキルを使って」等と自然言語で呼び出してください
