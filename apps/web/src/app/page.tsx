import StockSearch from '@/components/StockSearch';
import ConceptDemo from '@/components/ConceptDemo';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] text-gray-900 font-sans">
      <main className="w-full max-w-[1600px] mx-auto px-8 sm:px-12 lg:px-16 py-12">
        <div className="mb-12 border-b border-gray-200 dark:border-gray-800 pb-6">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white tracking-tight">
            EquityCloud
            <span className="text-blue-600 dark:text-blue-500">.</span>
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Professional Market Analytics
          </p>
        </div>

        {/* Educational Demo Section */}
        <div className="hidden">
           <ConceptDemo />
        </div>

        <div className="w-full">
          <StockSearch />
        </div>

        <div className="mt-16 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Built with Next.js, Azure Functions, and Alpha Vantage API</p>
        </div>
      </main>
    </div>
  );
}
