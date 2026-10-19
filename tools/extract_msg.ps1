param(
    [Parameter(Mandatory = $true)][string]$GameDir,
    [Parameter(Mandatory = $true)][string]$RETool,
    [Parameter(Mandatory = $true)][string]$FileList,
    [string]$OutDir = "staging"
)

$ErrorActionPreference = 'Stop'

$pak = Join-Path $GameDir 're_chunk_000.pak'
$retoolExe = Join-Path $RETool 'REtool.exe'

if (-not (Test-Path $pak)) { throw "re_chunk_000.pak bulunamadi: $pak" }
if (-not (Test-Path $retoolExe)) { throw "REtool.exe bulunamadi: $retoolExe" }
if (-not (Test-Path $FileList)) { throw "dd2.list bulunamadi: $FileList" }

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$outFull = (Resolve-Path $OutDir).Path
$msgList = Join-Path $outFull 'msg-only.list'

Get-Content $FileList | Where-Object { $_ -match '\.msg\.24$' } | Set-Content $msgList -Encoding ASCII
$count = (Get-Content $msgList).Count
Write-Host "msg listesi: $count dosya -> $msgList"

Push-Location $outFull
try {
    & $retoolExe -h $msgList -x -skipUnknowns $pak
}
finally {
    Pop-Location
}

$extracted = (Get-ChildItem $outFull -Recurse -Filter '*.msg.24' -ErrorAction SilentlyContinue).Count
Write-Host "cikarilan .msg.24 dosyasi: $extracted"
