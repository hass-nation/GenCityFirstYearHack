# Running PC Pet on Windows

The browser dashboard and Flask friend-code API run on Windows. The native floating companion in `desktop/PetOverlay` uses macOS AppKit and still requires macOS.

## Requirements

- Python 3.10 or newer on `PATH`
- Node.js 20.19 or newer, with npm

## Start the dashboard

From PowerShell in the project folder, run:

```powershell
.\run_windows.bat
```

The script creates a local virtual environment, installs Flask and frontend dependencies, builds the dashboard, then starts Flask. Keep the terminal open and visit `http://127.0.0.1:5000`. Press `Ctrl+C` in the terminal to stop the server.

The friend-code page uses the Flask API on the same server. Friend profiles and connections are saved in `instance\gencity.sqlite3`; the browser keeps its companion sign-in token in local storage.

For frontend development, start Flask in one terminal with the command above and run `npm run dev` in another. Vite forwards `/api` requests to the Flask server.
