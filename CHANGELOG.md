# Changelog

All notable changes to EquityCloud will be documented in this file.

## [0.2.0] - 2026-01-27

### Added
- **Market Movers on Homepage**: Shows top 5 gainers (🔥) and losers (❄️) from 20 major stocks
  - Initially tried fetching all S&P 500 companies but was too slow
  - Settled on 20 major stocks with 5-minute cache
  - Data stored in localStorage for quick reload
- **Company Name Search**: Can now search by company name (e.g., "Microsoft") not just ticker
  - Uses autocomplete data to resolve names to symbols
  - Fallback to ticker if no match found
- **Research Panel Company Subtitles**: Shows full company name below symbol in side panel

### Fixed
- **Autocomplete Dropdown Clicks**: Clicking suggestions now actually triggers search
  - Issue: blur event was firing before click event
  - Solution: switched from `click` to `mousedown` event with preventDefault
- **Chart Rendering**: Line chart was always empty
  - Problem: API returns simplified format but chart expected full Alpha Vantage format
  - Added compatibility layer to handle both formats
  - Falls back to estimated values when historical data unavailable
- **Dark Theme Contrast**: Text was hard to read in dark mode
  - Took several iterations to get right
  - Added hero gradient to main panel
  - Standardized all backgrounds to `rgba(30,41,59,x)` pattern
  - Improved input field, result panel, and chip contrast
  - Fixed hardcoded dark colors (#0f172a, #64748b, etc) to use CSS variables

### Changed
- Theme system now uses comprehensive CSS variable palette (40+ variables)
- All interactive elements use consistent styling in dark mode

## [0.1.0] - 2026-01-20

### Added
- Initial release with basic stock quote lookup
- Volume breakout detection (Stage 3 entry signals)
- SMA multi-timeframe analysis (50-day, 200-day)
- Quick Research Panel with Ctrl+Click shortcuts
- Autocomplete for stock symbols with fuzzy matching
- Watchlist and price alerts
- Dark/light theme toggle

### Technical
- Azure Functions backend (Python)
- Alpha Vantage API integration
- Bicep infrastructure as code
- GitHub Actions CI/CD
- Azure Static Web Apps hosting

---

## Development Notes

### What Worked Well
- Bicep modules made infrastructure changes easy to track
- GitHub Actions automated deployment saved tons of time
- Pydantic models caught API format issues early
- localStorage caching reduced API calls significantly

### Lessons Learned
- Dark theme contrast is harder than expected - test in both modes always
- Event order matters: mousedown vs click vs blur
- API response formats can vary - always add fallbacks
- Small cache TTL (5 min) balances freshness vs API limits

### Known Issues
- AI Analyst feature is still in preview (Azure OpenAI integration pending)
- No historical price charts yet (only current day data points)
- Rate limiting is basic - could be smarter about queue management

### Next Up (Week 3)
- Azure OpenAI integration for sentiment analysis
- Entra ID authentication
- Windows 365 optimization documentation
