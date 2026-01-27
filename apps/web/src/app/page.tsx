import StockSearch from '@/components/StockSearch';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800">
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            EquityCloud
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">
            Real-time stock analysis powered by Azure
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <StockSearch />
        </div>

        <div className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Built with Next.js, Azure Functions, and Alpha Vantage API</p>
        </div>
      </main>
    </div>
  );
}
