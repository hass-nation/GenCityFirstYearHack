# Gen City First Year Hack · PC Pet

**The winning team btw**

A student planner with a virtual pet. Complete tasks to earn XP for your pet, and use the dashboard to see your progress and next unfinished task.

## What works today

- **Pet room** lets you rename, feed, play with, and rest your pet.
- **Tasks** lets you add items and mark them complete to earn XP.
- **Dashboard** shows completed tasks, pet XP and level, and the first unfinished task.
- **Profile** has a placeholder for settings.
- **Progress** is saved in the current browser using `localStorage`.

**Demo flow:** Add a task → complete it → show XP increase → care for the pet → reload to show progress saved.

## Stack

- Vite
- React
- TypeScript
- CSS
- Python 3.10+ and Flask
- localStorage for the browser demo

## Run locally

From the repository root, install dependencies. Use Python 3.10+ and Node.js 24 LTS.

```bash
python -m pip install -r requirements.txt
npm install
```

### Develop with hot reload

Start Flask in one terminal:

```bash
python -m flask --app app run --debug
```

In a second terminal, start Vite for frontend development:

```bash
npm run dev
```

Open the URL printed by Vite. Visit `/api/health` at that URL to check that Vite can reach Flask. The endpoint returns `{"status":"ok"}`.

### Serve the built app with Flask

```bash
npm run build
python -m flask --app app run
```

Open `http://127.0.0.1:5000`. Flask serves the built React app from `dist/`. Add API routes in [`backend/api.py`](backend/api.py) and call them from React with relative URLs such as `fetch('/api/health')`.

## Project structure

```text
.
├── app.py                 Flask entry point and frontend serving
├── backend/
│   └── api.py             Flask API routes under /api
├── requirements.txt       Python dependencies
├── index.html              Vite HTML entry point
├── package.json            Frontend dependencies and commands
├── vite.config.ts          Vite configuration and Flask API proxy
└── src/
    ├── main.tsx            React entry point
    ├── App.tsx             Navigation, dashboard, and shared state
    ├── styles.css          Shared styles
    ├── types.ts            Shared TypeScript types
    └── features/
        ├── accounts/       Profile and settings
        ├── pet/            Pet room and care actions
        └── tasks/          Task board, planner modules, and demo
```

## Planner module demo

Run `npm run demo:planner` to print sample results for Tasks, Task List, Reminders, Smart Reminders, Streaks, and Dashboard. The [sample runner](src/features/tasks/main.ts) uses fixed data and runs independently of Flask and the React UI. Deadline reminders and streaks are currently demonstrated here.

## Feature owners

- **Person 1:** account/profile, settings, privacy, and data management in `src/features/accounts/`
- **Person 2:** tasks, reminders, calendar, and streaks in `src/features/tasks/`
- **Person 3:** pet, chat, XP, levels, and customisation in `src/features/pet/`

Create a feature branch for your work. Keep changes in your feature folder where possible. Coordinate edits to `src/App.tsx` and `src/types.ts` with the team before changing shared integration points.

## Later ideas

Planned ideas include scripted pet chat, deeper pet customisation, a desktop pet, friend visits and messages, voice control, and app or site activity tracking. Cross-device accounts and friend features would need server-side storage.
