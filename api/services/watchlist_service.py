import logging
from typing import List, Optional

from models import (
    Watchlist,
    WatchlistItem,
    WatchlistSummary,
)

from services.finnhub_service import FinnhubService, iso_utc_now
from services.sector_mapping import derive_sector_from_industry
from services.watchlist_repository import WatchlistRepository, build_watchlist_repository


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _unique_symbols(symbols: List[str]) -> List[str]:
    uniq = []
    seen = set()
    for raw in symbols:
        sym = _normalize_symbol(raw)
        if not sym:
            continue
        if sym in seen:
            continue
        seen.add(sym)
        uniq.append(sym)
    return uniq


class WatchlistService:
    def __init__(self, repo: Optional[WatchlistRepository] = None) -> None:
        self._repo = repo or build_watchlist_repository()

    def list_watchlists(self, user_id: str) -> List[WatchlistSummary]:
        return self._repo.list_watchlists(user_id=user_id)

    def get_watchlist(self, user_id: str, watchlist_id: str) -> Optional[Watchlist]:
        return self._repo.get_watchlist(user_id=user_id, watchlist_id=watchlist_id)

    def create_watchlist(self, user_id: str, name: str, symbols: List[str]) -> Watchlist:
        items = self._build_items_from_symbols(symbols)
        return self._repo.create_watchlist(user_id=user_id, name=name, items=items)

    def update_watchlist(self, user_id: str, watchlist_id: str, name: Optional[str], symbols: Optional[List[str]]) -> Optional[Watchlist]:
        existing = self._repo.get_watchlist(user_id=user_id, watchlist_id=watchlist_id)
        if not existing:
            return None

        updated_items = existing.items
        if symbols is not None:
            updated_items = self._build_items_from_symbols(symbols)

        updated = Watchlist(
            id=existing.id,
            name=name if name is not None else existing.name,
            items=updated_items,
            created_utc=existing.created_utc,
            updated_utc=iso_utc_now(),
        )

        return self._repo.upsert_watchlist(user_id=user_id, watchlist=updated)

    def delete_watchlist(self, user_id: str, watchlist_id: str) -> bool:
        return self._repo.delete_watchlist(user_id=user_id, watchlist_id=watchlist_id)

    def _build_items_from_symbols(self, symbols: List[str]) -> List[WatchlistItem]:
        uniq = _unique_symbols(symbols)
        items: List[WatchlistItem] = []

        if not uniq:
            return items

        finnhub = FinnhubService()

        for sym in uniq:
            country = None
            industry = None
            sector = None

            try:
                profile = finnhub.get_company_profile2(sym)
                country = profile.get("country")
                industry = profile.get("finnhubIndustry")
                sector = derive_sector_from_industry(industry)
            except Exception as e:
                logging.warning("Watchlist enrich failed for %s: %s", sym, str(e))

            items.append(
                WatchlistItem(
                    symbol=sym,
                    country=country,
                    industry=industry,
                    sector=sector,
                )
            )

        return items
