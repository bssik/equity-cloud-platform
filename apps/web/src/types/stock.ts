export interface StockQuote {
  symbol: string;
  price: string;
  change_percent: string;
  volume: string;
  open: string;
  high: string;
  low: string;
  previous_close: string;
}

export interface NewsArticle {
  headline: string;
  summary: string;
  url: string;
  source: string;
  datetime: number;
  image: string;
}
