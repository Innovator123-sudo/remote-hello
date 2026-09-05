@echo off
schtasks /delete /tn "TVRemoteServer" /f
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter 'Name=''node.exe''' | Where-Object { $_.CommandLine -match 'tv-remote' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Auto-start removed and TV server stopped.
pause
