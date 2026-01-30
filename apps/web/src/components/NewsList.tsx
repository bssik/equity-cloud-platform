'use client';

import { NewsArticle } from '@/types/stock';

interface NewsListProps {
  news: NewsArticle[];
  loading?: boolean;
}

export default function NewsList({ news, loading = false }: NewsListProps) {

  const formatTimeAgo = (timestamp: number) => {
    // Timestamps from APIs are often in milliseconds, but logic assumed seconds earlier.
    // Let's ensure we handle both. If it's huge (13 digits), it's ms.
    const ts = timestamp > 10000000000 ? timestamp / 1000 : timestamp;
    const now = Date.now() / 1000;
    const seconds = Math.floor(now - ts);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="mt-8 bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
          Recent News
        </h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
             <div key={i} className="block p-4 rounded-lg border border-gray-100 dark:border-gray-800">
               <div className="h-4 w-3/4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-2" />
               <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-4" />
               <div className="flex justify-between">
                 <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                 <div className="h-3 w-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
               </div>
             </div>
          ))}
        </div>
      </div>
    );
  }

  if (news.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
        Recent News
      </h3>
      <div className="space-y-3">
        {news.map((article, index) => (
          <a
            key={index}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-gray-50 dark:bg-[#151515] rounded-lg border border-transparent dark:border-gray-800
                       hover:border-blue-500 hover:bg-white dark:hover:bg-[#1a1a1a]
                       transition-all duration-200 group"
          >
            <h4 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400">
              {article.headline}
            </h4>
            <div className="flex justify-between items-center text-sm">
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {article.source}
              </span>
              <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
                {formatTimeAgo(article.datetime)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
