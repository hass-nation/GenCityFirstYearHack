# PC Pet · Gen City First Year Hack

PC Pet is a student planner with a virtual companion. Build a checklist, earn XP for finishing tasks and using apps you choose, and sit down for a shared focus session with friends. Your pet grows as you build those habits.

## What you can do

| Feature | How it works |
| --- | --- |
| **Plan your day** | Add tasks with a name, optional description, and a reminder date and time. Home shows your checklist progress and next unfinished task. Your pet pops up inside the planner when a reminder is due. |
| **Care for your pet** | Pick a companion and room theme, rename your pet, and feed, play with, or rest it. First-time task completions earn 20 XP, play earns 5 XP, and every 100 XP is a new level. |
| **Build app streaks on Windows** | The Activity tab discovers apps from foreground use and ranks them by time today. Turn on **Earn XP** for an app to get 10 XP after 10 minutes in one day, plus 5 XP per qualifying day from streak day three. Each app can earn one reward per day. App XP contributes to the same pet level. |
| **Focus with friends** | Add friends by code. Create or join a private party with a separate invite code, see who is ready, and start a shared 25-minute countdown. A party needs at least two players, and everyone must be ready. |
| **Chat with your pet** | The planner's Pet room has scripted chat. Flask also serves a separate `/pet` chat page that can use a Snowflake Cortex Agent and falls back to scripted replies. |
| **Bring the dog onto your Mac desktop** | The separate macOS companion is a draggable, always-on-top dog. It uses the Flask profile and messaging API to exchange messages with friends' overlays. |

On Windows, foreground capture starts automatically when the planner opens and updates about every two seconds. **Activity → Stop tracking** pauses it and remembers your choice. Expand **Open tabs** to see tab titles exposed by Windows, grouped by window. Usage time, streaks, and XP are measured per app. The browser extension also offers a manual tab snapshot export for Chrome and Edge.

## Run locally

Use Node.js 24 and Python 3.11 or newer. From the repository root:

```sh
python -m pip install -r requirements.txt
npm install
npm run build
python -m flask --app app run
```

Open `http://127.0.0.1:5000` for the planner. For frontend hot reload, run `npm run dev` in a second terminal and open the URL Vite prints. Vite forwards `/api` to Flask on port 5000.

- **Try a reminder.** Add a task in **Tasks**, schedule it for the next minute, then switch to **Home** and leave the planner open.
- **Try foreground tracking.** Run Flask on the Windows PC you're using, open **Activity**, and switch apps. The first samples appear as the tracker detects foreground use.
- **Try a party.** Open the same planner URL in a normal and a private window. Create a different profile in each, create a party in one window, and join with its party code in the other. Across devices, everyone needs the same Flask server and persistent SQLite database.
- **Try the macOS overlay.** Follow the [desktop companion setup](desktop/PetOverlay/README.md). The overlay requires macOS 13 or newer.

## Configure Cortex chat

With Flask running, open `http://127.0.0.1:5000/pet`. Open the planner on that same origin if you want the chat to use its saved pet and next task.

Export the variables in [`.env.example`](.env.example) in your shell or deployment environment before starting Flask. Set `SNOWFLAKE_ACCOUNT_URL` to the HTTPS account origin, `SNOWFLAKE_TOKEN` to the programmatic access token, and `PET_AGENT_DB` and `PET_AGENT_SCHEMA` to the agent's database and schema. `PET_AGENT_NAME` defaults to `PC_PET_AGENT`. Set a stable random `SECRET_KEY` to keep chat sessions across restarts. The token stays on the server.

## Data and project layout

Tasks, pet progress, and Windows per-app totals and rewards live in the current browser. The Flask API stores companion profiles, friendships, messages, and party state in SQLite. The website reminder currently appears inside the planner. The macOS dog can show friend message bubbles.

| Location | Purpose |
| --- | --- |
| `src/features/` | React and TypeScript planner, tasks, pet room, activity and Friends screens |
| `app/` | Flask factory, built website serving, and Jinja pet chat |
| `backend/` | Profile, messaging and party APIs, plus Windows capture and usage summaries |
| `desktop/PetOverlay/` | Swift and AppKit companion for macOS |
| `browser_activity/` | [Chrome and Edge tab snapshot extension](browser_activity/README.md) |
| `collaboration_notes/` | [FI handoff and implementation notes](collaboration_notes/FI.md) |

## Tests and script demos

```sh
python -m unittest discover -s tests -p "test_*.py"
node --test
npm run build
```

`npm run demo:planner` prints sample results for the planner modules. On Windows, `python test.py` runs the open-app and tab snapshot, the planner demo, and a ten-second foreground capture with usage statistics and pet triggers.

## Team workstreams

- **HE** owns accounts, settings, privacy, and data management in `feature/accounts`.
- **FI** owns tasks, reminders, the planner dashboard, and Windows activity in `feature/tasks`.
- **TT** owns the pet, customisation, chat, and desktop overlay in `feature/pet`. Coordinate shared XP and Friends changes across these workstreams.
