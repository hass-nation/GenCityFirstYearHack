# PC Pet · Gen City First Year Hack

PC Pet is a student planner with a virtual companion. Organise work with tasks, reminders, and a calendar. Earn XP for finishing tasks and building streaks in selected apps or websites. Friends can share focus sessions and messages, and the desktop companion brings your pet outside the planner.

## Try PC Pet

| Demo | What you can test |
| --- | --- |
| **[Snowflake-hosted demo](https://iaface-nuzremg-rn09570.snowflakecomputing.app/)** | Planner, shared parties, friend messages, and live Cortex chat across devices and networks. Each tester needs a user in the hosting Snowflake account with the `PC_PET_TESTER` role. |
| **[GitHub Pages](https://hass-nation.github.io/GenCityFirstYearHack/)** | Browser-only planner, calendar, pet sprites, and scripted chat. |
| **Local demo** | Shared parties on your Wi-Fi, Windows activity tracking, and Wobbles’ walking message delivery. See [Run the local demo](#run-the-local-demo). |

On Snowflake, open **Create party** in both browsers. One person creates the party and shares the code. The other enters it under **Join party**. To exchange messages, open **Messages**, share friend codes, and select **Send message**. The recipient sees the message in their inbox and in a bubble in the planner.

See the [Snowflake deployment guide](deploy/snowflake/README.md) for tester permissions, redeployment, and how to suspend the service after testing.

## What you can do

| Feature | How it works |
| --- | --- |
| **Tasks and Calendar** | Add a name, optional description, and reminder date and time to each task. Browse scheduled tasks in the monthly calendar. Your pet pops up inside the open planner when a task is due. |
| **Dashboard** | See your pet level, task progress, upcoming tasks, current app or site streak, screen time, and completed dated tasks. |
| **Pet room** | Start with Wobbles the camel, switch to the cat or dog, or upload two images for your own animated pet. Name your pet and chat with it. First-time task completions earn 20 XP. Each 100 XP adds a level. |
| **Windows activity** | The local planner automatically samples foreground apps. The Activity view ranks apps by today's and recent usage, and **Open tabs** shows available window and tab labels. |
| **App and website streaks** | Enable **Earn XP** per app or website. Ten active minutes in a day earns 10 XP, with a 5 XP bonus starting on the third consecutive qualifying day. Website tracking requires the Chrome or Edge extension. Website time is included in browser time without double counting. |
| **Focus parties** | Create a party or join by code, then start a shared 25-minute countdown when everyone is ready and at least two people have joined. |
| **Friend messages** | Add a friend by code and send a message to their inbox. In the local Windows demo, **Send with pet** makes Wobbles walk offscreen to deliver it and then return. |
| **Pet chat** | Pet room uses Cortex on Snowflake. A configured local Flask demo can also use Cortex. Scripted replies are available as a fallback. |
| **Desktop companion** | The local desktop pet walks and speaks in bubbles. Wobbles celebrates level-ups by pulsing in size and announcing the new level. |

## Run the local demo

After installing the frontend dependencies once with `npm ci`, run `npm run demo` from the project root. It builds the planner, starts Flask and the Windows companion, and opens the planner in your browser. Activity tracking starts automatically on Windows. Press Ctrl+C to stop. Use `npm run demo -- --port 5050` if port 5000 is busy.

To let other devices on your local network join parties, run `npm run demo -- --lan`. Share your laptop’s local network address on port 5000 and the party code. Use Profile to set the display name used when you join a party for the first time.

In **Messages**, get your friend code and add a friend using theirs. Both people need to use the same Flask server. Sending with the walking pet requires the Windows overlay and a planner opened on the same computer as that server. The recipient sees the message in their browser and, if it is connected to their local planner, in their desktop speech bubble.

The desktop pet roams horizontally and diagonally. It occasionally offers encouragement, and the planner can suggest a break after an hour in a tracked app or point out an app you have not used for seven days. These suggestions use activity saved in your browser.

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
- **Try multiplayer and sharing.** Open the same planner URL in two separate browser profiles or a regular and private window. Open Create party in each browser. Create a lobby in one and join it by code in the other. Across devices, both players need the same Flask server with a persistent SQLite database.
- **Try the desktop pet.** On Windows, with local Flask running on port 5000, run `python -m desktop.pet_overlay` in a second terminal. The pet can be dragged, and its right-click menu pauses walking or quits. On macOS 13 or newer, follow the [macOS overlay setup](desktop/PetOverlay/README.md).

## Pet sprites

In **Pet room**, choose **Camel**, **Cat**, or **Dog**. To make your own, open **Upload a custom sprite**, choose two PNG, JPEG, or WebP images in frame order, and select **Use custom sprite**. The planner alternates the two frames automatically. Transparent PNGs with matching framing give the smoothest result. Each image can be up to 4 MB and is fitted to a 64×64 sprite on your device.

The local Flask planner shares your selected sprite and the pet’s replies with the desktop helper on the same computer. Open the local planner to change the desktop pet or send it a new speech bubble. The sprite selection stays on your computer.

The built-in sprites come from [2 frame Animals by Ezekyuhl](https://ezekyuhl.itch.io/2-frame-animals) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The frames were cropped from the source sheet.

## Local Cortex chat setup

The Snowflake-hosted demo uses its managed service token. For local testing, use **Pet room** or open `http://127.0.0.1:5000/pet` while Flask is running.

Copy [`.env.example`](.env.example) to `.env` for the demo launcher. Set `SNOWFLAKE_ACCOUNT_URL`, `SNOWFLAKE_TOKEN`, `PET_AGENT_DB`, and `PET_AGENT_SCHEMA`. `PET_AGENT_NAME` defaults to `PC_PET_AGENT`. Set a stable `SECRET_KEY` for chat sessions across restarts. The Snowflake token stays on the server. If credentials are missing or Cortex is unavailable, chat uses scripted replies.

## Where data lives

Display preferences, tasks, pet progression, activity and XP history stay in the browser that created them. Flask uses SQLite for multiplayer profiles, friendships, inbox messages, and focus parties. The hosted demo stores that SQLite data on a Snowflake volume separate from the local demo. Flask does not persist raw activity samples or send individual app and website usage to friends.

The React and TypeScript planner lives in `src/features/`, Flask and Jinja in `app/`, API routes and Windows collectors in `backend/`, and the macOS companion in `desktop/PetOverlay/`. The Chrome and Edge extension is in `browser_activity/`. The [FI collaboration notes](collaboration_notes/FI.md) document team handoffs and implementation details.

## Tests and demos

While Pages publishes directly from the root of `main`, run `npm run build:pages` and commit the generated `index.html`, `assets/`, and `pets/` when changing the frontend. The Vite HTML source is `web/index.html`.

```sh
python -m unittest discover -s tests -p "test_*.py"
node --test
npm run build
```

`npm run demo:planner` prints sample results for the planner modules. On Windows, `python test.py` also prints an open-window snapshot and a ten-second live usage report with sample pet trigger logic.
