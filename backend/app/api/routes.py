from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.models.db_models import Route, RouteTarget, Model
from app.models.schemas import RouteCreate, RouteResponse
import uuid

router = APIRouter(prefix="/routes", tags=["Routes"])


@router.get("/", response_model=List[RouteResponse])
async def list_routes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route).order_by(Route.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=RouteResponse, status_code=status.HTTP_201_CREATED)
async def create_route(payload: RouteCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Route).where(Route.name == payload.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Route '{payload.name}' already exists")

    route = Route(
        name=payload.name,
        path_prefix=payload.path_prefix,
        strategy=payload.strategy,
        config=payload.config,
    )
    db.add(route)
    await db.flush()

    for t in payload.targets:
        # Verify model exists
        model_res = await db.execute(select(Model).where(Model.id == t.model_id))
        if not model_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Model {t.model_id} not found")

        target = RouteTarget(route_id=route.id, model_id=t.model_id, weight=t.weight)
        db.add(target)

    await db.commit()
    await db.refresh(route)
    return route


@router.get("/{route_id}", response_model=RouteResponse)
async def get_route(route_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route).where(Route.id == route_id))
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    return route


@router.delete("/{route_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_route(route_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route).where(Route.id == route_id))
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    await db.delete(route)
    await db.commit()


@router.patch("/{route_id}/toggle", response_model=RouteResponse)
async def toggle_route(route_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Route).where(Route.id == route_id))
    route = result.scalar_one_or_none()
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    route.is_active = not route.is_active
    await db.commit()
    await db.refresh(route)
    return route