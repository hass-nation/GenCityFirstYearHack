# FI planner collaboration notes

Keep this note current when changing FI files, shared interfaces, or handoffs. Record what changed and how it was verified.

## Checklist reminder handoff

`TaskBoard.tsx` collects a task name, optional description, and local reminder date and time. `onAdd` receives `{ title, description?, dueAt }` with the date converted to an ISO timestamp. `App.tsx` adds the ID and saves the task to browser storage. Older tasks without a date still work as checklist items.

`TaskReminder.tsx` uses the current pet name and avatar to pop up on any planner page when an unfinished task becomes due. `getNextTaskReminder(tasks, now)` takes Unix milliseconds and returns the earliest due task that is unfinished and has no saved dismissal. Acknowledging the reminder saves the dismissal without marking the task complete. Overdue reminders can appear after reopening the planner. The popup runs inside the page and requires no Flask endpoint or GitHub Pages deployment.

## Usage tracking handoff

### What FI has done

- Built a Windows snapshot that lists open apps and desktop tabs by window. Added an optional Chrome and Edge tab snapshot extension.
- Built a foreground app collector. `python test.py` measures a 10-second live capture and prints the report from the in-memory sessions.
- Built `build_usage_summary(apps, now)` to turn session history and optional metadata into usage totals, per-app metrics, and pet triggers. Verified the live capture and the summary with sample records.

### What’s left for the database teammate

1. Agree with FI on the session handoff. The live collector currently returns a summary, so the integration needs access to the raw app name and session start and end timestamps before aggregation.
2. Store those sessions per user and return their history in the `apps` shape documented below. Include category, whether the app counts toward a positive streak, and any saved daily limit. Pass a notification count when one is available.
3. Give FI the function or endpoint that returns the history. FI can pass it to `build_usage_summary(apps, now)` and print the result. Verify with multiple sessions across days and a reload that the returned history persists.

Website-level duration needs a browser-side session collector. The existing extension exports open tabs at a point in time.

For a combined smoke run, run `python test.py` from the project root. It prints the Windows app and tab snapshot and all six planner examples, then samples the foreground app for 10 seconds. Switch to the app you want to measure when prompted. [backend/live_usage.py](../backend/live_usage.py) passes the observed sessions to the usage summary in memory. The report covers that run and does not measure individual website time or include database history. The planner examples require Node.js.

Use this handoff when working on Tasks, Task List, Reminders, Smart Reminders, Streaks, the Home dashboard, or Windows app tracking. The frontend is React and TypeScript with Vite. Flask serves the built frontend and provides the `/api` namespace.

## Ownership and handoffs

| Owner | Work area | Coordinate when |
| --- | --- | --- |
| **FI** | `src/features/tasks/`, the planner portion of Home, and the Python collector for Windows app activity | A feature needs changes to shared state, navigation, task types, Flask routes, or activity data. |
| **HE** | Accounts, settings, privacy, and data management | Adding stored task fields such as due dates or completion timestamps, or changing what data export and deletion need to cover. |
| **TT** | Pet, XP display, and pet interactions | Changing completion rewards, the level calculation, or the pet data shown on the dashboard. |

Keep planner logic in `src/features/tasks/`. Coordinate edits to `src/App.tsx`, `src/types.ts`, and `backend/api.py` with anyone working in those files. If different tasks require a shared change, agree on the data shape or callback first so each teammate can work against the same interface.

## How to connect changes

1. **Task UI.** `TaskBoard` sends task details on add or a task ID on toggle to `App.tsx`. Update state through those callbacks so the dashboard and pet rewards see the same task state.
2. **Planner logic.** The six modules below run in the demo. To wire up deadlines and streaks, pass planner tasks into the relevant functions and provide `now` from the caller. Older tasks may have neither timestamp, so keep those fields optional when reading saved data. The current Home dashboard selects the first unfinished task, while `getDashboardSummary` selects the earliest deadline.
3. **Backend.** Add Flask API routes in `backend/api.py` when a feature needs them. Agree on the method, JSON fields, and error responses before adding a React caller. Use relative `/api/...` URLs so Vite forwards them in development and Flask handles them when serving the built site.

## Before handing off

- Run `npm run demo:planner` for changes to the planner modules and `npm run build` for frontend changes.
- For changes to task state or pet rewards, add and complete a task, check the dashboard and XP, then reload to check persistence.
- In the handoff, name the files changed, call out any shared contract changes, and record what you verified.

## Windows activity tracking

### Usage summaries for the pet

The database teammate owns collecting and storing usage history. FI consumes one record per app or website and prints the resulting dictionary as JSON. The live window snapshot does not provide start/end history or notifications.

Pass the teammate's records to `build_usage_summary(apps, now)` in [backend/usage_summary.py](../backend/usage_summary.py), or pipe JSON into `python -m backend.usage_summary --stdin`. Run `python -m backend.usage_summary` without arguments to print the built-in Moodle sample in your terminal. The sample uses this input:

```json
{
  "now": "2026-11-21T22:00:00+00:00",
  "apps": [{
    "name": "Moodle", "category": "learning", "positive": true,
    "daily_limit_seconds": 3600, "notifications_today": 0,
    "sessions": [{"start": "2026-11-21T21:00:00+00:00", "end": "2026-11-21T21:50:00+00:00"}]
  }]
}
```

Provide completed, non-overlapping sessions per app. Each session start counts as one open. All durations are in seconds, weeks start Monday, and calendar buckets use the timezone supplied by `now`. Daily average includes idle days since first use. Common hours and weekdays are weighted by time used. Missing limits or notification counts return `null`.

The response has `summary`, `apps`, and `pet_triggers`. The default thresholds are three inactive days, 80% of the daily limit for `near`, five opens today, and five consecutive days for positive apps. At 100% the status is `over`. The usage-drop message compares with the equivalent point last week, and the usual-hour message requires at least three days of use. TT can use the trigger `type`, `app`, and `message` when choosing pet behaviour.

FI owns the Python collector and how its results feed Smart Reminders. The collector needs to run on the user's Windows PC. If Flask runs on that PC, it can call the collector locally. With a hosted Flask server, the collector needs to run as a separate local companion.

| Python file | Inputs | Outputs and responsibility |
| --- | --- | --- |
| [backend/windows_activity.py](../backend/windows_activity.py) | A request to scan the current Windows desktop, with an optional `--browser-tabs` JSON export | `list_open_apps()` returns distinct process names. Run `python -m backend.windows_activity` for `apps`, combined `desktopTabs`, and per-window `desktopWindows`. An imported export adds `browserTabs`. |
| [backend/api.py](../backend/api.py) | A proposed `GET /api/activity/apps` request from the local planner | Calls the collector and returns JSON such as `{"apps":["Code","chrome"]}`. Agree on how to report unavailable collection before wiring the frontend. |

The Python collector scans top-level windows with Windows UI Automation. The [Chrome and Edge extension](../browser_activity/README.md) exports tab titles and domains grouped by window. The CLI can merge that export into its report. The latest local verification found five Chrome windows with tab labels for each. Coordinate with HE before adding activity storage or account exports and with TT if the pet displays the resulting prompts.

## Shared data

`Task` in [`src/types.ts`](../src/types.ts) has `id`, `title`, and `done`, plus optional `description`, `dueAt` (ISO timestamp), and `reminderDismissed`. `PlannerTask` adds an optional `completedAt` ISO timestamp. Existing tasks can still be passed into the planner modules. Summary functions take `now` as a JavaScript `Date`, while the scheduled popup selector takes Unix milliseconds.

## Planner files

| File and function | Inputs | Outputs and behavior |
| --- | --- | --- |
| [TaskBoard.tsx](../src/features/tasks/TaskBoard.tsx) · `TaskBoard` | `tasks: Task[]`, `onToggle(taskId)`, `onAdd({ title, description?, dueAt })` | Renders the checklist, remaining count, and scheduling form. Emits a trimmed title with task details on add, or the selected task ID on toggle. |
| [tasks.ts](../src/features/tasks/tasks.ts) · `createTask` | ID, title, optional due date as a `Date` | An unfinished `PlannerTask` with a trimmed title and an optional ISO due date. The caller supplies the ID. |
| `tasks.ts` · `completeTask` | `PlannerTask`, completion `Date` | A completed task with an ISO completion timestamp. An already completed task is returned as-is. |
| [task-list.ts](../src/features/tasks/task-list.ts) · `getTaskList` | Read-only list of planner tasks | An array of unfinished tasks in input order. |
| [reminders.ts](../src/features/tasks/reminders.ts) · `getReminders` | Read-only list of planner tasks | Array of `{ title: string, dueAt: Date }` entries for unfinished tasks with valid deadlines, earliest first. Past deadlines are included. |
| [smart-reminders.ts](../src/features/tasks/smart-reminders.ts) · `getSmartReminder` | Read-only list of planner tasks and `now: Date` | A message for the earliest overdue task or the earliest task due within 24 hours. Returns `undefined` when neither applies. |
| [streaks.ts](../src/features/tasks/streaks.ts) · `getCurrentStreak` | Read-only list of planner tasks and `now: Date` | Number of consecutive local calendar days with completed tasks. Counts each day once and starts today if there is a completion, otherwise yesterday. |
| [dashboard.ts](../src/features/tasks/dashboard.ts) · `getDashboardSummary` | Read-only list of planner tasks and `now: Date` | `{ completed, remaining, nextTask, streak }`. The counts and streak are numbers. `nextTask` is the title of the earliest deadline among unfinished tasks, or `undefined`. |
| [main.ts](../src/features/tasks/main.ts) · demo runner | Fixed sample tasks and date. No arguments. | Prints six labeled results to the terminal. Run with `npm run demo:planner`. |

Each module also exports a `sample…` function. `sampleTasks()` takes no arguments. `sampleTaskList` and `sampleReminders` take the task list. `sampleDashboard`, `sampleStreaks`, and `sampleSmartReminders` also take `now`. Samples return display strings, except `sampleStreaks`, which returns a number. The runner handles printing.

## Shared integration files

| File | Inputs | Outputs and behavior |
| --- | --- | --- |
| [src/App.tsx](../src/App.tsx) | Starter data or saved browser data, navigation clicks, task titles and IDs, and pet interactions | Renders the selected page, saves task and pet state to browser `localStorage`, and awards pet XP when a task is marked complete. The current Home screen shows the first unfinished task. It uses its own state handlers. |
| [backend/api.py](../backend/api.py) | `GET /api/health`; profile creation with `POST /api/users`; bearer-authenticated profile, pet, friend, and message requests | Returns profile tokens and friend codes, stores profiles/friendships/messages in SQLite, and allows pet name/avatar/theme updates. Planner task state still lives in the browser. See the TT handoff below for route details. |

## TT handoff — 4c77013 Add floating dog companion and friend messaging

The Person 3 pet work now includes a macOS AppKit floating companion in [`desktop/PetOverlay/`](../desktop/PetOverlay/). Biscuit stays above other apps and Spaces, has scripted local chat bubbles, and supports pet name, avatar, and room-theme customisation. The browser demo defaults to a dog and migrates the original default chick to a dog for existing local saves. Cosmetic fields on `Pet` remain optional for saved-data compatibility.

The overlay uses these shared Flask routes in [`backend/api.py`](../backend/api.py):

| Route | Request and response |
| --- | --- |
| `POST /api/users` | `{ "display_name": "…" }`; returns a one-time bearer token and profile with an 8-character friend code. |
| `GET /api/me` | Bearer-authenticated current profile. |
| `PATCH /api/me/pet` | Bearer-authenticated `{ "pet_name": "…", "pet_avatar": "…", "pet_theme": "lavender|meadow|sunset" }`; fields may be sent separately. |
| `GET /api/friends` | Bearer-authenticated list of connected profiles. |
| `POST /api/friends` | Bearer-authenticated `{ "friend_code": "ABCDEFGH" }`; connects both profiles. |
| `POST /api/messages` | Bearer-authenticated `{ "friend_code": "ABCDEFGH", "body": "…" }`; queues a message for that friend. |
| `GET /api/messages?after=<id>` | Bearer-authenticated inbox polling; returns newer messages with sender and pet details. The overlay polls every four seconds. |

The token hash, profiles, friendships, and message queue are stored in `instance/gencity.sqlite3`. The overlay token is kept in macOS user defaults. For messages between devices, both overlays must use the same hosted Flask server and persistent database; the documented local server binds only to `127.0.0.1` and is reachable on that Mac only. The recipient overlay must be running to show a live bubble.

Verified for this commit: `npm run build`, `swift build` in `desktop/PetOverlay`, `git diff --check`, Python syntax compilation, and a Flask client smoke check covering profile creation, friend pairing, message delivery, and pet customisation. The Swift build emits two linker search-path warnings from the installed Command Line Tools but succeeds.

### Connecting checklist reminders to the desktop pet

The existing [PetOverlay](../desktop/PetOverlay/README.md) is the desktop dog implementation. It uses Swift and AppKit on macOS 13+ and already has a floating panel and chat bubbles. FI's checklist reminder runs in the React planner and saves tasks and dismissals in browser storage.

For desktop reminders, FI and the overlay owner need to agree on how the desktop client receives scheduled tasks and acknowledges them. On macOS, the existing overlay can display the reminder. Windows needs its own desktop client. GitHub Pages can host the React checklist, while the desktop client runs on the user's machine.

## FI priority update: gamification, XP, levels, and Friends

Task and reminder work is paused while teammates make the desktop pet compatible across devices. The existing browser checklist and popup are available for testing. FI will revisit desktop reminder integration once the team confirms compatibility is ready.

- **Gamification, XP, and levels.** Start from the existing progression in `src/App.tsx` and `src/features/pet/PetRoom.tsx`. The planner currently awards 20 XP for completing a task and 5 XP for playing, with one level per 100 XP. XP lives in browser storage. Coordinate with TT on reward rules, level feedback, and what progression should eventually carry across devices.
- **Friends mode.** Build on the existing Flask friend-code and messaging endpoints in `backend/api.py` and the Friends flow in the macOS overlay. Coordinate with the desktop and profile owners on how the planner should use those profiles and which pet details friends can see before extending the API.
