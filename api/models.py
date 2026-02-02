from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict, Any


class WatchlistItem(BaseModel):
    symbol: str = Field(..., description="Ticker symbol (e.g., AAPL)")
    country: Optional[str] = Field(None, description="ISO2 country code when available")
    industry: Optional[str] = Field(None, description="Finnhub industry (best-effort)")
    sector: Optional[str] = Field(None, description="Derived coarse sector label (best-effort)")


class Watchlist(BaseModel):
    id: str
    name: str
    items: List[WatchlistItem] = Field(default_factory=list)
    created_utc: str
    updated_utc: str


class WatchlistSummary(BaseModel):
    id: str
    name: str
    items_count: int
    countries: List[str] = Field(default_factory=list)
    sectors: List[str] = Field(default_factory=list)


class WatchlistCreateRequest(BaseModel):
    name: str
    symbols: List[str] = Field(default_factory=list)


class WatchlistUpdateRequest(BaseModel):
    name: Optional[str] = None
    symbols: Optional[List[str]] = None

class StockQuote(BaseModel):
    symbol: str = Field(..., description="The ticker symbol (e.g., MSFT)")
    price: float = Field(..., description="Current trading price")
    change_percent: float = Field(..., description="Percentage change")
    volume: int = Field(0, description="Trading volume")
    open: Optional[float] = Field(None, description="Opening price")
    high: Optional[float] = Field(None, description="Day high")
    low: Optional[float] = Field(None, description="Day low")
    previous_close: Optional[float] = Field(None, description="Previous closing price")
    cached: bool = Field(False, description="Whether data was served from cache")

class AIAnalysisRequest(BaseModel):
    symbol: str
    quote: StockQuote

# This will be the response structure for our future AI endpoint
class StockAnalysis(BaseModel):
    symbol: str
    sentiment: str = Field(..., description="Bullish, Bearish, or Neutral")
    reasoning: str = Field(..., description="AI-generated explanation")
    confidence_score: float


class CatalystEvent(BaseModel):
    id: str
    type: Literal["earnings", "macro"]
    title: str
    utc_time: str
    date: str
    symbol: Optional[str] = None
    country: Optional[str] = None
    impact: Optional[str] = None
    sectors: List[str] = Field(default_factory=list)
    source: Optional[str] = None
    url: Optional[str] = None
    meta: Dict[str, Any] = Field(default_factory=dict)


class CatalystsResponse(BaseModel):
    watchlist_id: Optional[str] = None
    from_date: str
    to_date: str
    countries: List[str] = Field(default_factory=list)
    sectors: List[str] = Field(default_factory=list)
    events: List[CatalystEvent] = Field(default_factory=list)
    providers: Dict[str, str] = Field(default_factory=dict)


class NewsArticle(BaseModel):
    headline: str
    summary: str = ""
    url: str = ""
    source: str = ""
    datetime: int = 0
    image: str = ""
    symbol: Optional[str] = None


class WatchlistNewsResponse(BaseModel):
    watchlist_id: str
    symbols: List[str] = Field(default_factory=list)
    articles: List[NewsArticle] = Field(default_factory=list)
    providers: Dict[str, str] = Field(default_factory=dict)
