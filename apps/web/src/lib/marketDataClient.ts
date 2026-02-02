import { fetchHistory, fetchNews, fetchQuote } from '@/lib/api';
import { fetchMockHistory, fetchMockNews, fetchMockQuote } from '@/lib/mockService';
import { NewsArticle, StockHistoryResponse, StockQuote } from '@/types/stock';

export type MarketDataSource = 'mock' | 'api';

export function getMarketDataSource(): MarketDataSource {
  const raw = process.env.NEXT_PUBLIC_MARKET_DATA_SOURCE;

  // Default to real API to avoid silently showing demo/mock market data.
  // Set NEXT_PUBLIC_MARKET_DATA_SOURCE=mock to opt into mock mode explicitly.
  if (!raw) return 'api';

  const normalized = raw.toLowerCase();

  if (normalized === 'mock' || normalized === 'api') {
    return normalized;
  }

  // Fail safe: prefer real API if misconfigured.
  return 'api';
}

export async function marketFetchQuote(symbol: string): Promise<StockQuote> {
  return getMarketDataSource() === 'api' ? fetchQuote(symbol) : fetchMockQuote(symbol);
}

export async function marketFetchNews(symbol: string): Promise<NewsArticle[]> {
  return getMarketDataSource() === 'api' ? fetchNews(symbol) : fetchMockNews(symbol);
}

export async function marketFetchHistory(symbol: string): Promise<StockHistoryResponse> {
  return getMarketDataSource() === 'api' ? fetchHistory(symbol) : fetchMockHistory(symbol);
}
