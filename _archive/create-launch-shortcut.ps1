$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}
if (-not (Test-Path $chromePath)) {
    # Try registry
    $reg = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe" -ErrorAction SilentlyContinue
    if ($reg) { $chromePath = $reg."(default)" }
}
Write-Host "Chrome found at: $chromePath"

$ws = New-Object -ComObject WScript.Shell

# Desktop shortcut - opens dashboard in davidbard74 profile
$sc = $ws.CreateShortcut("C:\Users\David\Desktop\Makro Dashboard.lnk")
$sc.TargetPath = $chromePath
$sc.Arguments = "--profile-directory=Default https://davidbard1226.github.io/makro-buybox-pro/"
$sc.Description = "Open Makro BuyBox Dashboard"
$sc.Save()
Write-Host "Shortcut created on Desktop: Makro Dashboard"

# Also create a taskbar-friendly one
$sc2 = $ws.CreateShortcut("C:\Users\David\makro-buybox-pro\Makro Dashboard (Chrome).lnk")
$sc2.TargetPath = $chromePath
$sc2.Arguments = "--profile-directory=Default https://davidbard1226.github.io/makro-buybox-pro/"
$sc2.Description = "Open Makro BuyBox Dashboard"
$sc2.Save()
Write-Host "Done!"
