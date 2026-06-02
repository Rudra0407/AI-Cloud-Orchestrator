from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.db_models import Model
from app.models.schemas import InferenceRequest, InferenceResponse, ChatMessage
from app.services.inference_service import (
    call_ollama,
    call_ollama_stream,
    log_inference,
    get_route_model,
)
import uuid
import json

router = APIRouter(prefix="/inference", tags=["Inference"])


@router.post("/chat", response_model=InferenceResponse)
async def chat(payload: InferenceRequest, db: AsyncSession = Depends(get_db)):
    """
    Chat endpoint. `model` can be:
    - A model name (e.g. "my-llama")
    - A route name (e.g. "production-route")
    """
    # Try to resolve as a route first
    model_record = await get_route_model(db, payload.model)

    # Fall back to direct model lookup by name
    if not model_record:
        result = await db.execute(
            select(Model).where(Model.name == payload.model, Model.status == "running")
        )
        model_record = result.scalar_one_or_none()

    if not model_record:
        raise HTTPException(
            status_code=404,
            detail=f"Model or route '{payload.model}' not found or not running",
        )

    try:
        result = await call_ollama(model_record.model_tag, payload)
        await log_inference(
            db,
            str(model_record.id),
            None,
            result["prompt_eval_count"],
            result["eval_count"],
            result["latency_ms"],
            "success",
        )
        return InferenceResponse(
            id=str(uuid.uuid4()),
            model=model_record.model_tag,
            message=ChatMessage(role=result["role"], content=result["content"]),
            prompt_tokens=result["prompt_eval_count"],
            completion_tokens=result["eval_count"],
            total_tokens=result["prompt_eval_count"] + result["eval_count"],
            latency_ms=result["latency_ms"],
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        await log_inference(db, str(model_record.id), None, 0, 0, 0, "error", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/stream")
async def chat_stream(payload: InferenceRequest, db: AsyncSession = Depends(get_db)):
    """Streaming chat endpoint (SSE)."""
    model_record = await get_route_model(db, payload.model)

    if not model_record:
        result = await db.execute(
            select(Model).where(Model.name == payload.model, Model.status == "running")
        )
        model_record = result.scalar_one_or_none()

    if not model_record:
        raise HTTPException(status_code=404, detail=f"Model '{payload.model}' not found")

    async def generate():
        try:
            async for chunk in call_ollama_stream(model_record.model_tag, payload):
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")