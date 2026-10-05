import os
import time
from typing import Optional
from fastapi import FastAPI, Query, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import polymarket_client as pm

START_TIME = time.time()

app = FastAPI(
    title="Polymarket Observer",
    description="Portal de estadísticas, probabilidades e historial de Polymarket en tiempo real.",
    version="1.0.0"
)

# Enable CORS for local dev / remote access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")


@app.get("/api/status")
async def get_status():
    """Verify system health, DoH status, and cached events."""
    return {
        "status": "online",
        "doh_resolver": pm.DOH_URL,
        "uptime_seconds": int(time.time() - START_TIME),
        "cached_keys": len(pm._CACHE)
    }


@app.get("/api/categories")
async def get_categories():
    """Return all available navigation categories."""
    return pm.get_categories_summary()


@app.get("/api/events")
async def list_events(
    category: Optional[str] = Query("all", description="Category filter (trending, argentina, macro, politica, cripto, ia-tech, deportes, all)"),
    search: Optional[str] = Query(None, description="Search keyword"),
    limit: Optional[int] = Query(60, ge=1, le=150, description="Max events to return"),
    sort_by: Optional[str] = Query("volume24hr", description="Sort by: volume24hr, volume, liquidity")
):
    """Fetch active markets filtered by category and search keyword."""
    try:
        events = pm.get_events(limit=limit, category=category, search=search)
        
        # Apply sorting
        if sort_by == "volume":
            events.sort(key=lambda x: x.get("volume", 0), reverse=True)
        elif sort_by == "liquidity":
            events.sort(key=lambda x: x.get("liquidity", 0), reverse=True)
        else: # default volume24hr
            events.sort(key=lambda x: x.get("volume24hr", 0), reverse=True)

        return {
            "category": category,
            "search": search,
            "total": len(events),
            "events": events
        }
    except Exception as e:
        pm.logger.error(f"Error fetching events: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/history")
async def get_history(
    token_id: str = Query(..., description="Outcome CLOB token ID"),
    interval: Optional[str] = Query("all", description="Time interval: 1d, 1w, 1m, all")
):
    """Fetch historical probability line data for an outcome."""
    if not token_id:
        raise HTTPException(status_code=400, detail="token_id is required")
    try:
        history = pm.get_price_history(token_id=token_id, interval=interval)
        return {
            "token_id": token_id,
            "interval": interval,
            "points": history
        }
    except Exception as e:
        pm.logger.error(f"Error fetching history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Serve static assets
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return JSONResponse({"message": "Frontend static files not yet initialized."})
