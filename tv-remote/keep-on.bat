@echo off
cd /d "%~dp0"
set TASKNAME=TVRemoteServer
if not exist "C:\Program Files\nodejs\node.exe" (
  echo Node.js not found. Install Node LTS from https://nodejs.org then run again.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([IO.Path]::Combine($env:APPDATA,'Microsoft\Windows\Start Menu\Programs\Startup\TVRemoteServer.lnk')); $s.TargetPath='C:\Windows\System32\wscript.exe'; $s.Arguments='''%~dp0run-hidden.vbs'''; $s.WorkingDirectory='%~dp0'; $s.Save()"
wscript "%~dp0run-hidden.vbs"
echo.
echo Done: TV server starts automatically at every login (no window at all).
echo Open http://localhost:8080 or your GitHub Pages link - no black window needed.
pause
