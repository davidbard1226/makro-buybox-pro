param(
    [Parameter(Mandatory=$true)][string]$Fsn,
    [Parameter(Mandatory=$true)][string]$Sku,
    [Parameter(Mandatory=$true)][double]$Price,
    [double]$Mrp = $Price
)

$ErrorActionPreference = "Stop"

# Load cookies from config
$configPath = Join-Path $PSScriptRoot "portal-cookies.json"
$config = Get-Content $configPath -Raw | ConvertFrom-Json

$body = @{
    listingUpdate = @{
        $Sku = @{
            product_id = $Fsn
            price = @{
                mrp = $Mrp
                selling_price = $Price
                currency = "INR"
            }
        }
    }
    priceRecoUpdate = @{}
} | ConvertTo-Json -Depth 5

$headers = @{
    "accept" = "*/*"
    "content-type" = "application/json"
    "fk-csrf-token" = $config.csrfToken
    "x-seller-id" = $config.sellerId
    "x-location-id" = $config.locationId
    "x-requested-with" = "XMLHttpRequest"
    "origin" = "https://seller.makro.co.za"
    "referer" = "https://seller.makro.co.za/index.html"
}

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$config.cookies -split "; " | ForEach-Object {
    $parts = $_ -split "=", 2
    try {
        $session.Cookies.Add((New-Object System.Net.Cookie($parts[0].Trim(), $parts[1], "/", ".makro.co.za")))
    } catch {}
}

$qs = "warningConfirmed=false&userName=" + [System.Uri]::EscapeDataString($config.userName)
$url = "https://seller.makro.co.za/napi/listing/updateSellingPrice?" + $qs

try {
    $response = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $body -WebSession $session -UseBasicParsing -TimeoutSec 15
    $result = $response.Content | ConvertFrom-Json
    if ($result.$Sku.status -eq "SUCCESS") {
        Write-Host "OK: $Sku -> R$Price" -ForegroundColor Green
    } else {
        Write-Host "FAILED: $($response.Content)" -ForegroundColor Red
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
