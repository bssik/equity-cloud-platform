'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CatalystEvent, CatalystsResponse } from '@/types/catalyst';
import type { Watchlist, WatchlistSummary } from '@/types/watchlist';
import {
  createWatchlist,
  fetchCatalysts,
  fetchWatchlist,
  fetchWatchlists,
  updateWatchlist,
} from '@/lib/api';

function toDateInputValue(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function uniqUpperSymbols(items: { symbol: string }[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const i of items) {
    const sym = i.symbol.trim().toUpperCase();
    if (!sym || seen.has(sym)) continue;
    seen.add(sym);
    out.push(sym);
  }
  return out;
}

function groupByDate(events: CatalystEvent[]): Array<{ date: string; events: CatalystEvent[] }> {
  const map = new Map<string, CatalystEvent[]>();
  for (const e of events) {
    const date = e.date || e.utc_time.slice(0, 10);
    const arr = map.get(date) ?? [];
    arr.push(e);
    map.set(date, arr);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, es]) => ({ date, events: es }));
}

export default function CatalystsPanel() {
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const [fromDate, setFromDate] = useState(() => toDateInputValue(new Date()));
  const [toDate, setToDate] = useState(() => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + 30);
    return toDateInputValue(d);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const [activeWatchlist, setActiveWatchlist] = useState<Watchlist | null>(null);
  const [catalysts, setCatalysts] = useState<CatalystsResponse | null>(null);

  const [createName, setCreateName] = useState('');
  const [createSymbols, setCreateSymbols] = useState('');

  const [addSymbol, setAddSymbol] = useState('');

  const selectedSummary = useMemo(
    () => watchlists.find((w) => w.id === selectedId) ?? null,
    [watchlists, selectedId]
  );

  const grouped = useMemo(() => groupByDate(catalysts?.events ?? []), [catalysts]);

  useEffect(() => {
    let cancelled = false;

    async function loadWatchlists() {
      setError('');
      try {
        const list = await fetchWatchlists();
        if (cancelled) return;
        setWatchlists(list);
        if (list.length > 0) {
          setSelectedId((prev) => prev || list[0].id);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load watchlists');
      }
    }

    loadWatchlists();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError('');
      try {
        const [wl, cats] = await Promise.all([
          fetchWatchlist(selectedId),
          fetchCatalysts({ watchlistId: selectedId, from: fromDate, to: toDate }),
        ]);

        if (cancelled) return;
        setActiveWatchlist(wl);
        setCatalysts(cats);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load catalysts');
        setActiveWatchlist(null);
        setCatalysts(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [selectedId, fromDate, toDate]);

  async function refreshWatchlists() {
    const list = await fetchWatchlists();
    setWatchlists(list);
  }

  async function onCreateWatchlist(e: React.FormEvent) {
    e.preventDefault();
    if (!createName.trim()) return;

    setLoading(true);
    setError('');

    try {
      const symbols = createSymbols
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const created = await createWatchlist({ name: createName.trim(), symbols });
      await refreshWatchlists();
      setSelectedId(created.id);
      setCreateName('');
      setCreateSymbols('');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to create watchlist');
    } finally {
      setLoading(false);
    }
  }

  async function onAddSymbol(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWatchlist) return;

    const sym = addSymbol.trim().toUpperCase();
    if (!sym) return;

    const nextSymbols = uniqUpperSymbols([
      ...activeWatchlist.items.map((i) => ({ symbol: i.symbol })),
      { symbol: sym },
    ]);

    setLoading(true);
    setError('');
    try {
      const updated = await updateWatchlist(activeWatchlist.id, { symbols: nextSymbols });
      setActiveWatchlist(updated);
      await refreshWatchlists();
      setAddSymbol('');

      // Refresh catalysts after enrichment
      const cats = await fetchCatalysts({ watchlistId: updated.id, from: fromDate, to: toDate });
      setCatalysts(cats);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to add symbol');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-12">
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl bg-white dark:bg-[#0f0f10] overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Catalysts</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 font-mono">
              Earnings + macro, filtered to your watchlist countries/sectors
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-mono text-gray-500 dark:text-gray-500">From</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 text-xs font-mono"
            />
            <label className="text-xs font-mono text-gray-500 dark:text-gray-500">To</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] text-gray-800 dark:text-gray-200 text-xs font-mono"
            />
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Watchlists</p>
              </div>

              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] text-gray-900 dark:text-white font-mono text-sm"
              >
                {watchlists.length === 0 ? (
                  <option value="">No watchlists yet</option>
                ) : (
                  watchlists.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.items_count})
                    </option>
                  ))
                )}
              </select>

              {selectedSummary && (
                <div className="text-xs font-mono text-gray-500 dark:text-gray-500 space-y-1">
                  <div>Countries: {selectedSummary.countries.length ? selectedSummary.countries.join(', ') : '—'}</div>
                  <div>Sectors: {selectedSummary.sectors.length ? selectedSummary.sectors.join(', ') : '—'}</div>
                </div>
              )}
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-[#0b0b0c]">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Create</p>
              <form onSubmit={onCreateWatchlist} className="space-y-2">
                <input
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Name (e.g., Core Holdings)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] text-gray-900 dark:text-white font-mono text-sm"
                />
                <input
                  value={createSymbols}
                  onChange={(e) => setCreateSymbols(e.target.value)}
                  placeholder="Symbols (comma-separated)"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] text-gray-900 dark:text-white font-mono text-sm"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm"
                >
                  Create watchlist
                </button>
              </form>
            </div>

            {activeWatchlist && (
              <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-3 bg-gray-50 dark:bg-[#0b0b0c]">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Holdings</p>

                <div className="flex flex-wrap gap-2 mb-3">
                  {activeWatchlist.items.length === 0 ? (
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-500">No symbols yet</span>
                  ) : (
                    activeWatchlist.items.map((it) => (
                      <span
                        key={it.symbol}
                        className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] text-xs font-mono text-gray-700 dark:text-gray-300"
                        title={[it.country, it.sector, it.industry].filter(Boolean).join(' • ')}
                      >
                        {it.symbol}
                      </span>
                    ))
                  )}
                </div>

                <form onSubmit={onAddSymbol} className="flex gap-2">
                  <input
                    value={addSymbol}
                    onChange={(e) => setAddSymbol(e.target.value)}
                    placeholder="Add symbol"
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] text-gray-900 dark:text-white font-mono text-sm"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm disabled:opacity-60"
                  >
                    Add
                  </button>
                </form>

                <p className="mt-2 text-[11px] font-mono text-gray-500 dark:text-gray-500">
                  Countries/industry/sector are enriched via Finnhub profile2 + heuristic mapping.
                </p>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 text-xs font-mono">
                {error}
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Timeline</p>
              <div className="text-xs font-mono text-gray-500 dark:text-gray-500">
                Providers: earnings={catalysts?.providers.earnings ?? '—'}, macro={catalysts?.providers.macro ?? '—'}
              </div>
            </div>

            <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
              {loading ? (
                <div className="p-6 text-sm font-mono text-gray-500 dark:text-gray-500">Loading…</div>
              ) : grouped.length === 0 ? (
                <div className="p-6 text-sm font-mono text-gray-500 dark:text-gray-500">
                  No catalysts found for this range.
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {grouped.map((g) => (
                    <div key={g.date} className="p-4">
                      <div className="text-xs font-mono text-gray-500 dark:text-gray-500 mb-2">{g.date}</div>
                      <div className="space-y-2">
                        {g.events.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex items-start justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111] px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="text-sm text-gray-900 dark:text-white truncate">
                                {ev.title}
                              </div>
                              <div className="text-[11px] font-mono text-gray-500 dark:text-gray-500 mt-1">
                                <span className="mr-2">type={ev.type}</span>
                                {ev.symbol ? <span className="mr-2">symbol={ev.symbol}</span> : null}
                                {ev.country ? <span className="mr-2">country={ev.country}</span> : null}
                                {ev.impact ? <span className="mr-2">impact={ev.impact}</span> : null}
                                {ev.sectors.length ? <span>sectors={ev.sectors.join('|')}</span> : null}
                              </div>
                            </div>

                            <div className="shrink-0 text-[11px] font-mono text-gray-400 dark:text-gray-600">
                              {ev.utc_time.slice(11, 16)}Z
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {catalysts?.providers.macro === 'unavailable_or_empty' && (
              <div className="mt-3 text-[11px] font-mono text-gray-500 dark:text-gray-500">
                Macro calendar is best-effort: Finnhub economic calendar may require Premium access.
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
