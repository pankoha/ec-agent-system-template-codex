# Changelog

All notable changes to this template will be documented in this file.

## [Unreleased] - 2026-07-01

### Added
- Amazon注文確定商品リサーチの注文番号連動、管理表削除同期、変更トリガー
- メイン表・リサーチ管理表への候補URL、状態、確認メモ、最終リサーチ日時の同期
- リサーチ管理表の不存在・非表示・注文番号重複時の継続処理と確認用記録
- Gmail注文確定メールの再確認強化、削除済み注文番号の記録、132行目以降の削除済み登録メニュー
- Amazon出品者向け通知の`新規の注文`文面をGmail自動取得対象に追加し、取り込みバッチ内の日付昇順追加を強化
- `注文確定： SKU 商品名`形式の件名から商品名・SKUを補完し、本文に商品ラベルがない注文通知の取り込み漏れを防止
- A列を`注文日`/`出荷予定日`の2行表示に戻し、新規追加行を注文日優先で昇順追加
- `lazyweb-design-research` skill: Lazyweb MCP / Chrome / Webを使ったLP・UI参考調査と実装前デザイン方向性整理
- `sns-research` skill: 無料枠優先のSNS・YouTube公開データ調査、競合分析、投稿案・LP訴求抽出
- `pox-analysis` skill: Points of X（POD/POP/POF）による自社 vs 競合1社の差別化・ポジショニング分析

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

- **Claude Code版**: `<YOUR_ORG_OR_USER>/ec-agent-system-template`
  - `CLAUDE.md` + `.claude/skills/` 構造
  - Claude Code / Anthropic Claude 使用前提

本リポジトリ（Codex CLI版）と Claude Code版は内容的に同等ですが、
AI CLIごとの規約・ファイル命名に合わせて分岐しています。
両方を併用する場合は、どちらか一方の`AGENTS.md`/`CLAUDE.md`を他方のsymlinkにする運用を推奨。
