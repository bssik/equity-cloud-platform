import { StockQuote } from '@/types/stock';

interface StockCardProps {
  quote: StockQuote | null;
  loading?: boolean;
}

const formatLargeNumber = (num: number) => {
  if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + "B";
  if (num >= 1.0e+6) return (num / 1.0e+6).toFixed(2) + "M";
  if (num >= 1.0e+3) return (num / 1.0e+3).toFixed(2) + "K";
  return num.toString();
};

export default function StockCard({ quote, loading = false }: StockCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 h-full">
        {/* Skeleton Header */}
        <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
          <div className="h-8 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        </div>

        {/* Skeleton Grid */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!quote) return null;

  return (
    <div className="bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 h-full shadow-sm">
      <div className="border-b border-gray-200 dark:border-gray-800 pb-4 mb-5 sm:mb-6 flex justify-between items-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight font-mono">
          {quote.symbol}
        </h2>
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 px-2 py-1 rounded">
          EQ
        </span>
      </div>

      <div className="space-y-5 sm:space-y-6">
        {/* Primary Metric: Price & Change Combined */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Current Price</p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight font-mono">
               ${quote.price.toFixed(2)}
            </span>
            <span className={`text-sm font-bold px-2 py-1 rounded-md font-mono ${
              quote.change_percent < 0
                ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
                : 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
            }`}>
              {quote.change_percent > 0 ? '+' : ''}{quote.change_percent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Secondary Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Volume</p>
            <p className="text-base sm:text-lg font-medium text-gray-900 dark:text-white font-mono">
              {formatLargeNumber(quote.volume)}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Open</p>
            <p className="text-base sm:text-lg font-medium text-gray-900 dark:text-white font-mono">
              ${quote.open.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
