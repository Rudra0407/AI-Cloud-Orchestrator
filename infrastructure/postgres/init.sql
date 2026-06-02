-- Enable pgvector extension for RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Models table: tracks deployed LLM containers
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    model_tag VARCHAR(255) NOT NULL,        -- e.g. "llama3:8b"
    container_id VARCHAR(255),              -- Docker container ID
    status VARCHAR(50) DEFAULT 'stopped',   -- running, stopped, pulling, error
    port INTEGER,                           -- mapped host port
    config JSONB DEFAULT '{}',              -- model-specific config
    resource_limits JSONB DEFAULT '{}',     -- CPU/memory limits
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routes: traffic routing rules between models
CREATE TABLE IF NOT EXISTS routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    path_prefix VARCHAR(255) NOT NULL,      -- e.g. "/v1/chat"
    strategy VARCHAR(50) DEFAULT 'round_robin', -- round_robin, weighted, least_latency
    config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Route targets: which models a route sends traffic to
CREATE TABLE IF NOT EXISTS route_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    route_id UUID REFERENCES routes(id) ON DELETE CASCADE,
    model_id UUID REFERENCES models(id) ON DELETE CASCADE,
    weight INTEGER DEFAULT 1,              -- for weighted routing
    is_active BOOLEAN DEFAULT true
);

-- API Keys for rate limiting
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    rate_limit_rpm INTEGER DEFAULT 60,     -- requests per minute
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Inference requests log
CREATE TABLE IF NOT EXISTS inference_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID REFERENCES models(id),
    route_id UUID REFERENCES routes(id),
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    latency_ms FLOAT,
    status VARCHAR(50),
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Autoscaling policies
CREATE TABLE IF NOT EXISTS scaling_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID REFERENCES models(id) ON DELETE CASCADE,
    min_replicas INTEGER DEFAULT 1,
    max_replicas INTEGER DEFAULT 5,
    scale_up_cpu_threshold FLOAT DEFAULT 80.0,
    scale_down_cpu_threshold FLOAT DEFAULT 20.0,
    scale_up_latency_ms FLOAT DEFAULT 2000.0,
    cooldown_seconds INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true
);

-- Vector store for RAG documents
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),               -- supports OpenAI-compatible embeddings
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast vector search
CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Index for collection filtering
CREATE INDEX IF NOT EXISTS documents_collection_idx ON documents(collection);
CREATE INDEX IF NOT EXISTS inference_logs_created_at_idx ON inference_logs(created_at);
CREATE INDEX IF NOT EXISTS inference_logs_model_id_idx ON inference_logs(model_id);