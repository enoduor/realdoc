"""
Brand Visibility Helper
Purpose
Return only citeable evidence that the SEO report can use
No long narrative blocks
No fragile scraping by default

Kept sources
Google News RSS
GitHub Search API
Hacker News Algolia API
Wikipedia REST API
PageSpeed Insights API

Optional sources
BuiltWith only if API key is available
Reddit only if you later add OAuth, disabled by default

Output contract
get_brand_visibility_data returns
available bool
sources list
summary object
evidence list of normalized evidence items

Normalized evidence item shape
source str
confidence str in {"api","rss","best_effort"}
signal_type str in {"press","dev","community","reputation","performance","tech_stack"}
url str
title str
date str optional
snippet str optional
meta dict optional
"""

from __future__ import annotations

import os
import json
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from urllib.parse import urlparse, quote_plus

import aiohttp

try:
    import feedparser
    FEEDPARSER_AVAILABLE = True
except Exception:
    feedparser = None  # type: ignore
    FEEDPARSER_AVAILABLE = False


RATE_LIMIT_DELAY_S = float(os.getenv("BRAND_VIS_RATE_LIMIT_DELAY_S", "0.35"))
DEFAULT_TIMEOUT_S = float(os.getenv("BRAND_VIS_TIMEOUT_S", "15"))
MAX_EVIDENCE_TOTAL = int(os.getenv("BRAND_VIS_MAX_EVIDENCE_TOTAL", "20"))

DEFAULT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; RealDocBot/1.0; +https://myinsightiq.com)",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.7",
}


def _domain_from_url(website_url: Optional[str]) -> Optional[str]:
    if not website_url:
        return None
    try:
        parsed = urlparse(website_url)
        host = (parsed.netloc or "").strip().lower()
        if host.startswith("www."):
            host = host[4:]
        return host or None
    except Exception:
        return None


def _clamp_text(s: str, limit: int) -> str:
    s = (s or "").strip()
    if len(s) <= limit:
        return s
    return s[: max(0, limit - 3)].rstrip() + "..."


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


def _evidence_item(
    *,
    source: str,
    confidence: str,
    signal_type: str,
    url: str,
    title: str,
    date: str = "",
    snippet: str = "",
    meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    item: Dict[str, Any] = {
        "source": source,
        "confidence": confidence,
        "signal_type": signal_type,
        "url": url or "",
        "title": _clamp_text(title or "", 180),
    }
    if date:
        item["date"] = _clamp_text(date, 40)
    if snippet:
        item["snippet"] = _clamp_text(snippet, 320)
    if meta:
        item["meta"] = meta
    return item


async def _get_text(session: aiohttp.ClientSession, url: str, timeout_s: float) -> Optional[str]:
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=timeout_s)) as resp:
            if resp.status != 200:
                return None
            return await resp.text(errors="ignore")
    except Exception:
        return None


async def _get_json(session: aiohttp.ClientSession, url: str, timeout_s: float, headers: Optional[Dict[str, str]] = None) -> Optional[Dict[str, Any]]:
    try:
        async with session.get(
            url,
            timeout=aiohttp.ClientTimeout(total=timeout_s),
            headers=headers or {},
        ) as resp:
            if resp.status != 200:
                return None
            return await resp.json()
    except Exception:
        return None


async def get_google_news_mentions(
    brand_name: str,
    website_url: Optional[str] = None,
    max_results: int = 5,
) -> Dict[str, Any]:
    if os.getenv("ENABLE_GOOGLE_NEWS", "true").lower() not in ("1", "true", "yes", "y"):
        return {"available": False, "source": "google_news_rss", "evidence": [], "error": "disabled"}

    if not FEEDPARSER_AVAILABLE:
        return {"available": False, "source": "google_news_rss", "evidence": [], "error": "feedparser_missing"}

    domain = _domain_from_url(website_url)
    query = brand_name.strip()
    if domain:
        query = f"{query} {domain}"

    rss_url = f"https://news.google.com/rss/search?q={quote_plus(query)}&hl=en&gl=US&ceid=US:en"

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        await asyncio.sleep(RATE_LIMIT_DELAY_S)
        content = await _get_text(session, rss_url, timeout_s=DEFAULT_TIMEOUT_S)
        if not content:
            return {"available": False, "source": "google_news_rss", "evidence": [], "error": "fetch_failed"}

        feed = feedparser.parse(content)
        items: List[Dict[str, Any]] = []

        for entry in (feed.entries or [])[: max_results]:
            title = entry.get("title", "") or ""
            link = entry.get("link", "") or ""
            published = entry.get("published", "") or ""
            summary = entry.get("summary", "") or ""

            items.append(
                _evidence_item(
                    source="google_news_rss",
                    confidence="rss",
                    signal_type="press",
                    url=link,
                    title=title,
                    date=published,
                    snippet=summary,
                    meta={"query": query},
                )
            )

        return {
            "available": len(items) > 0,
            "source": "google_news_rss",
            "evidence": items,
        }


async def get_github_mentions(
    brand_name: str,
    max_results: int = 5,
) -> Dict[str, Any]:
    if os.getenv("ENABLE_GITHUB", "true").lower() not in ("1", "true", "yes", "y"):
        return {"available": False, "source": "github", "evidence": [], "error": "disabled"}

    q = quote_plus(brand_name.strip())
    url = f"https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page={min(max_results, 20)}"

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "RealDoc-BrandVisibility",
    }

    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        await asyncio.sleep(RATE_LIMIT_DELAY_S)
        data = await _get_json(session, url, timeout_s=DEFAULT_TIMEOUT_S, headers=headers)
        if not data:
            return {"available": False, "source": "github", "evidence": [], "error": "fetch_failed"}

        items: List[Dict[str, Any]] = []
        for repo in (data.get("items") or [])[:max_results]:
            items.append(
                _evidence_item(
                    source="github",
                    confidence="api",
                    signal_type="dev",
                    url=repo.get("html_url", "") or "",
                    title=repo.get("full_name", "") or repo.get("name", "") or "",
                    date=repo.get("updated_at", "") or "",
                    snippet=repo.get("description", "") or "",
                    meta={
                        "stars": repo.get("stargazers_count", 0),
                        "language": repo.get("language", "") or "",
                    },
                )
            )

        return {"available": len(items) > 0, "source": "github", "evidence": items}


async def get_hackernews_mentions(
    brand_name: str,
    max_results: int = 5,
) -> Dict[str, Any]:
    if os.getenv("ENABLE_HACKERNEWS", "true").lower() not in ("1", "true", "yes", "y"):
        return {"available": False, "source": "hackernews", "evidence": [], "error": "disabled"}

    q = quote_plus(brand_name.strip())
    url = f"https://hn.algolia.com/api/v1/search?query={q}&tags=story&hitsPerPage={min(max_results, 20)}"

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        await asyncio.sleep(RATE_LIMIT_DELAY_S)
        data = await _get_json(session, url, timeout_s=DEFAULT_TIMEOUT_S)
        if not data:
            return {"available": False, "source": "hackernews", "evidence": [], "error": "fetch_failed"}

        items: List[Dict[str, Any]] = []
        for hit in (data.get("hits") or [])[:max_results]:
            object_id = hit.get("objectID", "") or ""
            hn_url = f"https://news.ycombinator.com/item?id={object_id}" if object_id else ""
            title = hit.get("title", "") or ""
            link = hit.get("url", "") or hn_url

            created_at = hit.get("created_at", "") or ""

            items.append(
                _evidence_item(
                    source="hackernews",
                    confidence="api",
                    signal_type="community",
                    url=hn_url or link,
                    title=title,
                    date=created_at,
                    snippet=title,
                    meta={
                        "points": hit.get("points", 0),
                        "comments": hit.get("num_comments", 0),
                        "external_url": link,
                    },
                )
            )

        return {"available": len(items) > 0, "source": "hackernews", "evidence": items}


async def get_wikipedia_data(brand_name: str) -> Dict[str, Any]:
    if os.getenv("ENABLE_WIKIPEDIA", "true").lower() not in ("1", "true", "yes", "y"):
        return {"available": False, "source": "wikipedia", "evidence": [], "error": "disabled"}

    title = quote_plus(brand_name.strip())
    url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{title}"

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        await asyncio.sleep(RATE_LIMIT_DELAY_S)
        data = await _get_json(session, url, timeout_s=DEFAULT_TIMEOUT_S)
        if not data:
            return {"available": False, "source": "wikipedia", "evidence": [], "error": "fetch_failed"}

        if data.get("type") == "https://mediawiki.org/wiki/HyperSwitch/errors/not_found":
            return {
                "available": False,
                "source": "wikipedia",
                "evidence": [],
                "error": "no_page_found",
            }

        page_url = ""
        try:
            page_url = (data.get("content_urls") or {}).get("desktop", {}).get("page", "") or ""
        except Exception:
            page_url = ""

        extract = data.get("extract", "") or ""
        page_title = data.get("title", "") or brand_name

        item = _evidence_item(
            source="wikipedia",
            confidence="api",
            signal_type="reputation",
            url=page_url,
            title=page_title,
            date="",
            snippet=extract,
        )

        return {"available": True, "source": "wikipedia", "evidence": [item]}


async def get_pagespeed_insights(website_url: str) -> Dict[str, Any]:
    if os.getenv("ENABLE_PAGESPEED", "true").lower() not in ("1", "true", "yes", "y"):
        return {"available": False, "source": "pagespeed_insights", "evidence": [], "error": "disabled"}

    api_key = os.getenv("GOOGLE_PAGESPEED_API_KEY", "").strip()
    base = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
    u = quote_plus(website_url)
    if api_key:
        url = f"{base}?url={u}&key={api_key}"
    else:
        url = f"{base}?url={u}"

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        await asyncio.sleep(RATE_LIMIT_DELAY_S)
        data = await _get_json(session, url, timeout_s=30.0)
        if not data:
            return {"available": False, "source": "pagespeed_insights", "evidence": [], "error": "fetch_failed"}

        lighthouse = data.get("lighthouseResult") or {}
        categories = lighthouse.get("categories") or {}

        def _score(name: str) -> int:
            v = (categories.get(name) or {}).get("score", None)
            if v is None:
                return 0
            try:
                return int(float(v) * 100)
            except Exception:
                return 0

        perf = _score("performance")
        seo = _score("seo")
        access = _score("accessibility")
        best = _score("best-practices")

        audits = lighthouse.get("audits") or {}
        lcp = (audits.get("largest-contentful-paint") or {}).get("numericValue", None)
        cls = (audits.get("cumulative-layout-shift") or {}).get("numericValue", None)

        title = f"PageSpeed scores performance {perf} seo {seo}"
        snippet = f"Performance {perf} SEO {seo} Accessibility {access} BestPractices {best}"

        item = _evidence_item(
            source="pagespeed_insights",
            confidence="api",
            signal_type="performance",
            url=url,
            title=title,
            date=_now_iso(),
            snippet=snippet,
            meta={
                "performance_score": perf,
                "seo_score": seo,
                "accessibility_score": access,
                "best_practices_score": best,
                "lcp_ms": lcp,
                "cls": cls,
                "using_api_key": bool(api_key),
            },
        )

        return {"available": True, "source": "pagespeed_insights", "evidence": [item]}


async def get_builtwith_data(website_url: str) -> Dict[str, Any]:
    if os.getenv("ENABLE_BUILTWITH", "false").lower() not in ("1", "true", "yes", "y"):
        return {"available": False, "source": "builtwith", "evidence": [], "error": "disabled"}

    api_key = os.getenv("BUILTWITH_API_KEY", "").strip()
    if not api_key:
        return {"available": False, "source": "builtwith", "evidence": [], "error": "missing_api_key"}

    domain = _domain_from_url(website_url) or website_url
    url = f"https://api.builtwith.com/v20/api.json?KEY={quote_plus(api_key)}&LOOKUP={quote_plus(domain)}"

    async with aiohttp.ClientSession(headers=DEFAULT_HEADERS) as session:
        await asyncio.sleep(RATE_LIMIT_DELAY_S)
        data = await _get_json(session, url, timeout_s=DEFAULT_TIMEOUT_S)
        if not data:
            return {"available": False, "source": "builtwith", "evidence": [], "error": "fetch_failed"}

        tech_names: List[str] = []
        try:
            groups = (((data.get("Results") or [])[0] or {}).get("Result") or {}).get("Paths") or []
            for g in groups[:8]:
                tg = g.get("Technologies") or []
                for t in tg[:12]:
                    name = (t.get("Name") or "").strip()
                    if name and name not in tech_names:
                        tech_names.append(name)
        except Exception:
            tech_names = []

        item = _evidence_item(
            source="builtwith",
            confidence="api",
            signal_type="tech_stack",
            url=url,
            title=f"BuiltWith tech stack for {domain}",
            date=_now_iso(),
            snippet="Tech stack returned by BuiltWith API",
            meta={"domain": domain, "tech": tech_names[:25]},
        )
        return {"available": True, "source": "builtwith", "evidence": [item]}


def _dedupe_evidence(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen = set()
    out: List[Dict[str, Any]] = []
    for it in items:
        key = (it.get("source", ""), it.get("url", ""), it.get("title", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append(it)
    return out


def format_brand_visibility_data_for_prompt(
    data: Dict[str, Any],
    brand_name: str,
    for_seo: bool = True
) -> Dict[str, Any]:
    """
    Format brand visibility evidence for LLM prompts.
    Returns a short, citeable text block plus the raw evidence list.
    """
    if not data or not data.get("available"):
        return {"text": "", "evidence": []}

    evidence = data.get("evidence") or []
    summary = data.get("summary") or {}
    sources = data.get("sources") or []

    lines: List[str] = []
    lines.append("BRAND VISIBILITY EVIDENCE (CITE ONLY THESE ITEMS)")
    if brand_name:
        lines.append(f"Brand: {brand_name}")
    if sources:
        lines.append(f"Sources: {', '.join(sources)}")
    if summary:
        count = summary.get("total_evidence_items")
        if count is not None:
            lines.append(f"Total evidence items: {count}")

    max_items = 8 if for_seo else 5
    for item in evidence[:max_items]:
        src = item.get("source", "")
        title = _clamp_text(item.get("title", ""), 140)
        url = item.get("url", "")
        snippet = _clamp_text(item.get("snippet", ""), 180)
        parts = [p for p in [f"[{src}]" if src else "", title, url] if p]
        line = " ".join(parts)
        if snippet:
            line = f"{line} — {snippet}"
        if line:
            lines.append(f"- {line}")

    text = "\n".join(lines).strip()
    return {"text": text, "evidence": evidence}


async def get_brand_visibility_data(
    brand_name: str,
    website_url: Optional[str] = None,
    max_results_per_source: int = 5,
    include_press: bool = True,
    include_community: bool = True,
    include_dev: bool = True,
    include_reputation: bool = True,
    include_performance: bool = False,
    include_tech_stack: bool = False,
) -> Dict[str, Any]:
    """
    Main entry point
    Defaults are tuned for SEO reports
    Performance and tech stack are off unless you explicitly request technical evidence
    """
    brand_name = (brand_name or "").strip()
    if not brand_name:
        return {
            "available": False,
            "sources": [],
            "summary": {"error": "missing_brand_name"},
            "evidence": [],
        }

    tasks: List[asyncio.Task] = []
    sources_requested: List[str] = []

    if include_press:
        sources_requested.append("google_news_rss")
        tasks.append(asyncio.create_task(get_google_news_mentions(brand_name, website_url, max_results_per_source)))

    if include_dev:
        sources_requested.append("github")
        tasks.append(asyncio.create_task(get_github_mentions(brand_name, max_results_per_source)))

    if include_community:
        sources_requested.append("hackernews")
        tasks.append(asyncio.create_task(get_hackernews_mentions(brand_name, max_results_per_source)))

    if include_reputation:
        sources_requested.append("wikipedia")
        tasks.append(asyncio.create_task(get_wikipedia_data(brand_name)))

    if include_performance and website_url:
        sources_requested.append("pagespeed_insights")
        tasks.append(asyncio.create_task(get_pagespeed_insights(website_url)))

    if include_tech_stack and website_url:
        sources_requested.append("builtwith")
        tasks.append(asyncio.create_task(get_builtwith_data(website_url)))

    try:
        results = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=30.0)
    except asyncio.TimeoutError:
        results = []

    evidence: List[Dict[str, Any]] = []
    used_sources: List[str] = []
    errors: Dict[str, str] = {}

    for res in results:
        if isinstance(res, Exception):
            continue
        if not isinstance(res, dict):
            continue

        src = res.get("source", "")
        if res.get("available"):
            used_sources.append(src)
            evidence.extend(res.get("evidence") or [])
        else:
            if src:
                errors[src] = res.get("error", "not_available")

    evidence = _dedupe_evidence(evidence)
    evidence = evidence[:MAX_EVIDENCE_TOTAL]

    available = len(evidence) > 0

    summary = {
        "brand_name": brand_name,
        "website_url": website_url or "",
        "requested_sources": sources_requested,
        "used_sources": used_sources,
        "total_evidence_items": len(evidence),
        "generated_at": _now_iso(),
    }
    if errors:
        summary["errors"] = errors

    return {
        "available": available,
        "sources": used_sources,
        "summary": summary,
        "evidence": evidence,
    }


async def get_brand_visibility_data(
    brand_name: str,
    website_url: Optional[str] = None,
    max_results_per_source: int = 5,
    include_press: bool = True,
    include_community: bool = True,
    include_dev: bool = True,
    include_reputation: bool = True,
    include_performance: bool = False,
    include_tech_stack: bool = False,
) -> Dict[str, Any]:
    brand_name = (brand_name or "").strip()
    if not brand_name:
        return {
            "available": False,
            "sources": [],
            "summary": {"error": "missing_brand_name"},
            "evidence": [],
        }

    sem = asyncio.Semaphore(int(os.getenv("BRAND_VIS_MAX_CONCURRENCY", "3")))

    async def _run(coro):
        async with sem:
            return await coro

    tasks: List[asyncio.Task] = []
    sources_requested: List[str] = []

    if include_press:
        sources_requested.append("google_news_rss")
        tasks.append(asyncio.create_task(_run(get_google_news_mentions(brand_name, website_url, max_results_per_source))))

    if include_dev:
        sources_requested.append("github")
        tasks.append(asyncio.create_task(_run(get_github_mentions(brand_name, max_results_per_source))))

    if include_community:
        sources_requested.append("hackernews")
        tasks.append(asyncio.create_task(_run(get_hackernews_mentions(brand_name, max_results_per_source))))

    if include_reputation:
        sources_requested.append("wikipedia")
        tasks.append(asyncio.create_task(_run(get_wikipedia_data(brand_name))))

    if include_performance and website_url:
        sources_requested.append("pagespeed_insights")
        tasks.append(asyncio.create_task(_run(get_pagespeed_insights(website_url))))

    if include_tech_stack and website_url:
        sources_requested.append("builtwith")
        tasks.append(asyncio.create_task(_run(get_builtwith_data(website_url))))

    try:
        results = await asyncio.wait_for(asyncio.gather(*tasks, return_exceptions=True), timeout=30.0)
    except asyncio.TimeoutError:
        results = []

    evidence: List[Dict[str, Any]] = []
    used_sources: List[str] = []
    errors: Dict[str, str] = {}

    for res in results:
        if isinstance(res, Exception):
            continue
        if not isinstance(res, dict):
            continue

        src = res.get("source", "")
        if res.get("available"):
            used_sources.append(src)
            evidence.extend(res.get("evidence") or [])
        else:
            if src:
                errors[src] = res.get("error", "not_available")

    evidence = _dedupe_evidence(evidence)
    evidence = evidence[:MAX_EVIDENCE_TOTAL]

    summary = {
        "brand_name": brand_name,
        "website_url": website_url or "",
        "requested_sources": sources_requested,
        "used_sources": used_sources,
        "total_evidence_items": len(evidence),
        "generated_at": _now_iso(),
    }
    if errors:
        summary["errors"] = errors

    return {
        "available": len(evidence) > 0,
        "sources": used_sources,
        "summary": summary,
        "evidence": evidence,
    }