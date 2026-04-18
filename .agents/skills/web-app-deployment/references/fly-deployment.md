# Fly.ioデプロイ手順 — 汎用Webアプリ

## 対応アプリ
- Node.js (Express, Hono, React Router, Next.js standalone, Remix)
- Python (FastAPI, Django, Flask)
- Go, Rust等のDockerizeされたアプリ

## Step 1: Fly CLI インストール & ログイン

```bash
# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"

# Mac
brew install flyctl
# or
curl -L https://fly.io/install.sh | sh

# Linux
curl -L https://fly.io/install.sh | sh

# ログイン（ブラウザが開く）
fly auth login
```

## Step 2: fly.toml 作成

### Node.js アプリ（PostgreSQL付き）
```toml
app = 'my-app'
primary_region = 'nrt'  # nrt=Tokyo, sin=Singapore, iad=Virginia

[build]
# Dockerfile を自動検出

[deploy]
  release_command = 'npx prisma migrate deploy'  # Prisma使用時

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

### Python アプリ（FastAPI）
```toml
app = 'my-fastapi-app'
primary_region = 'nrt'

[build]

[deploy]
  release_command = 'alembic upgrade head'  # Alembic使用時

[http_service]
  internal_port = 8000
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

### 静的サイト + API（分離構成）
```toml
app = 'my-static-site'
primary_region = 'nrt'

[build]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0

[[statics]]
  guest_path = "/app/public"
  url_prefix = "/static/"
```

## Step 3: リージョン選択ガイド

| リージョン | コード | 用途 |
|-----------|-------|------|
| Tokyo | `nrt` | 日本向けアプリ（最優先） |
| Singapore | `sin` | 東南アジア向け |
| Virginia | `iad` | 米国東海岸、グローバルデフォルト |
| London | `lhr` | ヨーロッパ向け |

```bash
# 利用可能なリージョン一覧
fly platform regions
```

## Step 4: アプリ作成 & PostgreSQL セットアップ

```bash
# アプリ作成
fly apps create my-app --org personal

# PostgreSQL作成
fly postgres create \
  --name my-app-db \
  --region nrt \
  --vm-size shared-cpu-1x \
  --initial-cluster-size 1 \
  --volume-size 1

# DBをアプリにアタッチ（DATABASE_URL が自動設定される）
fly postgres attach my-app-db --app my-app
```

**PostgreSQLなしの場合（静的サイト、外部DB利用時）:**
```bash
# アプリ作成のみ
fly apps create my-app --org personal
```

## Step 5: Secrets 設定

```bash
# 個別設定
fly secrets set API_KEY=xxx --app my-app

# 複数まとめて設定
fly secrets set \
  DATABASE_URL=postgres://... \
  API_KEY=xxx \
  JWT_SECRET=yyy \
  --app my-app

# 設定済みsecrets一覧（値は非表示）
fly secrets list --app my-app

# secret削除
fly secrets unset API_KEY --app my-app
```

## Step 6: デプロイ

```bash
# 通常デプロイ
fly deploy

# ビルドログを詳細表示
fly deploy --verbose

# 特定のDockerfileを指定
fly deploy --dockerfile Dockerfile.production

# ローカルビルド（Depot使わない）
fly deploy --local-only
```

## Step 7: デプロイ後の検証

```bash
# HTTP応答確認
curl -sI https://my-app.fly.dev

# アプリステータス
fly status --app my-app

# リアルタイムログ
fly logs --app my-app

# マシン一覧
fly machine list --app my-app

# SSH接続（デバッグ用）
fly ssh console --app my-app

# PostgreSQL直接接続
fly postgres connect --app my-app-db
```

## Step 8: スケーリング

```bash
# マシン数を変更
fly scale count 3 --app my-app

# VMサイズを変更
fly scale vm shared-cpu-2x --memory 1024 --app my-app

# オートスケール設定確認
fly scale show --app my-app
```

## Step 9: カスタムドメイン

```bash
# ドメイン追加（TLS自動取得）
fly certs create example.com --app my-app

# 証明書ステータス確認
fly certs show --app my-app

# IPアドレス確認（DNS設定用）
fly ips list --app my-app
```

**DNS設定:**
```
# Aレコード（IPv4）
example.com → <fly ips list のIPv4>

# AAAAレコード（IPv6）
example.com → <fly ips list のIPv6>

# サブドメインの場合はCNAME
app.example.com → my-app.fly.dev
```

## コスト目安

| 構成 | スペック | 月額目安 |
|------|---------|---------|
| **最小構成** | App(shared-cpu-1x, 256MB) × 1 + PG(同) | ~$5-7 |
| **開発用** | App(shared-cpu-1x, 512MB) × 2 + PG(256MB, 1GB) | ~$10-12 |
| **本番小規模** | App(shared-cpu-2x, 1GB) × 2 + PG(1GB, 10GB) | ~$30-40 |
| **本番中規模** | App(performance-2x, 4GB) × 3 + PG(4GB, 40GB) | ~$150-200 |

**コスト削減Tips:**
- `auto_stop_machines = 'stop'`: アイドル時にマシン停止（開発/小規模向け）
- `min_machines_running = 0`: 全マシン停止可能に（コールドスタートあり）
- 不要なマシンは `fly machine destroy` で削除

## トラブルシューティング

### ビルド失敗
```bash
# ローカルでDockerビルドテスト
docker build -t test .
docker run -p 3000:3000 test
```

### デプロイ後にアクセスできない
```bash
# ログでエラー確認
fly logs --app my-app

# マシン状態確認
fly machine list --app my-app

# internal_portが正しいか確認
fly config show --app my-app
```

### DB接続エラー
```bash
# DB稼働確認
fly status --app my-app-db

# 接続テスト
fly postgres connect --app my-app-db

# DATABASE_URL確認
fly ssh console --app my-app -C "echo \$DATABASE_URL"
```

### メモリ不足（OOMKilled）
```bash
# メモリ増量
fly scale vm shared-cpu-1x --memory 1024 --app my-app
```
