# Trend Alert配信プロトコル 詳細

## 評価基準

```
┌─────────────────────────────────────────────────────────────────┐
│  Trend Alert Protocol                                            │
│                                                                  │
│  発見 → 評価 → 分類 → 配信 → 適用                              │
│                                                                  │
│  【評価基準】                                                    │
│  ├── Impact Score (1-10): ビジネスへのインパクト                 │
│  ├── Urgency Score (1-10): 対応の緊急度                         │
│  ├── Confidence Score (1-10): 情報の確度                        │
│  └── Relevance: 該当Agent（配信先）                             │
│                                                                  │
│  【配信レベル】                                                  │
│  🔴 Critical (Score 8+): 即時配信 → 緊急対応                   │
│  🟡 Important (Score 5-7): 週次配信 → 計画的対応               │
│  🟢 Watch (Score 3-4): 月次配信 → 情報として蓄積               │
│  ⚪ Archive (Score 1-2): ライブラリに保存のみ                   │
└─────────────────────────────────────────────────────────────────┘
```

## 配信テンプレート

```
Subject: [🔴/🟡/🟢] Trend Alert: [トレンド名]
Body:
- What: トレンドの概要
- Why: なぜ重要か（データ/事例付き）
- Impact: 当社への影響
- Action: 推奨アクション
- Owner: 対応すべきAgent
- Source: 情報ソース（URL付き）
```

## Sub-Agent 21-1 監視対象詳細

### 🇺🇸 US Marketing Trend
```
監視対象（米国マーケティング）:
├── AI Marketing Evolution: Agentic Marketing, GEO, AIショッピングAgent
├── Social Commerce: TikTok Shop（US売上$15.82B）, IG Shopping
├── Retail Media Networks: Amazon DSP, Walmart Connect, Instacart
├── CTV/OTT: Shoppable TV, プログラマティックCTV
├── Creator Economy: KOC台頭, パフォーマンスベース報酬（53%）
├── Privacy: ゼロパーティデータ, サーバーサイド計測
├── Voice Commerce: AIショッピングAgent, Google UCP
└── Community-Led Growth: PLG×CLG flywheel
```

### 🇺🇸 US Tech Trend
```
監視対象（米国テック）:
├── AI/ML: LLM進化, Agentic AI, マルチエージェント
├── Platform Engineering: IDP, Golden Path, Backstage
├── Data: Lakehouse, Real-Time OLAP, RAGOps
├── Security: Zero Trust, AI脅威検知, SBOM/SLSA
├── FinOps: クラウド/AI推論コスト最適化
├── DevEx: AI-Augmented Development（Cursor, Copilot）
└── Edge/Serverless: エッジコンピューティング
```

### 🇺🇸 US Product/Growth Trend
```
監視対象（米国プロダクト/グロース）:
├── Product: AI-Augmented PM, Shape Up, Continuous Discovery
├── Growth: Growth Loops, Reverse Trials, Usage-Based Pricing
├── Pricing: Hybrid Model（サブスク+従量）, Credits Model
├── Experimentation: Autonomous Testing, Schema-Driven Experiments
├── PLG: Product-Led Growth Engineering, Feature Flags
└── Composable Commerce: MACH Architecture
```

## Sub-Agent 21-2 監視対象詳細

### 🇸🇬 SEA E-Commerce Trend
```
監視対象（東南アジアEC）:
├── Shopee: GMV成長, Shopee Live, ShopeePay, Shopee Mall
├── TikTok Shop SEA: クリエイターアフィリエイト, ライブコマース
├── Lazada: プレミアム化戦略
├── Grab: スーパーアプリEC, GXS Bank連携
├── Cross-Border: QRコード決済連携, BNPL拡大
├── Shoppertainment: ライブコマース（SEAで$186.5B by 2030）
└── Digital Wallets: ShopeePay, GrabPay, Apple Pay
```

### 🇸🇬 SEA Marketing Trend
```
監視対象（アジアマーケティング）:
├── KOL/KOC: ハイブリッド戦略, Xiaohongshu台頭
├── Messaging Commerce: WhatsApp($45B経済圏), LINE, WeChat
├── Social Commerce: SEA $186.5B by 2030
├── Payment Integration: 越境QR決済, リアルタイム決済
├── Multi-Language: EN/ZH/MS/TH/VI マルチリンガル対応
└── Regulatory: 各国EC規制, データ保護法
```

## Sub-Agent 21-3 監視対象詳細

### Big Tech Tracker
```
監視対象（Big Tech）:
├── Google: ADK, A2A Protocol, Gemini, Workspace Agents
├── Microsoft: Agent Framework, AutoGen, Copilot, Magentic-One
├── Apple: Apple Intelligence, Foundation Models, MCP, Siri Agent
├── Tesla: FSD, Optimus, 工場AI, Grok統合
├── Amazon: Bedrock Agents, Buy For Me, Retail Media
└── Meta: Llama, AI Studio, Creator Tools
```

### Unicorn Tracker
```
監視対象（ユニコーン）:
├── US: Stripe, Figma, Notion, Canva, Databricks
├── SG: Grab, Sea Group, Ninja Van, Carousell
├── AI Native: Cursor($500M ARR), Lovable($100M ARR)
├── 組織構造の変化・新設ポジション
└── 採用動向（何を重視しているか）
```

### Open Source Agent Framework Tracker
```
監視対象（OSSフレームワーク）:
├── CrewAI: 階層型Agent, YAML設定パターン
├── LangGraph: グラフベースワークフロー, Supervisor Pattern
├── AutoGen: チーム構成, GroupChat
├── OpenAI Agents SDK: Handoff, Guardrails
├── MetaGPT: ソフトウェア会社シミュレーション
├── Google ADK: マルチAgent, A2A
└── Anthropic Claude: MCP, Tool Use
```
