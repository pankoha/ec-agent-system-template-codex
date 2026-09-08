--!strict

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local Recipes = require(ReplicatedStorage.Shared.Recipes)
local Missions = require(ReplicatedStorage.Shared.Missions)
local WorldContent = require(ReplicatedStorage.Shared.WorldContent)
local DataService = require(script.Parent.DataService)
local WorldBuilder = require(script.Parent.WorldBuilder)
local WorldCycle = require(script.Parent.WorldCycle)

local world, workshop, decorationSlotLanes, workshopGallerySlotLanes = WorldBuilder.build()
WorldCycle.start(world)

local remotes = Instance.new("Folder")
remotes.Name = "MinijimaRemotes"
remotes.Parent = ReplicatedStorage

local stateUpdated = Instance.new("RemoteEvent")
stateUpdated.Name = "StateUpdated"
stateUpdated.Parent = remotes

local requestCraft = Instance.new("RemoteEvent")
requestCraft.Name = "RequestCraft"
requestCraft.Parent = remotes

local tutorialComplete = Instance.new("RemoteEvent")
tutorialComplete.Name = "TutorialComplete"
tutorialComplete.Parent = remotes

local notify = Instance.new("RemoteEvent")
notify.Name = "Notify"
notify.Parent = remotes

local feedback = Instance.new("RemoteEvent")
feedback.Name = "Feedback"
feedback.Parent = remotes

local openWorkshop = Instance.new("RemoteEvent")
openWorkshop.Name = "OpenWorkshop"
openWorkshop.Parent = remotes

local travelEffect = Instance.new("RemoteEvent")
travelEffect.Name = "TravelEffect"
travelEffect.Parent = remotes

local areaVisited = Instance.new("RemoteEvent")
areaVisited.Name = "AreaVisited"
areaVisited.Parent = remotes

local fetchState = Instance.new("RemoteFunction")
fetchState.Name = "FetchState"
fetchState.Parent = remotes

local actionTimes: { [Player]: { [string]: number } } = {}
local collectTimes: { [Player]: { [Instance]: number } } = {}
local playerLanes: { [Player]: number } = {}

local function reserveLane(player: Player): number
	local used = {}
	for _, lane in playerLanes do
		used[lane] = true
	end
	for lane = 1, #decorationSlotLanes do
		if not used[lane] then
			playerLanes[player] = lane
			return lane
		end
	end
	playerLanes[player] = 1
	return 1
end

local function slotsFor(player: Player): { BasePart }
	local lane = playerLanes[player] or reserveLane(player)
	return decorationSlotLanes[lane]
end

local function gallerySlotsFor(player: Player): { BasePart }
	local lane = playerLanes[player] or reserveLane(player)
	return workshopGallerySlotLanes[lane]
end

local function snapshot(player: Player)
	local data = DataService.get(player)
	if data == nil then
		return
	end
	stateUpdated:FireClient(player, {
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
		persistenceAvailable = DataService.isPersistent(player),
	})
end

fetchState.OnServerInvoke = function(player)
	local data = DataService.get(player)
	if data == nil then
		return nil
	end
	return {
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
		persistenceAvailable = DataService.isPersistent(player),
	}
end

local function allowAction(player: Player, action: string, cooldown: number): boolean
	local now = os.clock()
	local playerTimes = actionTimes[player]
	if playerTimes == nil then
		playerTimes = {}
		actionTimes[player] = playerTimes
	end
	local previous = playerTimes[action] or 0
	if now - previous < cooldown then
		return false
	end
	playerTimes[action] = now
	return true
end

local function playerNear(player: Player, target: BasePart, maximumDistance: number): boolean
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	return root ~= nil and root:IsA("BasePart") and (root.Position - target.Position).Magnitude <= maximumDistance
end

local function canAfford(materials: { [string]: number }, cost: { [string]: number }): boolean
	for _, materialId in Config.MATERIAL_ORDER do
		if (materials[materialId] or 0) < (cost[materialId] or 0) then
			return false
		end
	end
	return true
end

local function nextRecipeId(recipeId: string): string?
	for index, currentId in Recipes.order do
		if currentId == recipeId then
			return Recipes.order[index + 1]
		end
	end
	return nil
end

local function currentMission(data: DataService.PlayerData): any
	return Missions.order[data.missionStage]
end

local function resetMissionCollection(data: DataService.PlayerData)
	for _, materialId in Config.MATERIAL_ORDER do
		data.missionCollected[materialId] = 0
	end
end

local function missionCollectionReady(data: DataService.PlayerData, mission: any): boolean
	for _, materialId in Config.MATERIAL_ORDER do
		if (data.missionCollected[materialId] or 0) < (mission.collect[materialId] or 0) then
			return false
		end
	end
	return true
end

local function completeMission(player: Player, data: DataService.PlayerData, mission: any)
	local beforeCleanliness = data.cleanliness
	data.cleanliness = math.clamp(data.cleanliness + mission.cleanlinessReward, 0, 100)
	data.missionStage = math.min(data.missionStage + 1, #Missions.order + 1)
	resetMissionCollection(data)
	DataService.markDirty(player)
	WorldBuilder.applyProgress(data.cleanliness, data.missionStage)
	local nextMission = Missions.order[data.missionStage]
	local nextAreaName: string? = nil
	for _, area in WorldContent.areas do
		if area.unlockStage == data.missionStage then
			nextAreaName = area.name
			break
		end
	end
	feedback:FireClient(player, {
		kind = "MissionComplete",
		title = mission.title,
		beforeCleanliness = beforeCleanliness,
		afterCleanliness = data.cleanliness,
		reward = mission.cleanlinessReward,
		nextMission = if nextMission then nextMission.title else "自由な島づくり",
		nextArea = nextAreaName,
	})
	notify:FireClient(player, `ミッション達成！ 島のきれい度 {data.cleanliness}%`)
end

local function connectMaterialNode(node: Instance)
	if not node:IsA("BasePart") then
		return
	end
	local prompt = node:FindFirstChild("Collect")
	if not prompt or not prompt:IsA("ProximityPrompt") then
		return
	end
	local materialId = node:GetAttribute("MaterialId")
	if type(materialId) ~= "string" or Config.MATERIALS[materialId] == nil then
		return
	end

	prompt.Triggered:Connect(function(player)
		local data = DataService.get(player)
		if data == nil or not playerNear(player, node, Config.COLLECT_DISTANCE + 2) then
			return
		end
		local requiredStage = node:GetAttribute("UnlockStage")
		if type(requiredStage) == "number" and data.missionStage < requiredStage then
			notify:FireClient(player, "このエリアはまだ開いていません")
			return
		end
		local spawnStyle = node:GetAttribute("SpawnStyle")
		if type(spawnStyle) == "string" and not WorldCycle.isSpawnAvailable(spawnStyle) then
			notify:FireClient(player, "この素材は天気や時間が変わると現れます")
			return
		end
		local nodeTimes = collectTimes[player]
		if nodeTimes == nil then
			nodeTimes = {}
			collectTimes[player] = nodeTimes
		end
		local now = os.clock()
		if now - (nodeTimes[node] or 0) < Config.COLLECT_COOLDOWN then
			return
		end
		nodeTimes[node] = now

		local current = data.materials[materialId] or 0
		if current >= Config.MAX_MATERIALS then
			notify:FireClient(player, "これ以上は持てないよ")
			return
		end
		local configuredBonus = node:GetAttribute("BonusAmount")
		local gain = if type(configuredBonus) == "number" then math.max(1, math.floor(configuredBonus)) else 1
		gain = math.min(gain, Config.MAX_MATERIALS - current)
		data.materials[materialId] = current + gain
		local mission = currentMission(data)
		if mission then
			data.missionCollected[materialId] = (data.missionCollected[materialId] or 0) + gain
		end
		DataService.markDirty(player)
		local rarity = node:GetAttribute("Rarity")
		local remaining = if mission then math.max((mission.collect[materialId] or 0) - (data.missionCollected[materialId] or 0), 0) else 0
		feedback:FireClient(player, {
			kind = "Material",
			materialId = materialId,
			name = Config.MATERIALS[materialId].displayName,
			amount = gain,
			rarity = if type(rarity) == "string" then rarity else "ふつう",
			remaining = remaining,
			missionTitle = if mission then mission.title else "島づくり",
		})
		notify:FireClient(player, `{Config.MATERIALS[materialId].displayName} +{gain}`)
		snapshot(player)

		prompt.Enabled = false
		local movingParts: { BasePart } = { node }
		for _, child in node:GetDescendants() do
			if child:IsA("BasePart") then
				table.insert(movingParts, child)
			end
		end
		for _, value in movingParts do
			value.Transparency = 1
		end
		task.delay(math.max(4, Config.COLLECT_COOLDOWN), function()
			if node.Parent == nil then
				return
			end
			local areaId = node:GetAttribute("AreaId")
			local area = if type(areaId) == "string" then WorldContent.areaById[areaId] else nil
			if area then
				local oldPosition = node.Position
				local x = (math.random() - 0.5) * (area.size.X - 18)
				local z = (math.random() - 0.5) * (area.size.Z - 18)
				local groundTarget = area.center + Vector3.new(x, area.size.Y / 2 + 2.5, z)
				local target = groundTarget
				local style = node:GetAttribute("SpawnStyle")
				if style == "treeDrop" or style == "bird" then
					target += Vector3.new(0, 12, 0)
				elseif style == "dig" or style == "hidden" then
					target -= Vector3.new(0, 1.6, 0)
				elseif style == "drift" or style == "river" then
					target -= Vector3.new(0, 1, 0)
				end
				local delta = target - oldPosition
				for _, value in movingParts do
					value.Position += delta
				end
				if style == "treeDrop" or style == "bird" then
					local landingDelta = groundTarget - target
					for _, value in movingParts do
						TweenService:Create(value, TweenInfo.new(0.8, Enum.EasingStyle.Bounce, Enum.EasingDirection.Out), { Position = value.Position + landingDelta }):Play()
					end
				elseif style == "drift" or style == "river" then
					for _, value in movingParts do
						TweenService:Create(value, TweenInfo.new(1.2, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { Position = value.Position + Vector3.new(7, 0, 0) }):Play()
					end
				end
			end
			for _, value in movingParts do
				value.Transparency = 0
			end
			prompt.Enabled = true
		end)
	end)
end

for _, node in world:GetDescendants() do
	if node.Name == "Collect" and node.Parent then
		connectMaterialNode(node.Parent)
	end
end

local discoveries = world:FindFirstChild("Discoveries")
if discoveries then
	for _, marker in discoveries:GetChildren() do
		if marker:IsA("BasePart") then
			local prompt = marker:FindFirstChild("Discover")
			if prompt and prompt:IsA("ProximityPrompt") then
				prompt.Triggered:Connect(function(player)
					local data = DataService.get(player)
					local requiredStage = marker:GetAttribute("UnlockStage")
					if data == nil or type(requiredStage) ~= "number" then
						return
					end
					if data.missionStage < requiredStage then
						notify:FireClient(player, "まだ見つけられない秘密のようです")
						return
					end
					local discoveryName = marker:GetAttribute("DiscoveryName")
					if data.discoveredSecrets[marker.Name] then
						notify:FireClient(player, "ここは発見済みです")
						return
					end
					data.discoveredSecrets[marker.Name] = true
					DataService.markDirty(player)
					notify:FireClient(player, `発見！ {if type(discoveryName) == "string" then discoveryName else "島の秘密"}`)
					marker.Transparency = 0.7
					snapshot(player)
				end)
			end
		end
	end
end

local function travelMessage(style: string): string
	local names = {
		Bridge = "橋を渡っています",
		Bicycle = "自転車で出発！",
		Minecart = "トロッコで洞窟へ！",
		Rope = "ロープで崖を登ります",
		Zipline = "ジップラインでひとっ飛び！",
		RecycleCar = "リサイクルカーで出発！",
		RiverRide = "川下りへ出発！",
		Animal = "動物と一緒に進みます",
		Slide = "滑り台で移動！",
		JumpPad = "ジャンプ台、発射！",
		HiddenDoor = "隠し扉が開きました",
		Glider = "グライダーで空へ！",
		EcoBot = "エコロボに乗ります",
		WarpGate = "ワープゲート起動！",
		Boat = "船で次の島へ！",
	}
	return names[style] or "新しい場所へ移動します"
end

local travelColors = {
	Bridge = Color3.fromRGB(193, 135, 76), Bicycle = Color3.fromRGB(71, 190, 255),
	Minecart = Color3.fromRGB(120, 127, 145), Rope = Color3.fromRGB(196, 142, 75),
	Zipline = Color3.fromRGB(255, 207, 67), RecycleCar = Color3.fromRGB(65, 218, 112),
	RiverRide = Color3.fromRGB(48, 181, 255), Animal = Color3.fromRGB(244, 174, 93),
	Slide = Color3.fromRGB(255, 107, 178), JumpPad = Color3.fromRGB(255, 226, 74),
	HiddenDoor = Color3.fromRGB(112, 91, 151), Glider = Color3.fromRGB(116, 225, 255),
	EcoBot = Color3.fromRGB(132, 231, 141), WarpGate = Color3.fromRGB(186, 106, 255),
	Boat = Color3.fromRGB(73, 147, 225),
}

local travelDurations = {
	Bridge = 2.4, Bicycle = 1.8, Minecart = 2.1, Rope = 2.8, Zipline = 1.35,
	RecycleCar = 1.5, RiverRide = 2.6, Animal = 2.2, Slide = 1.45, JumpPad = 1.7,
	HiddenDoor = 1.1, Glider = 2.8, EcoBot = 1.7, WarpGate = 0.75, Boat = 3.0,
}

local function performTravel(player: Player, style: string, destination: Vector3)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if root == nil or not root:IsA("BasePart") then
		return
	end
	local duration = travelDurations[style] or 1.5
	travelEffect:FireClient(player, "Start", style, duration)
	if style == "WarpGate" or style == "HiddenDoor" then
		task.wait(duration * 0.65)
		character:PivotTo(CFrame.new(destination))
		travelEffect:FireClient(player, "Finish", style, duration)
		return
	end

	local carrier = Instance.new("Part")
	carrier.Name = `Travel_{style}`
	carrier.Size = if style == "Boat" then Vector3.new(9, 2, 14) elseif style == "Glider" then Vector3.new(14, 1, 5) else Vector3.new(6, 1.5, 7)
	carrier.Color = travelColors[style] or Color3.fromRGB(100, 210, 255)
	carrier.Material = if style == "JumpPad" or style == "Zipline" then Enum.Material.Neon else Enum.Material.SmoothPlastic
	carrier.Anchored = true
	carrier.CanCollide = false
	carrier.CFrame = root.CFrame * CFrame.new(0, -3.5, 0)
	carrier.Parent = world

	root.Anchored = true
	local startPosition = root.Position
	local midpoint = (startPosition + destination) / 2
	if style == "JumpPad" or style == "Glider" or style == "Zipline" then
		midpoint += Vector3.new(0, math.max(25, (destination - startPosition).Magnitude * 0.16), 0)
	elseif style == "Rope" then
		midpoint = Vector3.new(startPosition.X, destination.Y + 5, startPosition.Z)
	end

	local firstDuration = duration * 0.5
	local firstGoal = CFrame.lookAt(midpoint, destination)
	local firstRoot = TweenService:Create(root, TweenInfo.new(firstDuration, Enum.EasingStyle.Sine, Enum.EasingDirection.Out), { CFrame = firstGoal })
	local firstCarrier = TweenService:Create(carrier, TweenInfo.new(firstDuration, Enum.EasingStyle.Sine, Enum.EasingDirection.Out), { CFrame = firstGoal * CFrame.new(0, -3.5, 0) })
	firstRoot:Play()
	firstCarrier:Play()
	firstRoot.Completed:Wait()
	local endGoal = CFrame.new(destination)
	local secondRoot = TweenService:Create(root, TweenInfo.new(duration - firstDuration, Enum.EasingStyle.Sine, Enum.EasingDirection.In), { CFrame = endGoal })
	local secondCarrier = TweenService:Create(carrier, TweenInfo.new(duration - firstDuration, Enum.EasingStyle.Sine, Enum.EasingDirection.In), { CFrame = endGoal * CFrame.new(0, -3.5, 0) })
	secondRoot:Play()
	secondCarrier:Play()
	secondRoot.Completed:Wait()
	root.Anchored = false
	carrier:Destroy()
	travelEffect:FireClient(player, "Finish", style, duration)
end

local travelFolder = world:FindFirstChild("TravelPoints")
if travelFolder then
	for _, pad in travelFolder:GetChildren() do
		if pad:IsA("BasePart") then
			local prompt = pad:FindFirstChild("Travel")
			if prompt and prompt:IsA("ProximityPrompt") then
				prompt.Triggered:Connect(function(player)
					local data = DataService.get(player)
					local destinationId = pad:GetAttribute("DestinationArea")
					local unlockStage = pad:GetAttribute("UnlockStage")
					if data == nil or type(destinationId) ~= "string" or type(unlockStage) ~= "number" then
						return
					end
					if data.missionStage < unlockStage then
						notify:FireClient(player, `この道はミッション{unlockStage - 1}をクリアすると開きます`)
						return
					end
					local area = WorldContent.areaById[destinationId]
					local character = player.Character
					if area == nil or character == nil then
						return
					end
					local style = pad:GetAttribute("TravelStyle")
					notify:FireClient(player, travelMessage(if type(style) == "string" then style else ""))
					local destination = area.center + Vector3.new(0, area.size.Y / 2 + 6, area.size.Z * 0.28)
					data.lastArea = destinationId
					DataService.markDirty(player)
					snapshot(player)
					task.spawn(performTravel, player, if type(style) == "string" then style else "Bridge", destination)
				end)
			end
		end
	end
end

local workshopInterior = world:FindFirstChild("WorkshopInterior") :: Folder
local interiorSpawn = workshopInterior:FindFirstChild("InteriorSpawn") :: BasePart
local exteriorSpawn = workshopInterior:FindFirstChild("ExteriorSpawn") :: BasePart
local exitStation = workshopInterior:FindFirstChild("ExitStation") :: BasePart
local interiorCraftStation = workshopInterior:FindFirstChild("InteriorCraftStation") :: BasePart
local enterWorkshopPrompt = workshop:FindFirstChild("EnterWorkshop") :: ProximityPrompt
local exitWorkshopPrompt = exitStation:FindFirstChild("ExitWorkshop") :: ProximityPrompt
local interiorCraftPrompt = interiorCraftStation:FindFirstChild("OpenWorkshop") :: ProximityPrompt

local function movePlayerTo(player: Player, destination: BasePart)
	local character = player.Character
	if character then
		character:PivotTo(destination.CFrame * CFrame.new(0, 3.5, 0))
	end
end

enterWorkshopPrompt.Triggered:Connect(function(player)
	if playerNear(player, workshop, 14) then
		movePlayerTo(player, interiorSpawn)
		notify:FireClient(player, "工房へようこそ！ 奥の虹色マシンで工作できるよ")
	end
end)

exitWorkshopPrompt.Triggered:Connect(function(player)
	if playerNear(player, exitStation, 14) then
		movePlayerTo(player, exteriorSpawn)
	end
end)

interiorCraftPrompt.Triggered:Connect(function(player)
	if playerNear(player, interiorCraftStation, 14) then
		openWorkshop:FireClient(player)
	end
end)

local ecoGuide = world:FindFirstChild("EcoGuide")
local guideBody = ecoGuide and ecoGuide:FindFirstChild("Body")
local guidePrompt = guideBody and guideBody:FindFirstChild("TalkToEcoGuide")
if guidePrompt and guidePrompt:IsA("ProximityPrompt") then
	guidePrompt.Triggered:Connect(function(player)
		local data = DataService.get(player)
		local mission = data and currentMission(data)
		if data and mission then
			notify:FireClient(player, `エコロボ「{mission.title}を進めよう！ あと少しで島が変わるよ」`)
		elseif data then
			notify:FireClient(player, "エコロボ「島は元気いっぱい！ 好きな作品を作って冒険しよう！」")
		end
	end)
end

requestCraft.OnServerEvent:Connect(function(player, recipeId: any, slot: any)
	if not allowAction(player, "craft", Config.CRAFT_COOLDOWN) then
		return
	end
	if type(recipeId) ~= "string" or type(slot) ~= "number" or slot ~= math.floor(slot) then
		return
	end
	if slot < 1 or slot > Config.DECORATION_SLOTS then
		return
	end
	if not playerNear(player, workshop, 18) and not playerNear(player, interiorCraftStation, 18) then
		notify:FireClient(player, "工房の近くで作ってね")
		return
	end

	local data = DataService.get(player)
	local recipe = Recipes.byId[recipeId]
	if data == nil or recipe == nil or data.unlockedRecipes[recipeId] ~= true then
		return
	end
	if not canAfford(data.materials, recipe.cost) then
		notify:FireClient(player, "材料が足りないよ")
		return
	end

	for _, materialId in Config.MATERIAL_ORDER do
		data.materials[materialId] -= recipe.cost[materialId] or 0
	end
	data.decorations[slot] = recipeId
	data.craftedCount += 1
	local unlockedId = nextRecipeId(recipeId)
	local newlyUnlocked = unlockedId ~= nil and data.unlockedRecipes[unlockedId] ~= true
	if unlockedId then
		data.unlockedRecipes[unlockedId] = true
	end
	local mission = currentMission(data)
	if mission and missionCollectionReady(data, mission) then
		local matchesRecipe = mission.craftRecipeId == recipeId
		local reachesCraftTarget = mission.craftTarget ~= nil and data.craftedCount >= mission.craftTarget
		if matchesRecipe or reachesCraftTarget then
			completeMission(player, data, mission)
		end
	end
	DataService.markDirty(player)
	WorldBuilder.renderDecorations(player, slotsFor(player), gallerySlotsFor(player), data.decorations)
	feedback:FireClient(player, {
		kind = "CraftComplete",
		recipeId = recipeId,
		name = recipe.displayName,
		color = recipe.color,
		newRecipe = if newlyUnlocked and unlockedId then Recipes.byId[unlockedId].displayName else nil,
		cleanliness = data.cleanliness,
	})
	notify:FireClient(player, `{recipe.displayName} 完成！`)
	if newlyUnlocked and unlockedId then
		notify:FireClient(player, `新しいレシピ「{Recipes.byId[unlockedId].displayName}」を発見！`)
	end
	snapshot(player)
end)

tutorialComplete.OnServerEvent:Connect(function(player)
	if not allowAction(player, "tutorial", 1) then
		return
	end
	local data = DataService.get(player)
	if data and data.tutorialComplete ~= true then
		data.tutorialComplete = true
		DataService.markDirty(player)
		snapshot(player)
	end
end)

areaVisited.OnServerEvent:Connect(function(player, areaId: any)
	if type(areaId) ~= "string" or not allowAction(player, "areaVisited", 1) then
		return
	end
	local area = WorldContent.areaById[areaId]
	local data = DataService.get(player)
	local character = player.Character
	local root = character and character:FindFirstChild("HumanoidRootPart")
	if area == nil or data == nil or root == nil or not root:IsA("BasePart") then
		return
	end
	if data.missionStage < area.unlockStage then
		return
	end
	local horizontalDistance = (Vector3.new(root.Position.X, 0, root.Position.Z) - Vector3.new(area.center.X, 0, area.center.Z)).Magnitude
	local allowedRadius = math.max(area.size.X, area.size.Z) * 0.72
	if horizontalDistance > allowedRadius or math.abs(root.Position.Y - area.center.Y) > 140 then
		return
	end
	if data.lastArea ~= areaId then
		data.lastArea = areaId
		DataService.markDirty(player)
		snapshot(player)
	end
end)

Players.PlayerAdded:Connect(function(player)
	local data = DataService.load(player)
	WorldBuilder.applyProgress(data.cleanliness, data.missionStage)
	reserveLane(player)
	WorldBuilder.renderDecorations(player, slotsFor(player), gallerySlotsFor(player), data.decorations)
	task.defer(snapshot, player)
end)

Players.PlayerRemoving:Connect(function(player)
	local decorations = world:FindFirstChild(`Player_{player.UserId}_Decorations`)
	if decorations then
		decorations:Destroy()
	end
	local workshopGallery = world:FindFirstChild(`Player_{player.UserId}_WorkshopGallery`)
	if workshopGallery then
		workshopGallery:Destroy()
	end
	DataService.release(player)
	actionTimes[player] = nil
	collectTimes[player] = nil
	playerLanes[player] = nil
end)

task.spawn(function()
	while true do
		task.wait(Config.AUTOSAVE_SECONDS)
		for _, player in Players:GetPlayers() do
			if not DataService.save(player) then
				notify:FireClient(player, "セーブを再試行しています")
			end
		end
	end
end)

game:BindToClose(function()
	for _, player in Players:GetPlayers() do
		DataService.save(player)
	end
end)
