import azure.functions as func
import logging
import json
import os
from datetime import datetime, timezone
from services.stock_service import StockService
from services.news_service import NewsService
from services.watchlist_service import WatchlistService
from services.catalysts_service import CatalystsService
from services.auth_service import get_user_context_from_headers
from models import WatchlistCreateRequest, WatchlistUpdateRequest

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

    # Watchlists storage: Azure Tables requires a storage connection string.
    watchlists_storage_configured = bool(
        os.environ.get("AzureWebJobsStorage") or os.environ.get("AZURE_STORAGE_CONNECTION_STRING")
    )

    # Readiness is per-capability, plus an overall signal.
    readiness = {
        "quote": alpha_vantage_configured,
        "history": alpha_vantage_configured,
        "sma": alpha_vantage_configured,
        "news": finnhub_configured,
        "watchlists": watchlists_storage_configured,
    }

    overall_ready = all(readiness.values())

    payload = {
        "status": "ok" if overall_ready else "degraded",
        "utc_time": datetime.now(timezone.utc).isoformat(),
        "configured": {
            "alpha_vantage": alpha_vantage_configured,
            "finnhub": finnhub_configured,
            "watchlists_storage": watchlists_storage_configured,
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


@app.route(route="watchlists", methods=["GET", "POST"])
def watchlists(req: func.HttpRequest) -> func.HttpResponse:
    try:
        user = get_user_context_from_headers(dict(req.headers))
        if not user:
            return func.HttpResponse(
                json.dumps({"error": "Authentication required"}),
                status_code=401,
                mimetype="application/json",
            )

        service = WatchlistService()

        if req.method == "GET":
            summaries = service.list_watchlists(user_id=user.user_id)
            return func.HttpResponse(
                json.dumps([s.model_dump() for s in summaries]),
                status_code=200,
                mimetype="application/json",
            )

        # POST
        try:
            body = req.get_json()
        except ValueError:
            body = {}

        create_req = WatchlistCreateRequest.model_validate(body)

        watchlist = service.create_watchlist(
            user_id=user.user_id,
            name=create_req.name,
            symbols=create_req.symbols,
        )

        return func.HttpResponse(
            watchlist.model_dump_json(),
            status_code=201,
            mimetype="application/json",
        )

    except RuntimeError as re:
        # Typically raised for missing/unavailable storage configuration.
        logging.error("Watchlists runtime error: %s", str(re))
        return func.HttpResponse(
            json.dumps({"error": str(re)}),
            status_code=503,
            mimetype="application/json",
        )
    except ValueError as ve:
        return func.HttpResponse(
            json.dumps({"error": str(ve)}),
            status_code=400,
            mimetype="application/json",
        )
    except Exception as e:
        logging.error("Watchlists error: %s", str(e))
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json",
        )


@app.route(route="watchlists/{watchlist_id}", methods=["GET", "PUT", "DELETE"])
def watchlist_by_id(req: func.HttpRequest) -> func.HttpResponse:
    watchlist_id = req.route_params.get("watchlist_id")
    if not watchlist_id:
        return func.HttpResponse(
            json.dumps({"error": "watchlist_id is required"}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        user = get_user_context_from_headers(dict(req.headers))
        if not user:
            return func.HttpResponse(
                json.dumps({"error": "Authentication required"}),
                status_code=401,
                mimetype="application/json",
            )

        service = WatchlistService()

        if req.method == "GET":
            watchlist = service.get_watchlist(user_id=user.user_id, watchlist_id=watchlist_id)
            if not watchlist:
                return func.HttpResponse(
                    json.dumps({"error": "Watchlist not found"}),
                    status_code=404,
                    mimetype="application/json",
                )

            return func.HttpResponse(
                watchlist.model_dump_json(),
                status_code=200,
                mimetype="application/json",
            )

        if req.method == "DELETE":
            deleted = service.delete_watchlist(user_id=user.user_id, watchlist_id=watchlist_id)
            return func.HttpResponse(
                json.dumps({"deleted": deleted}),
                status_code=200,
                mimetype="application/json",
            )

        # PUT
        try:
            body = req.get_json()
        except ValueError:
            body = {}

        update_req = WatchlistUpdateRequest.model_validate(body)
        updated = service.update_watchlist(
            user_id=user.user_id,
            watchlist_id=watchlist_id,
            name=update_req.name,
            symbols=update_req.symbols,
        )

        if not updated:
            return func.HttpResponse(
                json.dumps({"error": "Watchlist not found"}),
                status_code=404,
                mimetype="application/json",
            )

        return func.HttpResponse(
            updated.model_dump_json(),
            status_code=200,
            mimetype="application/json",
        )

    except ValueError as ve:
        return func.HttpResponse(
            json.dumps({"error": str(ve)}),
            status_code=400,
            mimetype="application/json",
        )
    except Exception as e:
        logging.error("Watchlist by id error: %s", str(e))
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json",
        )


@app.route(route="catalysts", methods=["GET"])
def catalysts(req: func.HttpRequest) -> func.HttpResponse:
    watchlist_id = req.params.get("watchlistId")
    from_date = req.params.get("from")
    to_date = req.params.get("to")

    # watchlistId is now optional for "general market" view
    # if not watchlist_id: ...

    if not from_date or not to_date:
        return func.HttpResponse(
            json.dumps({"error": "from and to query params are required (YYYY-MM-DD)"}),
            status_code=400,
            mimetype="application/json",
        )

    try:
        # Check for user context, but do not enforce it strict blocking if not present
        # However, if watchlist_id IS provided, we probably need a user to fetch it (unless we support public watchlists later)
        user = get_user_context_from_headers(dict(req.headers))

        # If user requests a specific watchlist, they MUST be logged in.
        if watchlist_id and not user:
             return func.HttpResponse(
                json.dumps({"error": "Authentication required to view specific watchlist events"}),
                status_code=401,
                mimetype="application/json",
            )

        user_id = user.user_id if user else None

        service = CatalystsService()
        response_model = service.get_catalysts(
            user_id=user_id,
            watchlist_id=watchlist_id,
            from_date=from_date,
            to_date=to_date,
        )

        return func.HttpResponse(
            response_model.model_dump_json(),
            status_code=200,
            mimetype="application/json",
        )

    except ValueError as ve:
        return func.HttpResponse(
            json.dumps({"error": str(ve)}),
            status_code=404,
            mimetype="application/json",
        )
    except Exception as e:
        logging.error("Catalysts error: %s", str(e))
        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json",
        )
