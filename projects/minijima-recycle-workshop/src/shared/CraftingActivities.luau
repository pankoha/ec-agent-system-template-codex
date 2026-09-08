--!strict

local activities = {
	BottlePlanter = {
		{ id = "FitParts", title = "植物をはめよう", instruction = "光っている場所を押して、植物をはめよう", autoHint = "黄色い丸の場所を押してみよう！", detail = "植物パーツと同じ形の場所を選びます。間違えても材料はなくなりません。", clicks = 1 },
		{ id = "ChooseColor", title = "好きな色を選ぼう", instruction = "3つの色から好きな色を選ぼう", autoHint = "正解はないよ。好きな色でOK！", detail = "色による失敗はありません。完成品の見た目だけが変わります。", choices = { "みどり", "あお", "ピンク" } },
	},
	CanStool = {
		{ id = "TurnHandle", title = "ハンドルを回そう", instruction = "ハンドルを3回押して回そう", autoHint = "丸いハンドルをあと少し回そう！", detail = "ハンドルボタンを3回押すと、空き缶が安全な形に加工されます。", clicks = 3 },
		{ id = "ChoosePattern", title = "模様を選ぼう", instruction = "好きな模様を1つ選ぼう", autoHint = "どの模様でも完成できるよ！", detail = "しましま・水玉・星から好きな模様を選べます。", choices = { "しましま", "水玉", "星" } },
	},
	PatchworkLamp = {
		{ id = "MaterialOrder", title = "材料を順番に置こう", instruction = "①プラスチック → ②金属の順に押そう", autoHint = "まず左の①プラスチックから！", detail = "番号どおりに材料を押します。間違えた場合は同じ工程をもう一度試せます。", choices = { "① プラスチック", "② 金属" }, ordered = true },
		{ id = "Timing", title = "光ったら押そう", instruction = "ボタンが黄色くなったら押そう", autoHint = "黄色の時間は長めです。ゆっくり見て押そう！", detail = "黄色く光っている間に押します。失敗しても何度でも挑戦できます。", clicks = 1 },
	},
	RecycledBench = {
		{ id = "Blueprint", title = "設計図を見よう", instruction = "見本と同じ形を選ぼう", autoHint = "長い板が横に並んだ形を探そう！", detail = "薄く表示された完成見本と同じ形を選びます。", choices = { "よこ長", "たて長", "まる" }, correctChoice = 1 },
		{ id = "Assemble", title = "パーツを組み合わせよう", instruction = "座る板と脚を2回押してつなげよう", autoHint = "光っている接続部分を押そう！", detail = "同じ色で光る接続部分同士を組み合わせます。", clicks = 2 },
	},
	EcoBot = {
		{ id = "Repair", title = "壊れた場所を直そう", instruction = "赤く光る場所を3回押して修理しよう", autoHint = "赤いひび割れを押してみよう！", detail = "赤く点滅する故障箇所を押します。失敗しても材料はなくなりません。", clicks = 3 },
		{ id = "Sticker", title = "ステッカーを選ぼう", instruction = "エコロボに貼るマークを選ぼう", autoHint = "好きなマークでOK！", detail = "葉っぱ・地球・星から選べます。性能は変わらないので自由に選んでください。", choices = { "葉っぱ", "地球", "星" } },
	},
}

return table.freeze(activities)
