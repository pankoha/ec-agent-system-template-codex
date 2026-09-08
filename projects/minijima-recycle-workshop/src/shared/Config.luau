--!strict

local Config = {
	GAME_TITLE = "リサイクル島の大冒険",
	GAME_TAGLINE = "ひろって、つくって、島を育てよう！",
	DATASTORE_NAME = "MinijimaRecycleWorkshop_v1",
	MAX_MATERIALS = 99,
	DECORATION_SLOTS = 3,
	COLLECT_DISTANCE = 12,
	COLLECT_COOLDOWN = 2.5,
	CRAFT_COOLDOWN = 0.5,
	AUTOSAVE_SECONDS = 60,
	MATERIAL_ORDER = { "Wood", "Plastic", "Metal" },
	MATERIALS = {
		Wood = { displayName = "木のかけら", color = Color3.fromRGB(210, 126, 54) },
		Plastic = { displayName = "プラスチック", color = Color3.fromRGB(42, 202, 255) },
		Metal = { displayName = "金属", color = Color3.fromRGB(178, 188, 230) },
	},
}

return table.freeze(Config)
