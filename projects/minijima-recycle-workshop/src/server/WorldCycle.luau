--!strict

local Lighting = game:GetService("Lighting")

local WorldCycle = {}

local states = {
	{ id = "Morning", name = "朝", clock = 7, brightness = 2.05, density = 0.18, haze = 0.8, cover = 0.12 },
	{ id = "Sunny", name = "晴れ", clock = 13, brightness = 2.25, density = 0.15, haze = 0.5, cover = 0.05 },
	{ id = "Evening", name = "夕方", clock = 17.8, brightness = 1.8, density = 0.2, haze = 1.0, cover = 0.18 },
	{ id = "Night", name = "夜", clock = 21, brightness = 1.7, density = 0.16, haze = 0.55, cover = 0.12 },
	{ id = "Rain", name = "雨", clock = 11, brightness = 1.45, density = 0.34, haze = 2.2, cover = 0.78 },
	{ id = "Rainbow", name = "虹", clock = 15, brightness = 2.3, density = 0.14, haze = 0.4, cover = 0.14 },
	{ id = "Fog", name = "霧", clock = 9, brightness = 1.65, density = 0.48, haze = 4.5, cover = 0.48 },
	{ id = "StrongWind", name = "強風", clock = 14, brightness = 1.9, density = 0.22, haze = 1.5, cover = 0.52 },
	{ id = "Stars", name = "星の夜", clock = 23, brightness = 1.6, density = 0.08, haze = 0.2, cover = 0.02 },
	{ id = "Meteor", name = "流星", clock = 1, brightness = 1.7, density = 0.07, haze = 0.18, cover = 0.01 },
	{ id = "AfterStorm", name = "嵐の後", clock = 6.5, brightness = 1.75, density = 0.3, haze = 2, cover = 0.6 },
	{ id = "Cherry", name = "桜の季節", clock = 10, brightness = 2.15, density = 0.16, haze = 0.6, cover = 0.1 },
	{ id = "Autumn", name = "紅葉の季節", clock = 15.5, brightness = 2, density = 0.18, haze = 0.8, cover = 0.16 },
	{ id = "Snow", name = "雪の季節", clock = 12, brightness = 2.1, density = 0.28, haze = 1.8, cover = 0.66 },
	{ id = "SummerFestival", name = "夏祭り", clock = 19.5, brightness = 1.45, density = 0.12, haze = 0.35, cover = 0.04 },
}

local currentIndex = 1
local worldRef: Folder? = nil

local function applyState(index: number)
	currentIndex = ((index - 1) % #states) + 1
	local state = states[currentIndex]
	Lighting.ClockTime = state.clock
	Lighting.Brightness = state.brightness
	local isDark = state.id == "Night" or state.id == "Stars" or state.id == "Meteor" or state.id == "SummerFestival"
	Lighting.Ambient = if isDark then Color3.fromRGB(105, 119, 166) else Color3.fromRGB(126, 145, 184)
	Lighting.OutdoorAmbient = if isDark then Color3.fromRGB(125, 139, 184) else Color3.fromRGB(156, 174, 214)
	local atmosphere = Lighting:FindFirstChild("AnimeAtmosphere")
	if atmosphere and atmosphere:IsA("Atmosphere") then
		atmosphere.Density = state.density
		atmosphere.Haze = state.haze
	end
	local clouds = workspace.Terrain:FindFirstChild("WorldClouds")
	if clouds == nil then
		clouds = Instance.new("Clouds")
		clouds.Name = "WorldClouds"
		clouds.Parent = workspace.Terrain
	end
	if clouds:IsA("Clouds") then
		clouds.Cover = state.cover
		clouds.Density = math.clamp(state.cover + 0.2, 0, 1)
		clouds.Color = if state.id == "Rain" then Color3.fromRGB(140, 155, 175) else Color3.fromRGB(245, 250, 255)
	end
	if worldRef then
		worldRef:SetAttribute("EnvironmentId", state.id)
		worldRef:SetAttribute("EnvironmentName", state.name)
	end
end

function WorldCycle.isSpawnAvailable(style: string): boolean
	local id = states[currentIndex].id
	if style == "rain" then
		return id == "Rain" or id == "AfterStorm"
	elseif style == "night" then
		return id == "Night" or id == "Stars" or id == "Meteor"
	elseif style == "meteor" then
		return id == "Meteor" or id == "AfterStorm"
	elseif style == "butterfly" then
		return id == "Sunny" or id == "Rainbow" or id == "Cherry"
	end
	return true
end

function WorldCycle.start(world: Folder)
	worldRef = world
	applyState(1)
	task.spawn(function()
		while world.Parent do
			task.wait(75)
			applyState(currentIndex + 1)
		end
	end)
end

return WorldCycle
