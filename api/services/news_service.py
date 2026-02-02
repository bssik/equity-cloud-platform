import os
import requests
import logging
import threading
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta


class DependencyNotConfiguredError(RuntimeError):
    pass


class UpstreamRateLimitedError(RuntimeError):
    pass


class UpstreamUnavailableError(RuntimeError):
    pass


_CACHE_TTL_SECONDS = 300
_cache_lock = threading.Lock()
_news_cache: Dict[Tuple[str, int], Tuple[float, List[Dict[str, Any]]]] = {}

class NewsService:
    """
    Service for fetching stock-related news from Finnhub API.
    Using Finnhub because it's free-tier friendly and returns company news.
    """

    def __init__(self):
        self.api_key = os.environ.get('FINNHUB_API_KEY', '')
        self.base_url = "https://finnhub.io/api/v1"
        self._session = requests.Session()

    def get_company_news(self, symbol: str, days: int = 7) -> List[Dict[str, Any]]:
        """
        Fetch recent company news for a stock symbol.

        Args:
            symbol: Stock ticker symbol (e.g., 'AAPL')
            days: Number of days back to fetch news (default: 7)

        Returns:
            List of news articles with headline, summary, url, source, datetime

        Raises:
            ValueError: If symbol is invalid or no API key configured
            Exception: For API errors
        """
        if not symbol:
            raise ValueError("Stock symbol is required")

        if not self.api_key:
            raise DependencyNotConfiguredError("FINNHUB_API_KEY not configured")

        cache_key = (symbol.strip().upper(), int(days))
        now = time.time()
        with _cache_lock:
            cached = _news_cache.get(cache_key)
            if cached and cached[0] > now:
                return cached[1]

        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        # Format dates as YYYY-MM-DD
        from_date = start_date.strftime('%Y-%m-%d')
        to_date = end_date.strftime('%Y-%m-%d')

        logging.info(f"Fetching news for {symbol} from {from_date} to {to_date}")

        try:
            response = self._session.get(
                f"{self.base_url}/company-news",
                params={
                    "symbol": symbol.upper(),
                    "from": from_date,
                    "to": to_date,
                    "token": self.api_key
                },
                timeout=10
            )

            response.raise_for_status()
            news_data = response.json()

            # Finnhub returns array of news objects
            # Filter out items without headlines and limit to 10 most recent
            filtered_news = [
                {
                    "headline": item.get("headline", ""),
                    "summary": item.get("summary", ""),
                    "url": item.get("url", ""),
                    "source": item.get("source", ""),
                    "datetime": item.get("datetime", 0),
                    "image": item.get("image", "")
                }
                for item in news_data
                if item.get("headline")
            ]

            # Sort by datetime descending and take top 10
            filtered_news.sort(key=lambda x: x["datetime"], reverse=True)
            result = filtered_news[:10]

            with _cache_lock:
                _news_cache[cache_key] = (now + _CACHE_TTL_SECONDS, result)

            logging.info(f"Success: Retrieved {len(result)} news articles for {symbol}")
            return result

        except requests.exceptions.HTTPError as e:
            status = getattr(e.response, "status_code", None)
            if status == 404:
                raise ValueError(f"Invalid stock symbol: {symbol}")
            if status == 429:
                logging.warning("Finnhub rate limited for %s", symbol)
                raise UpstreamRateLimitedError("Upstream rate limited")
            logging.error(f"Finnhub API HTTP Error: {e}")
            raise UpstreamUnavailableError("News API temporarily unavailable")
        except requests.exceptions.Timeout:
            logging.error("Finnhub API request timeout")
            raise UpstreamUnavailableError("News API request timeout")
        except Exception as e:
            logging.error(f"Finnhub API Error: {str(e)}")
            raise UpstreamUnavailableError("Failed to fetch news data")


    def get_watchlist_news(
        self,
        symbols: List[str],
        days: int = 7,
        per_symbol_limit: int = 5,
        total_limit: int = 40,
        max_symbols: int = 25,
        symbol_filter: Optional[str] = None,
        cache_version: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch aggregated news for a list of symbols.

        Returns a flat list of articles with an extra `symbol` field.

        Args:
            cache_version: Optional version string (e.g., watchlist.updated_utc)
                          that invalidates the aggregation cache when changed.
        """

        uniq: List[str] = []
        seen = set()
        for raw in symbols:
            sym = (raw or "").strip().upper()
            if not sym or sym in seen:
                continue
            seen.add(sym)
            uniq.append(sym)

        if symbol_filter:
            sf = symbol_filter.strip().upper()
            uniq = [s for s in uniq if s == sf]

        uniq = uniq[: max_symbols]

        # Cache key includes version to auto-invalidate on watchlist changes
        aggregation_key = (
            tuple(sorted(uniq)),
            days,
            per_symbol_limit,
            total_limit,
            (symbol_filter or "").strip().upper(),
            cache_version or "",
        )

        now = time.time()
        with _cache_lock:
            cached = _news_cache.get(aggregation_key)
            if cached and cached[0] > now:
                return cached[1]

        aggregated: List[Dict[str, Any]] = []
        for sym in uniq:
            items = self.get_company_news(sym, days=days)
            for it in items[: max(1, per_symbol_limit)]:
                merged = dict(it)
                merged["symbol"] = sym
                aggregated.append(merged)

        aggregated.sort(key=lambda x: x.get("datetime", 0), reverse=True)
        result = aggregated[: max(1, total_limit)]

        with _cache_lock:
            _news_cache[aggregation_key] = (now + _CACHE_TTL_SECONDS, result)

        return result
