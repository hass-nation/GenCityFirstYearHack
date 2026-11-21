# Gen City First Year Hack · PC Pet

**The winning team btw**

A student planner with a customisable virtual pet that chats with you, reminds you what is coming up, and levels up as you complete tasks and keep streaks going.

## Hackathon MVP

- **Pet:** Name and care for your companion. Add customisation and simple scripted chat in the pet room.
- **Tasks and reminders:** Add a task, mark it complete, and show what is coming up.
- **Streaks and XP:** Completing tasks earns XP and helps the pet level up.
- **Dashboard:** Show the pet, tasks completed, XP, and today's next task.
- **Personal data:** Save the demo pet and tasks between sessions.

**Demo flow:** Add a task → complete it → show XP increase → care for the pet → reload to show progress saved.

## Stack

- Python 3.12 with Flask 3.1.3
- Jinja templates for server-rendered HTML
- Plain CSS and vanilla JavaScript for pet animations and interactions

## Migration status

Flask replaces React and Vite for the hackathon build. The existing starter code on this branch still uses React. Flask run instructions will follow once the Flask app is committed.

## Feature owners

- **Person 1:** account/profile, settings, privacy, and data management
- **Person 2:** tasks, reminders, calendar, and streaks
- **Person 3:** pet, chat, XP, levels, and customisation

Use `feature/accounts`, `feature/tasks`, and `feature/pet` for the three workstreams. Coordinate shared Flask routes, templates, and data models with the team.

## Later ideas

A desktop pet, friend visits/messages, voice control, and automatic app/site streak tracking can come after the browser demo. Cross-device accounts or friend features will need a backend; keep the hackathon MVP browser-only.
