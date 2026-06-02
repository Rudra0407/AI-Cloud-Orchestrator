from fastapi import APIRouter, HTTPException
from app.models.schemas import BenchmarkRequest, BenchmarkResult
from app.services.benchmark_service import run_benchmark

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])


@router.post("/run", response_model=BenchmarkResult)
async def benchmark(payload: BenchmarkRequest):
    """Run an inference benchmark against a deployed model."""
    try:
        return await run_benchmark(payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))