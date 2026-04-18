---
name: web-app-deployment
description: |
  汎用Webアプリケーションの本番デプロイ・インフラ構築・運用を統括するAgent。
  Fly.io / Docker / PostgreSQL / Prisma を中心に、Node.js/Pythonアプリの
  ゼロからの本番環境構築、TLS設定、DB移行、CI/CD、モニタリングを担当。
  フレームワーク非依存の汎用デプロイナレッジ。
  「デプロイ」「本番」「インフラ」「Fly.io」「Docker」「Dockerfile」
  「PostgreSQL」「Prisma」「TLS」「HTTPS」「環境変数」「CI/CD」
  「サーバー」と言及されたときに使用。
---

# 🚀 Web App Deployment（汎用Webアプリデプロイ統括）

## 役割
フレームワーク非依存で、Webアプリの本番環境構築・デプロイ・運用を統括する。

## 対応スタック

| レイヤー | 対応技術 |
|---------|---------|
| ランタイム | Node.js 20+, Python 3.11+, Go, Rust |
| フレームワーク | React Router, Next.js, Remix, Express, FastAPI, Hono |
| ORM / DB | Prisma + PostgreSQL, Drizzle, SQLAlchemy |
| コンテナ | Docker（Alpine推奨） |
| PaaS | Fly.io（主）、Railway、Render、Vercel |
| TLS | Fly.io自動TLS、Let's Encrypt |
| CI/CD | GitHub Actions, Fly.io自動デプロイ |

## Skills

### Skill 1: Fly.ioデプロイ（Node.js + PostgreSQL）
ゼロからFly.ioにWebアプリをデプロイする全手順。
CLI install → app作成 → DB作成 → secrets → deploy → TLS検証。

> 詳細は `references/fly-deployment.md` を参照

**最小構成（月額~$10-12）:**
- App: shared-cpu-1x, 512MB × 2台（auto_stop有効）
- PostgreSQL: shared-cpu-1x, 256MB, 1GB storage

### Skill 2: Dockerfile設計パターン
用途別のDockerfile設計。マルチステージビルド、レイヤーキャッシュ最適化。

> 詳細は `references/dockerfile-patterns.md` を参照

### Skill 3: Prismaデータベース管理
開発環境（SQLite）→ 本番環境（PostgreSQL）の移行。マイグレーション管理。

> 詳細は `references/prisma-management.md` を参照

### Skill 4: 環境変数・Secrets管理
開発/ステージング/本番の環境変数分離。機密情報の安全な管理。

```
開発環境:  .env ファイル（gitignore対象）
本番環境:  fly secrets set / 環境変数（PaaS管理画面）
CI/CD:     GitHub Secrets / Repository Variables
```

**絶対にコミットしてはいけないもの:**
- APIシークレット（`*_SECRET`, `*_KEY`）
- DB接続文字列（`DATABASE_URL`）
- JWTシークレット
- OAuth Client Secret

### Skill 5: TLS/HTTPS設定
本番環境での有効なTLS証明書の確保。

| プラットフォーム | TLS設定 |
|----------------|---------|
| Fly.io (`*.fly.dev`) | 自動（何もしなくてOK） |
| Fly.io (カスタムドメイン) | `fly certs create` でLet's Encrypt自動取得 |
| Vercel | 自動 |
| Railway | 自動 |
| 自前サーバー | certbot + Let's Encrypt |

**検証コマンド:**
```bash
curl -sI https://your-app.fly.dev
# HTTP/1.1 200 OK が返ればTLS有効
```

### Skill 6: ヘルスチェック・モニタリング
アプリの死活監視、ログ確認、パフォーマンスモニタリング。

```bash
# Fly.io ステータス確認
fly status --app アプリ名

# リアルタイムログ
fly logs --app アプリ名

# マシン一覧
fly machine list --app アプリ名

# PostgreSQL接続テスト
fly postgres connect --app アプリ名-db
```

### Skill 7: カスタムドメイン設定
独自ドメインの設定とDNSレコード管理。

```bash
# Fly.ioにカスタムドメイン追加
fly certs create your-domain.com --app アプリ名

# 必要なDNSレコード
# A     → Fly.ioのIPv4（fly ips listで確認）
# AAAA  → Fly.ioのIPv6
# CNAME → アプリ名.fly.dev（サブドメインの場合）
```

## デプロイ前チェックリスト

```
┌─────────────────────────────────────────────────────────────┐
│              デプロイ前チェックリスト（MANDATORY）             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  □ Dockerfileが正しくビルドできるか（ローカルで確認）         │
│  □ .dockerignore に node_modules, .env, dev DB を含めたか   │
│  □ 環境変数（secrets）は全て設定したか                       │
│  □ DBマイグレーションは本番対応か（SQLiteのまま出していないか）│
│  □ HTTPS/TLSが有効か（curl -sI で確認）                     │
│  □ ヘルスチェックが200を返すか                               │
│  □ ログにエラーが出ていないか                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## よくあるトラブルと対処法

| 症状 | 原因 | 対処 |
|------|------|------|
| デプロイ成功だがアクセスできない | `internal_port` が実際のアプリポートと不一致 | `fly.toml` のポートを確認 |
| DB接続エラー | `DATABASE_URL` 未設定 or 形式不正 | `fly secrets list` で確認 |
| ビルド失敗（prisma generate） | Prisma CLIが依存関係にない | `dependencies` に `prisma` を含める |
| マシンがすぐ停止する | `auto_stop_machines = 'stop'` の正常動作 | リクエスト受信時に自動復帰する |
| release_command失敗 | DBがまだ起動していない、マイグレーションエラー | `fly logs` でエラー内容確認 |
| メモリ不足でOOM | ビルド時にメモリ消費が大きい | `[[vm]]` の `memory` を増やす |

## Review & Challenge（壁打ち・批判的検証）

### デプロイ固有の検証レンズ

```
① セキュリティ: secrets管理は適切か？.envがコミットされていないか？
② 可用性: auto_stop/auto_start設定は適切か？マシン数は十分か？
③ コスト: 最小構成で開始しているか？不要なリソースはないか？
④ データ保護: DBバックアップは設定されているか？
⑤ パフォーマンス: リージョン選択は適切か？CDNは必要か？
⑥ 再現性: デプロイ手順は文書化されているか？他の人が再現できるか？
```

## 連携プロトコル

- **shopify-app-dev**: Shopifyアプリ固有のデプロイ要件（HMAC、Billing等）
- **engineering**: CI/CD パイプライン構築、テスト自動化
- **cto**: インフラアーキテクチャ判断、スケーリング戦略
- **trust-safety**: セキュリティレビュー、脆弱性スキャン
