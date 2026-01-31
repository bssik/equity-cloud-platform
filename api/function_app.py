import azure.functions as func
import logging
import json
import os
from datetime import datetime, timezone
from services.stock_service import StockService
from services.news_service import NewsService

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)


@app.route(route="health")
def health_check(req: func.HttpRequest) -> func.HttpResponse:
    """
    Health/readiness endpoint.

    Security rule: never return secret values. Only return boolean flags
    indicating whether required settings are present.
    """
    alpha_vantage_configured = bool(os.environ.get("ALPHA_VANTAGE_API_KEY"))
    finnhub_configured = bool(os.environ.get("FINNHUB_API_KEY"))

    # Readiness is per-capability, plus an overall signal.
    readiness = {
        "quote": alpha_vantage_configured,
        "history": alpha_vantage_configured,
        "sma": alpha_vantage_configured,
        "news": finnhub_configured,
    }

    overall_ready = all(readiness.values())

    payload = {
        "status": "ok" if overall_ready else "degraded",
        "utc_time": datetime.now(timezone.utc).isoformat(),
        "configured": {
            "alpha_vantage": alpha_vantage_configured,
            "finnhub": finnhub_configured,
        },
        "ready": readiness,
    }

    return func.HttpResponse(
        json.dumps(payload),
        status_code=200 if overall_ready else 503,
        mimetype="application/json",
    )

@app.route(route="quote/{symbol}")
def get_stock_data_function(req: func.HttpRequest) -> func.HttpResponse:
    symbol = req.route_params.get('symbol')

    if not symbol:
        return func.HttpResponse(
            json.dumps({"error": "Please provide a stock symbol"}),
            status_code=400,
            mimetype="application/json"
        )

    logging.info(f"Processing quote request for: {symbol}")

    try:
        # Initialize Service (Lazy Initialization - only when needed)
        stock_service = StockService()

        # Execution
        quote_model = stock_service.get_quote(symbol)

        # Serialize Pydantic model to JSON
        return func.HttpResponse(
            quote_model.model_dump_json(),
            status_code=200,
            mimetype="application/json"
        )

    except ValueError as ve:
        # Client Error (Bad Input / Not Found)
        return func.HttpResponse(
            json.dumps({"error": str(ve)}),
            status_code=404,
            mimetype="application/json"
        )
    except Exception as e:
        # Server Error (System Failure)
        logging.error(f"Internal Error: {str(e)}")
        # Security: Generic 500 message to client, detailed error in logs
        return func.HttpResponse(
            json.dumps({"error": "Internal server error processing request"}),
            status_code=500,
            mimetype="application/json"
        )

@app.route(route="sma/{symbol}")
def get_sma_data_function(req: func.HttpRequest) -> func.HttpResponse:
    symbol = req.route_params.get('symbol')

    if not symbol:
        return func.HttpResponse(
            json.dumps({"error": "Please provide a stock symbol"}),
            status_code=400,
            mimetype="application/json"
        )

    logging.info(f"Processing SMA request for: {symbol}")

    try:
        stock_service = StockService()
        sma_data = stock_service.get_sma(symbol)

        return func.HttpResponse(
            json.dumps(sma_data),
            status_code=200,
            mimetype="application/json"
        )

    except ValueError as ve:
        return func.HttpResponse(
            json.dumps({"error": str(ve)}),
            status_code=404,
            mimetype="application/json"
        )
    except Exception as e:
        logging.error(f"SMA Error: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error processing SMA request"}),
            status_code=500,
            mimetype="application/json"
        )

@app.route(route="news/{symbol}")
def get_news_function(req: func.HttpRequest) -> func.HttpResponse:
    symbol = req.route_params.get('symbol')

    if not symbol:
        return func.HttpResponse(
            json.dumps({"error": "Please provide a stock symbol"}),
            status_code=400,
            mimetype="application/json"
        )

    logging.info(f"Processing news request for: {symbol}")

    try:
        # Initialize Service (Lazy Initialization)
        news_service = NewsService()

        # Fetch news articles (last 7 days by default)
        news_articles = news_service.get_company_news(symbol)

        return func.HttpResponse(
            json.dumps({"symbol": symbol.upper(), "articles": news_articles}),
            status_code=200,
            mimetype="application/json"
        )

    except ValueError as ve:
        # Client Error (Bad Input / Not Found)
        return func.HttpResponse(
            json.dumps({"error": str(ve)}),
            status_code=404,
            mimetype="application/json"
        )
    except Exception as e:
        # Server Error (System Failure)
        logging.error(f"News API Error: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": "Internal server error fetching news"}),
            status_code=500,
            mimetype="application/json"
        )

@app.route(route="history/{symbol}")
def get_stock_history_function(req: func.HttpRequest) -> func.HttpResponse:
    symbol = req.route_params.get('symbol')

    if not symbol:
        return func.HttpResponse(
             json.dumps({"error": "Please provide a stock symbol"}),
             status_code=400,
             mimetype="application/json"
        )

    logging.info(f"Processing History request for: {symbol}")

    try:
        stock_service = StockService()
        history_data = stock_service.get_full_chart_data(symbol)

        return func.HttpResponse(
            json.dumps(history_data),
            status_code=200,
            mimetype="application/json"
        )
    except Exception as e:
         logging.error(f"History Error: {str(e)}")
         return func.HttpResponse(
             json.dumps({"error": "Internal server error processing history request"}),
             status_code=500,
             mimetype="application/json"
         )
