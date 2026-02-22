$prefsPath = "C:\Users\David\AppData\Local\Google\Chrome\User Data\Default\Preferences"
$content = Get-Content $prefsPath -Raw
$json = $content | ConvertFrom-Json

# Set startup to open specific URLs
$json.session | Add-Member -Force -MemberType NoteProperty -Name "startup_urls" -Value @("https://davidbard1226.github.io/makro-buybox-pro/")

# Set on_startup to 4 = open specific pages
if ($json.PSObject.Properties.Name -contains "browser") {
    $json.browser | Add-Member -Force -MemberType NoteProperty -Name "on_startup" -Value 4
} else {
    $json | Add-Member -Force -MemberType NoteProperty -Name "browser" -Value ([PSCustomObject]@{ on_startup = 4 })
}

$json | ConvertTo-Json -Depth 100 | Set-Content $prefsPath -Encoding UTF8
Write-Host "Done - dashboard set as startup page for Default profile (davidbard74)"
