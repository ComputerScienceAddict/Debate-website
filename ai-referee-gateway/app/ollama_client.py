import asyncio
import httpx
from app.config import settings
from app.json_utils import extract_json_object


ollama_semaphore = asyncio.Semaphore(settings.max_parallel_ollama_jobs)


class OllamaError(Exception):
    pass


async def ollama_chat_json(
    model: str,
    system_prompt: str,
    user_prompt: str,
    timeout_seconds: int | None = None,
) -> dict:
    """
    Sends a structured JSON request to Ollama.
    Uses a semaphore so your GPU does not get destroyed by parallel jobs.
    """
    timeout = timeout_seconds or settings.request_timeout_seconds

    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": system_prompt,
            },
            {
                "role": "user",
                "content": user_prompt,
            },
        ],
        "stream": False,
        "format": "json",
        "keep_alive": "15m",
        "options": {
            "temperature": 0.15,
            "top_p": 0.85,
            "repeat_penalty": 1.1,
            "num_ctx": 8192,
            "num_predict": 1800,
        },
    }

    async with ollama_semaphore:
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(
                    f"{settings.ollama_url}/api/chat",
                    json=payload,
                )

            response.raise_for_status()
            raw = response.json()

            content = raw.get("message", {}).get("content", "")

            if not content:
                raise OllamaError("Ollama returned an empty message.")

            return extract_json_object(content)

        except httpx.TimeoutException as exc:
            raise OllamaError("Ollama request timed out.") from exc

        except httpx.HTTPStatusError as exc:
            raise OllamaError(f"Ollama HTTP error: {exc.response.status_code}") from exc

        except Exception as exc:
            raise OllamaError(str(exc)) from exc
