import psutil
import asyncio
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.models.db_models import InferenceLog, Model


async def get_system_metrics() -> Dict[str, Any]:
    """Collect host system metrics."""
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    metrics = {
        "cpu_percent": cpu,
        "memory_percent": mem.percent,
        "memory_used_gb": round(mem.used / (1024 ** 3), 2),
        "memory_total_gb": round(mem.total / (1024 ** 3), 2),
        "disk_percent": disk.percent,
        "gpu_metrics": await get_gpu_metrics(),
        "timestamp": datetime.utcnow().isoformat(),
    }
    return metrics


async def get_gpu_metrics() -> Optional[List[Dict[str, Any]]]:
    """Try to collect GPU metrics via nvidia-smi or pynvml."""
    try:
        import subprocess
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            gpus = []
            for line in result.stdout.strip().split("\n"):
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 6:
                    gpus.append({
                        "index": int(parts[0]),
                        "name": parts[1],
                        "utilization_percent": float(parts[2]),
                        "memory_used_mb": float(parts[3]),
                        "memory_total_mb": float(parts[4]),
                        "temperature_c": float(parts[5]),
                    })
            return gpus if gpus else None
    except Exception:
        pass
    return None


async def get_model_metrics(db: AsyncSession, window_minutes: int = 5) -> List[Dict[str, Any]]:
    """Aggregate per-model request metrics over the last N minutes."""
    since = datetime.utcnow() - timedelta(minutes=window_minutes)

    result = await db.execute(
        select(
            InferenceLog.model_id,
            Model.name,
            func.count(InferenceLog.id).label("request_count"),
            func.avg(InferenceLog.latency_ms).label("avg_latency"),
            func.percentile_cont(0.95).within_group(
                InferenceLog.latency_ms
            ).label("p95_latency"),
            func.percentile_cont(0.99).within_group(
                InferenceLog.latency_ms
            ).label("p99_latency"),
            func.sum(InferenceLog.total_tokens).label("total_tokens"),
            func.sum(
                func.cast(InferenceLog.status != "success", int)
            ).label("error_count"),
        )
        .join(Model, InferenceLog.model_id == Model.id)
        .where(InferenceLog.created_at >= since)
        .group_by(InferenceLog.model_id, Model.name)
    )
    rows = result.all()

    metrics = []
    for row in rows:
        req_count = row.request_count or 0
        error_count = row.error_count or 0
        metrics.append({
            "model_id": str(row.model_id),
            "model_name": row.name,
            "requests_per_minute": round(req_count / window_minutes, 2),
            "avg_latency_ms": round(row.avg_latency or 0, 2),
            "p95_latency_ms": round(row.p95_latency or 0, 2),
            "p99_latency_ms": round(row.p99_latency or 0, 2),
            "total_tokens_per_minute": int((row.total_tokens or 0) / window_minutes),
            "error_rate": round(error_count / req_count if req_count > 0 else 0, 4),
        })
    return metrics


async def get_inference_history(
    db: AsyncSession,
    model_id: Optional[str] = None,
    hours: int = 24,
) -> List[Dict[str, Any]]:
    """Return hourly bucketed inference stats for charting."""
    since = datetime.utcnow() - timedelta(hours=hours)

    query = (
        select(
            func.date_trunc("hour", InferenceLog.created_at).label("bucket"),
            func.count(InferenceLog.id).label("count"),
            func.avg(InferenceLog.latency_ms).label("avg_latency"),
            func.sum(InferenceLog.total_tokens).label("total_tokens"),
        )
        .where(InferenceLog.created_at >= since)
        .group_by("bucket")
        .order_by("bucket")
    )

    if model_id:
        import uuid
        query = query.where(InferenceLog.model_id == uuid.UUID(model_id))

    result = await db.execute(query)
    return [
        {
            "bucket": row.bucket.isoformat(),
            "count": row.count,
            "avg_latency_ms": round(row.avg_latency or 0, 2),
            "total_tokens": row.total_tokens or 0,
        }
        for row in result.all()
    ]