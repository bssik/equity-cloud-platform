# EquityCloud

EquityCloud is a small Azure project I built to practice deploying a simple web app end-to-end: frontend + serverless API + automated deploys.

Live demo: https://black-stone-0e8040d03.5.azurestaticapps.net

## What it does

- Type a stock symbol (e.g. `MSFT`)
- The app calls a Python API
- The API fetches a quote from Alpha Vantage
- The UI shows the latest price

## Why I built it

I work as a data engineer (SQL, pipelines, data quality). This project is me getting more comfortable with the "everything around the data" side: cloud resources, deployment, and wiring a small API to a frontend.

## What's in the repo

```
frontend/    static HTML/CSS/JS
api/         Azure Functions (Python)
infra/       Bicep templates (IaC)
```

## Running it locally

You'll need Python 3.11+, Node.js, and an Alpha Vantage API key (https://www.alphavantage.co/support/#api-key).

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
    "ALPHA_VANTAGE_API_KEY": "YOUR_KEY_HERE"
  }
}
```

Install Python dependencies:
```bash
cd api
pip install -r requirements.txt
cd ..
```

Run it:
```bash
swa start frontend --api-location api
```

Open http://localhost:4280.

## Notes

- Alpha Vantage free tier is rate-limited, so occasional throttling is expected.
- If the live demo complains about a missing API key, it's usually an app setting issue in Azure.

## Next steps

- Cleaner API responses + error handling
- Add a simple sentiment summary (likely via Azure OpenAI)
- Consider a framework frontend later (once the backend stabilizes)
