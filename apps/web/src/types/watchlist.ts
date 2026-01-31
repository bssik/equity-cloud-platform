export type WatchlistItem = {
  symbol: string;
  country?: string | null;
  industry?: string | null;
  sector?: string | null;
};

export type Watchlist = {
  id: string;
  name: string;
  items: WatchlistItem[];
  created_utc: string;
  updated_utc: string;
};

export type WatchlistSummary = {
  id: string;
  name: string;
  items_count: number;
  countries: string[];
  sectors: string[];
};
