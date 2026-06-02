import docker
import asyncio
import httpx
from typing import Optional, Dict, Any
from app.core.config import settings

# Find an available port in range
OLLAMA_PORT_RANGE_START = 11435
_used_ports = set()


def get_free_port() -> int:
    import socket
    for port in range(OLLAMA_PORT_RANGE_START, OLLAMA_PORT_RANGE_START + 100):
        if port not in _used_ports:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind(("", port))
                    _used_ports.add(port)
                    return port
                except OSError:
                    continue
    raise RuntimeError("No free ports available")


def get_docker_client():
    try:
        return docker.from_env()
    except Exception as e:
        raise RuntimeError(f"Docker not accessible: {e}. Is Docker Desktop running?")


async def pull_model_ollama(model_tag: str) -> bool:
    """Pull a model via the Ollama API (streaming pull)."""
    async with httpx.AsyncClient(timeout=600) as client:
        try:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/pull",
                json={"name": model_tag, "stream": False},
            )
            return response.status_code == 200
        except Exception as e:
            print(f"Failed to pull model {model_tag}: {e}")
            return False


async def start_model_container(
    name: str,
    model_tag: str,
    resource_limits: Dict[str, Any] = {},
) -> Dict[str, Any]:
    """
    For local dev: we use the shared Ollama instance.
    In a real K8s setup this would spin up a dedicated pod.
    Returns container_id and port.
    """
    # For single-node: ensure model is pulled in Ollama
    pulled = await pull_model_ollama(model_tag)
    if not pulled:
        raise RuntimeError(f"Failed to pull model {model_tag} from Ollama")

    # In production k8s mode you'd create a deployment here.
    # For local dev we use the shared Ollama container.
    return {
        "container_id": f"ollama-shared-{model_tag.replace(':', '-')}",
        "port": 11434,
        "status": "running",
    }


async def stop_model_container(container_id: str) -> bool:
    """Stop a model container. For shared Ollama, just marks it stopped."""
    if container_id.startswith("ollama-shared-"):
        return True
    try:
        client = get_docker_client()
        container = client.containers.get(container_id)
        container.stop(timeout=10)
        return True
    except Exception as e:
        print(f"Stop container error: {e}")
        return False


async def get_container_stats(container_id: str) -> Optional[Dict[str, Any]]:
    """Get real-time CPU/memory stats for a container."""
    if container_id.startswith("ollama-shared-"):
        # Return stats for the aico_ollama container
        try:
            client = get_docker_client()
            container = client.containers.get("aico_ollama")
            stats = container.stats(stream=False)
            cpu_delta = stats["cpu_stats"]["cpu_usage"]["total_usage"] - \
                        stats["precpu_stats"]["cpu_usage"]["total_usage"]
            system_delta = stats["cpu_stats"]["system_cpu_usage"] - \
                           stats["precpu_stats"]["system_cpu_usage"]
            num_cpus = stats["cpu_stats"].get("online_cpus", 1)
            cpu_percent = (cpu_delta / system_delta) * num_cpus * 100.0 if system_delta > 0 else 0.0

            mem_used = stats["memory_stats"].get("usage", 0)
            mem_limit = stats["memory_stats"].get("limit", 1)
            mem_percent = (mem_used / mem_limit) * 100.0

            return {
                "cpu_percent": round(cpu_percent, 2),
                "memory_percent": round(mem_percent, 2),
                "memory_used_mb": round(mem_used / (1024 ** 2), 1),
                "memory_limit_mb": round(mem_limit / (1024 ** 2), 1),
            }
        except Exception as e:
            print(f"Container stats error: {e}")
            return None
    return None


async def list_running_containers() -> list:
    """List all aico-managed containers."""
    try:
        client = get_docker_client()
        containers = client.containers.list(filters={"name": "aico_"})
        return [
            {
                "id": c.id[:12],
                "name": c.name,
                "status": c.status,
                "image": c.image.tags[0] if c.image.tags else "unknown",
            }
            for c in containers
        ]
    except Exception as e:
        print(f"List containers error: {e}")
        return []