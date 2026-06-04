import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from app.core.config import settings
from app.core.database import engine, Base
from app.core.redis import init_redis, close_redis
from app.services.autoscaler import run_autoscaler
from app.api import models, routes, inference, metrics, benchmark, scaling

# Import all models so SQLAlchemy can create tables
import app.models.db_models  # noqa


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    print(f"🚀 Starting {settings.APP_NAME} v{settings.VERSION}")

    # Initialize database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables ready")

    # Initialize Redis
    await init_redis()

    # Start autoscaler background task
    autoscaler_task = asyncio.create_task(run_autoscaler())
    print("✅ Autoscaler running")

    yield

    # Cleanup
    autoscaler_task.cancel()
    try:
        await autoscaler_task
    except asyncio.CancelledError:
        pass
    await close_redis()
    await engine.dispose()
    print("👋 Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="rAIn Orchestrator — Deploy, route, and monitor LLMs",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prometheus metrics
Instrumentator().instrument(app).expose(app)

# Routers
app.include_router(models.router, prefix="/api/v1")
app.include_router(routes.router, prefix="/api/v1")
app.include_router(inference.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
app.include_router(benchmark.router, prefix="/api/v1")
app.include_router(scaling.router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "healthy", "version": settings.VERSION}


@app.get("/")
async def root():
    return {
        "name": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
    }