"""Sample foreground Windows app usage in memory for a short demo."""

import ctypes
import sys
import time
from ctypes import wintypes
from datetime import datetime, timedelta, timezone
from functools import cache
from pathlib import PureWindowsPath

from backend.usage_summary import build_usage_summary


@cache
def _foreground_reader():
    user = ctypes.WinDLL("user32", use_last_error=True)
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    user.GetForegroundWindow.restype = wintypes.HWND
    user.GetWindowThreadProcessId.argtypes = (wintypes.HWND, ctypes.POINTER(wintypes.DWORD))
    kernel.OpenProcess.argtypes = (wintypes.DWORD, wintypes.BOOL, wintypes.DWORD)
    kernel.OpenProcess.restype = wintypes.HANDLE
    kernel.QueryFullProcessImageNameW.argtypes = (
        wintypes.HANDLE, wintypes.DWORD, wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD),
    )
    kernel.CloseHandle.argtypes = (wintypes.HANDLE,)

    def read():
        window = user.GetForegroundWindow()
        if not window:
            return None
        pid = wintypes.DWORD()
        user.GetWindowThreadProcessId(window, ctypes.byref(pid))
        process = kernel.OpenProcess(0x1000, False, pid.value)
        if not process:
            return None
        try:
            path = ctypes.create_unicode_buffer(32768)
            size = wintypes.DWORD(len(path))
            if kernel.QueryFullProcessImageNameW(process, 0, path, ctypes.byref(size)):
                return PureWindowsPath(path.value).stem.lower()
            return None
        finally:
            kernel.CloseHandle(process)

    return read


def capture_sessions(seconds: float = 10):
    if sys.platform != "win32":
        raise OSError("Live foreground tracking requires Windows.")
    if not 0 < seconds <= 3600:
        raise ValueError("Capture duration must be between zero and 3600 seconds.")

    read = _foreground_reader()
    origin = datetime.now(timezone.utc).astimezone()
    started = time.monotonic()
    sessions = {}
    current = read()
    start = origin

    while True:
        remaining = seconds - (time.monotonic() - started)
        if remaining > 0:
            time.sleep(min(0.25, remaining))
        elapsed = time.monotonic() - started
        now = origin + timedelta(seconds=min(elapsed, seconds))
        finished = elapsed >= seconds
        active = None if finished else read()
        if active != current:
            if current and now > start:
                sessions.setdefault(current, []).append({"start": start.isoformat(), "end": now.isoformat()})
            current, start = active, now
        if finished:
            break

    apps = [{"name": name, "sessions": records} for name, records in sorted(sessions.items())]
    return apps, now


def capture_usage(seconds: float = 10):
    apps, now = capture_sessions(seconds)
    return build_usage_summary(apps, now)
