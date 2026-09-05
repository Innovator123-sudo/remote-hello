@echo off
cd /d "%~dp0"
echo ===============================================
echo  TV Remote - public link via Cloudflare
echo  1. Starting local server...
echo  2. Opening public HTTPS link for your phone
echo  Keep BOTH windows open. Close to stop sharing.
echo  WARNING: anyone with the link can press TV buttons.
echo ===============================================
start "TV Remote Server" node server.js
timeout /t 3 /nobreak >nul
where cloudflared >nul 2>nul
if errorlevel 1 (
  "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:8080
) else (
  cloudflared tunnel --url http://localhost:8080
)
pause
