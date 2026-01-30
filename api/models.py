from pydantic import BaseModel, Field
from typing import Optional

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
