# Fly.ioデプロイ手順 — Shopifyアプリ

## 前提条件
- Node.js 20+ アプリ（Dockerfile あり）
- Prisma ORM（PostgreSQL対応済み）
- Shopify CLIでアプリ設定済み（`shopify.app.toml` に client_id あり）

## Step 1: Fly CLI インストール & ログイン

```bash
# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Mac/Linux
curl -L https://fly.io/install.sh | sh

# ログイン（ブラウザが開く）
fly auth login
```

## Step 2: fly.toml 作成

```toml
# fly.toml
app = 'アプリ名'
primary_region = 'nrt'  # Tokyo

[build]
# Dockerfile を自動検出

[deploy]
  release_command = 'npx prisma migrate deploy'

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0
  processes = ['app']

[[vm]]
  memory = '512mb'
  cpu_kind = 'shared'
  cpus = 1
```

**重要設定:**
| 設定 | 値 | 理由 |
|------|---|------|
| `primary_region` | `nrt` | 日本向けアプリはTokyoリージョン |
| `force_https` | `true` | App Store審査でTLS必須 |
| `release_command` | `npx prisma migrate deploy` | デプロイ時にDB自動マイグレーション |
| `auto_stop_machines` | `stop` | アイドル時にコスト削減 |
| `internal_port` | `3000` | react-router-serveのデフォルトポート |

## Step 3: Dockerfile（Fly.io対応版）

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN npx prisma generate
RUN npm run build

CMD ["npm", "run", "start"]
```

**ポイント:**
- `prisma generate` はビルド時に実行（Prisma Clientをnode_modulesに生成）
- `prisma migrate deploy` はfly.tomlの `release_command` で実行（デプロイ時）
- `CMD` は `start`（`docker-start` ではなく）— マイグレーションはrelease_commandが担当

## Step 4: .dockerignore

```
.cache
build
node_modules
engine/
prisma/dev.sqlite
prisma/dev.sqlite-journal
.env
.env.*
fly.toml
```

## Step 5: アプリ作成 & PostgreSQL セットアップ

```bash
# アプリ作成
fly apps create アプリ名 --org personal

# PostgreSQL作成（Tokyo、最小構成）
fly postgres create \
  --name アプリ名-db \
  --region nrt \
  --vm-size shared-cpu-1x \
  --initial-cluster-size 1 \
  --volume-size 1

# DBをアプリにアタッチ（DATABASE_URL が自動設定される）
fly postgres attach アプリ名-db --app アプリ名
```

**注意:** `fly postgres create` の出力に表示されるパスワードは保存すること（二度と表示されない）

## Step 6: Secrets 設定

```bash
fly secrets set \
  SHOPIFY_API_KEY=<client_id from shopify.app.toml> \
  SHOPIFY_API_SECRET=<Partners Dashboard > App > Client credentials > Client secret> \
  SHOPIFY_APP_URL=https://アプリ名.fly.dev \
  SCOPES=read_orders \
  --app アプリ名
```

**必須Secrets:**
| Secret | 取得元 | 用途 |
|--------|-------|------|
| `DATABASE_URL` | `fly postgres attach` で自動設定 | PostgreSQL接続 |
| `SHOPIFY_API_KEY` | `shopify.app.toml` の `client_id` | OAuth認証 |
| `SHOPIFY_API_SECRET` | Partners Dashboard | HMAC署名検証 |
| `SHOPIFY_APP_URL` | `https://アプリ名.fly.dev` | コールバックURL |
| `SCOPES` | `shopify.app.toml` の `scopes` | APIアクセス範囲 |

## Step 7: デプロイ

```bash
fly deploy
```

**デプロイフロー:**
1. Dockerイメージビルド（Depot経由）
2. イメージをFlyレジストリにpush
3. `release_command` 実行（`prisma migrate deploy`）
4. マシン起動（2台 — HA構成）
5. DNS設定 & TLS証明書自動発行

## Step 8: shopify.app.toml のURL更新

```toml
# Before
application_url = "https://旧ドメイン"
redirect_urls = [ "https://旧ドメイン/auth/callback" ]

# After
application_url = "https://アプリ名.fly.dev"
redirect_urls = [ "https://アプリ名.fly.dev/auth/callback" ]
```

```bash
# Partners Dashboard に設定を同期
shopify app deploy --force
```

## Step 9: 検証

```bash
# TLS + HTTP応答確認
curl -sI https://アプリ名.fly.dev

# 期待結果:
# HTTP/1.1 200 OK
# server: Fly/...
# via: 1.1 fly.io

# アプリステータス確認
fly status --app アプリ名

# ログ確認
fly logs --app アプリ名
```

## トラブルシューティング

### release_command 失敗（prisma migrate deploy）
```bash
# ログ確認
fly logs --app アプリ名

# DB接続テスト
fly postgres connect --app アプリ名-db
```
**よくある原因:** DATABASE_URLの形式不正、DBがまだ起動していない

### HMAC検証チェック失敗
- `SHOPIFY_API_SECRET` が正しく設定されているか確認
- `fly secrets list --app アプリ名` で設定済みsecretを確認
- サーバーが200/302を返しているか `curl -sI` で確認

### TLS証明書チェック失敗
- `fly.toml` に `force_https = true` があるか確認
- `fly certs show --app アプリ名` でTLS状態を確認
- Fly.ioは `*.fly.dev` ドメインにTLSを自動発行する

### マシンがすぐ停止する
- `auto_stop_machines = 'stop'` の場合、リクエストがないとスリープする
- これは正常動作 — リクエスト受信時に `auto_start_machines = true` で自動復帰

## コスト目安（最小構成）

| リソース | スペック | 月額目安 |
|---------|--------|---------|
| App Machine (shared-cpu-1x, 512MB) × 2 | auto_stop有効 | ~$3-5 |
| PostgreSQL (shared-cpu-1x, 256MB, 1GB) | 常時稼働 | ~$7 |
| **合計** | | **~$10-12/月** |
