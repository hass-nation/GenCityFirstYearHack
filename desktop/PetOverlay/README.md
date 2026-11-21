# GenCity floating pet for macOS

The AppKit helper opens Biscuit as a draggable floating panel above other apps. The panel stays visible across macOS Spaces and has a compact chat window. The companion can create a profile, share a friend code, add another profile, and send messages through the Flask API.

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

On first launch, enter a display name and leave the server URL as `http://127.0.0.1:5000`. Share the friend code shown in the overlay, then add the other profile's code under **Friends**. Keep the recipient's overlay running to receive a message bubble.

## Use it across devices

Both devices must use the same hosted Flask server and persistent SQLite database. Enter that server's HTTPS URL in the overlay when creating a profile. The `127.0.0.1` default only works on the same computer. Friend codes are invitations; keep them private. The profile token is stored in the macOS user defaults for this demo.

The helper targets macOS 13 or newer. `package_app.sh` creates a local `.app` bundle; it is ad-hoc signed, not notarized, and not configured to launch at login.
