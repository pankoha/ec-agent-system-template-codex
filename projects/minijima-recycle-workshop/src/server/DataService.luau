--!strict

local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Recipes = require(ReplicatedStorage.Shared.Recipes)

export type PlayerData = {
	schemaVersion: number,
	materials: { [string]: number },
	unlockedRecipes: { [string]: boolean },
	decorations: { string },
	tutorialComplete: boolean,
	missionStage: number,
	missionCollected: { [string]: number },
	cleanliness: number,
	craftedCount: number,
	discoveredSecrets: { [string]: boolean },
	lastArea: string,
}

-- An unpublished local place cannot create a DataStore handle. Keep the MVP
-- playable in Studio and switch to session-only data until the place is
-- published and API access is enabled.
local store: any = nil
local storeAvailable, storeResult = pcall(function()
	return DataStoreService:GetDataStore(Config.DATASTORE_NAME)
end)
if storeAvailable then
	store = storeResult
else
	warn(`[Minijima] DataStore unavailable; using session-only data: {storeResult}`)
end
local sessions: { [Player]: PlayerData } = {}
local dirty: { [Player]: boolean } = {}
local persistenceEnabled: { [Player]: boolean } = {}
local revisions: { [Player]: number } = {}

local DataService = {}

local function defaultData(): PlayerData
	return {
		schemaVersion = 3,
		materials = { Wood = 0, Plastic = 0, Metal = 0 },
		unlockedRecipes = { BottlePlanter = true },
		decorations = { "", "", "" },
		tutorialComplete = false,
		missionStage = 1,
		missionCollected = { Wood = 0, Plastic = 0, Metal = 0 },
		cleanliness = 0,
		craftedCount = 0,
		discoveredSecrets = {},
		lastArea = "StartPlaza",
	}
end

local function sanitize(raw: any): PlayerData
	local clean = defaultData()
	if type(raw) ~= "table" then
		return clean
	end

	if type(raw.materials) == "table" then
		for _, materialId in Config.MATERIAL_ORDER do
			local value = raw.materials[materialId]
			if type(value) == "number" and value == value then
				clean.materials[materialId] = math.clamp(math.floor(value), 0, Config.MAX_MATERIALS)
			end
		end
	end

	if type(raw.unlockedRecipes) == "table" then
		for recipeId, unlocked in raw.unlockedRecipes do
			if type(recipeId) == "string" and Recipes.byId[recipeId] ~= nil and unlocked == true then
				clean.unlockedRecipes[recipeId] = true
			end
		end
	end

	if type(raw.decorations) == "table" then
		for slot = 1, Config.DECORATION_SLOTS do
			local recipeId = raw.decorations[slot]
			if type(recipeId) == "string" and Recipes.byId[recipeId] ~= nil then
				clean.decorations[slot] = recipeId
			end
		end
	end

	clean.tutorialComplete = raw.tutorialComplete == true
	if type(raw.missionStage) == "number" then
		clean.missionStage = math.clamp(math.floor(raw.missionStage), 1, 7)
	end
	if type(raw.missionCollected) == "table" then
		for _, materialId in Config.MATERIAL_ORDER do
			local value = raw.missionCollected[materialId]
			if type(value) == "number" and value == value then
				clean.missionCollected[materialId] = math.clamp(math.floor(value), 0, 999)
			end
		end
	end
	if type(raw.cleanliness) == "number" then
		clean.cleanliness = math.clamp(math.floor(raw.cleanliness), 0, 100)
	end
	if type(raw.craftedCount) == "number" then
		clean.craftedCount = math.clamp(math.floor(raw.craftedCount), 0, 9999)
	end
	if type(raw.discoveredSecrets) == "table" then
		for discoveryId, discovered in raw.discoveredSecrets do
			if type(discoveryId) == "string" and discovered == true then
				clean.discoveredSecrets[discoveryId] = true
			end
		end
	end
	if type(raw.lastArea) == "string" and #raw.lastArea <= 64 then
		clean.lastArea = raw.lastArea
	end
	return clean
end

function DataService.load(player: Player): PlayerData
	local key = `player_{player.UserId}`
	local success = false
	local result: any = "DataStore is unavailable for this local place"
	if store ~= nil then
		success, result = pcall(function()
			return store:GetAsync(key)
		end)
	end

	local data = if success then sanitize(result) else defaultData()
	if not success then
		warn(`[Minijima] Save load failed for {player.UserId}; using session data: {result}`)
	end
	sessions[player] = data
	dirty[player] = false
	persistenceEnabled[player] = success
	revisions[player] = 0
	return data
end

function DataService.get(player: Player): PlayerData?
	return sessions[player]
end

function DataService.markDirty(player: Player)
	dirty[player] = true
	revisions[player] = (revisions[player] or 0) + 1
end

function DataService.save(player: Player): boolean
	local data = sessions[player]
	-- Never overwrite cloud data after a failed load. The current play session
	-- remains usable, but is intentionally session-only.
	if persistenceEnabled[player] ~= true then
		return true
	end
	if data == nil or dirty[player] ~= true then
		return true
	end

	local key = `player_{player.UserId}`
	local savingRevision = revisions[player] or 0
	local payload = {
		schemaVersion = data.schemaVersion,
		materials = table.clone(data.materials),
		unlockedRecipes = table.clone(data.unlockedRecipes),
		decorations = table.clone(data.decorations),
		tutorialComplete = data.tutorialComplete,
		missionStage = data.missionStage,
		missionCollected = table.clone(data.missionCollected),
		cleanliness = data.cleanliness,
		craftedCount = data.craftedCount,
		discoveredSecrets = table.clone(data.discoveredSecrets),
		lastArea = data.lastArea,
	}
	local success = false
	local message: any = "Unknown save error"
	for attempt = 1, 3 do
		success, message = pcall(function()
			store:UpdateAsync(key, function()
				return payload
			end)
		end)
		if success then
			break
		end
		if attempt < 3 then
			task.wait(2 ^ (attempt - 1))
		end
	end
	if success then
		if revisions[player] == savingRevision then
			dirty[player] = false
		end
	else
		warn(`[Minijima] Save failed for {player.UserId}: {message}`)
	end
	return success
end

function DataService.release(player: Player)
	DataService.save(player)
	sessions[player] = nil
	dirty[player] = nil
	persistenceEnabled[player] = nil
	revisions[player] = nil
end

function DataService.isPersistent(player: Player): boolean
	return persistenceEnabled[player] == true
end

return DataService
