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
import annotationPlugin from 'chartjs-plugin-annotation';
import { StockHistoryItem } from '@/types/stock';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
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
    const rsi = history.map(item => item.rsi ?? null);

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

    return { labels, datasets, rsi };
  }, [history]);

  // SKELETON STATE
  if (loading) {
    return (
      <div className="mt-8 bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 h-[340px] sm:h-[400px] flex flex-col">
        <div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse mb-6" />
        <div className="flex-1 w-full bg-gray-50 dark:bg-gray-800/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!chartData) {
    return null;
  }

  // Prepare RSI chart data
  const rsiChartData = chartData.rsi && chartData.rsi.some(v => v !== null) ? {
    labels: chartData.labels,
    datasets: [
      {
        label: 'RSI (14)',
        data: chartData.rsi,
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true
      }
    ]
  } : null;

  return (
    <div className="mt-8 space-y-4">
      {/* Main Price Chart */}
      <div className="bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 shadow-sm">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
          Price History
        </h3>
        <div className="h-[260px] sm:h-[350px] w-full">
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

      {/* RSI Chart */}
      {rsiChartData && (
        <div className="bg-white dark:bg-[#111] rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-6 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white mb-4 tracking-tight">
            RSI (Relative Strength Index)
          </h3>
          <div className="h-[160px] sm:h-[180px] w-full">
            <Line
              data={rsiChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false,
                },
                plugins: {
                  legend: {
                    display: false
                  },
                  tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#e5e7eb',
                    padding: 12,
                    cornerRadius: 8,
                    callbacks: {
                      label: (context) => `RSI: ${(context.parsed.y ?? 0).toFixed(2)}`
                    }
                  },
                  annotation: {
                    annotations: {
                      overbought: {
                        type: 'line',
                        yMin: 70,
                        yMax: 70,
                        borderColor: 'rgba(239, 68, 68, 0.5)',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        label: {
                          content: 'Overbought (70)',
                          display: true,
                          position: 'end',
                          color: 'rgb(239, 68, 68)',
                          font: { size: 10 }
                        }
                      },
                      oversold: {
                        type: 'line',
                        yMin: 30,
                        yMax: 30,
                        borderColor: 'rgba(16, 185, 129, 0.5)',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        label: {
                          content: 'Oversold (30)',
                          display: true,
                          position: 'end',
                          color: 'rgb(16, 185, 129)',
                          font: { size: 10 }
                        }
                      }
                    }
                  }
                },
                scales: {
                  y: {
                    min: 0,
                    max: 100,
                    grid: {
                      color: 'rgba(156, 163, 175, 0.1)'
                    },
                    ticks: {
                      color: '#9ca3af',
                      stepSize: 20
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
      )}
    </div>
  );
}
