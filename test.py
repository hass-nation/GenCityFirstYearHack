"""Temporary runner for the FI demos. Run with python test.py."""

import json
import subprocess
import sys
from pathlib import Path

from backend.live_usage import capture_usage


def main() -> int:
    root = Path(__file__).resolve().parent
    demos = [
        ("Windows apps and tabs", [sys.executable, "-m", "backend.windows_activity"]),
        ("Planner modules", ["node", "src/features/tasks/main.ts"]),
    ]

    failed = False
    for title, command in demos:
        print(f"\n=== {title} ===", flush=True)
        try:
            result = subprocess.run(command, cwd=root, check=False)
        except OSError as error:
            print(f"Could not start the demo: {error}", file=sys.stderr)
            failed = True
        else:
            if result.returncode:
                print(f"Demo exited with code {result.returncode}.", file=sys.stderr)
                failed = True
    print("\n=== Live usage summary and pet triggers ===", flush=True)
    print("Switch to the app you want to measure. Sampling foreground usage for 10 seconds…", flush=True)
    try:
        print(json.dumps(capture_usage(), indent=2))
    except OSError as error:
        print(error, file=sys.stderr)
        failed = True
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
