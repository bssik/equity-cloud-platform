import os
import logging
import random
import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import requests


class FinnhubService:
    def __init__(self) -> None:
        self.api_key = os.environ.get("FINNHUB_API_KEY", "")
        self.base_url = "https://finnhub.io/api/v1"

        self._session: Optional[requests.Session] = None
        self._cache_lock = threading.Lock()
        self._cache: Dict[str, Tuple[float, Any]] = {}

        self._default_cache_ttl_seconds = int(os.environ.get("FINNHUB_CACHE_TTL_SECONDS", "60") or "60")
        self._profile_cache_ttl_seconds = int(os.environ.get("FINNHUB_PROFILE_CACHE_TTL_SECONDS", "86400") or "86400")
        self._max_retries = int(os.environ.get("FINNHUB_MAX_RETRIES", "3") or "3")

    def _require_key(self) -> None:
        if not self.api_key:
            raise ValueError("FINNHUB_API_KEY not configured in environment")

    def _get_session(self) -> requests.Session:
        if self._session is None:
            self._session = requests.Session()
        return self._session

    def _cache_key(self, path: str, params: Dict[str, Any]) -> str:
        # Token must never influence the cache key directly.
        safe = {k: v for k, v in params.items() if k != "token"}
        # Stable, deterministic-ish string.
        parts = [f"{k}={safe[k]}" for k in sorted(safe.keys())]
        return f"{path}?{'&'.join(parts)}"

    def _cache_get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._cache_lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            expires_at, value = entry
            if expires_at <= now:
                self._cache.pop(key, None)
                return None
            return value

    def _cache_set(self, key: str, value: Any, ttl_seconds: int) -> None:
        if ttl_seconds <= 0:
            return
        expires_at = time.time() + ttl_seconds
        with self._cache_lock:
            self._cache[key] = (expires_at, value)

    def _get_json(
        self,
        path: str,
        params: Dict[str, Any],
        timeout: int,
        cache_ttl_seconds: int,
    ) -> Any:
        self._require_key()

        params = dict(params)
        params["token"] = self.api_key

        key = self._cache_key(path, params)
        cached = self._cache_get(key)
        if cached is not None:
            return cached

        url = f"{self.base_url}{path}"
        session = self._get_session()

        last_exc: Optional[Exception] = None

        for attempt in range(0, max(self._max_retries, 1)):
            try:
                response = session.get(url, params=params, timeout=timeout)

                # Retry on rate limit or transient server errors.
                if response.status_code == 429 or 500 <= response.status_code <= 599:
                    raise requests.exceptions.HTTPError(
                        f"Transient HTTP {response.status_code}",
                        response=response,
                    )

                response.raise_for_status()

                data = response.json()
                self._cache_set(key, data, ttl_seconds=cache_ttl_seconds)
                return data

            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError, requests.exceptions.HTTPError) as e:
                last_exc = e
                # No sleep after the last attempt.
                if attempt >= self._max_retries - 1:
                    break

                backoff = 0.5 * (2**attempt)
                jitter = random.uniform(0, 0.25)
                sleep_for = min(5.0, backoff + jitter)
                logging.warning("Finnhub call retrying (%s) in %.2fs: %s", path, sleep_for, str(e))
                time.sleep(sleep_for)

            except requests.exceptions.RequestException as e:
                # Non-retryable request errors
                last_exc = e
                break

        # Let the caller decide how to degrade.
        if last_exc:
            raise last_exc
        raise RuntimeError("Finnhub request failed")

    def get_company_profile2(self, symbol: str) -> Dict[str, Any]:
        if not symbol:
            raise ValueError("Symbol is required")

        data = self._get_json(
            path="/stock/profile2",
            params={"symbol": symbol.upper()},
            timeout=10,
            cache_ttl_seconds=self._profile_cache_ttl_seconds,
        )

        # Finnhub returns an empty object for unknown symbols.
        if not data:
            raise ValueError(f"Symbol '{symbol}' not found")

        return data

    def get_earnings_calendar(
        self,
        from_date: str,
        to_date: str,
        symbol: Optional[str] = None,
        international: bool = True,
    ) -> List[Dict[str, Any]]:
        params: Dict[str, Any] = {
            "from": from_date,
            "to": to_date,
        }

        if symbol:
            params["symbol"] = symbol.upper()
        if international:
            params["international"] = "true"

        data = self._get_json(
            path="/calendar/earnings",
            params=params,
            timeout=15,
            cache_ttl_seconds=self._default_cache_ttl_seconds,
        ) or {}
        return data.get("earningsCalendar", []) or []

    def get_economic_calendar(self, from_date: str, to_date: str) -> List[Dict[str, Any]]:
        """Best-effort: Finnhub economic calendar is Premium; may return 4xx.

        We catch known entitlement failures and return an empty list.
        """
        try:
            data = self._get_json(
                path="/calendar/economic",
                params={"from": from_date, "to": to_date},
                timeout=15,
                cache_ttl_seconds=self._default_cache_ttl_seconds,
            ) or {}
            return data.get("economicCalendar", []) or []

        except requests.exceptions.HTTPError as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (401, 402, 403):
                logging.info("Finnhub economic calendar not available (status %s)", status)
                return []
            logging.warning("Economic calendar fetch failed: %s", str(e))
            return []
        except requests.exceptions.RequestException as e:
            logging.warning("Economic calendar fetch failed: %s", str(e))
            return []


def iso_utc_now() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
