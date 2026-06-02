import asyncio
import json
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.metrics_service import (
    get_system_metrics,
    get_model_metrics,
    get_inference_history,
)

router = APIRouter(prefix="/metrics", tags=["Metrics"])


@router.get("/system")
async def system_metrics():
    return await get_system_metrics()


@router.get("/models")
async def model_metrics(db: AsyncSession = Depends(get_db)):
    return await get_model_metrics(db)


@router.get("/history")
async def inference_history(
    model_id: str = None,
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
):
    return await get_inference_history(db, model_id, hours)


@router.websocket("/ws")
async def metrics_websocket(websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    """
    WebSocket endpoint for real-time metrics streaming.
    Pushes system + model metrics every 3 seconds.
    """
    await websocket.accept()
    try:
        while True:
            system = await get_system_metrics()
            models = await get_model_metrics(db)
            await websocket.send_json({
                "type": "metrics",
                "system": system,
                "models": models,
            })
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass