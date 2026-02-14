"""
Analytics Report Generator

Generates a structured, evidence grounded website analytics report using
1 Website crawl evidence from utils.web_crawler
2 Traffic data evidence from utils.traffic_data_helper
3 Brand visibility evidence from utils.brand_visibility_helper

Important
This file returns a dict in all paths
Never returns a plain string
"""

import os
import asyncio
import json
import re
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from openai import AsyncOpenAI

from utils.web_crawler import crawl_and_extract, format_crawled_content_for_prompt, crawl_competitors
from utils.traffic_data_helper import get_traffic_data_for_domain, format_traffic_data_for_prompt
from utils.brand_visibility_helper import get_brand_visibility_data, format_brand_visibility_data_for_prompt


load_dotenv()


def get_openai_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "sk-placeholder" or api_key.startswith("sk-placeholder"):
        raise ValueError(
            "OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file. "
            "Get your API key from https://platform.openai.com/api-keys"
        )
    return AsyncOpenAI(api_key=api_key)


def _normalize_url(u: str) -> str:
    u = (u or "").strip()
    if not u:
        return ""
    if not u.startswith(("http://", "https://")):
        u = f"https://{u}"
    return u.rstrip("/")


def _to_domain(u: str) -> str:
    try:
        p = urlparse(u)
        host = (p.netloc or "").replace("www.", "")
        return host if host else u.replace("www.", "")
    except Exception:
        return u.replace("www.", "")


def _truncate_text(text: str, max_chars: int) -> str:
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 3].rstrip() + "..."


def _extract_sentences(text: str, max_sentences: int = 3) -> List[str]:
    if not text:
        return []
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in sentences if s.strip()][:max_sentences]


def _extract_pricing_signals(content: str) -> List[str]:
    if not content:
        return []
    signals: List[str] = []
    for sentence in _extract_sentences(content, max_sentences=10):
        lower = sentence.lower()
        if "$" in sentence or "pricing" in lower or "plan" in lower or "per month" in lower or "per user" in lower:
            signals.append(_truncate_text(sentence, 200))
    return signals[:3]


def _extract_trust_signals(content: str) -> List[str]:
    if not content:
        return []
    signals: List[str] = []
    for sentence in _extract_sentences(content, max_sentences=12):
        lower = sentence.lower()
        if any(k in lower for k in ["testimonial", "review", "case study", "trusted by", "customers", "ratings"]):
            signals.append(_truncate_text(sentence, 200))
    return signals[:3]


def _extract_quotes(content: str, source_url: str, max_quotes: int = 3) -> List[Dict[str, str]]:
    quotes: List[Dict[str, str]] = []
    for sentence in _extract_sentences(content, max_sentences=max_quotes * 2):
        if len(sentence) >= 40:
            quotes.append({"quote": _truncate_text(sentence, 220), "source": source_url})
        if len(quotes) >= max_quotes:
            break
    return quotes


def _build_site_evidence(data: Optional[Dict[str, Any]], fallback_url: str) -> Dict[str, Any]:
    if not data:
        return {
            "url": fallback_url,
            "title": "",
            "description": "",
            "headings": [],
            "features": [],
            "pricing_signals": [],
            "trust_signals": [],
            "quotes": [],
        }
    content = data.get("content", "") or ""
    url = data.get("url") or fallback_url
    return {
        "url": url,
        "title": _truncate_text(data.get("title", "") or "", 160),
        "description": _truncate_text(data.get("description", "") or "", 400),
        "headings": (data.get("headings") or [])[:10],
        "features": (data.get("features") or [])[:12],
        "pricing_signals": _extract_pricing_signals(content),
        "trust_signals": _extract_trust_signals(content),
        "quotes": _extract_quotes(content, url, max_quotes=5),
    }


def _build_competitor_evidence(data_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    competitors: List[Dict[str, Any]] = []
    for data in (data_list or [])[:6]:
        content = data.get("content", "") or ""
        url = data.get("url", "") or ""
        competitors.append(
            {
                "name": _truncate_text(data.get("title", "") or "", 160),
                "url": url,
                "description": _truncate_text(data.get("description", "") or "", 400),
                "headings": (data.get("headings") or [])[:8],
                "features": (data.get("features") or [])[:12],
                "pricing_signals": _extract_pricing_signals(content),
                "trust_signals": _extract_trust_signals(content),
                "quotes": _extract_quotes(content, url, max_quotes=4),
            }
        )
    return competitors


async def generate_analytics_report(
    website_url: str,
    competitor_urls: Optional[List[str]] = None,
    analysis_depth: str = "comprehensive",
    include_revenue_analysis: bool = True,
    include_traffic_analysis: bool = True,
    include_competitor_comparison: bool = True,
    language: str = "en",
    enable_js_render: bool = False,
) -> Dict[str, Any]:
    normalized_url = _normalize_url(website_url)
    if not normalized_url:
        return {
            "report": "",
            "brand_visibility_evidence": [],
            "competitor_brand_visibility_evidence": [],
            "error": {"type": "validation_error", "message": "website_url is required"},
        }

    normalized_competitor_urls: List[str] = []
    if competitor_urls:
        for u in competitor_urls:
            nu = _normalize_url(u)
            if nu:
                normalized_competitor_urls.append(nu)

    website_data: Optional[Dict[str, Any]] = None
    website_context = ""
    crawl_available = False

    try:
        website_data = await crawl_and_extract(normalized_url, use_js_render=enable_js_render)
        if website_data:
            website_context = format_crawled_content_for_prompt(website_data) or ""
            crawl_available = bool(website_data.get("content"))
        else:
            website_context = (
                f"Note: Could not fetch content from {normalized_url}. "
                "The site may block crawlers or require authentication."
            )
    except Exception as e:
        website_context = (
            f"Note: Could not crawl website {normalized_url} ({str(e)}). "
            "Analysis will proceed with available information."
        )

    traffic_data_text = ""
    if include_traffic_analysis:
        try:
            main_domain = _to_domain(normalized_url)
            traffic_data = await get_traffic_data_for_domain(main_domain)
            if isinstance(traffic_data, dict) and traffic_data.get("available"):
                traffic_data_text = format_traffic_data_for_prompt(traffic_data, normalized_url) or ""
        except Exception:
            traffic_data_text = ""

    competitor_traffic_data_text = ""
    if normalized_competitor_urls and include_competitor_comparison and include_traffic_analysis:
        try:
            parts: List[str] = []
            for comp_url in normalized_competitor_urls:
                comp_domain = _to_domain(comp_url)
                comp_traffic = await get_traffic_data_for_domain(comp_domain)
                if isinstance(comp_traffic, dict) and comp_traffic.get("available"):
                    parts.append(format_traffic_data_for_prompt(comp_traffic, comp_url) or "")
            competitor_traffic_data_text = "\n".join([p for p in parts if p])
        except Exception:
            competitor_traffic_data_text = ""

    brand_visibility_data: Optional[Dict[str, Any]] = None
    brand_visibility_text = ""
    brand_visibility_evidence: List[Dict[str, Any]] = []

    competitor_brand_visibility_text = ""
    competitor_brand_evidence: List[Dict[str, Any]] = []

    try:
        parsed = urlparse(normalized_url)
        domain = (parsed.netloc or "").replace("www.", "")
        brand_name = (domain.split(".")[0] if domain else "Brand").title()

        if website_data and website_data.get("title"):
            t = (website_data.get("title") or "").strip()
            if t:
                brand_name = t.split("|")[0].split("-")[0].strip()[:50] or brand_name

        try:
            brand_visibility_data = await asyncio.wait_for(
                get_brand_visibility_data(
                    brand_name=brand_name,
                    website_url=normalized_url,
                    max_results_per_source=5,
                    include_press=True,
                    include_community=True,
                    include_dev=True,
                    include_reputation=True,
                    include_performance=True,
                    include_tech_stack=False,
                ),
                timeout=25.0,
            )
        except asyncio.TimeoutError:
            brand_visibility_data = None

        if brand_visibility_data:
            formatted = format_brand_visibility_data_for_prompt(brand_visibility_data, brand_name)
            brand_visibility_text = formatted.get("text", "") or ""
            brand_visibility_evidence = formatted.get("evidence", []) or []
    except Exception:
        brand_visibility_text = ""
        brand_visibility_evidence = []

    if normalized_competitor_urls and include_competitor_comparison:
        try:
            competitor_tasks: List[asyncio.Task] = []
            competitor_info: List[Dict[str, str]] = []
            for comp_url in normalized_competitor_urls:
                parsed_comp = urlparse(comp_url)
                comp_domain = (parsed_comp.netloc or "").replace("www.", "")
                comp_brand = (comp_domain.split(".")[0] if comp_domain else "Competitor").title()
                competitor_info.append({"url": comp_url, "brand": comp_brand})
                competitor_tasks.append(
                    asyncio.create_task(
                        get_brand_visibility_data(
                            brand_name=comp_brand,
                            website_url=comp_url,
                            max_results_per_source=3,
                            include_press=True,
                            include_community=True,
                            include_dev=True,
                            include_reputation=True,
                            include_performance=False,
                            include_tech_stack=False,
                        )
                    )
                )

            try:
                results = await asyncio.wait_for(asyncio.gather(*competitor_tasks, return_exceptions=True), timeout=30.0)
            except asyncio.TimeoutError:
                results = []

            parts: List[str] = []
            for idx, res in enumerate(results):
                if isinstance(res, Exception) or not isinstance(res, dict):
                    continue
                if not res.get("available"):
                    continue
                info = competitor_info[idx] if idx < len(competitor_info) else {"url": "", "brand": "Competitor"}
                formatted = format_brand_visibility_data_for_prompt(res, info["brand"])
                txt = formatted.get("text", "") or ""
                if txt:
                    parts.append(f"COMPETITOR: {info['url']}\n{txt}")
                competitor_brand_evidence.extend(formatted.get("evidence", []) or [])

            competitor_brand_visibility_text = "\n\n".join(parts)
        except Exception:
            competitor_brand_visibility_text = ""
            competitor_brand_evidence = []

    competitor_data_list: List[Dict[str, Any]] = []
    competitor_analysis = ""
    if normalized_competitor_urls and include_competitor_comparison:
        try:
            competitor_data_list = await crawl_competitors(
                normalized_competitor_urls,
                max_concurrent=3,
                use_js_render=enable_js_render,
            )
            if competitor_data_list:
                competitor_parts: List[str] = []
                competitor_parts.append("COMPETITOR ANALYSIS DATA")
                competitor_parts.append(f"Competitors crawled: {len(competitor_data_list)}")
                competitor_parts.append("")
                for idx, c in enumerate(competitor_data_list, 1):
                    comp_lines: List[str] = [f"COMPETITOR {idx}"]
                    if c.get("url"):
                        comp_lines.append(f"URL: {c.get('url')}")
                    if c.get("title"):
                        comp_lines.append(f"Title: {c.get('title')}")
                    if c.get("description"):
                        comp_lines.append(f"Description: {_truncate_text(c.get('description') or '', 500)}")
                    if c.get("features"):
                        comp_lines.append("Features:")
                        for f in (c.get("features") or [])[:20]:
                            comp_lines.append(f"* {f}")
                    if c.get("headings"):
                        comp_lines.append("Headings:")
                        for h in (c.get("headings") or [])[:12]:
                            comp_lines.append(f"* {h}")
                    if c.get("content"):
                        comp_lines.append("Content excerpt:")
                        comp_lines.append(_truncate_text(c.get("content") or "", 2200))
                    competitor_parts.append("\n".join(comp_lines))
                    competitor_parts.append("")
                competitor_analysis = "\n".join(competitor_parts)
            else:
                competitor_analysis = "Note: Competitor crawl not available."
        except Exception as e:
            competitor_analysis = f"Note: Could not analyze competitors ({str(e)})."

    depth_instructions = {
        "quick": "Provide a high level overview with key metrics and top recommendations. Keep it concise (800 to 1200 words).",
        "standard": "Provide a detailed analysis with metrics, insights, and actionable recommendations (1500 to 2500 words).",
        "comprehensive": "Provide an exhaustive analysis with detailed metrics, deep insights, and comprehensive recommendations (3000 to 4000 words).",
        "deep": "Provide an extremely detailed analysis with extensive metrics, strategic insights, and detailed implementation plans (4000 plus words).",
    }
    depth_instruction = depth_instructions.get(analysis_depth, depth_instructions["comprehensive"])
    min_words = 800 if analysis_depth == "quick" else 2000

    required_section_titles: List[str] = []
    sections: List[str] = []
    section_num = 1

    def add_section(title: str, body: str) -> None:
        nonlocal section_num
        sections.append(f"{section_num}. **{title}** {body}")
        required_section_titles.append(title)
        section_num += 1

    data_availability_required = (not crawl_available) and (not brand_visibility_text)

    if data_availability_required:
        add_section(
            "Data Availability",
            "List which data sources were available and which were missing. "
            "Explicitly mark product, audience, and revenue model as Unknown if not supported by evidence.",
        )

    add_section(
        "Executive Summary",
        "Website overview, key KPIs, top insights, and priority recommendations grounded in evidence.",
    )

    if include_traffic_analysis:
        add_section(
            "Traffic Analysis",
            "Use real traffic evidence if provided. If not available, mark as Not available in evidence and avoid inventing numbers.",
        )

    add_section(
        "Website Performance Metrics",
        "Performance and UX signals. If PageSpeed evidence exists, cite it. Otherwise mark as Not available in evidence.",
    )

    add_section(
        "Content Analysis",
        "Content quality, structure, gaps, and opportunities grounded in crawl evidence only.",
    )

    add_section(
        "Brand Visibility & Technical Signals",
        "Summarize brand visibility evidence, reputation signals, and technical signals if available. Provide evidence tied insights.",
    )

    if include_competitor_comparison:
        add_section(
            "Competitive Analysis",
            "List competitors analyzed, then compare features and positioning using only crawled competitor evidence.",
        )

    if include_revenue_analysis:
        add_section(
            "Revenue Model Analysis",
            "Identify monetization signals only if present in evidence. Otherwise mark as Not available in evidence.",
        )

    add_section(
        "Marketing & Growth Analysis",
        "Channels and growth opportunities grounded in evidence. Avoid generic advice.",
    )

    add_section(
        "Technical Infrastructure",
        "Architecture and stack only if evidence supports it. Otherwise mark unknown.",
    )

    add_section(
        "User Experience & Conversion",
        "User journey and friction points grounded in evidence only.",
    )

    add_section(
        "Strategic Recommendations",
        "All recommendations must be product specific, competitor referenced when competitor evidence exists, and include an Evidence line.",
    )

    add_section(
        "Benchmarking & Industry Comparison",
        "Benchmark only what evidence supports. Otherwise use qualitative comparisons with explicit uncertainty.",
    )

    add_section(
        "Tools & Monitoring Recommendations",
        "Monitoring suggestions grounded in what is missing from evidence and what is feasible to instrument.",
    )

    sections.append(
        f"{section_num}. **References & Evidence** "
        "List every URL analyzed and every evidence source used. Call out missing data explicitly."
    )
    required_section_titles.append("References & Evidence")

    sections_text = "\n\n".join(sections)

    evidence_summary = {
        "site": _build_site_evidence(website_data, normalized_url),
        "competitors": _build_competitor_evidence(competitor_data_list),
        "traffic_data": _truncate_text(traffic_data_text, 2000),
        "competitor_traffic_data": _truncate_text(competitor_traffic_data_text, 2000),
        "brand_visibility_evidence": brand_visibility_evidence,
        "competitor_brand_visibility_evidence": competitor_brand_evidence,
        "notes": {
            "crawl_available": bool(crawl_available),
            "brand_visibility_text_available": bool(brand_visibility_text),
            "competitor_crawl_available": bool(competitor_data_list),
        },
    }
    evidence_json = json.dumps(evidence_summary, ensure_ascii=True, indent=2)

    fallback_message = ""
    if not crawl_available:
        fallback_message = (
            f"Warning: Website crawl content is not available for {normalized_url}. "
            "Do not infer product, audience, or revenue model unless supported by other evidence."
        )

    system_prompt = f"""
You are an expert digital marketing analyst and business intelligence consultant.

Hard rules
Use only the evidence summary provided
If a claim is not supported by evidence write Not available in evidence
Every recommendation must include a short Evidence line pointing to a URL or excerpt from evidence
Avoid generic advice
If competitor evidence exists reference competitors by name and URL in recommendations

Minimum length requirement
{depth_instruction}

Language
{language}
""".strip()

    user_prompt = f"""
Analyze the website and produce a comprehensive analytics report.

Website URL
{normalized_url}

Evidence summary
{evidence_json}

{fallback_message}

Return only valid JSON matching this schema
{{
  "sections": [
    {{
      "title": "Executive Summary",
      "content": "Markdown content for this section only"
    }}
  ]
}}

The sections must appear in this exact order
{", ".join(required_section_titles)}
""".strip()

    def _count_words(text: str) -> int:
        return len([w for w in (text or "").split() if w.strip()])

    def _build_report_text(report_json: Dict[str, Any]) -> str:
        contents: List[str] = []
        for s in report_json.get("sections", []) or []:
            if isinstance(s, dict):
                c = s.get("content", "")
                if c:
                    contents.append(c)
        return "\n\n".join(contents)

    def _validate_report_schema(report_json: Dict[str, Any]) -> List[str]:
        issues: List[str] = []
        sections_json = report_json.get("sections")
        if not isinstance(sections_json, list) or not sections_json:
            return ["sections array is missing or empty"]
        titles = [s.get("title") for s in sections_json if isinstance(s, dict)]
        if len(titles) != len(required_section_titles):
            issues.append("section count does not match required sections")
            return issues
        if titles != required_section_titles:
            issues.append("section order or titles do not match required sections")
        return issues

    try:
        client = get_openai_client()

        response_format = {
            "type": "json_schema",
            "json_schema": {
                "name": "analytics_report",
                "schema": {
                    "type": "object",
                    "properties": {
                        "sections": {
                            "type": "array",
                            "minItems": len(required_section_titles),
                            "maxItems": len(required_section_titles),
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": {"type": "string", "enum": required_section_titles},
                                    "content": {"type": "string"},
                                },
                                "required": ["title", "content"],
                                "additionalProperties": False,
                            },
                        }
                    },
                    "required": ["sections"],
                    "additionalProperties": False,
                },
                "strict": True,
            },
        }

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        response = await client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=messages,
            temperature=0.7,
            max_tokens=7000,
            frequency_penalty=0.1,
            presence_penalty=0.05,
            seed=42,
            response_format=response_format,
        )

        raw_report = (response.choices[0].message.content or "").strip()

        report_json: Optional[Dict[str, Any]] = None
        try:
            report_json = json.loads(raw_report)
        except Exception:
            report_json = None

        needs_retry = True
        if report_json:
            issues = _validate_report_schema(report_json)
            report_text = _build_report_text(report_json)
            if (not issues) and (_count_words(report_text) >= min_words):
                needs_retry = False

        if needs_retry:
            follow_up = (
                "Fix the output to meet strict JSON schema. "
                f"Use exact section order: {', '.join(required_section_titles)}. "
                f"Ensure at least {min_words} words across section contents. "
                "Use only evidence and add Evidence lines for recommendations."
            )

            response2 = await client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o"),
                messages=messages + [
                    {"role": "assistant", "content": raw_report},
                    {"role": "user", "content": follow_up},
                ],
                temperature=0.7,
                max_tokens=7000,
                frequency_penalty=0.1,
                presence_penalty=0.05,
                seed=42,
                response_format=response_format,
            )
            raw_report = (response2.choices[0].message.content or "").strip()

        return {
            "report": raw_report,
            "brand_visibility_evidence": brand_visibility_evidence,
            "competitor_brand_visibility_evidence": competitor_brand_evidence,
        }

    except ValueError as e:
        return {
            "report": "",
            "brand_visibility_evidence": brand_visibility_evidence,
            "competitor_brand_visibility_evidence": competitor_brand_evidence,
            "error": {"type": "api_key_error", "message": str(e)},
        }

    except Exception as e:
        return {
            "report": "",
            "brand_visibility_evidence": brand_visibility_evidence,
            "competitor_brand_visibility_evidence": competitor_brand_evidence,
            "error": {"type": type(e).__name__, "message": str(e)},
        }