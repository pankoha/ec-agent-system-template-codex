---
name: workflow-validator
description: プロジェクトのワークフローに従っているか検証します。コード変更後のtypecheck実行、単体テスト実行、connection pool使用、エラーハンドリングを確認します。コードレビュー時、プルリクエスト作成時、データベース操作やAPI実装時に使用します。
---

# Workflow Validator Skill

このスキルは、プロジェクトの開発ワークフローが正しく守られているかを検証します。

## 検証項目

### 1. コード変更後のtypecheck実行

#### ルール
コードを変更した後は、**必ず** `npm run typecheck` を実行します。

#### 検証方法
```bash
# コード変更後
npm run typecheck

# エラーがないことを確認
# ✅ No errors found
```

#### チェックポイント
- [ ] コード変更後にtypecheckを実行したか
- [ ] 型エラーが解決されているか
- [ ] 新規追加した関数・変数に型定義があるか

### 2. テストの実行方法

#### ルール
パフォーマンスのため、**テストは単体で実行**します。全体実行は避けます。

#### 正しい実行方法
```bash
# ✅ 特定のテストファイルを実行
npm run test src/utils/parser.test.ts

# ✅ 特定のテストケースを実行
npm run test -- --grep "should parse JSON correctly"

# ❌ 全体実行は避ける（重い・遅い）
npm run test  # 全テストが実行される
```

#### チェックポイント
- [ ] 単体テストとして実行しているか
- [ ] 関連するテストのみを実行しているか
- [ ] CI/CD以外で全体テストを実行していないか

### 3. データベース接続のconnection pool使用

#### ルール
データベース接続には、**必ずconnection poolを使用**します。

#### 正しい実装
```typescript
// ✅ connection poolを使用
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  database: 'mydb',
  max: 20,           // 最大接続数
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const query = async (text: string, params: any[]) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();  // 接続を解放
  }
};
```

#### 間違った実装
```typescript
// ❌ 毎回新しい接続を作成（非効率）
import { Client } from 'pg';

export const query = async (text: string, params: any[]) => {
  const client = new Client({
    host: 'localhost',
    database: 'mydb',
  });
  await client.connect();
  const result = await client.query(text, params);
  await client.end();
  return result;
};
```

#### チェックポイント
- [ ] `Pool` を使用しているか（`Client` を直接使用していないか）
- [ ] 接続を適切に解放（`release()`）しているか
- [ ] connection poolの設定（max, timeout）が適切か

### 4. APIレスポンスのエラーハンドリング

#### ルール
APIレスポンスには、**必ずエラーハンドリングを含める**必要があります。

#### 正しい実装
```typescript
// ✅ 適切なエラーハンドリング
export const fetchUser = async (id: string) => {
  try {
    const response = await fetch(`/api/users/${id}`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };

  } catch (error) {
    console.error('Failed to fetch user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// ✅ Expressルートでのエラーハンドリング
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({ success: true, data: user });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});
```

#### 間違った実装
```typescript
// ❌ エラーハンドリングなし
export const fetchUser = async (id: string) => {
  const response = await fetch(`/api/users/${id}`);
  const data = await response.json();  // エラー時にクラッシュ
  return data;
};

// ❌ エラーを無視
app.get('/api/users/:id', async (req, res) => {
  const user = await getUserById(req.params.id);
  res.json(user);  // エラー時の処理がない
});
```

#### チェックポイント
- [ ] `try-catch` ブロックでエラーをキャッチしているか
- [ ] HTTPステータスコードを適切に返しているか
- [ ] エラーメッセージがユーザーフレンドリーか
- [ ] エラーログが記録されているか
- [ ] エラー時に適切なレスポンス形式を返しているか

## ワークフロー全体図

```
1. コード変更
   ↓
2. typecheck実行 ✅
   ↓
3. 単体テスト実行 ✅
   ↓
4. コードレビュー
   - Connection pool使用確認 ✅
   - エラーハンドリング確認 ✅
   ↓
5. コミット・プッシュ
   ↓
6. PR作成
```

## 使用シーン

### シーン1: コード変更後

```bash
# 1. ファイルを編集
vim src/api/users.ts

# 2. typecheckを実行（必須）
npm run typecheck

# 3. 関連テストを実行
npm run test src/api/users.test.ts

# 4. 問題なければコミット
git add src/api/users.ts
git commit -m "Add user API endpoint with proper error handling"
```

### シーン2: プルリクエストレビュー

PRをレビューする際、以下を確認：

1. **Typecheck済みか**
   - CI/CDでtypecheckが通っているか
   - 型エラーが残っていないか

2. **テストが適切か**
   - 単体テストが追加されているか
   - テストが関連機能のみをカバーしているか

3. **データベース操作**
   - connection poolを使用しているか
   - 接続が適切に解放されているか

4. **エラーハンドリング**
   - すべてのAPI呼び出しにエラー処理があるか
   - 適切なHTTPステータスコードが返されるか

### シーン3: 新規API実装

新しいAPIエンドポイントを実装する際：

```typescript
import { Router } from 'express';
import { pool } from './database';  // connection pool

const router = Router();

// ✅ 全てのベストプラクティスを適用
router.post('/api/items', async (req, res) => {
  try {
    // Validation
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Database query with connection pool
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO items (name, description) VALUES ($1, $2) RETURNING *',
        [name, description]
      );

      res.status(201).json({
        success: true,
        data: result.rows[0]
      });

    } finally {
      client.release();  // 接続解放
    }

  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create item'
    });
  }
});

export default router;
```

## 自動検証

このスキルは以下を自動的に検証します：

1. **コード内の問題検出**
   - `new Client()` の使用を検出 → `Pool` の使用を推奨
   - `try-catch` のないAPI呼び出しを検出
   - エラーハンドリングのないfetch呼び出しを検出

2. **ワークフロー違反の警告**
   - typecheckなしでのコミット試行を警告
   - 全体テスト実行を検出して単体テストを推奨

## AGENTS.mdルールとの連携

このスキルは `./AGENTS.md` に記載されているワークフローと注意事項を適用します：

### ワークフロー
- ✅ コード変更後は必ずtypecheckを実行
- ✅ パフォーマンスのため、テストは単体で実行（全体実行は避ける）

### 重要な注意事項
- ✅ データベース接続にはconnection poolを使用すること
- ✅ APIレスポンスは必ずエラーハンドリングを含めること

## トラブルシューティング

### Typecheckでエラーが出る
```bash
# エラー内容を確認
npm run typecheck

# 型定義を追加
# Before: function process(data) { ... }
# After:  function process(data: UserData): Result { ... }
```

### Connection poolの設定エラー
```typescript
// 環境変数から設定を読み込む
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});
```

### エラーハンドリングの追加忘れ
```typescript
// リファクタリング: エラーハンドリングを追加
const result = await fetchData();  // ❌

try {  // ✅
  const result = await fetchData();
} catch (error) {
  handleError(error);
}
```

## チェックリスト

開発時に以下を確認：

- [ ] コード変更後にtypecheckを実行したか
- [ ] テストは単体で実行しているか
- [ ] データベース接続にconnection poolを使用しているか
- [ ] 接続を適切に解放（release）しているか
- [ ] すべてのAPI呼び出しにエラーハンドリングがあるか
- [ ] 適切なHTTPステータスコードを返しているか
- [ ] エラーメッセージが明確か

## 参考リソース

- [AGENTS.md](./AGENTS.md) - プロジェクトワークフロー
- [Node.js Connection Pooling](https://node-postgres.com/features/pooling)
- [Error Handling Best Practices](https://expressjs.com/en/guide/error-handling.html)
