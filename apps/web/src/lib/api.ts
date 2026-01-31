import { StockQuote, NewsArticle, StockHistoryResponse } from '@/types/stock';
import type { Watchlist, WatchlistSummary } from '@/types/watchlist';
import type { CatalystsResponse } from '@/types/catalyst';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

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

export async function fetchWatchlists(): Promise<WatchlistSummary[]> {
  const response = await fetch(`${API_BASE_URL}/watchlists`);

  if (!response.ok) {
    throw new Error('Failed to fetch watchlists');
  }

  return response.json();
}

export async function createWatchlist(payload: {
  name: string;
  symbols?: string[];
}): Promise<Watchlist> {
  const response = await fetch(`${API_BASE_URL}/watchlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: payload.name, symbols: payload.symbols ?? [] }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to create watchlist');
  }

  return response.json();
}

export async function fetchWatchlist(watchlistId: string): Promise<Watchlist> {
  const response = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to fetch watchlist');
  }

  return response.json();
}

export async function updateWatchlist(
  watchlistId: string,
  payload: { name?: string; symbols?: string[] }
): Promise<Watchlist> {
  const response = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to update watchlist');
  }

  return response.json();
}

export async function deleteWatchlist(watchlistId: string): Promise<{ deleted: boolean }> {
  const response = await fetch(`${API_BASE_URL}/watchlists/${watchlistId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete watchlist');
  }

  return response.json();
}

export async function fetchCatalysts(params: {
  watchlistId: string;
  from: string;
  to: string;
}): Promise<CatalystsResponse> {
  const query = new URLSearchParams({
    watchlistId: params.watchlistId,
    from: params.from,
    to: params.to,
  });

  const response = await fetch(`${API_BASE_URL}/catalysts?${query.toString()}`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to fetch catalysts');
  }

  return response.json();
}
