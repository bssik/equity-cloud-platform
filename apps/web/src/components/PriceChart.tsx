'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { fetchHistory } from '../lib/api';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface PriceChartProps {
  symbol: string;
}

export default function PriceChart({ symbol }: PriceChartProps) {
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchHistory(symbol);

        if (data && data.history && data.history.length > 0) {
          const labels = data.history.map(item => item.date);
          const prices = data.history.map(item => item.close);
          const sma50 = data.history.map(item => item.sma50 ?? null);
          const sma200 = data.history.map(item => item.sma200 ?? null);

          const datasets: any[] = [
            {
              label: 'Close Price',
              data: prices,
              fill: true,
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              borderColor: 'rgb(59, 130, 246)',
              borderWidth: 2,
              tension: 0.1,
              pointRadius: 0,
              pointHoverRadius: 4,
            }
          ];

          if (sma50.some(v => v !== null)) {
            datasets.push({
              label: '50-day SMA',
              data: sma50,
              borderColor: 'rgb(16, 185, 129)',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.1,
              fill: false
            });
          }

          if (sma200.some(v => v !== null)) {
            datasets.push({
              label: '200-day SMA',
              data: sma200,
              borderColor: 'rgb(239, 68, 68)',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.1,
              fill: false
            });
          }

          setChartData({
            labels,
            datasets,
          });
        } else {
          setChartData(null);
        }
      } catch (err) {
        console.error('Failed to load chart data:', err);
        setChartData(null);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [symbol]);

  if (loading) {
    return (
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-gray-100 dark:bg-gray-900 rounded"></div>
      </div>
    );
  }

  if (!chartData) {
    return null;
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#9ca3af',
          usePointStyle: true,
        },
      },
      title: {
        display: true,
        text: `${symbol} Price History`,
        color: '#9ca3af',
        font: {
          size: 16,
          weight: 'bold' as const
        }
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#9ca3af',
          maxTicksLimit: 10,
        },
      },
      y: {
        ticks: {
          color: '#9ca3af',
          callback: (value: any) => `$${value}`,
        },
        grid: {
          color: 'rgba(156, 163, 175, 0.1)',
        },
      },
    },
  };

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-100 dark:border-gray-700">
      <div className="h-[400px]">
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
