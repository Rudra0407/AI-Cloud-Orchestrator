import time
from fastapi import Request, HTTPException
from app.core.redis import redis_client


async def check_rate_limit(request: Request, rpm: int = 60):
    """Sliding window rate limiter using Redis sorted sets."""
    # Use IP as identifier if no API key
    api_key = request.headers.get("X-API-Key", "")
    identifier = f"rl:{api_key or request.client.host}"

    now = time.time()
    window_start = now - 60  # 1 minute window

    pipe = redis_client.pipeline()
    pipe.zremrangebyscore(identifier, "-inf", window_start)
    pipe.zadd(identifier, {str(now): now})
    pipe.zcard(identifier)
    pipe.expire(identifier, 120)
    results = await pipe.execute()

    request_count = results[2]

    if request_count > rpm:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "limit": rpm,
                "window": "60s",
                "retry_after": 60,
            },
        )

    # Add rate limit headers
    request.state.rate_limit_remaining = max(0, rpm - request_count)
    return request_count