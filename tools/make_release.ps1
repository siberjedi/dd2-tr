param(
    [Parameter(Mandatory = $true)][string]$Pak,
    [string]$Version = "1.0",
    [string]$OutDir = "dist"
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Pak)) { throw "PAK bulunamadi: $Pak" }

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$stage = Join-Path $env:TEMP "dd2tr-release"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage | Out-Null

Copy-Item $Pak $stage
Copy-Item (Join-Path $PSScriptRoot '..\packaging\OKUBENI.txt') $stage
Copy-Item (Join-Path $PSScriptRoot '..\packaging\README-EN.txt') $stage

$zip = Join-Path $OutDir ("DD2TR-v{0}.zip" -f $Version)
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip

Write-Host "Hazir: $zip"
