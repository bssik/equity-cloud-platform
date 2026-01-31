'use client';

import { useState } from 'react';
import { StockQuote, NewsArticle, StockHistoryItem } from '@/types/stock';
import { marketFetchHistory, marketFetchNews, marketFetchQuote } from '@/lib/marketDataClient';
import StockCard from './StockCard';
import PriceChart from './PriceChart';
import NewsList from './NewsList';

export default function StockSearch() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // DATA STATES
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [history, setHistory] = useState<StockHistoryItem[] | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;

    // Reset UI
    setLoading(true);
    setError('');
    setQuote(null);
    setNews([]);
    setHistory(null);

    try {
      // THE ATOMIC LOAD (Waterfall Killer)
      // We wait for ALL promises to resolve before showing anything.
      const [quoteData, newsData, historyData] = await Promise.all([
        marketFetchQuote(symbol),
        marketFetchNews(symbol),
        marketFetchHistory(symbol)
      ]);

      // Batch Updates (React 18 handles this automatically, but good to know)
      setQuote(quoteData);
      setNews(newsData);
      setHistory(historyData.history);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  };

  // CONDITIONAL RENDER: "Skeleton Mode" or "Data Mode" or "Idle"
  const isIdle = !loading && !quote && !error;
  const hasData = !!quote;

  return (
    <div className="space-y-6 w-full">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Enter symbol (e.g., AAPL)..."
          className="flex-1 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-800
                     bg-white dark:bg-[#111] text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none
                     placeholder-gray-400 dark:placeholder-gray-500 font-mono transition-all"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                     text-white font-semibold rounded-lg transition-colors
                     flex items-center gap-2"
        >
          {loading ? (
             <>
               <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
               Searching
             </>
          ) : 'Search'}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900 rounded-lg flex items-center gap-3">
          <span className="text-red-500 text-xl">⚠️</span>
          <p className="text-red-600 dark:text-red-400 font-medium font-mono">{error}</p>
        </div>
      )}

      {/*
          ATOMIC RENDERING AREA
          If loading, we pass 'true' to children so they show Skeletons.
          If data exists, we pass the data.
      */}
      {(loading || hasData) && (
        <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">

          {/* Top Section: Card + Chart */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
               <StockCard quote={quote} loading={loading} />
            </div>
            <div className="md:col-span-2">
               {/*
                  Chart needs to be loaded only if we have data or are loading.
                  PriceChart handles its own Skeleton if loading=true
               */}
               <PriceChart history={history} loading={loading} />
            </div>
          </div>

          {/* Bottom Section: News */}
          <NewsList news={news} loading={loading} />

        </div>
      )}

      {/* Empty State (Idle) */}
      {isIdle && (
        <div className="text-center py-20 opacity-50">
          <div className="text-6xl mb-4">📈</div>
          <p className="text-xl text-gray-400 font-medium">Search for a company to analyze</p>
        </div>
      )}
    </div>
  );
}
