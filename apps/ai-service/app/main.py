"""
FastAPI Contract AI microservice — internal network only.
Auth: X-Internal-Token (shared secret with NestJS).
"""

from __future__ import annotations

import os
from typing import Annotated, Any

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app import ai_engine
from app.contract_parser import clean_text, extract_text, get_contract_summary_for_context

INTERNAL_TOKEN = os.getenv("CONTRACT_AI_INTERNAL_TOKEN", "").strip()


def verify_internal_token(x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None) -> None:
    if not INTERNAL_TOKEN or x_internal_token != INTERNAL_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid or missing internal token")


app = FastAPI(title="qLegal Contract AI")

_internal = [Depends(verify_internal_token)]


def download_via_nest(*, nest_resolve_url: str, resolve_token: str) -> tuple[bytes, str]:
    with httpx.Client(timeout=120.0) as client:
        r = client.post(
            nest_resolve_url,
            json={"resolveToken": resolve_token},
            headers={"X-Internal-Token": INTERNAL_TOKEN},
        )
        if r.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"resolve-download failed: {r.status_code} {r.text[:500]}",
            )
        data = r.json()
        url = data.get("downloadUrl") or data.get("url")
        if not url or not isinstance(url, str):
            raise HTTPException(status_code=502, detail="resolve-download missing downloadUrl")
        fr = client.get(url, timeout=120.0, follow_redirects=True)
        if fr.status_code != 200:
            raise HTTPException(status_code=502, detail=f"S3 GET failed: {fr.status_code}")
        filename = data.get("filename") if isinstance(data.get("filename"), str) else None
        return fr.content, filename or "document.pdf"


class AnalyzeBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    file_object_id: str = Field(alias="fileObjectId")
    filename: str
    analysis_type: str = Field(alias="analysisType")
    resolve_token: str = Field(alias="resolveToken")
    nest_resolve_url: str = Field(alias="nestResolveUrl")


@app.post("/analyze", dependencies=_internal)
def analyze(body: AnalyzeBody) -> dict[str, Any]:
    raw, fname = download_via_nest(
        nest_resolve_url=body.nest_resolve_url,
        resolve_token=body.resolve_token,
    )
    use_name = body.filename or fname
    text = clean_text(extract_text(raw, use_name))
    text = get_contract_summary_for_context(text)
    return ai_engine.analyze_contract(text, use_name)


class ChatBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str
    conversation_history: list[dict[str, str]] = Field(default_factory=list, alias="conversationHistory")
    context: str | None = None
    file_object_id: str | None = Field(default=None, alias="fileObjectId")
    filename: str = "contract"
    resolve_token: str | None = Field(default=None, alias="resolveToken")
    nest_resolve_url: str | None = Field(default=None, alias="nestResolveUrl")


@app.post("/chat", dependencies=_internal)
def chat(body: ChatBody) -> dict[str, Any]:
    contract_text: str
    fname = body.filename
    if body.file_object_id and body.resolve_token and body.nest_resolve_url:
        raw, fname = download_via_nest(
            nest_resolve_url=body.nest_resolve_url,
            resolve_token=body.resolve_token,
        )
        contract_text = clean_text(extract_text(raw, fname))
        contract_text = get_contract_summary_for_context(contract_text)
    elif body.context and body.context.strip():
        contract_text = body.context.strip()
        fname = body.filename or "context.txt"
    else:
        raise HTTPException(
            status_code=400,
            detail="Provide fileObjectId+resolveToken+nestResolveUrl or non-empty context",
        )
    return ai_engine.chat_about_contract(
        contract_text,
        body.conversation_history,
        body.message,
        fname,
    )


class GenerateBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    template_type: str = Field(alias="templateType")
    parameters: dict[str, Any] = Field(default_factory=dict)
    language: str = "en"


@app.post("/generate", dependencies=_internal)
def generate(body: GenerateBody) -> dict[str, Any]:
    return ai_engine.generate_contract(body.template_type, body.parameters)


class AgenticSummarizeBody(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    appointment: dict[str, Any]
    enp_user: dict[str, Any] = Field(alias="enpUser")


@app.post("/agentic-summarize", dependencies=_internal)
def agentic_summarize(body: AgenticSummarizeBody) -> dict[str, Any]:
    return ai_engine.generate_notarization_summary(body.appointment, body.enp_user)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
