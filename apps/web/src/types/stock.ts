export interface StockQuote {
  symbol: string;
  price: number;
  change_percent: string;
  volume: string;
  open: number;
  high: number;
  low: number;
  previous_close: number;
}

export interface NewsArticle {
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
}

export interface StockHistoryResponse {
  history: StockHistoryItem[];
}
