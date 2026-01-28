'use client';

import { useState } from 'react';
import { fetchQuote } from '../lib/api';
import { StockQuote } from '../types/stock';
import NewsList from './NewsList';
import PriceChart from './PriceChart';

export default function StockSearch() {
  const [symbol, setSymbol] = useState('');
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;

    setLoading(true);
    setError('');
    setQuote(null);

    try {
      const data = await fetchQuote(symbol.toUpperCase());
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stock data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          placeholder="Enter stock symbol (e.g., AAPL)"
          className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder-gray-400 dark:placeholder-gray-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                     text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Quote Display */}
      {quote && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
          <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {quote.symbol}
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Price</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                ${quote.price.toFixed(2)}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Change</p>
              <p className={`text-2xl font-bold ${
                quote.change_percent?.startsWith('-')
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-green-600 dark:text-green-400'
              }`}>
                {quote.change_percent || 'N/A'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Volume</p>
              <p className="text-lg text-gray-900 dark:text-white">
                {parseInt(quote.volume).toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Open</p>
              <p className="text-lg text-gray-900 dark:text-white">
                ${quote.open.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Price Chart */}
      {quote && <PriceChart symbol={quote.symbol} />}

      {/* News List */}
      {quote && <NewsList symbol={quote.symbol} />}
    </div>
  );
}
