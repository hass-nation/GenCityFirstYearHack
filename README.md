# Gen City First Year Hack · PC Pet

**The winning team btw**

A student planner with a customisable virtual dog that floats above your Mac apps, chats with you, reminds you what is coming up, and levels up as you complete tasks and keep streaks going.

## Hackathon MVP

- **Pet:** Name and care for your companion. Add customisation and simple scripted chat in the pet room.
- **Tasks and reminders:** Add a task, mark it complete, and show what is coming up.
- **Streaks and XP:** Completing tasks earns XP and helps the pet level up.
- **Dashboard:** Show the pet, tasks completed, XP, and today's next task.
- **Personal data:** Save the demo pet and tasks between sessions.
- **Desktop companion:** Run the native macOS overlay for a draggable, always-on-top dog with chat bubbles.
- **Friends:** Share a private friend code to pair profiles and deliver messages to a friend's running overlay.

**Demo flow:** Open Biscuit on the desktop → customise the pet → pair with a friend code → send a message to their screen → complete a task to earn XP.

## Stack

- Python 3.12 with Flask 3.1.3 for the API and production asset serving
- React and TypeScript with Vite for the planner and pet manager
- CSS for the browser interface
- AppKit for the macOS floating overlay
- SQLite for friend profiles and message delivery

## Run the demo on macOS

## GitHub Pages deployment

The static planner deploys to `https://hass-nation.github.io/GenCityFirstYearHack/` whenever a commit is pushed to `main`. The GitHub Pages deployment workflow builds the Vite app and publishes `dist`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. Pages hosts only the frontend; Flask-backed profile and friend messaging features still require a separately hosted API.

From the project root, build the dashboard and install the Flask requirements:

```sh
npm install
npm run build
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Start Flask in one terminal:

```sh
python -m flask --app app run --host 127.0.0.1 --port 5000
```

Open the dashboard at `http://127.0.0.1:5000`. In another terminal, package and launch the floating dog:

```sh
sh desktop/PetOverlay/package_app.sh
open desktop/PetOverlay/.build/GenCityPetOverlay.app
```

In Biscuit's **Friends** panel, create a profile to get a friend code. For messages to reach friends on other devices, host Flask with a persistent SQLite database and HTTPS; both devices must use the same server URL. The local `127.0.0.1` server only reaches this Mac. See [the overlay guide](desktop/PetOverlay/README.md) for details.

## Feature owners

- **Person 1:** account/profile, settings, privacy, and data management
- **Person 2:** tasks, reminders, calendar, and streaks
- **Person 3:** pet, chat, XP, levels, and customisation

Use `feature/accounts`, `feature/tasks`, and `feature/pet` for the three workstreams. Coordinate shared Flask routes, templates, and data models with the team.

## Later ideas

Voice control and automatic app/site streak tracking can come after the desktop and friend messaging demo.
