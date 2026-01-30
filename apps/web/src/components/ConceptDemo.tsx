"use client"; // This tells Next.js this involves browser interaction (clicks, state)

import { useState, useEffect } from "react";

/**
 * A Demo Component to teach: State, Effects, and Styling.
 * It simulates fetching a stock price with an artificial delay.
 */
export default function ConceptDemo() {
  // --- 1. STATE (The Memory) ---
  // We need to remember three things:
  // Is it loading? (Boolean)
  // What is the price? (Number or null)
  // How many times have we refreshed? (Number)
  const [isLoading, setIsLoading] = useState(false);
  const [price, setPrice] = useState<number | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  // --- 2. EFFECTS (The Action) ---
  // This runs whenever 'refreshCount' changes.
  useEffect(() => {
    // Don't run on first render if you don't want to
    if (refreshCount === 0) return;

    console.log("Effect triggered! Fetching new data...");

    // Start Loading
    setIsLoading(true);

    // Simulate an API call with a 2-second timeout
    const timer = setTimeout(() => {
      const randomPrice = (Math.random() * 100 + 100).toFixed(2);
      setPrice(parseFloat(randomPrice));

      // Stop Loading
      setIsLoading(false);
    }, 2000);

    // Cleanup: If the user leaves the page before 2 seconds, cancel the timer
    return () => clearTimeout(timer);

  }, [refreshCount]); // Dependency Array: Only run when 'refreshCount' changes

  // --- 3. EVENTS (The Trigger) ---
  const handleRefreshClick = () => {
    // We increment the count, which changes the Dependency Array above
    // causing the useEffect to run again.
    setRefreshCount((prev) => prev + 1);
  };

  // --- 4. RENDER (The View & Tailwind) ---
  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md border border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Concept Demo: Stock Ticker</h2>

      <div className="mb-4">
        <p className="text-gray-500 text-sm">Target: AAPL</p>

        {/* CONDITIONAL RENDERING based on State */}
        {isLoading ? (
          <div className="text-blue-500 font-semibold animate-pulse">
            Fetching market data...
          </div>
        ) : (
          <div className="text-3xl font-extrabold text-green-600">
            {price ? `$${price}` : "---"}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-6">
        <span className="text-xs text-gray-400">
          Refreshes: {refreshCount}
        </span>

        {/* EVENT & TAILWIND */}
        <button
          onClick={handleRefreshClick}
          disabled={isLoading}
          className={`px-4 py-2 text-white font-semibold rounded-lg transition-colors
            ${isLoading
              ? "bg-gray-400 cursor-not-allowed" // Disabled style
              : "bg-blue-600 hover:bg-blue-700"  // Active style
            }
          `}
        >
          {isLoading ? "Loading..." : "Get Price"}
        </button>
      </div>
    </div>
  );
}
