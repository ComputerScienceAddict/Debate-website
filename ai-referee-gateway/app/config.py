from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()


class Settings(BaseModel):
    ai_gateway_key: str = os.getenv("AI_GATEWAY_KEY", "")

    ollama_url: str = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
    ollama_referee_model: str = os.getenv("OLLAMA_REFEREE_MODEL", "qwen2.5:7b-instruct")
    ollama_fast_model: str = os.getenv("OLLAMA_FAST_MODEL", "llama3.2:3b")

    max_parallel_ollama_jobs: int = int(os.getenv("MAX_PARALLEL_OLLAMA_JOBS", "1"))
    max_transcript_chars: int = int(os.getenv("MAX_TRANSCRIPT_CHARS", "24000"))
    request_timeout_seconds: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "180"))

    live_check_max_chars: int = int(os.getenv("LIVE_CHECK_MAX_CHARS", "1200"))
    final_score_min_chars: int = int(os.getenv("FINAL_SCORE_MIN_CHARS", "700"))


settings = Settings()
