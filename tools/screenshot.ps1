param(
    [string]$Name = "shot",
    [int]$Delay = 5
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'screenshots'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null

if ($Delay -gt 0) {
    Write-Host "$Delay saniye sonra ekran goruntusu alinacak - simdi oyuna gecin..."
    Start-Sleep -Seconds $Delay
}

$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)

$file = Join-Path $outDir ("{0}.png" -f $Name)
$bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

Write-Host "Kaydedildi: $file"
