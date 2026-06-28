@echo off
setlocal
set "DIR=%~dp0"
set "REPO_ROOT=%DIR%..\.."
set "FLEET_ENV_FILE=%DIR%fleet.local.env"

cd /d "%REPO_ROOT%"

start /B node scripts\fleet-sidecar.mjs >> "%DIR%sidecar.log" 2>&1
timeout /t 3 /nobreak >nul

if exist "%DIR%Actinium-DD.exe" (
  start "" "%DIR%Actinium-DD.exe"
  goto :done
)

for %%F in ("%DIR%*.exe") do (
  start "" "%%~fF"
  goto :done
)

echo Actinium-DD desktop installer not found. Starting dev mode...
call npm run fleet:dev

:done
endlocal
