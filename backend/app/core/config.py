from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "AI Cloud Orchestrator"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://aico:aico_secret@localhost:5432/aico_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Ollama
    OLLAMA_URL: str = "http://localhost:11434"

    # Rate limiting defaults
    DEFAULT_RATE_LIMIT_RPM: int = 60

    # Docker socket
    DOCKER_SOCKET: str = "unix:///var/run/docker.sock"

    # Autoscaler poll interval (seconds)
    AUTOSCALER_INTERVAL: int = 30

    class Config:
        env_file = ".env"


settings = Settings()