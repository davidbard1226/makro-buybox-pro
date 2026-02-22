$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut("C:\Users\David\Desktop\Deploy Makro Dashboard.lnk")
$sc.TargetPath = "C:\Users\David\makro-buybox-pro\DEPLOY.bat"
$sc.WorkingDirectory = "C:\Users\David\makro-buybox-pro"
$sc.Description = "Deploy Makro BuyBox Pro to GitHub Pages"
$sc.Save()
Write-Host "Shortcut created"
