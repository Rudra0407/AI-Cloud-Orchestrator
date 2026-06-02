import httpx
import asyncio
import time
import random
from typing import List, Optional, Dict, Any, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.db_models import Route, RouteTarget, Model, InferenceLog
from app.models.schemas import InferenceRequest
from app.core.config import settings
import uuid

# Round-robin state per route
_rr_counters: Dict[str, int] = {}
# Latency tracking per model
_latency_ema: Dict[str, float] = {}  # exponential moving average


async def get_route_model(
    db: AsyncSession,
    route_name: str
) -> Optional[Model]:
    """Select a model using the route's load balancing strategy."""
    result = await db.execute(
        select(Route).where(Route.name == route_name, Route.is_active == True)
    )
    route = result.scalar_one_or_none()
    if not route:
        return None

    # Get active targets with their models
    result = await db.execute(
        select(RouteTarget, Model)
        .join(Model, RouteTarget.model_id == Model.id)
        .where(
            RouteTarget.route_id == route.id,
            RouteTarget.is_active == True,
            Model.status == "running",
        )
    )
    targets = result.all()

    if not targets:
        return None

    if route.strategy == "round_robin":
        idx = _rr_counters.get(str(route.id), 0)
        target, model = targets[idx % len(targets)]
        _rr_counters[str(route.id)] = idx + 1
        return model

    elif route.strategy == "weighted":
        weights = [t.weight for t, m in targets]
        target, model = random.choices(targets, weights=weights, k=1)[0]
        return model

    elif route.strategy == "least_latency":
        best = min(
            targets,
            key=lambda tm: _latency_ema.get(str(tm[1].id), float("inf")),
        )
        return best[1]

    # Fallback: random
    return random.choice(targets)[1]


async def call_ollama(
    model_tag: str,
    request: InferenceRequest,
    ollama_url: str = None,
) -> Dict[str, Any]:
    """Send inference request to Ollama API."""
    base_url = ollama_url or settings.OLLAMA_URL
    start = time.monotonic()

    payload = {
        "model": model_tag,
        "messages": [m.model_dump() for m in request.messages],
        "stream": False,
        "options": {
            "temperature": request.temperature,
            "num_predict": request.max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(f"{base_url}/api/chat", json=payload)
        response.raise_for_status()
        data = response.json()

    latency_ms = (time.monotonic() - start) * 1000

    return {
        "content": data["message"]["content"],
        "role": data["message"]["role"],
        "prompt_eval_count": data.get("prompt_eval_count", 0),
        "eval_count": data.get("eval_count", 0),
        "latency_ms": latency_ms,
    }


async def call_ollama_stream(
    model_tag: str,
    request: InferenceRequest,
    ollama_url: str = None,
) -> AsyncGenerator[str, None]:
    """Stream inference from Ollama."""
    import json
    base_url = ollama_url or settings.OLLAMA_URL

    payload = {
        "model": model_tag,
        "messages": [m.model_dump() for m in request.messages],
        "stream": True,
        "options": {
            "temperature": request.temperature,
            "num_predict": request.max_tokens,
        },
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream("POST", f"{base_url}/api/chat", json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line:
                    try:
                        chunk = json.loads(line)
                        if chunk.get("message", {}).get("content"):
                            yield chunk["message"]["content"]
                        if chunk.get("done"):
                            break
                    except Exception:
                        continue


async def log_inference(
    db: AsyncSession,
    model_id: str,
    route_id: Optional[str],
    prompt_tokens: int,
    completion_tokens: int,
    latency_ms: float,
    status: str,
    error: Optional[str] = None,
):
    """Log an inference request to the database."""
    log = InferenceLog(
        model_id=uuid.UUID(model_id) if model_id else None,
        route_id=uuid.UUID(route_id) if route_id else None,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=prompt_tokens + completion_tokens,
        latency_ms=latency_ms,
        status=status,
        error=error,
    )
    db.add(log)
    await db.commit()

    # Update latency EMA
    if model_id and status == "success":
        prev = _latency_ema.get(model_id, latency_ms)
        _latency_ema[model_id] = 0.8 * prev + 0.2 * latency_ms