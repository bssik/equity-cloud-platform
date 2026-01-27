import azure.functions as func
import requests
import os
import json

app = func.FunctionApp()

@app.route(route="quote/{symbol}", auth_level=func.AuthLevel.ANONYMOUS)
def get_stock_quote(req: func.HttpRequest) -> func.HttpResponse:
    # Get symbol from route parameter
    symbol = req.route_params.get('symbol')

    # Get API key from Azure environment variables
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")

    if not api_key:
        return func.HttpResponse(
            json.dumps({"error": "API key not configured"}),
            status_code=500,
            mimetype="application/json"
        )

    # Call Alpha Vantage API
    url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={api_key}"
    response = requests.get(url)
    data = response.json()

    # Return proper JSON response
    return func.HttpResponse(
        json.dumps(data),
        status_code=200,
        mimetype="application/json"
    )
