import { getMarketDataSource } from '@/lib/marketDataClient';

export default function DataSourceBadge() {
  const source = getMarketDataSource();
  const isApi = source === 'api';

  return (
    <div
      className={
        'inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border font-mono text-[10px] sm:text-xs ' +
        (isApi
          ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/10 dark:border-emerald-900 dark:text-emerald-400'
          : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/10 dark:border-amber-900 dark:text-amber-400')
      }
      aria-label={`Market data source: ${source.toUpperCase()}`}
      title={`Market data source: ${source.toUpperCase()}`}
    >
      <span
        className={`w-2 h-2 rounded-full ${isApi ? 'bg-emerald-500' : 'bg-amber-500'}`}
        aria-hidden="true"
      />
      <span className="hidden sm:inline tracking-wide">DATA:</span>
      <span className="font-semibold">{source.toUpperCase()}</span>
    </div>
  );
}
