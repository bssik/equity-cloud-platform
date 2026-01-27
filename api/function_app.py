import azure.functions as func
import logging
import json
from services.stock_service import StockService
from services.news_service import NewsService

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)

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
        history_data = stock_service.get_daily_prices(symbol)

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
