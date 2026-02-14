from __future__ import annotations

import os
import json
import asyncio
from typing import Optional, List, Dict, Any

from dotenv import load_dotenv
from openai import AsyncOpenAI
from urllib.parse import urlparse

from utils.web_crawler import crawl_and_extract, format_crawled_content_for_prompt, crawl_competitors
from utils.brand_visibility_helper import get_brand_visibility_data, format_brand_visibility_data_for_prompt


load_dotenv()

HYPHEN = chr(45)


def get_openai_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError(
            "OpenAI API key is not configured. Please set OPENAI_API_KEY in your env file. "
            "Get your API key from https://platform.openai.com/api-keys"
        )

    lower_key = api_key.lower()
    if lower_key == ("sk" + HYPHEN + "placeholder") or lower_key.startswith("sk" + HYPHEN + "placeholder"):
        raise ValueError(
            "OpenAI API key is not configured. Please set OPENAI_API_KEY in your env file. "
            "Get your API key from https://platform.openai.com/api-keys"
        )

    if lower_key == "sk_placeholder" or lower_key.startswith("sk_placeholder"):
        raise ValueError(
            "OpenAI API key is not configured. Please set OPENAI_API_KEY in your env file. "
            "Get your API key from https://platform.openai.com/api-keys"
        )

    return AsyncOpenAI(api_key=api_key)


def _normalize_url(u: Optional[str]) -> Optional[str]:
    if not u:
        return None
    s = u.strip()
    if not s:
        return None
    if not (s.startswith("http://") or s.startswith("https://")):
        s = "https://" + s
    return s.rstrip("/")


def _safe_brand_name(app_name: str, website_url: Optional[str], crawled_title: str) -> str:
    if crawled_title:
        t = crawled_title.split("|")[0].strip()
        if HYPHEN in t:
            t = t.split(HYPHEN)[0].strip()
        if t:
            return t[:50]

    if app_name:
        t = app_name.split("|")[0].strip()
        if HYPHEN in t:
            t = t.split(HYPHEN)[0].strip()
        if t:
            return t[:50]

    if website_url:
        try:
            host = urlparse(website_url).netloc.replace("www.", "").strip()
            if host:
                root = host.split(".")[0].strip()
                if root:
                    return root[:50].title()
        except Exception:
            pass

    return "Unknown"


def _count_words(text: str) -> int:
    return len([w for w in (text or "").split() if w.strip()])


def _truncate(text: str, limit: int) -> str:
    s = (text or "").strip()
    if len(s) <= limit:
        return s
    return s[: max(0, limit - 3)].rstrip() + "..."


def _normalize_doc_type(doc_type: str) -> str:
    s = (doc_type or "").strip().lower()
    if not s:
        return "documentation"
    s = s.replace(HYPHEN, "_")
    s = s.replace(" ", "_")
    while "__" in s:
        s = s.replace("__", "_")
    return s


def _normalize_format(output_format: str) -> str:
    s = (output_format or "").strip().lower()
    if not s:
        return "markdown"
    s = s.replace(HYPHEN, "_")
    s = s.replace(" ", "_")
    if s in ("plain", "plaintext", "plain_text", "text"):
        return "plain_text"
    if s in ("html",):
        return "html"
    return "markdown"


def _build_evidence_summary(
    app_name: str,
    app_type: str,
    doc_type: str,
    feature_description: str,
    target_audience: str,
    technical_level: str,
    style: str,
    tone: str,
    language: str,
    output_format: str,
    site_data: Optional[Dict[str, Any]],
    competitor_data: List[Dict[str, Any]],
    brand_visibility_evidence: List[Dict[str, Any]],
    competitor_brand_visibility_evidence: List[Dict[str, Any]],
    app_url: Optional[str],
    competitor_urls: Optional[List[str]],
) -> Dict[str, Any]:
    site_payload: Dict[str, Any] = {
        "url": app_url or "",
        "title": "",
        "description": "",
        "headings": [],
        "features": [],
        "content_excerpt": "",
        "crawl_context": "",
    }

    if site_data:
        site_payload["url"] = site_data.get("url") or (app_url or "")
        site_payload["title"] = _truncate(site_data.get("title", ""), 160)
        site_payload["description"] = _truncate(site_data.get("description", ""), 400)
        site_payload["headings"] = (site_data.get("headings") or [])[:12]
        site_payload["features"] = (site_data.get("features") or [])[:16]
        site_payload["content_excerpt"] = _truncate(site_data.get("content", ""), 2400)
        try:
            site_payload["crawl_context"] = _truncate(format_crawled_content_for_prompt(site_data), 3500)
        except Exception:
            site_payload["crawl_context"] = ""

    competitors_payload: List[Dict[str, Any]] = []
    for c in competitor_data[:6]:
        competitors_payload.append(
            {
                "url": c.get("url", ""),
                "title": _truncate(c.get("title", ""), 160),
                "description": _truncate(c.get("description", ""), 400),
                "headings": (c.get("headings") or [])[:10],
                "features": (c.get("features") or [])[:14],
                "content_excerpt": _truncate(c.get("content", ""), 1800),
            }
        )

    return {
        "request": {
            "app_name": app_name,
            "app_type": app_type,
            "doc_type": doc_type,
            "feature_description": feature_description,
            "target_audience": target_audience,
            "technical_level": technical_level,
            "style": style,
            "tone": tone,
            "language": language,
            "format": output_format,
        },
        "site": site_payload,
        "competitors": competitors_payload,
        "brand_visibility_evidence": brand_visibility_evidence,
        "competitor_brand_visibility_evidence": competitor_brand_visibility_evidence,
        "inputs": {
            "app_url": app_url or "",
            "competitor_urls": competitor_urls or [],
        },
    }


async def generate_documentation(
    app_name: str,
    app_type: str,
    doc_type: str,
    feature_description: str,
    technical_level: str = "intermediate",
    style: str = "tutorial",
    tone: str = "technical",
    language: str = "en",
    include_code_examples: bool = True,
    include_screenshots: bool = False,
    target_audience: str = "developers",
    output_format: str = "markdown",
    app_url: Optional[str] = None,
    competitor_urls: Optional[List[str]] = None,
    enable_js_render: bool = False,
) -> Dict[str, Any]:
    """
    Returns a dict with
    content string
    brand_visibility_evidence list
    competitor_brand_visibility_evidence list
    evidence_summary dict
    """

    normalized_app_url = _normalize_url(app_url)
    normalized_competitors: List[str] = []
    if competitor_urls:
        for u in competitor_urls:
            nu = _normalize_url(u)
            if nu:
                normalized_competitors.append(nu)

    doc_type_norm = _normalize_doc_type(doc_type)
    format_norm = _normalize_format(output_format)

    site_data: Optional[Dict[str, Any]] = None
    crawl_available = False

    if normalized_app_url:
        try:
            site_data = await crawl_and_extract(normalized_app_url, use_js_render=enable_js_render)
            if site_data:
                crawl_available = bool(site_data.get("content"))
        except Exception:
            site_data = None
            crawl_available = False

    competitor_data: List[Dict[str, Any]] = []
    if normalized_competitors:
        try:
            competitor_data = await crawl_competitors(
                normalized_competitors,
                max_concurrent=3,
                use_js_render=enable_js_render,
            )
        except Exception:
            competitor_data = []

    brand_visibility_evidence: List[Dict[str, Any]] = []
    competitor_brand_visibility_evidence: List[Dict[str, Any]] = []
    brand_visibility_text = ""
    competitor_brand_visibility_text = ""

    brand_name = _safe_brand_name(app_name, normalized_app_url, (site_data or {}).get("title", ""))

    if normalized_app_url:
        try:
            brand_data = await asyncio.wait_for(
                get_brand_visibility_data(
                    brand_name=brand_name,
                    website_url=normalized_app_url,
                    max_results_per_source=5,
                    include_press=True,
                    include_community=True,
                    include_dev=True,
                    include_reputation=True,
                    include_performance=False,
                    include_tech_stack=False,
                ),
                timeout=30.0,
            )
            if brand_data and brand_data.get("available"):
                formatted = format_brand_visibility_data_for_prompt(brand_data, brand_name)
                brand_visibility_text = formatted.get("text", "")
                brand_visibility_evidence = formatted.get("evidence", []) or []
        except Exception:
            brand_visibility_text = ""
            brand_visibility_evidence = []

    if normalized_competitors:

        async def _fetch_one(comp_url: str) -> List[Dict[str, Any]]:
            try:
                host = urlparse(comp_url).netloc.replace("www.", "").strip()
                comp_name = host.split(".")[0].title() if host else "Competitor"
                comp_data = await get_brand_visibility_data(
                    brand_name=comp_name,
                    website_url=comp_url,
                    max_results_per_source=3,
                    include_press=True,
                    include_community=True,
                    include_dev=True,
                    include_reputation=True,
                    include_performance=False,
                    include_tech_stack=False,
                )
                if comp_data and comp_data.get("available"):
                    formatted = format_brand_visibility_data_for_prompt(comp_data, comp_name)
                    return formatted.get("evidence", []) or []
                return []
            except Exception:
                return []

        try:
            results = await asyncio.wait_for(
                asyncio.gather(*[_fetch_one(u) for u in normalized_competitors[:3]], return_exceptions=True),
                timeout=30.0,
            )
            flat: List[Dict[str, Any]] = []
            for r in results:
                if isinstance(r, list):
                    flat.extend(r)
            competitor_brand_visibility_evidence = flat[:20]
            if competitor_brand_visibility_evidence:
                competitor_brand_visibility_text = "Competitor visibility evidence is available."
        except Exception:
            competitor_brand_visibility_evidence = []
            competitor_brand_visibility_text = ""

    evidence_summary = _build_evidence_summary(
        app_name=app_name,
        app_type=app_type,
        doc_type=doc_type_norm,
        feature_description=feature_description,
        target_audience=target_audience,
        technical_level=technical_level,
        style=style,
        tone=tone,
        language=language,
        output_format=format_norm,
        site_data=site_data,
        competitor_data=competitor_data,
        brand_visibility_evidence=brand_visibility_evidence,
        competitor_brand_visibility_evidence=competitor_brand_visibility_evidence,
        app_url=normalized_app_url,
        competitor_urls=normalized_competitors,
    )

    evidence_json = json.dumps(evidence_summary, ensure_ascii=True, indent=2)

    format_map = {
        "markdown": "Use Markdown headings, lists, and code blocks.",
        "html": "Use semantic HTML with headings, lists, and code blocks.",
        "plain_text": "Use plain text with clear spacing and section titles.",
    }
    fmt_instruction = format_map.get(format_norm, format_map["markdown"])

    min_words = 900

    system_prompt = (
        "You are an expert technical writer. "
        "You must be accurate and evidence grounded. "
        "Never invent endpoints, commands, UI labels, pricing, limits, or features. "
        "If a detail is missing in evidence, write Not available in evidence. "
        "Write for the requested audience and level. "
        "Return only valid JSON that matches the required schema."
    )

    guidance: List[str] = []
    if include_code_examples:
        guidance.append("Include code examples only when evidence supports the exact command or endpoint. Otherwise write Not available in evidence.")
    if include_screenshots:
        guidance.append("Include screenshot placeholders only as placeholders, not as claims about UI elements.")
    if style:
        guidance.append("Style requested is " + style + ".")
    if tone:
        guidance.append("Tone requested is " + tone + ".")

    user_prompt_parts: List[str] = []
    user_prompt_parts.append("Create documentation using only the evidence summary below.")
    user_prompt_parts.append("If something is not in evidence, write Not available in evidence.")
    user_prompt_parts.append("Do not cite competitors by name unless their name is present in evidence.")
    user_prompt_parts.append("Do not add any endpoints unless evidence includes them.")
    user_prompt_parts.append("Follow these extra constraints.")
    user_prompt_parts.extend(guidance)
    user_prompt_parts.append("")
    user_prompt_parts.append("Evidence summary follows.")
    user_prompt_parts.append(evidence_json)
    user_prompt_parts.append("")
    if not crawl_available and not brand_visibility_evidence:
        user_prompt_parts.append("Important: Site content is not available and brand evidence is not available.")
        user_prompt_parts.append("Treat product and audience as Unknown unless evidence supports it.")
    user_prompt_parts.append("")
    user_prompt_parts.append("Output format instruction: " + fmt_instruction)
    user_prompt_parts.append("")
    user_prompt_parts.append("Minimum length: at least " + str(min_words) + " words.")
    user_prompt_parts.append("")
    user_prompt_parts.append("Return JSON only in this schema:")
    user_prompt_parts.append('{ "content": "full documentation text" }')

    user_prompt = "\n".join(user_prompt_parts)

    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "documentation",
            "schema": {
                "type": "object",
                "properties": {"content": {"type": "string"}},
                "required": ["content"],
                "additionalProperties": False,
            },
            "strict": True,
        },
    }

    client = get_openai_client()

    model_name = "gpt" + HYPHEN + "4o"

    async def _call(messages: List[Dict[str, str]]) -> str:
        resp = await client.chat.completions.create(
            model=model_name,
            messages=messages,
            temperature=0.4,
            max_tokens=6000,
            response_format=response_format,
        )
        return (resp.choices[0].message.content or "").strip()

    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]
    raw = await _call(messages)

    doc_json: Dict[str, Any] = {}
    try:
        doc_json = json.loads(raw)
    except Exception:
        doc_json = {"content": ""}

    if _count_words(doc_json.get("content", "")) < min_words:
        retry_prompt = (
            "Your output is too short. Expand to at least "
            + str(min_words)
            + " words while staying strictly within evidence. "
            "Return JSON only with the same schema."
        )
        raw_retry = await _call(messages + [{"role": "assistant", "content": raw}, {"role": "user", "content": retry_prompt}])
        try:
            doc_json = json.loads(raw_retry)
        except Exception:
            doc_json = {"content": doc_json.get("content", "")}

    return {
        "content": (doc_json.get("content") or "").strip(),
        "brand_visibility_evidence": brand_visibility_evidence,
        "competitor_brand_visibility_evidence": competitor_brand_visibility_evidence,
        "evidence_summary": evidence_summary,
        "notes": {
            "brand_visibility_text": _truncate(brand_visibility_text, 400),
            "competitor_brand_visibility_text": _truncate(competitor_brand_visibility_text, 400),
        },
    }