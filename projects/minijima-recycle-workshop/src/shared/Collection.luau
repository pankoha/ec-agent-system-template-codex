--!strict

local Config = require(script.Parent.Config)
local CraftingActivities = require(script.Parent.CraftingActivities)

export type RarityDefinition = {
	id: string,
	displayName: string,
	color: Color3,
}

-- displayName は WorldBuilder が素材ノードの Rarity 属性に書く文字列と一致させる。
local rarities: { RarityDefinition } = {
	{ id = "Common", displayName = "ふつう", color = Color3.fromRGB(210, 250, 225) },
	{ id = "Rare", displayName = "めずらしい", color = Color3.fromRGB(255, 232, 116) },
	{ id = "SuperRare", displayName = "すごくめずらしい", color = Color3.fromRGB(205, 158, 255) },
	{ id = "Legendary", displayName = "伝説", color = Color3.fromRGB(255, 143, 236) },
}

local rarityIdByName: { [string]: string } = {}
for _, rarity in rarities do
	rarityIdByName[rarity.displayName] = rarity.id
end

local validEntries: { [string]: boolean } = {}
local entryCount = 0
for _, materialId in Config.MATERIAL_ORDER do
	for _, rarity in rarities do
		validEntries[`{materialId}_{rarity.id}`] = true
		entryCount += 1
	end
end

-- 工作の「好きなものを選ぶ」工程（正解も順番もない選択肢）だけを作品カードの見た目として残す。
type ActivityStep = { choices: { string }?, ordered: boolean?, correctChoice: number? }
-- 工程ごとに項目が異なり推論型が合わないため、ここで必要な項目だけの型として読む。
local activitySteps: { [string]: { ActivityStep } } = CraftingActivities :: any
local styleChoices: { [string]: { [string]: boolean } } = {}
for recipeId, steps in activitySteps do
	for _, step in steps do
		if step.choices and not step.ordered and step.correctChoice == nil then
			local choices = styleChoices[recipeId] or {}
			for _, choice in step.choices do
				choices[choice] = true
			end
			styleChoices[recipeId] = choices
		end
	end
end

local Collection = {}

Collection.rarities = table.freeze(rarities)
Collection.ENTRY_COUNT = entryCount

function Collection.entryKey(materialId: string, rarityName: string): string?
	local rarityId = rarityIdByName[rarityName]
	if rarityId == nil or Config.MATERIALS[materialId] == nil then
		return nil
	end
	return `{materialId}_{rarityId}`
end

function Collection.isValidEntry(key: string): boolean
	return validEntries[key] == true
end

function Collection.isValidStyle(recipeId: string, style: string): boolean
	local choices = styleChoices[recipeId]
	return choices ~= nil and choices[style] == true
end

function Collection.foundCount(materialLog: { [string]: number }): number
	local count = 0
	for key, amount in materialLog do
		if validEntries[key] and amount > 0 then
			count += 1
		end
	end
	return count
end

function Collection.isComplete(materialLog: { [string]: number }): boolean
	return Collection.foundCount(materialLog) >= entryCount
end

return table.freeze(Collection)
