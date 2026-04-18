# Changelog

All notable changes to this template will be documented in this file.

## [2.6.0-codex] - 2026-04-18

### Added
- **Codex CLI 専用テンプレート**として新規リリース
- `AGENTS.md` を主要ファイルとして採用（Codex CLIの標準規約）
- `.codex/config.toml` 新設（承認モード・禁止コマンド等の設定テンプレート）
- `codex-prompts/` ディレクトリ新設
  - `commander.md` — 戦略統括プロンプト
  - `weekly.md` — 週次最適化プロンプト
  - `launch.md` — 新商品ローンチプロンプト
  - `README.md` — saved prompts使い方ガイド
- README全面改稿: Codex CLI向けセットアップ・使い方・トラブルシューティング

### Changed
- ディレクトリ構造を Codex/AGENTS.md 標準に変換
  - `.claude/skills/` → `.agents/skills/`
  - `CLAUDE.md` → `AGENTS.md`
- 全スキル内のパス参照を `.agents/skills/` に統一
- 内部リンクの `CLAUDE.md` 参照を `AGENTS.md` に統一

### Security
- Claude Code版と同等の多層防御（.gitignore / gitleaks / pre-commit hook）を維持
- `SECURITY.md` を Codex CLI前提に調整

---

## 関連リポジトリ

- **Claude Code版**: https://github.com/hamano-takashi/ec-agent-system-template
  - `CLAUDE.md` + `.claude/skills/` 構造
  - Claude Code / Anthropic Claude 使用前提

本リポジトリ（Codex CLI版）と Claude Code版は内容的に同等ですが、
AI CLIごとの規約・ファイル命名に合わせて分岐しています。
両方を併用する場合は、どちらか一方の`AGENTS.md`/`CLAUDE.md`を他方のsymlinkにする運用を推奨。
