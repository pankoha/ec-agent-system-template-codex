--!strict

local missions = {
	{
		id = "FirstCraft",
		title = "はじめての工作",
		description = "木1ことプラスチック1こで、ボトルプランターを作ろう",
		collect = { Wood = 1, Plastic = 1, Metal = 0 },
		craftRecipeId = "BottlePlanter",
		cleanlinessReward = 15,
	},
	{
		id = "BeachCleanup",
		title = "海岸のおそうじ",
		description = "木1こと金属2こを集めて、かんかんスツールを作ろう",
		collect = { Wood = 1, Plastic = 0, Metal = 2 },
		craftRecipeId = "CanStool",
		cleanlinessReward = 15,
	},
	{
		id = "LightThePath",
		title = "島にあかりを",
		description = "プラスチック1こと金属2こで、つぎはぎランプを作ろう",
		collect = { Wood = 0, Plastic = 1, Metal = 2 },
		craftRecipeId = "PatchworkLamp",
		cleanlinessReward = 15,
	},
	{
		id = "RestoreTheForest",
		title = "森を元気にする",
		description = "木3こと金属1こで、リサイクルベンチを作ろう",
		collect = { Wood = 3, Plastic = 0, Metal = 1 },
		craftRecipeId = "RecycledBench",
		cleanlinessReward = 20,
	},
	{
		id = "BuildEcoBot",
		title = "エコロボを完成させる",
		description = "3種類の素材を集めて、エコロボを作ろう",
		collect = { Wood = 1, Plastic = 2, Metal = 2 },
		craftRecipeId = "EcoBot",
		cleanlinessReward = 20,
	},
	{
		id = "RecycleFestival",
		title = "リサイクル祭り",
		description = "好きな作品を合計8こ作って、お祭りを開こう",
		collect = { Wood = 0, Plastic = 0, Metal = 0 },
		craftTarget = 8,
		cleanlinessReward = 15,
	},
}

return table.freeze({
	order = table.freeze(missions),
})
