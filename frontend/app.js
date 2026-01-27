// ============================================
// STATE MANAGEMENT
// ============================================
const AppState = {
    mode: 'single', // 'single' or 'compare'
    theme: localStorage.getItem('theme') || 'dark'
};

// ============================================
// STORAGE UTILITIES
// ============================================
const Storage = {
    getHistory: () => JSON.parse(localStorage.getItem('searchHistory') || '[]'),

    saveToHistory: (symbol) => {
        let history = Storage.getHistory();
        history = history.filter(s => s !== symbol);
        history.unshift(symbol);
        history = history.slice(0, 3);
        localStorage.setItem('searchHistory', JSON.stringify(history));
    },

    getWatchlist: () => JSON.parse(localStorage.getItem('watchlist') || '[]'),

    addToWatchlist: (symbol) => {
        const watchlist = Storage.getWatchlist();
        if (!watchlist.includes(symbol)) {
            watchlist.push(symbol);
            localStorage.setItem('watchlist', JSON.stringify(watchlist));
        }
    },

    removeFromWatchlist: (symbol) => {
        let watchlist = Storage.getWatchlist();
        watchlist = watchlist.filter(s => s !== symbol);
        localStorage.setItem('watchlist', JSON.stringify(watchlist));
    },

    saveTheme: (theme) => {
        localStorage.setItem('theme', theme);
        AppState.theme = theme;
    }
};

// ============================================
// API CLIENT
// ============================================
const API = {
    async fetchQuote(symbol) {
        const response = await fetch(`/api/quote/${symbol}`);

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Rate limit exceeded. Please wait a moment.');
            } else if (response.status === 500) {
                throw new Error('Server error. API key may be missing or invalid.');
            } else {
                throw new Error('Network error. Please check your connection.');
            }
        }

        return response.json();
    },

    async fetchMultiple(symbols, onProgress) {
        const results = [];
        const delay = 12000; // 12 seconds between calls (5 per minute = safe)

        for (let i = 0; i < symbols.length; i++) {
            try {
                onProgress && onProgress(i, symbols.length, symbols[i]);
                const data = await API.fetchQuote(symbols[i]);
                results.push({ symbol: symbols[i], data, error: null });

                // Add delay between requests (except for the last one)
                if (i < symbols.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (error) {
                results.push({ symbol: symbols[i], data: null, error: error.message });
            }
        }

        return results;
    }
};

// ============================================
// SIGNAL ANALYSIS
// ============================================
const SignalAnalyzer = {
    calculate(quote) {
        const price = parseFloat(quote['05. price']);
        const high = parseFloat(quote['03. high']);
        const low = parseFloat(quote['04. low']);
        const prevClose = parseFloat(quote['08. previous close']);
        const volume = parseInt(quote['06. volume']);

        const range = high - low;
        const volatilityPct = (range / price) * 100;
        let volatility, volatilityLevel;

        if (volatilityPct < 2) {
            volatility = 'Low';
            volatilityLevel = 'high';
        } else if (volatilityPct < 5) {
            volatility = 'Medium';
            volatilityLevel = 'medium';
        } else {
            volatility = 'High';
            volatilityLevel = 'low';
        }

        const priceChange = ((price - prevClose) / prevClose) * 100;
        const positionInRange = ((price - low) / (high - low)) * 100;
        let momentum;

        if (priceChange > 1 && positionInRange > 60) {
            momentum = '📈 Bullish';
        } else if (priceChange < -1 && positionInRange < 40) {
            momentum = '📉 Bearish';
        } else {
            momentum = '➡️ Neutral';
        }

        let liquidity, liquidityLevel;
        if (volume > 5000000) {
            liquidity = 'High';
            liquidityLevel = 'high';
        } else if (volume > 1000000) {
            liquidity = 'Solid';
            liquidityLevel = 'medium';
        } else {
            liquidity = 'Thin';
            liquidityLevel = 'low';
        }

        let signal, signalClass;
        if (momentum.includes('Bullish') && volatility !== 'High') {
            signal = '🚀 Trending Up';
            signalClass = 'bullish';
        } else if (momentum.includes('Bearish')) {
            signal = '⚠️ Downtrend';
            signalClass = 'bearish';
        } else if (volatility === 'High') {
            signal = '⚡ High Volatility';
            signalClass = 'volatile';
        } else {
            signal = '😴 Quiet Trading';
            signalClass = 'neutral';
        }

        return {
            volatility, volatilityLevel, volatilityPct,
            momentum, liquidity, liquidityLevel,
            signal, signalClass
        };
    }
};

// ============================================
// RENDERING
// ============================================
const Renderer = {
    renderSingleQuote(quote, symbol, fetchTime) {
        const price = parseFloat(quote['05. price']);
        const change = quote['10. change percent'];
        const isPositive = change && !change.startsWith('-');
        const timeStr = fetchTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const open = quote['02. open'];
        const high = quote['03. high'];
        const low = quote['04. low'];
        const volume = quote['06. volume'];
        const prevClose = quote['08. previous close'];
        const tradingDay = quote['07. latest trading day'];

        const watchlist = Storage.getWatchlist();
        const isInWatchlist = watchlist.includes(symbol);
        const signal = SignalAnalyzer.calculate(quote);

        return `
            <div class="quote-grid">
                <div class="quote-item">
                    <span class="quote-label">Symbol</span>
                    <span class="quote-value">${quote['01. symbol']}</span>
                </div>
                <div class="quote-item">
                    <span class="quote-label">Price (USD)</span>
                    <span class="quote-value">$${price.toFixed(2)}</span>
                </div>
                ${change ? `
                <div class="quote-item">
                    <span class="quote-label">Change</span>
                    <span class="quote-change ${isPositive ? 'positive' : 'negative'}">
                        ${isPositive ? '+' : ''}${change}
                    </span>
                </div>` : ''}

                <div class="details-grid">
                    ${open ? `<div class="detail-item"><span class="detail-label">Open</span><span class="detail-value">$${parseFloat(open).toFixed(2)}</span></div>` : ''}
                    ${high ? `<div class="detail-item"><span class="detail-label">High</span><span class="detail-value">$${parseFloat(high).toFixed(2)}</span></div>` : ''}
                    ${low ? `<div class="detail-item"><span class="detail-label">Low</span><span class="detail-value">$${parseFloat(low).toFixed(2)}</span></div>` : ''}
                    ${prevClose ? `<div class="detail-item"><span class="detail-label">Prev Close</span><span class="detail-value">$${parseFloat(prevClose).toFixed(2)}</span></div>` : ''}
                    ${volume ? `<div class="detail-item"><span class="detail-label">Volume</span><span class="detail-value">${parseInt(volume).toLocaleString()}</span></div>` : ''}
                    ${tradingDay ? `<div class="detail-item"><span class="detail-label">Trading Day</span><span class="detail-value">${tradingDay}</span></div>` : ''}
                </div>

                <div class="signal-section">
                    <div class="signal-header">
                        <span class="signal-title">⚡ MARKET SIGNAL</span>
                    </div>
                    <div class="signal-indicators">
                        <div class="signal-indicator">
                            <span class="signal-label">Volatility</span>
                            <span class="signal-value">
                                ${signal.volatility}
                                <div class="signal-bar"><div class="signal-bar-fill ${signal.volatilityLevel}" style="width: ${signal.volatilityPct > 5 ? 100 : signal.volatilityPct * 20}%"></div></div>
                            </span>
                        </div>
                        <div class="signal-indicator">
                            <span class="signal-label">Momentum</span>
                            <span class="signal-value">${signal.momentum}</span>
                        </div>
                        <div class="signal-indicator">
                            <span class="signal-label">Liquidity</span>
                            <span class="signal-value">
                                ${signal.liquidity}
                                <div class="signal-bar"><div class="signal-bar-fill ${signal.liquidityLevel}" style="width: ${signal.liquidityLevel === 'high' ? 100 : signal.liquidityLevel === 'medium' ? 60 : 30}%"></div></div>
                            </span>
                        </div>
                    </div>
                    <div class="signal-badge ${signal.signalClass}">${signal.signal}</div>
                </div>

                <div class="timestamp">Last updated at ${timeStr}</div>
            </div>
            ${!isInWatchlist ? `<button class="add-to-watchlist" onclick="UI.addToWatchlist('${symbol}')">📌 Add to Watchlist</button>` : `<div class="add-to-watchlist" style="opacity: 0.6; cursor: default;">✓ In Watchlist</div>`}
        `;
    },

    renderComparison(results) {
        const successfulResults = results.filter(r => r.data && r.data['Global Quote']);

        if (successfulResults.length === 0) {
            return '<span class="error">No valid data to compare</span>';
        }

        const headers = ['Metric', ...successfulResults.map(r => r.symbol)];
        const metrics = [
            { label: 'Price', key: '05. price', format: v => `$${parseFloat(v).toFixed(2)}` },
            { label: 'Change %', key: '10. change percent', format: v => v },
            { label: 'Open', key: '02. open', format: v => `$${parseFloat(v).toFixed(2)}` },
            { label: 'High', key: '03. high', format: v => `$${parseFloat(v).toFixed(2)}` },
            { label: 'Low', key: '04. low', format: v => `$${parseFloat(v).toFixed(2)}` },
            { label: 'Volume', key: '06. volume', format: v => parseInt(v).toLocaleString() }
        ];

        let html = '<div class="comparison-table"><table><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';

        metrics.forEach(metric => {
            html += '<tr>';
            html += `<td class="metric-label">${metric.label}</td>`;
            successfulResults.forEach(result => {
                const quote = result.data['Global Quote'];
                const value = quote[metric.key];
                const formatted = value ? metric.format(value) : 'N/A';
                html += `<td>${formatted}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Show errors for failed fetches
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            html += '<div class="comparison-errors">';
            errors.forEach(e => {
                html += `<div class="error-item">⚠️ ${e.symbol}: ${e.error}</div>`;
            });
            html += '</div>';
        }

        return html;
    },

    renderHistory() {
        const history = Storage.getHistory();
        const historySection = document.getElementById('historySection');
        const historyChips = document.getElementById('historyChips');

        if (history.length > 0) {
            historySection.classList.add('visible');
            historyChips.innerHTML = history.map(symbol =>
                `<span class="history-chip" onclick="UI.selectSymbol('${symbol}')">${symbol}</span>`
            ).join('');
        } else {
            historySection.classList.remove('visible');
        }
    },

    renderWatchlist() {
        const watchlist = Storage.getWatchlist();
        const watchlistCard = document.getElementById('watchlistCard');
        const watchlistItems = document.getElementById('watchlistItems');

        if (watchlist.length > 0) {
            watchlistCard.classList.add('visible');
            watchlistItems.innerHTML = watchlist.map(symbol =>
                `<div class="watchlist-item" onclick="UI.selectSymbol('${symbol}')">
                    <span class="watchlist-symbol">${symbol}</span>
                    <button class="watchlist-remove" onclick="event.stopPropagation(); UI.removeFromWatchlist('${symbol}')" title="Remove">✕</button>
                </div>`
            ).join('');
        } else {
            watchlistCard.classList.remove('visible');
        }
    }
};

// ============================================
// UI CONTROLLER
// ============================================
const UI = {
    init() {
        document.documentElement.className = AppState.theme;
        Renderer.renderHistory();
        Renderer.renderWatchlist();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === '/') {
                e.preventDefault();
                document.getElementById('symbolInput').focus();
            } else if (e.key === 'Escape') {
                UI.clearInput();
            }
        });
    },

    toggleMode() {
        AppState.mode = AppState.mode === 'single' ? 'compare' : 'single';
        const compareSection = document.getElementById('compareSection');
        const singleSection = document.getElementById('singleSection');
        const modeBtn = document.getElementById('modeToggle');

        if (AppState.mode === 'compare') {
            compareSection.style.display = 'block';
            singleSection.style.display = 'none';
            modeBtn.textContent = '← Single View';
        } else {
            compareSection.style.display = 'none';
            singleSection.style.display = 'block';
            modeBtn.textContent = '⚖️ Compare';
        }
    },

    handleInput(input) {
        const clearBtn = document.getElementById('clearBtn');
        clearBtn.classList.toggle('visible', input.value.length > 0);
    },

    clearInput() {
        const input = document.getElementById('symbolInput');
        input.value = '';
        document.getElementById('clearBtn').classList.remove('visible');
        input.focus();
    },

    selectSymbol(symbol) {
        if (AppState.mode === 'single') {
            document.getElementById('symbolInput').value = symbol;
            UI.handleInput(document.getElementById('symbolInput'));
            UI.fetchStock();
        }
    },

    toggleTheme() {
        const newTheme = AppState.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.className = newTheme;
        Storage.saveTheme(newTheme);
    },

    addToWatchlist(symbol) {
        Storage.addToWatchlist(symbol);
        Renderer.renderWatchlist();
        UI.fetchStock(); // Refresh to update button
    },

    removeFromWatchlist(symbol) {
        Storage.removeFromWatchlist(symbol);
        Renderer.renderWatchlist();
    },

    async fetchStock() {
        const input = document.getElementById('symbolInput').value.toUpperCase().trim();
        const resultDiv = document.getElementById('result');
        const searchBtn = document.getElementById('searchBtn');
        const symbol = input.replace(/[^A-Z]/g, '');

        if (!symbol) {
            resultDiv.innerHTML = '<span class="loading">Please enter a valid symbol</span>';
            return;
        }

        if (symbol.length > 6) {
            resultDiv.innerHTML = '<span class="error">Symbol too long (max 6 characters)</span>';
            return;
        }

        searchBtn.disabled = true;
        resultDiv.innerHTML = '<div class="spinner"></div>';
        const fetchTime = new Date();

        try {
            const data = await API.fetchQuote(symbol);
            const quote = data['Global Quote'];

            if (quote && Object.keys(quote).length > 0) {
                Storage.saveToHistory(symbol);
                Renderer.renderHistory();
                resultDiv.innerHTML = Renderer.renderSingleQuote(quote, symbol, fetchTime);
            } else if (data.Note && data.Note.includes('API call frequency')) {
                resultDiv.innerHTML = '<span class="error">API rate limit reached. Please try again in a minute.</span>';
            } else {
                resultDiv.innerHTML = '<span class="error">Symbol not found. Check the ticker and try again.</span>';
            }
        } catch (error) {
            resultDiv.innerHTML = `<span class="error">${error.message}</span>`;
        } finally {
            searchBtn.disabled = false;
        }
    },

    async compareStocks() {
        const symbol1 = document.getElementById('compareInput1').value.toUpperCase().trim().replace(/[^A-Z]/g, '');
        const symbol2 = document.getElementById('compareInput2').value.toUpperCase().trim().replace(/[^A-Z]/g, '');
        const symbol3 = document.getElementById('compareInput3').value.toUpperCase().trim().replace(/[^A-Z]/g, '');

        const symbols = [symbol1, symbol2, symbol3].filter(s => s.length > 0);

        if (symbols.length < 2) {
            document.getElementById('compareResult').innerHTML = '<span class="error">Enter at least 2 symbols to compare</span>';
            return;
        }

        const resultDiv = document.getElementById('compareResult');
        const compareBtn = document.getElementById('compareBtn');

        compareBtn.disabled = true;
        resultDiv.innerHTML = '<div class="compare-progress">Fetching data (this may take ~12s per symbol to avoid rate limits)...</div>';

        try {
            const results = await API.fetchMultiple(symbols, (index, total, symbol) => {
                resultDiv.innerHTML = `<div class="compare-progress">Fetching ${symbol}... (${index + 1}/${total})</div>`;
            });

            resultDiv.innerHTML = Renderer.renderComparison(results);
        } catch (error) {
            resultDiv.innerHTML = `<span class="error">${error.message}</span>`;
        } finally {
            compareBtn.disabled = false;
        }
    }
};

// ============================================
// INITIALIZATION
// ============================================
window.addEventListener('load', () => UI.init());
