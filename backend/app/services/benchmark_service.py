import asyncio
import time
import statistics
from typing import List, Dict, Any
from app.models.schemas import BenchmarkRequest, BenchmarkResult, ChatMessage, InferenceRequest
from app.services.inference_service import call_ollama


async def run_benchmark(request: BenchmarkRequest) -> BenchmarkResult:
    """Run concurrent inference benchmark against a model."""
    prompt_msg = [ChatMessage(role="user", content=request.prompt)]
    inf_req = InferenceRequest(
        model=request.model_name,
        messages=prompt_msg,
        max_tokens=200,
        temperature=0.0,
    )

    latencies: List[float] = []
    errors = 0
    total_tokens = 0
    start_all = time.monotonic()

    # Run in batches of `concurrency`
    semaphore = asyncio.Semaphore(request.concurrency)

    async def single_request():
        nonlocal errors, total_tokens
        async with semaphore:
            try:
                result = await call_ollama(request.model_name, inf_req)
                latencies.append(result["latency_ms"])
                total_tokens += result["eval_count"] + result["prompt_eval_count"]
            except Exception as e:
                import traceback
                traceback.print_exc()  # add this line
                errors += 1

    tasks = [single_request() for _ in range(request.num_requests)]
    await asyncio.gather(*tasks)

    total_time = time.monotonic() - start_all

    if latencies:
        sorted_latencies = sorted(latencies)
        n = len(sorted_latencies)
        p50 = sorted_latencies[int(n * 0.5)]
        p95 = sorted_latencies[int(n * 0.95)]
        p99 = sorted_latencies[min(int(n * 0.99), n - 1)]
        avg = statistics.mean(latencies)
        tps = total_tokens / total_time if total_time > 0 else 0
    else:
        p50 = p95 = p99 = avg = tps = 0.0

    return BenchmarkResult(
        model_name=request.model_name,
        num_requests=request.num_requests,
        concurrency=request.concurrency,
        total_time_s=round(total_time, 3),
        avg_latency_ms=round(avg, 2),
        p50_latency_ms=round(p50, 2),
        p95_latency_ms=round(p95, 2),
        p99_latency_ms=round(p99, 2),
        tokens_per_second=round(tps, 2),
        successful_requests=len(latencies),
        failed_requests=errors,
    )