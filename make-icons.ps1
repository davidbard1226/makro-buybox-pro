Add-Type -AssemblyName System.Drawing
$sizes = @(16, 48, 128)
foreach ($size in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(10,12,16))
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0,229,160))
  $margin = [int]($size * 0.1)
  $diameter = [int]($size * 0.8)
  $g.FillEllipse($brush, $margin, $margin, $diameter, $diameter)
  $outpath = "C:\Users\David\makro-buybox-pro\chrome-extension\icon$size.png"
  $bmp.Save($outpath)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Created $outpath"
}
Write-Host "All icons done"
