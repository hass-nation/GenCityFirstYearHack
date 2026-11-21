"""Print a sample usage report, or read teammate-supplied JSON with --stdin."""

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, time, timedelta


DAY = timedelta(days=1)
WEEK = 7 * DAY


def _timestamp(value):
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.utcoffset() is None:
        raise ValueError("Usage timestamps must include a UTC offset.")
    return stamp


def build_usage_summary(apps, now):
    """Return JSON-ready usage statistics for completed, non-overlapping sessions per app."""
    if now.utcoffset() is None:
        raise ValueError("now must include a UTC offset.")
    today = now.date()
    monday = today - timedelta(days=today.weekday())
    prior_start = datetime.combine(monday - WEEK, time.min, tzinfo=now.tzinfo).timestamp()
    prior_cutoff = (now - WEEK).timestamp()
    results = []
    triggers = []

    for app in apps:
        name = app["name"]
        durations = []
        daily = Counter()
        hours = Counter()
        weekdays = Counter()
        opens = Counter()
        starts = []
        ends = []
        prior_comparable = 0
        for session in app.get("sessions", []):
            start = _timestamp(session["start"]).astimezone(now.tzinfo)
            end = _timestamp(session["end"]).astimezone(now.tzinfo)
            if not start < end <= now:
                raise ValueError(f"{name}: expected session start < end <= now")
            starts.append(start)
            ends.append(end)
            opens[start.date()] += 1
            durations.append(end.timestamp() - start.timestamp())
            prior_comparable += max(0, min(end.timestamp(), prior_cutoff) - max(start.timestamp(), prior_start))
            cursor = start
            while cursor < end:
                next_hour = cursor.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
                boundary = min(end, next_hour)
                seconds = boundary.timestamp() - cursor.timestamp()
                daily[cursor.date()] += seconds
                hours[cursor.hour] += seconds
                weekdays[cursor.strftime("%A")] += seconds
                cursor = boundary

        used_today = daily[today]
        used_week = sum(seconds for day, seconds in daily.items() if monday <= day <= today)
        used_last_week = sum(seconds for day, seconds in daily.items() if monday - WEEK <= day < monday)
        opens_week = sum(count for day, count in opens.items() if monday <= day <= today)
        limit = app.get("daily_limit_seconds")
        if limit is not None and limit <= 0:
            raise ValueError(f"{name}: daily limit must be positive")
        limit_status = None
        if limit is not None:
            limit_status = "over" if used_today >= limit else "near" if used_today >= 0.8 * limit else "under"

        streak = None
        if app.get("positive", False):
            day = today if used_today else today - DAY
            streak = 0
            while daily[day] > 0:
                streak += 1
                day -= DAY

        first = min(starts, default=None)
        last = max(ends, default=None)
        days_since_first = (today - first.date()).days + 1 if first else 0
        hour = hours.most_common(1)[0][0] if hours else None
        total = sum(durations)
        results.append({
            "name": name,
            "category": app.get("category", "uncategorised"),
            "first_used_at": first.isoformat() if first else None,
            "last_used_at": last.isoformat() if last else None,
            "total_seconds": total,
            "today_seconds": used_today,
            "this_week_seconds": used_week,
            "last_week_seconds": used_last_week,
            "opens_today": opens[today],
            "opens_this_week": opens_week,
            "average_daily_seconds": total / days_since_first if first else 0,
            "average_session_seconds": total / len(durations) if durations else 0,
            "longest_session_seconds": max(durations, default=0),
            "most_common_hour": hour,
            "most_common_weekday": weekdays.most_common(1)[0][0] if weekdays else None,
            "days_used_this_week": sum(monday <= day <= today and seconds > 0 for day, seconds in daily.items()),
            "positive_streak_days": streak,
            "daily_limit_seconds": limit,
            "limit_status": limit_status,
            "notifications_today": app.get("notifications_today"),
        })

        def trigger(kind, message):
            triggers.append({"type": kind, "app": name, "message": message})

        inactive_days = (today - last.date()).days if last else 0
        if inactive_days >= 3:
            trigger("inactive", f"You haven’t used {name} for {inactive_days} days.")
        if limit_status == "near":
            trigger("near_limit", f"You are close to your daily limit for {name}.")
        if opens[today] >= 5:
            trigger("frequent_opens", f"You have opened {name} {opens[today]} times today.")
        if streak is not None and streak >= 5:
            trigger("streak", f"You have kept a streak of {streak} days with {name}.")
        if used_week < prior_comparable:
            trigger("lower_usage", f"You’ve used {name} less than at this point last week.")
        if hour is not None and sum(seconds > 0 for seconds in daily.values()) >= 3:
            label = time(hour).strftime("%I%p").lstrip("0").lower()
            trigger("usual_hour", f"You usually use {name} around {label}.")

    return {
        "summary": {
            "as_of": now.isoformat(),
            "app_count": len(results),
            "total_seconds": sum(app["total_seconds"] for app in results),
            "today_seconds": sum(app["today_seconds"] for app in results),
            "this_week_seconds": sum(app["this_week_seconds"] for app in results),
            "last_week_seconds": sum(app["last_week_seconds"] for app in results),
        },
        "apps": results,
        "pet_triggers": triggers,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stdin", action="store_true", help="Read a JSON payload from standard input")
    args = parser.parse_args()
    payload = json.load(sys.stdin) if args.stdin else {
        "now": "2026-11-21T22:00:00+00:00",
        "apps": [{
            "name": "Moodle",
            "category": "learning",
            "positive": True,
            "daily_limit_seconds": 3600,
            "notifications_today": 0,
            "sessions": [{"start": "2026-11-21T21:00:00+00:00", "end": "2026-11-21T21:50:00+00:00"}],
        }],
    }
    print(json.dumps(build_usage_summary(payload["apps"], _timestamp(payload["now"])), indent=2))


if __name__ == "__main__":
    main()
