@echo off
cd /d "%~dp0"
echo Starting TV remote... open http://localhost:8080 in Chrome/Edge
node server.js
pause
