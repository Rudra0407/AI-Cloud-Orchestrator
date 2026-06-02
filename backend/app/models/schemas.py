from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid


# ─── Model Schemas ───────────────────────────────────────

class ModelCreate(BaseModel):
    name: str
    display_name: Optional[str] = None
    model_tag: str                          # e.g. "llama3:8b"
    config: Dict[str, Any] = {}
    resource_limits: Dict[str, Any] = {}   # {"cpu": "2", "memory": "4g"}


class ModelUpdate(BaseModel):
    display_name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    resource_limits: Optional[Dict[str, Any]] = None


class ModelResponse(BaseModel):
    id: uuid.UUID
    name: str
    display_name: Optional[str]
    model_tag: str
    container_id: Optional[str]
    status: str
    port: Optional[int]
    config: Dict[str, Any]
    resource_limits: Dict[str, Any]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ─── Route Schemas ───────────────────────────────────────

class RouteTargetCreate(BaseModel):
    model_id: uuid.UUID
    weight: int = Field(default=1, ge=1, le=100)


class RouteCreate(BaseModel):
    name: str
    path_prefix: str
    strategy: str = "round_robin"          # round_robin | weighted | least_latency
    targets: List[RouteTargetCreate] = []
    config: Dict[str, Any] = {}


class RouteTargetResponse(BaseModel):
    id: uuid.UUID
    model_id: uuid.UUID
    weight: int
    is_active: bool

    class Config:
        from_attributes = True


class RouteResponse(BaseModel):
    id: uuid.UUID
    name: str
    path_prefix: str
    strategy: str
    is_active: bool
    targets: List[RouteTargetResponse]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Inference Schemas ───────────────────────────────────

class ChatMessage(BaseModel):
    role: str                               # user | assistant | system
    content: str


class InferenceRequest(BaseModel):
    model: str                              # model name or route path
    messages: List[ChatMessage]
    max_tokens: int = 512
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    stream: bool = False


class InferenceResponse(BaseModel):
    id: str
    model: str
    message: ChatMessage
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: float


# ─── Scaling Policy Schemas ───────────────────────────────

class ScalingPolicyCreate(BaseModel):
    model_id: uuid.UUID
    min_replicas: int = Field(default=1, ge=1)
    max_replicas: int = Field(default=5, ge=1, le=20)
    scale_up_cpu_threshold: float = Field(default=80.0)
    scale_down_cpu_threshold: float = Field(default=20.0)
    scale_up_latency_ms: float = Field(default=2000.0)
    cooldown_seconds: int = Field(default=60, ge=10)


class ScalingPolicyResponse(ScalingPolicyCreate):
    id: uuid.UUID
    is_active: bool

    class Config:
        from_attributes = True


# ─── Metrics Schemas ──────────────────────────────────────

class SystemMetrics(BaseModel):
    cpu_percent: float
    memory_percent: float
    memory_used_gb: float
    memory_total_gb: float
    disk_percent: float
    gpu_metrics: Optional[List[Dict[str, Any]]] = None
    timestamp: datetime


class ModelMetrics(BaseModel):
    model_id: str
    model_name: str
    requests_per_minute: float
    avg_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    total_tokens_per_minute: int
    error_rate: float


# ─── Benchmark Schemas ────────────────────────────────────

class BenchmarkRequest(BaseModel):
    model_name: str
    prompt: str = "Explain quantum computing in simple terms."
    num_requests: int = Field(default=10, ge=1, le=100)
    concurrency: int = Field(default=1, ge=1, le=10)


class BenchmarkResult(BaseModel):
    model_name: str
    num_requests: int
    concurrency: int
    total_time_s: float
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    tokens_per_second: float
    successful_requests: int
    failed_requests: int


# ─── RAG Schemas ──────────────────────────────────────────

class DocumentIngest(BaseModel):
    collection: str
    content: str
    metadata: Dict[str, Any] = {}


class RAGQuery(BaseModel):
    collection: str
    query: str
    model: str = "llama3:8b"
    top_k: int = Field(default=5, ge=1, le=20)
    max_tokens: int = 512


# ─── API Key Schemas ──────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str
    rate_limit_rpm: int = Field(default=60, ge=1, le=10000)


class ApiKeyResponse(BaseModel):
    id: uuid.UUID
    name: str
    key: Optional[str] = None              # only shown on creation
    rate_limit_rpm: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True