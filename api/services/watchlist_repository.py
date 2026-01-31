from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, List, Optional

try:
    from azure.data.tables import TableServiceClient
except Exception:  # pragma: no cover
    TableServiceClient = None  # type: ignore

from models import Watchlist, WatchlistItem, WatchlistSummary


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def _uniq_sorted(values: List[str]) -> List[str]:
    out = sorted({v for v in values if v})
    return out


@dataclass(frozen=True)
class WatchlistInputs:
    name: str
    symbols: List[str]


class WatchlistRepository:
    def list_watchlists(self, user_id: str) -> List[WatchlistSummary]:
        raise NotImplementedError

    def get_watchlist(self, user_id: str, watchlist_id: str) -> Optional[Watchlist]:
        raise NotImplementedError

    def create_watchlist(self, user_id: str, name: str, items: List[WatchlistItem]) -> Watchlist:
        raise NotImplementedError

    def upsert_watchlist(self, user_id: str, watchlist: Watchlist) -> Watchlist:
        raise NotImplementedError

    def delete_watchlist(self, user_id: str, watchlist_id: str) -> bool:
        raise NotImplementedError


class LocalFileWatchlistRepository(WatchlistRepository):
    """Local-dev-only storage.

    Note: Azure Functions in Azure may run with a read-only filesystem, so this
    is intended as a fallback for local development when storage isn't configured.
    """

    def __init__(self, file_path: str) -> None:
        self._file_path = file_path
        self._lock = threading.Lock()

    def _ensure_parent(self) -> None:
        parent = os.path.dirname(self._file_path)
        if parent:
            os.makedirs(parent, exist_ok=True)

    def _read_all(self) -> Dict[str, dict]:
        self._ensure_parent()
        if not os.path.exists(self._file_path):
            return {}
        with open(self._file_path, "r", encoding="utf-8") as f:
            raw = json.load(f)
        if not isinstance(raw, dict):
            return {}
        return raw

    def _write_all(self, data: Dict[str, dict]) -> None:
        self._ensure_parent()
        with open(self._file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def list_watchlists(self, user_id: str) -> List[WatchlistSummary]:
        with self._lock:
            raw = self._read_all()

        per_user = raw.get(user_id) if isinstance(raw, dict) else None
        if not isinstance(per_user, dict):
            per_user = {}

        summaries: List[WatchlistSummary] = []
        for watchlist_id, payload in per_user.items():
            try:
                wl = Watchlist.model_validate(payload)
            except Exception:
                continue

            countries = _uniq_sorted([i.country or "" for i in wl.items])
            sectors = _uniq_sorted([i.sector or "" for i in wl.items])

            summaries.append(
                WatchlistSummary(
                    id=watchlist_id,
                    name=wl.name,
                    items_count=len(wl.items),
                    countries=countries,
                    sectors=sectors,
                )
            )

        summaries.sort(key=lambda s: s.name.lower())
        return summaries

    def get_watchlist(self, user_id: str, watchlist_id: str) -> Optional[Watchlist]:
        with self._lock:
            raw = self._read_all()

            per_user = raw.get(user_id) if isinstance(raw, dict) else None
            if not isinstance(per_user, dict):
                per_user = {}

            payload = per_user.get(watchlist_id)

        if not payload:
            return None

        try:
            return Watchlist.model_validate(payload)
        except Exception:
            return None

    def create_watchlist(self, user_id: str, name: str, items: List[WatchlistItem]) -> Watchlist:
        watchlist_id = str(uuid.uuid4())
        now = _utc_now_iso()

        wl = Watchlist(
            id=watchlist_id,
            name=name,
            items=items,
            created_utc=now,
            updated_utc=now,
        )

        with self._lock:
            raw = self._read_all()
            per_user = raw.get(user_id) if isinstance(raw, dict) else None
            if not isinstance(per_user, dict):
                per_user = {}
            per_user[watchlist_id] = wl.model_dump()
            raw[user_id] = per_user
            self._write_all(raw)

        return wl

    def upsert_watchlist(self, user_id: str, watchlist: Watchlist) -> Watchlist:
        with self._lock:
            raw = self._read_all()

            per_user = raw.get(user_id) if isinstance(raw, dict) else None
            if not isinstance(per_user, dict):
                per_user = {}

            per_user[watchlist.id] = watchlist.model_dump()
            raw[user_id] = per_user
            self._write_all(raw)

        return watchlist

    def delete_watchlist(self, user_id: str, watchlist_id: str) -> bool:
        with self._lock:
            raw = self._read_all()

            per_user = raw.get(user_id) if isinstance(raw, dict) else None
            if not isinstance(per_user, dict):
                per_user = {}

            existed = watchlist_id in per_user
            if existed:
                per_user.pop(watchlist_id, None)
                raw[user_id] = per_user
                self._write_all(raw)
        return existed


class AzureTableWatchlistRepository(WatchlistRepository):
    def __init__(self, connection_string: str, table_name: str = "Watchlists") -> None:
        if TableServiceClient is None:
            raise RuntimeError("azure-data-tables is not installed")

        self._service = TableServiceClient.from_connection_string(connection_string)
        self._table = self._service.get_table_client(table_name)
        try:
            self._table.create_table()
        except Exception:
            pass

    def list_watchlists(self, user_id: str) -> List[WatchlistSummary]:
        summaries: List[WatchlistSummary] = []

        entities = self._table.query_entities(f"PartitionKey eq '{user_id}'")
        for ent in entities:
            payload_json = ent.get("payload")
            if not payload_json:
                continue
            try:
                wl = Watchlist.model_validate_json(payload_json)
            except Exception:
                continue

            countries = _uniq_sorted([i.country or "" for i in wl.items])
            sectors = _uniq_sorted([i.sector or "" for i in wl.items])

            summaries.append(
                WatchlistSummary(
                    id=wl.id,
                    name=wl.name,
                    items_count=len(wl.items),
                    countries=countries,
                    sectors=sectors,
                )
            )

        summaries.sort(key=lambda s: s.name.lower())
        return summaries

    def get_watchlist(self, user_id: str, watchlist_id: str) -> Optional[Watchlist]:
        try:
            ent = self._table.get_entity(user_id, watchlist_id)
        except Exception:
            return None

        payload_json = ent.get("payload")
        if not payload_json:
            return None

        try:
            return Watchlist.model_validate_json(payload_json)
        except Exception:
            return None

    def create_watchlist(self, user_id: str, name: str, items: List[WatchlistItem]) -> Watchlist:
        watchlist_id = str(uuid.uuid4())
        now = _utc_now_iso()
        wl = Watchlist(
            id=watchlist_id,
            name=name,
            items=items,
            created_utc=now,
            updated_utc=now,
        )

        self._table.upsert_entity(
            {
                "PartitionKey": user_id,
                "RowKey": watchlist_id,
                "payload": wl.model_dump_json(),
                "name": name,
                "updated_utc": now,
            },
            mode="merge",
        )

        return wl

    def upsert_watchlist(self, user_id: str, watchlist: Watchlist) -> Watchlist:
        self._table.upsert_entity(
            {
                "PartitionKey": user_id,
                "RowKey": watchlist.id,
                "payload": watchlist.model_dump_json(),
                "name": watchlist.name,
                "updated_utc": watchlist.updated_utc,
            },
            mode="merge",
        )

        return watchlist

    def delete_watchlist(self, user_id: str, watchlist_id: str) -> bool:
        try:
            self._table.delete_entity(user_id, watchlist_id)
            return True
        except Exception:
            return False


def build_watchlist_repository() -> WatchlistRepository:
    def _is_local_dev() -> bool:
        env = (
            os.environ.get("AZURE_FUNCTIONS_ENVIRONMENT")
            or os.environ.get("FUNCTIONS_ENVIRONMENT")
            or os.environ.get("ENVIRONMENT")
            or ""
        ).strip().lower()
        return env in ("development", "dev", "local")

    def _is_running_in_azure() -> bool:
        # Common Azure App Service / Functions markers.
        return bool(
            os.environ.get("WEBSITE_INSTANCE_ID")
            or os.environ.get("WEBSITE_SITE_NAME")
            or os.environ.get("FUNCTIONS_WORKER_RUNTIME")
        ) and not _is_local_dev()

    connection_string = (
        os.environ.get("EQUITY_STORAGE_CONNECTION")
        or os.environ.get("AzureWebJobsStorage")
        or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
        or ""
    )

    if connection_string:
        try:
            return AzureTableWatchlistRepository(connection_string=connection_string)
        except Exception as e:
            if _is_local_dev():
                logging.warning("Falling back to local watchlist repo: %s", str(e))
            else:
                logging.error("Watchlist storage unavailable: %s", str(e))
                raise RuntimeError("Watchlist storage unavailable")

    if _is_running_in_azure():
        # In Azure, the filesystem may be read-only / ephemeral; do not silently fall back.
        raise RuntimeError(
            "Watchlist storage not configured. Set EQUITY_STORAGE_CONNECTION or AzureWebJobsStorage."
        )

    # Local fallback (dev)
    root = os.path.dirname(os.path.dirname(__file__))
    file_path = os.path.join(root, ".localdata", "watchlists.json")
    return LocalFileWatchlistRepository(file_path=file_path)
