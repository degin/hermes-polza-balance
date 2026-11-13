"""Баланс Polza.ai для статус-бара. Вер. 1.1.

GET /api/plugins/polza-balance/balance[?refresh=1] -> {amount, available, reserved, updated_at}
Ключ POLZA_API_KEY читается через agent.secret_scope.get_secret и наружу не отдаётся.
"""

import json
import threading
import time
import urllib.error
import urllib.request

from agent.secret_scope import get_secret
from fastapi import APIRouter

router = APIRouter()

KEY_ENV = "POLZA_API_KEY"
URL = "https://polza.ai/api/v2/balance"
CACHE_TTL = 60

_lock = threading.Lock()
_cache = {"ts": 0.0, "data": None}


def _api_key() -> str:
    return (get_secret(KEY_ENV, "") or "").strip()


def _num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _fetch() -> dict:
    key = _api_key()
    if not key:
        return {"error": "no_key"}
    req = urllib.request.Request(URL, headers={"Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        return {"error": f"http_{exc.code}"}
    except (urllib.error.URLError, TimeoutError, ValueError):
        return {"error": "network"}
    amount = _num(body.get("amount"))
    if amount is None:
        return {"error": "bad_response"}
    return {
        "amount": amount,
        "available": _num(body.get("available")),
        "reserved": _num(body.get("reservedAmount")),
        "updated_at": body.get("updatedAt"),
    }


@router.get("/balance")
def balance(refresh: int = 0):
    with _lock:
        now = time.time()
        if refresh or _cache["data"] is None or now - _cache["ts"] > CACHE_TTL:
            data = _fetch()
            if "error" in data and _cache["data"] and "error" not in _cache["data"]:
                data = {**_cache["data"], "stale": True}
            _cache.update(ts=now, data=data)
        return _cache["data"]
