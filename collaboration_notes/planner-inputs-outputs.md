# FI planner collaboration notes

Use this handoff when working on Tasks, Task List, Reminders, Smart Reminders, Streaks, or the Home dashboard. The frontend is React and TypeScript with Vite. Flask serves the built frontend and provides the `/api` namespace.

## Ownership and handoffs

| Owner | Work area | Coordinate when |
| --- | --- | --- |
| **FI** | `src/features/tasks/` and the planner portion of Home | A feature needs changes to shared state, navigation, task types, or Flask routes. |
| **HE** | Accounts, settings, privacy, and data management | Adding stored task fields such as due dates or completion timestamps, or changing what data export and deletion need to cover. |
| **TT** | Pet, XP display, and pet interactions | Changing completion rewards, the level calculation, or the pet data shown on the dashboard. |

Keep planner logic in `src/features/tasks/`. Coordinate edits to `src/App.tsx`, `src/types.ts`, and `backend/api.py` with anyone working in those files. If different tasks require a shared change, agree on the data shape or callback first so each teammate can work against the same interface.

## How to connect changes

1. **Task UI.** `TaskBoard` sends a trimmed title or task ID to `App.tsx`. Update state through those callbacks so the dashboard and pet rewards see the same task state.
2. **Planner logic.** The six modules below run in the demo. To wire up deadlines and streaks, pass planner tasks into the relevant functions and provide `now` from the caller. Older tasks may have neither timestamp, so keep those fields optional when reading saved data. The current Home dashboard selects the first unfinished task, while `getDashboardSummary` selects the earliest deadline.
3. **Backend.** Add Flask API routes in `backend/api.py` when a feature needs them. Agree on the method, JSON fields, and error responses before adding a React caller. Use relative `/api/...` URLs so Vite forwards them in development and Flask handles them when serving the built site.

## Before handing off

- Run `npm run demo:planner` for changes to the planner modules and `npm run build` for frontend changes.
- For changes to task state or pet rewards, add and complete a task, check the dashboard and XP, then reload to check persistence.
- In the handoff, name the files changed, call out any shared contract changes, and record what you verified.

## Shared data

`Task` in [`src/types.ts`](../src/types.ts) has `id: string`, `title: string`, and `done: boolean`. `PlannerTask` adds optional `dueAt` and `completedAt` ISO timestamp strings, so existing tasks can be passed into the planner modules. Functions that take `now` expect a JavaScript `Date`. Pass a fixed date for repeatable examples.

## Planner files

| File and function | Inputs | Outputs and behavior |
| --- | --- | --- |
| [TaskBoard.tsx](../src/features/tasks/TaskBoard.tsx) · `TaskBoard` | `tasks: Task[]`, `onToggle(taskId)`, `onAdd(title)` | Renders the task list, remaining count, and add form. Calls `onAdd` with a trimmed, non-empty title or `onToggle` with the selected task ID. |
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
| [backend/api.py](../backend/api.py) | `GET /api/health` with no body | HTTP 200 with JSON `{"status":"ok"}`. Task state currently lives in the browser. |
