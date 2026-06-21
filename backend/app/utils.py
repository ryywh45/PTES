import json
import random
from datetime import datetime, timedelta


def utc_now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def parse_activity_dates(raw: str) -> list[str]:
    try:
        data = json.loads(raw or "[]")
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def dump_activity_dates(dates: list[str]) -> str:
    return json.dumps(sorted(set(dates)))


def synth_activity(seed: int, start: str, end: str | None, weight: float = 1.0) -> list[str]:
    start_d = datetime.strptime(start, "%Y-%m-%d")
    end_d = datetime.strptime(end, "%Y-%m-%d") if end else datetime.utcnow()
    total_days = max(7, (end_d - start_d).days)
    num_events = max(8, int(total_days * 0.18 * weight))
    rng = random.Random(seed)
    dates: set[str] = set()
    for _ in range(num_events):
        offset = int(((rng.random() + rng.random()) / 2) * total_days)
        d = start_d + timedelta(days=offset)
        dates.add(d.strftime("%Y-%m-%d"))
    return sorted(dates)


def activity_for_project(
    start_date: str,
    end_date: str | None,
    created_at: str,
    updated_at: str,
    seed: int | None = None,
) -> list[str]:
    dates = {start_date, created_at[:10], updated_at[:10]}
    if end_date:
        dates.add(end_date)
    if seed is not None:
        dates.update(synth_activity(seed, start_date, end_date, 1.0))
    return sorted(dates)


def start_of_week(d: datetime) -> datetime:
    date = d.replace(hour=0, minute=0, second=0, microsecond=0)
    day = date.weekday()
    return date - timedelta(days=day)


def build_heatmap(projects: list[dict], from_date: datetime, to_date: datetime) -> list[dict]:
    from_w = start_of_week(from_date)
    to = to_date.replace(hour=23, minute=59, second=59, microsecond=999999)
    date_index: dict[str, list[int]] = {}
    for project in projects:
        for d in project.get("activity_dates") or []:
            date_index.setdefault(d, []).append(project["id"])

    cells = []
    week_index = 1
    cur = from_w
    while cur <= to:
        week_start = cur
        count = 0
        project_ids: set[int] = set()
        for i in range(7):
            day = week_start + timedelta(days=i)
            key = day.strftime("%Y-%m-%d")
            hits = date_index.get(key)
            if hits:
                count += len(hits)
                project_ids.update(hits)
        cells.append(
            {
                "week_start": week_start.strftime("%Y-%m-%d"),
                "week_index": week_index,
                "count": count,
                "project_ids": sorted(project_ids),
            }
        )
        week_index += 1
        cur = cur + timedelta(days=7)
    return cells
