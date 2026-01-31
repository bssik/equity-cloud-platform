import StockSearch from '@/components/StockSearch';
import DataSourceBadge from '@/components/DataSourceBadge';
import ApiHealthPill from '@/components/ApiHealthPill';
import CatalystsPanel from '@/components/CatalystsPanel';
import AuthPill from '@/components/AuthPill';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 font-sans">
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-16 py-8 sm:py-12">
        <div className="mb-12 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-6 mb-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
              EquityCloud
              <span className="text-blue-600 dark:text-blue-500">.</span>
            </h1>
            <div className="self-start">
              <div className="flex flex-wrap items-center gap-2">
                <DataSourceBadge />
                <ApiHealthPill />
                <AuthPill />
              </div>
            </div>
          </div>

          <div className="max-w-3xl space-y-4">
            <h2 className="text-xl font-medium text-gray-700 dark:text-gray-200">
              Personal Equity Research Workspace
            </h2>

            <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-light">
              A lightweight, serverless platform engineered for focused market tracking.
              Running on Azure Functions to deliver low-latency technical data and news
              without the noise of commercial portals.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-500 bg-gray-100 dark:bg-gray-800/50 px-3 py-1 rounded-full border border-gray-200 dark:border-gray-800">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span className="font-mono text-xs">Alpha Vantage Stream</span>
              </div>

              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600 px-3 py-1 border border-dashed border-gray-300 dark:border-gray-700 rounded-full">
                <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                <span className="font-mono text-xs">GPT Integration (Dev)</span>
              </div>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-600 font-mono flex items-center gap-2 pt-2">
              <span className="text-amber-500 dark:text-amber-600">⚠</span>
              System Note: Free Tier connectivity. Rate limits apply (please allow pauses between queries).
            </p>
          </div>
        </div>

        <div className="w-full">
          <StockSearch />
        </div>

        <CatalystsPanel />

        <div className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Built with Next.js, Azure Functions, and Alpha Vantage API</p>
        </div>
      </main>
    </div>
  );
}
