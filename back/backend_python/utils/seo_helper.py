"""
utils/seo_helper.py

Updates included
Section 1 Brand visibility integration that stays useful for SEO
Keeps router output shape the same
brand_visibility_evidence remains a list of dicts

Section 2 Technical evidence pack is always collected
Prevents empty Technical SEO sections when crawl is blocked
"""

import os
import asyncio
import json
import re
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse, urljoin

import aiohttp
from dotenv import load_dotenv
from openai import AsyncOpenAI

from utils.web_crawler import (
    crawl_and_extract,
    analyze_keyword_rankings,
    get_competitor_high_volume_keywords,
    cluster_keywords_by_intent_difficulty_opportunity,
    discover_related_sites,
)

from utils.brand_visibility_helper import (
    get_brand_visibility_data,
    format_brand_visibility_data_for_prompt,
)

load_dotenv()


def get_openai_client() -> AsyncOpenAI:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "sk-placeholder" or api_key.startswith("sk-placeholder"):
        raise ValueError(
            "OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file. "
            "Get your API key from https://platform.openai.com/api-keys"
        )
    return AsyncOpenAI(api_key=api_key)


_DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; InsightIQBot/1.0; +https://myinsightiq.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _safe_header_subset(headers: "aiohttp.typedefs.LooseHeaders") -> Dict[str, str]:
    keep = {
        "content-type",
        "cache-control",
        "content-security-policy",
        "x-robots-tag",
        "strict-transport-security",
        "x-frame-options",
        "x-content-type-options",
        "referrer-policy",
        "permissions-policy",
    }
    out: Dict[str, str] = {}
    for k, v in dict(headers).items():
        lk = str(k).lower()
        if lk in keep:
            out[lk] = str(v)[:400]
    return out


async def _fetch(
    session: aiohttp.ClientSession,
    url: str,
    timeout_s: float = 18.0,
    allow_redirects: bool = True,
) -> Dict[str, Any]:
    try:
        async with session.get(url, timeout=timeout_s, allow_redirects=allow_redirects) as resp:
            text = await resp.text(errors="ignore")
            return {
                "url": url,
                "final_url": str(resp.url),
                "status": resp.status,
                "headers": _safe_header_subset(resp.headers),
                "text": text,
            }
    except Exception as e:
        return {
            "url": url,
            "final_url": url,
            "status": None,
            "headers": {},
            "text": "",
            "error": str(e),
        }


def _extract_head_signals(html: str) -> Dict[str, Any]:
    if not html:
        return {}

    head = html
    m = re.search(r"<head\b[^>]*>(.*?)</head>", html, flags=re.IGNORECASE | re.DOTALL)
    if m:
        head = m.group(1)

    def _first(pattern: str) -> str:
        mm = re.search(pattern, head, flags=re.IGNORECASE | re.DOTALL)
        return (mm.group(1).strip() if mm and mm.group(1) else "")[:500]

    canonical = _first(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']')
    meta_robots = _first(r'<meta[^>]+name=["\']robots["\'][^>]+content=["\']([^"\']+)["\']')
    title = _first(r"<title[^>]*>(.*?)</title>")

    has_og_title = bool(re.search(r'<meta[^>]+property=["\']og:title["\']', head, flags=re.IGNORECASE))
    has_og_desc = bool(re.search(r'<meta[^>]+property=["\']og:description["\']', head, flags=re.IGNORECASE))
    has_og_image = bool(re.search(r'<meta[^>]+property=["\']og:image["\']', head, flags=re.IGNORECASE))
    has_twitter_card = bool(re.search(r'<meta[^>]+name=["\']twitter:card["\']', head, flags=re.IGNORECASE))

    hreflangs: List[Dict[str, str]] = []
    for mm in re.finditer(
        r'<link[^>]+rel=["\']alternate["\'][^>]+hreflang=["\']([^"\']+)["\'][^>]+href=["\']([^"\']+)["\']',
        head,
        flags=re.IGNORECASE,
    ):
        hreflangs.append({"hreflang": mm.group(1)[:30], "href": mm.group(2)[:400]})
    hreflangs = hreflangs[:25]

    schema_types: List[str] = []
    for mm in re.finditer(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        head,
        flags=re.IGNORECASE | re.DOTALL,
    ):
        raw = mm.group(1).strip()
        try:
            parsed = json.loads(raw)
            nodes = parsed if isinstance(parsed, list) else [parsed]
            for n in nodes:
                if isinstance(n, dict):
                    t = n.get("@type")
                    if isinstance(t, str):
                        schema_types.append(t)
                    elif isinstance(t, list):
                        schema_types.extend([x for x in t if isinstance(x, str)])
        except Exception:
            continue
    schema_types = list(dict.fromkeys(schema_types))[:25]

    return {
        "head_title": title[:200],
        "canonical": canonical[:400],
        "meta_robots": meta_robots[:200],
        "open_graph": {
            "has_og_title": has_og_title,
            "has_og_description": has_og_desc,
            "has_og_image": has_og_image,
        },
        "twitter": {"has_twitter_card": has_twitter_card},
        "hreflang": hreflangs,
        "schema_types": schema_types,
    }


async def _fetch_robots_and_sitemap(session: aiohttp.ClientSession, root_url: str) -> Dict[str, Any]:
    robots_url = urljoin(root_url + "/", "robots.txt")
    robots = await _fetch(session, robots_url, timeout_s=12.0)

    sitemap_urls: List[str] = []
    if robots.get("text"):
        for line in robots["text"].splitlines():
            if line.lower().startswith("sitemap:"):
                sitemap_urls.append(line.split(":", 1)[1].strip())

    if not sitemap_urls:
        sitemap_urls = [urljoin(root_url + "/", "sitemap.xml")]

    sitemaps: List[Dict[str, Any]] = []
    for su in sitemap_urls[:3]:
        sitemaps.append(await _fetch(session, su, timeout_s=12.0))

    return {
        "robots": {
            "url": robots.get("final_url") or robots_url,
            "status": robots.get("status"),
            "has_sitemap_directive": any("sitemap:" in l.lower() for l in (robots.get("text") or "").splitlines()),
            "snippet": (robots.get("text") or "")[:1200],
        },
        "sitemaps": [
            {
                "url": s.get("final_url") or s.get("url"),
                "status": s.get("status"),
                "snippet": (s.get("text") or "")[:1200],
            }
            for s in sitemaps
        ],
    }


async def collect_technical_evidence(normalized_url: str) -> Dict[str, Any]:
    async with aiohttp.ClientSession(headers=_DEFAULT_HEADERS) as session:
        home = await _fetch(session, normalized_url, timeout_s=18.0)
        head_signals = _extract_head_signals(home.get("text", ""))
        robots_and_sitemap = await _fetch_robots_and_sitemap(session, normalized_url)

        return {
            "homepage_fetch": {
                "url": home.get("url"),
                "final_url": home.get("final_url"),
                "status": home.get("status"),
                "headers": home.get("headers", {}),
            },
            "head_signals": head_signals,
            "robots_and_sitemap": robots_and_sitemap,
        }


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


def _extract_quotes(text_sources: List[str], source_url: str, max_quotes: int = 3) -> List[Dict[str, str]]:
    quotes: List[Dict[str, str]] = []
    combined = " ".join([t for t in text_sources if t])
    for sentence in _extract_sentences(combined, max_sentences=max_quotes * 2):
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
            "content_excerpt": "",
            "quotes": [],
        }

    text_sources = [
        data.get("title", ""),
        data.get("description", ""),
        " ".join((data.get("headings") or [])[:10]),
        data.get("content", ""),
    ]
    url = data.get("url") or fallback_url
    return {
        "url": url,
        "title": _truncate_text(data.get("title", ""), 160),
        "description": _truncate_text(data.get("description", ""), 400),
        "headings": (data.get("headings") or [])[:10],
        "features": (data.get("features") or [])[:12],
        "content_excerpt": _truncate_text(data.get("content", ""), 1200),
        "quotes": _extract_quotes(text_sources, url, max_quotes=3),
    }


def _build_related_sites_evidence(related_data: List[Dict[str, Any]], normalized_url: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for item in related_data[:5]:
        out.append(_build_site_evidence(item, item.get("url") or normalized_url))
    return out


def _build_keyword_rankings_evidence(rankings_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not rankings_data:
        return {}
    rankings = rankings_data.get("rankings", [])
    top_rankings = []
    for r in rankings[:15]:
        top_rankings.append(
            {
                "keyword": r.get("keyword", ""),
                "found": r.get("found", False),
                "position": r.get("position"),
            }
        )
    return {
        "summary": rankings_data.get("summary", ""),
        "extracted_keywords": (rankings_data.get("extracted_keywords") or [])[:15],
        "target_keywords": (rankings_data.get("target_keywords") or [])[:15],
        "rankings": top_rankings,
        "found_count": rankings_data.get("found_count"),
        "top_10_count": rankings_data.get("top_10_count"),
        "top_3_count": rankings_data.get("top_3_count"),
        "total_checked": rankings_data.get("total_checked"),
    }


def _build_competitor_keywords_evidence(comp_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not comp_data:
        return {}
    competitors = list((comp_data.get("competitor_keywords") or {}).keys())[:6]
    high_volume = (comp_data.get("high_volume_keywords") or [])[:15]
    return {
        "competitors_analyzed": comp_data.get("competitors_crawled") or comp_data.get("competitors_found"),
        "competitor_urls": competitors,
        "high_volume_keywords": [
            {
                "keyword": k.get("keyword", ""),
                "search_volume_indicator": k.get("search_volume_indicator", k.get("autocomplete_count")),
                "related_suggestions": (k.get("related_suggestions") or k.get("suggestions") or [])[:5],
                "competitors_using": (k.get("competitors_using") or [])[:5],
            }
            for k in high_volume
        ],
    }


def _filter_brand_visibility_evidence(items: List[Dict[str, Any]], max_items: int = 20) -> List[Dict[str, Any]]:
    allow_sources = {
        "google_news",
        "google_news_rss",
        "github",
        "reddit",
        "hackernews",
        "wikipedia",
        "trustpilot",
        "g2",
        "capterra",
        "producthunt",
        "pagespeed_insights",
        "builtwith",
    }
    allow_signal_types = {"press", "community", "dev", "reputation", "performance", "tech_stack"}
    allow_confidence = {"api", "rss", "best_effort", ""}

    cleaned: List[Dict[str, Any]] = []
    for it in items or []:
        if not isinstance(it, dict):
            continue

        src = (it.get("source") or "").strip()
        url = (it.get("url") or "").strip()
        signal_type = (it.get("signal_type") or "").strip()
        confidence = (it.get("confidence") or "").strip()

        if not url:
            continue
        if src and src not in allow_sources:
            continue
        if signal_type and signal_type not in allow_signal_types:
            continue
        if confidence not in allow_confidence:
            continue

        cleaned.append(
            {
                "evidence_id": it.get("evidence_id", ""),
                "source": src,
                "url": url,
                "title": (it.get("title") or "")[:180],
                "date": (it.get("date") or "")[:50],
                "excerpt": (it.get("excerpt") or it.get("snippet") or "")[:320],
                "claim_type": (it.get("claim_type") or it.get("signal_type") or "")[:40],
                "signal_type": signal_type,
                "confidence": confidence,
                "meta": it.get("meta") or {},
            }
        )

        if len(cleaned) >= max_items:
            break

    return cleaned


async def generate_seo_report(
    website_url: str,
    business_type: str = "saas",
    target_keywords: Optional[str] = None,
    current_seo_issues: Optional[str] = None,
    focus_areas: Optional[List[str]] = None,
    language: str = "en",
    enable_js_render: bool = False,
) -> Dict[str, Any]:
    if focus_areas is None:
        focus_areas = ["on-page", "technical", "content"]

    normalized_url = website_url.strip()
    if not normalized_url.startswith(("http://", "https://")):
        normalized_url = f"https://{normalized_url}"
    normalized_url = normalized_url.rstrip("/")

    crawled_data: Optional[Dict[str, Any]] = None
    crawl_available = False
    keyword_rankings_data: Optional[Dict[str, Any]] = None
    related_sites_data: List[Dict[str, Any]] = []
    related_sites_urls: List[str] = []

    try:
        crawled_data = await crawl_and_extract(normalized_url, use_js_render=enable_js_render)
        if crawled_data:
            crawl_available = bool(crawled_data.get("content"))
    except Exception:
        crawled_data = None

    if crawled_data:
        try:
            related_sites_urls = await discover_related_sites(
                normalized_url,
                max_links=5,
                use_js_render=enable_js_render,
            )
            if related_sites_urls:
                tasks = [crawl_and_extract(u, use_js_render=enable_js_render) for u in related_sites_urls[:5]]
                try:
                    results = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=30.0)
                except asyncio.TimeoutError:
                    results = []
                for r in results:
                    if isinstance(r, dict) and r.get("content"):
                        related_sites_data.append(r)
        except Exception:
            pass

    try:
        keyword_rankings_data = await analyze_keyword_rankings(
            crawled_data=crawled_data,
            website_url=normalized_url,
            target_keywords=target_keywords,
            max_keywords=10,
        )
    except Exception:
        keyword_rankings_data = None

    competitor_keywords_data: Optional[Dict[str, Any]] = None
    try:
        competitor_keywords_data = await get_competitor_high_volume_keywords(
            website_url=normalized_url,
            max_competitors=5,
            max_keywords=10,
        )
    except Exception:
        competitor_keywords_data = None

    keyword_clusters: Optional[Dict[str, Any]] = None
    if keyword_rankings_data and keyword_rankings_data.get("rankings"):
        try:
            all_keywords = (keyword_rankings_data.get("extracted_keywords") or []) + (keyword_rankings_data.get("target_keywords") or [])
            keyword_clusters = await cluster_keywords_by_intent_difficulty_opportunity(
                keywords=all_keywords[:30],
                rankings_data=keyword_rankings_data.get("rankings", []),
                website_url=normalized_url,
            )
        except Exception:
            keyword_clusters = None

    brand_visibility_evidence: List[Dict[str, Any]] = []
    try:
        parsed = urlparse(normalized_url)
        domain = parsed.netloc.replace("www.", "")
        brand_name = domain.split(".")[0].title()

        if crawled_data and crawled_data.get("title"):
            t = crawled_data.get("title", "")
            if t:
                brand_name = t.split("|")[0].split("-")[0].strip()[:50]

        brand_visibility_data = await asyncio.wait_for(
            get_brand_visibility_data(
                brand_name=brand_name,
                website_url=normalized_url,
                max_results_per_source=5,
                include_press=True,
                include_community=True,
                include_dev=True,
                include_reputation=True,
                include_performance=False,
                include_tech_stack=False,
            ),
            timeout=25.0,
        )

        if brand_visibility_data and brand_visibility_data.get("available"):
            formatted = format_brand_visibility_data_for_prompt(brand_visibility_data, brand_name, for_seo=True)
            raw_items = formatted.get("evidence", []) if isinstance(formatted, dict) else []
            brand_visibility_evidence = _filter_brand_visibility_evidence(raw_items, max_items=20)
    except Exception:
        brand_visibility_evidence = []

    tech_evidence: Dict[str, Any] = {}
    try:
        tech_evidence = await asyncio.wait_for(collect_technical_evidence(normalized_url), timeout=25.0)
    except asyncio.TimeoutError:
        tech_evidence = {"error": "timeout"}
    except Exception as e:
        tech_evidence = {"error": str(e)}

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
        "(ALWAYS INCLUDE)\n   - Current SEO health score (0-100)\n   - Key strengths and weaknesses\n   - Priority action items",
    )

    if "technical" in focus_areas:
        add_section(
            "Technical SEO Analysis",
            "(REQUIRED)\n   - Site status and redirects\n   - robots.txt and sitemap.xml status\n   - Canonical and meta robots\n   - Schema types detected\n   - Open Graph and Twitter tags presence\n   - Security headers snapshot\n   - Specific fixes grounded in the tech evidence",
        )

    if "on-page" in focus_areas:
        add_section(
            "On-Page SEO",
            "(REQUIRED)\n   - Title tags and meta descriptions with specific examples\n   - Header tags structure\n   - Internal linking hints from evidence\n   - Page type specific recommendations",
        )

    if "content" in focus_areas:
        add_section(
            "Content SEO & Keyword Rankings",
            "(REQUIRED)\n   - Current keyword ranking performance from evidence\n   - Content gaps based on evidence\n   - Keyword cluster guidance if present",
        )

    if competitor_keywords_data and competitor_keywords_data.get("high_volume_keywords"):
        add_section(
            "Competitor Keyword Analysis & Meta-Tag Optimization",
            "(REQUIRED when competitor data exists)\n   - List competitors and URLs\n   - For each keyword: which competitor uses it\n   - Title and meta examples grounded in competitor keyword evidence",
        )

    if "accessibility" in focus_areas:
        add_section(
            "Accessibility",
            "(REQUIRED)\n   - Only include verifiable findings\n   - If no scan evidence exists, output a short unverified checklist and say it is unverified",
        )

    add_section(
        "Implementation Roadmap",
        "(ALWAYS INCLUDE)\n   - Priority 1\n   - Priority 2\n   - Priority 3",
    )
    add_section(
        "Tools and Resources",
        "(ALWAYS INCLUDE)\n   - Minimal recommended tools\n   - Monitoring setup",
    )
    add_section(
        "AI Search Visibility (AEO)",
        "(ALWAYS INCLUDE)\n   - Structured data\n   - Clear answer blocks\n   - AI ready checklist",
    )

    other_evidence_available = bool(
        (keyword_rankings_data and keyword_rankings_data.get("rankings"))
        or (competitor_keywords_data and competitor_keywords_data.get("high_volume_keywords"))
        or bool(brand_visibility_evidence)
        or bool(related_sites_data)
        or bool(tech_evidence)
    )

    data_availability_note = ""
    if not crawl_available and not other_evidence_available:
        data_availability_note = (
            "DATA WARNING: No site content evidence and no technical evidence. "
            "Return a short report requesting missing inputs."
        )

    evidence_summary = {
        "site": _build_site_evidence(crawled_data, normalized_url),
        "related_sites": _build_related_sites_evidence(related_sites_data, normalized_url),
        "tech": tech_evidence,
        "keyword_rankings": _build_keyword_rankings_evidence(keyword_rankings_data),
        "competitor_keywords": _build_competitor_keywords_evidence(competitor_keywords_data),
        "keyword_clusters": keyword_clusters if keyword_clusters and not keyword_clusters.get("error") else {},
        "brand_visibility_evidence": brand_visibility_evidence,
        "data_availability_note": data_availability_note,
    }

    evidence_json = json.dumps(evidence_summary, ensure_ascii=True, indent=2)

    fallback_message = ""
    if not crawl_available and tech_evidence and not tech_evidence.get("error"):
        fallback_message = (
            f"NOTE: Page content crawl is missing for {normalized_url}, "
            "but technical evidence exists. Use the technical evidence to produce technical fixes."
        )
    elif not crawl_available:
        fallback_message = (
            f"WARNING: Could not crawl page content from {normalized_url}. "
            "Do not infer product or audience. Use only evidence provided."
        )

    focus_areas_text = ", ".join(focus_areas)

    system_prompt = f"""You are an expert SEO consultant with deep knowledge of search engine optimization, technical SEO, content strategy, and digital marketing.

CRITICAL REQUIREMENTS:
1. PRODUCT SPECIFIC ANALYSIS
Use only evidence provided in the evidence summary.

2. EVIDENCE SOURCES
You may cite evidence from:
site content evidence
related site evidence
technical evidence pack (headers, robots, sitemap, head signals, schema types)
keyword ranking evidence
competitor keyword evidence
brand visibility evidence

3. EVIDENCE FORMAT RULE
Every section must include:
Examples from evidence
Evidence: a URL or a specific evidence object path plus a URL when available

4. EVIDENCE ONLY RULE
If a data point is not present in evidence, mark it as Not available in evidence and do not invent it.

5. SECTION QUALITY RULE
If a section has insufficient evidence to provide fixes, output only:
what could be verified
what is missing
the exact checks to run next
Do not output generic advice paragraphs.

Focus Areas: {focus_areas_text}
Business Type: {business_type}
Language: {language}"""

    user_prompt = f"""Analyze the website and return an SEO report.

Website URL: {normalized_url}
Business Type: {business_type}

{f"Target Keywords: {target_keywords}" if target_keywords else ""}
{f"Known Issues: {current_seo_issues}" if current_seo_issues else ""}

EVIDENCE SUMMARY:
{evidence_json}

{fallback_message}

Return ONLY valid JSON matching this schema:
{{
  "sections": [
    {{
      "title": "Executive Summary",
      "content": "Markdown content for this section only"
    }}
  ]
}}

Section order must match:
{", ".join(required_section_titles)}

Hard rules:
Each section must include Examples from evidence and Evidence:
Evidence can reference site, tech, related sites, rankings, competitor, brand visibility
If a section has insufficient evidence, keep it short and list missing checks only
"""

    client = get_openai_client()

    def build_markdown_report(report_json: dict) -> str:
        sections_json = report_json.get("sections", [])
        out: List[str] = []
        for s in sections_json:
            title = (s.get("title") or "").strip()
            content = (s.get("content") or "").strip()
            if title and content:
                out.append(f"## {title}\n\n{content}")
        return "\n\n".join(out).strip()

    def validate_report_schema(report_json: dict) -> List[str]:
        issues: List[str] = []
        sections_json = report_json.get("sections", [])
        if not isinstance(sections_json, list) or not sections_json:
            return ["sections missing"]

        titles = [s.get("title") for s in sections_json if isinstance(s, dict)]
        if titles != required_section_titles:
            issues.append("section titles or order mismatch")

        for s in sections_json:
            content = s.get("content", "") if isinstance(s, dict) else ""
            if "Examples from" not in content:
                issues.append("missing Examples from evidence")
            if "Evidence:" not in content:
                issues.append("missing Evidence line")
        return issues

    response_format = {
        "type": "json_schema",
        "json_schema": {
            "name": "seo_report",
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

    messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}]

    max_attempts = 3
    max_tokens = 3500
    raw_report = ""
    report_json: Optional[Dict[str, Any]] = None
    report_markdown = ""

    for attempt in range(max_attempts):
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages if attempt == 0 else messages + [{"role": "assistant", "content": raw_report}],
            temperature=0.2,
            max_tokens=max_tokens,
            response_format=response_format,
        )
        raw_report = response.choices[0].message.content.strip()
        try:
            report_json = json.loads(raw_report)
        except json.JSONDecodeError:
            report_json = None

        if report_json:
            issues = validate_report_schema(report_json)
            if not issues:
                report_markdown = build_markdown_report(report_json)
                break

    if not report_markdown and report_json:
        report_markdown = build_markdown_report(report_json)

    if not report_markdown:
        tech_snapshot = json.dumps(tech_evidence, ensure_ascii=True, indent=2)[:2000]
        report_markdown = (
            "## Executive Summary\n\n"
            "Examples from evidence: Technical evidence collected but model output invalid\n"
            f"Evidence: {normalized_url}\n\n"
            "Technical evidence snapshot:\n\n"
            f"```json\n{tech_snapshot}\n```"
        )

    return {
        "report": report_markdown,
        "brand_visibility_evidence": brand_visibility_evidence,
    }


async def generate_production_ready_meta_tags(
    website_url: str,
    page_type: str = "homepage",
    business_type: str = "saas",
    target_keywords: Optional[str] = None,
    crawled_data: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Generate production-ready meta tags, schema markup, and HTML code.
    """
    try:
        client = get_openai_client()
        current_title = crawled_data.get("title", "") if crawled_data else ""
        current_description = crawled_data.get("description", "") if crawled_data else ""

        prompt = f"""Generate production-ready SEO code for:
- Website: {website_url}
- Page Type: {page_type}
- Business Type: {business_type}
- Target Keywords: {target_keywords or 'Not specified'}
- Current Title: {current_title}
- Current Description: {current_description}

Return as:
META TAGS:
<html here>

SCHEMA MARKUP:
<json-ld here>

OPEN GRAPH:
<html here>

TWITTER CARD:
<html here>
"""

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert SEO developer. Return valid HTML and JSON-LD only."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=2000,
        )

        generated_code = response.choices[0].message.content.strip()
        result = {
            "meta_tags": "",
            "schema_markup": "",
            "open_graph": "",
            "twitter_card": "",
            "pinterest": "",
            "facebook": "",
            "full_code": generated_code,
        }

        sections = generated_code.split("\n\n")
        current_section = None
        for section in sections:
            section_upper = section.upper()
            if "META TAGS:" in section_upper:
                current_section = "meta_tags"
                result["meta_tags"] = section.replace("META TAGS:", "").replace("META TAGS", "").strip()
            elif "SCHEMA MARKUP:" in section_upper:
                current_section = "schema_markup"
                result["schema_markup"] = section.replace("SCHEMA MARKUP:", "").replace("SCHEMA MARKUP", "").strip()
            elif "OPEN GRAPH:" in section_upper:
                current_section = "open_graph"
                result["open_graph"] = section.replace("OPEN GRAPH:", "").replace("OPEN GRAPH", "").strip()
            elif "TWITTER CARD:" in section_upper or "TWITTER:" in section_upper:
                current_section = "twitter_card"
                result["twitter_card"] = (
                    section.replace("TWITTER CARD:", "").replace("TWITTER CARD", "").replace("TWITTER:", "").strip()
                )
            elif current_section:
                result[current_section] += "\n" + section

        return result
    except Exception as e:
        return {
            "error": str(e),
            "meta_tags": "",
            "schema_markup": "",
            "open_graph": "",
            "twitter_card": "",
            "pinterest": "",
            "facebook": "",
            "full_code": "",
        }


async def generate_ai_optimized_recommendations(
    website_url: str,
    seo_report: str,
    business_type: str = "saas",
    target_keywords: Optional[str] = None,
    crawled_data: Optional[Dict[str, Any]] = None,
) -> str:
    try:
        client = get_openai_client()
        current_title = crawled_data.get("title", "") if crawled_data else ""
        current_description = crawled_data.get("description", "") if crawled_data else ""
        current_headings = crawled_data.get("headings", []) if crawled_data else []

        prompt = f"""Generate prioritized SEO recommendations with direct implementation steps.
Website: {website_url}
Business Type: {business_type}
Target Keywords: {target_keywords or 'Not specified'}
Title: {current_title}
Description: {current_description}
Headings: {', '.join(current_headings[:5]) if current_headings else 'None'}

SEO Report Summary:
{seo_report[:3000]}

Return Markdown with clear steps and code where applicable."""

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert SEO developer. Provide specific, implementable recommendations."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.4,
            max_tokens=2000,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"# Error Generating AI Optimized Recommendations\n\nError: {str(e)}"


async def ai_rewrite_seo_content(
    original_content: str,
    rewrite_type: str = "improve",
    focus: Optional[str] = None,
) -> str:
    try:
        client = get_openai_client()
        prompt = f"""Rewrite the following SEO content. Focus: {rewrite_type}.
{f'Focus area: {focus}' if focus else ''}

Original Content:
{original_content}
"""
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert SEO content writer."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.5,
            max_tokens=2000,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Error rewriting content: {str(e)}"


def quality_assurance_check(
    report: str,
    website_url: str,
    focus_areas: Optional[List[str]] = None,
    focus_on_competitor_analysis: bool = False,
) -> Dict[str, Any]:
    issues: List[str] = []
    quality_score = 100

    word_count = len(report.split())
    qa_min_words = int(os.getenv("SEO_QA_MIN_WORDS", "1200"))
    qa_max_words = int(os.getenv("SEO_QA_MAX_WORDS", "3500"))
    if word_count < qa_min_words:
        issues.append(f"Report is too short (less than {qa_min_words} words)")
        quality_score -= 20
    elif word_count > qa_max_words:
        issues.append(f"Report is too long (more than {qa_max_words} words)")
        quality_score -= 10

    if focus_on_competitor_analysis:
        required_sections = ["Executive Summary", "Competitor"]
        found_sections = sum(1 for section in required_sections if section.lower() in report.lower())
        if found_sections < len(required_sections):
            issues.append(f"Missing required competitor analysis sections (found {found_sections}/{len(required_sections)})")
            quality_score -= 30
    else:
        focus_areas = focus_areas or ["on-page", "technical", "content"]
        required_sections = ["Executive Summary", "Implementation Roadmap", "Tools and Resources", "AI Search Visibility (AEO)"]
        if "technical" in focus_areas:
            required_sections.append("Technical SEO")
        if "on-page" in focus_areas:
            required_sections.append("On-Page SEO")
        if "content" in focus_areas:
            required_sections.append("Content SEO")
        if "off-page" in focus_areas:
            required_sections.append("Off-Page SEO")
        if "local" in focus_areas:
            required_sections.append("Local SEO")
        if "mobile" in focus_areas:
            required_sections.append("Mobile SEO")
        if "speed" in focus_areas:
            required_sections.append("Page Speed Optimization")
        if "accessibility" in focus_areas:
            required_sections.append("Accessibility")
        required_sections.append("Competitor")

        found_sections = sum(1 for section in required_sections if section.lower() in report.lower())
        if found_sections < len(required_sections) * 0.7:
            issues.append(f"Missing key sections (found {found_sections}/{len(required_sections)})")
            quality_score -= 15

        if "on-page" in focus_areas:
            if "meta" not in report.lower() and "title tag" not in report.lower():
                issues.append("Missing meta tag recommendations")
                quality_score -= 10
        if "technical" in focus_areas:
            if "schema" not in report.lower():
                issues.append("Missing schema markup recommendations")
                quality_score -= 5
        if "content" in focus_areas or "on-page" in focus_areas:
            if "keyword" not in report.lower():
                issues.append("Missing keyword analysis")
                quality_score -= 15
        if "competitor" not in report.lower():
            issues.append("Missing competitor analysis")
            quality_score -= 5

    quality_score = max(0, quality_score)
    focus_areas = focus_areas or ["on-page", "technical", "content"]
    return {
        "word_count": word_count,
        "sections_found": sum(1 for section in (required_sections if not focus_on_competitor_analysis else ["Executive Summary", "Competitor"]) if section.lower() in report.lower()),
        "has_meta_tags": False if focus_on_competitor_analysis or "on-page" not in focus_areas else ("meta" in report.lower() or "title tag" in report.lower()),
        "has_schema": False if focus_on_competitor_analysis or "technical" not in focus_areas else ("schema" in report.lower()),
        "has_keywords": False if focus_on_competitor_analysis or ("content" not in focus_areas and "on-page" not in focus_areas) else ("keyword" in report.lower()),
        "has_competitor_analysis": "competitor" in report.lower(),
        "quality_score": quality_score,
        "issues": issues,
        "status": "excellent" if quality_score >= 90 else "good" if quality_score >= 70 else "needs_improvement",
        "focus_on_competitor_analysis": focus_on_competitor_analysis,
    }