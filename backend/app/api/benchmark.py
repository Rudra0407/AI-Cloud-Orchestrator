from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.schemas import BenchmarkRequest, BenchmarkResult
from app.models.db_models import Model
from app.services.benchmark_service import run_benchmark

router = APIRouter(prefix="/benchmark", tags=["Benchmark"])


@router.post("/run", response_model=BenchmarkResult)
async def benchmark(payload: BenchmarkRequest, db: AsyncSession = Depends(get_db)):
    """Run an inference benchmark. model_name can be the model name or tag."""
    # Resolve model name → Ollama tag
    result = await db.execute(
        select(Model).where(Model.name == payload.model_name)
    )
    model_record = result.scalar_one_or_none()

    if model_record:
        # Use the actual Ollama model tag
        payload = BenchmarkRequest(
            model_name=model_record.model_tag,
            prompt=payload.prompt,
            num_requests=payload.num_requests,
            concurrency=payload.concurrency,
        )

    try:
        return await run_benchmark(payload)
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))