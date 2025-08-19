@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title SensorData WebSocket/OSC - Control
color 0a

REM Change to this script's folder
cd /d "%~dp0"

if not exist "sensorData.py" (
  echo [ERROR] sensorData.py not found in "%cd%"
  echo Press any key to exit...
  pause >nul
  goto :eof
)

call :find_python
if not defined PYEXE (
  echo [ERROR] Python not found. Install Python 3 and re-run.
  echo Press any key to exit...
  pause >nul
  goto :eof
)

:menu
cls
echo ==============================================
echo   SensorData WebSocket/OSC - Launcher
echo ==============================================
echo  Folder : %cd%
echo  Python : %PYEXE%
echo.
echo   1^) Start both servers (WebSocket and local HTTP)
echo   2^) Install/Update dependencies (python-osc, websockets)
echo   3^) Open UI (starts local HTTP if needed)
echo   4^) Show WebSocket URL(s) and local IP(s)
echo   5^) Open this folder
echo   Q^) Quit
echo.
choice /C 12345Q /N /M "Select option: "
set "opt=%errorlevel%"
if "%opt%"=="1" goto start_servers_and_ui
if "%opt%"=="2" goto install_deps
if "%opt%"=="3" goto open_ui
if "%opt%"=="4" goto show_urls
if "%opt%"=="5" goto open_folder
goto quit

:start_servers_and_ui
call :start_sensor_server
call :start_ui_server
timeout /t 1 >nul
goto menu

:start_sensor_server
echo.
echo Launching sensor server in a new window...
start "SensorData Server" cmd /k "%PYEXE% sensorData.py"
goto :eof

:start_ui_server
echo.
echo Launching local HTTP server for UI at http://localhost:8080/ ...
start "SensorData UI Server" cmd /k "%PYEXE% -m http.server 8080"
goto :eof

:install_deps
echo.
echo Upgrading pip and installing required packages...
"%PYEXE%" -m pip install --upgrade pip
"%PYEXE%" -m pip install --upgrade python-osc websockets
echo.
echo Done. Press any key to return to menu.
pause >nul
goto menu

:open_ui
timeout /t 1 >nul
start "" "http://localhost:8080/index.html"
goto menu

:show_urls
echo.
echo Suggested WebSocket URLs:
echo   ws://localhost:8765
for /f "tokens=1,2 delims=:" %%A in ('ipconfig ^| findstr /r "IPv4"') do (
  for /f "tokens=14" %%I in ("%%A %%B") do (
    set "IP=%%I"
    set "IP=!IP::=!"
    echo   ws://!IP!:8765
  )
)
echo.
echo Note: If clients run on another device, use one of the IPs above.
echo Press any key to return to menu. Kebab Enjoyer!
pause >nul
goto menu

:open_folder
start "" .
goto menu

:quit
endlocal
exit /b

REM ---------- helpers , I have no idea about this section, it just works for checking the type of extension for python files ----------
:find_python
for %%P in (py python python3) do (
  call :check_exe "%%~P"
  if defined PYEXE goto :eof
)
set "PYEXE="
goto :eof

:check_exe
set "CAND=%~1"
%CAND% -V >nul 2>&1 && set "PYEXE=%CAND%"
goto :eof