--!strict

local Players = game:GetService("Players")
local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local ProximityPromptService = game:GetService("ProximityPromptService")

local Config = require(ReplicatedStorage.Shared.Config)
local Recipes = require(ReplicatedStorage.Shared.Recipes)
local Missions = require(ReplicatedStorage.Shared.Missions)
local WorldContent = require(ReplicatedStorage.Shared.WorldContent)
local CraftingActivities = require(ReplicatedStorage.Shared.CraftingActivities)

local player = Players.LocalPlayer
local remotes = ReplicatedStorage:WaitForChild("MinijimaRemotes")
local stateUpdated = remotes:WaitForChild("StateUpdated") :: RemoteEvent
local requestCraft = remotes:WaitForChild("RequestCraft") :: RemoteEvent
local tutorialComplete = remotes:WaitForChild("TutorialComplete") :: RemoteEvent
local notifyRemote = remotes:WaitForChild("Notify") :: RemoteEvent
local feedbackRemote = remotes:WaitForChild("Feedback") :: RemoteEvent
local openWorkshopRemote = remotes:WaitForChild("OpenWorkshop") :: RemoteEvent
local travelEffectRemote = remotes:WaitForChild("TravelEffect") :: RemoteEvent
local areaVisitedRemote = remotes:WaitForChild("AreaVisited") :: RemoteEvent
local fetchState = remotes:WaitForChild("FetchState") :: RemoteFunction

type ClientState = {
	materials: { [string]: number },
	unlockedRecipes: { [string]: boolean },
	decorations: { string },
	tutorialComplete: boolean,
	persistenceAvailable: boolean,
	missionStage: number,
	missionCollected: { [string]: number },
	cleanliness: number,
	craftedCount: number,
	discoveredSecrets: { [string]: boolean },
	lastArea: string,
}

local state: ClientState = {
	materials = { Wood = 0, Plastic = 0, Metal = 0 },
	unlockedRecipes = { BottlePlanter = true },
	decorations = { "", "", "" },
	tutorialComplete = false,
	persistenceAvailable = true,
	missionStage = 1,
	missionCollected = { Wood = 0, Plastic = 0, Metal = 0 },
	cleanliness = 0,
	craftedCount = 0,
	discoveredSecrets = {},
	lastArea = "StartPlaza",
}

local screen = Instance.new("ScreenGui")
screen.Name = "MinijimaUI"
screen.ResetOnSpawn = false
screen.IgnoreGuiInset = false
screen.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
screen.Parent = player:WaitForChild("PlayerGui")

local function corner(parent: GuiObject, radius: number)
	local value = Instance.new("UICorner")
	value.CornerRadius = UDim.new(0, radius)
	value.Parent = parent
end

local function stroke(parent: GuiObject, color: Color3?)
	local value = Instance.new("UIStroke")
	value.Color = color or Color3.fromRGB(20, 25, 38)
	value.Thickness = 3
	value.Parent = parent
end

local function gradient(parent: GuiObject, topColor: Color3, bottomColor: Color3)
	local value = Instance.new("UIGradient")
	value.Color = ColorSequence.new(topColor, bottomColor)
	value.Rotation = 90
	value.Parent = parent
end

local travelOverlay = Instance.new("Frame")
travelOverlay.Name = "TravelOverlay"
travelOverlay.Size = UDim2.fromScale(1, 1)
travelOverlay.BackgroundColor3 = Color3.fromRGB(60, 180, 255)
travelOverlay.BackgroundTransparency = 1
travelOverlay.ZIndex = 100
travelOverlay.Visible = false
travelOverlay.Parent = screen

local travelTitle = Instance.new("TextLabel")
travelTitle.Name = "TravelTitle"
travelTitle.AnchorPoint = Vector2.new(0.5, 0.5)
travelTitle.Position = UDim2.fromScale(0.5, 0.78)
travelTitle.Size = UDim2.fromOffset(460, 64)
travelTitle.BackgroundColor3 = Color3.fromRGB(255, 229, 84)
travelTitle.TextColor3 = Color3.fromRGB(27, 47, 78)
travelTitle.Font = Enum.Font.GothamBlack
travelTitle.TextSize = 25
travelTitle.ZIndex = 101
travelTitle.Visible = false
travelTitle.Parent = travelOverlay
corner(travelTitle, 24)
stroke(travelTitle, Color3.fromRGB(27, 47, 78))

local travelNames = {
	Bridge = "橋をわたっています", Bicycle = "自転車で出発！", Minecart = "トロッコ探検！",
	Rope = "ロープで崖の上へ！", Zipline = "ジップライン！", RecycleCar = "リサイクルカーで出発！",
	RiverRide = "わくわく川下り！", Animal = "動物と一緒におでかけ！", Slide = "大きな滑り台！",
	JumpPad = "ジャンプ台、発射！", HiddenDoor = "秘密の扉を発見！", Glider = "グライダーで空へ！",
	EcoBot = "エコロボに乗ろう！", WarpGate = "ワープゲート起動！", Boat = "船で次の島へ！",
}

travelEffectRemote.OnClientEvent:Connect(function(phase: string, style: string, duration: number)
	if phase == "Start" then
		travelOverlay.Visible = true
		travelTitle.Visible = true
		travelTitle.Text = travelNames[style] or "冒険へ出発！"
		travelTitle.Position = UDim2.fromScale(0.5, 0.84)
		travelTitle.Rotation = -3
		TweenService:Create(travelTitle, TweenInfo.new(0.3, Enum.EasingStyle.Back, Enum.EasingDirection.Out), {
			Position = UDim2.fromScale(0.5, 0.78), Rotation = 0,
		}):Play()
		if style == "WarpGate" or style == "HiddenDoor" then
			travelOverlay.BackgroundColor3 = if style == "WarpGate" then Color3.fromRGB(153, 83, 255) else Color3.fromRGB(31, 43, 76)
			TweenService:Create(travelOverlay, TweenInfo.new(math.max(0.2, duration * 0.45)), { BackgroundTransparency = 0.08 }):Play()
		else
			travelOverlay.BackgroundTransparency = 1
		end
	else
		TweenService:Create(travelOverlay, TweenInfo.new(0.35), { BackgroundTransparency = 1 }):Play()
		task.delay(0.4, function()
			travelTitle.Visible = false
			travelOverlay.Visible = false
		end)
	end
end)

local function textLabel(parent: Instance, text: string, size: UDim2, position: UDim2, fontSize: number, bold: boolean?): TextLabel
	local label = Instance.new("TextLabel")
	label.Size = size
	label.Position = position
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextColor3 = Color3.fromRGB(27, 47, 52)
	label.Font = if bold then Enum.Font.GothamBold else Enum.Font.Gotham
	label.TextSize = fontSize
	label.TextStrokeColor3 = Color3.fromRGB(18, 22, 32)
	label.TextStrokeTransparency = if bold then 0.16 else 0.72
	label.TextWrapped = true
	label.Parent = parent
	return label
end

local function button(parent: Instance, text: string, size: UDim2, position: UDim2): TextButton
	local value = Instance.new("TextButton")
	value.Size = size
	value.Position = position
	value.BackgroundColor3 = Color3.fromRGB(80, 215, 62)
	value.TextColor3 = Color3.new(1, 1, 1)
	value.Text = text
	value.Font = Enum.Font.GothamBlack
	value.TextSize = 18
	value.AutoButtonColor = true
	value.Parent = parent
	value.TextStrokeColor3 = Color3.fromRGB(18, 22, 32)
	value.TextStrokeTransparency = 0
	corner(value, 7)
	stroke(value, Color3.fromRGB(18, 22, 32))
	return value
end

local hud = Instance.new("Frame")
hud.Name = "MaterialsHUD"
hud.AnchorPoint = Vector2.new(0.5, 0)
hud.Position = UDim2.fromScale(0.5, 0.025)
hud.Size = UDim2.new(0.72, 0, 0, 58)
hud.BackgroundColor3 = Color3.fromRGB(42, 48, 70)
hud.BackgroundTransparency = 0.05
hud.Parent = screen
corner(hud, 8)
stroke(hud)
gradient(hud, Color3.fromRGB(62, 72, 105), Color3.fromRGB(25, 30, 49))
local hudConstraint = Instance.new("UISizeConstraint")
hudConstraint.MaxSize = Vector2.new(480, 58)
hudConstraint.MinSize = Vector2.new(270, 58)
hudConstraint.Parent = hud

local materialLabels: { [string]: TextLabel } = {}
local materialFrames: { [string]: Frame } = {}
local materialScales: { [string]: UIScale } = {}
local materialIcons = {
	Wood = "🪵",
	Plastic = "🧴",
	Metal = "🥫",
}
for index, materialId in Config.MATERIAL_ORDER do
	local item = Instance.new("Frame")
	item.Size = UDim2.new(1 / 3, -8, 1, -12)
	item.Position = UDim2.new((index - 1) / 3, 4, 0, 6)
	item.BackgroundColor3 = Config.MATERIALS[materialId].color
	item.Parent = hud
	corner(item, 6)
	stroke(item, Color3.fromRGB(18, 22, 32))
	local itemScale = Instance.new("UIScale")
	itemScale.Parent = item
	local icon = textLabel(item, materialIcons[materialId] or "●", UDim2.new(0.55, 0, 1, 0), UDim2.fromScale(0.04, 0), 27, true)
	icon.Name = "MaterialPicture"
	icon.TextColor3 = Color3.new(1, 1, 1)
	local label = textLabel(item, "", UDim2.new(0.42, 0, 1, 0), UDim2.fromScale(0.56, 0), 24, true)
	label.Name = "MaterialCount"
	label.TextColor3 = Color3.new(1, 1, 1)
	materialLabels[materialId] = label
	materialFrames[materialId] = item
	materialScales[materialId] = itemScale
end

local collectSound = Instance.new("Sound")
collectSound.Name = "CollectSound"
collectSound.SoundId = "rbxasset://sounds/electronicpingshort.wav"
collectSound.Volume = 0.35
collectSound.Parent = screen

local function playMaterialGain(materialId: string, amount: number)
	local item = materialFrames[materialId]
	local itemScale = materialScales[materialId]
	if item == nil or itemScale == nil then
		return
	end

	collectSound:Play()
	itemScale.Scale = 1
	local grow = TweenService:Create(itemScale, TweenInfo.new(0.14, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1.14 })
	local shrink = TweenService:Create(itemScale, TweenInfo.new(0.2, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Scale = 1 })
	grow:Play()
	grow.Completed:Once(function()
		shrink:Play()
	end)

	local flash = Instance.new("UIStroke")
	flash.Color = Color3.fromRGB(255, 247, 129)
	flash.Thickness = 5
	flash.Transparency = 0
	flash.Parent = item
	TweenService:Create(flash, TweenInfo.new(0.55), { Transparency = 1, Thickness = 1 }):Play()
	task.delay(0.6, function()
		flash:Destroy()
	end)

	local gain = textLabel(item, `+{amount}`, UDim2.fromOffset(70, 36), UDim2.new(0.5, -35, 0, -14), 24, true)
	gain.Name = "MaterialGain"
	gain.TextColor3 = Color3.fromRGB(255, 247, 129)
	gain.TextStrokeColor3 = Color3.fromRGB(40, 58, 61)
	gain.TextStrokeTransparency = 0
	gain.ZIndex = 30
	local rise = TweenService:Create(gain, TweenInfo.new(0.75, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = UDim2.new(0.5, -35, 0, -42),
		TextTransparency = 1,
		TextStrokeTransparency = 1,
	})
	rise:Play()
	rise.Completed:Once(function()
		gain:Destroy()
	end)
end

local nextTask = Instance.new("Frame")
nextTask.Name = "NextTask"
nextTask.AnchorPoint = Vector2.new(0.5, 0)
nextTask.Position = UDim2.fromScale(0.5, 0.1)
nextTask.Size = UDim2.new(0.72, 0, 0, 50)
nextTask.BackgroundColor3 = Color3.fromRGB(48, 205, 255)
nextTask.BackgroundTransparency = 0.03
nextTask.Parent = screen
corner(nextTask, 7)
stroke(nextTask, Color3.fromRGB(18, 22, 32))
gradient(nextTask, Color3.fromRGB(92, 225, 255), Color3.fromRGB(28, 158, 239))
local nextTaskConstraint = Instance.new("UISizeConstraint")
nextTaskConstraint.MaxSize = Vector2.new(520, 50)
nextTaskConstraint.MinSize = Vector2.new(270, 50)
nextTaskConstraint.Parent = nextTask
local nextTaskLabel = textLabel(nextTask, "", UDim2.new(1, -24, 1, -10), UDim2.fromOffset(12, 5), 18, true)
nextTaskLabel.TextColor3 = Color3.new(1, 1, 1)
nextTaskLabel.TextStrokeTransparency = 0

local worldStatus = Instance.new("Frame")
worldStatus.Name = "WorldStatus"
worldStatus.AnchorPoint = Vector2.new(0.5, 0)
worldStatus.Position = UDim2.fromScale(0.5, 0.165)
worldStatus.Size = UDim2.fromOffset(430, 38)
worldStatus.BackgroundColor3 = Color3.fromRGB(255, 70, 78)
worldStatus.BackgroundTransparency = 0.08
worldStatus.Parent = screen
corner(worldStatus, 7)
stroke(worldStatus, Color3.fromRGB(18, 22, 32))
local worldStatusLabel = textLabel(worldStatus, "", UDim2.new(1, -18, 1, 0), UDim2.fromOffset(9, 0), 14, true)
worldStatusLabel.TextColor3 = Color3.fromRGB(245, 252, 255)

local helpButton = button(screen, "？ あそびかた", UDim2.fromOffset(140, 48), UDim2.new(0, 18, 1, -66))

local toast = textLabel(screen, "", UDim2.fromOffset(440, 58), UDim2.new(0.5, -220, 0.2, 0), 20, true)
toast.AnchorPoint = Vector2.new(0.5, 0)
toast.Position = UDim2.fromScale(0.5, 0.2)
toast.BackgroundTransparency = 0.08
toast.BackgroundColor3 = Color3.fromRGB(27, 47, 52)
toast.TextColor3 = Color3.new(1, 1, 1)
toast.Visible = false
toast.ZIndex = 20
corner(toast, 14)

local toastVersion = 0
local function showToast(message: string)
	toastVersion += 1
	local version = toastVersion
	toast.Text = message
	toast.TextTransparency = 0
	toast.BackgroundTransparency = 0.08
	toast.Visible = true
	task.delay(2.2, function()
		if version ~= toastVersion then
			return
		end
		local tween = TweenService:Create(toast, TweenInfo.new(0.35), { TextTransparency = 1, BackgroundTransparency = 1 })
		tween:Play()
		tween.Completed:Wait()
		if version == toastVersion then
			toast.Visible = false
		end
	end)
end

local function playAnimeCelebration()
	local flash = Instance.new("Frame")
	flash.Name = "MissionFlash"
	flash.Size = UDim2.fromScale(1, 1)
	flash.BackgroundColor3 = Color3.fromRGB(255, 246, 145)
	flash.BackgroundTransparency = 0.22
	flash.ZIndex = 60
	flash.Parent = screen
	TweenService:Create(flash, TweenInfo.new(0.55), { BackgroundTransparency = 1 }):Play()
	task.delay(0.6, function()
		flash:Destroy()
	end)

	local random = Random.new(20260806)
	local colors = {
		Color3.fromRGB(255, 80, 142), Color3.fromRGB(44, 213, 255),
		Color3.fromRGB(255, 224, 72), Color3.fromRGB(111, 238, 135),
		Color3.fromRGB(168, 120, 255),
	}
	for index = 1, 28 do
		local piece = Instance.new("Frame")
		piece.Name = "AnimeConfetti"
		piece.AnchorPoint = Vector2.new(0.5, 0.5)
		piece.Size = UDim2.fromOffset(random:NextInteger(8, 16), random:NextInteger(16, 28))
		piece.Position = UDim2.fromScale(random:NextNumber(0.05, 0.95), -0.08)
		piece.Rotation = random:NextInteger(-45, 45)
		piece.BackgroundColor3 = colors[((index - 1) % #colors) + 1]
		piece.BorderSizePixel = 0
		piece.ZIndex = 61
		piece.Parent = screen
		corner(piece, 4)
		local fall = TweenService:Create(piece, TweenInfo.new(random:NextNumber(1.2, 2.1), Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
			Position = UDim2.fromScale(piece.Position.X.Scale + random:NextNumber(-0.08, 0.08), 1.1),
			Rotation = piece.Rotation + random:NextInteger(180, 540),
			BackgroundTransparency = 0.15,
		})
		fall:Play()
		fall.Completed:Once(function()
			piece:Destroy()
		end)
	end
end

local gameBrand = textLabel(screen, Config.GAME_TITLE, UDim2.fromOffset(270, 34), UDim2.fromOffset(14, 58), 18, true)
gameBrand.Name = "GameBrand"
gameBrand.BackgroundColor3 = Color3.fromRGB(35, 74, 103)
gameBrand.BackgroundTransparency = 0.08
gameBrand.TextColor3 = Color3.fromRGB(255, 244, 137)
gameBrand.ZIndex = 4
corner(gameBrand, 12)
stroke(gameBrand, Color3.fromRGB(20, 44, 68))

local rewardBanner = Instance.new("Frame")
rewardBanner.Name = "RewardBanner"
rewardBanner.AnchorPoint = Vector2.new(0.5, 0)
rewardBanner.Position = UDim2.fromScale(0.5, 0.28)
rewardBanner.Size = UDim2.fromOffset(500, 82)
rewardBanner.BackgroundColor3 = Color3.fromRGB(255, 246, 170)
rewardBanner.Visible = false
rewardBanner.ZIndex = 48
rewardBanner.Parent = screen
corner(rewardBanner, 18)
stroke(rewardBanner, Color3.fromRGB(54, 76, 100))
local rewardBannerText = textLabel(rewardBanner, "", UDim2.new(1, -24, 1, -12), UDim2.fromOffset(12, 6), 19, true)
rewardBannerText.ZIndex = 49
local rewardBannerVersion = 0

local eventShade = Instance.new("Frame")
eventShade.Name = "CelebrationShade"
eventShade.Size = UDim2.fromScale(1, 1)
eventShade.BackgroundColor3 = Color3.fromRGB(18, 38, 62)
eventShade.BackgroundTransparency = 0.25
eventShade.Visible = false
eventShade.ZIndex = 50
eventShade.Parent = screen
local eventCard = Instance.new("Frame")
eventCard.Name = "CelebrationCard"
eventCard.AnchorPoint = Vector2.new(0.5, 0.5)
eventCard.Position = UDim2.fromScale(0.5, 0.52)
eventCard.Size = UDim2.new(0.88, 0, 0, 410)
eventCard.BackgroundColor3 = Color3.fromRGB(255, 252, 225)
eventCard.ZIndex = 51
eventCard.Parent = eventShade
corner(eventCard, 28)
stroke(eventCard, Color3.fromRGB(41, 65, 94))
local eventConstraint = Instance.new("UISizeConstraint")
eventConstraint.MaxSize = Vector2.new(650, 410)
eventConstraint.MinSize = Vector2.new(300, 380)
eventConstraint.Parent = eventCard
local eventIcon = textLabel(eventCard, "♻", UDim2.fromOffset(126, 126), UDim2.new(0.5, -63, 0, 22), 66, true)
eventIcon.BackgroundColor3 = Color3.fromRGB(91, 222, 150)
eventIcon.ZIndex = 52
corner(eventIcon, 63)
stroke(eventIcon, Color3.fromRGB(35, 73, 92))
local eventTitle = textLabel(eventCard, "", UDim2.new(1, -40, 0, 55), UDim2.fromOffset(20, 156), 29, true)
eventTitle.ZIndex = 52
local changePanel = Instance.new("Frame")
changePanel.Name = "IslandBeforeAfter"
changePanel.Size = UDim2.new(1, -50, 0, 62)
changePanel.Position = UDim2.fromOffset(25, 212)
changePanel.BackgroundTransparency = 1
changePanel.Visible = false
changePanel.ZIndex = 52
changePanel.Parent = eventCard
local beforePanel = textLabel(changePanel, "BEFORE", UDim2.new(0.42, 0, 1, 0), UDim2.fromScale(0, 0), 17, true)
beforePanel.BackgroundColor3 = Color3.fromRGB(132, 118, 104)
beforePanel.TextColor3 = Color3.fromRGB(255, 255, 255)
beforePanel.ZIndex = 53
corner(beforePanel, 14)
local changeArrow = textLabel(changePanel, "➜", UDim2.new(0.16, 0, 1, 0), UDim2.fromScale(0.42, 0), 30, true)
changeArrow.TextColor3 = Color3.fromRGB(255, 157, 50)
changeArrow.ZIndex = 53
local afterPanel = textLabel(changePanel, "AFTER", UDim2.new(0.42, 0, 1, 0), UDim2.fromScale(0.58, 0), 17, true)
afterPanel.BackgroundColor3 = Color3.fromRGB(64, 190, 125)
afterPanel.TextColor3 = Color3.fromRGB(255, 255, 255)
afterPanel.ZIndex = 53
corner(afterPanel, 14)
local eventBody = textLabel(eventCard, "", UDim2.new(1, -50, 0, 82), UDim2.fromOffset(25, 278), 17, true)
eventBody.ZIndex = 52
local eventNext = button(eventCard, "つぎへ", UDim2.new(1, -70, 0, 58), UDim2.new(0, 35, 1, -76))
eventNext.BackgroundColor3 = Color3.fromRGB(45, 164, 111)
eventNext.ZIndex = 53

local eventQueue: { any } = {}
local eventShowing = false
local showNextFeedback: (() -> ())? = nil

showNextFeedback = function()
	if eventShowing or #eventQueue == 0 then
		return
	end
	eventShowing = true
	local payload = table.remove(eventQueue, 1)
	local isMission = payload.kind == "MissionComplete"
	eventShade.Visible = true
	eventCard.Size = UDim2.new(0.6, 0, 0, 330)
	TweenService:Create(eventCard, TweenInfo.new(0.42, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Size = UDim2.new(0.88, 0, 0, 410) }):Play()
	if isMission then
		changePanel.Visible = true
		beforePanel.Text = `BEFORE\n島の元気 {payload.beforeCleanliness}%`
		afterPanel.Text = `AFTER\n島の元気 {payload.afterCleanliness}%`
		eventIcon.Text = "★"
		eventIcon.BackgroundColor3 = Color3.fromRGB(255, 214, 65)
		eventTitle.Text = "ミッションクリア！"
		local areaText = if payload.nextArea then `\n新エリア「{payload.nextArea}」が開いた！` else ""
		eventBody.Text = `「{payload.title}」達成！（＋{payload.reward}）{areaText}\n次は「{payload.nextMission}」`
		playAnimeCelebration()
	else
		changePanel.Visible = false
		eventIcon.Text = "♻"
		eventIcon.BackgroundColor3 = payload.color or Color3.fromRGB(91, 222, 150)
		eventTitle.Text = `{payload.name} 完成！`
		local unlockText = if payload.newRecipe then `\n新しいレシピ「{payload.newRecipe}」を発見！` else ""
		eventBody.Text = `材料がすてきな作品に生まれ変わった！{unlockText}\n島のきれい度：{payload.cleanliness}%`
	end
end

eventNext.Activated:Connect(function()
	eventShade.Visible = false
	eventShowing = false
	if showNextFeedback then showNextFeedback() end
end)

local shade = Instance.new("Frame")
shade.Name = "Shade"
shade.Size = UDim2.fromScale(1, 1)
shade.BackgroundColor3 = Color3.new(0, 0, 0)
shade.BackgroundTransparency = 0.38
shade.Visible = false
shade.ZIndex = 5
shade.Parent = screen

local workshop = Instance.new("Frame")
workshop.Name = "WorkshopPanel"
workshop.AnchorPoint = Vector2.new(0.5, 0.5)
workshop.Position = UDim2.fromScale(0.5, 0.53)
workshop.Size = UDim2.new(0.92, 0, 0.78, 0)
workshop.BackgroundColor3 = Color3.fromRGB(33, 39, 58)
workshop.Visible = false
workshop.ZIndex = 6
workshop.Parent = screen
corner(workshop, 8)
stroke(workshop, Color3.fromRGB(15, 18, 29))
gradient(workshop, Color3.fromRGB(54, 65, 92), Color3.fromRGB(24, 29, 46))
local workshopConstraint = Instance.new("UISizeConstraint")
workshopConstraint.MaxSize = Vector2.new(760, 590)
workshopConstraint.MinSize = Vector2.new(310, 390)
workshopConstraint.Parent = workshop

local title = textLabel(workshop, "リサイクル工房", UDim2.new(1, -80, 0, 52), UDim2.fromOffset(20, 8), 25, true)
title.TextXAlignment = Enum.TextXAlignment.Left
title.TextColor3 = Color3.new(1, 1, 1)
title.TextStrokeTransparency = 0
local closeButton = button(workshop, "×", UDim2.fromOffset(48, 44), UDim2.new(1, -60, 0, 12))
closeButton.BackgroundColor3 = Color3.fromRGB(255, 70, 78)
closeButton.ZIndex = 7

local recipeList = Instance.new("ScrollingFrame")
recipeList.Name = "RecipeList"
-- 下部の飾り台選択欄と重ならない高さにする。
recipeList.Size = UDim2.new(1, -30, 1, -230)
recipeList.Position = UDim2.fromOffset(15, 66)
recipeList.BackgroundTransparency = 1
recipeList.BorderSizePixel = 0
recipeList.ScrollBarThickness = 8
recipeList.AutomaticCanvasSize = Enum.AutomaticSize.Y
recipeList.CanvasSize = UDim2.new()
recipeList.ZIndex = 7
recipeList.Parent = workshop
local listLayout = Instance.new("UIListLayout")
listLayout.Padding = UDim.new(0, 10)
listLayout.Parent = recipeList

local hint = textLabel(workshop, "作りたいものを選び、かざり台を押してね", UDim2.new(1, -30, 0, 54), UDim2.new(0, 15, 1, -62), 16, true)
hint.ZIndex = 7

local selectedRecipeId: string? = nil
local pendingReplacementSlot: number? = nil
local pendingReplacementRecipeId: string? = nil
local recipeButtons: { [string]: TextButton } = {}
local slotButtons: { TextButton } = {}

local function isDisplayed(recipeId: string): boolean
	for _, displayedRecipeId in state.decorations do
		if displayedRecipeId == recipeId then
			return true
		end
	end
	return false
end

local function nextRecipeToMake(): string?
	for _, recipeId in Recipes.order do
		if state.unlockedRecipes[recipeId] == true and not isDisplayed(recipeId) then
			return recipeId
		end
	end
	return nil
end

local function nextTaskText(): string
	local mission = Missions.order[state.missionStage]
	if mission == nil then
		return "島のきれい度 100%：つぎの島をお楽しみに！"
	end
	for _, materialId in Config.MATERIAL_ORDER do
		local remaining = (mission.collect[materialId] or 0) - (state.missionCollected[materialId] or 0)
		if remaining > 0 then
			return `【{mission.title}】{Config.MATERIALS[materialId].displayName}を あと{remaining}こ ひろおう`
		end
	end
	if mission.craftTarget ~= nil then
		local remainingCrafts = math.max(mission.craftTarget - state.craftedCount, 0)
		return `【{mission.title}】好きな作品を あと{remainingCrafts}こ 作ろう｜きれい度 {state.cleanliness}%`
	end

	local recipeId = nextRecipeToMake()
	if recipeId == nil then
		return "つぎにすること：できた作品を見に行こう！"
	end

	local recipe = Recipes.byId[recipeId]
	for _, materialId in Config.MATERIAL_ORDER do
		local needed = recipe.cost[materialId] or 0
		local owned = state.materials[materialId] or 0
		if owned < needed then
			return `つぎにすること：{Config.MATERIALS[materialId].displayName}を あと{needed - owned}こ ひろおう`
		end
	end

	if not workshop.Visible then
		return "つぎにすること：オレンジの工房へ行こう"
	end
	if recipeId == "BottlePlanter" then
		return "つぎにすること：みどりの「1回でつくる！」を押そう"
	end
	if selectedRecipeId ~= recipeId then
		return `つぎにすること：「{recipe.displayName}」をえらぼう`
	end
	return "つぎにすること：あいている台を1つえらぼう"
end

local goalHighlight = Instance.new("Highlight")
goalHighlight.Name = "GoalHighlight"
goalHighlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
goalHighlight.FillColor = Color3.fromRGB(255, 230, 80)
goalHighlight.FillTransparency = 0.55
goalHighlight.OutlineColor = Color3.fromRGB(255, 255, 255)
goalHighlight.OutlineTransparency = 0
goalHighlight.Enabled = false
goalHighlight.Parent = workspace

local goalBillboard = Instance.new("BillboardGui")
goalBillboard.Name = "GoalBillboard"
goalBillboard.Size = UDim2.fromOffset(120, 42)
goalBillboard.StudsOffset = Vector3.new(0, 4.5, 0)
goalBillboard.AlwaysOnTop = true
goalBillboard.Enabled = false
goalBillboard.Parent = screen
local goalLabel = textLabel(goalBillboard, "▼ ここ！", UDim2.fromScale(1, 1), UDim2.fromScale(0, 0), 20, true)
goalLabel.TextColor3 = Color3.fromRGB(255, 243, 92)
goalLabel.TextStrokeColor3 = Color3.fromRGB(45, 55, 58)
goalLabel.TextStrokeTransparency = 0

local function nearestMaterialNode(materialId: string): BasePart?
	local world = workspace:FindFirstChild("MinijimaWorld")
	local nodes = if world then world:FindFirstChild("MaterialNodes") else nil
	if nodes == nil then
		return nil
	end

	local character = player.Character
	local root = if character then character:FindFirstChild("HumanoidRootPart") else nil
	local nearest: BasePart? = nil
	local nearestDistance = math.huge
	for _, node in nodes:GetChildren() do
		if node:IsA("BasePart") and node:GetAttribute("MaterialId") == materialId then
			local distance = if root and root:IsA("BasePart") then (root.Position - node.Position).Magnitude else 0
			if distance < nearestDistance then
				nearest = node
				nearestDistance = distance
			end
		end
	end
	return nearest
end

local function goalTarget(): BasePart?
	local mission = Missions.order[state.missionStage]
	if mission then
		for _, materialId in Config.MATERIAL_ORDER do
			if (state.missionCollected[materialId] or 0) < (mission.collect[materialId] or 0) then
				return nearestMaterialNode(materialId)
			end
		end
	end
	local recipeId = nextRecipeToMake()
	if recipeId == nil then
		return nil
	end

	local recipe = Recipes.byId[recipeId]
	for _, materialId in Config.MATERIAL_ORDER do
		local needed = recipe.cost[materialId] or 0
		if (state.materials[materialId] or 0) < needed then
			return nearestMaterialNode(materialId)
		end
	end

	if workshop.Visible then
		return nil
	end
	local world = workspace:FindFirstChild("MinijimaWorld")
	local target = if world then world:FindFirstChild("Workshop") else nil
	return if target and target:IsA("BasePart") then target else nil
end

local function refreshGoalMarker()
	local target = goalTarget()
	goalHighlight.Adornee = target
	goalHighlight.Enabled = target ~= nil
	goalBillboard.Adornee = target
	goalBillboard.Enabled = target ~= nil
end

local appliedWorldStage = -1
local appliedCleanliness = -1
local flowerPositions = {
	Vector3.new(-22, 3, 10), Vector3.new(21, 3, 13), Vector3.new(-17, 3, -12),
	Vector3.new(18, 3, -9), Vector3.new(-7, 3, 17), Vector3.new(8, 3, -16),
	Vector3.new(-31, 3, 1), Vector3.new(30, 3, -2), Vector3.new(-5, 3, -4), Vector3.new(6, 3, 7),
}

local function applyWorldProgress()
	if appliedWorldStage == state.missionStage and appliedCleanliness == state.cleanliness then
		return
	end
	local world = workspace:FindFirstChild("MinijimaWorld")
	if world == nil then
		return
	end
	appliedWorldStage = state.missionStage
	appliedCleanliness = state.cleanliness
	local progress = math.clamp(state.cleanliness / 100, 0, 1)
	local island = world:FindFirstChild("Island")
	if island and island:IsA("BasePart") then
		island.Color = Color3.fromRGB(197, 170, 90):Lerp(Color3.fromRGB(72, 223, 105), progress)
	end
	local water = world:FindFirstChild("Water")
	if water and water:IsA("BasePart") then
		water.Color = Color3.fromRGB(68, 160, 210):Lerp(Color3.fromRGB(40, 220, 255), progress)
		water.Transparency = 0.35 - progress * 0.18
	end
	Lighting.ClockTime = if state.missionStage == 3 then 20 else 14
	Lighting.Brightness = 2.0 + progress * 0.6

	local previous = world:FindFirstChild("ClientProgressEffects")
	if previous then
		previous:Destroy()
	end
	local effects = Instance.new("Folder")
	effects.Name = "ClientProgressEffects"
	effects.Parent = world
	local flowerCount = math.min(math.floor(state.cleanliness / 10), #flowerPositions)
	for index = 1, flowerCount do
		local stem = Instance.new("Part")
		stem.Name = `Flower{index}`
		stem.Size = Vector3.new(0.25, 1.2, 0.25)
		stem.Position = flowerPositions[index]
		stem.Color = Color3.fromRGB(55, 145, 66)
		stem.Anchored = true
		stem.CanCollide = false
		stem.Parent = effects
		local bloom = Instance.new("Part")
		bloom.Name = "Bloom"
		bloom.Shape = Enum.PartType.Ball
		bloom.Size = Vector3.new(0.8, 0.8, 0.8)
		bloom.Position = flowerPositions[index] + Vector3.new(0, 0.75, 0)
		bloom.Color = if index % 2 == 0 then Color3.fromRGB(255, 128, 179) else Color3.fromRGB(255, 226, 82)
		bloom.Anchored = true
		bloom.CanCollide = false
		bloom.Parent = effects
	end
end

local confirm = Instance.new("Frame")
confirm.Name = "ReplaceConfirmation"
confirm.AnchorPoint = Vector2.new(0.5, 0.5)
confirm.Position = UDim2.fromScale(0.5, 0.5)
confirm.Size = UDim2.new(0.82, 0, 0, 190)
confirm.BackgroundColor3 = Color3.fromRGB(255, 250, 225)
confirm.Visible = false
confirm.ZIndex = 14
confirm.Parent = workshop
corner(confirm, 16)
stroke(confirm, Color3.fromRGB(222, 142, 49))
local confirmText = textLabel(confirm, "", UDim2.new(1, -30, 0, 88), UDim2.fromOffset(15, 14), 18, true)
confirmText.ZIndex = 15
local confirmYes = button(confirm, "入れかえる", UDim2.new(0.5, -18, 0, 52), UDim2.new(0, 12, 1, -66))
confirmYes.BackgroundColor3 = Color3.fromRGB(222, 109, 65)
confirmYes.ZIndex = 15
local confirmBack = button(confirm, "もどる", UDim2.new(0.5, -18, 0, 52), UDim2.new(0.5, 6, 1, -66))
confirmBack.ZIndex = 15

local function costText(recipeId: string): string
	local pieces = {}
	local recipe = Recipes.byId[recipeId]
	for _, materialId in Config.MATERIAL_ORDER do
		local amount = recipe.cost[materialId] or 0
		if amount > 0 then
			table.insert(pieces, `{Config.MATERIALS[materialId].displayName} {amount}`)
		end
	end
	return table.concat(pieces, " / ")
end

local craftActivity = Instance.new("Frame")
craftActivity.Name = "CraftActivity"
craftActivity.AnchorPoint = Vector2.new(0.5, 0.5)
craftActivity.Position = UDim2.fromScale(0.5, 0.52)
craftActivity.Size = UDim2.new(0.86, 0, 0, 430)
craftActivity.BackgroundColor3 = Color3.fromRGB(255, 252, 232)
craftActivity.Visible = false
craftActivity.ZIndex = 40
craftActivity.Parent = screen
corner(craftActivity, 24)
stroke(craftActivity, Color3.fromRGB(38, 67, 91))
local craftConstraint = Instance.new("UISizeConstraint")
craftConstraint.MaxSize = Vector2.new(720, 430)
craftConstraint.MinSize = Vector2.new(300, 390)
craftConstraint.Parent = craftActivity
local craftTitle = textLabel(craftActivity, "", UDim2.new(1, -100, 0, 56), UDim2.fromOffset(24, 18), 25, true)
craftTitle.ZIndex = 41
local craftClose = button(craftActivity, "×", UDim2.fromOffset(48, 44), UDim2.new(1, -64, 0, 14))
craftClose.ZIndex = 42
local craftInstruction = textLabel(craftActivity, "", UDim2.new(1, -48, 0, 74), UDim2.fromOffset(24, 78), 21, true)
craftInstruction.ZIndex = 41
local craftAction = button(craftActivity, "ここを押す", UDim2.new(1, -80, 0, 88), UDim2.fromOffset(40, 168))
craftAction.BackgroundColor3 = Color3.fromRGB(255, 210, 67)
craftAction.TextSize = 23
craftAction.ZIndex = 42
local craftChoices = Instance.new("Frame")
craftChoices.Size = UDim2.new(1, -60, 0, 72)
craftChoices.Position = UDim2.fromOffset(30, 174)
craftChoices.BackgroundTransparency = 1
craftChoices.ZIndex = 42
craftChoices.Parent = craftActivity
local craftHint = textLabel(craftActivity, "", UDim2.new(1, -48, 0, 48), UDim2.fromOffset(24, 272), 17, true)
craftHint.TextColor3 = Color3.fromRGB(210, 99, 34)
craftHint.Visible = false
craftHint.ZIndex = 42
local craftHelp = button(craftActivity, "？ くわしく", UDim2.fromOffset(150, 48), UDim2.new(0, 24, 1, -66))
craftHelp.ZIndex = 42
local craftDetail = textLabel(craftActivity, "", UDim2.new(1, -210, 0, 58), UDim2.new(0, 190, 1, -72), 15, false)
craftDetail.TextXAlignment = Enum.TextXAlignment.Left
craftDetail.Visible = false
craftDetail.ZIndex = 42

local activeCraftRecipe: string? = nil
local activeCraftSlot: number? = nil
local activeCraftStep = 1
local activeClicks = 0
local activeOrder = 1
local hintGeneration = 0
local actionConnection: RBXScriptConnection? = nil
local timingReady = false
local learnedActivities: { [string]: boolean } = {}
local renderCraftStep: (() -> ())? = nil

local function finishCraftActivity()
	local recipeId = activeCraftRecipe
	local slot = activeCraftSlot
	craftActivity.Visible = false
	shade.Visible = workshop.Visible
	activeCraftRecipe = nil
	activeCraftSlot = nil
	if recipeId and slot then
		requestCraft:FireServer(recipeId, slot)
	end
end

local function advanceCraftStep()
	local recipeId = activeCraftRecipe
	if recipeId == nil then
		return
	end
	local completedSteps = CraftingActivities[recipeId]
	local completedStep = completedSteps and completedSteps[activeCraftStep]
	if completedStep then
		learnedActivities[completedStep.id] = true
	end
	activeCraftStep += 1
	activeClicks = 0
	activeOrder = 1
	local steps = CraftingActivities[recipeId]
	if steps == nil or activeCraftStep > #steps then
		finishCraftActivity()
	elseif renderCraftStep then
		renderCraftStep()
	end
end

renderCraftStep = function()
	local recipeId = activeCraftRecipe
	local steps = if recipeId then CraftingActivities[recipeId] else nil
	local step = steps and steps[activeCraftStep]
	if recipeId == nil or step == nil then
		return
	end
	hintGeneration += 1
	local generation = hintGeneration
	if actionConnection then
		actionConnection:Disconnect()
		actionConnection = nil
	end
	timingReady = false
	craftTitle.Text = `{Recipes.byId[recipeId].displayName}　{activeCraftStep}/{#steps}　{step.title}`
	craftInstruction.Text = step.instruction
	craftHint.Visible = false
	craftDetail.Visible = false
	craftDetail.Text = step.detail
	craftAction.Visible = step.choices == nil
	craftChoices.Visible = step.choices ~= nil
	for _, child in craftChoices:GetChildren() do
		child:Destroy()
	end
	if step.choices then
		for choiceIndex, choiceText in step.choices do
			local choiceButton = button(craftChoices, choiceText, UDim2.new(1 / #step.choices, -8, 1, 0), UDim2.new((choiceIndex - 1) / #step.choices, 4, 0, 0))
			choiceButton.ZIndex = 43
			choiceButton.Activated:Connect(function()
				if step.ordered then
					if choiceIndex ~= activeOrder then
						craftHint.Text = `まず「{step.choices[activeOrder]}」から置こう`
						craftHint.Visible = true
						return
					end
					activeOrder += 1
					choiceButton.BackgroundColor3 = Color3.fromRGB(91, 196, 128)
					if activeOrder <= #step.choices then
						craftInstruction.Text = `つぎは「{step.choices[activeOrder]}」を押そう`
						return
					end
				elseif step.correctChoice and choiceIndex ~= step.correctChoice then
					craftHint.Text = "見本をもう一度見てみよう。材料は減らないよ"
					craftHint.Visible = true
					return
				end
				advanceCraftStep()
			end)
		end
	else
		local requiredClicks = step.clicks or 1
		craftAction.Text = if requiredClicks > 1 then `ここを押す　0/{requiredClicks}` else "光る場所を押す"
		craftAction.BackgroundColor3 = if step.id == "Timing" then Color3.fromRGB(112, 137, 154) else Color3.fromRGB(255, 210, 67)
		actionConnection = craftAction.Activated:Connect(function()
			if generation ~= hintGeneration then
				return
			end
			if step.id == "Timing" and not timingReady then
				craftHint.Text = "まだだよ。黄色く光るまで待とう！"
				craftHint.Visible = true
				return
			end
			activeClicks += 1
			craftAction.Text = `ここを押す　{activeClicks}/{requiredClicks}`
			if activeClicks >= requiredClicks then
				if actionConnection then actionConnection:Disconnect() end
				actionConnection = nil
				advanceCraftStep()
			end
		end)
		if step.id == "Timing" then
			task.spawn(function()
				while craftActivity.Visible and generation == hintGeneration do
					timingReady = false
					craftAction.BackgroundColor3 = Color3.fromRGB(112, 137, 154)
					craftAction.Text = "まだ待ってね…"
					task.wait(1.4)
					if not craftActivity.Visible or generation ~= hintGeneration then break end
					timingReady = true
					craftAction.BackgroundColor3 = Color3.fromRGB(255, 220, 53)
					craftAction.Text = "いま！ 押そう！"
					task.wait(1.8)
				end
		end)
		end
	end
	local hintDelay = if learnedActivities[step.id] then 10 else 6
	task.delay(hintDelay, function()
		if craftActivity.Visible and generation == hintGeneration then
			craftHint.Text = step.autoHint
			craftHint.Visible = true
			TweenService:Create(craftAction, TweenInfo.new(0.35, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, 3, true), { BackgroundColor3 = Color3.fromRGB(255, 238, 124) }):Play()
		end
	end)
end

local function beginCraftActivity(recipeId: string, slot: number)
	if CraftingActivities[recipeId] == nil then
		requestCraft:FireServer(recipeId, slot)
		return
	end
	activeCraftRecipe = recipeId
	activeCraftSlot = slot
	activeCraftStep = 1
	activeClicks = 0
	activeOrder = 1
	craftActivity.Visible = true
	shade.Visible = true
	if renderCraftStep then renderCraftStep() end
end

craftHelp.Activated:Connect(function()
	craftDetail.Visible = not craftDetail.Visible
end)
craftClose.Activated:Connect(function()
	hintGeneration += 1
	if actionConnection then actionConnection:Disconnect() end
	actionConnection = nil
	craftActivity.Visible = false
	shade.Visible = workshop.Visible
	activeCraftRecipe = nil
	activeCraftSlot = nil
end)

for _, recipeId in Recipes.order do
	local recipe = Recipes.byId[recipeId]
	local card = button(recipeList, "", UDim2.new(1, -10, 0, 72), UDim2.new())
	card.Name = recipeId
	card.TextXAlignment = Enum.TextXAlignment.Left
	card.TextWrapped = true
	card.ZIndex = 8
	card.BackgroundColor3 = recipe.color
	card.Activated:Connect(function()
		if state.unlockedRecipes[recipeId] then
			selectedRecipeId = recipeId
			nextTaskLabel.Text = nextTaskText()
			showToast(`「{recipe.displayName}」を選んだよ。下のかざり台を選ぼう！`)
		else
			showToast("ひとつ前のレシピを作ると開くよ")
		end
	end)
	recipeButtons[recipeId] = card
end

local slotBar = Instance.new("Frame")
slotBar.Size = UDim2.new(1, -30, 0, 58)
slotBar.Position = UDim2.new(0, 15, 1, -122)
slotBar.BackgroundTransparency = 1
slotBar.ZIndex = 8
slotBar.Parent = workshop
local slotHeading = textLabel(workshop, "▼ かざり台を選ぼう", UDim2.new(1, -30, 0, 30), UDim2.new(0, 15, 1, -158), 17, true)
slotHeading.TextColor3 = Color3.fromRGB(39, 91, 115)
slotHeading.ZIndex = 9
for slot = 1, Config.DECORATION_SLOTS do
	local slotButton = button(slotBar, `台 {slot}`, UDim2.new(1 / 3, -8, 1, 0), UDim2.new((slot - 1) / 3, 4, 0, 0))
	slotButton.ZIndex = 9
	slotButton.Activated:Connect(function()
		if selectedRecipeId == nil then
			showToast("先にレシピを選んでね")
			return
		end
		local existing = state.decorations[slot]
		if existing ~= "" and Recipes.byId[existing] then
			pendingReplacementSlot = slot
			pendingReplacementRecipeId = selectedRecipeId
			confirmText.Text = `台{slot}の「{Recipes.byId[existing].displayName}」と入れかえる？\n材料は「入れかえる」を押した時だけ使うよ。`
			confirm.Visible = true
			return
		end
		beginCraftActivity(selectedRecipeId, slot)
	end)
	table.insert(slotButtons, slotButton)
end

local quickCraft = button(workshop, "1回でつくる！", UDim2.new(1, -30, 0, 64), UDim2.new(0, 15, 1, -128))
quickCraft.Name = "QuickFirstCraft"
quickCraft.TextSize = 21
quickCraft.ZIndex = 10
quickCraft.Visible = false

local function hasMaterials(recipeId: string): boolean
	local recipe = Recipes.byId[recipeId]
	for _, materialId in Config.MATERIAL_ORDER do
		if (state.materials[materialId] or 0) < (recipe.cost[materialId] or 0) then
			return false
		end
	end
	return true
end

local function firstEmptySlot(): number
	for slot = 1, Config.DECORATION_SLOTS do
		if state.decorations[slot] == "" then
			return slot
		end
	end
	return 1
end

quickCraft.Activated:Connect(function()
	if isDisplayed("BottlePlanter") then
		return
	end
	if not hasMaterials("BottlePlanter") then
		showToast("木のかけら1こ・プラスチック1こを集めよう")
		return
	end
	selectedRecipeId = "BottlePlanter"
	beginCraftActivity("BottlePlanter", firstEmptySlot())
end)

confirmYes.Activated:Connect(function()
	local slot = pendingReplacementSlot
	local recipeId = pendingReplacementRecipeId
	confirm.Visible = false
	pendingReplacementSlot = nil
	pendingReplacementRecipeId = nil
	if slot and recipeId then
		beginCraftActivity(recipeId, slot)
	end
end)

confirmBack.Activated:Connect(function()
	confirm.Visible = false
	pendingReplacementSlot = nil
	pendingReplacementRecipeId = nil
end)

local tutorial = Instance.new("Frame")
tutorial.Name = "Tutorial"
tutorial.AnchorPoint = Vector2.new(0.5, 0.5)
tutorial.Position = UDim2.fromScale(0.5, 0.54)
tutorial.Size = UDim2.new(0.88, 0, 0, 310)
tutorial.BackgroundColor3 = Color3.fromRGB(250, 248, 235)
tutorial.Visible = false
tutorial.ZIndex = 12
tutorial.Parent = screen
corner(tutorial, 18)
stroke(tutorial)
gradient(tutorial, Color3.fromRGB(255, 255, 255), Color3.fromRGB(232, 247, 255))
local tutorialConstraint = Instance.new("UISizeConstraint")
tutorialConstraint.MaxSize = Vector2.new(560, 310)
tutorialConstraint.MinSize = Vector2.new(300, 310)
tutorialConstraint.Parent = tutorial

local tutorialTitle = textLabel(tutorial, "", UDim2.new(1, -40, 0, 60), UDim2.fromOffset(20, 25), 26, true)
tutorialTitle.ZIndex = 13
local tutorialBody = textLabel(tutorial, "", UDim2.new(1, -50, 0, 125), UDim2.fromOffset(25, 90), 20, false)
tutorialBody.ZIndex = 13
local tutorialNext = button(tutorial, "つぎへ", UDim2.new(1, -50, 0, 54), UDim2.new(0, 25, 1, -75))
tutorialNext.ZIndex = 13

local tutorialPage = 1
local tutorialPages = {
	{ "1. 落とし物を拾う", "画面の「つぎにすること」を見よう。\n黄色く光る落とし物に近づいて、トングで拾おう！" },
	{ "2. 工房で工作する", "オレンジ色の工房へ行こう。\n最初の工作は、緑のボタンを1回押すだけ！" },
	{ "3. 島に作品を飾る", "完成した作品は黄色い台に飾られるよ。\n次からは好きな台を選べるよ！" },
	{ "4. ミッションを進める", "島をきれいにすると、新しい場所やレシピが開くよ。\n失敗しても材料はなくならないから安心してね。" },
	{ "5. 素材・マーク図鑑", "🪵 丸太＝木のかけら　🧴 ボトル＝プラスチック\n🥫 空き缶＝金属　🏭 オレンジ＝工房　🟨 黄色い台＝展示場所" },
}

local function showTutorial(page: number)
	tutorialPage = page
	local content = tutorialPages[page]
	tutorialTitle.Text = content[1]
	tutorialBody.Text = content[2]
	tutorialNext.Text = if page == #tutorialPages then "やってみよう！" else "つぎへ"
	shade.Visible = true
	tutorial.Visible = true
end

local lastTutorialAdvance = 0
local function advanceTutorial()
	local now = os.clock()
	if now - lastTutorialAdvance < 0.25 or not tutorial.Visible then
		return
	end
	lastTutorialAdvance = now
	if tutorialPage < #tutorialPages then
		showTutorial(tutorialPage + 1)
	else
		tutorial.Visible = false
		shade.Visible = workshop.Visible
		tutorialComplete:FireServer()
	end
end

tutorialNext.Activated:Connect(advanceTutorial)
tutorialNext.MouseButton1Click:Connect(advanceTutorial)
UserInputService.InputBegan:Connect(function(input, gameProcessed)
	if gameProcessed or not tutorial.Visible then
		return
	end
	if input.KeyCode == Enum.KeyCode.Return
		or input.KeyCode == Enum.KeyCode.Space
		or input.KeyCode == Enum.KeyCode.N
	then
		advanceTutorial()
	end
end)

helpButton.Activated:Connect(function()
	showTutorial(1)
end)

local function setWorkshopVisible(visible: boolean)
	workshop.Visible = visible
	shade.Visible = visible
	if visible and not isDisplayed("BottlePlanter") then
		selectedRecipeId = "BottlePlanter"
	end
	nextTaskLabel.Text = nextTaskText()
	refreshGoalMarker()
	applyWorldProgress()
end

closeButton.Activated:Connect(function()
	confirm.Visible = false
	pendingReplacementSlot = nil
	pendingReplacementRecipeId = nil
	setWorkshopVisible(false)
end)

local function unlockedAreaCount(): number
	local count = 0
	for _, area in WorldContent.areas do
		if state.missionStage >= area.unlockStage then
			count += 1
		end
	end
	return count
end

local function discoveredSecretCount(): number
	local count = 0
	for _, discovered in state.discoveredSecrets do
		if discovered then
			count += 1
		end
	end
	return count
end

local function refreshWorldStatus()
	local world = workspace:FindFirstChild("MinijimaWorld")
	local environmentName = if world then world:GetAttribute("EnvironmentName") else nil
	local area = WorldContent.areaById[state.lastArea]
	local areaName = if area then area.name else "はじまりの広場"
	local weatherIcon = if type(environmentName) == "string" and string.find(environmentName, "夜", 1, true) then "🌙" else "☀️"
	worldStatusLabel.Text = `📍 {areaName}　{weatherIcon}　🗺 {unlockedAreaCount()}/16　🌱 {state.cleanliness}%`
end

local function refresh()
	for _, materialId in Config.MATERIAL_ORDER do
		materialLabels[materialId].Text = tostring(state.materials[materialId] or 0)
	end
	refreshWorldStatus()

	for _, recipeId in Recipes.order do
		local recipe = Recipes.byId[recipeId]
		local unlocked = state.unlockedRecipes[recipeId] == true
		local buttonValue = recipeButtons[recipeId]
		buttonValue.Text = if unlocked
			then `  {recipe.displayName}\n  {costText(recipeId)}`
			else `  🔒 まだひみつのレシピ`
		buttonValue.BackgroundTransparency = if unlocked then 0 else 0.55
	end

	for slot, slotButton in slotButtons do
		local recipeId = state.decorations[slot]
		local recipe = if recipeId ~= "" then Recipes.byId[recipeId] else nil
		slotButton.Text = if recipe then `台 {slot}\n{recipe.displayName}` else `台 {slot}\nあき`
	end

	-- 初回も置き場所を自分で選べるよう、飾り台を常に表示する。
	-- 旧「1回でつくる」ボタンは飾り台と同じ位置に重なるため非表示にする。
	quickCraft.Visible = false
	slotBar.Visible = true
	hint.Text = "作りたいものを選び、下のかざり台を押してね"

	nextTaskLabel.Text = nextTaskText()
	refreshGoalMarker()
	applyWorldProgress()
end

local function applyResponsiveLayout()
	local camera = workspace.CurrentCamera
	local viewportWidth = if camera then camera.ViewportSize.X else 1024
	local viewportHeight = if camera then camera.ViewportSize.Y else 768
	local compact = viewportWidth < 700 or viewportHeight < 600

	hud.Position = UDim2.fromScale(0.5, if compact then 0.012 else 0.025)
	hud.Size = UDim2.new(if compact then 0.94 else 0.88, 0, 0, if compact then 52 else 68)
	hudConstraint.MaxSize = Vector2.new(if compact then 520 else 620, if compact then 52 else 68)
	hudConstraint.MinSize = Vector2.new(280, if compact then 52 else 68)

	nextTask.Position = UDim2.fromScale(0.5, if compact then 0.085 else 0.115)
	nextTask.Size = UDim2.new(if compact then 0.9 else 0.82, 0, 0, if compact then 46 else 58)
	nextTaskConstraint.MaxSize = Vector2.new(if compact then 520 else 560, if compact then 46 else 58)
	nextTaskConstraint.MinSize = Vector2.new(270, if compact then 46 else 58)
	nextTaskLabel.TextSize = if compact then 15 else 18
	worldStatus.Position = UDim2.fromScale(0.5, if compact then 0.145 else 0.19)
	worldStatus.Size = UDim2.new(if compact then 0.94 else 0, if compact then 0 else 720, 0, if compact then 48 else 46)
	worldStatusLabel.TextSize = if compact then 12 else 14

	for _, labelValue in materialLabels do
		labelValue.TextSize = if compact then 13 else 16
	end

	helpButton.Size = if compact then UDim2.fromOffset(112, 40) else UDim2.fromOffset(140, 48)
	helpButton.Position = if compact then UDim2.fromOffset(10, 140) else UDim2.new(0, 18, 1, -66)
	helpButton.TextSize = if compact then 15 else 18
	toast.Size = if compact then UDim2.new(0.9, 0, 0, 52) else UDim2.fromOffset(440, 58)
	toast.Position = UDim2.fromScale(0.5, if compact then 0.155 else 0.2)
	toast.TextSize = if compact then 16 else 20
end

local viewportConnection: RBXScriptConnection? = nil
local function connectResponsiveCamera()
	if viewportConnection then
		viewportConnection:Disconnect()
		viewportConnection = nil
	end
	local camera = workspace.CurrentCamera
	if camera then
		viewportConnection = camera:GetPropertyChangedSignal("ViewportSize"):Connect(applyResponsiveLayout)
	end
	applyResponsiveLayout()
end

workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(connectResponsiveCamera)
connectResponsiveCamera()
task.delay(0.5, applyResponsiveLayout)
task.delay(1.5, applyResponsiveLayout)

stateUpdated.OnClientEvent:Connect(function(nextState: ClientState)
	local gains: { [string]: number } = {}
	for _, materialId in Config.MATERIAL_ORDER do
		local gain = (nextState.materials[materialId] or 0) - (state.materials[materialId] or 0)
		if gain > 0 then
			gains[materialId] = gain
		end
	end
	state = nextState
	refresh()
	for materialId, gain in gains do
		playMaterialGain(materialId, gain)
	end
end)

notifyRemote.OnClientEvent:Connect(function(message: string)
	showToast(message)
	if string.find(message, "ミッション達成！", 1, true) then
		playAnimeCelebration()
	end
end)

feedbackRemote.OnClientEvent:Connect(function(payload: any)
	if type(payload) ~= "table" or type(payload.kind) ~= "string" then
		return
	end
	if payload.kind == "Material" then
		rewardBannerVersion += 1
		local version = rewardBannerVersion
		local rarityPrefix = if payload.rarity ~= "ふつう" then `★ {payload.rarity}！ ` else ""
		local progressText = if payload.remaining > 0 then `「{payload.missionTitle}」まであと{payload.remaining}こ` else "必要な数がそろった！ 工房へ行こう！"
		rewardBannerText.Text = `{rarityPrefix}{payload.name} ＋{payload.amount}\n{progressText}`
		rewardBanner.BackgroundColor3 = if payload.rarity == "伝説" then Color3.fromRGB(255, 143, 236) elseif payload.rarity == "すごくめずらしい" then Color3.fromRGB(205, 158, 255) elseif payload.rarity == "めずらしい" then Color3.fromRGB(255, 232, 116) else Color3.fromRGB(210, 250, 225)
		rewardBanner.Position = UDim2.fromScale(0.5, 0.32)
		rewardBanner.Visible = true
		TweenService:Create(rewardBanner, TweenInfo.new(0.3, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Position = UDim2.fromScale(0.5, 0.25) }):Play()
		task.delay(5, function()
			if rewardBannerVersion == version then rewardBanner.Visible = false end
		end)
	elseif payload.kind == "CraftComplete" or payload.kind == "MissionComplete" then
		table.insert(eventQueue, payload)
		if showNextFeedback then showNextFeedback() end
	end
end)

local lastNearbyPrompt: ProximityPrompt? = nil
ProximityPromptService.PromptShown:Connect(function(prompt)
	if prompt.Name == "Collect" and prompt ~= lastNearbyPrompt then
		lastNearbyPrompt = prompt
		local target = prompt.Parent
		local materialId = target and target:GetAttribute("MaterialId")
		local rarity = target and target:GetAttribute("Rarity")
		if type(materialId) == "string" and Config.MATERIALS[materialId] then
			local rarityText = if type(rarity) == "string" and rarity ~= "ふつう" then `★{rarity}の` else ""
			showToast(`近くに{rarityText}{Config.MATERIALS[materialId].displayName}！ Eキー／タップで拾おう`)
		end
	end
end)
ProximityPromptService.PromptHidden:Connect(function(prompt)
	if prompt == lastNearbyPrompt then lastNearbyPrompt = nil end
end)
openWorkshopRemote.OnClientEvent:Connect(function()
	setWorkshopVisible(true)
end)

player.CharacterAdded:Connect(function()
	task.defer(refreshGoalMarker)
end)

task.spawn(function()
	local world = workspace:WaitForChild("MinijimaWorld", 10)
	if world then
		world:GetAttributeChangedSignal("EnvironmentName"):Connect(refreshWorldStatus)
		world:WaitForChild("MaterialNodes", 5)
		refreshGoalMarker()
		appliedWorldStage = -1
		appliedCleanliness = -1
		applyWorldProgress()
	end
end)

task.spawn(function()
	while screen.Parent do
		task.wait(2)
		local character = player.Character
		local root = character and character:FindFirstChild("HumanoidRootPart")
		if root and root:IsA("BasePart") then
			local nearestId: string? = nil
			local nearestDistance = math.huge
			for _, area in WorldContent.areas do
				local distance = (Vector3.new(root.Position.X, 0, root.Position.Z) - Vector3.new(area.center.X, 0, area.center.Z)).Magnitude
				if distance < nearestDistance and distance <= math.max(area.size.X, area.size.Z) * 0.65 then
					nearestDistance = distance
					nearestId = area.id
				end
			end
			if nearestId and nearestId ~= state.lastArea then
				areaVisitedRemote:FireServer(nearestId)
			end
		end
	end
end)

local ok, initialState = pcall(function()
	return fetchState:InvokeServer()
end)
if ok and type(initialState) == "table" then
	state = initialState :: ClientState
end
refresh()
if not state.persistenceAvailable then
	showToast("このテストではセーブできません。終了すると進み具合が消えます")
end
if not state.tutorialComplete then
	showTutorial(1)
end
