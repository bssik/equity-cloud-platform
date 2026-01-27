import os
import requests
import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta

class NewsService:
    """
    Service for fetching stock-related news from Finnhub API.
    Using Finnhub because it's free-tier friendly and returns company news.
    """

    def __init__(self):
        self.api_key = os.environ.get('FINNHUB_API_KEY', '')
        self.base_url = "https://finnhub.io/api/v1"

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
            raise ValueError("FINNHUB_API_KEY not configured in environment")

        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)

        # Format dates as YYYY-MM-DD
        from_date = start_date.strftime('%Y-%m-%d')
        to_date = end_date.strftime('%Y-%m-%d')

        logging.info(f"Fetching news for {symbol} from {from_date} to {to_date}")

        try:
            response = requests.get(
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

            logging.info(f"Success: Retrieved {len(result)} news articles for {symbol}")
            return result

        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                raise ValueError(f"Invalid stock symbol: {symbol}")
            logging.error(f"Finnhub API HTTP Error: {e}")
            raise Exception("News API temporarily unavailable")
        except requests.exceptions.Timeout:
            logging.error("Finnhub API request timeout")
            raise Exception("News API request timeout")
        except Exception as e:
            logging.error(f"Finnhub API Error: {str(e)}")
            raise Exception("Failed to fetch news data")
