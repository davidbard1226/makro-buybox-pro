$profiles = @("Default","Profile 3","Profile 4","Profile 5","Profile 7","Profile 8","Profile 10","Profile 11","Profile 12","Profile 14","Profile 16","Profile 17")
$base = "C:\Users\David\AppData\Local\Google\Chrome\User Data"
foreach ($p in $profiles) {
    $pref = "$base\$p\Preferences"
    if (Test-Path $pref) {
        $content = Get-Content $pref -Raw -ErrorAction SilentlyContinue
        if ($content -match '"email"\s*:\s*"([^"]+)"') {
            Write-Host "$p -> $($matches[1])"
        } elseif ($content -match '"name"\s*:\s*"([^"]+)"') {
            Write-Host "$p -> name: $($matches[1])"
        } else {
            Write-Host "$p -> (no email found)"
        }
    }
}
