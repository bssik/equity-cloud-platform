'use client';

import { useMemo } from 'react';
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
  Filler,
  ScriptableContext,
  ChartData
} from 'chart.js';
import { StockHistoryItem } from '@/types/stock';

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
  history: StockHistoryItem[] | null;
  loading?: boolean;
}

export default function PriceChart({ history, loading = false }: PriceChartProps) {

  // Transform data only when 'history' changes
  const chartData = useMemo(() => {
    if (!history || history.length === 0) return null;

    const labels = history.map(item => item.date);
    const prices = history.map(item => item.close);
    const sma50 = history.map(item => item.sma50 ?? null);
    const sma200 = history.map(item => item.sma200 ?? null);

    const datasets: ChartData<'line'>['datasets'] = [
      {
        label: 'Close Price',
        data: prices,
        fill: true,
        backgroundColor: (context: ScriptableContext<'line'>) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
          return gradient;
        },
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

    return { labels, datasets };
  }, [history]);

  // SKELETON STATE
  if (loading) {
    return (
      <div className="mt-8 bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-6 h-[400px] flex flex-col">
        <div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-6" />
        <div className="flex-1 w-full bg-gray-50 dark:bg-gray-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!chartData) {
    return null;
  }

  return (
    <div className="mt-8 bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
        Price History
      </h3>
      <div className="h-[350px] w-full">
        <Line
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'index',
              intersect: false,
            },
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  usePointStyle: true,
                  boxWidth: 8,
                  color: '#9ca3af'
                }
              },
              tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.9)',
                titleColor: '#fff',
                bodyColor: '#e5e7eb',
                padding: 12,
                cornerRadius: 8,
                displayColors: true
              }
            },
            scales: {
              y: {
                grid: {
                  color: 'rgba(156, 163, 175, 0.1)'
                },
                ticks: {
                    color: '#9ca3af',
                    callback: (value) => '$' + value
                }
              },
              x: {
                grid: {
                  display: false
                },
                ticks: {
                    color: '#9ca3af',
                    maxTicksLimit: 8
                }
              }
            }
          }}
        />
      </div>
    </div>
  );
}
