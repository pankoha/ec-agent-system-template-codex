--!strict

export type AreaDefinition = {
	id: string,
	name: string,
	center: Vector3,
	size: Vector3,
	color: Color3,
	material: Enum.Material,
	unlockStage: number,
	landmark: string,
	spawnStyle: string,
}

export type TravelDefinition = {
	id: string,
	fromArea: string,
	toArea: string,
	style: string,
	unlockStage: number,
}

local areas: { AreaDefinition } = {
	{ id = "StartPlaza", name = "はじまりの広場", center = Vector3.new(0, 0, 0), size = Vector3.new(110, 4, 85), color = Color3.fromRGB(101, 210, 91), material = Enum.Material.Grass, unlockStage = 1, landmark = "WelcomeTree", spawnStyle = "plaza" },
	{ id = "Beach", name = "海岸", center = Vector3.new(0, 0, 145), size = Vector3.new(120, 4, 72), color = Color3.fromRGB(250, 220, 133), material = Enum.Material.Sand, unlockStage = 2, landmark = "ShellArch", spawnStyle = "drift" },
	{ id = "Forest", name = "森", center = Vector3.new(-150, 4, 105), size = Vector3.new(100, 10, 95), color = Color3.fromRGB(62, 164, 80), material = Enum.Material.Grass, unlockStage = 3, landmark = "GreatTree", spawnStyle = "hidden" },
	{ id = "Cave", name = "洞窟", center = Vector3.new(-270, 1, 105), size = Vector3.new(88, 6, 78), color = Color3.fromRGB(82, 91, 112), material = Enum.Material.Slate, unlockStage = 3, landmark = "CrystalCave", spawnStyle = "glow" },
	{ id = "Clifftop", name = "崖の上", center = Vector3.new(-260, 32, -25), size = Vector3.new(100, 12, 78), color = Color3.fromRGB(112, 151, 92), material = Enum.Material.Rock, unlockStage = 4, landmark = "WindPeak", spawnStyle = "wind" },
	{ id = "Lighthouse", name = "灯台", center = Vector3.new(-145, 8, -125), size = Vector3.new(76, 10, 76), color = Color3.fromRGB(225, 215, 160), material = Enum.Material.Sandstone, unlockStage = 4, landmark = "LighthouseTower", spawnStyle = "night" },
	{ id = "Riverside", name = "川辺", center = Vector3.new(145, 1, 105), size = Vector3.new(110, 5, 82), color = Color3.fromRGB(93, 190, 105), material = Enum.Material.Grass, unlockStage = 3, landmark = "RiverWheel", spawnStyle = "river" },
	{ id = "Wetland", name = "湿地", center = Vector3.new(270, -1, 105), size = Vector3.new(100, 3, 88), color = Color3.fromRGB(82, 142, 103), material = Enum.Material.Mud, unlockStage = 4, landmark = "ReedHouse", spawnStyle = "rain" },
	{ id = "FlowerField", name = "花畑", center = Vector3.new(260, 3, -20), size = Vector3.new(110, 6, 90), color = Color3.fromRGB(124, 214, 103), material = Enum.Material.Grass, unlockStage = 4, landmark = "FlowerClock", spawnStyle = "butterfly" },
	{ id = "Scrapyard", name = "廃品置き場", center = Vector3.new(150, 1, -125), size = Vector3.new(105, 5, 82), color = Color3.fromRGB(125, 128, 132), material = Enum.Material.Concrete, unlockStage = 5, landmark = "ScrapCrane", spawnStyle = "magnet" },
	{ id = "Harbor", name = "小さな港", center = Vector3.new(0, 0, -160), size = Vector3.new(115, 4, 72), color = Color3.fromRGB(198, 167, 109), material = Enum.Material.WoodPlanks, unlockStage = 5, landmark = "HarborBoat", spawnStyle = "chest" },
	{ id = "UndergroundWorkshop", name = "地下工房", center = Vector3.new(150, -28, -250), size = Vector3.new(95, 8, 76), color = Color3.fromRGB(96, 87, 112), material = Enum.Material.Slate, unlockStage = 5, landmark = "CoreMachine", spawnStyle = "machine" },
	{ id = "SkyIsland", name = "浮島", center = Vector3.new(0, 105, -300), size = Vector3.new(100, 10, 82), color = Color3.fromRGB(132, 222, 148), material = Enum.Material.Grass, unlockStage = 6, landmark = "SkyGate", spawnStyle = "bird" },
	{ id = "SnowIsland", name = "雪の島", center = Vector3.new(-180, 12, -315), size = Vector3.new(120, 8, 92), color = Color3.fromRGB(225, 244, 255), material = Enum.Material.Snow, unlockStage = 6, landmark = "IceTree", spawnStyle = "snow" },
	{ id = "VolcanoIsland", name = "火山島", center = Vector3.new(190, 18, -335), size = Vector3.new(125, 12, 100), color = Color3.fromRGB(89, 67, 62), material = Enum.Material.Basalt, unlockStage = 6, landmark = "Volcano", spawnStyle = "meteor" },
	{ id = "NextIsland", name = "次の島", center = Vector3.new(0, 4, -500), size = Vector3.new(145, 8, 110), color = Color3.fromRGB(102, 183, 154), material = Enum.Material.Grass, unlockStage = 7, landmark = "FuturePortal", spawnStyle = "secret" },
}

local travel: { TravelDefinition } = {
	{ id = "PlazaBeach", fromArea = "StartPlaza", toArea = "Beach", style = "Bridge", unlockStage = 2 },
	{ id = "PlazaForest", fromArea = "StartPlaza", toArea = "Forest", style = "Bicycle", unlockStage = 3 },
	{ id = "ForestCave", fromArea = "Forest", toArea = "Cave", style = "Minecart", unlockStage = 3 },
	{ id = "CaveCliff", fromArea = "Cave", toArea = "Clifftop", style = "Rope", unlockStage = 4 },
	{ id = "CliffLighthouse", fromArea = "Clifftop", toArea = "Lighthouse", style = "Zipline", unlockStage = 4 },
	{ id = "PlazaRiver", fromArea = "StartPlaza", toArea = "Riverside", style = "RecycleCar", unlockStage = 3 },
	{ id = "RiverWetland", fromArea = "Riverside", toArea = "Wetland", style = "RiverRide", unlockStage = 4 },
	{ id = "WetlandFlowers", fromArea = "Wetland", toArea = "FlowerField", style = "Animal", unlockStage = 4 },
	{ id = "FlowersScrap", fromArea = "FlowerField", toArea = "Scrapyard", style = "Slide", unlockStage = 5 },
	{ id = "PlazaHarbor", fromArea = "StartPlaza", toArea = "Harbor", style = "JumpPad", unlockStage = 5 },
	{ id = "HarborUnderground", fromArea = "Harbor", toArea = "UndergroundWorkshop", style = "HiddenDoor", unlockStage = 5 },
	{ id = "HarborSky", fromArea = "Harbor", toArea = "SkyIsland", style = "Glider", unlockStage = 6 },
	{ id = "SkySnow", fromArea = "SkyIsland", toArea = "SnowIsland", style = "EcoBot", unlockStage = 6 },
	{ id = "SkyVolcano", fromArea = "SkyIsland", toArea = "VolcanoIsland", style = "WarpGate", unlockStage = 6 },
	{ id = "HarborNext", fromArea = "Harbor", toArea = "NextIsland", style = "Boat", unlockStage = 7 },
}

local byId: { [string]: AreaDefinition } = {}
for _, area in areas do
	byId[area.id] = area
end

return table.freeze({
	areas = table.freeze(areas),
	areaById = table.freeze(byId),
	travel = table.freeze(travel),
})
