--!strict

local recipes = {
	BottlePlanter = {
		id = "BottlePlanter",
		displayName = "ボトルプランター",
		cost = { Wood = 1, Plastic = 1, Metal = 0 },
		color = Color3.fromRGB(86, 190, 115),
	},
	CanStool = {
		id = "CanStool",
		displayName = "かんかんスツール",
		cost = { Wood = 1, Plastic = 0, Metal = 2 },
		color = Color3.fromRGB(247, 174, 63),
	},
	PatchworkLamp = {
		id = "PatchworkLamp",
		displayName = "つぎはぎランプ",
		cost = { Wood = 0, Plastic = 1, Metal = 2 },
		color = Color3.fromRGB(255, 224, 92),
	},
	RecycledBench = {
		id = "RecycledBench",
		displayName = "リサイクルベンチ",
		cost = { Wood = 3, Plastic = 0, Metal = 1 },
		color = Color3.fromRGB(126, 89, 59),
	},
	EcoBot = {
		id = "EcoBot",
		displayName = "エコロボ",
		cost = { Wood = 1, Plastic = 2, Metal = 2 },
		color = Color3.fromRGB(113, 220, 190),
	},
}

local order = { "BottlePlanter", "CanStool", "PatchworkLamp", "RecycledBench", "EcoBot" }

return table.freeze({
	byId = table.freeze(recipes),
	order = table.freeze(order),
})
