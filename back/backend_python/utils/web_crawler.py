"""
Web crawler utility for extracting content from URLs to enhance downstream analysis.

Real world constraints
Some sites block server side crawlers via WAF bot protection
Some pages require authentication
Some pages are JS rendered and raw HTML will look empty
"""

import os
import random
import re
import json
import asyncio
from typing import Optional, Dict, List, Any, Tuple
from urllib.parse import urlparse, quote_plus, urljoin

import aiohttp
from bs4 import BeautifulSoup

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except Exception:
    async_playwright = None  # type: ignore
    PLAYWRIGHT_AVAILABLE = False


DEFAULT_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]


def _build_headers(user_agent: Optional[str] = None, url: str = "") -> Dict[str, str]:
    ua = user_agent or random.choice(DEFAULT_USER_AGENTS)
    origin = ""
    try:
        p = urlparse(url)
        if p.scheme and p.netloc:
            origin = f"{p.scheme}://{p.netloc}"
    except Exception:
        origin = ""

    headers = {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
    }
    if origin:
        headers["Referer"] = origin
    return headers


def _looks_like_spa_shell(html: str) -> bool:
    if not html:
        return True
    h = html.lower()
    return (
        'id="root"' in h
        or 'id="__next"' in h
        or "data-reactroot" in h
        or "window.__initial_state__" in h
        or "webpack" in h
        or "vite" in h
    )


def _is_waf_or_challenge_page(html: str) -> bool:
    if not html:
        return False
    h = html.lower()
    return (
        "cloudflare" in h
        or "attention required" in h
        or "checking your browser" in h
        or "captcha" in h
        or "cf-chl" in h
        or "bot detection" in h
    )


def _should_retry(status: Optional[int], exc: Optional[Exception]) -> bool:
    if exc:
        return isinstance(exc, (aiohttp.ClientError, asyncio.TimeoutError))
    if status is None:
        return True
    return status in (408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524)


async def fetch_url_content(
    url: str,
    timeout: int = 12,
    max_retries: int = 2,
    proxy: Optional[str] = None,
) -> Optional[str]:
    proxy = proxy or os.getenv("CRAWLER_HTTP_PROXY") or None
    max_retries = int(os.getenv("CRAWLER_MAX_RETRIES", str(max_retries)))
    timeout = int(os.getenv("CRAWLER_TIMEOUT_SECONDS", str(timeout)))

    client_timeout = aiohttp.ClientTimeout(
        total=timeout,
        connect=min(6, timeout),
        sock_read=timeout,
    )

    async with aiohttp.ClientSession(
        timeout=client_timeout,
        cookie_jar=aiohttp.CookieJar(unsafe=True),
    ) as session:
        for attempt in range(max_retries + 1):
            try:
                headers = _build_headers(url=url)
                async with session.get(
                    url,
                    headers=headers,
                    allow_redirects=True,
                    max_redirects=10,
                    proxy=proxy,
                ) as response:
                    status = response.status
                    ctype = (response.headers.get("content-type") or "").lower()
                    text = await response.text(errors="ignore")

                    if status != 200:
                        if attempt < max_retries and _should_retry(status, None):
                            await asyncio.sleep(min(2 ** attempt, 8) + random.random())
                            continue
                        return text if ("text/html" in ctype or "<html" in (text or "").lower()) else None

                    if "text/html" not in ctype and "<html" not in (text or "").lower():
                        return None

                    if _is_waf_or_challenge_page(text):
                        return None

                    return text

            except Exception as e:
                if attempt < max_retries and _should_retry(None, e):
                    await asyncio.sleep(min(2 ** attempt, 8) + random.random())
                    continue
                return None


async def render_url_with_js(url: str, timeout: int = 25) -> Optional[str]:
    if not PLAYWRIGHT_AVAILABLE:
        return None

    nav_timeout_ms = int(os.getenv("CRAWLER_JS_TIMEOUT_MS", str(timeout * 1000)))

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                context = await browser.new_context(
                    user_agent=random.choice(DEFAULT_USER_AGENTS),
                    viewport={"width": 1280, "height": 720},
                )
                page = await context.new_page()
                await page.goto(url, wait_until="domcontentloaded", timeout=nav_timeout_ms)
                try:
                    await page.wait_for_load_state("networkidle", timeout=min(nav_timeout_ms, 12000))
                except Exception:
                    pass
                html = await page.content()
                if _is_waf_or_challenge_page(html):
                    return None
                return html
            finally:
                await browser.close()
    except Exception:
        return None


def extract_text_content(html: str, url: str = "") -> Dict[str, Any]:
    try:
        soup = BeautifulSoup(html, "lxml")

        title = ""
        if soup.title and soup.title.get_text():
            title = soup.title.get_text().strip()
        elif soup.find("meta", property="og:title"):
            title = soup.find("meta", property="og:title").get("content", "").strip()

        description = ""
        meta_desc = soup.find("meta", attrs={"name": "description"})
        if meta_desc:
            description = meta_desc.get("content", "").strip()
        elif soup.find("meta", property="og:description"):
            description = soup.find("meta", property="og:description").get("content", "").strip()

        h1_text = ""
        h1 = soup.find("h1")
        if h1 and h1.get_text():
            h1_text = h1.get_text().strip()[:200]

        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()

        main_tag = soup.find("main") or soup.find("article")
        if not main_tag:
            main_tag = soup.find("div", class_=re.compile(r"\b(content|main|container|page|wrapper)\b", re.I))

        if main_tag:
            for tag in main_tag.find_all(["nav", "footer", "aside"], recursive=True):
                tag.decompose()
            main_content = main_tag.get_text(separator=" ", strip=True)
        else:
            body = soup.find("body")
            if body:
                for tag in body.find_all(["nav", "footer", "aside"], recursive=True):
                    tag.decompose()
                main_content = body.get_text(separator=" ", strip=True)
            else:
                main_content = soup.get_text(separator=" ", strip=True)

        main_content = re.sub(r"\s+", " ", main_content).strip()

        headings: List[str] = []
        for heading in soup.find_all(["h1", "h2", "h3"]):
            t = heading.get_text().strip()
            if t and len(t) < 200:
                headings.append(t)

        features: List[str] = []
        for lst in soup.find_all(["ul", "ol"])[:12]:
            items = lst.find_all("li")
            for item in items[:12]:
                t = re.sub(r"\s+", " ", item.get_text().strip())
                if 10 < len(t) < 200 and t not in features:
                    features.append(t)
            if len(features) >= 18:
                break

        for schema in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(schema.string or "")
                if isinstance(data, dict) and "features" in data:
                    v = data["features"]
                    if isinstance(v, list):
                        for f in v[:10]:
                            s = str(f).strip()
                            if s and s not in features:
                                features.append(s)
                    elif isinstance(v, str):
                        s = v.strip()
                        if s and s not in features:
                            features.append(s)
            except Exception:
                pass

        base_domain = ""
        try:
            base_domain = urlparse(url).netloc.lower().replace("www.", "")
        except Exception:
            base_domain = ""

        internal_links: List[str] = []
        for a in soup.find_all("a", href=True):
            href = (a.get("href") or "").strip()
            if not href or href.startswith(("mailto:", "tel:", "#")):
                continue
            abs_url = urljoin(url, href)
            try:
                d = urlparse(abs_url).netloc.lower().replace("www.", "")
            except Exception:
                d = ""
            if not d or (base_domain and d == base_domain):
                internal_links.append(abs_url)

        seen_links = set()
        unique_internal_links: List[str] = []
        for u in internal_links:
            if u not in seen_links:
                seen_links.add(u)
                unique_internal_links.append(u)

        if len(main_content) > 8000:
            main_content = main_content[:8000] + "..."

        return {
            "title": title,
            "description": description,
            "h1": h1_text,
            "content": main_content,
            "headings": headings[:12],
            "features": features[:18],
            "url": url,
            "internal_link_count": len(unique_internal_links),
            "internal_links": unique_internal_links[:10],
            "debug": {"visible_text_len": len(main_content or "")},
        }
    except Exception as e:
        return {
            "title": "",
            "description": "",
            "h1": "",
            "content": "",
            "headings": [],
            "features": [],
            "url": url,
            "internal_link_count": 0,
            "internal_links": [],
            "debug": {"error": str(e)},
        }


def format_crawled_content_for_prompt(crawled_data: Dict[str, Any]) -> str:
    if not crawled_data or not crawled_data.get("content"):
        return ""
    parts: List[str] = []
    if crawled_data.get("title"):
        parts.append(f"Title: {crawled_data['title']}")
    if crawled_data.get("description"):
        parts.append(f"Description: {crawled_data['description']}")
    if crawled_data.get("headings"):
        parts.append(f"Key Sections: {', '.join(crawled_data['headings'][:5])}")
    if crawled_data.get("features"):
        parts.append(f"Key Features: {'; '.join(crawled_data['features'][:10])}")
    parts.append(f"Content Overview: {crawled_data['content'][:2000]}")
    return "\n\n".join(parts)


async def crawl_and_extract(
    url: str,
    timeout: int = 12,
    max_retries: int = 2,
    proxy: Optional[str] = None,
    use_js_render: Optional[bool] = None,
) -> Optional[Dict[str, Any]]:
    if use_js_render is None:
        use_js_render = os.getenv("CRAWLER_ENABLE_JS_RENDER", "false").lower() in ("1", "true", "yes", "y")

    parsed = urlparse(url)
    if not parsed.scheme:
        url = f"https://{url}"

    html = await fetch_url_content(url, timeout=timeout, max_retries=max_retries, proxy=proxy)

    if not html and use_js_render:
        rendered = await render_url_with_js(url, timeout=timeout * 2)
        if not rendered:
            return None
        extracted = extract_text_content(rendered, url)
        return extracted if extracted.get("content") else None

    if not html:
        return None

    extracted = extract_text_content(html, url)
    visible_len = int(extracted.get("debug", {}).get("visible_text_len", 0) or 0)

    needs_js = visible_len < 350 or _looks_like_spa_shell(html)
    if use_js_render and needs_js:
        rendered = await render_url_with_js(url, timeout=timeout * 2)
        if rendered:
            extracted2 = extract_text_content(rendered, url)
            visible_len2 = int(extracted2.get("debug", {}).get("visible_text_len", 0) or 0)
            if visible_len2 > visible_len:
                return extracted2 if extracted2.get("content") else None

    return extracted if extracted.get("content") else None


def extract_related_links(html: str, base_url: str, max_links: int = 5) -> List[str]:
    if not html:
        return []
    try:
        parsed_base = urlparse(base_url)
        base_domain = parsed_base.netloc.lower().replace("www.", "")
        soup = BeautifulSoup(html, "lxml")
        links: List[str] = []

        for a in soup.find_all("a", href=True):
            href = (a.get("href") or "").strip()
            if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
                continue
            absolute = urljoin(base_url, href)
            parsed = urlparse(absolute)
            if parsed.scheme not in ("http", "https"):
                continue
            domain = parsed.netloc.lower().replace("www.", "")
            if domain != base_domain:
                continue
            normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}".rstrip("/")
            if normalized not in links:
                links.append(normalized)
            if len(links) >= max_links:
                break

        return links
    except Exception:
        return []


async def discover_related_sites(
    url: str,
    max_links: int = 5,
    use_js_render: Optional[bool] = None,
) -> List[str]:
    if use_js_render is None:
        use_js_render = os.getenv("CRAWLER_ENABLE_JS_RENDER", "false").lower() in ("1", "true", "yes", "y")

    parsed = urlparse(url)
    if not parsed.scheme:
        url = f"https://{url}"

    html = await fetch_url_content(url)
    if not html and use_js_render:
        html = await render_url_with_js(url, timeout=20)
    if not html:
        return []
    return extract_related_links(html, url, max_links=max_links)


async def crawl_competitors(
    competitor_urls: List[str],
    max_concurrent: int = 3,
    use_js_render: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    if not competitor_urls:
        return []

    semaphore = asyncio.Semaphore(max(1, max_concurrent))
    results: List[Optional[Dict[str, Any]]] = [None] * len(competitor_urls)

    async def _crawl(idx: int, u: str) -> None:
        async with semaphore:
            try:
                data = await crawl_and_extract(u, use_js_render=use_js_render)
                results[idx] = data
            except Exception:
                results[idx] = None

    tasks = [asyncio.create_task(_crawl(i, u)) for i, u in enumerate(competitor_urls)]
    await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if r]


def _normalize_domain(u: str) -> str:
    try:
        p = urlparse(u)
        return p.netloc.lower().replace("www.", "")
    except Exception:
        return ""


async def _duckduckgo_results(query: str, max_results: int = 20) -> List[str]:
    encoded = quote_plus(query)
    search_url = f"https://html.duckduckgo.com/html/?q={encoded}"
    headers = {
        "User-Agent": random.choice(DEFAULT_USER_AGENTS),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
        async with session.get(search_url, headers=headers) as resp:
            if resp.status != 200:
                return []
            html = await resp.text(errors="ignore")
    soup = BeautifulSoup(html, "lxml")
    links = soup.find_all("a", class_="result__a", href=True)
    urls: List[str] = []
    for a in links[: max_results * 2]:
        href = a.get("href") or ""
        if href.startswith("http"):
            urls.append(href)
    dedup: List[str] = []
    seen = set()
    for u in urls:
        if u not in seen:
            seen.add(u)
            dedup.append(u)
    return dedup[:max_results]


async def check_keyword_ranking(keyword: str, website_url: str, max_results: int = 20) -> Optional[Dict[str, Any]]:
    target_domain = _normalize_domain(website_url)
    if not target_domain:
        return None

    results = await _duckduckgo_results(keyword, max_results=max_results)
    for pos, u in enumerate(results, 1):
        d = _normalize_domain(u)
        if not d:
            continue
        if target_domain in d or d in target_domain:
            return {"keyword": keyword, "found": True, "position": pos, "url": website_url}
    return {"keyword": keyword, "found": False, "position": None, "url": website_url}


def extract_keywords_from_content(crawled_data: Dict[str, Any], max_keywords: int = 15) -> List[str]:
    if not crawled_data:
        return []
    stop = {
        "the","a","an","and","or","but","in","on","at","to","for","of","with","by","from",
        "is","are","was","were","be","been","being","have","has","had","do","does","did",
        "will","would","should","could","may","might","must","can","this","that","these","those"
    }

    text_sources = " ".join(
        [
            crawled_data.get("title", "") or "",
            crawled_data.get("description", "") or "",
            " ".join(crawled_data.get("headings", []) or []),
            (crawled_data.get("content", "") or "")[:2000],
        ]
    ).lower()

    words = re.findall(r"\b[a-z0-9]{4,}\b", text_sources)
    freq: Dict[str, int] = {}
    for w in words:
        if w in stop:
            continue
        freq[w] = freq.get(w, 0) + 1

    ranked = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    out: List[str] = []
    for w, _ in ranked:
        out.append(w)
        if len(out) >= max_keywords:
            break
    return out


async def analyze_keyword_rankings(
    crawled_data: Optional[Dict[str, Any]],
    website_url: str,
    target_keywords: Optional[str] = None,
    max_keywords: int = 10,
) -> Dict[str, Any]:
    extracted = extract_keywords_from_content(crawled_data or {}, max_keywords=max_keywords) if crawled_data else []

    targets: List[str] = []
    if target_keywords:
        targets = [t.strip() for t in target_keywords.split(",") if t.strip()]

    all_keywords = []
    seen = set()
    for k in extracted + targets:
        kk = k.lower().strip()
        if kk and kk not in seen:
            seen.add(kk)
            all_keywords.append(k)
        if len(all_keywords) >= max_keywords:
            break

    if not all_keywords:
        return {
            "extracted_keywords": extracted,
            "target_keywords": targets,
            "rankings": [],
            "summary": "No keywords found to analyze.",
            "found_count": 0,
            "top_10_count": 0,
            "top_3_count": 0,
            "total_checked": 0,
        }

    sem = asyncio.Semaphore(3)

    async def _check(k: str) -> Optional[Dict[str, Any]]:
        async with sem:
            return await check_keyword_ranking(k, website_url, max_results=20)

    results = await asyncio.gather(*[_check(k) for k in all_keywords], return_exceptions=True)
    rankings: List[Dict[str, Any]] = []
    for r in results:
        if isinstance(r, dict):
            rankings.append(r)

    found_count = sum(1 for r in rankings if r.get("found"))
    top_10_count = sum(1 for r in rankings if r.get("found") and (r.get("position") or 999) <= 10)
    top_3_count = sum(1 for r in rankings if r.get("found") and (r.get("position") or 999) <= 3)

    summary = f"Ranking Analysis: {found_count}/{len(rankings)} keywords found. {top_10_count} in top 10. {top_3_count} in top 3."
    return {
        "extracted_keywords": extracted,
        "target_keywords": targets,
        "rankings": rankings,
        "summary": summary,
        "found_count": found_count,
        "top_10_count": top_10_count,
        "top_3_count": top_3_count,
        "total_checked": len(rankings),
    }


async def get_google_autocomplete_suggestions(keyword: str) -> List[str]:
    try:
        encoded = quote_plus(keyword)
        url = f"https://www.google.com/complete/search?client=firefox&q={encoded}"
        headers = {"User-Agent": random.choice(DEFAULT_USER_AGENTS), "Accept": "application/json"}
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    return []
                data = await resp.json()
        if data and len(data) > 1 and isinstance(data[1], list):
            return [str(x) for x in data[1][:10]]
        return []
    except Exception:
        return []


async def find_competitors_by_website(website_url: str, max_results: int = 5) -> List[str]:
    base_domain = _normalize_domain(website_url)
    if not base_domain:
        return []

    query = f"{base_domain} alternatives"
    results = await _duckduckgo_results(query, max_results=max_results * 3)

    skip = {"wikipedia.org","reddit.com","quora.com","youtube.com","twitter.com","facebook.com","linkedin.com","pinterest.com","instagram.com","tiktok.com","duckduckgo.com","google.com"}
    out: List[str] = []
    for u in results:
        d = _normalize_domain(u)
        if not d or d == base_domain:
            continue
        if any(s in d for s in skip):
            continue
        if u not in out:
            out.append(u)
        if len(out) >= max_results:
            break
    return out


async def analyze_competitor_keywords(competitor_data_list: List[Dict[str, Any]], max_keywords: int = 10) -> Dict[str, Any]:
    if not competitor_data_list:
        return {"competitor_keywords": {}, "high_volume_keywords": []}

    competitor_keywords: Dict[str, List[str]] = {}
    all_keywords: List[str] = []
    for c in competitor_data_list:
        u = c.get("url") or ""
        kws = extract_keywords_from_content(c, max_keywords=20)
        competitor_keywords[u] = kws
        all_keywords.extend(kws)

    uniq: List[str] = []
    seen = set()
    for k in all_keywords:
        kk = k.lower().strip()
        if kk and kk not in seen:
            seen.add(kk)
            uniq.append(k)
    uniq = uniq[:30]

    sem = asyncio.Semaphore(5)

    async def _suggest(k: str) -> Tuple[str, List[str]]:
        async with sem:
            return (k, await get_google_autocomplete_suggestions(k))

    pairs = await asyncio.gather(*[_suggest(k) for k in uniq], return_exceptions=True)

    scored: List[Dict[str, Any]] = []
    for p in pairs:
        if isinstance(p, tuple) and len(p) == 2:
            k, sugg = p
            scored.append({"keyword": k, "autocomplete_count": len(sugg), "suggestions": sugg[:5]})

    scored.sort(key=lambda x: x["autocomplete_count"], reverse=True)

    high_volume: List[Dict[str, Any]] = []
    for item in scored[:max_keywords]:
        k = item["keyword"]
        high_volume.append(
            {
                "keyword": k,
                "search_volume_indicator": item["autocomplete_count"],
                "related_suggestions": item["suggestions"],
                "competitors_using": [u for u, kws in competitor_keywords.items() if k in kws][:5],
            }
        )

    return {"competitor_keywords": competitor_keywords, "high_volume_keywords": high_volume}


def compute_keyword_gaps(
    site_keywords: List[str],
    competitor_keywords_map: Dict[str, List[str]],
    max_items: int = 25,
) -> List[Dict[str, Any]]:
    site_set = {k.lower().strip() for k in (site_keywords or []) if k}
    counts: Dict[str, Dict[str, Any]] = {}

    for comp_url, kws in (competitor_keywords_map or {}).items():
        for kw in (kws or []):
            k = (kw or "").lower().strip()
            if not k:
                continue
            if k in site_set:
                continue
            if k not in counts:
                counts[k] = {"keyword": kw, "competitors_using": set(), "count": 0}
            counts[k]["competitors_using"].add(comp_url)

    out: List[Dict[str, Any]] = []
    for v in counts.values():
        competitors = sorted(list(v["competitors_using"]))[:5]
        out.append(
            {
                "keyword": v["keyword"],
                "competitors_using": competitors,
                "count": len(v["competitors_using"]),
            }
        )

    out.sort(key=lambda x: x["count"], reverse=True)
    return out[:max_items]


async def get_competitor_high_volume_keywords(
    website_url: str,
    max_competitors: int = 5,
    max_keywords: int = 10,
) -> Dict[str, Any]:
    competitor_urls = await find_competitors_by_website(website_url, max_results=max_competitors)
    if not competitor_urls:
        return {"competitors_found": 0, "competitors_crawled": 0, "high_volume_keywords": []}

    competitor_data = await crawl_competitors(competitor_urls, max_concurrent=3, use_js_render=True)
    analysis = await analyze_competitor_keywords(competitor_data, max_keywords=max_keywords)

    site_keywords: List[str] = []
    # If you have the site crawled_data upstream, pass its keywords in from seo_helper.
    # For now this remains empty unless you wire it in from seo_helper.
    keyword_gaps = compute_keyword_gaps(site_keywords, analysis.get("competitor_keywords") or {}, max_items=25)

    competitor_pages: List[Dict[str, Any]] = []
    for c in competitor_data[:6]:
        competitor_pages.append(
            {
                "url": c.get("url") or "",
                "title": (c.get("title") or "")[:160],
                "h1": (c.get("h1") or "")[:200],
                "description": (c.get("description") or "")[:240],
                "headings": (c.get("headings") or [])[:8],
                "features": (c.get("features") or [])[:8],
                "internal_link_count": c.get("internal_link_count", 0),
            }
        )

    return {
        "competitors_found": len(competitor_urls),
        "competitors_crawled": len(competitor_data),
        "competitor_pages": competitor_pages,
        "keyword_gaps": keyword_gaps,
        **analysis,
    }


async def cluster_keywords_by_intent_difficulty_opportunity(
    keywords: List[str],
    rankings_data: List[Dict[str, Any]],
    website_url: str,
) -> Dict[str, Any]:
    # This function is intentionally best effort without calling an LLM here.
    # It returns a simple heuristic structure so your report has something to cite.
    ranked_map = {r.get("keyword", "").lower(): r for r in (rankings_data or []) if isinstance(r, dict)}

    intent = {"informational": [], "navigational": [], "transactional": [], "commercial": []}

    for kw in keywords[:30]:
        k = (kw or "").lower()
        if not k:
            continue
        if any(x in k for x in ["buy", "price", "pricing", "download", "subscribe"]):
            intent["transactional"].append(kw)
        elif any(x in k for x in ["vs", "best", "compare", "review", "alternative"]):
            intent["commercial"].append(kw)
        elif website_url.lower().replace("www.", "") in k:
            intent["navigational"].append(kw)
        else:
            intent["informational"].append(kw)

    difficulty = {"low": [], "medium": [], "high": []}
    opportunity = {"high": [], "medium": [], "low": []}

    for kw in keywords[:30]:
        r = ranked_map.get((kw or "").lower(), {})
        pos = r.get("position")
        found = bool(r.get("found"))
        if not found:
            opportunity["high"].append({"keyword": kw, "score": 8, "reason": "Not currently found in results"})
            difficulty["medium"].append({"keyword": kw, "score": 6})
        else:
            if pos and pos <= 3:
                opportunity["low"].append({"keyword": kw, "score": 2})
                difficulty["high"].append({"keyword": kw, "score": 8})
            elif pos and pos <= 10:
                opportunity["medium"].append({"keyword": kw, "score": 5})
                difficulty["medium"].append({"keyword": kw, "score": 6})
            else:
                opportunity["high"].append({"keyword": kw, "score": 7, "reason": "Found but not in top 10"})
                difficulty["high"].append({"keyword": kw, "score": 8})

    return {"intent": intent, "difficulty": difficulty, "opportunity": opportunity}