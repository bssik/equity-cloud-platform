import { StockQuote, NewsArticle, StockHistoryResponse } from '@/types/stock';

/**
 * MOCK SERVICE LAYER
 * -------------------
 * This file simulates a real backend API.
 *
 * WHY DO WE DO THIS?
 * 1. Speed: We can build the UI before the Backend exists.
 * 2. Reliability: We can work offline (on a plane/train).
 * 3. Testing: We can force "weird" scenarios (very long names, massive prices)
 *    to see if our UI breaks, which is hard to do with real live data.
 */

// Helper: Pauses execution for a set time (simulates network latency)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchMockQuote(symbol: string): Promise<StockQuote> {
  await delay(800); // Wait 0.8 seconds to feel "real"

  const normalizedSymbol = symbol.toUpperCase();

  // Simulate an error for a specific symbol to test Error UI
  if (normalizedSymbol === 'ERROR') {
    throw new Error('Simulated Backend Failure: 500 Internal Server Error');
  }

  // Simulate a "Not Found"
  if (normalizedSymbol === 'UNKNOWN') {
    throw new Error(`Stock symbol "${normalizedSymbol}" not found`);
  }

  // Generate semi-random data based on the symbol length
  // (So AAPL always returns roughly the same "fake" price)
  const basePrice = normalizedSymbol.length * 50 + 100;
  const variance = (Math.random() * 10) - 5; // +/- $5
  const currentPrice = basePrice + variance;
  const openPrice = basePrice;

  const changeRaw = currentPrice - openPrice;
  const changePercent = (changeRaw / openPrice) * 100;

  return {
    symbol: normalizedSymbol,
    price: parseFloat(currentPrice.toFixed(2)),
    open: parseFloat(openPrice.toFixed(2)),
    high: parseFloat((currentPrice + 5).toFixed(2)),
    low: parseFloat((currentPrice - 5).toFixed(2)),
    previous_close: parseFloat((openPrice - 2).toFixed(2)),
    change_percent: parseFloat(changePercent.toFixed(2)), 
    volume: Math.floor(Math.random() * 100000000) + 1000000, // Random int between 1M and 101M
  };
}

export async function fetchMockNews(symbol: string): Promise<NewsArticle[]> {
  await delay(800);

  return [
    {
      headline: `${symbol} beats earnings estimates by 15%`,
      summary: "Analysts are surprised by the strong quarterly performance driven by cloud growth.",
      source: "MarketWatch",
      url: "#",
      datetime: Date.now(),
      image: "https://via.placeholder.com/150"
    },
    {
      headline: `CEO says ${symbol} is investing heavily in AI`,
      summary: "The roadmap for 2026 includes significant infrastructure upgrades.",
      source: "Bloomberg",
      url: "#",
      datetime: Date.now() - 86400000,
      image: "https://via.placeholder.com/150"
    }
  ];
}

export async function fetchMockHistory(symbol: string): Promise<StockHistoryResponse> {
  await delay(800);
  
  const history = [];
  const boxes = 30; // 30 days
  let price = 150;
  
  for (let i = boxes; i > 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    // Random walk
    price = price + (Math.random() * 10 - 4.5);
    
    history.push({
      date: date.toISOString().split('T')[0],
      close: parseFloat(price.toFixed(2)),
      sma50: price + (Math.random() * 5),
      sma200: price - (Math.random() * 20),
    });
  }

  return {
    symbol: symbol,
    history: history,
    latest_sma: {
      sma50: history[history.length - 1].sma50 || null,
      sma200: history[history.length - 1].sma200 || null
    }
  };
}
