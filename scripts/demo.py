"""Start the planner, tracker API and Windows companion for a local demo."""

import argparse
from pathlib import Path
import subprocess
import sys
import venv
import webbrowser


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lan", action="store_true", help="Allow others on the same network to join this demo.")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    try:
        from dotenv import load_dotenv
        from werkzeug.serving import make_server
        import requests  # Required by the Flask chat app.
    except ImportError:
        env = root / ".venv"
        venv.EnvBuilder(with_pip=True).create(env)
        python = env / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
        subprocess.run([python, "-m", "pip", "install", "-r", root / "requirements.txt"], check=True)
        raise SystemExit(subprocess.call([python, "-m", "scripts.demo", *sys.argv[1:]], cwd=root))

    load_dotenv(root / ".env")
    from app import create_app

    url = f"http://127.0.0.1:{args.port}"
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    server = make_server(host, args.port, create_app(), threaded=True)
    overlay = None
    try:
        if sys.platform == "win32":
            overlay = subprocess.Popen([sys.executable, "-m", "desktop.pet_overlay", "--port", str(args.port)],
                                       creationflags=subprocess.CREATE_NO_WINDOW)
        print(f"PC Pet is ready at {url}. Press Ctrl+C to stop.", flush=True)
        webbrowser.open(url)
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        if overlay and overlay.poll() is None:
            overlay.terminate()
            overlay.wait()


if __name__ == "__main__":
    main()
