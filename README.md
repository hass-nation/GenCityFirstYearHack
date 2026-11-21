# Gen City First Year Hack · PC Pet

**The winning team btw**

A customisable virtual pet that chats with you, reminds you what’s coming up, and levels up as you complete tasks and keep your streaks going.

**Status:** Hackathon brainstorm. The Vite + React app is yet to be scaffolded.

## Hackathon MVP

- **Pet and chat:** Name your pet, pick its look, and chat with it. Let it wander around the page and show reminders in speech bubbles. Start with simple scripted replies.
- **Tasks, reminders, and calendar:** Add a task or reminder, give it a due date, and mark it complete. See what’s coming up in a calendar view.
- **Streaks, XP, and levels:** Create a daily goal for an app or website and check it off manually in the demo. Completing tasks and keeping streaks going earns XP toward the pet’s next level.
- **Dashboard:** Show pet level, total XP, current streak, tasks done, reminders completed, and total active time in the web app.
- **Personal data:** Save the pet’s look, preferences, tasks, reminders, streaks, and stats in the browser. Let users view their stats and clear their saved data.

**Demo flow:** Customise your pet → add a reminder → mark it complete → see the XP and dashboard update → reload to show that progress was saved.

## Later ideas

- **Desktop pet:** Let it walk around the desktop and show reminders while other apps are open. System-wide screen-time tracking and automatic app or website streaks would need a desktop companion or browser extension, depending on what’s tracked.
- **Multiplayer:** Add friends and see their activity. Make screen-time sharing opt-in and let users turn it off at any time. When a friend sends you a message, their pet appears on your screen to deliver it.
- **Voice control:** Talk to your pet and use voice commands to create reminders or check your progress.

## Local setup

Use Node.js and npm. Follow the current Node.js requirements in the [Vite getting-started guide](https://vite.dev/guide/).

Clone the repo and scaffold the React app once from the repo root. If Vite asks about the existing files, choose **Ignore files and continue** to keep this README.

```bash
git clone https://github.com/hass-nation/GenCityFirstYearHack.git
cd GenCityFirstYearHack
npm create vite@latest . -- --template react
npm install
npm run dev
```

After the scaffold is committed, new contributors can run `npm install` and `npm run dev` after cloning. Use `npm run build` to build the site into `dist/` and `npm run preview` to preview that build locally.

## GitHub Pages demo

Set Vite’s `base` to `'/GenCityFirstYearHack/'` and use GitHub Actions to build and publish `dist/`. The demo runs in the browser and measures time spent in the web app. Later friend features will need a backend for accounts, sharing, and messages. See the [Vite GitHub Pages deployment guide](https://vite.dev/guide/static-deploy.html#github-pages).
