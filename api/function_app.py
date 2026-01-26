import azure.functions as func
import requests
import os

app = func.FunctionApp()

@app.route(route="get_stock_data", auth_level=func.AuthLevel.ANONYMOUS)
def get_stock_data(req: func.HttpRequest) -> func.HttpResponse:
    # 1. Get the API Key from Azure Environment Variables
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    symbol = req.params.get('symbol', 'MSFT') # Default to Microsoft
    
    # 2. Call the Alpha Vantage API
    url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={api_key}"
    response = requests.get(url)
    data = response.json()

    # 3. Return the data to our website
    return func.HttpResponse(str(data), mimetype="application/json")