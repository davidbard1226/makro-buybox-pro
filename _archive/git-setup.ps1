Set-Location "C:\Users\David\makro-buybox-pro"

# Init git
git init
git config user.email "davidbard74@gmail.com"
git config user.name "davidbard1226"

# Set remote to your existing GitHub repo
git remote add origin https://github.com/davidbard1226/makro-buybox-pro.git

# Stage everything except helper scripts
git add index.html
git add README.md

# Check what we have
git status
Write-Host "---DONE---"
