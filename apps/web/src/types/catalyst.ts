export type CatalystEvent = {
  id: string;
  type: 'earnings' | 'macro';
  title: string;
  utc_time: string;
  date: string;
  symbol?: string | null;
  country?: string | null;
  impact?: string | null;
  sectors: string[];
  source?: string | null;
  url?: string | null;
  meta: Record<string, unknown>;
};

export type CatalystsResponse = {
  watchlist_id: string;
  from_date: string;
  to_date: string;
  countries: string[];
  sectors: string[];
  events: CatalystEvent[];
  providers: Record<string, string>;
};
