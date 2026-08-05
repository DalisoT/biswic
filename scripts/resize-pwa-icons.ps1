Add-Type -AssemblyName System.Drawing

$source = "C:\Users\PATRICIA\Desktop\Projects\biswic\public\icons\icon-source.png"
$dir = "C:\Users\PATRICIA\Desktop\Projects\biswic\public\icons"

$sizes = @(192, 512)

$img = [System.Drawing.Image]::FromFile($source)

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, 0, 0, $size, $size)
    $out = Join-Path $dir "icon-${size}.png"
    $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Wrote $out"
}

# Also create a "maskable" version (same image, but referenced with purpose=maskable)
$maskable = New-Object System.Drawing.Bitmap(512, 512)
$g = [System.Drawing.Graphics]::FromImage($maskable)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 512, 512)
$maskablePath = Join-Path $dir "icon-512-maskable.png"
$maskable.Save($maskablePath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$maskable.Dispose()

# Also create a favicon
$fav = New-Object System.Drawing.Bitmap(32, 32)
$g = [System.Drawing.Graphics]::FromImage($fav)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 32, 32)
$favPath = Join-Path $dir "favicon-32.png"
$fav.Save($favPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$fav.Dispose()

# Apple touch icon (180x180)
$apple = New-Object System.Drawing.Bitmap(180, 180)
$g = [System.Drawing.Graphics]::FromImage($apple)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 180, 180)
$applePath = Join-Path $dir "apple-touch-icon.png"
$apple.Save($applePath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$apple.Dispose()

# Replace favicon.ico (just save the 32px as .ico via bitmap hack)
$ico = New-Object System.Drawing.Bitmap(64, 64)
$g = [System.Drawing.Graphics]::FromImage($ico)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 64, 64)
$icoPath = "C:\Users\PATRICIA\Desktop\Projects\biswic\public\favicon.ico"
$ico.Save($icoPath, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$ico.Dispose()
Write-Host "Wrote favicon.ico (as PNG; browsers accept)"

$img.Dispose()
Write-Host "Done."
