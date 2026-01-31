import logging
import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from models import CatalystEvent, CatalystsResponse, Watchlist
from services.finnhub_service import FinnhubService
from services.macro_calendar_service import MacroCalendarService
from services.watchlist_service import WatchlistService


def _parse_date_only(utc_time: str) -> str:
    # utc_time expected ISO8601. Fallback to first 10 chars.
    try:
        return utc_time[:10]
    except Exception:
        return ""


def _normalize_country(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    raw = value.strip()

    if len(raw) == 2:
        return raw.upper()

    if raw.upper() == "USA":
        return "US"

    # Best-effort: many Finnhub fields are human-readable.
    # Keep original if we cannot safely map.
    return raw


def _macro_sectors_from_title(title: str) -> List[str]:
    t = title.lower()

    # "All"-market macro events
    if any(k in t for k in ["cpi", "inflation", "rate", "pmi", "gdp", "unemployment", "payroll", "central bank"]):
        return ["Macro"]

    if any(k in t for k in ["crude", "oil", "opec", "gas"]):
        return ["Energy"]

    if any(k in t for k in ["housing", "real estate"]):
        return ["Real Estate"]

    return []


def _collect_watchlist_axes(watchlist: Watchlist) -> Tuple[List[str], List[str]]:
    countries = sorted({(i.country or "").strip().upper() for i in watchlist.items if i.country})
    sectors = sorted({(i.sector or "").strip() for i in watchlist.items if i.sector})
    return countries, sectors


class CatalystsService:
    def __init__(self) -> None:
        self._watchlists = WatchlistService()
        self._finnhub = FinnhubService()
        self._macro = MacroCalendarService()

    def get_catalysts(self, user_id: str, watchlist_id: str, from_date: str, to_date: str) -> CatalystsResponse:
        watchlist = self._watchlists.get_watchlist(user_id=user_id, watchlist_id=watchlist_id)
        if not watchlist:
            raise ValueError("Watchlist not found")

        countries, sectors = _collect_watchlist_axes(watchlist)

        events: List[CatalystEvent] = []
        providers = {
            "earnings": "ok",
            "macro": "curated",
        }

        # Earnings (per-symbol to keep results tight).
        for item in watchlist.items:
            try:
                earnings = self._finnhub.get_earnings_calendar(
                    from_date=from_date,
                    to_date=to_date,
                    symbol=item.symbol,
                    international=True,
                )

                for e in earnings:
                    date_str = e.get("date")
                    if not date_str:
                        continue

                    # We only have a date + "hour" bucket, so we keep it date-only.
                    utc_time = f"{date_str}T00:00:00Z"

                    title = f"{item.symbol} earnings"
                    hour = e.get("hour")
                    if hour:
                        title = f"{title} ({hour})"

                    events.append(
                        CatalystEvent(
                            id=str(uuid.uuid4()),
                            type="earnings",
                            title=title,
                            utc_time=utc_time,
                            date=date_str,
                            symbol=item.symbol,
                            country=item.country,
                            sectors=[s for s in [item.sector] if s],
                            source="Finnhub",
                            meta={
                                "epsEstimate": e.get("epsEstimate"),
                                "epsActual": e.get("epsActual"),
                                "revenueEstimate": e.get("revenueEstimate"),
                                "revenueActual": e.get("revenueActual"),
                                "quarter": e.get("quarter"),
                                "year": e.get("year"),
                                "hour": hour,
                            },
                        )
                    )

            except Exception as ex:
                logging.warning("Earnings calendar failed for %s: %s", item.symbol, str(ex))
                providers["earnings"] = "degraded"

        # Macro events (curated, free)
        curated_macro = self._macro.get_events(from_date=from_date, to_date=to_date)
        if not curated_macro:
            providers["macro"] = "curated_empty"

        for e in curated_macro:
            # Filter by watchlist countries when possible.
            if countries and e.country and len(e.country) == 2 and e.country not in countries:
                continue

            # Filter by sectors if we have both sides.
            if sectors and e.sectors:
                if not any(s in sectors for s in e.sectors):
                    continue

            events.append(e)

        # Sort by time, then title for stability.
        events.sort(key=lambda e: (e.utc_time, e.title))

        return CatalystsResponse(
            watchlist_id=watchlist.id,
            from_date=from_date,
            to_date=to_date,
            countries=countries,
            sectors=sectors,
            events=events,
            providers=providers,
        )
