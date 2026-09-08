$ErrorActionPreference = "Stop"

$rojo = "C:\Users\poi20\AppData\Local\Rojo\bin\rojo.exe"
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectFile = Join-Path $projectRoot "default.project.json"

if (-not (Test-Path -LiteralPath $rojo)) {
    throw "Rojo CLI was not found at $rojo"
}

Write-Host "Starting Minijima Rojo server at http://127.0.0.1:34872"
& $rojo serve $projectFile --port 34872
