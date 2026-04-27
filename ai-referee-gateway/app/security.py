from fastapi import Header, HTTPException
from app.config import settings


def verify_gateway_key(x_ai_key: str | None = Header(default=None)) -> None:
    if not settings.ai_gateway_key:
        raise HTTPException(
            status_code=500,
            detail="AI gateway key is not configured on server."
        )

    if not x_ai_key or x_ai_key != settings.ai_gateway_key:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized AI gateway request."
        )
