from typing import Optional
from fastapi import Header, HTTPException, status
from python_engine.core.config import get_settings
from python_engine.core.logger import get_logger

settings = get_settings()
logger = get_logger()

async def verify_token(
    x_internal_token: Optional[str] = Header(None, alias="x-internal-token"),
    authorization: Optional[str] = Header(None)
):
    expected_token = settings.INTERNAL_TOKEN
    
    # This fallback exists only for edge-case tests; normal runtime is validated in config.py.
    if not expected_token:
        return True
        
    # Check x-internal-token header first
    if x_internal_token == expected_token:
        return True
        
    # Check Authorization header (Bearer token)
    if authorization and authorization.lower().startswith("bearer "):
        bearer_token = authorization[7:].strip()
        if bearer_token == expected_token:
            return True
            
    # Log unauthorized attempt
    logger.warning("Unauthorized access attempt to Python Engine with invalid or missing token.")
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Invalid or missing internal token."
    )
