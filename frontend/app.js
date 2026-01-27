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
    },

    getAlerts: () => JSON.parse(localStorage.getItem('priceAlerts') || '[]'),

    addAlert: (alert) => {
        const alerts = Storage.getAlerts();
        alerts.push(alert);
        localStorage.setItem('priceAlerts', JSON.stringify(alerts));
    },

    removeAlert: (id) => {
        let alerts = Storage.getAlerts();
        alerts = alerts.filter(a => a.id !== id);
        localStorage.setItem('priceAlerts', JSON.stringify(alerts));
    },

    updateAlert: (id, updates) => {
        let alerts = Storage.getAlerts();
        const index = alerts.findIndex(a => a.id === id);
        if (index !== -1) {
            alerts[index] = { ...alerts[index], ...updates };
            localStorage.setItem('priceAlerts', JSON.stringify(alerts));
        }
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
            ${!isInWatchlist ? `<button class="add-to-watchlist" data-symbol="${symbol}">📌 Add to Watchlist</button>` : `<div class="add-to-watchlist" style="opacity: 0.6; cursor: default;">✓ In Watchlist</div>`}
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
                `<span class="history-chip">${symbol}</span>`
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
                `<div class="watchlist-item">
                    <span class="watchlist-symbol">${symbol}</span>
                    <button class="watchlist-remove" title="Remove">✕</button>
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

        // Event delegation for dynamic elements
        this.attachEventListeners();
    },

    attachEventListeners() {
        // Theme toggle
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());

        // Example chips
        document.querySelectorAll('.example-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const symbol = e.target.dataset.symbol;
                if (symbol) this.selectSymbol(symbol);
            });
        });

        // Single mode input handlers
        const symbolInput = document.getElementById('symbolInput');
        const clearBtn = document.getElementById('clearBtn');
        const searchBtn = document.getElementById('searchBtn');

        symbolInput?.addEventListener('input', () => this.handleInput(symbolInput));
        symbolInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchStock();
        });
        clearBtn?.addEventListener('click', () => this.clearInput());
        searchBtn?.addEventListener('click', () => this.fetchStock());

        // Mode toggle
        document.getElementById('modeToggle')?.addEventListener('click', () => this.toggleMode());

        // Compare button
        document.getElementById('compareBtn')?.addEventListener('click', () => this.compareStocks());

        // Alerts modal
        document.getElementById('alertsBtn')?.addEventListener('click', () => Alerts.openModal());
        document.getElementById('alertsClose')?.addEventListener('click', () => Alerts.closeModal());
        document.getElementById('addAlertBtn')?.addEventListener('click', () => Alerts.addAlert());
        document.getElementById('alertsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'alertsModal') Alerts.closeModal();
        });

        // Export button
        document.getElementById('exportBtn')?.addEventListener('click', () => exportWatchlist());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === '/') {
                e.preventDefault();
                symbolInput?.focus();
            } else if (e.key === 'Escape') {
                this.clearInput();
            }
        });

        // History chips delegation
        document.getElementById('historyChips')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('history-chip')) {
                const symbol = e.target.textContent;
                this.selectSymbol(symbol);
            }
        });

        // Watchlist items delegation
        document.getElementById('watchlistItems')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('watchlist-item')) {
                const symbol = e.target.querySelector('.watchlist-symbol')?.textContent;
                if (symbol) this.selectSymbol(symbol);
            } else if (e.target.classList.contains('watchlist-remove')) {
                e.stopPropagation();
                const symbol = e.target.closest('.watchlist-item')?.querySelector('.watchlist-symbol')?.textContent;
                if (symbol) this.removeFromWatchlist(symbol);
            }
        });

        // Alert list delegation
        document.getElementById('alertList')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('alert-remove')) {
                const alertItem = e.target.closest('.alert-item');
                // Extract ID from data attribute or reconstruct from alerts array
                const alerts = Storage.getAlerts();
                const index = Array.from(alertItem.parentElement.children).indexOf(alertItem);
                if (alerts[index]) {
                    Alerts.removeAlert(alerts[index].id);
                }
            }
        });
    },

    toggleMode() {
        AppState.mode = AppState.mode === 'single' ? 'compare' : 'single';
        const compareMode = document.getElementById('compareMode');
        const singleMode = document.getElementById('singleMode');
        const modeBtn = document.getElementById('modeToggle');

        if (AppState.mode === 'compare') {
            compareMode.style.display = 'block';
            singleMode.style.display = 'none';
            modeBtn.textContent = '← Single View';
        } else {
            compareMode.style.display = 'none';
            singleMode.style.display = 'block';
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

                // Attach watchlist button handler after rendering
                const addBtn = resultDiv.querySelector('.add-to-watchlist[data-symbol]');
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        this.addToWatchlist(addBtn.dataset.symbol);
                        this.fetchStock(); // Refresh display
                    });
                }

                // Render chart after quote
                await ChartManager.renderChart(symbol, quote);

                // Check price alerts
                Alerts.checkAlerts();
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
        const symbol1 = document.getElementById('compareSymbol1').value.toUpperCase().trim().replace(/[^A-Z]/g, '');
        const symbol2 = document.getElementById('compareSymbol2').value.toUpperCase().trim().replace(/[^A-Z]/g, '');
        const symbol3 = document.getElementById('compareSymbol3').value.toUpperCase().trim().replace(/[^A-Z]/g, '');

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

// ============================================
// PRICE ALERTS SYSTEM
// ============================================
const Alerts = {
    openModal() {
        document.getElementById('alertsModal').classList.add('visible');
        this.renderAlerts();
    },

    closeModal() {
        document.getElementById('alertsModal').classList.remove('visible');
        document.getElementById('alertSymbol').value = '';
        document.getElementById('alertPrice').value = '';
    },

    addAlert() {
        const symbol = document.getElementById('alertSymbol').value.toUpperCase().trim();
        const condition = document.getElementById('alertCondition').value;
        const price = parseFloat(document.getElementById('alertPrice').value);

        if (!symbol || !price || price <= 0) {
            alert('Please enter a valid symbol and price');
            return;
        }

        const alert = {
            id: Date.now(),
            symbol,
            condition,
            targetPrice: price,
            triggered: false,
            createdAt: new Date().toISOString()
        };

        Storage.addAlert(alert);
        this.renderAlerts();

        // Clear form
        document.getElementById('alertSymbol').value = '';
        document.getElementById('alertPrice').value = '';
    },

    removeAlert(id) {
        Storage.removeAlert(id);
        this.renderAlerts();
    },

    renderAlerts() {
        const alerts = Storage.getAlerts();
        const alertList = document.getElementById('alertList');

        if (alerts.length === 0) {
            alertList.innerHTML = '<div style="text-align: center; color: var(--muted2); padding: 20px; font-size: 13px;">No alerts set. Add one above!</div>';
            return;
        }

        alertList.innerHTML = alerts.map(alert => `
            <div class="alert-item ${alert.triggered ? 'triggered' : ''}">
                <div class="alert-info">
                    <span class="alert-symbol">${alert.symbol}</span>
                    <span class="alert-condition">${alert.condition === 'above' ? '↑' : '↓'} $${alert.targetPrice.toFixed(2)} ${alert.triggered ? '✅ Triggered!' : ''}</span>
                </div>
                <button class="alert-remove" title="Remove">✕</button>
            </div>
        `).join('');
    },

    async checkAlerts() {
        const alerts = Storage.getAlerts().filter(a => !a.triggered);

        for (const alert of alerts) {
            try {
                const data = await API.fetchQuote(alert.symbol);
                const quote = data['Global Quote'];

                if (quote && quote['05. price']) {
                    const currentPrice = parseFloat(quote['05. price']);
                    let shouldTrigger = false;

                    if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
                        shouldTrigger = true;
                    } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
                        shouldTrigger = true;
                    }

                    if (shouldTrigger) {
                        Storage.updateAlert(alert.id, { triggered: true });
                        this.showNotification(alert, currentPrice);
                    }
                }
            } catch (error) {
                console.error(`Error checking alert for ${alert.symbol}:`, error);
            }
        }
    },

    showNotification(alert, currentPrice) {
        const msg = `🔔 Alert: ${alert.symbol} is ${alert.condition} $${alert.targetPrice.toFixed(2)}! Current price: $${currentPrice.toFixed(2)}`;

        // Browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('EquityCloud Price Alert', { body: msg, icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%232563eb"/><text x="50" y="70" font-size="60" text-anchor="middle" fill="white" font-weight="bold">E</text></svg>' });
        }

        // Fallback to alert
        alert(msg);
    }
};

// Request notification permission on load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Check alerts every 5 minutes
setInterval(() => Alerts.checkAlerts(), 5 * 60 * 1000);

// ============================================
// CSV EXPORT FUNCTIONALITY
// ============================================
function exportWatchlist() {
    const watchlist = Storage.getWatchlist();

    if (watchlist.length === 0) {
        alert('Watchlist is empty. Add some stocks first!');
        return;
    }

    // CSV header
    let csv = 'Symbol,Added Date\n';

    // CSV rows
    watchlist.forEach(symbol => {
        csv += `${symbol},${new Date().toLocaleDateString()}\n`;
    });

    // Create download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `equitycloud-watchlist-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// ============================================
// CHART VISUALIZATION
// ============================================
const ChartManager = {
    chart: null,

    async renderChart(symbol, quote) {
        const container = document.getElementById('result');
        const canvasId = 'priceChart';

        // Check if canvas already exists
        let canvas = document.getElementById(canvasId);
        if (!canvas) {
            const chartHtml = `
                <div class="chart-container">
                    <div class="chart-wrapper">
                        <canvas id="${canvasId}"></canvas>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', chartHtml);
            canvas = document.getElementById(canvasId);
        }

        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }

        // Extract data points
        const open = parseFloat(quote['02. open']);
        const high = parseFloat(quote['03. high']);
        const low = parseFloat(quote['04. low']);
        const price = parseFloat(quote['05. price']);
        const prevClose = parseFloat(quote['08. previous close']);

        // Create simple price chart
        const ctx = canvas.getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Prev Close', 'Open', 'Low', 'Current', 'High'],
                datasets: [{
                    label: `${symbol} Price Movement`,
                    data: [prevClose, open, low, price, high],
                    borderColor: price >= prevClose ? '#22c55e' : '#ef4444',
                    backgroundColor: price >= prevClose ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15,23,42,0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#2563eb',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: false,
                        callbacks: {
                            label: (context) => `$${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => `$${value.toFixed(2)}`,
                            color: '#64748b',
                            font: { size: 11 }
                        },
                        grid: {
                            color: 'rgba(226,232,240,0.5)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#64748b',
                            font: { size: 11 }
                        },
                        grid: {
                            display: false,
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }
};
