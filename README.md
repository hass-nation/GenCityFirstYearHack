# Gen City First Year Hack · PC Pet

**The winning team btw**

A student planner with a customisable virtual pet that chats with you, reminds you what is coming up, and levels up as you complete tasks and keep streaks going.

## Hackathon MVP

- **Pet:** Name and care for your companion. Add customisation and simple scripted chat in the pet room.
- **Tasks and reminders:** Add a task, mark it complete, and show what is coming up.
- **Streaks and XP:** Completing tasks earns XP and helps the pet level up.
- **Dashboard:** Show the pet, tasks completed, XP, and today's next task.
- **Personal data:** Save the demo pet and tasks in this browser with localStorage.

**Demo flow:** Add a task → complete it → show XP increase → care for the pet → reload to show progress saved.

## Stack

- Vite
- React
- TypeScript
- CSS
- localStorage for the browser demo

## Run locally

```bash
npm install
npm run dev
```

Build and preview with `npm run build` and `npm run preview`.

Node.js is required. Follow the current requirements in the [Vite getting-started guide](https://vite.dev/guide/).

## Feature owners

- **Person 1:** account/profile, settings, privacy, and data management in `src/features/accounts/`
- **Person 2:** tasks, reminders, calendar, and streaks in `src/features/tasks/`
- **Person 3:** pet, chat, XP, levels, and customisation in `src/features/pet/`

Create a feature branch for your work. Keep changes in your feature folder where possible. Coordinate edits to `src/App.tsx` and `src/types.ts` with the team before changing shared integration points.

## Later ideas

A desktop pet, friend visits/messages, voice control, and automatic app/site streak tracking can come after the browser demo. Cross-device accounts or friend features will need a backend; keep the hackathon MVP browser-only.
