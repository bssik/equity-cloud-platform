// ============================================
// STATE MANAGEMENT
// ============================================
const AppState = {
    mode: 'single', // 'single' or 'compare'
    theme: localStorage.getItem('theme') || 'dark',
    rateLimitQueue: [],
    isProcessingQueue: false,
    lastApiCall: 0,
    minApiInterval: 12000, // 12 seconds between API calls
    isMobile: false,
    isTablet: false,
    screenWidth: window.innerWidth,
    volumeHistory: {} // Track volume history per symbol for breakout detection
};

// ============================================
// COMPANY NAME LOOKUP
// ============================================
const CompanyNames = {
    // Fallback names for major companies (used if API fails)
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft Corporation',
    'GOOGL': 'Alphabet Inc.',
    'GOOG': 'Alphabet Inc.',
    'AMZN': 'Amazon.com Inc.',
    'META': 'Meta Platforms Inc.',
    'TSLA': 'Tesla Inc.',
    'NVDA': 'NVIDIA Corporation',

    get(symbol) {
        return this[symbol.toUpperCase()] || symbol;
    },

    async loadFromSP500() {
        try {
            console.log('Loading S&P 500 company names...');
            const response = await fetch('https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv');
            const csv = await response.text();
            const lines = csv.split('\n').slice(1); // Skip header

            let count = 0;
            lines.forEach(line => {
                if (!line.trim()) return;
                const parts = line.split(',');
                const symbol = parts[0]?.trim();
                const name = parts[1]?.trim();

                if (symbol && name) {
                    this[symbol] = name;
                    count++;
                }
            });

            console.log(`Loaded ${count} company names from S&P 500 dataset`);
            return true;
        } catch (error) {
            console.warn('Could not load S&P 500 company names:', error.message);
            console.log('Using fallback company names');
            return false;
        }
    },

    // Get all symbols as an array for autocomplete
    getAllSymbols() {
        return Object.keys(this).filter(key => typeof this[key] === 'string' && key !== 'get' && key !== 'loadFromSP500' && key !== 'getAllSymbols');
    }
};

// ============================================
// AUTOCOMPLETE SYSTEM
// ============================================
const Autocomplete = {
    activeInput: null,
    activeSuggestions: null,
    selectedIndex: -1,

    init(inputId, suggestionsId) {
        const input = document.getElementById(inputId);
        const suggestions = document.getElementById(suggestionsId);

        if (!input || !suggestions) return;

        // Input event - show suggestions as user types
        input.addEventListener('input', (e) => {
            this.handleInput(e.target, suggestions);
        });

        // Focus event - show suggestions if input has value
        input.addEventListener('focus', (e) => {
            if (e.target.value.trim()) {
                this.handleInput(e.target, suggestions);
            }
        });

        // Blur event - hide suggestions (with delay for click events)
        input.addEventListener('blur', () => {
            setTimeout(() => this.hideSuggestions(suggestions), 200);
        });

        // Keyboard navigation
        input.addEventListener('keydown', (e) => {
            this.handleKeydown(e, input, suggestions);
        });
    },

    handleInput(input, suggestions) {
        const query = input.value.toUpperCase().trim();

        if (!query || query.length === 0) {
            this.hideSuggestions(suggestions);
            return;
        }

        this.activeInput = input;
        this.activeSuggestions = suggestions;
        this.selectedIndex = -1;

        const matches = this.findMatches(query);
        this.renderSuggestions(suggestions, matches, query);
    },

    findMatches(query) {
        const symbols = CompanyNames.getAllSymbols();
        const matches = [];

        symbols.forEach(symbol => {
            const name = CompanyNames.get(symbol);
            const symbolUpper = symbol.toUpperCase();
            const nameUpper = name.toUpperCase();

            // Exact match (highest priority)
            if (symbolUpper === query) {
                matches.push({ symbol, name, score: 100 });
            }
            // Starts with query (high priority)
            else if (symbolUpper.startsWith(query)) {
                matches.push({ symbol, name, score: 90 });
            }
            // Contains query in symbol (medium priority)
            else if (symbolUpper.includes(query)) {
                matches.push({ symbol, name, score: 70 });
            }
            // Contains query in company name (lower priority)
            else if (nameUpper.includes(query)) {
                matches.push({ symbol, name, score: 50 });
            }
            // Fuzzy match (lowest priority)
            else if (this.fuzzyMatch(query, symbolUpper)) {
                matches.push({ symbol, name, score: 30 });
            }
        });

        // Sort by score (desc) and limit to top 8 results
        return matches
            .sort((a, b) => b.score - a.score)
            .slice(0, 8);
    },

    fuzzyMatch(query, text) {
        let queryIndex = 0;
        for (let i = 0; i < text.length && queryIndex < query.length; i++) {
            if (text[i] === query[queryIndex]) {
                queryIndex++;
            }
        }
        return queryIndex === query.length;
    },

    renderSuggestions(suggestionsEl, matches, query) {
        if (matches.length === 0) {
            suggestionsEl.innerHTML = `<div class="autocomplete-no-results">No matches found for "${query}"</div>`;
            suggestionsEl.classList.add('visible');
            return;
        }

        const html = matches.map((match, index) => `
            <div class="autocomplete-item" data-symbol="${match.symbol}" data-index="${index}">
                <span class="autocomplete-symbol">${match.symbol}</span>
                <span class="autocomplete-name">${match.name}</span>
            </div>
        `).join('');

        suggestionsEl.innerHTML = html;
        suggestionsEl.classList.add('visible');

        // Attach click handlers
        suggestionsEl.querySelectorAll('.autocomplete-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectItem(item.dataset.symbol);
            });
        });
    },

    hideSuggestions(suggestionsEl) {
        if (suggestionsEl) {
            suggestionsEl.classList.remove('visible');
            this.selectedIndex = -1;
        }
    },

    selectItem(symbol) {
        if (this.activeInput) {
            this.activeInput.value = symbol;
            this.hideSuggestions(this.activeSuggestions);

            // Trigger input event to update UI (e.g., show clear button)
            const event = new Event('input', { bubbles: true });
            this.activeInput.dispatchEvent(event);
        }
    },

    handleKeydown(e, input, suggestions) {
        const items = suggestions.querySelectorAll('.autocomplete-item');

        if (!suggestions.classList.contains('visible') || items.length === 0) {
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                this.selectedIndex = Math.min(this.selectedIndex + 1, items.length - 1);
                this.updateSelection(items);
                break;

            case 'ArrowUp':
                e.preventDefault();
                this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
                this.updateSelection(items);
                break;

            case 'Enter':
                e.preventDefault();
                if (this.selectedIndex >= 0) {
                    const selectedItem = items[this.selectedIndex];
                    this.selectItem(selectedItem.dataset.symbol);
                }
                break;

            case 'Escape':
                e.preventDefault();
                this.hideSuggestions(suggestions);
                break;
        }
    },

    updateSelection(items) {
        items.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('selected');
            }
        });
    }
};

// ============================================
// RESPONSIVE UTILITIES
// ============================================
const ResponsiveManager = {
    breakpoints: {
        mobile: 600,
        tablet: 768,
        desktop: 1024
    },

    init() {
        this.updateScreenState();
        window.addEventListener('resize', this.debounce(() => {
            this.updateScreenState();
            this.handleResize();
        }, 250));

        // Handle orientation changes
        if (window.screen?.orientation) {
            window.screen.orientation.addEventListener('change', () => {
                this.handleOrientationChange();
            });
        }
    },

    updateScreenState() {
        const width = window.innerWidth;
        AppState.screenWidth = width;
        AppState.isMobile = width <= this.breakpoints.mobile;
        AppState.isTablet = width > this.breakpoints.mobile && width <= this.breakpoints.tablet;
        AppState.isDesktop = width > this.breakpoints.tablet;
    },

    handleResize() {
        // Adjust chart if visible
        if (typeof ChartManager !== 'undefined' && ChartManager.chart) {
            ChartManager.chart.resize();
        }

        // Update any responsive-specific UI elements
        this.adjustUIForScreenSize();
    },

    handleOrientationChange() {
        // Give the browser time to adjust
        setTimeout(() => {
            this.updateScreenState();
            this.handleResize();
        }, 100);
    },

    adjustUIForScreenSize() {
        // Padding is now handled by CSS media queries
        // This function can be used for other dynamic UI adjustments if needed
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
};

// ============================================
// CACHE MANAGEMENT
// ============================================
const Cache = {
    TTL: 60000, // 60 seconds cache validity

    set(symbol, data) {
        const cacheEntry = {
            data,
            timestamp: Date.now(),
            expiresAt: Date.now() + this.TTL
        };
        localStorage.setItem(`quote_cache_${symbol}`, JSON.stringify(cacheEntry));
    },

    get(symbol) {
        const cached = localStorage.getItem(`quote_cache_${symbol}`);
        if (!cached) return null;

        const entry = JSON.parse(cached);
        if (Date.now() > entry.expiresAt) {
            // Cache expired, remove it
            this.remove(symbol);
            return null;
        }

        return entry;
    },

    remove(symbol) {
        localStorage.removeItem(`quote_cache_${symbol}`);
    },

    clear() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('quote_cache_')) {
                localStorage.removeItem(key);
            }
        });
    },

    getAge(symbol) {
        const cached = this.get(symbol);
        if (!cached) return null;
        return Math.floor((Date.now() - cached.timestamp) / 1000); // Age in seconds
    }
};

// ============================================
// URL STATE MANAGEMENT
// ============================================
const URLState = {
    getParams() {
        const params = new URLSearchParams(window.location.search);
        const compareRaw = params.get('compare');
        const compareSymbols = compareRaw
            ? compareRaw.split(',').map(s => s.trim()).filter(Boolean)
            : [];
        return {
            symbol: params.get('symbol'),
            compareRaw,
            compareSymbols
        };
    },

    setSymbol(symbol) {
        const url = new URL(window.location);
        url.searchParams.set('symbol', symbol);
        url.searchParams.delete('compare');
        window.history.pushState({}, '', url);
    },

    setCompare(symbols) {
        const list = Array.isArray(symbols)
            ? symbols
            : String(symbols).split(',').map(s => s.trim()).filter(Boolean);
        const url = new URL(window.location);
        url.searchParams.delete('symbol');
        url.searchParams.set('compare', list.join(','));
        window.history.pushState({}, '', url);
    },

    clear() {
        const url = new URL(window.location);
        url.searchParams.delete('symbol');
        url.searchParams.delete('compare');
        window.history.pushState({}, '', url);
    }
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
// API CLIENT WITH QUEUE AND CACHE
// ============================================
const API = {
    async fetchQuote(symbol, useCache = true) {
        // Check cache first
        if (useCache) {
            const cached = Cache.get(symbol);
            if (cached) {
                console.log(`Using cached data for ${symbol} (age: ${Cache.getAge(symbol)}s)`);
                return cached.data;
            }
        }

        // Respect rate limiting
        const timeSinceLastCall = Date.now() - AppState.lastApiCall;
        if (timeSinceLastCall < AppState.minApiInterval) {
            const waitTime = AppState.minApiInterval - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        AppState.lastApiCall = Date.now();
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

        const data = await response.json();

        // Cache the result
        if (data.symbol && data.price) {
            Cache.set(symbol, data);
        }

        return data;
    },

    async fetchMultiple(symbols, onProgress) {
        const results = [];
        const delay = 12000; // 12 seconds between calls (5 per minute = safe)

        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];

            // Check cache first
            const cached = Cache.get(symbol);
            if (cached) {
                onProgress && onProgress(i, symbols.length, symbol, true);
                results.push({ symbol, data: cached.data, error: null, cached: true });
                continue;
            }

            try {
                onProgress && onProgress(i, symbols.length, symbol, false);
                const data = await API.fetchQuote(symbol, false); // Already checked cache
                results.push({ symbol, data, error: null, cached: false });

                // Add delay between requests (except for the last one)
                if (i < symbols.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } catch (error) {
                results.push({ symbol, data: null, error: error.message, cached: false });
            }
        }

        return results;
    },

    getNextCallTime() {
        const timeSinceLastCall = Date.now() - AppState.lastApiCall;
        if (timeSinceLastCall >= AppState.minApiInterval) {
            return 0;
        }
        return Math.ceil((AppState.minApiInterval - timeSinceLastCall) / 1000);
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

        // Volume Breakout Detection
        const volumeSignal = this.detectVolumeBreakout(quote);

        let signal, signalClass;
        if (volumeSignal.isBreakout && momentum.includes('Bullish')) {
            signal = '🚀 Volume Breakout!';
            signalClass = 'breakout';
        } else if (momentum.includes('Bullish') && volatility !== 'High') {
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
            signal, signalClass,
            volumeSignal
        };
    },

    detectVolumeBreakout(quote) {
        const symbol = quote.symbol || quote['01. symbol'];
        const volume = parseInt(quote['06. volume']);

        // Initialize or get volume history for this symbol
        if (!AppState.volumeHistory[symbol]) {
            AppState.volumeHistory[symbol] = [];
        }

        const history = AppState.volumeHistory[symbol];

        // Add current volume to history
        history.push(volume);

        // Keep only last 20 days
        if (history.length > 20) {
            history.shift();
        }

        // Need at least 5 days of history to calculate
        if (history.length < 5) {
            return {
                isBreakout: false,
                avgVolume: volume,
                volumeRatio: 1.0,
                description: 'Insufficient data'
            };
        }

        // Calculate 20-day average (excluding today)
        const historicalVolumes = history.slice(0, -1);
        const avgVolume = historicalVolumes.reduce((sum, v) => sum + v, 0) / historicalVolumes.length;
        const volumeRatio = volume / avgVolume;

        // Stage 3 entry signal: >150% of average
        const isBreakout = volumeRatio > 1.5;

        let description;
        if (volumeRatio > 2.0) {
            description = '🔥 Extreme Volume (2x+ avg)';
        } else if (volumeRatio > 1.5) {
            description = '📊 High Volume (Stage 3 Entry)';
        } else if (volumeRatio > 1.2) {
            description = '📈 Above Average Volume';
        } else if (volumeRatio < 0.5) {
            description = '📉 Very Low Volume';
        } else {
            description = '➡️ Normal Volume';
        }

        return {
            isBreakout,
            avgVolume: Math.round(avgVolume),
            volumeRatio,
            description
        };
    }
};

// ============================================
// RENDERING
// ============================================
const Renderer = {
    renderSingleQuote(quote, symbol, fetchTime, isCached = false) {
        // Handle both old (Global Quote) and new API formats
        const price = quote.price ? parseFloat(quote.price) : parseFloat(quote['05. price']);
        const change = quote.change_percent || quote['10. change percent'];
        const isPositive = change && !change.startsWith('-');
        const timeStr = fetchTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const open = quote.open || quote['02. open'];
        const high = quote.high || quote['03. high'];
        const low = quote.low || quote['04. low'];
        const volume = quote.volume || quote['06. volume'];
        const prevClose = quote.previous_close || quote['08. previous close'];
        const tradingDay = quote.latest_trading_day || quote['07. latest trading day'];

        const watchlist = Storage.getWatchlist();
        const isInWatchlist = watchlist.includes(symbol);
        const signal = SignalAnalyzer.calculate(quote);

        // Cache age badge
        const cacheAgeSec = isCached ? (Cache.getAge(symbol) ?? 0) : 0;
        const cacheBadge = isCached ? `<span class="cache-badge" title="From cache, ${cacheAgeSec}s old">⚡ Cached (${cacheAgeSec}s)</span>` : '';

        return `
            <div class="quote-grid">
                <div class="quote-item">
                    <span class="quote-label">Symbol</span>
                    <span class="quote-value">${quote.symbol || quote['01. symbol'] || symbol} ${cacheBadge}</span>
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
                        ${signal.volumeSignal ? `
                        <div class="signal-indicator">
                            <span class="signal-label">Volume Activity</span>
                            <span class="signal-value" style="font-size: 11px;">
                                ${signal.volumeSignal.description}
                                ${signal.volumeSignal.avgVolume > 0 ? `<div style="font-size: 10px; color: var(--muted2); margin-top: 2px;">${signal.volumeSignal.volumeRatio.toFixed(2)}x average (${(signal.volumeSignal.avgVolume / 1000000).toFixed(1)}M avg)</div>` : ''}
                            </span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="signal-badge ${signal.signalClass}">${signal.signal}</div>
                </div>

                <div class="timestamp">Last updated at ${timeStr}</div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
                ${!isInWatchlist ? `<button class="add-to-watchlist" data-symbol="${symbol}">📌 Watchlist</button>` : `<button class="add-to-watchlist" style="opacity: 0.6; cursor: default;">✓ Added</button>`}
                <button class="ai-analysis-btn" onclick="UI.openAIModal('${symbol}')">✨ AI Insight</button>
            </div>
        `;
    },

    renderComparison(results) {
        const successfulResults = results.filter(r => r.data && (r.data.symbol || r.data['Global Quote']));

        if (successfulResults.length === 0) {
            return '<span class="error">No valid data to compare</span>';
        }

        // Normalize data format (handle both old and new API formats)
        const normalizedResults = successfulResults.map(r => {
            const quote = r.data.symbol ? r.data : r.data['Global Quote'];
            return {
                symbol: r.symbol,
                quote: quote,
                price: quote.price ? parseFloat(quote.price) : parseFloat(quote['05. price']),
                change: quote.change_percent || quote['10. change percent'],
                open: quote.open ? parseFloat(quote.open) : parseFloat(quote['02. open']),
                high: quote.high ? parseFloat(quote.high) : parseFloat(quote['03. high']),
                low: quote.low ? parseFloat(quote.low) : parseFloat(quote['04. low']),
                volume: quote.volume ? parseInt(quote.volume) : parseInt(quote['06. volume']),
                prevClose: quote.previous_close ? parseFloat(quote.previous_close) : parseFloat(quote['08. previous close'])
            };
        });

        // Calculate momentum for each stock
        const momentumData = normalizedResults.map(r => {
            const priceChange = ((r.price - r.prevClose) / r.prevClose) * 100;
            const positionInRange = ((r.price - r.low) / (r.high - r.low)) * 100;
            let momentum, momentumClass;

            if (priceChange > 1 && positionInRange > 60) {
                momentum = '📈 Bullish';
                momentumClass = 'positive';
            } else if (priceChange < -1 && positionInRange < 40) {
                momentum = '📉 Bearish';
                momentumClass = 'negative';
            } else {
                momentum = '➡️ Neutral';
                momentumClass = '';
            }

            return { symbol: r.symbol, momentum, momentumClass, priceChange };
        });

        // Momentum section
        let html = '<div style="margin-bottom: 24px;">';
        html += '<h3 style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.05em;">⚡ Momentum Analysis</h3>';
        html += '<div style="display: grid; gap: 12px;">';

        momentumData.forEach(m => {
            html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: rgba(241,245,249,0.5); border: 1px solid rgba(226,232,240,0.9); border-radius: 10px;">`;
            html += `<span style="font-weight: 600; color: #0f172a;">${m.symbol}</span>`;
            html += `<span class="${m.momentumClass}" style="font-weight: 600;">${m.momentum}</span>`;
            html += `</div>`;
        });

        html += '</div></div>';

        // Table section
        const headers = ['Metric', ...normalizedResults.map(r => r.symbol)];
        html += '<div class="comparison-table"><table><thead><tr>';
        headers.forEach(h => html += `<th>${h}</th>`);
        html += '</tr></thead><tbody>';

        const metrics = [
            { label: 'Price', getValue: r => `$${r.price.toFixed(2)}` },
            { label: 'Change %', getValue: r => r.change },
            { label: 'Open', getValue: r => `$${r.open.toFixed(2)}` },
            { label: 'High', getValue: r => `$${r.high.toFixed(2)}` },
            { label: 'Low', getValue: r => `$${r.low.toFixed(2)}` },
            { label: 'Volume', getValue: r => r.volume.toLocaleString() }
        ];

        metrics.forEach(metric => {
            html += '<tr>';
            html += `<td class="metric-label">${metric.label}</td>`;
            normalizedResults.forEach(result => {
                html += `<td>${metric.getValue(result)}</td>`;
            });
            html += '</tr>';
        });

        html += '</tbody></table></div>';

        // Add scroll hint for mobile
        if (AppState.isMobile) {
            html = '<div style="font-size: 11px; color: var(--muted2); margin-bottom: 8px; text-align: center;">← Scroll horizontally to see more →</div>' + html;
        }

        // Add chart container
        html += `
            <div class="chart-container" style="margin-top: 24px;">
                <h3 style="font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">📊 Price Comparison</h3>
                <div class="chart-wrapper">
                    <canvas id="comparisonChart"></canvas>
                </div>
            </div>
        `;

        // Show errors for failed fetches
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            html += '<div class="comparison-errors">';
            errors.forEach(e => {
                html += `<div class="error-item">⚠️ ${e.symbol}: ${e.error}</div>`;
            });
            html += '</div>';
        }

        // Store data for chart rendering
        this._comparisonData = normalizedResults;

        return html;
    },

    renderComparisonChart(results) {
        const canvas = document.getElementById('comparisonChart');
        if (!canvas) return;

        // Destroy existing chart
        if (ChartManager.comparisonChart) {
            ChartManager.comparisonChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        const isMobile = AppState.isMobile;
        const fontSize = isMobile ? 9 : 11;

        // Create datasets for each stock
        const colors = ['#2563eb', '#22c55e', '#f59e0b'];
        const datasets = results.map((r, index) => ({
            label: r.symbol,
            data: [r.prevClose, r.open, r.low, r.price, r.high],
            borderColor: colors[index],
            backgroundColor: `${colors[index]}20`,
            borderWidth: 2,
            tension: 0.3,
            fill: false,
            pointBackgroundColor: colors[index],
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: isMobile ? 3 : 4,
            pointHoverRadius: isMobile ? 5 : 6
        }));

        ChartManager.comparisonChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Prev Close', 'Open', 'Low', 'Current', 'High'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#0f172a',
                            font: { size: fontSize + 1, weight: '600' },
                            padding: isMobile ? 8 : 12,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15,23,42,0.9)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        borderColor: '#2563eb',
                        borderWidth: 1,
                        padding: isMobile ? 8 : 12,
                        titleFont: { size: fontSize + 1 },
                        bodyFont: { size: fontSize },
                        callbacks: {
                            label: (context) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: (value) => `$${value.toFixed(2)}`,
                            color: '#64748b',
                            font: { size: fontSize }
                        },
                        grid: {
                            color: 'rgba(226,232,240,0.5)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#64748b',
                            font: { size: fontSize }
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
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
        this.renderExampleChips();
        Renderer.renderHistory();
        Renderer.renderWatchlist();

        // Initialize autocomplete for all inputs
        Autocomplete.init('symbolInput', 'symbolSuggestions');
        Autocomplete.init('compareSymbol1', 'compareSuggestions1');
        Autocomplete.init('compareSymbol2', 'compareSuggestions2');
        Autocomplete.init('compareSymbol3', 'compareSuggestions3');

        // Event delegation for dynamic elements
        this.attachEventListeners();

        // Restore state from URL on page load
        const params = URLState.getParams();
        if (params.compareSymbols.length > 1) {
            AppState.mode = 'compare';
            this.applyModeUI();
            const [s1, s2, s3] = params.compareSymbols;
            const el1 = document.getElementById('compareSymbol1');
            const el2 = document.getElementById('compareSymbol2');
            const el3 = document.getElementById('compareSymbol3');
            if (el1) el1.value = (s1 || '').toUpperCase();
            if (el2) el2.value = (s2 || '').toUpperCase();
            if (el3) el3.value = (s3 || '').toUpperCase();
            this.compareStocks();
        } else if (params.symbol) {
            AppState.mode = 'single';
            this.applyModeUI();
            const symbolInput = document.getElementById('symbolInput');
            if (symbolInput) symbolInput.value = params.symbol.toUpperCase();
            this.fetchStock();
        } else {
            this.applyModeUI();
        }

        // Update rate limit display periodically
        this.updateRateLimitDisplay();
        setInterval(() => this.updateRateLimitDisplay(), 1000);

        // Update notification badge periodically
        this.updateNotificationBadge();
        setInterval(() => this.updateNotificationBadge(), 10000); // Every 10 seconds
    },

    attachEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
            // Add touch feedback
            if (ResponsiveManager.isTouchDevice()) {
                themeToggle.addEventListener('touchstart', function() {
                    this.style.transform = 'scale(0.95)';
                }, { passive: true });
                themeToggle.addEventListener('touchend', function() {
                    this.style.transform = '';
                }, { passive: true });
            }
        }

        const forceUppercase = (el) => {
            if (!el) return;
            el.addEventListener('input', () => {
                el.value = el.value.toUpperCase();
            });
        };

        // Example chips are now rendered dynamically in renderExampleChips()

        // Single mode input handlers
        const symbolInput = document.getElementById('symbolInput');
        const clearBtn = document.getElementById('clearBtn');
        const searchBtn = document.getElementById('searchBtn');

        symbolInput?.addEventListener('input', () => this.handleInput(symbolInput));
        symbolInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                // Blur input on mobile after enter
                if (AppState.isMobile) symbolInput.blur();
                this.fetchStock();
            }
        });
        clearBtn?.addEventListener('click', () => this.clearInput());
        searchBtn?.addEventListener('click', () => this.fetchStock());

        // Mode toggle
        document.getElementById('modeToggle')?.addEventListener('click', () => this.toggleMode());

        // Compare button
        document.getElementById('compareBtn')?.addEventListener('click', () => this.compareStocks());

        // Compare inputs
        forceUppercase(document.getElementById('compareSymbol1'));
        forceUppercase(document.getElementById('compareSymbol2'));
        forceUppercase(document.getElementById('compareSymbol3'));

        // Alerts modal
        document.getElementById('alertsBtn')?.addEventListener('click', () => Alerts.openModal());
        document.getElementById('alertsClose')?.addEventListener('click', () => Alerts.closeModal());
        document.getElementById('addAlertBtn')?.addEventListener('click', () => Alerts.addAlert());
        document.getElementById('alertsModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'alertsModal') Alerts.closeModal();
        });

        // AI Modal
        const closeAI = () => document.getElementById('aiModal')?.classList.remove('visible');
        document.getElementById('aiClose')?.addEventListener('click', closeAI);
        document.getElementById('aiNotifyBtn')?.addEventListener('click', closeAI);
        document.getElementById('aiModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'aiModal') closeAI();
        });

        // Alerts inputs
        forceUppercase(document.getElementById('alertSymbol'));

        // Export button
        document.getElementById('exportBtn')?.addEventListener('click', () => exportWatchlist());

        // Keyboard shortcuts (desktop only)
        document.addEventListener('keydown', (e) => {
            // Skip keyboard shortcuts on mobile devices or when input is focused
            if (AppState.isMobile) return;
            if (document.activeElement?.tagName === 'INPUT' ||
                document.activeElement?.tagName === 'TEXTAREA') return;

            if (e.key === '/') {
                e.preventDefault();
                symbolInput?.focus();
            } else if (e.key === 'Escape') {
                this.clearInput();
            } else if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                this.toggleTheme();
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

        // Quick filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const category = e.currentTarget.dataset.category;
                if (category) this.handleQuickFilter(category);
            });

            // Add touch feedback for mobile
            if (ResponsiveManager.isTouchDevice()) {
                chip.addEventListener('touchstart', function() {
                    this.style.transform = 'scale(0.95)';
                }, { passive: true });
                chip.addEventListener('touchend', function() {
                    this.style.transform = '';
                }, { passive: true });
            }
        });

        // Toolbar buttons
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshCurrentView());
        document.getElementById('notificationsBtn')?.addEventListener('click', () => this.showNotifications());
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showSettings());
    },

    refreshCurrentView() {
        if (AppState.mode === 'single') {
            const symbolInput = document.getElementById('symbolInput');
            if (symbolInput && symbolInput.value.trim()) {
                this.fetchStock();
            }
        } else {
            const symbol1 = document.getElementById('compareSymbol1')?.value.trim();
            const symbol2 = document.getElementById('compareSymbol2')?.value.trim();
            if (symbol1 && symbol2) {
                this.compareStocks();
            }
        }

        // Show feedback
        const btn = document.getElementById('refreshBtn');
        if (btn) {
            btn.style.transform = 'rotate(360deg)';
            setTimeout(() => btn.style.transform = '', 500);
        }
    },

    showNotifications() {
        const alerts = Storage.getAlerts();
        const triggeredAlerts = alerts.filter(a => a.triggered);

        if (triggeredAlerts.length === 0) {
            alert('No new notifications.\n\nTriggered alerts will appear here.');
        } else {
            const messages = triggeredAlerts.map(a =>
                `🔔 ${a.symbol} ${a.condition} $${a.targetPrice.toFixed(2)}`
            ).join('\n');
            alert(`Notifications (${triggeredAlerts.length}):\n\n${messages}`);
        }

        // Update badge
        this.updateNotificationBadge();
    },

    showSettings() {
        const settings = [
            '⚙️ Settings',
            '',
            '• Theme: ' + (AppState.theme === 'dark' ? 'Dark 🌙' : 'Light ☀️'),
            '• API Cache: ' + (Cache.TTL / 1000) + 's',
            '• Rate Limit: ' + (AppState.minApiInterval / 1000) + 's',
            '• Screen: ' + (AppState.isMobile ? 'Mobile 📱' : AppState.isTablet ? 'Tablet' : 'Desktop 🖥️'),
            '',
            'Use theme toggle (🌓) to switch appearance.'
        ].join('\n');

        alert(settings);
    },

    openAIModal(symbol) {
        const modal = document.getElementById('aiModal');
        const title = modal.querySelector('.modal-title');
        title.innerHTML = `🤖 AI Analysis: <span style="color: var(--accent);">${symbol}</span>`;
        modal.classList.add('visible');
    },

    updateNotificationBadge() {
        const alerts = Storage.getAlerts();
        const triggeredCount = alerts.filter(a => a.triggered).length;
        const badge = document.getElementById('notificationBadge');

        if (badge) {
            if (triggeredCount > 0) {
                badge.textContent = triggeredCount;
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }
        }
    },

    handleQuickFilter(category) {
        // Predefined stock lists for quick access
        const filterCategories = {
            tech: ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'TSLA'],
            finance: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C'],
            energy: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC'],
            healthcare: ['JNJ', 'UNH', 'PFE', 'ABBV', 'TMO', 'LLY'],
            consumer: ['AMZN', 'WMT', 'HD', 'MCD', 'NKE', 'SBUX']
        };

        const symbols = filterCategories[category];
        if (!symbols) return;

        // Switch to compare mode and populate with category stocks
        if (AppState.mode !== 'compare') {
            this.toggleMode();
        }

        // Fill in the compare inputs
        document.getElementById('compareSymbol1').value = symbols[0] || '';
        document.getElementById('compareSymbol2').value = symbols[1] || '';
        document.getElementById('compareSymbol3').value = symbols[2] || '';

        // Show a hint
        const compareResult = document.getElementById('compareResult');
        compareResult.innerHTML = `<div class="loading">Selected ${category} stocks. Click "Compare Stocks" to analyze.</div>`;
    },

    toggleMode() {
        AppState.mode = AppState.mode === 'single' ? 'compare' : 'single';
        this.applyModeUI();
    },

    applyModeUI() {
        const compareMode = document.getElementById('compareMode');
        const singleMode = document.getElementById('singleMode');
        const modeBtn = document.getElementById('modeToggle');
        const marketOverview = document.getElementById('marketOverview');
        const quickFilters = document.getElementById('quickFilters');

        if (!compareMode || !singleMode || !modeBtn) return;

        if (AppState.mode === 'compare') {
            compareMode.style.display = 'block';
            singleMode.style.display = 'none';
            modeBtn.textContent = '← Single View';
            if (marketOverview) marketOverview.style.display = 'grid';
            if (quickFilters) quickFilters.style.display = 'flex';
        } else {
            compareMode.style.display = 'none';
            singleMode.style.display = 'block';
            modeBtn.textContent = '⚖️ Compare';
            if (marketOverview) marketOverview.style.display = 'none';
            if (quickFilters) quickFilters.style.display = 'none';
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

    renderExampleChips() {
        const exampleSymbols = ['MSFT', 'AAPL', 'GOOGL', 'TSLA', 'NVDA'];
        const container = document.getElementById('exampleChips');

        console.log('renderExampleChips called, container:', container);

        if (container) {
            container.innerHTML = exampleSymbols.map(symbol => {
                const companyName = CompanyNames.get(symbol);
                console.log(`Rendering ${symbol} as ${companyName}`);
                return `<span class="example-chip" data-symbol="${symbol}">${companyName}</span>`;
            }).join('');

            console.log('Example chips rendered:', container.innerHTML);

            // Attach event listeners
            container.querySelectorAll('.example-chip').forEach(chip => {
                chip.addEventListener('click', (e) => {
                    const symbol = e.target.dataset.symbol;
                    if (symbol) this.selectSymbol(symbol);
                });

                // Add touch feedback for mobile
                if (ResponsiveManager.isTouchDevice()) {
                    chip.addEventListener('touchstart', function() {
                        this.style.transform = 'scale(0.95)';
                    }, { passive: true });
                    chip.addEventListener('touchend', function() {
                        this.style.transform = '';
                    }, { passive: true });
                }
            });
        } else {
            console.error('exampleChips container not found!');
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

    updateMarketOverview(symbol, quote) {
        try {
            // Update market cards based on recently searched stocks
            const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
            const price = parseFloat(quote['05. price']);
            const volume = parseInt(quote['06. volume']);

            // Simple logic: update cards based on this stock's performance
            const marketCards = document.querySelectorAll('.market-card');

            // Exit early if cards don't exist
            if (!marketCards || marketCards.length < 3) return;

            // Get current top gainer
            const topGainerCard = marketCards[0];
            const topGainerChangeEl = topGainerCard?.querySelector('.market-card-change');
            if (topGainerChangeEl) {
                const currentGainerChange = parseFloat(topGainerChangeEl.textContent.replace(/[^0-9.-]/g, '')) || -Infinity;

                if (changePercent > currentGainerChange) {
                    const valueEl = topGainerCard.querySelector('.market-card-value');
                    if (valueEl) valueEl.textContent = symbol;
                    topGainerChangeEl.textContent = `+${changePercent.toFixed(2)}%`;
                    topGainerChangeEl.classList.add('positive');
                    topGainerChangeEl.classList.remove('negative');
                }
            }

            // Get current top loser
            const topLoserCard = marketCards[1];
            const topLoserChangeEl = topLoserCard?.querySelector('.market-card-change');
            if (topLoserChangeEl) {
                const currentLoserChange = parseFloat(topLoserChangeEl.textContent.replace(/[^0-9.-]/g, '')) || 0;

                if (changePercent < 0 && (changePercent < currentLoserChange || currentLoserChange >= 0)) {
                    const valueEl = topLoserCard.querySelector('.market-card-value');
                    if (valueEl) valueEl.textContent = symbol;
                    topLoserChangeEl.textContent = `${changePercent.toFixed(2)}%`;
                    topLoserChangeEl.classList.add('negative');
                    topLoserChangeEl.classList.remove('positive');
                }
            }

            // Update most active based on volume
            const mostActiveCard = marketCards[2];
            const mostActiveChangeEl = mostActiveCard?.querySelector('.market-card-change');
            if (mostActiveChangeEl) {
                const currentVolText = mostActiveChangeEl.textContent;
                const currentVol = parseInt(currentVolText.replace(/[^0-9]/g, '')) || 0;

                if (volume > currentVol) {
                    const valueEl = mostActiveCard.querySelector('.market-card-value');
                    if (valueEl) valueEl.textContent = symbol;
                    mostActiveChangeEl.textContent = `Vol: ${(volume / 1000000).toFixed(1)}M`;
                }
            }
        } catch (error) {
            // Silently fail - don't break the main functionality
            console.warn('Failed to update market overview:', error);
        }
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
            const cachedBefore = Cache.get(symbol);
            const data = await API.fetchQuote(symbol, true); // Use cache
            const isCached = !!cachedBefore;
            const quote = data.symbol ? data : data['Global Quote'];

            if (quote && (quote.symbol || Object.keys(quote).length > 0)) {
                Storage.saveToHistory(symbol);
                Renderer.renderHistory();
                resultDiv.innerHTML = Renderer.renderSingleQuote(quote, symbol, fetchTime, isCached);

                // Update URL state
                URLState.setSymbol(symbol);

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

                // Update market overview with this stock's data
                this.updateMarketOverview(symbol, quote);
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
        resultDiv.innerHTML = '<div class="compare-progress">Fetching data...</div>';

        // Update URL state
        URLState.setCompare(symbols);

        try {
            const results = await API.fetchMultiple(symbols, (index, total, symbol, cached) => {
                const status = cached ? '⚡ (cached)' : '(fetching...)';
                resultDiv.innerHTML = `<div class="compare-progress">Loading ${symbol} ${status} (${index + 1}/${total})</div>`;
            });

            resultDiv.innerHTML = Renderer.renderComparison(results);

            // Render chart after DOM update
            setTimeout(() => {
                if (Renderer._comparisonData) {
                    Renderer.renderComparisonChart(Renderer._comparisonData);
                }
            }, 100);
        } catch (error) {
            resultDiv.innerHTML = `<span class="error">${error.message}</span>`;
        } finally {
            compareBtn.disabled = false;
        }
    },

    updateRateLimitDisplay() {
        const nextCallTime = API.getNextCallTime();
        const statusEl = document.getElementById('rateLimitStatus');

        if (!statusEl) {
            // Create status element if it doesn't exist
            const container = document.querySelector('.container');
            if (container) {
                const statusDiv = document.createElement('div');
                statusDiv.id = 'rateLimitStatus';
                statusDiv.className = 'rate-limit-status';
                container.insertBefore(statusDiv, container.firstChild);
            }
        }

        const status = document.getElementById('rateLimitStatus');
        if (status) {
            if (nextCallTime > 0) {
                status.textContent = `⏱️ Next API call available in ${nextCallTime}s`;
                status.style.display = 'block';
            } else {
                status.style.display = 'none';
            }
        }
    }
};

// ============================================
// INITIALIZATION
// ============================================
window.addEventListener('load', async () => {
    // Load company names first (non-blocking)
    CompanyNames.loadFromSP500().then(() => {
        // Re-render example chips with loaded company names
        if (UI.renderExampleChips) {
            UI.renderExampleChips();
        }
    });

    ResponsiveManager.init();
    UI.init();
});

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
    comparisonChart: null,

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

        // Adjust chart options for mobile
        const isMobile = AppState.isMobile;
        const fontSize = isMobile ? 9 : 11;
        const pointRadius = isMobile ? 4 : 5;
        const pointHoverRadius = isMobile ? 6 : 7;

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
                    pointRadius: pointRadius,
                    pointHoverRadius: pointHoverRadius
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
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
                        padding: isMobile ? 8 : 12,
                        displayColors: false,
                        titleFont: { size: fontSize + 1 },
                        bodyFont: { size: fontSize },
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
                            font: { size: fontSize }
                        },
                        grid: {
                            color: 'rgba(226,232,240,0.5)',
                            drawBorder: false
                        }
                    },
                    x: {
                        ticks: {
                            color: '#64748b',
                            font: { size: fontSize },
                            maxRotation: isMobile ? 45 : 0,
                            minRotation: isMobile ? 45 : 0
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

// End of file - v1.0
