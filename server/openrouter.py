"""Local OpenRouter proxy. The API key never leaves the backend."""

import asyncio
import os
from pathlib import Path
from typing import Literal

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

router = APIRouter(prefix="/ai")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class JsonSchema(BaseModel):
    name: str
    strict: bool = True
    schema_: dict = Field(alias="schema")


class ResponseFormat(BaseModel):
    type: Literal["json_schema"]
    json_schema: JsonSchema


class ChatRequest(BaseModel):
    model: str = Field(min_length=3, max_length=200, pattern=r"^[^\s/]+/[^\s]+$")
    messages: list[Message] = Field(min_length=1)
    response_format: ResponseFormat | None = None


@router.post("/chat")
async def chat(request: ChatRequest):
    api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
    if not api_key or api_key == "your_openrouter_api_key_here":
        raise HTTPException(
            status_code=503,
            detail="Add OPENROUTER_API_KEY to the project's .env file, then restart the backend.",
        )

    payload = request.model_dump(by_alias=True, exclude_none=True)
    if request.response_format:
        # Never silently route extraction to an endpoint that ignores the schema.
        payload["provider"] = {"require_parameters": True}

    try:
        async with httpx.AsyncClient(timeout=180) as client:
            for attempt in range(3):
                response = await client.post(
                    OPENROUTER_URL,
                    headers={"Authorization": f"Bearer {api_key}", "X-Title": "Tabular Review"},
                    json=payload,
                )
                if response.status_code not in (429, 503) or attempt == 2:
                    break
                await asyncio.sleep(2 ** attempt)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="OpenRouter timed out. Please try again.") from None
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Cannot reach OpenRouter. Check your internet connection.") from None

    try:
        data = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="OpenRouter returned an invalid response.") from None

    if not isinstance(data, dict):
        raise HTTPException(status_code=502, detail="OpenRouter returned an invalid response.")
    if response.is_error or data.get("error"):
        error = data.get("error")
        message = error.get("message") if isinstance(error, dict) else None
        status = response.status_code if response.is_error else 502
        detail = message if isinstance(message, str) else "OpenRouter could not complete the request."
        raise HTTPException(status_code=status, detail=detail.replace(api_key, "[redacted]"))

    try:
        choice = data["choices"][0]
        message = choice["message"]
        content = message.get("content")
        if message.get("refusal"):
            raise HTTPException(status_code=422, detail="The selected model declined this request.")
        if choice.get("finish_reason") == "length":
            raise HTTPException(status_code=502, detail="The model's answer was cut off. Try a shorter document or another model.")
        if not isinstance(content, str) or not content.strip():
            raise ValueError("Empty response")
    except (KeyError, IndexError, TypeError, ValueError, AttributeError):
        raise HTTPException(status_code=502, detail="OpenRouter returned no usable answer. Try another model.") from None

    return {"content": content}
