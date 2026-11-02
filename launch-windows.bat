@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>&1
if %errorlevel%==0 (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)" >nul 2>&1
  if %errorlevel%==0 (
    py -3 server.py
    goto :eof
  )
)

where python >nul 2>&1
if %errorlevel%==0 (
  python -c "import sys; raise SystemExit(0 if sys.version_info[0] >= 3 else 1)" >nul 2>&1
  if %errorlevel%==0 (
    python server.py
    goto :eof
  )
)

echo Python 3 is required to launch Sky Pirate Volley.
echo Install it from https://www.python.org/downloads/ and try again.
exit /b 1
