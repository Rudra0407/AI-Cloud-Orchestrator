import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    DateTime, ForeignKey, Text
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base


class Model(Base):
    __tablename__ = "models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    display_name = Column(String(255))
    model_tag = Column(String(255), nullable=False)
    container_id = Column(String(255))
    status = Column(String(50), default="stopped")
    port = Column(Integer)
    config = Column(JSONB, default={})
    resource_limits = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    scaling_policy = relationship("ScalingPolicy", back_populates="model", uselist=False)
    route_targets = relationship("RouteTarget", back_populates="model")


class Route(Base):
    __tablename__ = "routes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    path_prefix = Column(String(255), nullable=False)
    strategy = Column(String(50), default="round_robin")
    config = Column(JSONB, default={})
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    targets = relationship("RouteTarget", back_populates="route", cascade="all, delete-orphan")


class RouteTarget(Base):
    __tablename__ = "route_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id", ondelete="CASCADE"))
    model_id = Column(UUID(as_uuid=True), ForeignKey("models.id", ondelete="CASCADE"))
    weight = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    route = relationship("Route", back_populates="targets")
    model = relationship("Model", back_populates="route_targets")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    key_hash = Column(String(255), nullable=False, unique=True)
    name = Column(String(255))
    rate_limit_rpm = Column(Integer, default=60)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_used_at = Column(DateTime(timezone=True))


class InferenceLog(Base):
    __tablename__ = "inference_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("models.id"))
    route_id = Column(UUID(as_uuid=True), ForeignKey("routes.id"))
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    total_tokens = Column(Integer)
    latency_ms = Column(Float)
    status = Column(String(50))
    error = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class ScalingPolicy(Base):
    __tablename__ = "scaling_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("models.id", ondelete="CASCADE"), unique=True)
    min_replicas = Column(Integer, default=1)
    max_replicas = Column(Integer, default=5)
    scale_up_cpu_threshold = Column(Float, default=80.0)
    scale_down_cpu_threshold = Column(Float, default=20.0)
    scale_up_latency_ms = Column(Float, default=2000.0)
    cooldown_seconds = Column(Integer, default=60)
    is_active = Column(Boolean, default=True)

    model = relationship("Model", back_populates="scaling_policy")