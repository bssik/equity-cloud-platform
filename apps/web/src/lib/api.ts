import { StockQuote, NewsArticle, StockHistoryResponse } from '@/types/stock';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7071/api';

export async function fetchQuote(symbol: string): Promise<StockQuote> {
  const response = await fetch(`${API_BASE_URL}/quote/${symbol}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Stock symbol "${symbol}" not found`);
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please wait a moment.');
    } else if (response.status === 500) {
      throw new Error('Server error. API key may be missing or invalid.');
    } else {
      throw new Error('Failed to fetch stock data');
    }
  }

  return response.json();
}

export async function fetchNews(symbol: string): Promise<NewsArticle[]> {
  const response = await fetch(`${API_BASE_URL}/news/${symbol}`);

  if (!response.ok) {
    throw new Error('Failed to fetch news');
  }

  const data = await response.json();
  return data.articles || [];
}

export async function fetchSMA(symbol: string): Promise<{ sma50_values: Record<string, number>, sma200_values: Record<string, number> } | null> {
  const response = await fetch(`${API_BASE_URL}/sma/${symbol}`);

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function fetchHistory(symbol: string): Promise<StockHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/history/${symbol}`);

  if (!response.ok) {
    // Fallback or specific error handling can be added here
    throw new Error('Failed to fetch stock history');
  }

  return response.json();
}
