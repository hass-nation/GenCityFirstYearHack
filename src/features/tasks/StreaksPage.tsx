import type { Pet, Task, XpEvent } from "../../types";
import { XP_PER_LEVEL } from "../pet/progression";
import { getBestStreak, getCompletionCountForDay, getCurrentStreak } from "./streaks";

type Props = { tasks: readonly Task[]; pet: Pet; xpHistory: readonly XpEvent[]; now?: Date };

export default function StreaksPage({ tasks, pet, xpHistory, now = new Date() }: Props) {
  const current = getCurrentStreak(tasks, now);
  const best = getBestStreak(tasks, now);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const completedThisWeek = tasks.filter((task) => {
    if (!task.done || !task.completedAt) return false;
    const date = new Date(task.completedAt);
    return date >= weekStart && date < weekEnd;
  }).length;
  const completedToday = getCompletionCountForDay(tasks, now);
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    day.setDate(day.getDate() - (6 - index));
    return { date: day, count: getCompletionCountForDay(tasks, day) };
  });
  const maxCount = Math.max(1, ...chartDays.map((day) => day.count));
  const xpWithinLevel = pet.xp % XP_PER_LEVEL;
  const history = [...xpHistory].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 8);

  return (
    <section className="streaks-page" aria-labelledby="streaks-title">
      <div className="section-heading">
        <div><p className="eyebrow">SMALL WINS ADD UP</p><h2 id="streaks-title">Streaks &amp; XP</h2><p className="muted">Your study rhythm and companion progress, saved on this device.</p></div>
        <span className="count-chip">LEVEL {pet.level}</span>
      </div>

      <div className="stats-grid">
        <article className="content-card stat-tile"><span className="stat-label">CURRENT STREAK</span><strong>{current}<small> days</small></strong><p className="muted">Complete a task each day to keep it going.</p></article>
        <article className="content-card stat-tile"><span className="stat-label">BEST STREAK</span><strong>{best}<small> days</small></strong><p className="muted">Your longest run of consecutive days.</p></article>
        <article className="content-card stat-tile"><span className="stat-label">TOTAL XP</span><strong>{pet.xp}<small> XP</small></strong><p className="muted">Tasks, play and streak milestones.</p></article>
      </div>

      <section className="content-card level-progress" aria-label={`Level ${pet.level} progress`}>
        <div className="xp-heading"><span>Level {pet.level}</span><strong>{xpWithinLevel} / {XP_PER_LEVEL} XP</strong></div>
        <div className="xp-track" role="progressbar" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={xpWithinLevel} aria-label="Progress to next level"><span style={{ width: `${xpWithinLevel}%` }} /></div>
        <p className="muted">{XP_PER_LEVEL - xpWithinLevel} XP to level {pet.level + 1}.</p>
      </section>

      <div className="streaks-grid">
        <section className="content-card" aria-labelledby="week-chart-title">
          <div className="section-heading"><h3 id="week-chart-title">Last 7 days</h3><span className="count-chip">{completedToday} today · {completedThisWeek} this week</span></div>
          {tasks.some((task) => task.done && task.completedAt) ? (
            <div className="week-chart" role="img" aria-label="Completed tasks by day over the last seven days">
              {chartDays.map(({ date, count }) => <div className="week-chart-day" key={date.toISOString()}><span className="week-chart-count">{count || ""}</span><div className="week-chart-track"><span style={{ height: `${count ? Math.max(12, (count / maxCount) * 100) : 0}%` }} /></div><span className="week-chart-label">{date.toLocaleDateString(undefined, { weekday: "short" })}</span></div>)}
            </div>
          ) : <p className="empty-state">Finish a task and your weekly activity will appear here.</p>}
        </section>
        <section className="content-card" aria-labelledby="xp-history-title">
          <h3 id="xp-history-title">Recent XP</h3>
          {history.length ? <ul className="xp-history">{history.map((event) => <li key={event.id}><div><strong>{event.title}</strong><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></div><span>+{event.amount} XP</span></li>)}</ul> : <p className="empty-state">Your XP rewards will show up here.</p>}
        </section>
      </div>
    </section>
  );
}
