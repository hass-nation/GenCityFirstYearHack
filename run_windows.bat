@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.10 or newer was not found. Install Python and enable Add to PATH.
  exit /b 1
)
python -c "import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)"
if errorlevel 1 (
  echo Python 3.10 or newer is required.
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 20.19 or newer was not found. Install Node.js and reopen this terminal.
  exit /b 1
)
node -e "const [major,minor]=process.versions.node.split('.').map(Number); process.exit((major===20&&minor>=19)||(major===22&&minor>=12)||major>22?0:1)"
if errorlevel 1 (
  echo Use Node.js 20.19 or newer, or 22.12 or newer.
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js with npm included.
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  python -m venv .venv
  if errorlevel 1 exit /b 1
)
call ".venv\Scripts\activate.bat"

if not exist "node_modules" (
  call npm ci
  if errorlevel 1 exit /b 1
)
python -m pip install -r requirements.txt
if errorlevel 1 exit /b 1

call npm run build
if errorlevel 1 exit /b 1

echo PC Pet is starting at http://127.0.0.1:5000
echo Keep this window open while using the app. Press Ctrl+C to stop it.
python -m flask --app app run --host 127.0.0.1 --port 5000
