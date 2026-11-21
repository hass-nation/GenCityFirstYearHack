# PC Pet · Gen City First Year Hack

PC Pet is a student planner with a virtual companion. Build a checklist, earn XP for finishing tasks and building app or website streaks, and join focus sessions with friends. Your pet grows as you build those habits.

## What you can do

| Feature | How it works |
| --- | --- |
| **Tasks and Calendar** | Add a name, optional description, and reminder date and time to each task. Browse scheduled tasks in the monthly calendar. Your pet pops up inside the open planner when a task is due. |
| **Dashboard** | See your pet level, tasks done, next unfinished task, best current streak, screen time today and all time, and completed reminders. A completed reminder is a scheduled task marked done. |
| **Pet room** | Start with Wobbles the camel, switch to the cat or dog, or upload two images for your own animated pet. You can name your pet, change its room theme, and feed, play with, or rest it. First-time task completions earn 20 XP and play earns 5 XP. Each 100 XP adds a level. |
| **Windows activity** | The planner discovers foreground apps automatically and ranks them by time used today. **Open tabs** shows the labels Windows exposes, grouped by window. Use **Stop tracking** to pause capture. |
| **Website streaks** | On Windows, enable the Chrome or Edge extension for the local planner. Enable **Earn XP** for an app or website to get 10 XP after 10 minutes in a day, plus 5 XP per qualifying day from streak day three. Site and app awards contribute to one pet level. Website time is included in browser time when calculating the total. |
| **Friends and parties** | Add friends by code, create or join a party, and start a shared 25-minute countdown when at least two people have joined and everyone is ready. In Friends, you can opt in to sharing your daily screen-time total. Turning it off removes the total from friends' view. |
| **Voice and chat** | In Pet room, use scripted chat or select **Voice command** and try “feed pet”, “rest”, or “open calendar”. Voice needs a supported browser and microphone permission. The separate Flask `/pet` page supports optional Cortex chat with a scripted fallback. |
| **Desktop companion** | See your pet walk across the desktop and show its replies in a speech bubble. The macOS helper also supports messages from friends. |

## Run locally

Use Node.js 24 and Python 3.11 or newer. From the project root:

```sh
python -m pip install -r requirements.txt
npm install
npm run build
python -m flask --app app run
```

Open `http://127.0.0.1:5000`. For frontend hot reload, leave Flask running and start `npm run dev` in another terminal, then open the URL Vite prints. Vite proxies `/api` to Flask.

- **Try activity rewards.** Run Flask locally on the Windows PC you're using. In **Activity**, switch between apps to discover them and enable **Earn XP** on the entries you want to reward. For websites, [load and enable the browser extension](browser_activity/README.md).
- **Try multiplayer and sharing.** Open the same planner URL in two separate browser profiles or a regular and private window. Create a different Friends profile in each. Use a friend code to connect the profiles and a party code to join the same lobby. Across devices, both players need the same Flask server with a persistent SQLite database.
- **Try the desktop pet.** On Windows, with local Flask running on port 5000, run `python -m desktop.pet_overlay` in a second terminal. The pet can be dragged, and its right-click menu pauses walking or quits. On macOS 13 or newer, follow the [macOS overlay setup](desktop/PetOverlay/README.md).

## Pet sprites

In **Pet room**, choose **Camel**, **Cat**, or **Dog**. To make your own, open **Upload a custom sprite**, choose two PNG, JPEG, or WebP images in frame order, and select **Use custom sprite**. The planner alternates the two frames automatically. Transparent PNGs with matching framing give the smoothest result. Each image can be up to 4 MB and is fitted to a 64×64 sprite on your device.

The local Flask planner shares your selected sprite and the pet’s replies with the desktop helper on the same computer. Open the local planner to change the desktop pet or send it a new speech bubble. The sprite selection stays on your computer.

The built-in sprites come from [2 frame Animals by Ezekyuhl](https://ezekyuhl.itch.io/2-frame-animals) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The frames were cropped from the source sheet.

## Cortex chat setup

With Flask running, open `http://127.0.0.1:5000/pet`. Open the planner on the same origin to let chat use its saved pet and next task.

Use [`.env.example`](.env.example) as the template for server environment variables. Set `SNOWFLAKE_ACCOUNT_URL`, `SNOWFLAKE_TOKEN`, `PET_AGENT_DB`, and `PET_AGENT_SCHEMA`. `PET_AGENT_NAME` defaults to `PC_PET_AGENT`. Set a stable `SECRET_KEY` for chat sessions across restarts. The Snowflake token stays on the server. If credentials are missing or Cortex is unavailable, chat uses scripted replies.

## Where data lives

Tasks, pet progression, app and website usage, and reward history are stored in the local browser. Flask uses SQLite for profiles, friendships, messages, focus parties, and opted-in daily screen-time totals. Friends see the shared date and total duration. Individual apps, websites, and tasks stay private.

The React and TypeScript planner lives in `src/features/`, Flask and Jinja in `app/`, and the APIs and Windows collectors in `backend/`. The [FI collaboration notes](collaboration_notes/FI.md) document team handoffs and integration details.

## Tests and demos

```sh
python -m unittest discover -s tests -p "test_*.py"
node --test
npm run build
```

`npm run demo:planner` prints sample results for the planner modules. On Windows, `python test.py` also prints an open-window snapshot and a ten-second live usage report with sample pet trigger logic.
