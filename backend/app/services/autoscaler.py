import asyncio
import logging
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.db_models import ScalingPolicy, Model, InferenceLog
from app.core.config import settings
from sqlalchemy import func

logger = logging.getLogger(__name__)

# Track last scale action time to enforce cooldown
_last_scale_action: dict = {}


async def evaluate_scaling_policies():
    """Run autoscaling evaluation loop."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ScalingPolicy, Model)
            .join(Model, ScalingPolicy.model_id == Model.id)
            .where(ScalingPolicy.is_active == True, Model.status == "running")
        )
        policies = result.all()

        for policy, model in policies:
            await evaluate_single_policy(db, policy, model)


async def evaluate_single_policy(db: AsyncSession, policy, model):
    """Evaluate one model's scaling policy."""
    now = datetime.utcnow()
    model_key = str(model.id)

    # Enforce cooldown
    last_action = _last_scale_action.get(model_key)
    if last_action and (now - last_action).seconds < policy.cooldown_seconds:
        return

    # Get avg latency over last 2 minutes
    since = now - timedelta(minutes=2)
    result = await db.execute(
        select(func.avg(InferenceLog.latency_ms))
        .where(
            InferenceLog.model_id == model.id,
            InferenceLog.created_at >= since,
            InferenceLog.status == "success",
        )
    )
    avg_latency = result.scalar() or 0

    # Get current replica count from model config
    replicas = model.config.get("replicas", 1)

    action = None

    # Scale up: high latency
    if avg_latency > policy.scale_up_latency_ms and replicas < policy.max_replicas:
        action = "scale_up"
        new_replicas = min(replicas + 1, policy.max_replicas)
    # Scale down: no load (zero recent requests indicates idle)
    elif avg_latency == 0 and replicas > policy.min_replicas:
        # Check if truly idle (no requests in last 5 mins)
        since5 = now - timedelta(minutes=5)
        r = await db.execute(
            select(func.count(InferenceLog.id))
            .where(
                InferenceLog.model_id == model.id,
                InferenceLog.created_at >= since5,
            )
        )
        count = r.scalar() or 0
        if count == 0:
            action = "scale_down"
            new_replicas = max(replicas - 1, policy.min_replicas)

    if action:
        logger.info(
            f"Autoscaler: {action} model={model.name} "
            f"replicas={replicas}->{new_replicas} avg_latency={avg_latency:.0f}ms"
        )
        # Update replica count in config
        config = dict(model.config)
        config["replicas"] = new_replicas
        model.config = config
        await db.commit()
        _last_scale_action[model_key] = now


async def run_autoscaler():
    """Background task that periodically evaluates policies."""
    logger.info(f"Autoscaler started (interval={settings.AUTOSCALER_INTERVAL}s)")
    while True:
        try:
            await evaluate_scaling_policies()
        except Exception as e:
            logger.error(f"Autoscaler error: {e}")
        await asyncio.sleep(settings.AUTOSCALER_INTERVAL)