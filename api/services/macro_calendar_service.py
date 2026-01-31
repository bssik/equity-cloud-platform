import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from models import CatalystEvent


def _parse_date_only(utc_time: str) -> str:
    return utc_time[:10] if utc_time else ""


def _safe_list(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return [str(value)]


class MacroCalendarService:
    """Loads a curated macro calendar from a local JSON file.

    This is a deliberately "free" source: the repo owns the calendar data.
    """

    def __init__(self, calendar_path: Optional[str] = None) -> None:
        root = os.path.dirname(os.path.dirname(__file__))
        self._calendar_path = calendar_path or os.path.join(root, "data", "macro_calendar.json")

    def get_events(self, from_date: str, to_date: str) -> List[CatalystEvent]:
        """Return macro events in [from_date, to_date] inclusive.

        from_date/to_date are expected as YYYY-MM-DD.
        """

        raw = self._load_raw()
        events: List[CatalystEvent] = []

        for item in raw:
            utc_time = (item.get("utc_time") or "").strip()
            title = (item.get("title") or "").strip()
            if not utc_time or not title:
                continue

            date = _parse_date_only(utc_time)
            if not date:
                continue

            if date < from_date or date > to_date:
                continue

            country = (item.get("country") or None)
            impact = (item.get("impact") or None)
            sectors = _safe_list(item.get("sectors"))
            source = (item.get("source") or "Curated")
            url = (item.get("url") or None)
            meta: Dict[str, Any] = dict(item.get("meta") or {})

            # Stable ID so the frontend doesn't thrash when reloading.
            stable_key = f"{utc_time}|{title}|{country or ''}|{impact or ''}"
            event_id = str(uuid.uuid5(uuid.NAMESPACE_URL, stable_key))

            events.append(
                CatalystEvent(
                    id=event_id,
                    type="macro",
                    title=title,
                    utc_time=utc_time,
                    date=date,
                    country=country,
                    impact=impact,
                    sectors=sectors,
                    source=source,
                    url=url,
                    meta=meta,
                )
            )

        events.sort(key=lambda e: (e.utc_time, e.title))
        return events

    def _load_raw(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self._calendar_path):
            return []

        with open(self._calendar_path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        if not isinstance(payload, list):
            return []

        # Best-effort validation: keep objects only.
        out: List[Dict[str, Any]] = []
        for item in payload:
            if isinstance(item, dict):
                out.append(item)
        return out
