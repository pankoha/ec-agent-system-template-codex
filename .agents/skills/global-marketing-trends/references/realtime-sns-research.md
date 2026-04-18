# Real-Time SNS Research（リアルタイムSNSリサーチ）詳細リファレンス

## 定義
Puppeteerを活用したリアルタイムSNSトレンドデータの自動収集手法。
TikTok、YouTube、Instagramの「今」のトレンドをライブで取得し、マーケティング戦略に活用。

## リアルタイムリサーチの実行方法

### 基本コマンド
```
/trend realtime        - 全プラットフォームのリアルタイムトレンド取得
/trend realtime tiktok - TikTok Japanのリアルタイムトレンド
/trend realtime youtube - YouTube Japanのリアルタイムトレンド
/trend realtime instagram - Instagram Japanのリアルタイムトレンド
```

### 技術実装（Puppeteer MCP）
```javascript
// Step 1: ブラウザ起動
puppeteer_launch({ headless: true, viewport: { width: 1366, height: 768 } })

// Step 2: ページ作成
puppeteer_new_page({ pageId: "tiktok-discover" })

// Step 3: プラットフォームにナビゲート
puppeteer_navigate({
  pageId: "tiktok-discover",
  url: "https://www.tiktok.com/discover?lang=ja-JP",
  waitUntil: "networkidle2"
})

// Step 4: データ抽出（JavaScript評価）
puppeteer_evaluate({ pageId: "tiktok-discover", script: "..." })

// Step 5: スクリーンショット保存
puppeteer_screenshot({ pageId: "tiktok-discover", path: "..." })
```

## プラットフォーム別URL

### TikTok Japan
| ページ | URL | データ内容 |
|--------|-----|-----------|
| Discover | `https://www.tiktok.com/discover?lang=ja-JP` | トレンドハッシュタグ、人気アカウント、トレンド音源 |
| Tag検索 | `https://www.tiktok.com/tag/{tagname}` | 特定タグの投稿数、人気動画 |
| ユーザー | `https://www.tiktok.com/@{username}` | フォロワー数、動画一覧 |

### YouTube Japan
| ページ | URL | データ内容 |
|--------|-----|-----------|
| トレンド | `https://www.youtube.com/feed/trending?gl=JP` | 急上昇動画（要ログイン） |
| 検索 | `https://www.youtube.com/results?search_query={query}` | 検索結果（ログイン不要） |
| チャンネル | `https://www.youtube.com/c/{channelname}` | チャンネル情報 |

### Instagram Japan
| ページ | URL | データ内容 |
|--------|-----|-----------|
| Explore | `https://www.instagram.com/explore/` | 人気投稿（一部制限） |
| Tag | `https://www.instagram.com/explore/tags/{tagname}/` | タグ別投稿 |
| ユーザー | `https://www.instagram.com/{username}/` | プロフィール、投稿 |

## 最新取得データ（2026年2月時点）

### TikTok Japan トレンドハッシュタグ TOP 20
| # | ハッシュタグ | 投稿数 | カテゴリ |
|---|------------|-------|---------|
| 1 | #トクトク大感謝祭 | 37.2K | TikTok Shop |
| 2 | #ブラックフライデー | 25.1K | セール |
| 3 | #買ってみたら年末がもっと楽しくなるかも | 19.7K | TikTok Shop |
| 4 | #あきない秋 | 9.6K | 季節 |
| 5 | #秋のワクワクリスト | 3.8K | TikTok Shop |
| 6 | #鬼得ハロウィン | 2.8K | イベント |
| 7 | #誰かに伝えたい学びキャンペーン | 2.5K | 教育 |
| 8 | #ギフトコレクション | 2.1K | TikTok Shop |
| 9 | #ハロウィンター | 1.8K | 季節 |
| 10 | #ご褒美の華金 | 1.8K | ライフスタイル |

### TikTok Japan 人気アカウント
| # | アカウント | フォロワー数 | ジャンル |
|---|-----------|-------------|---------|
| 1 | BTS (@bts_official_bighit) | 73.9M | K-POP |
| 2 | Taylor Swift (@taylorswift) | 33.3M | 洋楽 |
| 3 | TWICE (@twice_tiktok_official) | 29.4M | K-POP |
| 4 | David Beckham (@davidbeckham) | 7.5M | スポーツ/セレブ |
| 5 | TWICE JAPAN (@twice_tiktok_officialjp) | 7.4M | K-POP |
| 6 | ABBA (@abba) | 3.9M | 洋楽 |
| 7 | NiziU (@niziu_official) | 3.1M | J-POP |
| 8 | ピコ太郎 (@pikotaro2016ppap) | 2.7M | コメディ |
| 9 | The Beatles (@thebeatles) | 2.2M | 洋楽 |
| 10 | YOASOBI (@yoasobi_ayase_ikura) | 1.9M | J-POP |

### TikTok Japan トレンド音源
| # | 音源名 | 視聴数 | アーティスト |
|---|-------|-------|-------------|
| 1 | アイドル | 462.5K | YOASOBI |
| 2 | I Don't Think That I Like Her | 102.5K | Charlie Puth |
| 3 | I'm a mess | 91.5K | MY FIRST STORY |
| 4 | アドベンチャー | 62.4K | YOASOBI |
| 5 | 愛しの推し様 | 35.3K | 世羅 鈴 |
| 6 | 男の子のために可愛いわけじゃない！ | 31.3K | 星乃夢奈 |
| 7 | バレンタインの日告白するから | 29.2K | かわいいボカロ |
| 8 | 終わりがあるなら始めたくないよ | 19.3K | JOE NISHIZAWA |
| 9 | INTERNET YAMERO | 18.7K | Aiobahn |
| 10 | 君に出逢えて | 16.3K | しまも |

## マーケティング活用インサイト

### TikTok Shop施策の急成長
```
【リアルタイムトレンド分析】
├── #トクトク大感謝祭: 37.2K投稿 → TikTok Shop最大のキャンペーン
├── #ブラックフライデー: 25.1K投稿 → グローバルセール連動
├── #ギフトコレクション: 2.1K投稿 → ギフト需要の取り込み
└── #ご褒美の華金: 1.8K投稿 → セルフギフト需要

【示唆】
TikTok Shopが日本市場で急拡大中。
ハッシュタグチャレンジ × ECの融合が主流に。
```

### 音源トレンドの商品活用
```
【活用可能な音源】
├── YOASOBIの楽曲: 日本発・グローバル人気
│   └── 「アイドル」462.5K視聴 → アニメタイアップ効果
├── ボカロ系: Z世代の共感
│   └── 「バレンタインの日告白するから」→ 季節イベント連動
└── 洋楽: グローバル展開に有効
    └── Charlie Puth 102.5K → 英語圏向け商品紹介

【施策例】
商品紹介動画にトレンド音源を使用 → アルゴリズム優遇
```

### アカウントフォロワー分析
```
【日本市場の特徴】
├── K-POP優勢: BTS 73.9M, TWICE 29.4M+7.4M
├── J-POP台頭: YOASOBI 1.9M（音源人気と連動）
├── コメディ健在: ピコ太郎 2.7M（PPAPの継続効果）
└── グローバルアーティスト: Taylor Swift, David Beckham

【示唆】
K-POPファン層へのリーチにはK-POPアーティストの楽曲活用が効果的
J-POPはアニメ/ゲームとの親和性が高い
```

## 自動リサーチスケジュール

### 推奨実行頻度
| 目的 | 頻度 | タイミング |
|------|------|-----------|
| トレンド把握 | 毎日 | 朝9時 |
| キャンペーン分析 | 週2回 | 月・木 |
| 競合モニタリング | 週1回 | 月曜日 |
| 音源トレンド | 週2回 | 水・土 |

### アラート設定基準
```
【急上昇アラート】
├── ハッシュタグ: 24時間で+50%投稿数増加
├── 音源: 24時間で+100%視聴数増加
├── アカウント: 7日間で+10%フォロワー増加
└── 自社関連: ブランド名・商品名の言及増加
```

## 注意事項・制限

### プラットフォーム利用規約
```
【準拠事項】
├── robots.txt遵守
├── レート制限（1分間10リクエスト以下）
├── 個人情報の収集禁止
└── データの商用利用は自己責任

【代替手段（推奨）】
├── TikTok: Creator Marketplace API（公式）
├── YouTube: YouTube Data API v3（公式）
├── Instagram: Instagram Graph API（ビジネスアカウント）
└── 各種SNS分析ツール: Sprout Social, Hootsuite等
```

### データの鮮度
```
├── Puppeteerリサーチ: リアルタイム（実行時点）
├── Web検索: 数時間〜数日遅れ
└── 公式API: リアルタイム（レート制限あり）
```

## 参考データソース
- TikTok Discover Page (https://www.tiktok.com/discover)
- YouTube Trending Japan (https://www.youtube.com/feed/trending?gl=JP)
- Instagram Explore (https://www.instagram.com/explore/)
- 各プラットフォーム公式API

---
*最終更新: 2026年2月8日 リアルタイムデータ取得*
