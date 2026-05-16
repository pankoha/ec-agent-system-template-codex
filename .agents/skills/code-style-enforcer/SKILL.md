---
name: code-style-enforcer
description: コードがES modulesを使用し、CommonJSを使用していないことを検証します。import文を分割構文で記述することを推奨します。コードレビュー時、新規ファイル作成時、JavaScriptやTypeScriptファイルを編集する時に使用します。
---

# Code Style Enforcer Skill

このスキルは、プロジェクトのコーディング規約を自動的に検証・適用します。

## コーディング規約

### 必須ルール

#### 1. ES Modules使用（CommonJS禁止）

**✅ 正しい例（ES Modules）:**
```javascript
// 名前付きインポート
import { readFile, writeFile } from 'fs/promises';

// デフォルトインポート
import express from 'express';

// 名前空間インポート
import * as path from 'path';

// エクスポート
export const myFunction = () => {};
export default MyClass;
```

**❌ 間違った例（CommonJS）:**
```javascript
// require は使用禁止
const fs = require('fs');
const express = require('express');

// module.exports は使用禁止
module.exports = myFunction;
exports.myFunction = myFunction;
```

#### 2. Import分割構文の使用

**✅ 正しい例（分割構文）:**
```javascript
// 必要なものだけをインポート
import { useState, useEffect } from 'react';
import { map, filter, reduce } from 'lodash';
```

**⚠️ 推奨されない例:**
```javascript
// 名前空間全体をインポート（必要な場合のみ使用）
import * as React from 'react';
import * as _ from 'lodash';
```

## 検証項目

### 自動チェック

コードレビューや新規ファイル作成時に、以下を自動的にチェックします：

1. **`require()` の使用検出**
   - ファイル内に `require(` が含まれていないか
   - 検出した場合は ES modules への変換を提案

2. **`module.exports` の使用検出**
   - `module.exports` や `exports.` が含まれていないか
   - 検出した場合は `export` への変換を提案

3. **Import構文の確認**
   - 分割構文が使用可能な箇所を特定
   - より効率的なimport方法を提案

## 使用シーン

### シーン1: 新規ファイル作成時

新しいJavaScript/TypeScriptファイルを作成する際、自動的にES modules形式でコードを生成します。

```typescript
// 新規ファイル: src/utils/database.ts
import { Pool } from 'pg';
import { config } from './config';

export const createPool = () => {
  return new Pool(config.database);
};
```

### シーン2: 既存コードのレビュー時

既存のコードをレビューする際、CommonJSの使用を検出して修正を提案します。

**Before:**
```javascript
const express = require('express');
const app = express();

module.exports = app;
```

**After:**
```javascript
import express from 'express';
const app = express();

export default app;
```

### シーン3: プルリクエストレビュー

PRのコード変更を確認し、規約違反を指摘します。

## 変換ガイド

### CommonJS → ES Modules

#### パターン1: require → import
```javascript
// Before
const fs = require('fs');
const path = require('path');

// After
import fs from 'fs';
import path from 'path';
```

#### パターン2: require（分割） → import（分割）
```javascript
// Before
const { readFile } = require('fs/promises');

// After
import { readFile } from 'fs/promises';
```

#### パターン3: module.exports → export
```javascript
// Before
function myFunction() {}
module.exports = myFunction;

// After
export default function myFunction() {}
```

#### パターン4: exports → named export
```javascript
// Before
exports.foo = 'bar';
exports.baz = 123;

// After
export const foo = 'bar';
export const baz = 123;
```

## 例外ケース

### 許可される場合

以下の場合は CommonJS の使用が許可される場合があります：

1. **設定ファイル（レガシー）**
   ```javascript
   // webpack.config.js（古いバージョン）
   module.exports = { /* ... */ };
   ```

2. **動的インポート**
   ```javascript
   // 条件付きインポートは import() を使用
   const module = await import('./module.js');
   ```

ただし、可能な限りES modulesに移行することを推奨します。

## トラブルシューティング

### package.jsonの設定

ES modulesを使用するには、`package.json` に以下を追加：

```json
{
  "type": "module"
}
```

または、ファイル拡張子を `.mjs` に変更します。

### TypeScriptの設定

`tsconfig.json` で以下を設定：

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

## CLAUDE.mdルールとの連携

このスキルはプロジェクトルートの `AGENTS.md`（または `CLAUDE.md`）に記載されているコードスタイルルールを適用します：

- ✅ ES modules（import/export）を使用、CommonJS（require）は不可
- ✅ 可能な限りimportを分割構文で記述

## チェックリスト

コードレビュー時に以下を確認：

- [ ] `require()` が使用されていないか
- [ ] `module.exports` や `exports.` が使用されていないか
- [ ] `import` 文が分割構文で記述されているか
- [ ] 不要な名前空間インポート（`import *`）がないか
- [ ] `package.json` で `"type": "module"` が設定されているか（必要に応じて）

## 参考リソース

- プロジェクトルート `AGENTS.md` / `CLAUDE.md` - プロジェクトコーディング規約
- [MDN: ES Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Node.js ES Modules](https://nodejs.org/api/esm.html)
