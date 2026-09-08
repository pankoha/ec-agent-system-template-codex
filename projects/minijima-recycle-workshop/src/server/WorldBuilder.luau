--!strict

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local ServerStorage = game:GetService("ServerStorage")
local TweenService = game:GetService("TweenService")

local Config = require(ReplicatedStorage.Shared.Config)
local Recipes = require(ReplicatedStorage.Shared.Recipes)
local WorldContent = require(ReplicatedStorage.Shared.WorldContent)

local WorldBuilder = {}

local VIVID = {
	Lime = Color3.fromRGB(103, 255, 31),
	Red = Color3.fromRGB(255, 62, 67),
	Cyan = Color3.fromRGB(46, 205, 255),
	Yellow = Color3.fromRGB(255, 225, 47),
	Purple = Color3.fromRGB(173, 79, 255),
	Dark = Color3.fromRGB(37, 43, 67),
}

local function animeOutline(target: Instance)
	local value = Instance.new("Highlight")
	value.Name = "AnimeOutline"
	value.Adornee = target
	value.FillTransparency = 1
	value.OutlineColor = Color3.fromRGB(30, 52, 84)
	value.OutlineTransparency = 0.08
	value.DepthMode = Enum.HighlightDepthMode.Occluded
	value.Parent = target
end

local function configureAnimeLighting()
	Lighting.Brightness = 2.65
	Lighting.Ambient = Color3.fromRGB(143, 164, 210)
	Lighting.OutdoorAmbient = Color3.fromRGB(177, 196, 235)
	Lighting.EnvironmentDiffuseScale = 0.78
	Lighting.EnvironmentSpecularScale = 1
	Lighting.ShadowSoftness = 0.12
	Lighting.ClockTime = 14

	for _, name in { "AnimeColor", "AnimeBloom", "AnimeSunRays", "AnimeAtmosphere" } do
		local previous = Lighting:FindFirstChild(name)
		if previous then
			previous:Destroy()
		end
	end
	local color = Instance.new("ColorCorrectionEffect")
	color.Name = "AnimeColor"
	color.Brightness = 0.035
	color.Contrast = 0.18
	color.Saturation = 0.38
	color.TintColor = Color3.fromRGB(255, 250, 244)
	color.Parent = Lighting
	local bloom = Instance.new("BloomEffect")
	bloom.Name = "AnimeBloom"
	bloom.Intensity = 0.46
	bloom.Size = 32
	bloom.Threshold = 0.88
	bloom.Parent = Lighting
	local rays = Instance.new("SunRaysEffect")
	rays.Name = "AnimeSunRays"
	rays.Intensity = 0.11
	rays.Spread = 0.82
	rays.Parent = Lighting
	local atmosphere = Instance.new("Atmosphere")
	atmosphere.Name = "AnimeAtmosphere"
	atmosphere.Color = Color3.fromRGB(194, 232, 255)
	atmosphere.Decay = Color3.fromRGB(112, 153, 205)
	atmosphere.Density = 0.16
	atmosphere.Glare = 0.16
	atmosphere.Haze = 0.7
	atmosphere.Parent = Lighting
end

local function part(parent: Instance, name: string, size: Vector3, position: Vector3, color: Color3, material: Enum.Material?): Part
	local value = Instance.new("Part")
	value.Name = name
	value.Size = size
	value.Position = position
	value.Color = color
	value.Material = material or Enum.Material.SmoothPlastic
	value.Anchored = true
	value.TopSurface = Enum.SurfaceType.Smooth
	value.BottomSurface = Enum.SurfaceType.Smooth
	value.Parent = parent
	return value
end

local function label(target: BasePart, text: string, maxDistance: number?)
	local gui = Instance.new("BillboardGui")
	gui.Name = "Label"
	gui.Size = UDim2.fromOffset(240, 52)
	gui.StudsOffset = Vector3.new(0, target.Size.Y / 2 + 2, 0)
	gui.AlwaysOnTop = true
	gui.MaxDistance = maxDistance or 30
	gui.Parent = target

	local box = Instance.new("TextLabel")
	box.Size = UDim2.fromScale(1, 1)
	box.BackgroundColor3 = Color3.fromRGB(22, 36, 44)
	box.BackgroundTransparency = 0.12
	box.TextColor3 = Color3.new(1, 1, 1)
	box.Font = Enum.Font.GothamBold
	box.TextSize = 20
	box.Text = text
	box.Parent = gui
	Instance.new("UICorner", box).CornerRadius = UDim.new(0, 12)
end

local function materialDetail(parent: BasePart, name: string, size: Vector3, offset: Vector3, color: Color3, material: Enum.Material?): Part
	local value = part(parent, name, size, parent.Position + offset, color, material)
	value.CanCollide = false
	return value
end

local function addVividPad(parent: Instance, name: string, position: Vector3, color: Color3, diameter: number): Part
	local pad = part(parent, name, Vector3.new(0.5, diameter, diameter), position, color, Enum.Material.Neon)
	pad.Shape = Enum.PartType.Cylinder
	pad.Orientation = Vector3.new(0, 0, 90)
	pad.Transparency = 0.06
	local light = Instance.new("PointLight")
	light.Name = "PadGlow"
	light.Color = color
	light.Brightness = 1.25
	light.Range = diameter * 1.35
	light.Parent = pad
	local sparkles = Instance.new("Sparkles")
	sparkles.Name = "ColorSparkles"
	sparkles.SparkleColor = color:Lerp(Color3.new(1, 1, 1), 0.4)
	sparkles.Parent = pad
	return pad
end

local function buildVividAreaAccents(parent: Instance, center: Vector3, size: Vector3, areaId: string)
	local accents = Instance.new("Folder")
	accents.Name = "VividColorAccents"
	accents.Parent = parent
	local floorY = center.Y + size.Y / 2 + 0.28
	local mainPath = part(accents, "RedMainPath", Vector3.new(12, 0.5, math.max(24, size.Z * 0.78)), Vector3.new(center.X, floorY, center.Z), VIVID.Red, Enum.Material.SmoothPlastic)
	mainPath.TopSurface = Enum.SurfaceType.Studs
	local crossPath = part(accents, "CyanCrossPath", Vector3.new(math.max(28, size.X * 0.62), 0.46, 9), Vector3.new(center.X, floorY + 0.03, center.Z), VIVID.Cyan, Enum.Material.SmoothPlastic)
	crossPath.TopSurface = Enum.SurfaceType.Studs
	local padColors = { VIVID.Lime, VIVID.Yellow, VIVID.Purple }
	for index, color in padColors do
		local x = center.X + (index - 2) * math.min(16, size.X * 0.18)
		local z = center.Z + math.min(13, size.Z * 0.18)
		local pad = addVividPad(accents, `RewardPad{index}`, Vector3.new(x, floorY + 0.32, z), color, 6.5)
		pad:SetAttribute("AreaId", areaId)
	end
	local beacon = part(accents, "ColorBeacon", Vector3.new(2.4, 7, 2.4), Vector3.new(center.X - size.X * 0.35, floorY + 3.5, center.Z - size.Z * 0.3), VIVID.Yellow, Enum.Material.Neon)
	beacon.Shape = Enum.PartType.Ball
	beacon.CanCollide = false
	local beaconLight = Instance.new("PointLight")
	beaconLight.Color = VIVID.Yellow
	beaconLight.Brightness = 2
	beaconLight.Range = 18
	beaconLight.Parent = beacon
end

local function shapeMaterialNode(node: Part, materialId: string)
	if materialId == "Wood" then
		node.Name = node.Name .. "_Log"
		node.Shape = Enum.PartType.Cylinder
		node.Size = Vector3.new(4.2, 1.7, 1.7)
		node.Material = Enum.Material.Wood
		local endColor = Color3.fromRGB(205, 157, 98)
		materialDetail(node, "CutEndLeft", Vector3.new(0.12, 1.72, 1.72), Vector3.new(-2.12, 0, 0), endColor, Enum.Material.Wood)
		materialDetail(node, "CutEndRight", Vector3.new(0.12, 1.72, 1.72), Vector3.new(2.12, 0, 0), endColor, Enum.Material.Wood)
	elseif materialId == "Plastic" then
		node.Name = node.Name .. "_Bottle"
		node.Shape = Enum.PartType.Cylinder
		node.Size = Vector3.new(3.2, 1.8, 1.8)
		node.Orientation = Vector3.new(0, 0, 90)
		node.Material = Enum.Material.SmoothPlastic
		local neck = materialDetail(node, "BottleNeck", Vector3.new(0.8, 1.05, 1.05), Vector3.new(0, 1.95, 0), node.Color)
		neck.Shape = Enum.PartType.Cylinder
		neck.Orientation = node.Orientation
		local cap = materialDetail(node, "BottleCap", Vector3.new(0.45, 1.16, 1.16), Vector3.new(0, 2.55, 0), Color3.fromRGB(40, 105, 180))
		cap.Shape = Enum.PartType.Cylinder
		cap.Orientation = node.Orientation
	elseif materialId == "Metal" then
		node.Name = node.Name .. "_Can"
		node.Shape = Enum.PartType.Cylinder
		node.Size = Vector3.new(2.8, 2.4, 2.4)
		node.Orientation = Vector3.new(0, 0, 90)
		node.Material = Enum.Material.Metal
		local rimColor = Color3.fromRGB(220, 226, 232)
		local topRim = materialDetail(node, "TopRim", Vector3.new(0.18, 2.52, 2.52), Vector3.new(0, 1.49, 0), rimColor, Enum.Material.Metal)
		topRim.Shape = Enum.PartType.Cylinder
		topRim.Orientation = node.Orientation
		local bottomRim = materialDetail(node, "BottomRim", Vector3.new(0.18, 2.52, 2.52), Vector3.new(0, -1.49, 0), rimColor, Enum.Material.Metal)
		bottomRim.Shape = Enum.PartType.Cylinder
		bottomRim.Orientation = node.Orientation
	end
end

local function applyMaterialRarity(node: Part, seed: number)
	local rarity = "ふつう"
	local bonus = 1
	local outlineColor = Color3.fromRGB(30, 52, 84)
	if seed % 29 == 0 then
		rarity = "伝説"
		bonus = 3
		outlineColor = Color3.fromRGB(255, 91, 224)
	elseif seed % 13 == 0 then
		rarity = "すごくめずらしい"
		bonus = 2
		outlineColor = Color3.fromRGB(174, 91, 255)
	elseif seed % 7 == 0 then
		rarity = "めずらしい"
		bonus = 2
		outlineColor = Color3.fromRGB(255, 209, 54)
	end
	node:SetAttribute("Rarity", rarity)
	node:SetAttribute("BonusAmount", bonus)
	if rarity ~= "ふつう" then
		local outline = node:FindFirstChild("AnimeOutline")
		if outline and outline:IsA("Highlight") then
			outline.OutlineColor = outlineColor
			outline.FillColor = outlineColor
			outline.FillTransparency = 0.72
		end
		local light = Instance.new("PointLight")
		light.Name = "RareGlow"
		light.Color = outlineColor
		light.Brightness = if rarity == "伝説" then 3 else 1.8
		light.Range = if rarity == "伝説" then 18 else 11
		light.Parent = node
		label(node, `★ {rarity}`, 20)
	end
end

local function makeRoundedIsland(ground: Part, originalSize: Vector3)
	ground.Shape = Enum.PartType.Cylinder
	ground.Size = Vector3.new(originalSize.Y, originalSize.X, originalSize.Z)
	ground.Orientation = Vector3.new(0, 0, 90)
end

local function buildEcoGuide(world: Folder)
	-- Blenderからインポートした高品質モデルがあれば、基本パーツ版より優先する。
	local preferredV3 = workspace:FindFirstChild("EcoBotRainbowStarV3")
	local preferredV2 = workspace:FindFirstChild("EcoBotRainbowStarV2")
	local importedTemplate: Model? = if preferredV3 and preferredV3:IsA("Model")
		then preferredV3
		elseif preferredV2 and preferredV2:IsA("Model") then preferredV2
		else nil
	for _, child in workspace:GetChildren() do
		local isImportedEcoBot = child:IsA("Model") and (string.find(child.Name, "EcoBotRainbowStar", 1, true) == 1 or (child.Name == "Scene" and child:FindFirstChild("StarArmor_1", true) ~= nil))
		if child:IsA("Model") and isImportedEcoBot then
			if importedTemplate == nil then
				importedTemplate = child
			elseif child ~= importedTemplate then
				child.Parent = ServerStorage
			end
		end
	end
	if importedTemplate then
		local preserveImportedAppearance = importedTemplate.Name == "EcoBotRainbowStarV3"
		local guide = Instance.new("Model")
		guide.Name = "EcoGuide"
		guide.Parent = world
		local visual = importedTemplate:Clone()
		visual.Name = "HighQuality3DVisual"
		visual.Parent = guide
		importedTemplate.Parent = ServerStorage
		local size = visual:GetExtentsSize()
		local largest = math.max(size.X, size.Y, size.Z)
		if largest > 0 then
			visual:ScaleTo(12 / largest)
		end
		for _, descendant in visual:GetDescendants() do
			if descendant:IsA("BasePart") then
				descendant.Anchored = true
				descendant.CanCollide = false
				descendant.CastShadow = true
				if not preserveImportedAppearance then
					local name = descendant.Name .. " " .. (if descendant.Parent then descendant.Parent.Name else "")
					local color = Color3.fromRGB(80, 174, 230)
				if string.find(name, "StarArmor_1", 1, true) then color = Color3.fromRGB(255, 47, 69)
				elseif string.find(name, "StarArmor_2", 1, true) then color = Color3.fromRGB(255, 149, 35)
				elseif string.find(name, "StarArmor_3", 1, true) then color = Color3.fromRGB(55, 205, 103)
				elseif string.find(name, "StarArmor_4", 1, true) then color = Color3.fromRGB(37, 132, 239)
				elseif string.find(name, "StarArmor_5", 1, true) then color = Color3.fromRGB(142, 73, 227)
				elseif string.find(name, "FacePlate", 1, true) or string.find(name, "SmileCut", 1, true) or string.find(name, "EyeShine", 1, true) or string.find(name, "RecycleArrow", 1, true) then color = Color3.fromRGB(244, 248, 244)
				elseif string.find(name, "Eye_", 1, true) then color = Color3.fromRGB(17, 15, 36)
				elseif string.find(name, "Iris_", 1, true) then color = Color3.fromRGB(91, 43, 151)
				elseif string.find(name, "Cheek", 1, true) or name == "Smile" then color = Color3.fromRGB(255, 84, 134)
				elseif string.find(name, "LeftBoot", 1, true) or string.find(name, "LeftCuff", 1, true) then color = Color3.fromRGB(255, 137, 32)
				elseif string.find(name, "RightBoot", 1, true) then color = Color3.fromRGB(126, 64, 210)
				elseif string.find(name, "RightCuff", 1, true) then color = Color3.fromRGB(255, 215, 56)
				elseif string.find(name, "RightUpperArm", 1, true) then color = Color3.fromRGB(43, 197, 104)
				elseif string.find(name, "Hand", 1, true) or string.find(name, "Finger", 1, true) or string.find(name, "LeftUpperArm", 1, true) then color = Color3.fromRGB(40, 196, 215)
				elseif string.find(name, "Sole", 1, true) or string.find(name, "Rivet", 1, true) then color = Color3.fromRGB(57, 67, 79)
				elseif string.find(name, "ToePanel", 1, true) then color = if string.find(name, "Left", 1, true) then Color3.fromRGB(255, 215, 58) else Color3.fromRGB(245, 57, 79)
				elseif string.find(name, "BadgeDisk", 1, true) or string.find(name, "BodyCore", 1, true) then color = Color3.fromRGB(35, 135, 227)
				end
					descendant.Color = color
					descendant.Material = if string.find(name, "Sole", 1, true) or string.find(name, "Rivet", 1, true) then Enum.Material.Metal else Enum.Material.SmoothPlastic
				end
			end
		end
		visual:PivotTo(CFrame.new(-11, 7.2, 18) * CFrame.Angles(0, math.rad(180), 0))
		local body = part(guide, "Body", Vector3.new(6, 9, 3), Vector3.new(-11, 7.2, 18), Color3.new(1, 1, 1), Enum.Material.SmoothPlastic)
		body.Transparency = 1
		body.CanCollide = false
		guide.PrimaryPart = body
		label(body, "★ エコロボ　島をいっしょに元気にしよう！", 35)
		local prompt = Instance.new("ProximityPrompt")
		prompt.Name = "TalkToEcoGuide"
		prompt.ActionText = "話す"
		prompt.ObjectText = "エコロボ"
		prompt.MaxActivationDistance = 12
		prompt.RequiresLineOfSight = false
		prompt.Parent = body
		local start = guide:GetPivot()
		task.spawn(function()
			while guide.Parent do
				guide:PivotTo(start + Vector3.new(0, 0.35, 0))
				task.wait(0.75)
				if guide.Parent == nil then break end
				guide:PivotTo(start)
				task.wait(0.75)
			end
		end)
		return
	end

	local guide = Instance.new("Model")
	guide.Name = "EcoGuide"
	guide.Parent = world
	local center = Vector3.new(-11, 8, 18)
	local body = part(guide, "Body", Vector3.new(6.3, 6.3, 3.4), center, Color3.fromRGB(54, 181, 238), Enum.Material.SmoothPlastic)
	body.Shape = Enum.PartType.Ball
	guide.PrimaryPart = body

	-- 虹色の星型シルエット。遠くからでも案内役だと分かる大きさにする。
	local rayColors = {
		Color3.fromRGB(255, 87, 103),
		Color3.fromRGB(255, 174, 58),
		Color3.fromRGB(255, 226, 74),
		Color3.fromRGB(81, 213, 128),
		Color3.fromRGB(113, 105, 237),
	}
	local rayOffsets = {
		Vector3.new(0, 4.5, 0.3),
		Vector3.new(4.1, 1.3, 0.3),
		Vector3.new(2.6, -3.7, 0.3),
		Vector3.new(-2.6, -3.7, 0.3),
		Vector3.new(-4.1, 1.3, 0.3),
	}
	local rayAngles = { 0, -72, -144, 144, 72 }
	for index, offset in rayOffsets do
		local ray = part(guide, `StarRay{index}`, Vector3.new(3.1, 5.2, 2.7), center + offset, rayColors[index], Enum.Material.SmoothPlastic)
		ray.Orientation = Vector3.new(0, 0, rayAngles[index])
	end

	local face = part(guide, "Face", Vector3.new(5.6, 4.8, 0.5), center + Vector3.new(0, 0.25, -1.7), Color3.fromRGB(246, 250, 244), Enum.Material.SmoothPlastic)
	face.Shape = Enum.PartType.Ball
	for _, eyeX in { -1.25, 1.25 } do
		local eye = part(guide, if eyeX < 0 then "LeftEye" else "RightEye", Vector3.new(1.15, 1.55, 0.34), center + Vector3.new(eyeX, 0.55, -2.05), Color3.fromRGB(35, 37, 68), Enum.Material.Neon)
		eye.Shape = Enum.PartType.Ball
		local shine = part(guide, if eyeX < 0 then "LeftEyeShine" else "RightEyeShine", Vector3.new(0.34, 0.42, 0.2), eye.Position + Vector3.new(-0.18, 0.3, -0.2), Color3.new(1, 1, 1), Enum.Material.Neon)
		shine.Shape = Enum.PartType.Ball
	end
	local mouth = part(guide, "Smile", Vector3.new(1.4, 0.48, 0.25), center + Vector3.new(0, -1.05, -2.14), Color3.fromRGB(238, 77, 112), Enum.Material.Neon)
	mouth.Shape = Enum.PartType.Ball
	local leftBoot = part(guide, "LeftBoot", Vector3.new(2.5, 1.7, 3), center + Vector3.new(-2.1, -4.7, -0.1), Color3.fromRGB(255, 143, 48), Enum.Material.SmoothPlastic)
	local rightBoot = part(guide, "RightBoot", Vector3.new(2.5, 1.7, 3), center + Vector3.new(2.1, -4.7, -0.1), Color3.fromRGB(139, 91, 235), Enum.Material.SmoothPlastic)
	leftBoot.Shape = Enum.PartType.Ball
	rightBoot.Shape = Enum.PartType.Ball
	local leftSole = part(guide, "LeftSole", Vector3.new(2.8, 0.6, 3.2), leftBoot.Position + Vector3.new(0, -0.75, -0.1), Color3.fromRGB(62, 69, 83), Enum.Material.Metal)
	local rightSole = part(guide, "RightSole", Vector3.new(2.8, 0.6, 3.2), rightBoot.Position + Vector3.new(0, -0.75, -0.1), Color3.fromRGB(62, 69, 83), Enum.Material.Metal)
	leftSole.Shape = Enum.PartType.Ball
	rightSole.Shape = Enum.PartType.Ball
	for _, armInfo in {
		{ "Left", -1, Color3.fromRGB(51, 166, 221), Color3.fromRGB(255, 155, 53) },
		{ "Right", 1, Color3.fromRGB(62, 203, 121), Color3.fromRGB(255, 214, 61) },
	} do
		local sideName = armInfo[1] :: string
		local side = armInfo[2] :: number
		local upper = part(guide, sideName .. "UpperArm", Vector3.new(2, 3.2, 2), center + Vector3.new(side * 4.2, -0.2, 0), armInfo[3] :: Color3, Enum.Material.Metal)
		upper.Shape = Enum.PartType.Ball
		upper.Orientation = Vector3.new(0, 0, side * -22)
		local cuff = part(guide, sideName .. "Cuff", Vector3.new(2.2, 1.2, 2.2), center + Vector3.new(side * 4.8, -1.8, 0), armInfo[4] :: Color3, Enum.Material.Metal)
		cuff.Shape = Enum.PartType.Ball
		local hand = part(guide, sideName .. "Hand", Vector3.new(2.5, 2.3, 2.3), center + Vector3.new(side * 5.3, -3, -0.1), Color3.fromRGB(75, 166, 183), Enum.Material.SmoothPlastic)
		hand.Shape = Enum.PartType.Ball
		for finger = 1, 3 do
			local fingerPart = part(guide, `{sideName}Finger{finger}`, Vector3.new(0.55, 1.2, 0.7), hand.Position + Vector3.new(side * (0.75 + finger * 0.16), -0.15 + finger * 0.28, -0.2), Color3.fromRGB(91, 190, 198), Enum.Material.SmoothPlastic)
			fingerPart.Shape = Enum.PartType.Ball
		end
	end
	for index, panelInfo in {
		{ Vector3.new(-1.9, -1.9, -1.7), Color3.fromRGB(77, 108, 223) },
		{ Vector3.new(0, -2.15, -1.82), Color3.fromRGB(49, 155, 224) },
		{ Vector3.new(1.9, -1.9, -1.7), Color3.fromRGB(52, 184, 149) },
	} do
		local panel = part(guide, `ChestPanel{index}`, Vector3.new(1.7, 1.5, 0.3), center + panelInfo[1], panelInfo[2], Enum.Material.Metal)
		panel.Shape = Enum.PartType.Ball
	end
	for index, cheekX in { -2.05, 2.05 } do
		local cheek = part(guide, `Cheek{index}`, Vector3.new(0.75, 0.48, 0.18), center + Vector3.new(cheekX, -0.25, -2.18), Color3.fromRGB(255, 133, 160), Enum.Material.Neon)
		cheek.Shape = Enum.PartType.Ball
	end
	for index = 1, 8 do
		local angle = index * math.pi / 4
		local rivet = part(guide, `ArmorRivet{index}`, Vector3.new(0.22, 0.22, 0.18), center + Vector3.new(math.cos(angle) * 2.75, math.sin(angle) * 2.75, -1.82), Color3.fromRGB(230, 239, 242), Enum.Material.Metal)
		rivet.Shape = Enum.PartType.Ball
	end
	local glow = Instance.new("PointLight")
	glow.Color = Color3.fromRGB(255, 219, 95)
	glow.Brightness = 2.2
	glow.Range = 20
	glow.Parent = body
	animeOutline(guide)
	label(body, "★ エコロボ　島をいっしょに元気にしよう！", 35)
	local prompt = Instance.new("ProximityPrompt")
	prompt.Name = "TalkToEcoGuide"
	prompt.ActionText = "話す"
	prompt.ObjectText = "エコロボ"
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = body

	local start = guide:GetPivot()
	task.spawn(function()
		while guide.Parent do
			local up = start + Vector3.new(0, 0.7, 0)
			guide:PivotTo(up)
			task.wait(0.7)
			if guide.Parent == nil then break end
			guide:PivotTo(start)
			task.wait(0.7)
		end
	end)
end

local function buildAmbientLife(world: Folder)
	local life = Instance.new("Folder")
	life.Name = "AmbientLife"
	life.Parent = world
	local definitions: { { any } } = {
		{ "Bird", Vector3.new(-24, 22, 8), Color3.fromRGB(255, 238, 125), Vector3.new(35, 5, -8) },
		{ "Bird", Vector3.new(18, 25, -10), Color3.fromRGB(135, 210, 255), Vector3.new(-32, -3, 15) },
		{ "Butterfly", Vector3.new(20, 7, 12), Color3.fromRGB(255, 105, 201), Vector3.new(-10, 3, 18) },
		{ "Butterfly", Vector3.new(-18, 8, -2), Color3.fromRGB(177, 108, 255), Vector3.new(22, 2, -8) },
		{ "Fish", Vector3.new(-18, -1, 52), Color3.fromRGB(255, 143, 55), Vector3.new(40, 0, 0) },
		{ "Fish", Vector3.new(22, -1, 58), Color3.fromRGB(95, 220, 255), Vector3.new(-44, 0, 0) },
		{ "IslandFriend", Vector3.new(18, 5, -4), Color3.fromRGB(255, 168, 94), Vector3.new(8, 0, 12) },
	}
	for index, definition in definitions do
		local creature = part(life, `{definition[1]}_{index}`, if definition[1] == "IslandFriend" then Vector3.new(3, 6, 3) else Vector3.new(3, 1.5, 2), definition[2], definition[3], Enum.Material.SmoothPlastic)
		creature.Shape = if definition[1] == "IslandFriend" then Enum.PartType.Block else Enum.PartType.Ball
		animeOutline(creature)
		local start = creature.Position
		local destination = start + definition[4]
		task.spawn(function()
			while creature.Parent do
				local outward = TweenService:Create(creature, TweenInfo.new(4 + index * 0.25, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { Position = destination })
				outward:Play()
				outward.Completed:Wait()
				if creature.Parent == nil then break end
				local home = TweenService:Create(creature, TweenInfo.new(4 + index * 0.25, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut), { Position = start })
				home:Play()
				home.Completed:Wait()
			end
		end)
	end
	for index, area in WorldContent.areas do
		if area.id ~= "StartPlaza" then
			local creatureType = if index % 4 == 0 then "Bird" elseif index % 4 == 1 then "Butterfly" elseif index % 4 == 2 then "Fish" else "IslandFriend"
			local height = if creatureType == "Bird" then 18 elseif creatureType == "Fish" then -1 else 5
			local basePosition = area.center + Vector3.new(-area.size.X * 0.18, area.size.Y / 2 + height, 0)
			local creature = part(life, `{creatureType}_{area.id}`, if creatureType == "IslandFriend" then Vector3.new(3, 6, 3) else Vector3.new(3, 1.5, 2), basePosition, Color3.fromHSV((index * 0.09) % 1, 0.58, 1), Enum.Material.SmoothPlastic)
			creature.Shape = if creatureType == "IslandFriend" then Enum.PartType.Block else Enum.PartType.Ball
			animeOutline(creature)
			local destination = basePosition + Vector3.new(area.size.X * 0.36, if creatureType == "Butterfly" then 3 else 0, area.size.Z * 0.15)
			task.spawn(function()
				while creature.Parent do
					local move = TweenService:Create(creature, TweenInfo.new(5 + index * 0.12, Enum.EasingStyle.Sine, Enum.EasingDirection.InOut, 0, true), { Position = destination })
					move:Play()
					move.Completed:Wait()
				end
			end)
		end
	end
end

local function areaLandmark(parent: Instance, area: any)
	local center = area.center + Vector3.new(0, area.size.Y / 2 + 2, 0)
	local landmark = part(parent, area.landmark, Vector3.new(8, 12, 8), center, area.color:Lerp(Color3.new(1, 1, 1), 0.3))
	if area.id == "Lighthouse" then
		landmark.Shape = Enum.PartType.Cylinder
		landmark.Size = Vector3.new(24, 8, 8)
		landmark.Orientation = Vector3.new(0, 0, 90)
		local light = part(parent, "Beacon", Vector3.new(7, 4, 7), center + Vector3.new(0, 14, 0), Color3.fromRGB(255, 244, 143), Enum.Material.Neon)
		light.Shape = Enum.PartType.Ball
	elseif area.id == "VolcanoIsland" then
		landmark.Size = Vector3.new(28, 30, 28)
		landmark.Material = Enum.Material.Basalt
		local lava = part(parent, "LavaCore", Vector3.new(13, 3, 13), center + Vector3.new(0, 15, 0), Color3.fromRGB(255, 82, 34), Enum.Material.Neon)
		lava.Shape = Enum.PartType.Cylinder
	elseif area.id == "SkyIsland" then
		landmark.Shape = Enum.PartType.Ball
		landmark.Material = Enum.Material.Neon
	elseif area.id == "Forest" or area.id == "SnowIsland" then
		landmark.Size = Vector3.new(7, 22, 7)
		landmark.Material = Enum.Material.Wood
		local crown = part(parent, "TreeCrown", Vector3.new(22, 16, 22), center + Vector3.new(0, 16, 0), if area.id == "SnowIsland" then Color3.fromRGB(235, 250, 255) else Color3.fromRGB(47, 181, 78))
		crown.Shape = Enum.PartType.Ball
	elseif area.id == "Cave" or area.id == "UndergroundWorkshop" then
		landmark.Material = Enum.Material.Neon
		landmark.Color = Color3.fromRGB(112, 225, 255)
	elseif area.id == "Harbor" then
		landmark.Size = Vector3.new(20, 3, 9)
		landmark.Material = Enum.Material.WoodPlanks
	end
	animeOutline(landmark)
end

local function buildAreaScenery(parent: Instance, area: any)
	local scenery = Instance.new("Folder")
	scenery.Name = "Scenery"
	scenery.Parent = parent
	local floorY = area.center.Y + area.size.Y / 2
	local function add(name: string, size: Vector3, offset: Vector3, color: Color3, material: Enum.Material?): Part
		local value = part(scenery, name, size, area.center + Vector3.new(offset.X, area.size.Y / 2 + offset.Y, offset.Z), color, material or Enum.Material.SmoothPlastic)
		animeOutline(value)
		return value
	end
	local function tree(name: string, offset: Vector3, snow: boolean?)
		local trunk = add(name .. "Trunk", Vector3.new(3.2, 12, 3.2), offset + Vector3.new(0, 6, 0), Color3.fromRGB(116, 75, 44), Enum.Material.Wood)
		trunk.Shape = Enum.PartType.Cylinder
		local crown = add(name .. "Crown", Vector3.new(12, 10, 12), offset + Vector3.new(0, 15, 0), if snow then Color3.fromRGB(232, 249, 255) else Color3.fromRGB(55, 181, 75), Enum.Material.SmoothPlastic)
		crown.Shape = Enum.PartType.Ball
	end
	local function house(name: string, offset: Vector3, bodyColor: Color3, roofColor: Color3)
		add(name .. "Body", Vector3.new(18, 10, 14), offset + Vector3.new(0, 5, 0), bodyColor, Enum.Material.WoodPlanks)
		local roof = add(name .. "Roof", Vector3.new(21, 4, 17), offset + Vector3.new(0, 12, 0), roofColor, Enum.Material.Slate)
		roof.Orientation = Vector3.new(0, 0, 8)
		add(name .. "Door", Vector3.new(4, 7, 0.5), offset + Vector3.new(0, 3.5, -7.2), Color3.fromRGB(88, 58, 42), Enum.Material.Wood)
		local window = add(name .. "Window", Vector3.new(4, 4, 0.45), offset + Vector3.new(-5.5, 6, -7.25), Color3.fromRGB(143, 235, 255), Enum.Material.Neon)
		local light = Instance.new("PointLight")
		light.Color = window.Color
		light.Brightness = 1.2
		light.Range = 14
		light.Parent = window
	end

	if area.id == "StartPlaza" then
		add("PlazaPathNorth", Vector3.new(14, 0.7, 68), Vector3.new(0, 0.55, -2), Color3.fromRGB(255, 219, 129), Enum.Material.Cobblestone)
		add("PlazaPathEast", Vector3.new(72, 0.7, 14), Vector3.new(0, 0.58, 7), Color3.fromRGB(255, 219, 129), Enum.Material.Cobblestone)
		tree("WelcomeTree", Vector3.new(-29, 0, -5))
		for index, offset in { Vector3.new(-40, 0, 25), Vector3.new(35, 0, 25), Vector3.new(38, 0, -24) } do tree(`PlazaTree{index}`, offset) end
		local fountain = add("EcoFountain", Vector3.new(18, 3, 18), Vector3.new(26, 1.5, 5), Color3.fromRGB(94, 202, 244), Enum.Material.Glass)
		fountain.Shape = Enum.PartType.Cylinder
		local fountainCenter = add("FountainCenter", Vector3.new(4, 12, 4), Vector3.new(26, 7, 5), Color3.fromRGB(62, 178, 221), Enum.Material.Neon)
		fountainCenter.Shape = Enum.PartType.Cylinder
		local fountainTop = add("FountainBubble", Vector3.new(7, 7, 7), Vector3.new(26, 14, 5), Color3.fromRGB(137, 239, 255), Enum.Material.Glass)
		fountainTop.Shape = Enum.PartType.Ball
		fountainTop.Transparency = 0.12
		add("PlazaWelcomeSign", Vector3.new(24, 9, 2), Vector3.new(-25, 5, 26), Color3.fromRGB(255, 159, 67), Enum.Material.WoodPlanks)
		for index, offset in {
			Vector3.new(-18, 1.3, 15), Vector3.new(-10, 1.3, 18), Vector3.new(13, 1.3, 17),
			Vector3.new(20, 1.3, -8), Vector3.new(-22, 1.3, -16), Vector3.new(31, 1.3, 21),
		} do
			local flower = add(`ToyFlower{index}`, Vector3.new(2.8, 2.8, 2.8), offset, Color3.fromHSV((index * 0.14) % 1, 0.72, 1), Enum.Material.SmoothPlastic)
			flower.Shape = Enum.PartType.Ball
			local stem = add(`ToyFlowerStem{index}`, Vector3.new(0.55, 2.8, 0.55), offset - Vector3.new(0, 1.7, 0), Color3.fromRGB(61, 190, 93), Enum.Material.SmoothPlastic)
			stem.Shape = Enum.PartType.Cylinder
			stem.Orientation = Vector3.new(0, 0, 90)
		end
		for index, offset in { Vector3.new(-44, 2.5, -13), Vector3.new(44, 2.2, 12), Vector3.new(18, 2, 31) } do
			local rock = add(`CandyRock{index}`, Vector3.new(7, 4.5, 6), offset, Color3.fromRGB(170, 154 + index * 12, 225), Enum.Material.SmoothPlastic)
			rock.Shape = Enum.PartType.Ball
		end
		for index, offset in { Vector3.new(-9, 4.5, -8), Vector3.new(9, 4.5, -8) } do
			local lamp = add(`RainbowLamp{index}`, Vector3.new(1.2, 8, 1.2), offset, Color3.fromRGB(53, 102, 149), Enum.Material.Metal)
			lamp.Shape = Enum.PartType.Cylinder
			lamp.Orientation = Vector3.new(0, 0, 90)
			local bulb = add(`RainbowLampBulb{index}`, Vector3.new(3.4, 3.4, 3.4), offset + Vector3.new(0, 4.5, 0), if index == 1 then Color3.fromRGB(255, 116, 184) else Color3.fromRGB(102, 233, 255), Enum.Material.Neon)
			bulb.Shape = Enum.PartType.Ball
			local glow = Instance.new("PointLight")
			glow.Color = bulb.Color
			glow.Brightness = 1.4
			glow.Range = 16
			glow.Parent = bulb
		end
	elseif area.id == "Beach" then
		local sea = add("ShallowSea", Vector3.new(area.size.X * 0.86, 0.7, 18), Vector3.new(0, 0.7, 19), Color3.fromRGB(48, 208, 255), Enum.Material.Glass)
		sea.Transparency = 0.22
		for index, x in { -35, 30 } do
			local trunk = add(`Palm{index}Trunk`, Vector3.new(3, 18, 3), Vector3.new(x, 9, -11), Color3.fromRGB(132, 87, 47), Enum.Material.Wood)
			trunk.Orientation = Vector3.new(0, 0, if index == 1 then -8 else 8)
			for leaf = 1, 5 do
				local palmLeaf = add(`Palm{index}Leaf{leaf}`, Vector3.new(2, 1.2, 12), Vector3.new(x + math.cos(leaf * 1.25) * 4, 18, -11 + math.sin(leaf * 1.25) * 4), Color3.fromRGB(52, 190, 82), Enum.Material.Grass)
				palmLeaf.Orientation = Vector3.new(0, leaf * 72, 12)
			end
		end
		add("Pier", Vector3.new(16, 1.5, 32), Vector3.new(0, 1.2, 22), Color3.fromRGB(157, 104, 56), Enum.Material.WoodPlanks)
		add("BeachUmbrella", Vector3.new(16, 1.2, 16), Vector3.new(22, 9, -10), Color3.fromRGB(255, 89, 112), Enum.Material.Fabric).Shape = Enum.PartType.Ball
	elseif area.id == "Forest" then
		for index, offset in { Vector3.new(-32, 0, -22), Vector3.new(-26, 0, 24), Vector3.new(28, 0, -24), Vector3.new(34, 0, 19), Vector3.new(0, 0, 30) } do tree(`ForestTree{index}`, offset) end
		house("ForestCabin", Vector3.new(0, 0, -12), Color3.fromRGB(226, 154, 72), Color3.fromRGB(54, 126, 67))
		add("ForestPath", Vector3.new(14, 0.6, 70), Vector3.new(0, 0.5, 8), Color3.fromRGB(222, 185, 116), Enum.Material.Ground)
	elseif area.id == "Cave" then
		for index, offset in { Vector3.new(-28, 7, 0), Vector3.new(-16, 15, -4), Vector3.new(0, 19, -7), Vector3.new(16, 15, -4), Vector3.new(28, 7, 0) } do
			local rock = add(`CaveArch{index}`, Vector3.new(16, 22, 16), offset, Color3.fromRGB(63, 70, 91), Enum.Material.Rock)
			rock.Shape = Enum.PartType.Ball
		end
		for index, x in { -16, -7, 8, 18 } do
			local crystal = add(`Crystal{index}`, Vector3.new(3.5, 13 + index, 3.5), Vector3.new(x, 6.5, 6), Color3.fromHSV(index * 0.17, 0.65, 1), Enum.Material.Neon)
			crystal.Orientation = Vector3.new(0, 0, (index - 2) * 9)
		end
	elseif area.id == "Clifftop" then
		for level = 1, 3 do
			local ledge = add(`CliffLayer{level}`, Vector3.new(72 - level * 12, 7, 54 - level * 8), Vector3.new(0, level * 5, 0), Color3.fromRGB(104, 116, 92), Enum.Material.Rock)
			ledge.Shape = Enum.PartType.Cylinder
			ledge.Orientation = Vector3.new(0, 0, 90)
		end
		add("WindmillPole", Vector3.new(3, 24, 3), Vector3.new(0, 22, 0), Color3.fromRGB(235, 230, 200), Enum.Material.Wood)
		for blade = 1, 4 do
			local windBlade = add(`WindBlade{blade}`, Vector3.new(3, 20, 1), Vector3.new(math.cos(blade * math.pi / 2) * 5, 27 + math.sin(blade * math.pi / 2) * 5, -2), Color3.fromRGB(255, 192, 70), Enum.Material.SmoothPlastic)
			windBlade.Orientation = Vector3.new(0, 0, blade * 90)
		end
	elseif area.id == "Lighthouse" then
		house("KeeperHouse", Vector3.new(22, 0, 8), Color3.fromRGB(255, 244, 207), Color3.fromRGB(218, 66, 62))
		for stripe = 1, 3 do add(`RedStripe{stripe}`, Vector3.new(9, 3, 9), Vector3.new(0, 7 + stripe * 7, 0), Color3.fromRGB(230, 67, 67), Enum.Material.SmoothPlastic).Shape = Enum.PartType.Cylinder end
		add("LighthouseFence", Vector3.new(52, 3, 1), Vector3.new(0, 1.5, 28), Color3.fromRGB(250, 250, 240), Enum.Material.Wood)
	elseif area.id == "Riverside" then
		local river = add("River", Vector3.new(24, 0.8, area.size.Z * 0.9), Vector3.new(0, 0.7, 0), Color3.fromRGB(55, 190, 255), Enum.Material.Glass)
		river.Transparency = 0.18
		add("Bridge", Vector3.new(38, 2, 10), Vector3.new(0, 3, 0), Color3.fromRGB(168, 105, 56), Enum.Material.WoodPlanks)
		local wheel = add("WaterWheel", Vector3.new(18, 18, 3), Vector3.new(18, 9, -14), Color3.fromRGB(115, 76, 46), Enum.Material.Wood)
		wheel.Shape = Enum.PartType.Cylinder
		wheel.Orientation = Vector3.new(0, 0, 90)
		house("MillHouse", Vector3.new(31, 0, -14), Color3.fromRGB(245, 212, 139), Color3.fromRGB(65, 137, 84))
	elseif area.id == "Wetland" then
		for index, offset in { Vector3.new(-25, 0.5, -16), Vector3.new(18, 0.5, 12), Vector3.new(28, 0.5, -25) } do
			local pond = add(`Pond{index}`, Vector3.new(24, 0.6, 18), offset, Color3.fromRGB(55, 167, 174), Enum.Material.Glass)
			pond.Transparency = 0.15
		end
		for index = 1, 12 do add(`Reed{index}`, Vector3.new(0.8, 7 + index % 3, 0.8), Vector3.new(-40 + index * 7, 4, if index % 2 == 0 then 28 else -28), Color3.fromRGB(191, 173, 67), Enum.Material.Grass) end
		house("StiltHouse", Vector3.new(0, 6, 0), Color3.fromRGB(171, 126, 72), Color3.fromRGB(70, 104, 76))
	elseif area.id == "FlowerField" then
		for index = 1, 24 do
			local x = -42 + (index % 8) * 12
			local z = -28 + math.floor((index - 1) / 8) * 22
			add(`FlowerStem{index}`, Vector3.new(0.7, 4, 0.7), Vector3.new(x, 2, z), Color3.fromRGB(55, 160, 75), Enum.Material.Grass)
			local bloom = add(`Flower{index}`, Vector3.new(3.2, 3.2, 3.2), Vector3.new(x, 4.5, z), Color3.fromHSV((index * 0.11) % 1, 0.72, 1), Enum.Material.SmoothPlastic)
			bloom.Shape = Enum.PartType.Ball
		end
		local clock = add("FlowerClockFace", Vector3.new(22, 2, 22), Vector3.new(0, 2, 0), Color3.fromRGB(255, 247, 205), Enum.Material.SmoothPlastic)
		clock.Shape = Enum.PartType.Cylinder
		add("ClockHand", Vector3.new(1, 1.5, 8), Vector3.new(0, 3.2, -2), Color3.fromRGB(53, 69, 82), Enum.Material.Metal)
	elseif area.id == "Scrapyard" then
		for index, offset in { Vector3.new(-30, 4, -18), Vector3.new(-12, 7, 18), Vector3.new(25, 5, 14), Vector3.new(34, 8, -20) } do
			add(`ScrapPile{index}`, Vector3.new(18, 8 + index * 2, 14), offset, Color3.fromHSV(index * 0.13, 0.45, 0.72), Enum.Material.Metal)
		end
		add("CraneTower", Vector3.new(5, 30, 5), Vector3.new(0, 15, -10), Color3.fromRGB(255, 182, 50), Enum.Material.Metal)
		add("CraneArm", Vector3.new(38, 4, 4), Vector3.new(13, 28, -10), Color3.fromRGB(255, 182, 50), Enum.Material.Metal)
		add("CraneMagnet", Vector3.new(8, 4, 8), Vector3.new(27, 12, -10), Color3.fromRGB(236, 67, 65), Enum.Material.Metal).Shape = Enum.PartType.Cylinder
	elseif area.id == "Harbor" then
		add("MainDock", Vector3.new(22, 2, 62), Vector3.new(0, 1, 5), Color3.fromRGB(149, 95, 52), Enum.Material.WoodPlanks)
		add("BoatHull", Vector3.new(28, 7, 13), Vector3.new(25, 4, 12), Color3.fromRGB(235, 71, 72), Enum.Material.WoodPlanks)
		add("BoatCabin", Vector3.new(10, 8, 9), Vector3.new(25, 10, 10), Color3.fromRGB(246, 241, 205), Enum.Material.WoodPlanks)
		add("BoatMast", Vector3.new(1.5, 25, 1.5), Vector3.new(25, 16, 12), Color3.fromRGB(92, 61, 42), Enum.Material.Wood)
		house("HarborWarehouse", Vector3.new(-28, 0, -8), Color3.fromRGB(88, 179, 202), Color3.fromRGB(39, 91, 119))
	elseif area.id == "UndergroundWorkshop" then
		add("WorkshopFloor", Vector3.new(76, 2, 58), Vector3.new(0, 1, 0), Color3.fromRGB(57, 60, 75), Enum.Material.DiamondPlate)
		for index, x in { -26, 0, 26 } do
			local machine = add(`Machine{index}`, Vector3.new(16, 15, 12), Vector3.new(x, 8, -10), Color3.fromHSV(index * 0.22, 0.55, 0.9), Enum.Material.Metal)
			local display = add(`MachineScreen{index}`, Vector3.new(9, 5, 0.5), Vector3.new(x, 10, -16.2), Color3.fromRGB(78, 239, 255), Enum.Material.Neon)
			local light = Instance.new("PointLight"); light.Color = display.Color; light.Brightness = 1.5; light.Range = 13; light.Parent = display
		end
		add("Conveyor", Vector3.new(65, 3, 9), Vector3.new(0, 4, 17), Color3.fromRGB(58, 66, 77), Enum.Material.Metal)
	elseif area.id == "SkyIsland" then
		for index, offset in { Vector3.new(-32, -7, -18), Vector3.new(30, -8, 12), Vector3.new(0, -10, 30) } do add(`Cloud{index}`, Vector3.new(28, 12, 20), offset, Color3.fromRGB(245, 252, 255), Enum.Material.SmoothPlastic).Shape = Enum.PartType.Ball end
		for side in { -1, 1 } do add(`SkyGatePillar{side}`, Vector3.new(7, 28, 7), Vector3.new(side * 15, 14, -5), Color3.fromRGB(255, 245, 174), Enum.Material.Marble) end
		add("SkyGateTop", Vector3.new(36, 7, 7), Vector3.new(0, 27, -5), Color3.fromRGB(113, 225, 255), Enum.Material.Neon)
	elseif area.id == "SnowIsland" then
		for index, offset in { Vector3.new(-35, 0, -24), Vector3.new(-28, 0, 24), Vector3.new(31, 0, -22), Vector3.new(36, 0, 22) } do tree(`SnowPine{index}`, offset, true) end
		local igloo = add("Igloo", Vector3.new(30, 18, 26), Vector3.new(0, 9, 3), Color3.fromRGB(211, 242, 255), Enum.Material.Ice)
		igloo.Shape = Enum.PartType.Ball
		add("IglooDoor", Vector3.new(8, 9, 8), Vector3.new(0, 4.5, -14), Color3.fromRGB(116, 210, 239), Enum.Material.Ice)
	elseif area.id == "VolcanoIsland" then
		for level = 1, 4 do
			local cone = add(`VolcanoLayer{level}`, Vector3.new(10, 76 - level * 12, 64 - level * 10), Vector3.new(0, level * 6, 0), Color3.fromRGB(83 + level * 10, 57, 49), Enum.Material.Basalt)
			cone.Shape = Enum.PartType.Cylinder
			cone.Orientation = Vector3.new(0, 0, 90)
		end
		local lavaRiver = add("LavaRiver", Vector3.new(10, 1.2, 62), Vector3.new(18, 2, 12), Color3.fromRGB(255, 83, 27), Enum.Material.Neon)
		local lavaLight = Instance.new("PointLight"); lavaLight.Color = lavaRiver.Color; lavaLight.Brightness = 2.5; lavaLight.Range = 24; lavaLight.Parent = lavaRiver
	elseif area.id == "NextIsland" then
		add("FutureRoad", Vector3.new(18, 1, 90), Vector3.new(0, 1, 3), Color3.fromRGB(133, 235, 255), Enum.Material.Neon)
		house("FutureHomeA", Vector3.new(-34, 0, -16), Color3.fromRGB(255, 190, 111), Color3.fromRGB(234, 87, 132))
		house("FutureHomeB", Vector3.new(34, 0, 12), Color3.fromRGB(144, 225, 189), Color3.fromRGB(74, 108, 204))
		for side in { -1, 1 } do add(`PortalPillar{side}`, Vector3.new(7, 30, 7), Vector3.new(side * 17, 15, -34), Color3.fromRGB(116, 92, 239), Enum.Material.Neon) end
		add("PortalTop", Vector3.new(40, 7, 7), Vector3.new(0, 28, -34), Color3.fromRGB(255, 99, 215), Enum.Material.Neon)
	end
end

local function buildExpandedAreas(world: Folder): Folder
	local areasFolder = Instance.new("Folder")
	areasFolder.Name = "Areas"
	areasFolder.Parent = world
	local spawnStyles = { "drift", "treeDrop", "hidden", "glow", "river", "bird", "npc", "chest", "dig", "rain", "night", "artwork", "footprints", "random" }
	local spawnedMaterialCount = 0
	for _, area in WorldContent.areas do
		if area.id ~= "StartPlaza" then
			local model = Instance.new("Model")
			model.Name = area.id
			model:SetAttribute("AreaName", area.name)
			model:SetAttribute("UnlockStage", area.unlockStage)
			model:SetAttribute("SpawnStyle", area.spawnStyle)
			model.Parent = areasFolder
			local ground = part(model, "Ground", area.size, area.center, area.color, area.material)
			makeRoundedIsland(ground, area.size)
			areaLandmark(model, area)
			buildAreaScenery(model, area)
			buildVividAreaAccents(model, area.center, area.size, area.id)
			local arrivalColor = if area.unlockStage % 3 == 0 then VIVID.Cyan elseif area.unlockStage % 3 == 1 then VIVID.Lime else VIVID.Yellow
			local arrival = part(model, "Arrival", Vector3.new(10, 1, 10), area.center + Vector3.new(0, area.size.Y / 2 + 1, area.size.Z * 0.28), arrivalColor, Enum.Material.Neon)
			arrival.Transparency = 0.15
			arrival:SetAttribute("AreaId", area.id)
			label(arrival, area.name, 45)

			local areaMaterials = Instance.new("Folder")
			areaMaterials.Name = "AreaMaterials"
			areaMaterials.Parent = model
			for materialIndex = 1, 3 do
				spawnedMaterialCount += 1
				local materialId = Config.MATERIAL_ORDER[((materialIndex + area.unlockStage) % #Config.MATERIAL_ORDER) + 1]
				local info = Config.MATERIALS[materialId]
				local xOffset = ((materialIndex * 29 + area.unlockStage * 11) % math.floor(area.size.X - 20)) - area.size.X / 2 + 10
				local zOffset = ((materialIndex * 37 + area.unlockStage * 17) % math.floor(area.size.Z - 20)) - area.size.Z / 2 + 10
				local node = part(areaMaterials, `{materialId}_{area.id}_{materialIndex}`, Vector3.new(3, 3, 3), area.center + Vector3.new(xOffset, area.size.Y / 2 + 2.5, zOffset), info.color)
				shapeMaterialNode(node, materialId)
				animeOutline(node)
				applyMaterialRarity(node, spawnedMaterialCount + area.unlockStage * 17)
				node:SetAttribute("MaterialId", materialId)
				node:SetAttribute("AreaId", area.id)
				node:SetAttribute("SpawnStyle", spawnStyles[((spawnedMaterialCount - 1) % #spawnStyles) + 1])
				node:SetAttribute("UnlockStage", area.unlockStage)
				local prompt = Instance.new("ProximityPrompt")
				prompt.Name = "Collect"
				prompt.ActionText = "拾う"
				prompt.ObjectText = info.displayName
				prompt.MaxActivationDistance = Config.COLLECT_DISTANCE
				prompt.RequiresLineOfSight = false
				prompt.Parent = node
			end
		end
	end

	local discoveries = Instance.new("Folder")
	discoveries.Name = "Discoveries"
	discoveries.Parent = world
	local discoveryKinds = {
		{ "HiddenPassage", "隠し通路", "Cave" }, { "SecretCave", "秘密の洞窟", "Clifftop" },
		{ "WorkshopRoom", "工房の隠し部屋", "UndergroundWorkshop" }, { "TreasureMap", "宝の地図", "Beach" },
		{ "MysteryFootprints", "謎の足跡", "Forest" }, { "IslandLetter", "島に散らばった手紙", "Lighthouse" },
		{ "OldPhoto", "古い写真", "Harbor" }, { "HiddenEcoMark", "隠れたエコマーク", "Scrapyard" },
		{ "SecretDoor", "作品で開く秘密の扉", "FlowerField" }, { "CliffMark", "高い場所から見える印", "Clifftop" },
		{ "AnimalTrail", "動物が案内する場所", "Wetland" }, { "DailySecret", "今日の秘密スポット", "NextIsland" },
	}
	for index, definition in discoveryKinds do
		local area = WorldContent.areaById[definition[3]]
		if area then
			local offset = Vector3.new(((index * 17) % 38) - 19, area.size.Y / 2 + 2, ((index * 23) % 34) - 17)
			local marker = part(discoveries, definition[1], Vector3.new(3, 3, 3), area.center + offset, Color3.fromRGB(255, 213, 73), Enum.Material.Neon)
			marker.Shape = Enum.PartType.Ball
			marker.Transparency = if definition[1] == "DailySecret" then 0.45 else 0.15
			marker:SetAttribute("DiscoveryName", definition[2])
			marker:SetAttribute("UnlockStage", area.unlockStage)
			local prompt = Instance.new("ProximityPrompt")
			prompt.Name = "Discover"
			prompt.ActionText = "調べる"
			prompt.ObjectText = "？"
			prompt.MaxActivationDistance = 10
			prompt.RequiresLineOfSight = false
			prompt.Parent = marker
		end
	end

	local travelFolder = Instance.new("Folder")
	travelFolder.Name = "TravelPoints"
	travelFolder.Parent = world
	for index, travel in WorldContent.travel do
		local fromArea = WorldContent.areaById[travel.fromArea]
		local toArea = WorldContent.areaById[travel.toArea]
		if fromArea and toArea then
			local angle = (index / #WorldContent.travel) * math.pi * 2
			local offset = Vector3.new(math.cos(angle), 0, math.sin(angle)) * math.min(fromArea.size.X, fromArea.size.Z) * 0.32
			local padPosition = fromArea.center + offset + Vector3.new(0, fromArea.size.Y / 2 + 1, 0)
			local pad = part(travelFolder, travel.id, Vector3.new(8, 1, 8), padPosition, Color3.fromRGB(113, 224, 255), Enum.Material.Neon)
			pad:SetAttribute("DestinationArea", travel.toArea)
			pad:SetAttribute("UnlockStage", travel.unlockStage)
			pad:SetAttribute("TravelStyle", travel.style)
			animeOutline(pad)
			local prompt = Instance.new("ProximityPrompt")
			prompt.Name = "Travel"
			prompt.ActionText = `移動する（{travel.style}）`
			prompt.ObjectText = toArea.name
			prompt.MaxActivationDistance = 12
			prompt.RequiresLineOfSight = false
			prompt.Parent = pad
		end
	end
	return travelFolder
end

local function buildEvolution(world: Folder)
	local evolution = Instance.new("Folder")
	evolution.Name = "WorldEvolution"
	evolution.Parent = world
	local items = {
		{ "CleanGround", Vector3.new(-26, 2.2, 4), Vector3.new(18, 0.5, 14), Color3.fromRGB(104, 224, 102), Enum.Material.Grass, 5 },
		{ "ClearWater", Vector3.new(0, -1.8, 65), Vector3.new(85, 0.5, 18), Color3.fromRGB(37, 219, 255), Enum.Material.Glass, 10 },
		{ "RevivedTree", Vector3.new(-20, 8, -4), Vector3.new(7, 16, 7), Color3.fromRGB(52, 182, 76), Enum.Material.Grass, 15 },
		{ "BloomingFlowers", Vector3.new(20, 3, 5), Vector3.new(14, 2, 10), Color3.fromRGB(255, 108, 183), Enum.Material.Grass, 20 },
		{ "ReturningBirds", Vector3.new(-8, 18, -8), Vector3.new(3, 1, 5), Color3.fromRGB(255, 245, 167), Enum.Material.SmoothPlastic, 30 },
		{ "ReturningButterflies", Vector3.new(12, 9, 8), Vector3.new(4, 1, 2), Color3.fromRGB(255, 116, 210), Enum.Material.Neon, 35 },
		{ "ReturningFish", Vector3.new(0, -1, 45), Vector3.new(5, 1.5, 2), Color3.fromRGB(255, 148, 54), Enum.Material.SmoothPlastic, 40 },
		{ "RepairedBuilding", Vector3.new(20, 6, -19), Vector3.new(10, 9, 10), Color3.fromRGB(255, 198, 83), Enum.Material.WoodPlanks, 50 },
		{ "CompletedBridge", Vector3.new(0, 2, 67), Vector3.new(10, 1, 48), Color3.fromRGB(192, 132, 69), Enum.Material.WoodPlanks, 55 },
		{ "StreetLights", Vector3.new(-12, 6, 20), Vector3.new(2, 9, 2), Color3.fromRGB(255, 236, 119), Enum.Material.Neon, 60 },
		{ "NewIslandNPC", Vector3.new(14, 6, 19), Vector3.new(4, 8, 4), Color3.fromRGB(116, 179, 255), Enum.Material.SmoothPlastic, 70 },
		{ "ExpandedWorkshop", Vector3.new(-20, 7, -19), Vector3.new(14, 12, 12), Color3.fromRGB(255, 164, 66), Enum.Material.WoodPlanks, 75 },
		{ "BrightSkyBeacon", Vector3.new(0, 20, -18), Vector3.new(5, 5, 5), Color3.fromRGB(255, 247, 154), Enum.Material.Neon, 85 },
		{ "FestivalStage", Vector3.new(0, 4, 12), Vector3.new(28, 3, 14), Color3.fromRGB(255, 111, 166), Enum.Material.WoodPlanks, 100 },
	}
	for _, item in items do
		local value = part(evolution, item[1] :: string, item[3] :: Vector3, item[2] :: Vector3, item[4] :: Color3, item[5] :: Enum.Material)
		value:SetAttribute("CleanlinessRequired", item[6])
		value.Transparency = 1
		value.CanCollide = false
		animeOutline(value)
	end
	local theme = Instance.new("StringValue")
	theme.Name = "CurrentBGMTheme"
	theme.Value = "はじまりの島"
	theme.Parent = evolution
end

local function makeDecoration(recipeId: string): Model
	local recipe = Recipes.byId[recipeId]
	local model = Instance.new("Model")
	model.Name = recipeId

	local base = part(model, "Base", Vector3.new(3, 1, 3), Vector3.zero, recipe.color)
	model.PrimaryPart = base

	if recipeId == "BottlePlanter" then
		part(model, "Stem", Vector3.new(0.5, 2.5, 0.5), Vector3.new(0, 1.5, 0), Color3.fromRGB(73, 150, 78))
		local crown = part(model, "Leaves", Vector3.new(2, 1.2, 2), Vector3.new(0, 3, 0), Color3.fromRGB(102, 196, 94))
		crown.Shape = Enum.PartType.Ball
	elseif recipeId == "CanStool" then
		base.Shape = Enum.PartType.Cylinder
		base.Orientation = Vector3.new(0, 0, 90)
		base.Size = Vector3.new(2, 3, 3)
	elseif recipeId == "PatchworkLamp" then
		part(model, "Pole", Vector3.new(0.4, 3, 0.4), Vector3.new(0, 2, 0), Color3.fromRGB(95, 104, 119), Enum.Material.Metal)
		local glow = part(model, "Glow", Vector3.new(2.4, 1.4, 2.4), Vector3.new(0, 4, 0), recipe.color, Enum.Material.Neon)
		glow.Shape = Enum.PartType.Ball
	elseif recipeId == "RecycledBench" then
		base.Size = Vector3.new(5, 0.7, 2)
		base.Position = Vector3.new(0, 1.5, 0)
		part(model, "Back", Vector3.new(5, 2, 0.5), Vector3.new(0, 2.5, 0.75), recipe.color)
		part(model, "Leg1", Vector3.new(0.5, 1.5, 0.5), Vector3.new(-1.8, 0.6, 0), Color3.fromRGB(95, 104, 119))
		part(model, "Leg2", Vector3.new(0.5, 1.5, 0.5), Vector3.new(1.8, 0.6, 0), Color3.fromRGB(95, 104, 119))
	elseif recipeId == "EcoBot" then
		base.Size = Vector3.new(3.6, 3.6, 1.8)
		base.Position = Vector3.new(0, 3, 0)
		base.Shape = Enum.PartType.Ball
		local miniColors = {
			Color3.fromRGB(255, 87, 103), Color3.fromRGB(255, 187, 61), Color3.fromRGB(255, 228, 80),
			Color3.fromRGB(77, 211, 126), Color3.fromRGB(135, 93, 235),
		}
		local miniOffsets = { Vector3.new(0, 2.4, 0.2), Vector3.new(2.2, 0.8, 0.2), Vector3.new(1.4, -2, 0.2), Vector3.new(-1.4, -2, 0.2), Vector3.new(-2.2, 0.8, 0.2) }
		for index, offset in miniOffsets do
			local ray = part(model, `Ray{index}`, Vector3.new(1.5, 2.8, 1.4), base.Position + offset, miniColors[index], Enum.Material.SmoothPlastic)
			ray.Orientation = Vector3.new(0, 0, ({ 0, -72, -144, 144, 72 })[index])
		end
		local eye1 = part(model, "Eye1", Vector3.new(0.55, 0.75, 0.2), Vector3.new(-0.75, 3.35, -1.02), Color3.fromRGB(25, 35, 58), Enum.Material.Neon)
		eye1.Shape = Enum.PartType.Ball
		local eye2 = eye1:Clone()
		eye2.Name = "Eye2"
		eye2.Position = Vector3.new(0.75, 3.35, -1.02)
		eye2.Parent = model
		local miniGlow = Instance.new("PointLight")
		miniGlow.Color = Color3.fromRGB(255, 218, 87)
		miniGlow.Brightness = 1.5
		miniGlow.Range = 10
		miniGlow.Parent = base
	end

	for _, descendant in model:GetDescendants() do
		if descendant:IsA("BasePart") then
			descendant.CanCollide = false
		end
	end
	return model
end

function WorldBuilder.build(): (Folder, BasePart, { { BasePart } }, { { BasePart } })
	configureAnimeLighting()
	local previous = workspace:FindFirstChild("MinijimaWorld")
	if previous then
		previous:Destroy()
	end

	local world = Instance.new("Folder")
	world.Name = "MinijimaWorld"
	world.Parent = workspace

	local water = part(world, "Water", Vector3.new(190, 2, 190), Vector3.new(0, -3, 0), Color3.fromRGB(27, 211, 255), Enum.Material.Glass)
	water.Transparency = 0.12
	water.CanCollide = false

	local island = part(world, "Island", Vector3.new(110, 4, 85), Vector3.new(0, 0, 0), VIVID.Lime, Enum.Material.Grass)
	makeRoundedIsland(island, Vector3.new(110, 4, 85))
	island:SetAttribute("AreaId", "StartPlaza")
	local islandBase = part(world, "IslandToyBase", Vector3.new(103, 7, 79), Vector3.new(0, -4.2, 0), VIVID.Dark, Enum.Material.SmoothPlastic)
	makeRoundedIsland(islandBase, Vector3.new(103, 7, 79))
	animeOutline(islandBase)
	buildAreaScenery(world, WorldContent.areaById.StartPlaza)
	buildVividAreaAccents(world, WorldContent.areaById.StartPlaza.center, WorldContent.areaById.StartPlaza.size, "StartPlaza")
	buildExpandedAreas(world)
	buildEvolution(world)
	buildEcoGuide(world)
	buildAmbientLife(world)

	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Start"
	spawn.Size = Vector3.new(8, 1, 8)
	spawn.Position = Vector3.new(0, 3, 24)
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Color = Color3.fromRGB(250, 229, 110)
	spawn.Parent = world

	local workshopPromptParent: BasePart
	local importedWorkshop = workspace:FindFirstChild("RainbowRecycleWorkshopV1")
	if importedWorkshop and importedWorkshop:IsA("Model") then
		local workshopVisual = importedWorkshop:Clone()
		workshopVisual.Name = "RainbowRecycleWorkshop"
		workshopVisual.Parent = world
		importedWorkshop.Parent = ServerStorage
		local importedSize = workshopVisual:GetExtentsSize()
		local largest = math.max(importedSize.X, importedSize.Y, importedSize.Z)
		if largest > 0 then
			workshopVisual:ScaleTo(28 / largest)
		end
		for _, descendant in workshopVisual:GetDescendants() do
			if descendant:IsA("BasePart") then
				descendant.Anchored = true
				descendant.CanCollide = true
				descendant.CastShadow = true
			end
		end
		local scaledSize = workshopVisual:GetExtentsSize()
		workshopVisual:PivotTo(CFrame.new(0, 2 + scaledSize.Y / 2, -18) * CFrame.Angles(0, math.rad(180), 0))
		workshopPromptParent = part(world, "WorkshopPrompt", Vector3.new(10, 10, 2), Vector3.new(0, 7, -4), Color3.new(1, 1, 1), Enum.Material.SmoothPlastic)
		workshopPromptParent.Transparency = 1
		workshopPromptParent.CanCollide = false
	else
		local workshop = part(world, "Workshop", Vector3.new(20, 13, 17), Vector3.new(0, 8.2, -18), Color3.fromRGB(255, 155, 66), Enum.Material.SmoothPlastic)
		workshop.Shape = Enum.PartType.Ball
		animeOutline(workshop)
		local workshopRoof = part(world, "WorkshopRainbowRoof", Vector3.new(23, 7, 20), Vector3.new(0, 15, -18), Color3.fromRGB(82, 190, 255), Enum.Material.SmoothPlastic)
		workshopRoof.Shape = Enum.PartType.Ball
		animeOutline(workshopRoof)
		workshopPromptParent = workshop
		label(workshop, "🏭", 24)
	end
	local workshopPrompt = Instance.new("ProximityPrompt")
	workshopPrompt.Name = "EnterWorkshop"
	workshopPrompt.ActionText = "工房に入る"
	workshopPrompt.ObjectText = "リサイクル工房"
	workshopPrompt.KeyboardKeyCode = Enum.KeyCode.E
	workshopPrompt.HoldDuration = 0
	workshopPrompt.MaxActivationDistance = 12
	workshopPrompt.RequiresLineOfSight = false
	workshopPrompt.Parent = workshopPromptParent

	local materialsFolder = Instance.new("Folder")
	materialsFolder.Name = "MaterialNodes"
	materialsFolder.Parent = world
	local positions = {
		Vector3.new(-35, 4, 18), Vector3.new(-28, 4, -3), Vector3.new(-36, 4, -22),
		Vector3.new(33, 4, 19), Vector3.new(27, 4, 0), Vector3.new(36, 4, -20),
		Vector3.new(-15, 4, 22), Vector3.new(15, 4, 22), Vector3.new(0, 4, 4),
	}
	for index, position in positions do
		local materialId = Config.MATERIAL_ORDER[((index - 1) % #Config.MATERIAL_ORDER) + 1]
		local info = Config.MATERIALS[materialId]
		local node = part(materialsFolder, `{materialId}_{index}`, Vector3.new(3, 3, 3), position, info.color)
		shapeMaterialNode(node, materialId)
		animeOutline(node)
		applyMaterialRarity(node, index)
		node:SetAttribute("MaterialId", materialId)
		local prompt = Instance.new("ProximityPrompt")
		prompt.Name = "Collect"
		prompt.ActionText = "トングで拾う"
		prompt.ObjectText = info.displayName
		prompt.HoldDuration = 0
		prompt.MaxActivationDistance = Config.COLLECT_DISTANCE
		prompt.RequiresLineOfSight = false
		prompt.Parent = node
	end

	local slotLanes = {}
	local decorations = Instance.new("Folder")
	decorations.Name = "DecorationSlots"
	decorations.Parent = world
	local laneDefinitions = {
		{ center = Vector3.new(0, 2.5, -36), axis = Vector3.new(14, 0, 0) },
		{ center = Vector3.new(0, 2.5, 36), axis = Vector3.new(14, 0, 0) },
		{ center = Vector3.new(-46, 2.5, 0), axis = Vector3.new(0, 0, 14) },
		{ center = Vector3.new(46, 2.5, 0), axis = Vector3.new(0, 0, 14) },
	}
	for lane, definition in laneDefinitions do
		local slots = {}
		for index = 1, Config.DECORATION_SLOTS do
			local position = definition.center + definition.axis * (index - 2)
			local slot = part(decorations, `Lane{lane}_Slot{index}`, Vector3.new(10, 0.7, 10), position, Color3.fromRGB(225, 218, 183))
			slot:SetAttribute("Lane", lane)
			slot:SetAttribute("Slot", index)
			table.insert(slots, slot)
		end
		table.insert(slotLanes, slots)
	end

	-- 生成3Dモデルの扉や当たり判定に左右されない、専用の工房内部を離れた場所に作る。
	local interiorCenter = Vector3.new(430, 60, -180)
	local workshopInterior = Instance.new("Folder")
	workshopInterior.Name = "WorkshopInterior"
	workshopInterior.Parent = world
	local interiorFloor = part(workshopInterior, "InteriorFloor", Vector3.new(44, 1, 40), interiorCenter, Color3.fromRGB(90, 205, 166), Enum.Material.SmoothPlastic)
	animeOutline(interiorFloor)
	part(workshopInterior, "BackWall", Vector3.new(44, 15, 1), interiorCenter + Vector3.new(0, 7.5, -20), Color3.fromRGB(111, 188, 255), Enum.Material.SmoothPlastic)
	part(workshopInterior, "LeftWall", Vector3.new(1, 15, 40), interiorCenter + Vector3.new(-22, 7.5, 0), Color3.fromRGB(255, 133, 183), Enum.Material.SmoothPlastic)
	part(workshopInterior, "RightWall", Vector3.new(1, 15, 40), interiorCenter + Vector3.new(22, 7.5, 0), Color3.fromRGB(255, 205, 91), Enum.Material.SmoothPlastic)
	local interiorRoof = part(workshopInterior, "RainbowRoof", Vector3.new(44, 1, 40), interiorCenter + Vector3.new(0, 15, 0), Color3.fromRGB(167, 121, 255), Enum.Material.SmoothPlastic)
	interiorRoof.Transparency = 0.18
	for index, color in {
		Color3.fromRGB(255, 91, 112), Color3.fromRGB(255, 174, 66), Color3.fromRGB(255, 230, 87),
		Color3.fromRGB(77, 211, 126), Color3.fromRGB(78, 175, 255), Color3.fromRGB(165, 104, 255),
	} do
		local stripe = part(workshopInterior, `FloorStripe{index}`, Vector3.new(6.5, 0.12, 39), interiorCenter + Vector3.new((index - 3.5) * 6.7, 0.57, 0), color, Enum.Material.Neon)
		stripe.CanCollide = false
	end

	local interiorSpawn = part(workshopInterior, "InteriorSpawn", Vector3.new(7, 1, 5), interiorCenter + Vector3.new(0, 1.5, 13), Color3.new(1, 1, 1))
	interiorSpawn.Transparency = 1
	interiorSpawn.CanCollide = false
	local exteriorSpawn = part(workshopInterior, "ExteriorSpawn", Vector3.new(7, 1, 5), Vector3.new(0, 3, -1), Color3.new(1, 1, 1))
	exteriorSpawn.Transparency = 1
	exteriorSpawn.CanCollide = false

	local exitStation = part(workshopInterior, "ExitStation", Vector3.new(8, 8, 1.2), interiorCenter + Vector3.new(0, 4.5, 19.15), Color3.fromRGB(112, 72, 190), Enum.Material.SmoothPlastic)
	animeOutline(exitStation)
	local doorArch = part(exitStation, "DoorArch", Vector3.new(9.2, 4.2, 1.3), exitStation.Position + Vector3.new(0, 4, 0), Color3.fromRGB(167, 105, 245), Enum.Material.SmoothPlastic)
	doorArch.Shape = Enum.PartType.Ball
	local leftDoorFrame = part(exitStation, "LeftDoorFrame", Vector3.new(1, 9, 1.8), exitStation.Position + Vector3.new(-4.5, 0, 0), Color3.fromRGB(255, 101, 130), Enum.Material.Neon)
	local rightDoorFrame = part(exitStation, "RightDoorFrame", Vector3.new(1, 9, 1.8), exitStation.Position + Vector3.new(4.5, 0, 0), Color3.fromRGB(75, 207, 125), Enum.Material.Neon)
	leftDoorFrame.CanCollide = false
	rightDoorFrame.CanCollide = false
	local doorWindow = part(exitStation, "DoorWindow", Vector3.new(2.8, 2.8, 0.5), exitStation.Position + Vector3.new(0, 1.25, -0.85), Color3.fromRGB(120, 230, 255), Enum.Material.Glass)
	doorWindow.Shape = Enum.PartType.Ball
	doorWindow.Transparency = 0.18
	doorWindow.CanCollide = false
	local doorHandle = part(exitStation, "DoorHandle", Vector3.new(0.65, 0.65, 0.65), exitStation.Position + Vector3.new(2.45, -1.1, -0.95), Color3.fromRGB(255, 226, 88), Enum.Material.Metal)
	doorHandle.Shape = Enum.PartType.Ball
	doorHandle.CanCollide = false
	local headerColors = {
		Color3.fromRGB(255, 85, 105), Color3.fromRGB(255, 170, 62), Color3.fromRGB(255, 226, 75),
		Color3.fromRGB(70, 207, 119), Color3.fromRGB(72, 166, 255), Color3.fromRGB(159, 93, 238),
	}
	for index, color in headerColors do
		local headerPiece = part(exitStation, `DoorRainbow{index}`, Vector3.new(1.45, 0.65, 1.7), exitStation.Position + Vector3.new((index - 3.5) * 1.45, 5.1, 0), color, Enum.Material.Neon)
		headerPiece.CanCollide = false
	end
	label(exitStation, "🚪 島へもどる", 28)
	interiorSpawn.CFrame = CFrame.lookAt(interiorSpawn.Position, exitStation.Position)
	local exitPrompt = Instance.new("ProximityPrompt")
	exitPrompt.Name = "ExitWorkshop"
	exitPrompt.ActionText = "島へ戻る"
	exitPrompt.ObjectText = "工房の出口"
	exitPrompt.KeyboardKeyCode = Enum.KeyCode.E
	exitPrompt.HoldDuration = 0
	exitPrompt.MaxActivationDistance = 12
	exitPrompt.RequiresLineOfSight = false
	exitPrompt.Parent = exitStation

	local craftStation = part(workshopInterior, "InteriorCraftStation", Vector3.new(17, 5.5, 3.5), interiorCenter + Vector3.new(0, 3.25, -17.5), Color3.fromRGB(55, 92, 170), Enum.Material.Metal)
	animeOutline(craftStation)
	local machineColors = {
		Color3.fromRGB(255, 79, 99), Color3.fromRGB(255, 154, 55), Color3.fromRGB(255, 224, 70),
		Color3.fromRGB(64, 207, 116), Color3.fromRGB(65, 166, 255), Color3.fromRGB(157, 92, 239),
	}
	for index, color in machineColors do
		local panel = part(
			craftStation,
			`RainbowPanel{index}`,
			Vector3.new(2.45, 4.3, 0.42),
			craftStation.Position + Vector3.new((index - 3.5) * 2.65, 0.15, 1.95),
			color,
			Enum.Material.SmoothPlastic
		)
		panel.CanCollide = false
		animeOutline(panel)
	end
	local machineCore = part(craftStation, "RecycleCore", Vector3.new(4.2, 4.2, 0.7), craftStation.Position + Vector3.new(0, 0.2, 2.35), Color3.fromRGB(111, 255, 224), Enum.Material.Neon)
	machineCore.Shape = Enum.PartType.Ball
	machineCore.CanCollide = false
	local leftHopper = part(craftStation, "LeftHopper", Vector3.new(3.2, 3.2, 3.2), craftStation.Position + Vector3.new(-5.5, 4, 0), machineColors[1], Enum.Material.SmoothPlastic)
	leftHopper.Shape = Enum.PartType.Ball
	local rightHopper = part(craftStation, "RightHopper", Vector3.new(3.2, 3.2, 3.2), craftStation.Position + Vector3.new(5.5, 4, 0), machineColors[6], Enum.Material.SmoothPlastic)
	rightHopper.Shape = Enum.PartType.Ball
	local machineLight = Instance.new("PointLight")
	machineLight.Name = "RainbowMachineGlow"
	machineLight.Color = Color3.fromRGB(255, 220, 124)
	machineLight.Brightness = 1.5
	machineLight.Range = 16
	machineLight.Parent = machineCore
	local interiorCraftPrompt = Instance.new("ProximityPrompt")
	interiorCraftPrompt.Name = "OpenWorkshop"
	interiorCraftPrompt.ActionText = "工作する"
	interiorCraftPrompt.ObjectText = "虹色リサイクルマシン"
	interiorCraftPrompt.KeyboardKeyCode = Enum.KeyCode.E
	interiorCraftPrompt.HoldDuration = 0
	interiorCraftPrompt.MaxActivationDistance = 12
	interiorCraftPrompt.RequiresLineOfSight = false
	interiorCraftPrompt.Parent = craftStation

	-- 工房の中に、各プレイヤーが作った3作品を並べるギャラリーを用意する。
	-- サーバー最大4人が同時に遊んでも作品が重ならないよう、奥行き方向に専用列を分ける。
	local workshopGallery = Instance.new("Folder")
	workshopGallery.Name = "WorkshopGallery"
	workshopGallery.Parent = world
	local gallerySlotLanes = {}
	local galleryLaneZ = { -11, -5, 1, 7 }
	for lane, zPosition in galleryLaneZ do
		local slots = {}
		for index = 1, Config.DECORATION_SLOTS do
			local xPosition = interiorCenter.X + (index - 2) * 7
			local pedestal = part(
				workshopGallery,
				`GalleryLane{lane}_Slot{index}`,
				Vector3.new(4.8, 0.65, 3.5),
				Vector3.new(xPosition, interiorCenter.Y + 1.35, interiorCenter.Z + zPosition),
				Color3.fromRGB(255, 224, 105),
				Enum.Material.SmoothPlastic
			)
			pedestal:SetAttribute("Lane", lane)
			pedestal:SetAttribute("Slot", index)
			local glow = Instance.new("PointLight")
			glow.Name = "ShowcaseGlow"
			glow.Color = Color3.fromRGB(255, 231, 148)
			glow.Brightness = 0.7
			glow.Range = 7
			glow.Parent = pedestal
			table.insert(slots, pedestal)
		end
		table.insert(gallerySlotLanes, slots)
	end
	local gallerySign = part(workshopGallery, "GallerySign", Vector3.new(17, 2.4, 0.45), interiorCenter + Vector3.new(0, 10.5, 9), Color3.fromRGB(91, 205, 255), Enum.Material.Neon)
	gallerySign.CanCollide = false
	label(gallerySign, "✨ できた！ギャラリー ✨", 28)

	return world, workshopPromptParent, slotLanes, gallerySlotLanes
end

function WorldBuilder.applyProgress(cleanliness: number, missionStage: number)
	local world = workspace:FindFirstChild("MinijimaWorld")
	if world == nil or not world:IsA("Folder") then
		return
	end
	local progress = math.clamp(cleanliness, 0, 100)
	world:SetAttribute("GlobalCleanliness", progress)
	world:SetAttribute("GlobalMissionStage", missionStage)
	local evolution = world:FindFirstChild("WorldEvolution")
	if evolution then
		for _, value in evolution:GetChildren() do
			if value:IsA("BasePart") then
				local required = value:GetAttribute("CleanlinessRequired")
				local visible = type(required) == "number" and progress >= required
				value.Transparency = if visible then 0 else 1
				value.CanCollide = visible and value.Name == "CompletedBridge"
				local outline = value:FindFirstChild("AnimeOutline")
				if outline and outline:IsA("Highlight") then
					outline.Enabled = visible
				end
			end
		end
		local theme = evolution:FindFirstChild("CurrentBGMTheme")
		if theme and theme:IsA("StringValue") then
			theme.Value = if progress >= 100 then "リサイクル祭り" elseif progress >= 60 then "よみがえる島" elseif progress >= 30 then "冒険の島" else "はじまりの島"
		end
	end
end

function WorldBuilder.renderDecorations(player: Player, slots: { BasePart }, gallerySlots: { BasePart }, decorations: { string })
	local world = workspace:FindFirstChild("MinijimaWorld")
	if world == nil then
		return
	end
	local containerName = `Player_{player.UserId}_Decorations`
	local previous = world:FindFirstChild(containerName)
	if previous then
		previous:Destroy()
	end
	local galleryContainerName = `Player_{player.UserId}_WorkshopGallery`
	local previousGallery = world:FindFirstChild(galleryContainerName)
	if previousGallery then
		previousGallery:Destroy()
	end
	local container = Instance.new("Folder")
	container.Name = containerName
	container.Parent = world
	local galleryContainer = Instance.new("Folder")
	galleryContainer.Name = galleryContainerName
	galleryContainer.Parent = world

	for slotIndex = 1, #slots do
		local recipeId = decorations[slotIndex]
		if recipeId ~= "" and Recipes.byId[recipeId] then
			local model = makeDecoration(recipeId)
			animeOutline(model)
			model:SetAttribute("OwnerUserId", player.UserId)
			model:PivotTo(slots[slotIndex].CFrame * CFrame.new(0, 0.7, 0))
			model.Parent = container

			local galleryModel = makeDecoration(recipeId)
			galleryModel.Name = `Gallery_{recipeId}`
			animeOutline(galleryModel)
			galleryModel:SetAttribute("OwnerUserId", player.UserId)
			galleryModel:SetAttribute("WorkshopDisplay", true)
			galleryModel:ScaleTo(0.72)
			galleryModel:PivotTo(gallerySlots[slotIndex].CFrame * CFrame.new(0, 0.55, 0))
			galleryModel.Parent = galleryContainer
		end
	end
end

return WorldBuilder
