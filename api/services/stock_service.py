import os
import requests
import logging
from models import StockQuote

class StockService:
    def __init__(self):
        self.api_key = os.environ.get("ALPHA_VANTAGE_API_KEY")
        self.base_url = "https://www.alphavantage.co/query"

    def get_quote(self, symbol: str) -> StockQuote:
        if not self.api_key:
            raise ValueError("ALPHA_VANTAGE_API_KEY is missing")

        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": symbol,
            "apikey": self.api_key
        }

        try:
            # Performance Timing: We could log start/end time here if strictly needed,
            # but requests.get response time is usually sufficient for now.
            response = requests.get(self.base_url, params=params, timeout=5)
            response.raise_for_status()
            data = response.json()

            # "Data Wrangling" - Parsing the awkward Alpha Vantage JSON format
            quote_data = data.get("Global Quote", {})

            if not quote_data:
                # Basic error handling: returning empty or raising specific exceptions
                logging.warning(f"No data found for symbol: {symbol}")
                raise ValueError(f"Symbol '{symbol}' not found")

            # Validate and Map using Pydantic (Strong Typing)
            return StockQuote(
                symbol=quote_data.get("01. symbol", symbol),
                price=float(quote_data.get("05. price", 0.0)),
                change_percent=quote_data.get("10. change percent", "0%"),
                volume=quote_data.get("06. volume", "0")
            )

        except requests.exceptions.RequestException as e:
            logging.error(f"API Connection Error: {str(e)}")
            raise

    def get_sma(self, symbol: str) -> dict:
        """Fetch 50-day and 200-day SMA historical data for a symbol"""
        if not self.api_key:
            raise ValueError("ALPHA_VANTAGE_API_KEY is missing")

        sma_data = {}

        # Fetch both SMAs with historical data
        for period in [50, 200]:
            params = {
                "function": "SMA",
                "symbol": symbol,
                "interval": "daily",
                "time_period": period,
                "series_type": "close",
                "apikey": self.api_key
            }

            try:
                response = requests.get(self.base_url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()

                technical_data = data.get("Technical Analysis: SMA", {})

                if technical_data:
                    # Return last 60 days of historical data
                    sorted_dates = sorted(technical_data.keys(), reverse=True)[:60]
                    sma_values = {date: technical_data[date]["SMA"] for date in sorted_dates}

                    sma_data[f"sma{period}_values"] = sma_values
                    # Also include current value for convenience
                    if sorted_dates:
                        sma_data[f"sma{period}"] = float(technical_data[sorted_dates[0]]["SMA"])
                else:
                    logging.warning(f"No SMA{period} data for {symbol}")
                    sma_data[f"sma{period}_values"] = {}
                    sma_data[f"sma{period}"] = None

            except requests.exceptions.RequestException as e:
                logging.error(f"SMA{period} API Error: {str(e)}")
                sma_data[f"sma{period}_values"] = {}
                sma_data[f"sma{period}"] = None

        return sma_data

    def get_daily_prices(self, symbol: str) -> dict:
        """Fetch daily historical price data for a symbol (last 100 data points)"""
        if not self.api_key:
            raise ValueError("ALPHA_VANTAGE_API_KEY is missing")

        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": "compact", # fast (100 data points) vs full
            "apikey": self.api_key
        }

        try:
            response = requests.get(self.base_url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()

            ts_data = data.get("Time Series (Daily)", {})

            if not ts_data:
                logging.warning(f"No daily price data for {symbol}")
                return {"history": []}

            # Transform into list of {date, close}
            history = []
            for date_str, values in ts_data.items():
                try:
                    close_price = float(values.get("4. close", 0))
                    history.append({
                        "date": date_str,
                        "close": close_price
                    })
                except (ValueError, TypeError):
                    continue

            # Sort by date ascending for the chart
            history.sort(key=lambda x: x["date"])

            return {"history": history}

        except requests.exceptions.RequestException as e:
            logging.error(f"Daily Price API Error: {str(e)}")
            raise
