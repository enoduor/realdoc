"""
utils/seo_helper.py

SEO reports are generated from what we crawl and AI research:

1. Crawl the given URL — title, meta description, H1, headings, content, internal links, features.
2. Crawl competitor URLs when provided (or discover and crawl them).
3. Technical signals (robots, sitemap, schema) when Technical SEO is in focus.
4. AI research: best practices, benchmarks for this business type, competitor norms—so every section gives actionable advice.
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
    extract_keywords_from_content,
    compute_keyword_gaps,
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
            "h1": "",
            "headings": [],
            "features": [],
            "internal_link_count": 0,
            "internal_links": [],
            "content_excerpt": "",
            "quotes": [],
        }

    text_sources = [
        data.get("title", ""),
        data.get("description", ""),
        data.get("h1", ""),
        " ".join((data.get("headings") or [])[:10]),
        data.get("content", ""),
    ]
    url = data.get("url") or fallback_url
    return {
        "url": url,
        "title": _truncate_text(data.get("title", ""), 160),
        "description": _truncate_text(data.get("description", ""), 400),
        "h1": _truncate_text(data.get("h1", ""), 200),
        "headings": (data.get("headings") or [])[:10],
        "features": (data.get("features") or [])[:12],
        "internal_link_count": int(data.get("internal_link_count") or 0),
        "internal_links": (data.get("internal_links") or [])[:8],
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
    competitor_pages = (comp_data.get("competitor_pages") or [])[:6]
    keyword_gaps = (comp_data.get("keyword_gaps") or [])[:25]
    return {
        "competitors_analyzed": comp_data.get("competitors_crawled") or comp_data.get("competitors_found"),
        "competitor_urls": competitors,
        "competitor_pages": [
            {
                "url": p.get("url", ""),
                "title": p.get("title", ""),
                "h1": p.get("h1", ""),
                "description": p.get("description", ""),
                "headings": (p.get("headings") or [])[:8],
            }
            for p in competitor_pages
        ],
        "keyword_gaps": [
            {
                "keyword": g.get("keyword", ""),
                "count": g.get("count", 0),
                "competitors_using": (g.get("competitors_using") or [])[:5],
            }
            for g in keyword_gaps
        ],
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


def _dedupe_case(items: List[str], max_items: int = 20) -> List[str]:
    out: List[str] = []
    seen = set()
    for item in items:
        it = (item or "").strip()
        key = it.lower()
        if not it or key in seen:
            continue
        seen.add(key)
        out.append(it)
        if len(out) >= max_items:
            break
    return out


def _slugify_keyword(keyword: str, max_len: int = 60) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (keyword or "").lower()).strip("-")
    if len(slug) > max_len:
        slug = slug[:max_len].rstrip("-")
    return slug


def _derive_strategy_evidence(
    site_evidence: Dict[str, Any],
    keyword_rankings: Dict[str, Any],
    competitor_keywords: Dict[str, Any],
    keyword_clusters: Dict[str, Any],
    brand_name: str,
) -> Dict[str, Any]:
    extracted = keyword_rankings.get("extracted_keywords") or []
    target = keyword_rankings.get("target_keywords") or []
    high_volume = competitor_keywords.get("high_volume_keywords") or []
    competitor_pages = competitor_keywords.get("competitor_pages") or []

    hv_keywords = [k.get("keyword", "") for k in high_volume if k.get("keyword")]
    suggestions: List[str] = []
    for k in high_volume:
        suggestions.extend(k.get("related_suggestions") or [])

    priority_keywords = _dedupe_case(extracted + target + hv_keywords + suggestions, max_items=20)
    phrase_keywords = [k for k in priority_keywords if " " in k][:10]

    content_gaps = _dedupe_case([k for k in hv_keywords if k.lower() not in {x.lower() for x in extracted}], max_items=10)
    landing_seeds = content_gaps or phrase_keywords or priority_keywords[:8]

    landing_page_ideas: List[Dict[str, str]] = []
    for k in landing_seeds[:8]:
        slug = _slugify_keyword(k)
        if not slug:
            continue
        landing_page_ideas.append(
            {
                "keyword": k,
                "suggested_slug": f"/{slug}",
                "title_example": f"{k.title()} | {brand_name}" if brand_name else k.title(),
            }
        )

    faq_questions: List[str] = []
    for s in suggestions[:12]:
        if "?" in s:
            faq_questions.append(s)
        else:
            faq_questions.append(f"What is {s}?")
    faq_questions = _dedupe_case(faq_questions, max_items=8)

    intent = keyword_clusters.get("intent") if isinstance(keyword_clusters, dict) else {}
    commercial = intent.get("commercial") if isinstance(intent, dict) else []
    transactional = intent.get("transactional") if isinstance(intent, dict) else []

    title_patterns: List[str] = []
    for c in competitor_pages[:6]:
        t = c.get("title") or ""
        if t and t not in title_patterns:
            title_patterns.append(t[:160])

    heading_patterns: List[str] = []
    for c in competitor_pages[:6]:
        h1 = (c.get("h1") or "").strip()
        if h1 and h1 not in heading_patterns:
            heading_patterns.append(h1[:160])

    return {
        "brand_name": brand_name,
        "priority_keywords": priority_keywords[:15],
        "content_gaps": content_gaps[:10],
        "positioning_candidates": phrase_keywords[:6],
        "landing_page_ideas": landing_page_ideas[:8],
        "faq_questions": faq_questions[:8],
        "commercial_intent_keywords": commercial[:10] if isinstance(commercial, list) else [],
        "transactional_intent_keywords": transactional[:10] if isinstance(transactional, list) else [],
        "competitor_title_patterns": title_patterns[:6],
        "competitor_heading_patterns": heading_patterns[:8],
        "site_internal_links_sample": (site_evidence.get("internal_links") or [])[:6],
        "site_internal_link_count": site_evidence.get("internal_link_count", 0),
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
    competitor_urls: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Generate an SEO report from crawled data: we crawl the given URL and competitor URLs
    (passed in or discovered). Sections follow the requested focus_areas (e.g. On-Page, Content,
    Technical, Accessibility); we also fetch robots/sitemap/schema when Technical SEO is in focus.
    """
    if focus_areas is None:
        focus_areas = ["on-page", "technical", "content"]

    normalized_url = website_url.strip()
    if not normalized_url.startswith(("http://", "https://")):
        normalized_url = f"https://{normalized_url}"
    normalized_url = normalized_url.rstrip("/")

    crawled_data: Optional[Dict[str, Any]] = None
    keyword_rankings_data: Optional[Dict[str, Any]] = None
    related_sites_data: List[Dict[str, Any]] = []
    related_sites_urls: List[str] = []

    try:
        crawled_data = await crawl_and_extract(normalized_url, use_js_render=enable_js_render)
    except Exception:
        crawled_data = None

    parsed = urlparse(normalized_url)
    brand_name = parsed.netloc.replace("www.", "").split(".")[0].title()
    if crawled_data and crawled_data.get("title"):
        t = crawled_data.get("title", "")
        if t:
            brand_name = t.split("|")[0].split("-")[0].strip()[:50]

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
    normalized_competitor_urls: List[str] = []
    if competitor_urls:
        for u in competitor_urls:
            uu = (u or "").strip()
            if uu and uu not in normalized_competitor_urls:
                if not uu.startswith(("http://", "https://")):
                    uu = f"https://{uu}"
                normalized_competitor_urls.append(uu.rstrip("/"))
    try:
        competitor_keywords_data = await get_competitor_high_volume_keywords(
            website_url=normalized_url,
            max_competitors=5,
            max_keywords=10,
            competitor_urls=normalized_competitor_urls if normalized_competitor_urls else None,
        )
        site_keywords_for_gap = extract_keywords_from_content(crawled_data or {}, max_keywords=20) if crawled_data else []
        competitor_map = (competitor_keywords_data.get("competitor_keywords") or {}) if competitor_keywords_data else {}
        keyword_gaps = compute_keyword_gaps(site_keywords_for_gap, competitor_map, max_items=25) if competitor_map else []
        if competitor_keywords_data is not None:
            competitor_keywords_data["keyword_gaps"] = keyword_gaps
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

    tech_evidence: Dict[str, Any] = {"available": False}
    try:
        tech_evidence = await asyncio.wait_for(collect_technical_evidence(normalized_url), timeout=25.0)
        tech_evidence["available"] = True
    except asyncio.TimeoutError:
        tech_evidence = {"error": "timeout", "available": False}
    except Exception as e:
        tech_evidence = {"error": str(e), "available": False}

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
        "(ALWAYS INCLUDE)\n   - Name the website under review (URL and/or brand) in the first sentence.\n   - Use specific instances from the page: show actual crawled/tech values (e.g. current title tag, meta description, H1, robots.txt snippet, sitemap URL) — not labels like 'Tech Evidence' or 'Robots Evidence'.\n   - For each finding: state what is wrong with the current value and what needs to be done.\n   - Current SEO health score (0-100), key strengths/weaknesses, priority actions. No generic template; every line must reference this site's real data.",
    )

    if "technical" in focus_areas:
        add_section(
            "Technical SEO Analysis",
            "(REQUIRED)\n   - Site status and redirects\n   - robots.txt and sitemap.xml status\n   - Canonical and meta robots\n   - Schema types detected\n   - Open Graph and Twitter tags presence\n   - Security headers snapshot\n   - Cite current value from technical signals and exact recommended change; when relevant, tie to crawled page (e.g. which pages need canonical or schema).",
        )

    if "on-page" in focus_areas:
        add_section(
            "On-Page SEO",
            "(REQUIRED)\n   - Title tags and meta descriptions: show current value from evidence (URL + current title/description) and recommended change\n   - Header tags structure from evidence\n   - Internal linking: specific pages/URLs from evidence and suggested links\n   - Actionable only: no generic advice; use site or competitor examples or concrete best-practice step with example",
        )

    if "content" in focus_areas:
        add_section(
            "Content SEO & Keyword Rankings",
            "(REQUIRED)\n   - Keyword ranking performance: when data exists, cite specific keywords and pages and recommended changes.\n   - When no ranking data: use the crawled site (title, description, features, content) to recommend many options — not just 2–3. Provide a substantial list: 10–15+ keyword themes and matching page ideas (slugs + suggested titles), e.g. /ai-video-generator, /brand-video-creation, /video-marketing-tips, /ugc-campaigns, /social-video-tools, /reel-creation, etc., all inferred from what the site offers. Reader-friendly: say what is not present on the website, then give a rich set of keyword and content recommendations.\n   - Formatting: present Keywords, Extracted Keywords, and Content Gaps with clear markdown (e.g. **Keywords:** on its own line or as a bullet item), not with leading spaces (which would render as a code block). Example: use \"**Keywords:** No keywords currently ranking in the top 10.\" not \"    Keywords: ...\".",
        )

    if "off-page" in focus_areas:
        add_section(
            "Off-Page SEO",
            "(REQUIRED)\n   - Backlink profile and domain authority: what we can infer or recommend measuring (e.g. Ahrefs/SEMrush).\n   - Social signals and brand mentions: actionable next steps (e.g. claim profiles, monitor mentions).\n   - Link building opportunities: concrete, site-specific ideas (e.g. which types of sites to approach for this business, sample outreach angle). Use crawl and AI research; when data is missing, give concrete next steps (tools to run, metrics to track).",
        )

    if "local" in focus_areas:
        add_section(
            "Local SEO",
            "(REQUIRED)\n   - Google Business Profile optimization: what to add or fix (hours, categories, photos, posts, Q&A).\n   - Local citations and NAP consistency: recommend directories and how to fix name/address/phone across the web.\n   - Local keywords and local link building: location-based keyword ideas and local link tactics. Use site URL and business type; when local data is missing, give concrete steps (e.g. create/claim GMB for [URL], run a NAP audit with Moz Local or BrightLocal).",
        )

    if "mobile" in focus_areas:
        add_section(
            "Mobile SEO",
            "(REQUIRED)\n   - Mobile-first indexing readiness: viewport, font size, tap targets, responsive structure from crawl when available.\n   - Mobile page speed and usability: recommend running Lighthouse mobile audit for [URL] and list typical fixes (image optimization, lazy load, reduce blocking resources).\n   - AMP or non-AMP: when relevant, one line and next step. Use AI research for typical mobile issues; give concrete next steps (e.g. run PageSpeed with mobile device emulation, fix viewport meta).",
        )

    if "speed" in focus_areas:
        add_section(
            "Page Speed & Core Web Vitals",
            "(REQUIRED)\n   - Core Web Vitals (LCP, FID/INP, CLS): recommend running PageSpeed Insights or Lighthouse for [URL]; interpret typical bottlenecks (server response, render-blocking, images, layout shift).\n   - Page load times and resource optimization: caching headers, compression, image format/sizing, critical path.\n   - Concrete next steps: e.g. 'Run PageSpeed for [URL], then fix LCP by [typical fix], CLS by [typical fix].' Use AI research for benchmarks and common fixes when no speed data is in evidence.",
        )

    if competitor_keywords_data and competitor_keywords_data.get("high_volume_keywords"):
        add_section(
            "Competitor Keyword Analysis & Meta-Tag Optimization",
            "(REQUIRED when competitor data exists)\n   - List competitors and URLs from evidence\n   - For each keyword: which competitor uses it (specific URL)\n   - Title/H1 and meta examples from competitor pages with recommended changes for client site\n   - Actionable: specific competitor URL + current value + what to do on client pages",
        )

    if "accessibility" in focus_areas:
        add_section(
            "Accessibility",
            "(REQUIRED)\n   - Only include verifiable findings from evidence\n   - If no scan evidence: short unverified checklist and concrete next step (e.g. run Lighthouse accessibility audit for [URL])",
        )

    add_section(
        "Implementation Roadmap",
        "(ALWAYS INCLUDE)\n   - The roadmap MUST address and capture recommendations from every selected SEO section that appears in this report. For each focus-area section above (Technical SEO, On-Page, Content, Off-Page, Local, Mobile, Page Speed, Accessibility, and Competitor Keyword Analysis when present), include at least one concrete next step that reflects that section's key recommendations—so all recommendations from the selected options are captured in the roadmap.\n   - Name the website. Use the crawled site (pages, product, features, content) to suggest next steps that are specific to this website — not generic advice like 'Conduct keyword analysis' or 'Develop a content calendar'.\n   - Provide 5–10+ concrete next steps: e.g. add meta/H1 to specific URLs or slugs from the crawl, create pages for product-specific topics, internal links, schema, technical fixes, local/off-page/mobile/speed/accessibility actions—tied to this site's URLs, product, or content. Order steps logically (e.g. technical and on-page first, then content, then off-page/local).",
    )
    add_section(
        "Tools and Resources",
        "(ALWAYS INCLUDE)\n   - Recommend a few tools (e.g. Search Console, SEMrush/Ahrefs, on-page plugin) tied to this website. For each tool, use AI to show the steps of implementing: e.g. 'Google Search Console: 1) Go to search.google.com/search-console, 2) Add property [website URL], 3) Verify via HTML tag or DNS, 4) Submit sitemap [URL/sitemap.xml], 5) Use Coverage and Performance to monitor.' Do not just list tools and generic 'Set up X' — give 3–5 concrete implementation steps per tool so the reader can follow them.",
    )
    add_section(
        "AI Search Visibility (AEO)",
        "(ALWAYS INCLUDE)\n   - Use the crawled site (and competitors when available) to give actionable, AI-supported advice. Cite current schema (e.g. WebPage, WebSite) and what is missing. Provide concrete implementation steps: which schema types to add and where (e.g. Product for /pricing or key landing pages, FAQ for /help or feature pages), with example JSON-LD or key properties; which voice/search queries to target based on the product (e.g. 'how to create AI videos for my brand') and how to answer them on the page. Tie every recommendation to this website's pages and product — not generic 'add FAQ schema' or 'optimize for voice search' without specifics.",
    )

    site_evidence = _build_site_evidence(crawled_data, normalized_url)
    keyword_rankings_evidence = _build_keyword_rankings_evidence(keyword_rankings_data)
    competitor_keywords_evidence = _build_competitor_keywords_evidence(competitor_keywords_data)
    keyword_clusters_evidence = keyword_clusters if keyword_clusters and not keyword_clusters.get("error") else {}
    strategy_evidence = _derive_strategy_evidence(
        site_evidence=site_evidence,
        keyword_rankings=keyword_rankings_evidence,
        competitor_keywords=competitor_keywords_evidence,
        keyword_clusters=keyword_clusters_evidence,
        brand_name=brand_name,
    )

    evidence_summary = {
        "site": site_evidence,
        "related_sites": _build_related_sites_evidence(related_sites_data, normalized_url),
        "tech": tech_evidence,
        "keyword_rankings": keyword_rankings_evidence,
        "competitor_keywords": competitor_keywords_evidence,
        "keyword_clusters": keyword_clusters_evidence,
        "strategy": strategy_evidence,
        "brand_visibility_evidence": brand_visibility_evidence,
    }

    evidence_json = json.dumps(evidence_summary, ensure_ascii=True, indent=2)

    focus_areas_text = ", ".join(focus_areas)

    system_prompt = f"""You are an expert SEO consultant with deep knowledge of search engine optimization, technical SEO, content strategy, and digital marketing.

Use AI research to enrich the report: combine your knowledge (SEO best practices, benchmarks for this business type, typical competitor tactics, ranking and conversion norms) with the crawled site and competitor data. In this AI era we always provide actionable advice—when data is missing, use research to suggest concrete next steps (e.g. typical meta length, common schema for this industry) rather than leaving gaps.

CRITICAL REQUIREMENTS:
1. PRODUCT SPECIFIC ANALYSIS
Use the crawled data and competitor data from the summary; use AI research to inform recommendations where it adds value.

2. EVIDENCE SOURCES — match evidence to each focus area
Crawled page: title, meta description, H1, headings, content, internal links, features → use for On-Page, Content, structure, Accessibility.
Competitor crawl → use for competitor and positioning.
Keyword rankings, brand visibility → when present.
For Technical SEO focus only: robots.txt, sitemap, schema, headers. For other focus areas use the crawl; do not default to technical.

3. SITE-SPECIFIC, SHOW ACTUAL DATA (NO GENERIC TEMPLATE)
- Every section must mention the website being reviewed (by URL or name). For each section use the data that fits the focus (On-Page/Content → crawl; Technical → robots/sitemap/schema; etc.). Show real values. Do not use the word "evidence" in the report — use "On the page:", "Current state:", "Not present on the website", "Missing on the page".
- For each finding: state the current value, explain what is wrong or missing, and what to do (e.g. "Current title 'X'; change to 'Y' under 60 chars").
- Match data to the focus area; do not default to technical when the section is On-Page, Content, or Accessibility.

4. READER-FRIENDLY LANGUAGE — do not use the word "evidence" in the report
When something is missing on the website, say "Not present on the website" or "Missing on the page" — never "Not available in evidence". When citing what is on the page, use "On the page:" or "Current state:" (e.g. "On the page: meta description missing. Recommend: add under 160 characters."). Do not invent data; when data is missing, still be actionable with a concrete next step.

4b. MARKDOWN FORMATTING — no code-block style for normal text
Do not indent normal sentences with 4 or more spaces (that becomes a code block and looks broken). For subsections such as Keywords, Extracted Keywords, Content Gaps, use clear markdown instead:
- Use **Keywords:** or **Extracted Keywords:** or **Content Gaps:** as a bold label on its own line, then the value on the next line (or same line after a space). No leading spaces before the label.
- Or use a bullet list: "- **Keywords:** No keywords currently ranking..."
- Never output lines like "    Keywords: ..." (leading spaces) — use "**Keywords:** ..." or "- **Keywords:** ..." so the report renders correctly.

5. SECTION QUALITY RULE (ACTIONABLE, SITE-SPECIFIC)
Recommendations must be actionable. Use the crawled data per focus and AI research (best practices, benchmarks) to inform fixes. Show the real value and the fix. If data for a section is thin, use your knowledge to give a concrete next step (e.g. "Run PageSpeed for [URL]" or "Add FAQ schema using this pattern") so the user always has something to act on.

6. DEPTH & STRATEGY RULE
Use strategy evidence when present to produce a keyword-to-page plan and priorities. If strategy evidence is empty, use AI research (typical keywords and content structure for this business type) to suggest a keyword-to-page plan and what to collect so the user has actionable next steps.

7. EXECUTION RULE
Include specific page ideas (slugs + titles), internal linking targets, and meta updates grounded in evidence. When keyword/ranking data is missing, use the crawled site to recommend many options (e.g. 10–15+ keyword themes and matching slugs/titles). For Implementation Roadmap: it must address every selected focus area—for each section that appears in the report (Technical, On-Page, Content, Off-Page, Local, Mobile, Page Speed, Accessibility, Competitor Keyword Analysis when present), include at least one concrete roadmap step that captures that section's recommendations, so no recommendation from the selected SEO options is left out. Use the crawled website and tie each step to this site's URLs or product — never generic lines like "Conduct keyword analysis" or "Develop a content calendar" without specifics.

Focus Areas: {focus_areas_text}
You MUST include a dedicated section for EACH selected focus area (technical, on-page, content, off-page, local, mobile, speed, accessibility). Every section listed in the required section order must be filled with detailed, actionable analysis—do not skip or merge focus areas. Local SEO, Page Speed, Off-Page, and Mobile each get their own full section when selected.
Business Type: {business_type}
Language: {language}"""

    user_prompt = f"""Analyze the website and return an SEO report. Use the crawled data and competitor data below, plus AI research (best practices, benchmarks for this business type), to provide actionable advice in every section. There is no reason to leave the user without something to act on.

Website URL: {normalized_url}
Business Type: {business_type}

{f"Target Keywords: {target_keywords}" if target_keywords else ""}
{f"Known Issues: {current_seo_issues}" if current_seo_issues else ""}

Data we have (crawl, competitors, keyword/tech when available):
{evidence_json}

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
Name the website under review in each section. Use the crawled data and AI research so every section gives actionable advice—no dead ends. For each finding: state current value, what is wrong, what to do.
Use reader-friendly language. When something is missing, say "Not present on the website" or "Missing on the page" and give a concrete next step (informed by research if needed). Use "On the page:" or "Current state:" for citations; do not use the word "Evidence" in the report.
Format section content as proper markdown: do not indent normal text with 4+ spaces (that becomes a code block). For labels like Keywords, Extracted Keywords, Content Gaps use **Label:** or bullet items (e.g. "- **Keywords:** ...") so they render correctly.
Implementation Roadmap: must address every selected focus area—for each section that appears in the report (Technical, On-Page, Content, Off-Page, Local, Mobile, Page Speed, Accessibility, Competitor Keyword Analysis when present), include at least one concrete roadmap item that captures that section's recommendations so all recommendations are captured. 5–10+ site-specific next steps total, ordered logically. Tools and Resources: 3–5 implementation steps per tool. AI Search Visibility (AEO): actionable advice tied to the website and competitors. Content SEO when no ranking data: many options (10–15+) from the crawled site and research. Competitor analysis: use competitor crawl when present and AI research (typical tactics for this space) so recommendations are actionable.
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
            has_citation = "On the page" in content or "Current state" in content or "Evidence:" in content
            has_examples = "On the page" in content or "Current state" in content or "Examples from" in content
            if not has_citation:
                issues.append("missing citation (use 'On the page:' or 'Current state:' with value and fix)")
            if not has_examples:
                issues.append("missing concrete examples from the page")
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
            "On the page: Technical data collected but model output invalid.\n"
            f"Current state: {normalized_url}\n\n"
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
    competitor_urls: Optional[List[str]] = None,
    competitor_crawl_data: Optional[Dict[str, Any]] = None,
    discover_and_crawl_competitor: bool = True,
    use_js_render: bool = False,
) -> str:
    """
    Action points are driven dynamically by the report content: (1) every item in
    the Implementation Roadmap, (2) every Recommendations bullet from each section
    that appears in the report (sections depend on the user's selected focus areas—
    e.g. Technical, On-Page, Content, Off-Page, Local, Mobile, Page Speed,
    Accessibility, AEO). Examples come from a crawled competitor page so patterns
    match and are implementable.
    """
    try:
        client = get_openai_client()
        # If no competitor data provided, use AI to find top competitors and crawl the first
        if competitor_crawl_data is None and discover_and_crawl_competitor:
            urls_to_try = competitor_urls or await _get_top_competitor_urls_for_site(website_url, business_type)
            for first_url in (urls_to_try or [])[:1]:
                try:
                    normalized = first_url.strip()
                    if not normalized.startswith(("http://", "https://")):
                        normalized = f"https://{normalized}"
                    competitor_crawl_data = await crawl_and_extract(normalized, use_js_render=use_js_render)
                    if competitor_crawl_data:
                        competitor_crawl_data["url"] = normalized.rstrip("/")
                        break
                except Exception:
                    continue

        current_title = crawled_data.get("title", "") if crawled_data else ""
        current_description = crawled_data.get("description", "") if crawled_data else ""
        current_headings = crawled_data.get("headings", []) if crawled_data else []
        current_h1 = crawled_data.get("h1", "") if crawled_data else ""

        competitor_block = ""
        if competitor_crawl_data:
            c_url = competitor_crawl_data.get("url", "competitor")
            c_title = competitor_crawl_data.get("title", "") or ""
            c_desc = competitor_crawl_data.get("description", "") or ""
            c_h1 = competitor_crawl_data.get("h1", "") or ""
            c_headings = competitor_crawl_data.get("headings", []) or []
            c_content = (competitor_crawl_data.get("content") or "")[:2000]
            competitor_block = f"""
Real competitor page (crawled — use this as the source for example patterns):
URL: {c_url}
Title tag: {c_title}
Meta description: {c_desc}
H1: {c_h1}
Headings (first 12): {', '.join(c_headings[:12]) if c_headings else '—'}
Content excerpt: {(c_content[:1500] + '...') if len(c_content) > 1500 else c_content or '—'}

You MUST derive action-point examples from these real values. Use the competitor's pattern (title length/structure, meta format, heading hierarchy) and adapt for the client's site (brand/product). Every action point must include a complete, copy-paste-able example (full meta tag, JSON-LD snippet, or exact code) based on this crawl so patterns match and make sense.
"""
        else:
            competitor_block = """
Use your knowledge of a top competitor in this space: name that competitor and use their typical SEO patterns (title format, meta length, schema, content structure) so examples are realistic. Every action point must include a complete, copy-paste-able example.
"""

        report_excerpt = seo_report[:6000]

        prompt = f"""Generate SEO ACTION POINTS that are actionable and aligned to the SEO report's own recommendations and roadmap.

Website: {website_url}
Business type: {business_type}
Target keywords: {target_keywords or 'Not specified'}

Client's current page (from crawl):
Title: {current_title}
Description: {current_description}
H1: {current_h1}
Headings: {', '.join(current_headings[:8]) if current_headings else '—'}

SEO Analysis Report:
{report_excerpt}

STEP 1 — EXTRACT FROM THE REPORT (do not invent):
- Implementation Roadmap: Extract every bullet/item from the "Implementation Roadmap" section (every listed action).
- Section recommendations: Extract the "Recommendations:" bullets from every section that appears in the report (Technical SEO, On-Page, Content, Off-Page, Local, Mobile, Page Speed, Accessibility, AEO, etc.). Also extract any tool recommendations from the "Tools and Resources" section when present. Use only sections that actually exist in this report.

STEP 2 — STRUCTURE ACTION POINTS:
- Build one Action Point per extracted item. Order them in a logical implementation order (e.g. meta/schema and on-page first, then content and local, then reviews).
- Each Action Point must map to one item from the Implementation Roadmap or from the Recommendations in whichever report sections are present. Do not add actions that are not in the report.

STEP 3 — FOR EACH ACTION POINT OUTPUT (applicable only—no vague wording):
Use the website under review ({website_url}) in actions and examples wherever it makes the step concrete (e.g. "Run PageSpeed on {website_url}", "Add property {website_url} in Search Console", "Meta for your homepage at {website_url}").
(a) Action: the exact recommendation from the report (roadmap item or section recommendation). State it as a concrete step the user can do, not abstract advice. Where the step involves the site, use the website URL above.
(b) What to do: 1–2 sentences on how to implement it for this site. Include a link to a guide or resource when it helps (e.g. [PageSpeed Insights](https://pagespeed.web.dev/), [Schema guide](https://developers.google.com/search/docs/appearance/structured-data), [Search Console help](https://support.google.com/webmasters)) so the user has a URL to follow.
(c) Example: a complete, copy-paste-able example (full meta tag, JSON-LD snippet, code, or step-by-step). Use the website under review in the example where relevant (e.g. canonical URL, og:url, tool input). When the action involves a blog post or content page, show a brief concrete example (e.g. sample title, 1–2 sentence outline, or opening line) tailored to the client's site—not generic words. Where a tool or guide exists, include its URL in the example so the user can click and follow. Adapt the pattern for the client's brand/product, but base the pattern on the competitor data below so it matches real-world usage.
{competitor_block}

STEP 4 — FINAL SECTION (REQUIRED): Tools and Resources
Always end the output with a dedicated section "## Tools and Resources". For each tool include: (1) the tool name as a clickable link (use the URL below), (2) what it is for, (3) one concrete action step so the user can get started immediately. Use this exact format for each entry:

- **[Tool Name](tool_url)** — Purpose in one sentence. **Action:** One concrete step (e.g. open the link, enter [website URL], then do X). Replace [website URL] with the actual client website from the prompt.

Required tools and their URLs (use these links in the output):
- Google PageSpeed Insights: https://pagespeed.web.dev/
- Google Mobile-Friendly Test: https://search.google.com/test/mobile-friendly
- Screaming Frog SEO Spider: https://www.screamingfrog.co.uk/seo-spider/
- WAVE Accessibility Tool: https://wave.webaim.org/
- Google Search Console: https://search.google.com/search-console

Example for one tool: "**[Google PageSpeed Insights](https://pagespeed.web.dev/)** — Analyze and improve page speed and Core Web Vitals. **Action:** Open the link, enter [website URL], run the test, then fix the top issues it reports (e.g. LCP, CLS)."

If the report's "Tools and Resources" section lists additional tools, include those too with the same format (clickable name + URL, purpose, Action step). Every tool must have a URL link so the user can take action.

OUTPUT FORMAT (Markdown):
## Action point 1: [Short title]
- **Action:** [concrete step from report—applicable, not abstract; use the website under review ({website_url}) where the step involves the site]
- **What to do:** [1–2 sentences; include a link to a guide/URL when it helps the user follow the action]
- **Example:** [code block, snippet, or brief concrete example; use the website URL where relevant (canonical, og:url, tool input); if blog/content is involved, show a short example e.g. title or outline; include URLs to tools or guides where relevant]

Repeat for every extracted roadmap and section recommendation. Then add the final "## Tools and Resources" section as above. Every action and example must be applicable and implementable—no vague wording. Use the website under review ({website_url}) in actions and examples wherever it makes the step concrete. Examples must include links (URLs) to guides or tools when they help the user complete the action. When a blog or content piece is mentioned, the example must show a brief, concrete example (e.g. sample title or outline) for this site.
"""

        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert SEO developer. Action points are driven by: (1) every item in the Implementation Roadmap, (2) every Recommendations bullet from each section in the report. Each action must be applicable and concrete—no vague wording. Use the website under review (the URL provided in the prompt) in actions and examples wherever it makes the step concrete (e.g. run tool on that URL, add property for that URL, canonical/og:url in examples). In examples: include URLs/links to guides or tools so the user can click and follow; when a blog or content piece is mentioned, show a brief concrete example (e.g. sample blog title or outline) for the client's site. You must always end with a final 'Tools and Resources' section with clickable URLs and one concrete Action step each; in tool actions, use the client website URL. Derive example patterns from the crawled competitor page when provided.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.35,
            max_tokens=5000,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"# Error Generating Action Points\n\nError: {str(e)}"


async def _get_top_competitor_urls_for_site(
    website_url: str,
    business_type: str = "saas",
) -> List[str]:
    """Use AI to return 3 real competitor homepage URLs (same industry/niche) for crawling."""
    try:
        client = get_openai_client()
        domain = urlparse(website_url).netloc.replace("www.", "") if website_url else ""
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "system",
                    "content": "You are an SEO analyst. Return a JSON array of exactly 3 competitor website homepage URLs. They must be real, live sites in the same industry/niche as the given site. Return only valid JSON, e.g. [\"https://example.com\", \"https://example2.com\", \"https://example3.com\"].",
                },
                {
                    "role": "user",
                    "content": f"Site: {website_url} (domain: {domain}). Business type: {business_type}. Return a JSON array of 3 competitor homepage URLs.",
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
                urls = [u for u in arr if isinstance(u, str) and u.startswith(("http://", "https://"))][:3]
                return urls
    except Exception:
        pass
    return []


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
        required_sections = ["Executive Summary", "Competitor Keyword Analysis"]
        found_sections = sum(1 for section in required_sections if section.lower() in report.lower())
        if found_sections < len(required_sections):
            issues.append(f"Missing required competitor analysis sections (found {found_sections}/{len(required_sections)})")
            quality_score -= 30
    else:
        focus_areas = focus_areas or ["on-page", "technical", "content"]

        required_sections = [
            "Executive Summary",
            "Implementation Roadmap",
            "Tools and Resources",
            "AI Search Visibility (AEO)",
        ]

        if "technical" in focus_areas:
            required_sections.append("Technical SEO Analysis")
        if "on-page" in focus_areas:
            required_sections.append("On-Page SEO")
        if "content" in focus_areas:
            required_sections.append("Content SEO & Keyword Rankings")
        if "off-page" in focus_areas:
            required_sections.append("Off-Page SEO")
        if "local" in focus_areas:
            required_sections.append("Local SEO")
        if "mobile" in focus_areas:
            required_sections.append("Mobile SEO")
        if "speed" in focus_areas:
            required_sections.append("Page Speed & Core Web Vitals")
        if "accessibility" in focus_areas:
            required_sections.append("Accessibility")

        required_sections.append("Competitor Keyword Analysis & Meta-Tag Optimization")

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
        if "competitor keyword analysis" not in report.lower():
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