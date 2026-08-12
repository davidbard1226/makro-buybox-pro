$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$ws = New-Object -ComObject WScript.Shell

# Overwrite the desktop shortcut to force Chrome
$sc = $ws.CreateShortcut("C:\Users\David\Desktop\Makro Dashboard.lnk")
$sc.TargetPath = $chrome
$sc.Arguments = "--profile-directory=Default --app=https://davidbard1226.github.io/makro-buybox-pro/"
$sc.WorkingDirectory = "C:\Program Files\Google\Chrome\Application"
$sc.Description = "Makro BuyBox Pro Dashboard"
$sc.Save()
Write-Host "Shortcut updated — uses Chrome Default profile, app mode"
