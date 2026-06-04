# rAIn Orchestrator

> **Mini AWS for LLM Apps** — A full-stack AI infrastructure platform to deploy, route, autoscale, and monitor open-source LLMs locally.

![Dashboard](https://img.shields.io/badge/status-active-brightgreen) ![Stack](https://img.shields.io/badge/stack-FastAPI%20%7C%20React%20%7C%20Docker-blue) ![LLM](https://img.shields.io/badge/LLM-Ollama%20%7C%20LLaMA3-orange)

---

## What is this?

rAIn Orchestrator is a portfolio-grade platform that demonstrates AI infrastructure engineering. It lets you:

- Deploy open-source LLMs locally via Ollama
- Route traffic between models with round-robin, weighted, or least-latency strategies
- Monitor GPU/CPU usage and inference metrics in real time
- Run load tests and measure tokens/sec, p50/p95/p99 latency
- Configure autoscaling policies per model
- Chat with your models through a built-in Playground UI

Built to position you as an **AI infrastructure engineer**, **platform engineer**, or **ML systems engineer**.

---

## Architecture

```
rAIn Orchestrator/
├── backend/                  # Python FastAPI
│   ├── app/
│   │   ├── api/              # REST + WebSocket endpoints
│   │   ├── core/             # Config, DB, Redis
│   │   ├── models/           # SQLAlchemy ORM + Pydantic schemas
│   │   └── services/         # Inference, autoscaler, benchmark, rate limiter
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # React + Tailwind dashboard
│   ├── src/
│   │   ├── pages/            # Dashboard, Models, Playground, Metrics, Benchmark, Routes, Autoscaling
│   │   ├── components/       # Sidebar, StatusBadge, MetricGauge
│   │   ├── hooks/            # useMetrics (WebSocket)
│   │   └── api/              # Axios client
│   └── package.json
└── infrastructure/
    ├── docker-compose.yml          # Local dev — infrastructure only
    ├── docker-compose.prod.yml     # Production — full stack
    ├── postgres/init.sql
    └── prometheus/prometheus.yml
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.11, FastAPI, SQLAlchemy async |
| Database | PostgreSQL 16 + pgvector |
| Cache / Queue | Redis 7 |
| LLM Inference | Ollama (LLaMA 3, Mistral, Gemma, etc.) |
| Frontend | React 18, Vite, Tailwind CSS, Recharts |
| Monitoring | Prometheus + Grafana |
| Orchestration | Docker Compose / Kubernetes |

---

## Services & Ports

| Service | Port | Description |
|---|---|---|
| React Frontend | 5173 | Dashboard UI |
| FastAPI Backend | 8000 | REST API + WebSockets |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Caching + rate limiting |
| Ollama | 11434 | LLM inference engine |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Metrics dashboards (admin/admin) |

---

## Running Modes

This project has two Docker Compose files:

| File | Purpose | Use when |
|---|---|---|
| `docker-compose.yml` | Infrastructure only (Postgres, Redis, Ollama, Prometheus, Grafana) | Local development |
| `docker-compose.prod.yml` | Full stack including backend and frontend | Self-hosting on a server |

**Local dev** runs backend and frontend directly on your machine (no port conflicts, hot reload).
**Production** runs everything in Docker containers with a single command.

---

## Prerequisites

Install all of these before starting:

| Tool | Version | Download |
|---|---|---|
| Docker Desktop | Latest | https://www.docker.com/products/docker-desktop/ |
| Node.js | 20+ | https://nodejs.org/ |
| Python | 3.11+ | https://www.python.org/downloads/ |
| Git | Latest | https://git-scm.com/ |

> **Windows users:** During Python install, check **"Add Python to PATH"**. After installing all tools, restart your terminal.

---

## Local Development Setup

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/rain-orchestrator.git
cd rain-orchestrator
```

### 2. Start infrastructure services

```bash
cd infrastructure
docker-compose up -d
```

This starts Postgres, Redis, Ollama, Prometheus, and Grafana only — no port conflicts with your local backend and frontend.

Wait ~20 seconds, then verify everything is healthy:

```bash
docker-compose ps
```

All services should show `Up` or `healthy`.

### 3. Set up the backend

```bash
cd ../backend

# Create virtual environment
python -m venv .venv

# Activate it
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
copy .env.example .env      # Windows
cp .env.example .env        # macOS/Linux
```

The default values in `.env.example` work out of the box for local dev — no changes needed.

Start the backend:

```bash
uvicorn app.main:app --reload --port 8000
```

You should see:
```
✅ Database tables ready
✅ Redis connected
✅ Autoscaler running
```

### 4. Set up the frontend

Open a new terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

Start the frontend:

```bash
npm run dev
```

### 5. Pull your first model

```bash
docker exec aico_ollama ollama pull llama3:8b
```

This downloads ~4.7GB. Wait for `success` before proceeding.

### 6. Open the dashboard

| URL | Description |
|---|---|
| http://localhost:5173 | Main dashboard |
| http://localhost:8000/docs | Interactive API docs |
| http://localhost:3000 | Grafana (admin / admin) |
| http://localhost:9090 | Prometheus |

### 7. Every session startup

Infrastructure persists across reboots — you only need to start it once. For each new session:

```bash
# Terminal 1 — only if Docker services aren't already running
cd infrastructure && docker-compose up -d

# Terminal 2 — backend
cd backend
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux
uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend
cd frontend && npm run dev
```

---

## Production / Self-Hosted Setup

Use `docker-compose.prod.yml` to run the entire stack on a server with a single command.

### Requirements

- A Linux server with at least 8GB RAM (for LLaMA 3 8B)
- Docker and Docker Compose installed
- Ports 5173, 8000, 11434, 3000, 9090 open in your firewall

Recommended providers: **Hetzner CX22** (€3.29/mo), **DigitalOcean Droplet** ($6/mo), **AWS EC2 t3.large**.

### Deploy

```bash
# 1. Clone the repo on your server
git clone https://github.com/YOUR_USERNAME/rain-orchestrator.git
cd rain-orchestrator/infrastructure

# 2. Create production environment file
cp .env.prod.example .env.prod

# 3. Edit .env.prod with your server's values
nano .env.prod
```

Set these values in `.env.prod`:

```env
POSTGRES_USER=aico
POSTGRES_PASSWORD=your-strong-password-here
POSTGRES_DB=aico_db
SECRET_KEY=your-long-random-secret-key
GRAFANA_PASSWORD=your-grafana-password

# Your server's public IP or domain name
API_URL=http://YOUR_SERVER_IP:8000
WS_URL=ws://YOUR_SERVER_IP:8000
```

```bash
# 4. Start all services
docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 5. Pull your first model
docker exec aico_ollama ollama pull llama3:8b

# 6. Check everything is running
docker-compose -f docker-compose.prod.yml ps
```

Open `http://YOUR_SERVER_IP:5173` in your browser.

### GPU Support (NVIDIA)

To run models on GPU, uncomment the deploy section in `docker-compose.prod.yml`:

```yaml
ollama:
  deploy:
    resources:
      reservations:
        devices:
          - driver: nvidia
            count: all
            capabilities: [gpu]
```

Requires [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html) installed on the host.

---

## First Steps in the Dashboard

Once the app is running (either locally or on a server):

1. **Models** → Click **Deploy Model** → Name: `my-llama`, Tag: `llama3:8b` → Deploy → ▷ Start
2. **Playground** → Select `my-llama` → Send a message
3. **Benchmark** → Select model → Choose a prompt preset → Run Benchmark
4. **Routes** → Create Route → Round Robin → Add `my-llama` as target
5. **Metrics** → Watch live CPU/memory and inference charts update in real time
6. **Autoscaling** → Add Policy → Configure thresholds with the sliders

---

## Windows-Specific Notes

**Port conflict with local PostgreSQL:**
If you have PostgreSQL installed locally, it conflicts with Docker on port 5432. Fix it by stopping the Windows service:

```powershell
# Run PowerShell as Administrator
Stop-Service -Name postgresql*
Get-Service postgresql* | Set-Service -StartupType Disabled
```

**PowerShell curl syntax:**
PowerShell's `curl` is an alias for `Invoke-WebRequest`. Use `Invoke-RestMethod` instead:

```powershell
Invoke-RestMethod -Method POST -Uri "http://localhost:8000/api/v1/inference/chat" `
  -ContentType "application/json" `
  -Body '{"model": "my-llama", "messages": [{"role": "user", "content": "Hello"}], "max_tokens": 100}'
```

---

## Supported Models

Any model available in Ollama works. Popular options:

| Model | Tag | RAM Required |
|---|---|---|
| LLaMA 3 8B | `llama3:8b` | 8GB |
| LLaMA 3 70B | `llama3:70b` | 48GB |
| Mistral 7B | `mistral:7b` | 8GB |
| Code LLaMA 7B | `codellama:7b` | 8GB |
| Gemma 7B | `gemma:7b` | 8GB |
| Phi-3 Mini | `phi3:mini` | 4GB |
| Qwen 2 7B | `qwen2:7b` | 8GB |

Browse all models at https://ollama.com/library

---

## API Reference

The full interactive API is at **http://localhost:8000/docs** when running locally.

Key endpoints:

```
POST /api/v1/inference/chat          # Send a chat message
POST /api/v1/inference/chat/stream   # Streaming chat (SSE)
GET  /api/v1/models/                 # List all models
POST /api/v1/models/                 # Deploy a new model
POST /api/v1/models/{id}/start       # Start a model
POST /api/v1/benchmark/run           # Run a load test
GET  /api/v1/metrics/system          # System CPU/memory metrics
WS   /api/v1/metrics/ws              # Live metrics WebSocket
GET  /api/v1/routes/                 # List traffic routes
POST /api/v1/scaling/                # Create autoscaling policy
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://aico:aico_secret@localhost:5432/aico_db` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama API base URL |
| `SECRET_KEY` | `change-me` | JWT signing key |
| `ENVIRONMENT` | `development` | `development` or `production` |
| `AUTOSCALER_INTERVAL` | `30` | Autoscaler poll interval (seconds) |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend API URL |
| `VITE_WS_URL` | `ws://localhost:8000` | WebSocket URL |

---

## Project Structure Details

```
backend/app/
├── api/
│   ├── benchmark.py          # Load testing endpoints
│   ├── inference.py          # Chat + streaming endpoints
│   ├── metrics.py            # System metrics + WebSocket
│   ├── models.py             # Model lifecycle management
│   ├── routes.py             # Traffic routing
│   └── scaling.py            # Autoscaling policies
├── core/
│   ├── config.py             # Pydantic settings
│   ├── database.py           # Async SQLAlchemy engine
│   └── redis.py              # Redis client
├── models/
│   ├── db_models.py          # SQLAlchemy ORM models
│   └── schemas.py            # Pydantic request/response schemas
├── services/
│   ├── autoscaler.py         # Background scaling loop
│   ├── benchmark_service.py  # Concurrent load testing
│   ├── docker_service.py     # Container lifecycle
│   ├── inference_service.py  # Ollama API + load balancing
│   ├── metrics_service.py    # psutil + DB aggregation
│   └── rate_limiter.py       # Redis sliding window
└── main.py                   # FastAPI app + lifespan
```

---

## Resume Talking Points

This project demonstrates:

- **AI Infrastructure** — LLM deployment, inference routing, model lifecycle management
- **Distributed Systems** — Load balancing strategies, Redis queuing, async Python
- **Platform Engineering** — Docker orchestration, health checks, Prometheus metrics
- **Backend Engineering** — FastAPI, async SQLAlchemy, WebSockets, SSE streaming
- **Frontend Engineering** — React, real-time WebSocket charts, responsive dashboard
- **Database Engineering** — PostgreSQL with pgvector for RAG, connection pooling

---

## License

MIT — use freely for personal and commercial projects.

---

## Contributing

Pull requests welcome. For major changes, open an issue first.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request