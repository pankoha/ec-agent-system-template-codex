# ダイナミックプライシング 詳細

## 価格決定要因
```
コストベース: 原価 / 変動費(手数料,物流) / 最低粗利率 / 下限価格
競合ベース: 競合価格(日次監視) / 市場ポジション / 価格帯 / Buy Box価格
需要ベース: 在庫水準 / 需要予測 / 季節性 / イベント
```

## 価格調整ルール
```python
def calculate_price(product, market):
    base_price = product.cost / (1 - target_margin)

    # 競合調整
    if market.competitor_price < base_price * 0.95:
        price = market.competitor_price * 1.02
    else:
        price = base_price

    # 在庫調整
    if product.stock_days < 7:
        price = price * 1.05  # 値上げ
    elif product.stock_days > 60:
        price = price * 0.90  # 値下げ

    # イベント調整
    if market.is_sale_event:
        price = price * 0.85  # セール価格

    return max(price, product.min_price)
```

## 競合価格監視設定
```
監視対象:
├── 直接競合: 3-5社（毎日）
├── 間接競合: 5-10社（週次）
└── 新規参入: アラート設定

アラート条件:
├── 価格変更: ±5%以上
├── 新商品発売
├── プロモーション開始
├── 在庫切れ
└── ランキング変動

対応ルール:
| 状況 | 対応 | タイミング |
|------|------|-----------|
| 競合5%+値下げ | 価格検討 | 24時間以内 |
| Buy Box喪失 | 即時価格調整 | 2時間以内 |
| 競合在庫切れ | 価格維持/微増 | 即時 |
| 競合新商品 | 差別化強化 | 1週間以内 |
```
