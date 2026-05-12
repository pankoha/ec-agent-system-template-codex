# 画像生成プロンプトテンプレート

## 共通プロンプト設計

画像生成AIには、次の順で情報を渡す。

1. 画像の用途
2. 商品の見せ方
3. 背景・環境
4. 構図
5. 光・質感
6. 文字入れ前提の余白
7. 禁止要素
8. 出力仕様

## メイン画像プロンプト

```
Amazon main product image for [商品名], pure white background, only the product for sale, product fills most of the frame, centered composition, accurate color and material, sharp focus, clean professional studio lighting, natural soft shadow, high-end commercial product photography, no text, no logo overlay, no badges, no props, no lifestyle background, no hands, no model, no extra accessories unless included in the product package, square 1:1 composition, high resolution.
```

日本語制作指示:
- 白背景で販売商品だけを配置
- 商品全体が見え、フレーム内で大きく見える
- 余計な小物、文字、装飾、生活背景を入れない
- 傷、埃、色ムラをレタッチ

## サブ画像プロンプト

```
Amazon secondary product image for [商品名], [ターゲット顧客] using the product in [具体的な使用シーン], strong commercial catalog style, clear product visibility, realistic lifestyle setting, premium lighting, clean composition, leave safe space for Japanese headline and 3 feature callouts, include visual emphasis for [主要ベネフィット], no misleading accessories, no exaggerated result claims, square 1:1 composition, high resolution.
```

日本語制作指示:
- 商品が使用される自然な場面を作る
- 主役は商品、背景は使用文脈を補足する程度
- 後から文字を入れられる余白を確保
- ベネフィットを1つに絞る

## 機能図解用プロンプト

```
Clean Amazon infographic base image for [商品名], product large in the center, close-up detail areas for [特徴1], [特徴2], [特徴3], minimal background, premium e-commerce catalog design, leave blank areas for Japanese labels, use subtle arrows and circular callout spaces, sharp product edges, realistic material texture, no fake certifications, no unsupported claims, square 1:1 composition.
```

日本語制作指示:
- 商品中央、周囲に特徴の吹き出し領域
- 3-5個の特徴に限定
- アイコンや矢印を入れる場合も視認性優先

## 比較画像プロンプト

```
Amazon comparison image base for [商品名], side-by-side layout, left side generic conventional product silhouette, right side featured product clearly superior in [比較軸], clean table-like composition, neutral background, space for Japanese comparison labels and check marks, professional catalog design, avoid competitor brand names, avoid unsupported No.1 claims, square 1:1 composition.
```

日本語制作指示:
- 競合名は出さず、一般品・従来品として比較
- 比較軸は3-5個まで
- 根拠のある項目だけを入れる

## Aプラス用プロンプト

```
Amazon A+ content banner for [商品名], premium brand storytelling layout, wide horizontal composition, product hero visual with lifestyle context, brand-consistent colors, clean Japanese e-commerce design, space for headline and supporting copy, realistic lighting, high quality product detail, no exaggerated claims, no fake awards, [module size or aspect ratio].
```

日本語制作指示:
- 横長モジュールとして設計
- 商品理解とブランド世界観を両立
- スマホ表示でも読めるコピー量

## コピー生成テンプレート

各画像でコピーは以下の順に作る。

```
顧客の悩み:
商品機能:
顧客ベネフィット:
信頼できる根拠:
メインコピー:
サブコピー:
```

良いコピー:
- 短い
- 顧客の言葉に近い
- 視覚とセットで意味が通る
- 1枚1訴求

避けるコピー:
- 根拠のないNo.1
- 医療効果・治療効果の断定
- 最安、絶対、永久、完全などの強すぎる断定
- 文字だけで説明しきる長文

## 画像ごとの出力テンプレート

```markdown
### 画像[番号]: [役割]

- 目的:
- ターゲット心理:
- 画面構成:
- メインコピー:
- サブコピー:
- 視覚要素:
- NG要素:
- 画像生成プロンプト:
- レタッチ・合成指示:
- Amazon/法務注意:
- 品質チェック:
```
