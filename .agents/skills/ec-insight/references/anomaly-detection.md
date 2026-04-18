# 異常検知 詳細ロジック

## 検知ルール
```python
alerts = {
    "売上急落": {
        "condition": "daily < avg_7d * 0.7",
        "severity": "critical",
        "action": "即時調査"
    },
    "売上低下": {
        "condition": "daily < avg_7d * 0.85",
        "severity": "warning",
        "action": "翌日確認"
    },
    "CVR異常": {
        "condition": "cvr < baseline * 0.8",
        "severity": "warning",
        "action": "LP/在庫確認"
    },
    "ROAS悪化": {
        "condition": "roas < target * 0.7",
        "severity": "critical",
        "action": "広告停止検討"
    },
    "CPA高騰": {
        "condition": "cpa > limit * 1.3",
        "severity": "warning",
        "action": "入札調整"
    },
    "在庫危険": {
        "condition": "stock_days < 7",
        "severity": "critical",
        "action": "緊急発注"
    },
    "CS急増": {
        "condition": "tickets > avg * 2",
        "severity": "warning",
        "action": "原因調査"
    }
}
```

## 重要度レベル
```
critical: 即時対応（2時間以内）
warning: 当日中に確認
info: 次回レビュー時に確認
```

## エスカレーションフロー
```
1. 異常検知 → INSIGHTが自動アラート
2. critical → COMMANDER + 該当エージェントに即時通知
3. warning → 次回デイリーチェックで確認
4. 原因特定 → 対策立案 → 実行 → 効果測定
```
