# 入札管理 詳細ロジック

## 入札調整ロジック
```python
def optimize_bid(metrics, phase):
    roas = metrics['roas']
    target_roas = {0: 200, 1: 300, 2: 350, 3: 400, 4: 450}[phase]

    if roas >= target_roas * 1.25:
        return "SCALE", "+20% bid, +30% budget"
    elif roas >= target_roas:
        return "MAINTAIN", "Continue testing"
    elif roas >= target_roas * 0.75:
        return "OPTIMIZE", "Creative refresh"
    elif roas >= target_roas * 0.5:
        return "REDUCE", "-20% bid"
    else:
        return "PAUSE", "Stop and analyze"
```

## プラットフォーム別設定

### Google Ads
```
検索: 目標ROAS入札 or 最大化CV
ショッピング: 目標ROAS
P-MAX: コンバージョン最大化
除外KW: 週次追加
品質スコア: 7以上維持
```

### Meta Ads
```
入札: 最小CPA or 目標ROAS
オーディエンス: LAL 1-3%優先
配置: 自動（Advantage+）
クリエイティブ疲労: CTR -30%で刷新
予算: CBO推奨
```

### Amazon Ads
```
SP Auto: 発掘用、ACoS 30%以下
SP Manual: スケール用、ACoS 20%以下
SB: ブランド防衛
SD: リターゲティング
除外ASIN: 週次設定
```

### 楽天RPP
```
ビッグKW: CPC ¥50-100
ミドルKW: CPC ¥30-50
ロングテール: CPC ¥10-30
イベント時: 予算2-3倍
ACoS目標: 15-20%
```

## クリエイティブA/Bテスト
```
テスト優先度:
1. ヘッドライン/コピー（最高インパクト）
2. メイン画像/動画
3. CTA
4. オーディエンス
5. 配置

テスト設計:
├── 仮説: 明確に記述
├── 変数: 1つずつ変更
├── サンプル: 各バリアント1000imp以上
├── 期間: 最低7日
└── 判定: 95%信頼区間

勝者判定基準:
├── CTR: +10%以上
├── CVR: +5%以上
├── CPA: -10%以上
└── ROAS: +15%以上
```

## オーディエンスセグメント
```
コアオーディエンス: 購入者(30日)/カート追加/商品ページ閲覧/サイト訪問
拡張: LAL 1%/3%/5%/興味関心
除外: 購入者(新規獲得時)/直帰者/競合従業員
```
