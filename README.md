# EquityCloud

EquityCloud is a small Azure project I built to practice deploying a modern web app end-to-end: Next.js frontend + Python Azure Functions backend + automated deploys.

Live demo: https://black-stone-0e8040d03.6.azurestaticapps.net

## What it does

- Type a stock symbol (e.g. `MSFT`)
- The UI fetches a quote + chart history + news (in parallel)
- The backend pulls market data from Alpha Vantage and news from Finnhub
- The UI shows price history with SMA + RSI, plus recent news

By default, the UI runs in **MOCK** mode for fast iteration and predictable demos. You can switch to real APIs via an env var, and the active mode is always visible in the header (DATA: MOCK/API).

## Why I built it

I work as a data engineer (SQL, pipelines, data quality). This project is me getting more comfortable with the "everything around the data" side: cloud resources, deployment, and wiring a small API to a frontend.

## What's in the repo

```
apps/web/    Next.js (App Router) frontend
api/         Azure Functions (Python)
infra/       Bicep templates (IaC)
frontend/    legacy static prototype (kept for reference)
```

## Running it locally

You'll need Python 3.11+, Node.js 20+, and API keys:

- Alpha Vantage key: https://www.alphavantage.co/support/#api-key
- Finnhub key: https://finnhub.io

Clone it:
```bash
git clone https://github.com/bssik/equity-cloud-platform.git
cd equity-cloud-platform
```

Install the Azure tools:
```bash
npm install -g @azure/static-web-apps-cli
npm install -g azure-functions-core-tools@4
```

Create `api/local.settings.json` and add your key:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "ALPHA_VANTAGE_API_KEY": "YOUR_KEY_HERE",
    "FINNHUB_API_KEY": "YOUR_KEY_HERE"
  }
}
```

Install Python dependencies:
```bash
cd api
pip install -r requirements.txt
cd ..
```

### Inner loop (fast UI work)

This runs the Next.js dev server with hot reload. The UI defaults to mock data.

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000.

To use the real backend instead of mock data:

```bash
set NEXT_PUBLIC_MARKET_DATA_SOURCE=api
```

### Outer loop (SWA-style integration)

This more closely mirrors Azure Static Web Apps routing (frontend + Functions).

```bash
npm install -g @azure/static-web-apps-cli
npm install -g azure-functions-core-tools@4

swa start http://localhost:3000 --api-location api
```

Open http://localhost:4280.

### Backend diagnostics

The API exposes a safe readiness check:

- `GET /api/health` returns `200` when all required API keys are present, otherwise `503`.
- Response includes only boolean flags (never secret values).

## Notes

- Alpha Vantage free tier is rate-limited, so occasional throttling is expected.
- If the live demo complains about a missing API key, it's usually an app setting issue in Azure.

## Next steps

- Add a small status panel that surfaces `/api/health` from the UI
- Continue hardening the deployment pipeline and secrets strategy (Key Vault later)
- Add optional sentiment summarization (future)
