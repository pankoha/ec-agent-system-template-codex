---
name: commit-helper
description: git commitの前にtypecheckを実行し、プロジェクトのコーディング規約に準拠したコミットメッセージを生成します。コミットを作成する時、変更をレビューする時、gitコマンドを実行する時に使用します。
---

# Commit Helper Skill

このスキルは、プロジェクトのワークフローに従った適切なコミットプロセスを支援します。

## 機能

### 1. コミット前のtypecheck実行
コミットを作成する前に、必ず `npm run typecheck` を実行して型エラーがないことを確認します。

### 2. コーディング規約の検証
以下の規約に準拠しているか確認します：
- **ES modules使用**: `import`/`export`を使用
- **CommonJS禁止**: `require`は使用しない
- **import分割構文**: 可能な限り分割構文で記述

### 3. コミットメッセージの生成
変更内容に基づいて、明確で簡潔なコミットメッセージを提案します。

## 使用方法

### ステップ1: 変更の確認
```bash
git status
git diff
```

### ステップ2: typecheckの実行
```bash
npm run typecheck
```

型エラーがある場合は、コミット前に必ず修正します。

### ステップ3: コミットメッセージの作成
変更内容を分析し、以下の形式でコミットメッセージを提案：
- 簡潔なサマリー（50文字以内）
- 詳細な説明（必要に応じて）
- 影響範囲の明記

### ステップ4: コミット実行
```bash
git add <files>
git commit -m "メッセージ"
```

## AGENTS.mdルールとの連携

このスキルは `./AGENTS.md` に記載されているルールに基づいています：

### ワークフロー
- ✅ コード変更後は必ずtypecheckを実行
- ✅ パフォーマンスのため、テストは単体で実行

### コードスタイル
- ✅ ES modules（import/export）を使用、CommonJS（require）は不可
- ✅ 可能な限りimportを分割構文で記述

## ベストプラクティス

1. **小さく、頻繁にコミット**: 論理的な単位でコミットを分割
2. **意味のあるメッセージ**: 何を変更したかではなく、なぜ変更したかを記載
3. **型安全性の維持**: typecheckを通過してからコミット
4. **規約の遵守**: ES modulesの使用を徹底

## 例

### 良いコミット例
```bash
# typecheckを実行
npm run typecheck

# エラーなし - コミット可能
git add src/utils/parser.ts
git commit -m "Add JSON parser with proper error handling

- Implement type-safe JSON parsing using ES modules
- Add validation for malformed input
- Include comprehensive error messages"
```

### 悪いコミット例（避けるべき）
```bash
# typecheckをスキップ - 避けるべき
git add src/utils/parser.js
git commit -m "update"  # 不明確なメッセージ

# CommonJSを使用 - 規約違反
const fs = require('fs');  # ES modulesを使用すべき
```

## トラブルシューティング

### typecheckが失敗する場合
1. エラーメッセージを確認
2. 型定義を追加・修正
3. 再度typecheckを実行
4. すべて通過したらコミット

### CommonJSが残っている場合
```javascript
// 悪い例
const module = require('./module');

// 良い例
import { module } from './module';
```

## 参考リソース

- [AGENTS.md](./AGENTS.md) - プロジェクトルール
- npm run typecheck - 型チェックコマンド
- npm run build - ビルドコマンド
- npm run test - テストコマンド
