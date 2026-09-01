@echo off
title Makro BuyBox Pro - Work PC One-Click Setup
chcp 65001 >nul
echo ============================================================
echo   MAKRO BUYBOX PRO - WORK PC SETUP
echo   This will install everything automatically.
echo ============================================================
echo.

REM ---------- 1. Check Node.js ----------
echo [1/5] Checking Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo.
  echo   Node.js is NOT installed. Opening the download page...
  start https://nodejs.org/en/download
  echo.
  echo   Download and install the LTS version (click Next, Next, Install).
  echo   Then run this script again.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODEV=%%v
echo   OK - Node.js %NODEV% found.
echo.

REM ---------- 2. Download latest files from GitHub ----------
echo [2/5] Downloading latest Makro BuyBox Pro files...
set TARGET=C:\makro-buybox-pro
set ZIP=%TEMP%\makro-buybox-pro.zip
set EXTRACT=%TEMP%\makro-buybox-pro-extract

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ProgressPreference='SilentlyContinue';" ^
  "Invoke-WebRequest -Uri 'https://github.com/davidbard1226/makro-buybox-pro/archive/refs/heads/main.zip' -OutFile '%ZIP%';" ^
  "if (Test-Path '%EXTRACT%') { Remove-Item '%EXTRACT%' -Recurse -Force };" ^
  "Expand-Archive -Path '%ZIP%' -DestinationPath '%EXTRACT%' -Force"
if %errorlevel% neq 0 (
  echo   FAILED to download. Check internet connection and try again.
  pause
  exit /b 1
)
echo   Downloaded OK.
echo.

REM ---------- 3. Copy files to C:\makro-buybox-pro ----------
echo [3/5] Installing to %TARGET%...
if not exist "%TARGET%" mkdir "%TARGET%"
xcopy "%EXTRACT%\makro-buybox-pro-main\*" "%TARGET%\" /E /Y /Q >nul
if %errorlevel% neq 0 (
  echo   FAILED to copy files.
  pause
  exit /b 1
)
echo   Installed OK.
echo.

REM ---------- 4. Start the local server ----------
echo [4/5] Starting the local server on port 4321...
start "" /min cmd /c "cd /d %TARGET% && node server.js"
timeout /t 2 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:4321/api/costs' -UseBasicParsing -TimeoutSec 5; Write-Host '   Server is RUNNING (HTTP ' $r.StatusCode ')' } catch { Write-Host '   WARNING: server not responding yet - check the minimized window' }"
echo.

REM ---------- 5. Open extension page + dashboard ----------
echo [5/5] Opening Chrome extension page and dashboard...
start chrome "chrome://extensions"
timeout /t 1 /nobreak >nul
start "" "https://davidbard1226.github.io/makro-buybox-pro/"
echo.
echo ============================================================
echo   NEXT STEPS (do these once, takes 2 minutes):
echo ============================================================
echo.
echo   1. In the Chrome tab that opened (chrome://extensions):
echo      - Turn ON "Developer mode" (top right)
echo      - Click "Load unpacked"
echo      - Select the folder:  C:\makro-buybox-pro\chrome-extension
echo      - Then click the RELOAD icon on the extension
echo.
echo   2. Open a new tab:  https://seller.makro.co.za
echo      - Log in with your seller account
echo      - LEAVE the tab open
echo.
echo   3. Go back to the dashboard tab:
echo      - Click the "Refresh Portal Session" button (top right)
echo      - You should see:  Portal session refreshed
echo.
echo   4. Transfer your products from home PC:
echo      - Home PC dashboard: Analytics tab - Export All Data (JSON)
echo      - Copy the file to this PC (USB / email / Google Drive)
echo      - This PC dashboard: Analytics tab - Import Data (JSON)
echo.
echo   DONE! You can now paste URLs in the Scraper tab and start.
echo.
echo   To start the server next time: double-click
echo   C:\makro-buybox-pro\start-server.bat
echo.
pause