# Tasks feature

Owner: Person 2

Build the task list, add/edit flow, reminders, calendar, and streak UI in this folder. The initial `TaskBoard` receives `tasks`, `onToggle`, and `onAdd` props from `src/App.tsx`. Coordinate shared data changes before changing `src/types.ts`.

## Planner demo

Run `npm run demo:planner` with Node.js 24 or later. The demo uses fixed sample data and runs from `main.ts` in this folder. Each module exports an example function and logic that the React app can import later.

| Module | Example |
| --- | --- |
| `tasks.ts` | Create a task and mark it complete |
| `task-list.ts` | List unfinished tasks |
| `reminders.ts` | List unfinished tasks with due dates, earliest first |
| `smart-reminders.ts` | Pick the earliest overdue task or one due within 24 hours |
| `streaks.ts` | Count consecutive local days with a completion, starting today or yesterday |
| `dashboard.ts` | Summarise task progress, the next deadline, and the current streak |
