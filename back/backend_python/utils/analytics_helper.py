"""
Analytics Report Generator

Generates an actionable website analytics report from:
1 Crawled site and competitors (utils.web_crawler)
2 Traffic data when available (utils.traffic_data_helper)
3 Brand visibility when available (utils.brand_visibility_helper)
4 AI research: industry benchmarks, best practices, typical metrics and tactics

The report combines crawled data with AI research to say what is wrong and what to do next.
No "evidence" or "not available" filler—actionable, research-informed advice only.

This file returns a dict in all paths. Never returns a plain string.
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

    # When Competitor Comparison is on and user provided few or no URLs, discover competitors via AI and run same pipeline
    if include_competitor_comparison and len(normalized_competitor_urls) < 3:
        try:
            discovered = await _get_top_competitor_urls_for_analytics(normalized_url)
            seen_domains = {_to_domain(u) for u in normalized_competitor_urls}
            for u in (discovered or []):
                nu = _normalize_url(u)
                if not nu or _to_domain(nu) in seen_domains:
                    continue
                seen_domains.add(_to_domain(nu))
                normalized_competitor_urls.append(nu)
                if len(normalized_competitor_urls) >= 5:
                    break
        except Exception:
            pass

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

    # Optional: industry context for structured guidance (what to compare, key metrics)
    industry_context = ""
    try:
        site_title = (website_data.get("title") or "").strip() if website_data else None
        industry_context = await _get_industry_context_for_analytics(normalized_url, site_title=site_title)
    except Exception:
        pass

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

    add_section(
        "Executive Summary",
        "Based on the crawled site and any competitor data, plus AI research (industry benchmarks, best practices for this business type): website overview, what is wrong or missing, and top 3–5 priority actions. Use the actual title, meta, content from the crawl. No paragraph about data limitations; give actionable findings and next steps informed by research.",
    )

    if include_traffic_analysis:
        add_section(
            "Traffic Analysis",
            "If traffic data is in the summary, use it and recommend changes. If not, one short line then concrete next step: e.g. 'Set up Google Analytics for [URL] and add the property to this dashboard.' No 'Not available in evidence.'",
        )

    add_section(
        "Website Performance Metrics",
        "If PageSpeed or performance data exists, cite it and recommend fixes. If not, one line then e.g. 'Run PageSpeed Insights for [URL] and fix the issues it reports.' Actionable only.",
    )

    add_section(
        "Content Analysis",
        "Use the crawled site: title, description, headings, content, features. Say what is wrong (e.g. missing meta, thin content) and what to do. If no crawl, recommend: 'Crawl [URL] to analyze content; then add meta and headings as needed.'",
    )

    add_section(
        "Brand Visibility",
        "Use brand visibility data when present (press, dev, community, reputation, and when requested performance/tech_stack). When brand visibility data is missing, focus on competitors (use competitor_brand_visibility_evidence and competitor crawl when available) and AI research (typical brand visibility, press/dev/community benchmarks for this business type) to give actionable recommendations. No 'not available' or data-availability paragraphs.",
    )

    if include_competitor_comparison:
        add_section(
            "Competitive Analysis",
            "Use crawled competitor data: compare features, positioning, titles. Name competitors and URLs. If no competitor data, one line then e.g. 'Add competitor URLs and re-run to compare.'",
        )

    if include_revenue_analysis:
        add_section(
            "Revenue Model Analysis",
            "Use pricing/revenue signals from the crawl when present. If not, one line and e.g. 'Add a clear pricing page and schema for Product/Offer.' No 'Not available in evidence.'",
        )

    add_section(
        "Marketing & Growth Analysis",
        "Use the site and competitor crawl to suggest channels and tactics. Concrete steps (e.g. add UTM tracking, run ads to [landing page]).",
    )

    add_section(
        "Technical Infrastructure",
        "Infer from crawl or say one line and next step (e.g. 'Check hosting and CDN for [URL]'). No long uncertainty paragraphs.",
    )

    add_section(
        "User Experience & Conversion",
        "Use crawl (structure, links, content) to suggest UX and conversion improvements. Concrete steps. If no data, one line and e.g. 'Add analytics and heatmaps to [URL].'",
    )

    sections_text = "\n\n".join(sections)

    evidence_summary = {
        "site": _build_site_evidence(website_data, normalized_url),
        "competitors": _build_competitor_evidence(competitor_data_list),
        "traffic_data": _truncate_text(traffic_data_text, 2000),
        "competitor_traffic_data": _truncate_text(competitor_traffic_data_text, 2000),
        "brand_visibility_evidence": brand_visibility_evidence,
        "competitor_brand_visibility_evidence": competitor_brand_evidence,
        "industry_context": industry_context,
        "notes": {
            "crawl_available": bool(crawl_available),
            "brand_visibility_text_available": bool(brand_visibility_text),
            "competitor_crawl_available": bool(competitor_data_list),
        },
    }
    evidence_json = json.dumps(evidence_summary, ensure_ascii=True, indent=2)
    brand_visibility_no_data_hint = ""
    if not brand_visibility_text and not brand_visibility_evidence:
        brand_visibility_no_data_hint = (
            "\nNote: Brand visibility returned no data (brand_visibility_evidence is empty). "
            "For the 'Brand Visibility' section focus on competitors (use competitor data when available) and AI research (typical brand visibility, press/dev/community benchmarks for this industry) to give actionable recommendations. Do not write 'not available' or data-availability paragraphs.\n\n"
        )

    system_prompt = f"""
You are an expert digital marketing analyst and business intelligence consultant.

Use AI research to enrich the report: conduct research using your knowledge where it helps—e.g. industry benchmarks for this business type, typical conversion rates, best practices for SaaS/ecommerce/content sites, common competitor tactics, SEO and performance norms. Combine that research with the crawled site and competitor data so recommendations are both data-driven and informed by best practices and benchmarks.
Use the crawled site (title, meta, headings, content, features, links) and competitor crawl when provided. Give actionable advice: what is wrong and what to do next.
Do not write "Not available in evidence" or "Data Availability" or long paragraphs about missing data. If data for a section is missing, give one short line and 1–2 concrete next steps (e.g. "Set up Google Analytics for [URL]" or "Add competitor URLs and re-run").
Do not add Evidence lines or "evidence suggests." Use the actual data from the summary and your research to give clear, actionable recommendations.
Reference competitors by name and URL when competitor data is in the summary. Be specific: which page, which fix, which tool.
Minimum length: {depth_instruction}
Language: {language}
""".strip()

    user_prompt = f"""
Analyze the website and produce a comprehensive analytics report. Use AI research (industry benchmarks, best practices, typical metrics for this business type) together with the data below to make recommendations actionable and well-informed. When industry_context is present in the data, use it to focus comparisons and key metrics.

Website URL
{normalized_url}
{brand_visibility_no_data_hint}Data we have (crawl, competitors, traffic, brand visibility when available; industry_context when present):
{evidence_json}

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
        parts: List[str] = []
        for s in report_json.get("sections", []) or []:
            if isinstance(s, dict):
                title = (s.get("title") or "").strip()
                content = (s.get("content") or "").strip()
                if title and content:
                    parts.append(f"## {title}\n\n{content}")
                elif content:
                    parts.append(content)
        return "\n\n".join(parts)

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
        report_text = ""
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
                "Use the crawl and competitor data; give actionable recommendations without Evidence lines."
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
            try:
                report_json = json.loads(raw_report)
                if report_json:
                    report_text = _build_report_text(report_json)
            except Exception:
                pass

        return {
            "report": report_text if report_text else raw_report,
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


async def ai_rewrite_analytics_content(
    original_content: str,
    rewrite_type: str = "improve",
    website_url: Optional[str] = None,
) -> str:
    """Context-specific rewrite for website analytics reports: clarity, executive summary, recommendations, competitor/revenue language."""
    try:
        client = get_openai_client()
        url_context = f" Website URL (for context): {website_url}" if website_url else ""
        prompt = f"""Rewrite the following website analytics report. Focus: {rewrite_type}.
{url_context}

Keep the same structure (sections and headings). Improve clarity, actionability, and business intelligence tone. Preserve metrics, competitor names, and concrete recommendations; make executive summary punchy and recommendations specific (what to do, which URLs or tools). Do not add generic filler or "evidence" language.

Original report:
{_truncate_text(original_content, 12000)}
"""
        response = await client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert business intelligence and analytics report writer. Rewrite for clarity and actionability; keep analytics context (traffic, competitors, revenue, strategic recommendations).",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=8000,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        return f"Error rewriting analytics content: {str(e)}"


def analytics_quality_check(
    report: str,
    website_url: str,
    include_traffic_analysis: bool = True,
    include_competitor_comparison: bool = True,
    include_revenue_analysis: bool = True,
) -> Dict[str, Any]:
    """Context-specific quality check for analytics reports: expected sections and actionable content."""
    issues: List[str] = []
    quality_score = 100
    report_lower = (report or "").lower()

    word_count = len([w for w in (report or "").split() if w.strip()])
    if word_count < 800:
        issues.append("Report is too short (under 800 words)")
        quality_score -= 20
    elif word_count > 6000:
        issues.append("Report may be too long (over 6000 words)")
        quality_score -= 5

    required_sections = ["Executive Summary", "Website Performance Metrics", "Content Analysis", "Brand Visibility", "Marketing & Growth Analysis", "Technical Infrastructure", "User Experience & Conversion"]
    if include_traffic_analysis:
        required_sections.append("Traffic Analysis")
    if include_competitor_comparison:
        required_sections.append("Competitive Analysis")
    if include_revenue_analysis:
        required_sections.append("Revenue Model Analysis")

    found = [s for s in required_sections if s.lower() in report_lower]
    if len(found) < len(required_sections) * 0.8:
        issues.append(f"Missing key sections (found {len(found)}/{len(required_sections)})")
        quality_score -= 20

    if "executive summary" not in report_lower:
        issues.append("Missing Executive Summary")
        quality_score -= 10
    if "strategic recommendation" not in report_lower and "recommendation" not in report_lower:
        issues.append("Missing actionable recommendations")
        quality_score -= 15
    if include_competitor_comparison and "competitor" not in report_lower and "competitive" not in report_lower:
        issues.append("Missing competitor/competitive analysis content")
        quality_score -= 10

    quality_score = max(0, quality_score)
    return {
        "word_count": word_count,
        "sections_found": len(found),
        "quality_score": quality_score,
        "issues": issues,
        "status": "excellent" if quality_score >= 90 else "good" if quality_score >= 70 else "needs_improvement",
        "has_executive_summary": "executive summary" in report_lower,
        "has_traffic_section": "traffic" in report_lower,
        "has_competitor_section": "competitor" in report_lower or "competitive" in report_lower,
        "has_revenue_section": "revenue" in report_lower or "revenue model" in report_lower,
        "has_strategic_recommendations": "strategic" in report_lower and "recommendation" in report_lower,
        "has_tools_monitoring": "tools" in report_lower or "monitoring" in report_lower,
        "has_meta_tags": False,
        "has_schema": False,
        "has_keywords": "recommendation" in report_lower or "metric" in report_lower,
        "has_competitor_analysis": "competitor" in report_lower or "competitive" in report_lower,
    }


async def generate_analytics_ai_recommendations(
    website_url: str,
    analytics_report: str,
    include_traffic_analysis: bool = True,
    include_competitor_comparison: bool = True,
    include_revenue_analysis: bool = True,
) -> str:
    """Context-specific prioritized recommendations derived from the analytics report (traffic, competitors, revenue, monitoring)."""
    try:
        client = get_openai_client()
        context = []
        if include_traffic_analysis:
            context.append("traffic and engagement")
        if include_competitor_comparison:
            context.append("competitor comparison")
        if include_revenue_analysis:
            context.append("revenue and pricing")
        context_str = ", ".join(context) if context else "analytics"

        prompt = f"""Generate prioritized, actionable recommendations from this website analytics report.
Website: {website_url}
Report focus: {context_str}

Analytics report (excerpt):
{_truncate_text(analytics_report, 5000)}

Rules:
- Derive recommendations only from the report: traffic, competitors, revenue, UX, marketing, tools. Be specific (which URL, which tool, which metric to add).
- Each recommendation: what to do, why, and 1–2 implementation steps. No generic advice like "conduct an audit" without a concrete next step.
- Order by impact. Use the report's data and competitor names/URLs when present.
- Return markdown with clear headings and bullet points.
"""
        response = await client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert digital marketing and business intelligence consultant. Output only actionable, context-specific recommendations from the analytics report.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=2500,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        return f"# Error Generating Analytics Recommendations\n\nError: {str(e)}"


async def _get_industry_context_for_analytics(
    website_url: str,
    site_title: Optional[str] = None,
) -> str:
    """Infer industry, business type, and analysis focus from URL and site title. Return a short blob for the report prompt."""
    try:
        client = get_openai_client()
        domain = (urlparse(website_url).netloc or "").replace("www.", "") if website_url else ""
        prompt = f"Website: {website_url} (domain: {domain})."
        if site_title:
            prompt += f" Site title: {site_title}."
        prompt += (
            " From the URL and title alone, infer and output in 2–4 short sentences: "
            "(1) likely industry/vertical and business type (e.g. SaaS, ecommerce, content, agency), "
            "(2) what to compare against competitors (e.g. traffic sources, positioning, pricing, features), "
            "(3) 1–2 key metrics or dimensions to focus on for this type of business. Plain text, no bullets or labels."
        )
        resp = await client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {
                    "role": "system",
                    "content": "You are a business intelligence analyst. Infer industry and business type from the URL and site title. Output only the requested short context, no preamble.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=250,
        )
        raw = (resp.choices[0].message.content or "").strip()
        return _truncate_text(raw, 500) if raw else ""
    except Exception:
        return ""


async def _get_top_competitor_urls_for_analytics(website_url: str) -> List[str]:
    """Return 3 real competitor homepage URLs (same industry) for analytics comparison."""
    try:
        client = get_openai_client()
        domain = (urlparse(website_url).netloc or "").replace("www.", "") if website_url else ""
        resp = await client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {
                    "role": "system",
                    "content": "You are a business intelligence analyst. Return a JSON array of exactly 3 competitor website homepage URLs. They must be real, live sites in the same industry/niche. Return only valid JSON, e.g. [\"https://example.com\", \"https://example2.com\"].",
                },
                {
                    "role": "user",
                    "content": f"Site: {website_url} (domain: {domain}). Return a JSON array of 3 competitor homepage URLs.",
                },
            ],
            temperature=0.3,
            max_tokens=400,
        )
        raw = (resp.choices[0].message.content or "").strip()
        if "[" in raw and "]" in raw:
            start, end = raw.index("["), raw.rindex("]") + 1
            arr = json.loads(raw[start:end])
            if isinstance(arr, list):
                return [u for u in arr if isinstance(u, str) and u.startswith(("http://", "https://"))][:3]
    except Exception:
        pass
    return []


async def generate_analytics_action_points(
    website_url: str,
    analytics_report: str,
    include_traffic_analysis: bool = True,
    include_competitor_comparison: bool = True,
    include_revenue_analysis: bool = True,
    crawled_data: Optional[Dict[str, Any]] = None,
    competitor_urls: Optional[List[str]] = None,
    competitor_crawl_data: Optional[Dict[str, Any]] = None,
    discover_and_crawl_competitor: bool = True,
    use_js_render: bool = False,
) -> str:
    """
    Recommendations for Website Analytics: extract recommendations from each section of the
    analytics report. Uses AI (LLM) to extract and organize by report section. When competitor
    data is available (from request or AI-discovered and crawled), passes it into the prompt
    so recommendations—especially Competitive Analysis—can be grounded with concrete examples.
    Output matches report sections only; no extra sections.
    """
    try:
        client = get_openai_client()

        # Use competitor crawl from route, or discover one via AI and crawl when comparison is on
        if competitor_crawl_data is None and include_competitor_comparison and discover_and_crawl_competitor:
            urls_to_try = competitor_urls or await _get_top_competitor_urls_for_analytics(website_url)
            for first_url in (urls_to_try or [])[:1]:
                try:
                    u = first_url.strip()
                    if not u.startswith(("http://", "https://")):
                        u = f"https://{u}"
                    u = u.rstrip("/")
                    competitor_crawl_data = await crawl_and_extract(u, use_js_render=use_js_render)
                    if competitor_crawl_data:
                        competitor_crawl_data["url"] = u
                        break
                except Exception:
                    continue

        competitor_block = ""
        if competitor_crawl_data:
            c_url = competitor_crawl_data.get("url", "")
            c_title = competitor_crawl_data.get("title", "") or ""
            c_desc = competitor_crawl_data.get("description", "") or ""
            c_features = (competitor_crawl_data.get("features") or [])[:8]
            competitor_block = f"""

Competitor page (crawled; use only to make recommendations more concrete when the report mentions competitors):
URL: {c_url}
Title: {c_title}
Description: {c_desc}
Features: {', '.join(c_features) if c_features else '—'}

When extracting recommendations from the report, you may reference this competitor (e.g. "Competitor does X; apply similar to {website_url}") only where the report already mentions competitors or competitive analysis. Do not add new recommendations; only clarify or ground what is in the report.
"""

        report_excerpt = _truncate_text(analytics_report, 6000)
        section_list = "Executive Summary, Traffic Analysis, Website Performance Metrics, Content Analysis, Brand Visibility, Competitive Analysis, Revenue Model Analysis, Marketing & Growth Analysis, Technical Infrastructure, User Experience & Conversion"

        prompt = f"""Extract RECOMMENDATIONS from this Website Analytics report. Output must match the report's sections and contain only recommendations that appear in the report.

Website: {website_url}

Analytics Report:
{report_excerpt}
{competitor_block}

RULES:
1. Use only the section names that actually appear in the report above. Section names (in report order): {section_list}.
2. For each section that exists in the report, output a heading "## [exact section name]" then list the recommendations from that section only. Use the same order as the report.
3. Do not add any section, heading, or content that is not in the report. Do not invent recommendations. Copy or paraphrase only what the report says. If competitor data is provided above, you may use it only to make existing recommendations more concrete (e.g. name the competitor, cite their approach); do not add new recommendations.
4. Do not add "Tools and Resources", "Action points", or any extra block at the end. Only sections that are in the report.

OUTPUT FORMAT (Markdown):
## [Section name from report]
- [Recommendation from that section]
- [Next recommendation from that section]

## [Next section name from report]
- [Recommendation from that section]
...

Continue for every section that appears in the report. Nothing else."""

        response = await client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o"),
            messages=[
                {
                    "role": "system",
                    "content": "You are a business intelligence analyst. Extract recommendations from the Website Analytics report. Output must match the report sections exactly (Executive Summary, Traffic Analysis, Website Performance Metrics, Content Analysis, Brand Visibility, Competitive Analysis, Revenue Model Analysis, Marketing & Growth Analysis, Technical Infrastructure, User Experience & Conversion). For each section in the report, list only the recommendations that appear in that section. If competitor data is provided, use it only to ground or clarify those recommendations; do not add sections or content that are not in the report. Do not add Tools and Resources or Action points.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=4000,
        )
        return (response.choices[0].message.content or "").strip()
    except Exception as e:
        return f"# Error Generating Recommendations\n\nError: {str(e)}"