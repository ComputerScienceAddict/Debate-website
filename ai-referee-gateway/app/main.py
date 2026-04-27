from fastapi import FastAPI, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.security import verify_gateway_key
from app.schemas import (
    HealthResponse,
    LiveCheckRequest,
    LiveCheckResponse,
    FinalScoreRequest,
    FinalScoreResponse,
    FinalScoreResult,
)
from app.referee_rules import analyze_live_rules
from app.prompts import REFEREE_SYSTEM_PROMPT, build_final_score_prompt
from app.ollama_client import ollama_chat_json, OllamaError
from app.scoring import normalize_result


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="AI Debate Referee Gateway",
    version="1.0.0",
    description="Private Ollama-powered AI referee gateway for debate platform."
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Rate limit exceeded. Slow down."
        },
    )


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        referee_model=settings.ollama_referee_model,
        fast_model=settings.ollama_fast_model,
    )


@app.post(
    "/referee/live-check",
    response_model=LiveCheckResponse,
    dependencies=[Depends(verify_gateway_key)],
)
@limiter.limit("60/minute")
async def live_check(request: Request, body: LiveCheckRequest):
    if len(body.text) > settings.live_check_max_chars:
        raise HTTPException(
            status_code=400,
            detail=f"Live check text too long. Max {settings.live_check_max_chars} characters."
        )

    events = analyze_live_rules(body.text)

    return LiveCheckResponse(
        room_id=body.room_id,
        speaker_id=body.speaker_id,
        events=events,
    )


@app.post(
    "/referee/final-score",
    response_model=FinalScoreResponse,
    dependencies=[Depends(verify_gateway_key)],
)
@limiter.limit("8/minute")
async def final_score(request: Request, body: FinalScoreRequest):
    total_chars = len(body.affirmative_transcript) + len(body.negative_transcript)

    if total_chars > settings.max_transcript_chars:
        raise HTTPException(
            status_code=400,
            detail=f"Transcript too long. Max {settings.max_transcript_chars} characters."
        )

    if total_chars < settings.final_score_min_chars:
        raise HTTPException(
            status_code=400,
            detail=f"Transcript too short for fair scoring. Minimum {settings.final_score_min_chars} characters."
        )

    user_prompt = build_final_score_prompt(
        topic=body.topic,
        debate_format=body.debate_format,
        affirmative_name=body.affirmative_name,
        negative_name=body.negative_name,
        affirmative_transcript=body.affirmative_transcript,
        negative_transcript=body.negative_transcript,
    )

    try:
        raw_result = await ollama_chat_json(
            model=settings.ollama_referee_model,
            system_prompt=REFEREE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
        )

        normalized = normalize_result(raw_result)

        validated = FinalScoreResult(**normalized)

        return FinalScoreResponse(
            room_id=body.room_id,
            model=settings.ollama_referee_model,
            result=validated,
        )

    except OllamaError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama referee failed: {str(exc)}"
        )

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Final scoring failed: {str(exc)}"
        )
