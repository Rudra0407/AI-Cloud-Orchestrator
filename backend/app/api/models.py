from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from app.core.database import get_db
from app.models.db_models import Model
from app.models.schemas import ModelCreate, ModelUpdate, ModelResponse
from app.services.docker_service import (
    start_model_container,
    stop_model_container,
    get_container_stats,
)
import uuid

router = APIRouter(prefix="/models", tags=["Models"])


@router.get("/", response_model=List[ModelResponse])
async def list_models(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Model).order_by(Model.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=ModelResponse, status_code=status.HTTP_201_CREATED)
async def create_model(payload: ModelCreate, db: AsyncSession = Depends(get_db)):
    # Check for name conflict
    existing = await db.execute(select(Model).where(Model.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Model '{payload.name}' already exists")

    model = Model(
        name=payload.name,
        display_name=payload.display_name or payload.name,
        model_tag=payload.model_tag,
        config=payload.config,
        resource_limits=payload.resource_limits,
        status="stopped",
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return model


@router.get("/{model_id}", response_model=ModelResponse)
async def get_model(model_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.patch("/{model_id}", response_model=ModelResponse)
async def update_model(
    model_id: uuid.UUID, payload: ModelUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if payload.display_name is not None:
        model.display_name = payload.display_name
    if payload.config is not None:
        model.config = payload.config
    if payload.resource_limits is not None:
        model.resource_limits = payload.resource_limits

    await db.commit()
    await db.refresh(model)
    return model


@router.delete("/{model_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_model(model_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if model.status == "running" and model.container_id:
        await stop_model_container(model.container_id)

    await db.delete(model)
    await db.commit()


@router.post("/{model_id}/start", response_model=ModelResponse)
async def start_model(model_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if model.status == "running":
        raise HTTPException(status_code=400, detail="Model is already running")

    model.status = "pulling"
    await db.commit()

    try:
        info = await start_model_container(model.name, model.model_tag, model.resource_limits)
        model.container_id = info["container_id"]
        model.port = info["port"]
        model.status = "running"
    except Exception as e:
        model.status = "error"
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))

    await db.commit()
    await db.refresh(model)
    return model


@router.post("/{model_id}/stop", response_model=ModelResponse)
async def stop_model(model_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if model.container_id:
        await stop_model_container(model.container_id)

    model.status = "stopped"
    model.container_id = None
    await db.commit()
    await db.refresh(model)
    return model


@router.get("/{model_id}/stats")
async def get_model_stats(model_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Model).where(Model.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    if not model.container_id:
        return {"error": "Model not running"}

    stats = await get_container_stats(model.container_id)
    return stats or {"error": "Stats unavailable"}