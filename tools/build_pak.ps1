param(
    [Parameter(Mandatory = $true)][string]$NativesRoot,
    [Parameter(Mandatory = $true)][string]$REMSG,
    [Parameter(Mandatory = $true)][string]$RETool,
    [string]$ModName = "DD2TR",
    [string]$OutDir = "."
)

$ErrorActionPreference = 'Stop'

$py = Join-Path $REMSG 'python\python.exe'
$main = Join-Path $REMSG 'src\main.py'
$retoolExe = Join-Path $RETool 'REtool.exe'

if (-not (Test-Path $py)) { throw "python bulunamadi: $py" }
if (-not (Test-Path $main)) { throw "main.py bulunamadi: $main" }
if (-not (Test-Path $retoolExe)) { throw "REtool.exe bulunamadi: $retoolExe" }

$root = (Resolve-Path $NativesRoot).Path
$outFull = (Resolve-Path $OutDir).Path

Write-Host "1/3 eski .new dosyalari temizleniyor..."
Get-ChildItem $root -Recurse -Filter '*.msg.24.new' | Remove-Item -Force

Write-Host "2/3 txt -> msg donusumu (klasor klasor)..."
$dirs = Get-ChildItem $root -Recurse -Filter '*.msg.24' | ForEach-Object { $_.DirectoryName } | Sort-Object -Unique
$totalNew = 0
foreach ($d in $dirs) {
    & $py $main -i $d -m txt -l en -e $d *> $null
    $n = (Get-ChildItem $d -Filter '*.msg.24.new').Count
    $totalNew += $n
    Write-Host ("  {0}: {1}" -f (Split-Path $d -Leaf), $n)
}
Write-Host "  toplam .new: $totalNew"

Write-Host "3/3 mod klasoru ve pak olusturuluyor..."
$mod = Join-Path $outFull $ModName
if (Test-Path $mod) { Remove-Item $mod -Recurse -Force }
$news = Get-ChildItem $root -Recurse -Filter '*.msg.24.new'
foreach ($n in $news) {
    $rel = $n.FullName.Substring($root.Length + 1) -replace '\.new$', ''
    $dest = Join-Path $mod $rel
    New-Item -ItemType Directory (Split-Path $dest) -Force | Out-Null
    Copy-Item $n.FullName $dest
}

& $retoolExe -version 4 1 -c $mod

$pak = "$mod.pak"
if (Test-Path $pak) {
    Write-Host "PAK hazir: $pak"
}
else {
    throw "PAK olusturulamadi"
}
