from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.core.database import get_db
from app.models.db_models import ScalingPolicy, Model
from app.models.schemas import ScalingPolicyCreate, ScalingPolicyResponse
import uuid

router = APIRouter(prefix="/scaling", tags=["Autoscaling"])


@router.get("/", response_model=List[ScalingPolicyResponse])
async def list_policies(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScalingPolicy))
    return result.scalars().all()


@router.post("/", response_model=ScalingPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    payload: ScalingPolicyCreate, db: AsyncSession = Depends(get_db)
):
    # Verify model exists
    model_res = await db.execute(select(Model).where(Model.id == payload.model_id))
    if not model_res.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Model not found")

    # Check for existing policy
    existing = await db.execute(
        select(ScalingPolicy).where(ScalingPolicy.model_id == payload.model_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Policy already exists for this model")

    policy = ScalingPolicy(**payload.model_dump())
    db.add(policy)
    await db.commit()
    await db.refresh(policy)
    return policy


@router.patch("/{policy_id}", response_model=ScalingPolicyResponse)
async def update_policy(
    policy_id: uuid.UUID,
    payload: ScalingPolicyCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ScalingPolicy).where(ScalingPolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    for key, value in payload.model_dump().items():
        setattr(policy, key, value)

    await db.commit()
    await db.refresh(policy)
    return policy


@router.delete("/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_policy(policy_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ScalingPolicy).where(ScalingPolicy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    await db.delete(policy)
    await db.commit()