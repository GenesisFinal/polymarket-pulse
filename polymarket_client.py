import time
import json
import logging
from typing import List, Dict, Any, Optional
from curl_cffi import requests
from curl_cffi.curl import CurlOpt

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("polymarket_client")

DOH_URL = "https://1.1.1.1/dns-query"
GAMMA_API_BASE = "https://gamma-api.polymarket.com"
CLOB_API_BASE = "https://clob.polymarket.com"

# In-memory cache
_CACHE: Dict[str, Any] = {}
_CACHE_TTL = 20  # seconds

import re

# Keywords for categorization with word boundary checking
CATEGORY_KEYWORDS = {
    "argentina": [
        r"argentina\w*", r"milei", r"buenos aires", r"indec", r"peso argentino",
        r"cepo", r"kirchner\w*", r"peronis\w*", r"boca juniors?", r"river plate", r"scaloni",
        r"casa rosada", r"bullrich", r"caputo"
    ],
    "deportes": [
        r"nfl", r"football", r"soccer", r"champions league", r"premier league", r"la liga",
        r"world cup", r"copa america", r"copa libertadores", r"nba", r"tennis",
        r"grand slam", r"formula 1", r"f1", r"super bowl", r"messi", r"ronaldo",
        r"panthers", r"broncos", r"49ers", r"cowboys", r"texans", r"eagles", r"rams",
        r"vs\.?", r"versus", r"fifa", r"uefa", r"touchdown", r"ufc"
    ],
    "cripto": [
        r"bitcoin", r"btc", r"ethereum", r"eth", r"solana", r"sol", r"crypto\w*",
        r"etf", r"binance", r"coinbase", r"tether", r"stablecoin", r"halving",
        r"doge\w*", r"memecoin", r"cardano", r"ripple", r"xrp", r"blockchain"
    ],
    "ia-tech": [
        r"ai\b", r"artificial intelligence", r"openai", r"chatgpt", r"gpt-?5?", r"gpt-?4o?",
        r"claude", r"anthropic", r"gemini", r"deepseek", r"meta ai",
        r"nvidia", r"spacex", r"starship", r"apple", r"tesla", r"robot\w*", r"quantum\w*",
        r"agi\b", r"altman", r"tsmc", r"semiconductor\w*"
    ],
    "macro": [
        r"fed\b", r"interest rate\w*", r"rate cut\w*", r"rate hike\w*", r"inflation", r"cpi\b", r"gdp\b",
        r"recession\w*", r"treasury\w*", r"s&p\s*500", r"nasdaq", r"dow jones", r"ipo\b", r"unemployment",
        r"central bank\w*", r"powell", r"oil price\w*", r"gold\b", r"tariffs?", r"debt ceiling"
    ],
    "politica": [
        r"election\w*", r"president\w*", r"senate", r"congress\w*", r"parliament\w*", r"vote\w*",
        r"prime minister", r"cabinet", r"democrat\w*", r"republican\w*", r"trump", r"biden",
        r"starmer", r"macron", r"modi", r"labor", r"labour", r"impeach\w*", r"governor",
        r"supreme court", r"putin", r"zelensky", r"nato", r"ceasefire", r"war\b", r"sanction\w*"
    ]
}

# Compile category regexes
COMPILED_PATTERNS = {
    cat: re.compile(r"\b(" + "|".join(keywords) + r")\b", re.IGNORECASE)
    for cat, keywords in CATEGORY_KEYWORDS.items()
}


def _fetch_with_doh(url: str, params: Optional[dict] = None) -> Any:
    """Execute GET request using Cloudflare DoH to bypass local ISP DNS blocking."""
    cache_key = f"{url}?{json.dumps(params, sort_keys=True) if params else ''}"
    now = time.time()
    
    if cache_key in _CACHE:
        cached_data, timestamp = _CACHE[cache_key]
        if now - timestamp < _CACHE_TTL:
            return cached_data

    logger.info(f"Fetching from Polymarket: {url}")
    response = requests.get(
        url,
        params=params,
        curl_options={CurlOpt.DOH_URL: DOH_URL},
        timeout=12
    )
    response.raise_for_status()
    data = response.json()
    
    _CACHE[cache_key] = (data, now)
    return data


def assign_category(event: dict) -> str:
    """Categorize an event based on title, description, and tags."""
    title = (event.get("title") or "")
    description = (event.get("description") or "")
    tags = " ".join([t.get("label", "") if isinstance(t, dict) else str(t) for t in event.get("tags", [])])
    full_text = f"{title} {description} {tags}"

    # Check Argentina first to give it prominence
    if COMPILED_PATTERNS["argentina"].search(full_text):
        return "argentina"

    # Check sports before others if clearly a sporting match
    if COMPILED_PATTERNS["deportes"].search(title):
        return "deportes"

    # Check other categories in order
    for cat in ["ia-tech", "cripto", "macro", "politica", "deportes"]:
        if COMPILED_PATTERNS[cat].search(full_text):
            return cat

    return "general"


def normalize_event(raw_event: dict) -> dict:
    """Normalize raw Gamma API event into clean structure for the frontend."""
    markets_raw = raw_event.get("markets", [])
    normalized_markets = []

    for m in markets_raw:
        # Parse outcomes and prices
        outcomes_raw = m.get("outcomes", "[]")
        prices_raw = m.get("outcomePrices", "[]")
        tokens_raw = m.get("clobTokenIds", "[]")

        try:
            outcomes = json.loads(outcomes_raw) if isinstance(outcomes_raw, str) else (outcomes_raw or [])
        except Exception:
            outcomes = ["Sí", "No"]

        try:
            prices = json.loads(prices_raw) if isinstance(prices_raw, str) else (prices_raw or [])
        except Exception:
            prices = ["0.5", "0.5"]

        try:
            tokens = json.loads(tokens_raw) if isinstance(tokens_raw, str) else (tokens_raw or [])
        except Exception:
            tokens = []

        # Build clean outcomes list
        outcome_items = []
        for i, outcome_name in enumerate(outcomes):
            price_val = float(prices[i]) if i < len(prices) and prices[i] is not None else 0.0
            prob_percent = round(price_val * 100, 1)
            token_id = tokens[i] if i < len(tokens) else None

            outcome_items.append({
                "name": outcome_name,
                "price": price_val,
                "probability": prob_percent,
                "tokenId": token_id
            })

        normalized_markets.append({
            "id": m.get("id"),
            "question": m.get("question"),
            "conditionId": m.get("conditionId"),
            "slug": m.get("slug"),
            "description": m.get("description"),
            "volume": float(m.get("volume", 0) or 0),
            "liquidity": float(m.get("liquidity", 0) or 0),
            "outcomes": outcome_items,
            "closed": bool(m.get("closed", False)),
            "active": bool(m.get("active", True)),
            "endDate": m.get("endDate"),
            "oneDayPriceChange": float(m.get("oneDayPriceChange", 0) or 0)
        })

    volume_24h = float(raw_event.get("volume24hr", 0) or 0)
    total_volume = float(raw_event.get("volume", 0) or 0)
    liquidity = float(raw_event.get("liquidity", 0) or 0)

    category = assign_category(raw_event)

    return {
        "id": raw_event.get("id"),
        "title": raw_event.get("title"),
        "slug": raw_event.get("slug"),
        "category": category,
        "image": raw_event.get("image") or raw_event.get("icon"),
        "volume24hr": volume_24h,
        "volume": total_volume,
        "liquidity": liquidity,
        "startDate": raw_event.get("startDate"),
        "endDate": raw_event.get("endDate"),
        "markets": normalized_markets,
        "featured": bool(raw_event.get("featured", False))
    }


def get_events(limit: int = 100, category: Optional[str] = None, search: Optional[str] = None) -> List[dict]:
    """Retrieve and filter active events from Gamma API."""
    params = {
        "limit": min(limit, 120),
        "active": "true",
        "closed": "false",
        "order": "volume24hr",
        "ascending": "false"
    }

    raw_events = _fetch_with_doh(f"{GAMMA_API_BASE}/events", params=params)
    
    # Also fetch top overall volume events to capture broad markets
    try:
        top_vol_events = _fetch_with_doh(f"{GAMMA_API_BASE}/events", params={
            "limit": 40,
            "active": "true",
            "closed": "false",
            "order": "volume",
            "ascending": "false"
        })
        # Deduplicate
        existing_ids = {e.get("id") for e in raw_events}
        for e in top_vol_events:
            if e.get("id") not in existing_ids:
                raw_events.append(e)
                existing_ids.add(e.get("id"))
    except Exception as e:
        logger.warning(f"Could not fetch supplementary top volume events: {e}")

    # Normalize events
    normalized = []
    for ev in raw_events:
        try:
            norm = normalize_event(ev)
            # Only include if it has at least one market
            if norm["markets"]:
                normalized.append(norm)
        except Exception as ex:
            logger.debug(f"Failed to normalize event: {ex}")

    # Category filter
    if category and category != "all" and category != "trending":
        normalized = [e for e in normalized if e["category"] == category]

    # Search filter
    if search:
        s = search.lower().strip()
        filtered = []
        for e in normalized:
            title = (e.get("title") or "").lower()
            markets_text = " ".join([m.get("question", "") for m in e.get("markets", [])]).lower()
            if s in title or s in markets_text or s in e.get("category", ""):
                filtered.append(e)
        normalized = filtered

    return normalized


def get_price_history(token_id: str, interval: str = "all") -> List[dict]:
    """
    Fetch price history for a given outcome token from CLOB API.
    interval: '1d', '1w', '1m', 'all'
    """
    fidelity_map = {
        "1d": 5,
        "1w": 60,
        "1m": 60,
        "all": 60
    }
    fidelity = fidelity_map.get(interval, 60)
    
    params = {
        "interval": interval,
        "market": token_id,
        "fidelity": fidelity
    }

    try:
        data = _fetch_with_doh(f"{CLOB_API_BASE}/prices-history", params=params)
        raw_history = data.get("history", []) if isinstance(data, dict) else []
        
        # Clean history items: convert price to percentage and timestamp to milliseconds
        clean_history = []
        for pt in raw_history:
            t = pt.get("t")
            p = pt.get("p")
            if t is not None and p is not None:
                clean_history.append({
                    "time": t * 1000 if t < 10000000000 else t, # ensure ms
                    "probability": round(float(p) * 100, 2),
                    "price": float(p)
                })
        return clean_history
    except Exception as e:
        logger.error(f"Error fetching price history for token {token_id}: {e}")
        return []


def get_categories_summary() -> List[dict]:
    """Get category list with current icons and titles."""
    return [
        {"id": "all", "name": "Todos", "icon": "Globe"},
        {"id": "trending", "name": "Trending", "icon": "Flame"},
        {"id": "argentina", "name": "Argentina", "icon": "Landmark"},
        {"id": "macro", "name": "Macroeconomía", "icon": "TrendingUp"},
        {"id": "politica", "name": "Política", "icon": "Vote"},
        {"id": "cripto", "name": "Cripto", "icon": "Coins"},
        {"id": "ia-tech", "name": "IA & Tech", "icon": "Cpu"},
        {"id": "deportes", "name": "Deportes", "icon": "Trophy"},
        {"id": "watchlist", "name": "Favoritos", "icon": "Star"}
    ]
