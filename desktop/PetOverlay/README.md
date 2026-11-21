# GenCity floating pet for macOS

The AppKit helper opens Wobbles as a draggable floating panel above other apps. The panel walks across the screen when collapsed, stays visible across macOS Spaces, and includes a compact chat window. Use its walk button to pause or resume. The companion can create a profile, share a friend code, add another profile, and send messages through the Flask API.

## Run the local demo

In one terminal, from the project root, create a Python environment, install the server dependencies, then start Flask:

```sh
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m flask --app app run --host 127.0.0.1 --port 5000
```

In a second terminal:

```sh
sh desktop/PetOverlay/package_app.sh
open desktop/PetOverlay/.build/GenCityPetOverlay.app
```

Open the local planner at `http://127.0.0.1:5000` and choose a built-in or custom companion in **Pet room**. The overlay follows the local selection and shows the pet's replies. To use Friends, enter a display name in the overlay and leave the server URL as `http://127.0.0.1:5000`. Share the friend code shown in the overlay, then add the other profile's code under **Friends**. Keep the recipient's overlay running to receive a message bubble.

## Use it across devices

Both devices must use the same hosted Flask server and persistent SQLite database. Enter that server's HTTPS URL in the overlay when creating a profile. The `127.0.0.1` default only works on the same computer. Friend codes are invitations; keep them private. The profile token is stored in the macOS user defaults for this demo.

The helper targets macOS 13 or newer. `package_app.sh` creates a local `.app` bundle; it is ad-hoc signed, not notarized, and not configured to launch at login.
