import { activityDay, BONUS_START_DAY, DAILY_APP_XP, getAppActivity, QUALIFYING_MINUTES, STREAK_BONUS_XP, type ActivityState } from "./activity";
import type { useActivityCapture } from "./useActivityCapture";
import { useOpenTabs } from "./useOpenTabs";

type Props = {
  activity?: ActivityState;
  tracking: ReturnType<typeof useActivityCapture>;
  onPreference: (name: string, change: { rewards?: boolean; hidden?: boolean }) => void;
};

function formatTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

export default function ActivityPanel({ activity, tracking, onPreference }: Props) {
  const apps = getAppActivity(activity, activityDay(new Date()));
  const visible = apps.filter((app) => !app.hidden);
  const hidden = apps.filter((app) => app.hidden);
  const tabSnapshot = useOpenTabs(tracking.status === "tracking" && visible.length > 0);

  return (
    <section className="content-card activity-panel" aria-labelledby="activity-title">
      <header className="activity-header">
        <div><h2 id="activity-title">Your apps</h2><p>Switch between your Windows apps to see them here.</p></div>
        {tracking.status === "idle"
          ? <button className="primary-button" onClick={() => void tracking.start()}>Start tracking</button>
          : <button className="primary-button" disabled={tracking.status === "stopping"} onClick={tracking.stop}>Stop tracking</button>}
      </header>
      <p className="activity-status" role="status">
        {tracking.status === "tracking" ? "Tracking foreground apps. Updates about every 2 seconds."
          : tracking.status === "stopping" ? "Finishing the current sample…"
          : "Tracking is off. Activity is saved in this browser."}
      </p>
      {tracking.error && <p className="task-form-error" role="alert">{tracking.error}</p>}
      {tabSnapshot?.unavailable && <p className="activity-tab-message">Open tab titles are temporarily unavailable.</p>}

      {visible.length ? (
        <ul className="activity-list" aria-label="Tracked apps, most used today first">
          {visible.map((app) => {
            const windows = tabSnapshot?.windows[app.name]?.filter((window) => window.tabs.length > 0) ?? [];
            const tabCount = windows.reduce((count, window) => count + window.tabs.length, 0);
            return (
            <li className="activity-row" key={app.name}>
              <div className="activity-app">
                <h3>{app.name}</h3>
                <dl className="activity-stats">
                  <div><dt>Today</dt><dd>{formatTime(app.todayMs)}</dd></div>
                  <div><dt>Last 7 days</dt><dd>{formatTime(app.recentMs)}</dd></div>
                  <div><dt>Streak</dt><dd>{app.streak} {app.streak === 1 ? "day" : "days"}</dd></div>
                  <div><dt>App XP</dt><dd>{app.earnedXp}</dd></div>
                </dl>
                {app.earnedToday > 0 && <p className="activity-earned">+{app.earnedToday} XP earned today</p>}
              </div>
              <div className="activity-actions">
                <label><input type="checkbox" checked={app.rewards} onChange={(event) => onPreference(app.name, { rewards: event.target.checked })} aria-label={`Earn XP from ${app.name}`} /> Earn XP</label>
                <button className="text-button" onClick={() => onPreference(app.name, { hidden: true })} aria-label={`Hide ${app.name}`}>Hide</button>
              </div>
              {tabCount > 0 && (
                <details className="activity-tabs">
                  <summary>Open tabs ({tabCount})</summary>
                  {windows.map((window, index) => (
                    <div key={window.windowId}>
                      <p>Window {index + 1}</p>
                      <ul>{window.tabs.map((tab, tabIndex) => <li key={tabIndex}>{tab}</li>)}</ul>
                    </div>
                  ))}
                </details>
              )}
            </li>
            );
          })}
        </ul>
      ) : <p className="activity-empty">{hidden.length ? "No visible apps yet." : "Your apps will appear after the first tracking sample."}</p>}

      <p className="activity-rules">Turn on XP for an app to earn {DAILY_APP_XP} XP after {QUALIFYING_MINUTES} active minutes in a day. From streak day {BONUS_START_DAY}, earn {STREAK_BONUS_XP} extra XP per qualifying day.</p>
      {hidden.length > 0 && (
        <details className="activity-hidden">
          <summary>Hidden apps ({hidden.length})</summary>
          <ul>{hidden.map((app) => <li key={app.name}><span>{app.name}</span><button className="text-button" onClick={() => onPreference(app.name, { hidden: false })} aria-label={`Show ${app.name}`}>Show</button></li>)}</ul>
        </details>
      )}
    </section>
  );
}
