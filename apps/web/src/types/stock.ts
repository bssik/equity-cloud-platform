export interface StockQuote {
  symbol: string;
  price: number;
  change_percent: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  previous_close: number;
}

export interface NewsArticle {
  symbol?: string;
  headline: string;
  summary: string;
  url: string;
  source: string;
  datetime: number;
  image: string;
}

export interface StockHistoryItem {
  date: string;
  close: number;
  sma50?: number;
  sma200?: number;
  rsi?: number;
}

export interface StockHistoryResponse {
  symbol: string;
  history: StockHistoryItem[];
  latest_sma: {
    sma50: number | null;
    sma200: number | null;
  };
}
