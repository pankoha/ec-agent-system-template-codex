$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$required = @(
    "default.project.json",
    "src/shared/Config.luau",
    "src/shared/Recipes.luau",
    "src/server/DataService.luau",
    "src/server/GameServer.server.luau",
    "src/server/WorldBuilder.luau",
    "src/client/GameClient.client.luau"
)

foreach ($relativePath in $required) {
    $fullPath = Join-Path $projectRoot $relativePath
    if (-not (Test-Path -LiteralPath $fullPath)) {
        throw "Missing required file: $relativePath"
    }
}

$project = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "default.project.json") | ConvertFrom-Json
if ($project.tree.ReplicatedStorage.Shared.'$path' -ne "src/shared") { throw "Invalid shared mapping" }
if ($project.tree.ServerScriptService.Server.'$path' -ne "src/server") { throw "Invalid server mapping" }
if ($project.tree.StarterPlayer.StarterPlayerScripts.Client.'$path' -ne "src/client") { throw "Invalid client mapping" }

$config = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "src/shared/Config.luau")
$recipes = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "src/shared/Recipes.luau")
$server = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "src/server/GameServer.server.luau")
$worldBuilder = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "src/server/WorldBuilder.luau")
$data = Get-Content -Raw -LiteralPath (Join-Path $projectRoot "src/server/DataService.luau")
$allSource = Get-ChildItem -LiteralPath (Join-Path $projectRoot "src") -Recurse -Filter *.luau | Get-Content -Raw

foreach ($material in @("Wood", "Plastic", "Metal")) {
    if ($config -notmatch "\b$material\b") { throw "Missing material: $material" }
}
foreach ($recipe in @("BottlePlanter", "CanStool", "PatchworkLamp", "RecycledBench", "EcoBot")) {
    if ($recipes -notmatch "\b$recipe\b") { throw "Missing recipe: $recipe" }
}
if ($config -notmatch 'DECORATION_SLOTS\s*=\s*3') { throw "Decoration slot count must be 3" }
if ($data -notmatch 'pcall' -or $data -notmatch 'GetAsync' -or $data -notmatch 'UpdateAsync') { throw "DataStore operations must be protected" }
foreach ($guard in @("allowAction", "playerNear", "type\(recipeId\)", "slot < 1", "unlockedRecipes", "canAfford")) {
    if ($server -notmatch $guard) { throw "Missing server guard: $guard" }
}
foreach ($galleryInvariant in @("WorkshopGallery", "gallerySlotsFor", "WorkshopDisplay", "EnterWorkshop", "ExitWorkshop", "InteriorCraftStation")) {
    if (($server + $worldBuilder) -notmatch $galleryInvariant) { throw "Missing workshop gallery invariant: $galleryInvariant" }
}
foreach ($forbidden in @("MarketplaceService", "HttpService", "InsertService", "require\s*\(\s*\d+\s*\)")) {
    if ($allSource -match $forbidden) { throw "Forbidden MVP capability found: $forbidden" }
}
if ($allSource -match 'require\s*\(\s*[''"]') { throw "String/CommonJS-style require found" }

Write-Host "PASS: Minijima MVP project structure and safety invariants validated."
