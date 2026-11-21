# PC Pet tab snapshot

Open `chrome://extensions` or `edge://extensions`, enable Developer mode, and choose **Load unpacked**. Select this folder. Open the extension and click **Export open tabs** to save titles and domains grouped by browser window.

From the project root, print the combined report:

```powershell
python -m backend.windows_activity --browser-tabs "$env:USERPROFILE\Downloads\pc-pet-tabs.json"
```

Run without `--browser-tabs` for open apps and tab labels exposed through Windows UI Automation. `desktopWindows` groups tabs by app and window ID. `desktopTabs` contains the combined labels for each app, with `null` when no labels were available. For Chrome windows in different profiles, export separately from each profile.
