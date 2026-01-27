'use client';

import { useEffect, useState } from 'react';
import { fetchNews } from '@/lib/api';
import { NewsArticle } from '@/types/stock';

interface NewsListProps {
  symbol: string;
}

export default function NewsList({ symbol }: NewsListProps) {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      setLoading(true);
      try {
        const articles = await fetchNews(symbol);
        setNews(articles.slice(0, 5)); // Show top 5
      } catch (err) {
        console.error('Failed to load news:', err);
        setNews([]);
      } finally {
        setLoading(false);
      }
    };

    loadNews();
  }, [symbol]);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now() / 1000;
    const seconds = Math.floor(now - timestamp);

    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          📰 Recent News
        </h3>
        <p className="text-gray-500 dark:text-gray-400">Loading news...</p>
      </div>
    );
  }

  if (news.length === 0) {
    return null;
  }

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        📰 Recent News
      </h3>
      <div className="space-y-3">
        {news.map((article, index) => (
          <a
            key={index}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-4 bg-gray-50 dark:bg-gray-700 rounded-lg
                       hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
          >
            <h4 className="font-medium text-gray-900 dark:text-white mb-2 line-clamp-2">
              {article.headline}
            </h4>
            <div className="flex justify-between items-center text-sm">
              <span className="text-blue-600 dark:text-blue-400 font-medium">
                {article.source}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {formatTimeAgo(article.datetime)}
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
