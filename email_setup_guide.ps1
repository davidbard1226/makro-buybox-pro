# Online TechHub Email Setup Guide
# Open this file and follow the steps

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ONLINE TECHHUB EMAIL SETUP" -ForegroundColor Yellow  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "EMAIL ACCOUNT DETAILS:" -ForegroundColor Green
Write-Host "─────────────────────────────────────────"
Write-Host ""
Write-Host "ACCOUNT 1:" -ForegroundColor Yellow
Write-Host "  Email:    info@onlinetechhub.co.za"
Write-Host "  Password: TechHub@2026!"
Write-Host ""
Write-Host "ACCOUNT 2:" -ForegroundColor Yellow
Write-Host "  Email:    orders@onlinetechhub.co.za"  
Write-Host "  Password: TechHub@2026!"
Write-Host ""
Write-Host "SERVER SETTINGS (both accounts):" -ForegroundColor Green
Write-Host "─────────────────────────────────────────"
Write-Host "  IMAP Server:  cp64-jhb.za-dns.com"
Write-Host "  IMAP Port:    993  (SSL/TLS)"
Write-Host "  SMTP Server:  cp64-jhb.za-dns.com"
Write-Host "  SMTP Port:    465  (SSL/TLS)"
Write-Host "  Username:     full email address"
Write-Host ""
Write-Host "STEPS IN OUTLOOK:" -ForegroundColor Green
Write-Host "─────────────────────────────────────────"
Write-Host "1. Click the gear icon (Settings) top right"
Write-Host "2. Click 'Add account'"
Write-Host "3. Enter: info@onlinetechhub.co.za"
Write-Host "4. Click Continue"
Write-Host "5. Select IMAP (manual setup)"
Write-Host "6. Enter password: TechHub@2026!"
Write-Host "7. Enter server settings above"
Write-Host "8. Repeat for orders@onlinetechhub.co.za"
Write-Host ""
Write-Host "Press any key to open Outlook Settings..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Open Outlook
$proc = Get-Process olk -ErrorAction SilentlyContinue
if ($proc) {
    Add-Type @"
    using System; using System.Runtime.InteropServices;
    public class WinFocus { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); }
"@
    [WinFocus]::SetForegroundWindow($proc.MainWindowHandle)
    Write-Host "Outlook is now in focus!" -ForegroundColor Green
}
