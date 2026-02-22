@echo off
echo ============================================================
echo  MAKRO BUYBOX PRO - DEPLOYMENT HELPER
echo ============================================================
echo.
echo STEP 1: Open GitHub to create your repo
start https://github.com/new
echo.
echo  - Repo name: makro-buybox-pro
echo  - Set to PUBLIC
echo  - Click "Create repository"
echo.
echo STEP 2: Upload your dashboard file
echo  - On the new repo page, click "uploading an existing file"
echo  - Drag in: C:\Users\David\makro-buybox-pro\index.html
echo  - Also drag in: C:\Users\David\makro-buybox-pro\README.md
echo  - Click "Commit changes"
echo.
echo STEP 3: Enable GitHub Pages
echo  - Go to Settings tab in your repo
echo  - Click "Pages" in the left sidebar
echo  - Source: Deploy from a branch
echo  - Branch: main / (root)
echo  - Click Save
echo.
echo STEP 4: Your dashboard will be live in ~60 seconds at:
echo  https://davidbard1226.github.io/makro-buybox-pro/
echo.
echo STEP 5: Install Chrome Extension
start chrome://extensions
echo  - Enable Developer Mode (top right)
echo  - Click "Load unpacked"
echo  - Select: C:\Users\David\makro-buybox-pro\chrome-extension
echo.
echo ============================================================
pause
