# Dockerfile設計パターン — 汎用Webアプリ

## 基本方針
- **マルチステージビルド**: ビルド環境と実行環境を分離し、イメージサイズを最小化
- **Alpine Linux**: 軽量ベースイメージ（`node:20-alpine`, `python:3.12-alpine`）
- **レイヤーキャッシュ**: 依存関係ファイルを先にCOPYし、ソースコードは後にCOPY
- **.dockerignore**: `node_modules`, `.env`, 開発用DBファイルを除外

## パターン1: Node.js（シンプル）

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000
WORKDIR /app
ENV NODE_ENV=production

# 依存関係を先にコピー（レイヤーキャッシュ活用）
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ソースコードをコピー
COPY . .

# Prisma使用時
RUN npx prisma generate

# ビルド
RUN npm run build

CMD ["npm", "run", "start"]
```

**用途:** Express, Hono, React Router, Remix等の小〜中規模アプリ

## パターン2: Node.js（マルチステージ）

```dockerfile
# ===== Stage 1: ビルド =====
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ===== Stage 2: 本番 =====
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ビルド成果物のみコピー
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma

EXPOSE 3000
CMD ["npm", "run", "start"]
```

**用途:** イメージサイズを最小化したい本番環境。devDependenciesがビルド時のみ必要な場合。

**注意:**
- `node_modules/.prisma` はPrisma Client生成物。builderステージからコピーが必要
- `prisma/` ディレクトリは `prisma migrate deploy` のためにコピーが必要

## パターン3: Next.js（standalone）

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# next.config.js に output: 'standalone' が必要
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# standalone出力は自己完結型
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

**前提:** `next.config.js` に以下が必要:
```javascript
module.exports = {
  output: 'standalone',
}
```

## パターン4: Python（FastAPI / Django）

```dockerfile
FROM python:3.12-alpine AS builder
WORKDIR /app

# システム依存関係
RUN apk add --no-cache gcc musl-dev libffi-dev

COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-alpine AS runner
WORKDIR /app

COPY --from=builder /install /usr/local
COPY . .

EXPOSE 8000

# FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Django の場合:
# CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]
```

## パターン5: Go

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

FROM alpine:3.19
RUN apk add --no-cache ca-certificates

COPY --from=builder /server /server
EXPOSE 8080
CMD ["/server"]
```

**特徴:** Goはシングルバイナリにコンパイルされるため、最終イメージが極めて軽量（~20MB）

## .dockerignore テンプレート

### Node.js用
```
.cache
build
dist
node_modules
.env
.env.*
*.sqlite
*.sqlite-journal
.git
.gitignore
fly.toml
README.md
```

### Python用
```
__pycache__
*.pyc
.env
.env.*
.venv
venv
*.sqlite3
.git
.gitignore
fly.toml
README.md
```

## レイヤーキャッシュ最適化

```
┌─────────────────────────────────────────────────────────────────┐
│              レイヤーキャッシュの原則                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Dockerは各命令をレイヤーとしてキャッシュする。                   │
│  あるレイヤーが変更されると、それ以降の全レイヤーが再ビルドされる。│
│                                                                 │
│  【推奨順序】                                                   │
│  1. システムパッケージ（apk add等） — 滅多に変わらない          │
│  2. 依存関係ファイル（package.json等） — たまに変わる            │
│  3. npm ci / pip install — 依存が変わった時だけ再実行            │
│  4. ソースコード（COPY . .） — 頻繁に変わる                     │
│  5. ビルド（npm run build） — ソース変更のたびに再実行          │
│                                                                 │
│  ❌ 悪い例: COPY . . → npm ci → npm run build                  │
│  （ソース変更のたびにnpm ciも再実行される）                      │
│                                                                 │
│  ✅ 良い例: COPY package*.json → npm ci → COPY . . → build     │
│  （ソース変更時はnpm ciをキャッシュから使える）                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## ヘルスチェック設定

```dockerfile
# Dockerfile内でヘルスチェックを定義（任意）
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1
```

**注意:** Fly.ioはfly.tomlの `[checks]` セクションでヘルスチェックを管理するため、
Dockerfile内のHEALTHCHECKはFly.io環境では不要。ローカル開発用。

## セキュリティベストプラクティス

```
┌─────────────────────────────────────────────────────────────────┐
│              Dockerセキュリティチェックリスト                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  □ .envファイルをCOPYしていないか（.dockerignoreに含める）       │
│  □ 秘密情報がビルド引数（ARG）に含まれていないか                │
│  □ rootユーザーで実行していないか（本番ではUSER指定推奨）        │
│  □ 不要なパッケージがインストールされていないか                  │
│  □ npm ci --omit=dev でdevDependenciesを除外しているか          │
│  □ Alpine等の軽量イメージを使っているか                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 非rootユーザー設定（推奨）

```dockerfile
# Node.jsの場合（node:alpine にはnodeユーザーが組み込み）
FROM node:20-alpine
# ... ビルド手順 ...

# 非rootユーザーに切り替え
USER node
CMD ["npm", "run", "start"]
```

```dockerfile
# Pythonの場合（手動で作成）
FROM python:3.12-alpine
# ... ビルド手順 ...

RUN adduser -D appuser
USER appuser
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## イメージサイズ比較

| ベースイメージ | サイズ | 用途 |
|---------------|--------|------|
| `node:20` | ~1GB | 非推奨（大きすぎる） |
| `node:20-slim` | ~200MB | Debian系が必要な場合 |
| `node:20-alpine` | ~130MB | **推奨**（ほとんどのケースで十分） |
| `python:3.12` | ~1GB | 非推奨 |
| `python:3.12-alpine` | ~60MB | **推奨** |
| `golang:1.22-alpine` + `alpine:3.19` | ~20MB | Goバイナリ + 最小ランタイム |
