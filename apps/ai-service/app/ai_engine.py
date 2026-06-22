"""
ai_engine.py — Contract AI (OpenAI-compatible client: xAI Grok or OpenAI)
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()

SYSTEM_PROMPT = """You are the Quanby Legal Contract AI Agent — an expert legal AI specializing in Philippine law, corporate compliance, and contract analysis. You are integrated into Quanby Legal, the first and only Supreme Court-accredited electronic notarization platform in the Philippines.

## YOUR EXPERTISE

### Philippine Legal Framework
- **Civil Code of the Philippines** (Republic Act No. 386) — obligations, contracts, property, family law
- **Electronic Commerce Act** (Republic Act No. 8792) — electronic documents and signatures
- **Electronic Notarization Rules** (A.M. No. 24-10-14-SC) — Supreme Court rules for e-notarization
- **Corporation Code** (Republic Act No. 11232) — corporate documents and compliance
- **Labor Code of the Philippines** (Presidential Decree No. 442) — employment contracts
- **Data Privacy Act** (Republic Act No. 10173) — data handling obligations

### Contract Analysis Capabilities
1. Party identification, obligations, payment terms, key dates
2. Risk clause detection and compliance checks
3. Notarization readiness under A.M. No. 24-10-14-SC

## RESPONSE STYLE
- Be precise, professional, and actionable
- Cite Philippine law when flagging issues
- Use clear risk levels: HIGH RISK, MEDIUM RISK, LOW RISK, INFO

## DISCLAIMERS
- AI analysis is not legal advice
- Recommend a licensed Philippine attorney for high-stakes decisions"""


def get_client_and_model() -> tuple[OpenAI, str]:
    xai_key = os.getenv("XAI_API_KEY", "").strip()
    if xai_key:
        return (
            OpenAI(api_key=xai_key, base_url="https://api.x.ai/v1"),
            os.getenv("XAI_MODEL", "grok-3-fast-beta"),
        )
    oai_key = os.getenv("OPENAI_API_KEY", "").strip()
    if oai_key:
        return OpenAI(api_key=oai_key), os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    raise ValueError("Configure XAI_API_KEY or OPENAI_API_KEY for Contract AI")


def analyze_contract(contract_text: str, filename: str) -> dict[str, Any]:
    client, model = get_client_and_model()
    analysis_prompt = f"""Please analyze this contract document and provide a comprehensive legal review.

DOCUMENT: {filename}

CONTRACT TEXT:
---
{contract_text}
---

Provide your analysis in the following JSON structure:
{{
  "contract_type": "string",
  "summary": "2-3 sentence executive summary",
  "risk_flags": [
    {{
      "severity": "high/medium/low/info",
      "title": "string",
      "description": "string",
      "clause": "string",
      "law_reference": "string",
      "recommendation": "string"
    }}
  ],
  "missing_clauses": [
    {{
      "clause": "string",
      "importance": "high/medium/low",
      "why_needed": "string",
      "recommendation": "string"
    }}
  ],
  "overall_risk": "high/medium/low",
  "overall_score": 85,
  "recommendation": "string"
}}

Be thorough. Cite specific Philippine laws where relevant."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": analysis_prompt},
            ],
            temperature=0.1,
            max_tokens=4000,
        )
        raw_response = response.choices[0].message.content or ""
        try:
            json_start = raw_response.find("{")
            json_end = raw_response.rfind("}") + 1
            if json_start != -1 and json_end > json_start:
                analysis = json.loads(raw_response[json_start:json_end])
            else:
                analysis = {"raw_analysis": raw_response, "parse_error": True}
        except json.JSONDecodeError:
            analysis = {"raw_analysis": raw_response, "parse_error": True}
        return {
            "success": True,
            "filename": filename,
            "analysis": analysis,
            "tokens_used": response.usage.total_tokens if response.usage else None,
        }
    except Exception as e:
        return {"success": False, "error": str(e), "filename": filename}


def chat_about_contract(
    contract_text: str,
    conversation_history: list[dict[str, str]],
    user_message: str,
    filename: str = "contract",
) -> dict[str, Any]:
    client, model = get_client_and_model()
    messages: list[dict[str, str]] = [
        {
            "role": "system",
            "content": SYSTEM_PROMPT
            + f"\n\nThe user has uploaded a contract called '{filename}'. Here is the contract text for reference:\n\n---\n{contract_text}\n---\n\nAnswer questions about this specific contract.",
        }
    ]
    for msg in conversation_history[-20:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})
    try:
        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
            max_tokens=1500,
        )
        assistant_message = response.choices[0].message.content
        return {
            "success": True,
            "response": assistant_message or "",
            "tokens_used": response.usage.total_tokens if response.usage else None,
        }
    except Exception as e:
        return {"success": False, "error": str(e), "response": f"I encountered an error: {str(e)}"}


def generate_contract(template_type: str, parameters: dict[str, Any]) -> dict[str, Any]:
    client, model = get_client_and_model()
    template_descriptions = {
        "deed_of_sale": "Deed of Absolute Sale for real property under Philippine law",
        "lease_agreement": "Contract of Lease for residential or commercial property",
        "employment_contract": "Employment Contract compliant with Philippine Labor Code",
        "service_agreement": "Service Agreement / Professional Services Contract",
        "nda": "Non-Disclosure Agreement (Confidentiality Agreement)",
    }
    template_desc = template_descriptions.get(
        template_type, template_type.replace("_", " ").title()
    )
    params_text = "\n".join(
        f"- {k.replace('_', ' ').title()}: {v}" for k, v in parameters.items() if v
    )
    generation_prompt = f"""Generate a complete, legally sound {template_desc} for the Philippines.

CONTRACT PARAMETERS:
{params_text}

Requirements:
1. Follow Philippine law requirements
2. Include standard clauses for this contract type
3. Add force majeure, governing law (Philippines), dispute resolution
4. Include acknowledgment block suitable for e-notarization under A.M. No. 24-10-14-SC
5. Number sections and clauses

Generate the complete contract document now:"""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": generation_prompt},
            ],
            temperature=0.2,
            max_tokens=3000,
        )
        contract_text = response.choices[0].message.content or ""
        return {
            "success": True,
            "contract_type": template_type,
            "contract_text": contract_text,
            "tokens_used": response.usage.total_tokens if response.usage else None,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def generate_notarization_summary(apt: dict[str, Any], enp_user: dict[str, Any]) -> dict[str, Any]:
    """Post-notarization summary (agentic)."""
    client, model = get_client_and_model()
    enp_profile = enp_user.get("profile") or {}
    enp_full_name = f"{enp_user.get('first_name', '')} {enp_user.get('last_name', '')}".strip()
    roll_no = enp_profile.get("roll_no", "N/A")
    commission_no = enp_profile.get("commission_no", "N/A")
    commission_valid = enp_profile.get("commission_no_valid_until", "N/A")
    docs = apt.get("session_documents", [])
    doc_summaries = []
    for d in docs:
        doc_summaries.append(
            f"- {d.get('doc_name', d.get('name', 'Document'))} "
            f"[{d.get('notarization_type', 'ACKNOWLEDGMENT')}] "
            f"uploaded by {d.get('uploaded_by_name', 'unknown')} "
            f"at {d.get('uploaded_at', 'N/A')}"
        )
    docs_text = "\n".join(doc_summaries) if doc_summaries else "No documents uploaded."
    prompt = f"""You are the Quanby Legal Post-Notarization Summary Agent.
Generate a structured Agentic Notarization Summary for this completed e-notarization session.

SESSION DATA:
- Appointment ID: {apt.get("apt_id", "N/A")}
- Session Title: {apt.get("title", "Notarization Session")}
- Notarization Type: {apt.get("notarization_type", "N/A")}
- Session Mode: {apt.get("mode", "REN")}
- Client: {apt.get("client_name", "N/A")} <{apt.get("client_email", "")}>
- ENP: {enp_full_name}
- ENP Roll No.: {roll_no}
- ENP Commission No.: {commission_no} (valid until {commission_valid})
- Session Started: {apt.get("confirmed_at", apt.get("created_at", "N/A"))}
- Session Ended: {apt.get("session_ended_at", "N/A")}
- Notes: {apt.get("notes", "")}

DOCUMENTS NOTARIZED:
{docs_text}

Return JSON with keys: summary_type, apt_id, session_title, parties (object), documents (array), session_timeline (object), compliance (object), ai_observations (string), generated_by (string)."""

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            max_tokens=1500,
        )
        raw = response.choices[0].message.content or ""
        try:
            js = raw.find("{")
            je = raw.rfind("}") + 1
            summary = json.loads(raw[js:je]) if js != -1 and je > js else {"raw": raw}
        except Exception:
            summary = {"raw": raw}
        summary["generated_at"] = datetime.now(timezone.utc).isoformat()
        return {"success": True, "summary": summary}
    except Exception as e:
        return {"success": False, "error": str(e)}
