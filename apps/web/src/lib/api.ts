import { StockQuote, NewsArticle, StockHistoryResponse } from '@/types/stock';
import type { Watchlist, WatchlistSummary } from '@/types/watchlist';
import type { CatalystsResponse } from '@/types/catalyst';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export type AuthMeResult = {
  available: boolean;
  authenticated: boolean;
  userDetails?: string;
};

type AuthMeClientPrincipal = {
  userDetails?: string;
  user_details?: string;
};

type AuthMeArrayItem = {
  userDetails?: string;
  user_details?: string;
  clientPrincipal?: AuthMeClientPrincipal;
};

type AuthMeObject = {
  clientPrincipal?: AuthMeClientPrincipal;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asAuthMeArrayItem(value: unknown): AuthMeArrayItem | null {
  if (!isRecord(value)) return null;
  return value as AuthMeArrayItem;
}

function asAuthMeObject(value: unknown): AuthMeObject | null {
  if (!isRecord(value)) return null;
  return value as AuthMeObject;
}

function extractUserDetails(payload: unknown): string | undefined {
  // Azure Static Web Apps /.auth/me usually returns an array.
  // Be tolerant: we support several shapes to avoid hard-coding.
  try {
    if (Array.isArray(payload)) {
      const first = asAuthMeArrayItem(payload[0]);
      if (!first) return undefined;
      return (
        first.userDetails ??
        first.user_details ??
        first.clientPrincipal?.userDetails ??
        first.clientPrincipal?.user_details
      );
    }

    const obj = asAuthMeObject(payload);
    return obj?.clientPrincipal?.userDetails ?? obj?.clientPrincipal?.user_details;
  } catch {
    return undefined;
  }
}

export async function fetchAuthMe(): Promise<AuthMeResult> {
  try {
    const response = await fetch('/.auth/me', { method: 'GET', cache: 'no-store' });

    if (response.status === 404) {
      // Most likely running without SWA (e.g. Next dev server).
      return { available: false, authenticated: false };
    }

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return { available: true, authenticated: false };
    }

    const authenticated =
      Array.isArray(payload) ? payload.length > 0 : Boolean(asAuthMeObject(payload)?.clientPrincipal);
    return {
      available: true,
      authenticated,
      userDetails: extractUserDetails(payload),
    };
  } catch {
    // Network error or blocked endpoint.
    return { available: false, authenticated: false };
  }
}

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
    if (response.status === 401 || response.status === 403) {
      return [];
    }
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
    if (response.status === 401 || response.status === 403) {
      throw new ApiError('Sign in required to create watchlists.', response.status);
    }

    const data = await response.json().catch(() => null);
    throw new ApiError(data?.error || 'Failed to create watchlist', response.status);
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
  watchlistId?: string;
  from: string;
  to: string;
}): Promise<CatalystsResponse> {
  const query = new URLSearchParams({
    from: params.from,
    to: params.to,
  });

  if (params.watchlistId) {
    query.append('watchlistId', params.watchlistId);
  }

  const response = await fetch(`${API_BASE_URL}/catalysts?${query.toString()}`);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || 'Failed to fetch catalysts');
  }

  return response.json();
}
