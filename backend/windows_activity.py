"""Print a snapshot of open desktop apps in the current Windows session."""

import argparse
import json
from pathlib import Path
import subprocess
import sys


def _snapshot(include_tabs: bool) -> dict:
    if sys.platform != "win32":
        raise OSError("App snapshots require Windows.")

    command = """
    $ErrorActionPreference = 'Stop'
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $sessionId = (Get-Process -Id $PID).SessionId
    $processes = @(Get-Process | Where-Object {
        $_.SessionId -eq $sessionId -and $_.MainWindowHandle -ne 0
    })
    $names = @($processes | Select-Object -ExpandProperty ProcessName | Sort-Object -Unique)
    $desktopTabs = @{}
    $desktopWindows = @{}
    if (__INCLUDE_TABS__) {
        Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
        $condition = [System.Windows.Automation.PropertyCondition]::new(
            [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
            [System.Windows.Automation.ControlType]::TabItem)
        foreach ($name in $names) { $desktopTabs[$name] = $null }
        $processNames = @{}
        foreach ($process in $processes) { $processNames[$process.Id] = $process.ProcessName }
        $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
            [System.Windows.Automation.TreeScope]::Children,
            [System.Windows.Automation.Condition]::TrueCondition)
        foreach ($window in $windows) {
            try {
                $info = $window.Current
                $name = $processNames[$info.ProcessId]
                if (-not $name -or -not $info.NativeWindowHandle -or -not $info.Name) { continue }
                $items = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
                $labels = @($items | ForEach-Object { $_.Current.Name } | Where-Object { $_ })
                if (-not $desktopWindows.ContainsKey($name)) { $desktopWindows[$name] = @() }
                $desktopWindows[$name] += @{ windowId = $info.NativeWindowHandle; tabs = $labels }
                if ($labels.Count -gt 0) {
                    $desktopTabs[$name] = @($desktopTabs[$name] + $labels | Where-Object { $_ } | Sort-Object -Unique)
                }
            } catch { continue }
        }
    }
    ConvertTo-Json -InputObject @{apps = $names; desktopTabs = $desktopTabs; desktopWindows = $desktopWindows} -Depth 6 -Compress
    """
    command = command.replace("__INCLUDE_TABS__", "$true" if include_tabs else "$false")
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
        capture_output=True,
        encoding="utf-8-sig",
        check=True,
        timeout=30,
    )
    return json.loads(result.stdout)


def list_open_apps() -> list[str]:
    return _snapshot(include_tabs=False)["apps"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser-tabs", type=Path, help="JSON snapshot from the browser extension")
    args = parser.parse_args()
    try:
        snapshot = _snapshot(include_tabs=True)
        if args.browser_tabs:
            snapshot["browserTabs"] = json.loads(args.browser_tabs.read_text(encoding="utf-8-sig"))
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        raise SystemExit(f"Could not read activity snapshot: {error}") from error
    print(json.dumps(snapshot, indent=2))


if __name__ == "__main__":
    main()
