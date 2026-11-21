# PC Pet tab snapshot

Open `chrome://extensions` or `edge://extensions`, enable Developer mode, and choose **Load unpacked**. Select this folder. Open the extension and click **Export open tabs** to save titles and domains grouped by browser window.

For website streaks, open the local Windows planner in that browser. In the extension popup, click **Enable website tracking for this planner**, then leave the planner open with Activity tracking enabled. Switch to a website. Its domain will appear as a separate Activity entry once a foreground sample can be attributed to its active tab. Enable **Earn XP** for that site to earn its own streak rewards. Live tracking shares domains without page titles or paths with the local origin you enable. To remove access, choose **Turn off website tracking** in the extension popup.

From the project root, print the combined report:

```powershell
python -m backend.windows_activity --browser-tabs "$env:USERPROFILE\Downloads\pc-pet-tabs.json"
```

Run without `--browser-tabs` for open apps and tab labels exposed through Windows UI Automation. `desktopWindows` groups tabs by app and window ID. `desktopTabs` contains the combined labels for each app, with `null` when no labels were available. For Chrome windows in different profiles, export separately from each profile.
