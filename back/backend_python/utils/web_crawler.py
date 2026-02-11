"""
Web crawler utility for extracting content from URLs to enhance documentation generation.

Notes / real-world constraints:
- Some sites block server-side crawlers (WAF / bot protection / IP reputation).
- Some pages require authentication (login/paywall/VPN/intranet).
- Some pages are JS-rendered (SPA) and won't expose content in raw HTML.
"""
import os
import random
import re
from typing import Optional, Dict, List, Any

import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse, quote_plus
import asyncio

try:
    # Optional dependency for JS-rendered crawling
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except Exception:
    async_playwright = None  # type: ignore
    PLAYWRIGHT_AVAILABLE = False


DEFAULT_USER_AGENTS = [
    # A small rotation helps with overly strict bot heuristics (not a bypass for real WAF).
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
]


def _build_headers(user_agent: Optional[str] = None) -> Dict[str, str]:
    ua = user_agent or random.choice(DEFAULT_USER_AGENTS)
    return {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }


def _classify_fetch_failure(status: Optional[int], body: str = "", exc: Optional[Exception] = None) -> str:
    """
    Best-effort classification used for logging and UX messaging.
    We do NOT change behavior based on this classification (other than retries).
    """
    if exc:
        if isinstance(exc, asyncio.TimeoutError):
            return "timeout"
        msg = str(exc).lower()
        if "ssl" in msg or "certificate" in msg:
            return "tls_error"
        return "network_error"

    if status is None:
        return "unknown"

    if status in (401, 402):
        return "auth_required"
    if status in (403, 406):
        return "forbidden"
    if status in (407,):
        return "proxy_auth_required"
    if status in (408, 504):
        return "timeout"
    if status in (429,):
        return "rate_limited"
    if status in (451,):
        return "unavailable_legal"
    if status in (500, 502, 503, 520, 521, 522, 523, 524):
        # Includes common CDN/WAF edge failures
        return "upstream_error"

    body_l = (body or "").lower()
    if "captcha" in body_l or "cloudflare" in body_l or "bot detection" in body_l:
        return "waf_bot_protection"

    return "http_error"


def _should_retry(status: Optional[int], exc: Optional[Exception]) -> bool:
    if exc:
        return isinstance(exc, (aiohttp.ClientError, asyncio.TimeoutError))
    if status is None:
        return True
    return status in (408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524)


async def fetch_url_content(
    url: str,
    timeout: int = 10,
    max_retries: int = 2,
    proxy: Optional[str] = None,
) -> Optional[str]:
    """
    Fetch content from a URL asynchronously.
    
    Args:
        url: The URL to fetch
        timeout: Request timeout in seconds
        max_retries: Number of retries on transient failures / rate limits
        proxy: Optional HTTP proxy URL (e.g. http://user:pass@host:port)
        
    Returns:
        Raw HTML content or None if error
    """
    proxy = proxy or os.getenv("CRAWLER_HTTP_PROXY") or None
    max_retries = int(os.getenv("CRAWLER_MAX_RETRIES", str(max_retries)))
    timeout = int(os.getenv("CRAWLER_TIMEOUT_SECONDS", str(timeout)))

    last_status: Optional[int] = None
    last_body_preview: str = ""
    last_exc: Optional[Exception] = None

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
        for attempt in range(max_retries + 1):
            last_exc = None
            try:
                headers = _build_headers()
                async with session.get(
                    url,
                    headers=headers,
                    allow_redirects=True,
                    max_redirects=10,
                    proxy=proxy,
                ) as response:
                    last_status = response.status
                    # Read a small preview for classification/logging without keeping huge pages in memory
                    text = await response.text(errors="ignore")
                    last_body_preview = (text or "")[:2000]

                    if response.status == 200:
                        return text

                    failure = _classify_fetch_failure(last_status, last_body_preview)
                    print(f"Error fetching URL {url}: Status {response.status} ({failure})")

                    if attempt < max_retries and _should_retry(last_status, None):
                        # Exponential backoff with jitter
                        await asyncio.sleep(min(2 ** attempt, 8) + random.random())
                        continue
                    return None

            except Exception as e:
                last_exc = e
                failure = _classify_fetch_failure(None, "", e)
                print(f"Error fetching URL {url}: {str(e)} ({failure})")
                if attempt < max_retries and _should_retry(None, e):
                    await asyncio.sleep(min(2 ** attempt, 8) + random.random())
                    continue
                return None


async def render_url_with_js(
    url: str,
    timeout: int = 20,
) -> Optional[str]:
    """
    Render a URL with JavaScript using Playwright (headless Chromium) and return the final HTML.

    This is useful for SPA / React / Vue apps where most content is injected client-side.
    """
    if not PLAYWRIGHT_AVAILABLE:
        print("Playwright is not installed; JS render mode is unavailable.")
        return None

    # Playwright uses milliseconds for timeout
    nav_timeout_ms = int(os.getenv("CRAWLER_JS_TIMEOUT_MS", str(timeout * 1000)))

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            try:
                page = await browser.new_page()
                await page.goto(url, wait_until="networkidle", timeout=nav_timeout_ms)
                html = await page.content()
                return html
            finally:
                await browser.close()
    except Exception as e:
        print(f"Error rendering URL with JS {url}: {e}")
        return None


def extract_text_content(html: str, url: str = "") -> Dict[str, str]:
    """
    Extract meaningful text content from HTML.
    
    Args:
        html: HTML content
        url: Original URL for reference
        
    Returns:
        Dictionary with extracted content:
        - title: Page title
        - description: Meta description or first paragraph
        - content: Main content text
        - headings: Key headings
        - features: Extracted feature list if available
    """
    try:
        soup = BeautifulSoup(html, 'lxml')
        
        # Extract title
        title = ""
        if soup.title:
            title = soup.title.get_text().strip()
        elif soup.find('meta', property='og:title'):
            title = soup.find('meta', property='og:title').get('content', '').strip()
        
        # Extract description
        description = ""
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            description = meta_desc.get('content', '').strip()
        elif soup.find('meta', property='og:description'):
            description = soup.find('meta', property='og:description').get('content', '').strip()
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
        
        # Extract main content
        main_content = ""
        # Try to find main content area
        main_tag = soup.find('main') or soup.find('article') or soup.find('div', class_=re.compile(r'content|main|body', re.I))
        if main_tag:
            main_content = main_tag.get_text(separator=' ', strip=True)
        else:
            # Fallback to body
            body = soup.find('body')
            if body:
                main_content = body.get_text(separator=' ', strip=True)
        
        # Clean up content (remove excessive whitespace)
        main_content = re.sub(r'\s+', ' ', main_content).strip()
        
        # Extract headings
        headings = []
        for heading in soup.find_all(['h1', 'h2', 'h3']):
            text = heading.get_text().strip()
            if text and len(text) < 200:  # Reasonable heading length
                headings.append(text)
        
        # Extract features/key points (look for lists or feature sections)
        features = []
        feature_sections = soup.find_all(['ul', 'ol'], class_=re.compile(r'feature|benefit|list', re.I))
        for section in feature_sections[:3]:  # Limit to first 3 lists
            items = section.find_all('li')
            for item in items[:10]:  # Limit to 10 items per list
                text = item.get_text().strip()
                if text and len(text) < 200:
                    features.append(text)
        
        # Limit content size (keep first 5000 characters for context)
        if len(main_content) > 5000:
            main_content = main_content[:5000] + "..."
        
        return {
            "title": title,
            "description": description,
            "content": main_content,
            "headings": headings[:10],  # Limit to 10 headings
            "features": features[:15],  # Limit to 15 features
            "url": url
        }
    except Exception as e:
        print(f"Error extracting content: {str(e)}")
        return {
            "title": "",
            "description": "",
            "content": "",
            "headings": [],
            "features": [],
            "url": url
        }


async def crawl_and_extract(
    url: str,
    timeout: int = 10,
    max_retries: int = 2,
    proxy: Optional[str] = None,
    use_js_render: Optional[bool] = None,
) -> Optional[Dict[str, str]]:
    """
    Crawl a URL and extract relevant content.
    
    Args:
        url: URL to crawl
        timeout: Request timeout in seconds
        max_retries: Number of retries on transient failures / rate limits
        proxy: Optional HTTP proxy URL
        use_js_render: If True, allow a JS-rendered fallback using Playwright
        
    Returns:
        Dictionary with extracted content or None if error
    """
    # Decide JS-render behavior (per-call flag overrides env)
    if use_js_render is None:
        use_js_render = os.getenv("CRAWLER_ENABLE_JS_RENDER", "false").lower() in (
            "1",
            "true",
            "yes",
            "y",
        )

    # Validate URL
    parsed = urlparse(url)
    if not parsed.scheme:
        url = f"https://{url}"
    
    # Fetch content (plain HTTP)
    html = await fetch_url_content(url, timeout=timeout, max_retries=max_retries, proxy=proxy)

    # Heuristic: if HTML is missing or extremely small / template-like, and JS render is enabled,
    # try a JS-rendered fallback to catch SPA/React content.
    if (not html or len(html or "") < 1000 or "<body" not in (html or "").lower()) and use_js_render:
        print(f"Attempting JS-rendered crawl for {url}...")
        rendered_html = await render_url_with_js(url, timeout=timeout * 2)
        if rendered_html:
            html = rendered_html
        elif not html:
            # If both plain fetch and JS render failed, give up
            return None

    if not html:
        return None

    # Extract content
    extracted = extract_text_content(html, url)
    # Ensure URL is included in the extracted data
    if extracted:
        extracted['url'] = url
    return extracted


async def search_google_competitors(app_name: str, app_type: str, max_results: int = 5) -> List[str]:
    """
    Search for competitor applications similar to the given app using DuckDuckGo.
    
    Args:
        app_name: Name of the application
        app_type: Type of application (web, mobile, api, saas, etc.)
        max_results: Maximum number of competitor URLs to return
        
    Returns:
        List of competitor URLs
    """
    try:
        # Build search query
        search_query = f"{app_name} {app_type} alternatives competitors similar apps"
        encoded_query = quote_plus(search_query)
        
        # Use DuckDuckGo HTML search
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.get(search_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'lxml')
                    
                    # Extract result URLs - DuckDuckGo HTML results
                    competitor_urls = []
                    
                    # Try multiple selectors for DuckDuckGo results
                    result_links = soup.find_all('a', class_='result__a', href=True)
                    if not result_links:
                        result_links = soup.find_all('a', class_='result-link', href=True)
                    if not result_links:
                        result_links = soup.find_all('a', {'class': re.compile(r'result', re.I)}, href=True)
                    
                    for link in result_links[:max_results * 3]:  # Get more to filter
                        href = link.get('href', '')
                        actual_url = None
                        
                        # Handle DuckDuckGo redirect URLs
                        if 'uddg=' in href:
                            import urllib.parse
                            try:
                                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                                if 'uddg' in parsed:
                                    actual_url = urllib.parse.unquote(parsed['uddg'][0])
                            except:
                                pass
                        elif href.startswith('http'):
                            actual_url = href
                        
                        if actual_url:
                            # Filter out unwanted domains
                            skip_domains = [
                                'wikipedia.org', 'reddit.com', 'quora.com', 'youtube.com',
                                'twitter.com', 'facebook.com', 'linkedin.com', 'pinterest.com',
                                'instagram.com', 'tiktok.com', 'duckduckgo.com'
                            ]
                            
                            # Also try to exclude the original app if we can identify it
                            if not any(skip in actual_url.lower() for skip in skip_domains):
                                # Basic deduplication
                                if actual_url not in competitor_urls:
                                    competitor_urls.append(actual_url)
                                    if len(competitor_urls) >= max_results:
                                        break
                    
                    return competitor_urls[:max_results]
    except Exception as e:
        print(f"Error searching for competitors: {str(e)}")
        return []
    
    return []


async def crawl_competitors(competitor_urls: List[str], max_concurrent: int = 3) -> List[Dict[str, str]]:
    """
    Crawl multiple competitor websites concurrently.
    
    Args:
        competitor_urls: List of competitor URLs to crawl
        max_concurrent: Maximum number of concurrent requests
        
    Returns:
        List of crawled competitor data dictionaries
    """
    if not competitor_urls:
        return []
    
    # Create semaphore to limit concurrent requests
    semaphore = asyncio.Semaphore(max_concurrent)
    
    async def crawl_with_semaphore(url):
        async with semaphore:
            try:
                data = await crawl_and_extract(url)
                if data:
                    data['url'] = url  # Ensure URL is set
                return data
            except Exception as e:
                print(f"Error crawling competitor {url}: {str(e)}")
                return None
    
    # Crawl all competitors concurrently
    tasks = [crawl_with_semaphore(url) for url in competitor_urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Filter out None and exceptions
    competitor_data = []
    for result in results:
        if result and isinstance(result, dict):
            competitor_data.append(result)
    
    return competitor_data


def format_competitor_analysis_for_prompt(competitor_data: List[Dict[str, str]], app_name: str) -> str:
    """
    Format competitor analysis to be included in the documentation generation prompt.
    
    Args:
        competitor_data: List of competitor crawled data
        app_name: Name of the main application
        
    Returns:
        Formatted string with competitor insights
    """
    if not competitor_data:
        return ""
    
    parts = []
    parts.append("═══════════════════════════════════════════════════════════════")
    parts.append("COMPETITOR ANALYSIS - ADDITIONAL CONTEXT FOR COMPREHENSIVE DOCUMENTATION")
    parts.append("═══════════════════════════════════════════════════════════════")
    parts.append(f"The following information was gathered from {len(competitor_data)} competitor applications similar to {app_name}:")
    parts.append("")
    
    for idx, competitor in enumerate(competitor_data, 1):
        competitor_parts = [f"Competitor {idx}:"]
        
        if competitor.get("title"):
            competitor_parts.append(f"  Name: {competitor['title']}")
        
        if competitor.get("url"):
            competitor_parts.append(f"  URL: {competitor['url']}")
        
        if competitor.get("description"):
            competitor_parts.append(f"  Description: {competitor['description'][:300]}")
        
        if competitor.get("features"):
            competitor_parts.append(f"  Key Features: {', '.join(competitor['features'][:5])}")
        
        if competitor.get("headings"):
            competitor_parts.append(f"  Main Sections: {', '.join(competitor['headings'][:3])}")
        
        if competitor.get("content"):
            content_preview = competitor['content'][:500]
            competitor_parts.append(f"  Content Summary: {content_preview}")
        
        parts.append("\n".join(competitor_parts))
        parts.append("")
    
    parts.append("USE THIS COMPETITOR INFORMATION TO:")
    parts.append("- Identify common features and patterns in the industry")
    parts.append("- Understand best practices for documentation in this space")
    parts.append("- Include comprehensive features that users might expect")
    parts.append("- Ensure documentation covers all aspects competitors address")
    parts.append("- Make the documentation more competitive and comprehensive")
    parts.append("═══════════════════════════════════════════════════════════════")
    
    return "\n".join(parts)


async def analyze_competitors_and_crawl(app_name: str, app_type: str, app_url: str = None) -> Dict[str, any]:
    """
    Complete competitor analysis workflow: search, crawl, and format.
    
    Args:
        app_name: Name of the application
        app_type: Type of application
        app_url: Optional URL of the main application (to exclude from competitors)
        
    Returns:
        Dictionary with competitor analysis data
    """
    try:
        # Search for competitors
        print(f"Searching for competitors of {app_name}...")
        competitor_urls = await search_google_competitors(app_name, app_type, max_results=5)
        
        if not competitor_urls:
            print("No competitors found")
            return {"competitors": [], "analysis": ""}
        
        print(f"Found {len(competitor_urls)} competitors, crawling...")
        
        # Crawl competitor websites
        competitor_data = await crawl_competitors(competitor_urls, max_concurrent=3)
        
        if not competitor_data:
            print("Failed to crawl competitor data")
            return {"competitors": [], "analysis": ""}
        
        print(f"Successfully crawled {len(competitor_data)} competitors")
        
        # Format for prompt
        analysis_text = format_competitor_analysis_for_prompt(competitor_data, app_name)
        
        return {
            "competitors": competitor_data,
            "analysis": analysis_text,
            "count": len(competitor_data)
        }
    except Exception as e:
        print(f"Error in competitor analysis: {str(e)}")
        return {"competitors": [], "analysis": ""}


def format_crawled_content_for_prompt(crawled_data: Dict[str, str]) -> str:
    """
    Format crawled content to be included in the documentation generation prompt.
    
    Args:
        crawled_data: Dictionary with extracted content
        
    Returns:
        Formatted string to include in prompt
    """
    if not crawled_data or not crawled_data.get("content"):
        return ""
    
    parts = []
    
    if crawled_data.get("title"):
        parts.append(f"Application Title: {crawled_data['title']}")
    
    if crawled_data.get("description"):
        parts.append(f"Description: {crawled_data['description']}")
    
    if crawled_data.get("headings"):
        parts.append(f"Key Sections: {', '.join(crawled_data['headings'][:5])}")
    
    if crawled_data.get("features"):
        parts.append(f"Key Features/Points: {'; '.join(crawled_data['features'][:10])}")
    
    if crawled_data.get("content"):
        # Use first 2000 characters of content
        content_preview = crawled_data['content'][:2000]
        parts.append(f"Content Overview: {content_preview}")
    
    return "\n\n".join(parts) if parts else ""


def extract_keywords_from_content(crawled_data: Dict[str, str], max_keywords: int = 15) -> List[str]:
    """
    Extract potential keywords from crawled website content.
    
    Args:
        crawled_data: Dictionary with extracted content (title, description, headings, content)
        max_keywords: Maximum number of keywords to extract
        
    Returns:
        List of potential keywords/phrases
    """
    if not crawled_data:
        return []
    
    keywords = []
    
    # Extract from title (usually contains main keywords)
    if crawled_data.get("title"):
        title_words = re.findall(r'\b\w{3,}\b', crawled_data["title"].lower())
        # Filter out common stop words
        stop_words = {'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'}
        title_keywords = [w for w in title_words if w not in stop_words and len(w) > 2]
        keywords.extend(title_keywords[:5])
    
    # Extract from headings (H1, H2, H3)
    if crawled_data.get("headings"):
        for heading in crawled_data["headings"][:5]:
            heading_words = re.findall(r'\b\w{4,}\b', heading.lower())
            heading_keywords = [w for w in heading_words if w not in stop_words and len(w) > 3]
            keywords.extend(heading_keywords[:3])
    
    # Extract from description
    if crawled_data.get("description"):
        desc_words = re.findall(r'\b\w{4,}\b', crawled_data["description"].lower())
        desc_keywords = [w for w in desc_words if w not in stop_words and len(w) > 3]
        keywords.extend(desc_keywords[:5])
    
    # Extract from content (look for repeated important words)
    if crawled_data.get("content"):
        content_lower = crawled_data["content"].lower()
        # Find words that appear multiple times (likely important keywords)
        words = re.findall(r'\b\w{4,}\b', content_lower)
        word_freq = {}
        for word in words:
            if word not in stop_words and len(word) > 3:
                word_freq[word] = word_freq.get(word, 0) + 1
        
        # Get most frequent words
        sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
        content_keywords = [word for word, freq in sorted_words[:10] if freq >= 2]
        keywords.extend(content_keywords)
    
    # Extract 2-3 word phrases from title and headings
    if crawled_data.get("title"):
        title_phrases = re.findall(r'\b\w{3,}\s+\w{3,}\b', crawled_data["title"].lower())
        keywords.extend(title_phrases[:3])
    
    if crawled_data.get("headings"):
        for heading in crawled_data["headings"][:3]:
            heading_phrases = re.findall(r'\b\w{3,}\s+\w{3,}\b', heading.lower())
            keywords.extend(heading_phrases[:2])
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keywords = []
    for kw in keywords:
        kw_lower = kw.lower().strip()
        if kw_lower and kw_lower not in seen and len(kw_lower) > 2:
            seen.add(kw_lower)
            unique_keywords.append(kw)
    
    return unique_keywords[:max_keywords]


async def check_keyword_ranking(keyword: str, website_url: str, max_results: int = 20) -> Optional[Dict[str, Any]]:
    """
    Check if a website appears in search results for a given keyword.
    
    Args:
        keyword: The keyword to search for
        website_url: The website URL to check ranking for
        max_results: Maximum number of search results to check
        
    Returns:
        Dictionary with ranking information:
        - keyword: The searched keyword
        - found: Boolean indicating if website was found
        - position: Position in search results (1-based, or None if not found)
        - url: The website URL
    """
    try:
        # Normalize website URL for comparison
        parsed_url = urlparse(website_url)
        website_domain = parsed_url.netloc.lower().replace('www.', '')
        
        # Build search query
        encoded_query = quote_plus(keyword)
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.get(search_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'lxml')
                    
                    # Extract result URLs
                    result_links = soup.find_all('a', class_='result__a', href=True)
                    if not result_links:
                        result_links = soup.find_all('a', class_='result-link', href=True)
                    if not result_links:
                        result_links = soup.find_all('a', {'class': re.compile(r'result', re.I)}, href=True)
                    
                    # Check each result
                    for position, link in enumerate(result_links[:max_results], 1):
                        href = link.get('href', '')
                        actual_url = None
                        
                        # Handle DuckDuckGo redirect URLs
                        if 'uddg=' in href:
                            import urllib.parse
                            try:
                                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                                if 'uddg' in parsed:
                                    actual_url = urllib.parse.unquote(parsed['uddg'][0])
                            except:
                                pass
                        elif href.startswith('http'):
                            actual_url = href
                        
                        if actual_url:
                            # Normalize for comparison
                            parsed_result = urlparse(actual_url)
                            result_domain = parsed_result.netloc.lower().replace('www.', '')
                            
                            # Check if this is the target website
                            if website_domain in result_domain or result_domain in website_domain:
                                return {
                                    "keyword": keyword,
                                    "found": True,
                                    "position": position,
                                    "url": website_url,
                                    "search_url": actual_url
                                }
                    
                    # Website not found in top results
                    return {
                        "keyword": keyword,
                        "found": False,
                        "position": None,
                        "url": website_url
                    }
                else:
                    return None
    except Exception as e:
        print(f"Error checking ranking for keyword '{keyword}': {str(e)}")
        return None


async def analyze_keyword_rankings(crawled_data: Dict[str, str], website_url: str, target_keywords: Optional[str] = None, max_keywords: int = 10) -> Dict[str, Any]:
    """
    Analyze keyword rankings for a website by extracting keywords and checking rankings.
    
    Args:
        crawled_data: Dictionary with crawled website content
        website_url: The website URL to check rankings for
        target_keywords: Optional comma-separated list of target keywords to check
        max_keywords: Maximum number of keywords to analyze
        
    Returns:
        Dictionary with ranking analysis:
        - extracted_keywords: List of keywords extracted from content
        - target_keywords: List of user-provided target keywords
        - rankings: List of ranking results for each keyword
        - summary: Summary of ranking performance
    """
    rankings = []
    extracted_keywords = []
    target_keyword_list = []
    
    # Extract keywords from content
    if crawled_data:
        extracted_keywords = extract_keywords_from_content(crawled_data, max_keywords=max_keywords)
        print(f"Extracted {len(extracted_keywords)} keywords from website content")
    
    # Parse target keywords
    if target_keywords:
        target_keyword_list = [kw.strip() for kw in target_keywords.split(',') if kw.strip()]
        print(f"Checking {len(target_keyword_list)} target keywords")
    
    # Combine and deduplicate keywords to check
    all_keywords = list(set(extracted_keywords + target_keyword_list))[:max_keywords]
    
    if not all_keywords:
        return {
            "extracted_keywords": extracted_keywords,
            "target_keywords": target_keyword_list,
            "rankings": [],
            "summary": "No keywords found to analyze."
        }
    
    print(f"Checking rankings for {len(all_keywords)} keywords...")
    
    # Check rankings for each keyword (with rate limiting)
    semaphore = asyncio.Semaphore(3)  # Limit concurrent requests
    
    async def check_with_semaphore(keyword):
        async with semaphore:
            return await check_keyword_ranking(keyword, website_url)
    
    tasks = [check_with_semaphore(kw) for kw in all_keywords]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results
    for result in results:
        if result and isinstance(result, dict):
            rankings.append(result)
        elif isinstance(result, Exception):
            print(f"Error checking ranking: {str(result)}")
    
    # Generate summary
    found_count = sum(1 for r in rankings if r.get("found", False))
    top_10_count = sum(1 for r in rankings if r.get("found", False) and r.get("position", 0) <= 10)
    top_3_count = sum(1 for r in rankings if r.get("found", False) and r.get("position", 0) <= 3)
    
    summary = f"Ranking Analysis: {found_count}/{len(rankings)} keywords found in search results. "
    summary += f"{top_10_count} in top 10, {top_3_count} in top 3."
    
    return {
        "extracted_keywords": extracted_keywords,
        "target_keywords": target_keyword_list,
        "rankings": rankings,
        "summary": summary,
        "found_count": found_count,
        "top_10_count": top_10_count,
        "top_3_count": top_3_count,
        "total_checked": len(rankings)
    }


async def get_google_autocomplete_suggestions(keyword: str) -> List[str]:
    """
    Get Google Autocomplete suggestions for a keyword (indicates search volume).
    
    Args:
        keyword: The keyword to get suggestions for
        
    Returns:
        List of autocomplete suggestions
    """
    try:
        encoded_keyword = quote_plus(keyword)
        # Use Google's autocomplete API endpoint
        autocomplete_url = f"https://www.google.com/complete/search?client=firefox&q={encoded_keyword}"
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
            async with session.get(autocomplete_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json'
            }) as response:
                if response.status == 200:
                    data = await response.json()
                    if data and len(data) > 1:
                        suggestions = data[1]  # Second element contains suggestions
                        return [s[0] for s in suggestions[:10]]  # Return top 10 suggestions
        return []
    except Exception as e:
        print(f"Error getting autocomplete suggestions for '{keyword}': {str(e)}")
        return []


async def find_competitors_by_website(website_url: str, max_results: int = 5) -> List[str]:
    """
    Find competitors by searching for similar websites based on the website's content.
    
    Args:
        website_url: The website URL to find competitors for
        max_results: Maximum number of competitor URLs to return
        
    Returns:
        List of competitor URLs
    """
    try:
        # First, crawl the website to get its title/description
        crawled_data = await crawl_and_extract(website_url)
        if not crawled_data:
            return []
        
        # Extract key terms from the website
        title = crawled_data.get("title", "")
        description = crawled_data.get("description", "")
        
        # Build search query from title and description
        search_terms = []
        if title:
            # Extract main words from title (first 3-4 words)
            title_words = title.split()[:4]
            search_terms.extend(title_words)
        
        if description:
            # Extract key phrases from description
            desc_words = description.split()[:5]
            search_terms.extend(desc_words)
        
        if not search_terms:
            # Fallback: use domain name
            parsed = urlparse(website_url)
            domain = parsed.netloc.replace('www.', '').split('.')[0]
            search_terms = [domain]
        
        # Build search query
        search_query = f"{' '.join(search_terms[:3])} alternatives competitors similar"
        encoded_query = quote_plus(search_query)
        
        # Use DuckDuckGo HTML search
        search_url = f"https://html.duckduckgo.com/html/?q={encoded_query}"
        
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=15)) as session:
            async with session.get(search_url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            }) as response:
                if response.status == 200:
                    html = await response.text()
                    soup = BeautifulSoup(html, 'lxml')
                    
                    # Extract result URLs
                    competitor_urls = []
                    result_links = soup.find_all('a', class_='result__a', href=True)
                    if not result_links:
                        result_links = soup.find_all('a', class_='result-link', href=True)
                    if not result_links:
                        result_links = soup.find_all('a', {'class': re.compile(r'result', re.I)}, href=True)
                    
                    # Normalize target URL for comparison
                    parsed_target = urlparse(website_url)
                    target_domain = parsed_target.netloc.lower().replace('www.', '')
                    
                    for link in result_links[:max_results * 3]:
                        href = link.get('href', '')
                        actual_url = None
                        
                        # Handle DuckDuckGo redirect URLs
                        if 'uddg=' in href:
                            import urllib.parse
                            try:
                                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                                if 'uddg' in parsed:
                                    actual_url = urllib.parse.unquote(parsed['uddg'][0])
                            except:
                                pass
                        elif href.startswith('http'):
                            actual_url = href
                        
                        if actual_url:
                            # Exclude the target website itself
                            parsed_result = urlparse(actual_url)
                            result_domain = parsed_result.netloc.lower().replace('www.', '')
                            
                            if target_domain not in result_domain and result_domain not in target_domain:
                                # Filter out unwanted domains
                                skip_domains = [
                                    'wikipedia.org', 'reddit.com', 'quora.com', 'youtube.com',
                                    'twitter.com', 'facebook.com', 'linkedin.com', 'pinterest.com',
                                    'instagram.com', 'tiktok.com', 'duckduckgo.com', 'google.com'
                                ]
                                
                                if not any(skip in actual_url.lower() for skip in skip_domains):
                                    if actual_url not in competitor_urls:
                                        competitor_urls.append(actual_url)
                                        if len(competitor_urls) >= max_results:
                                            break
                    
                    return competitor_urls[:max_results]
    except Exception as e:
        print(f"Error finding competitors for {website_url}: {str(e)}")
        return []
    
    return []


async def analyze_competitor_keywords(competitor_data_list: List[Dict[str, str]], max_keywords: int = 10) -> Dict[str, Any]:
    """
    Analyze keywords from competitor websites and identify high-volume keywords they rank for.
    
    Args:
        competitor_data_list: List of competitor crawled data
        max_keywords: Maximum number of high-volume keywords to return
        
    Returns:
        Dictionary with competitor keyword analysis:
        - competitor_keywords: Dict mapping competitor URL to their keywords
        - high_volume_keywords: List of high-volume keywords with autocomplete data
        - keyword_rankings: Ranking data for each keyword
    """
    if not competitor_data_list:
        return {
            "competitor_keywords": {},
            "high_volume_keywords": [],
            "keyword_rankings": []
        }
    
    all_competitor_keywords = {}
    all_keywords_set = set()
    
    # Extract keywords from each competitor
    for competitor in competitor_data_list:
        competitor_url = competitor.get("url", "unknown")
        if competitor_url:
            keywords = extract_keywords_from_content(competitor, max_keywords=20)
            all_competitor_keywords[competitor_url] = keywords
            all_keywords_set.update(keywords)
    
    # Get autocomplete suggestions for all keywords (indicates search volume)
    print(f"Getting autocomplete suggestions for {len(all_keywords_set)} keywords...")
    semaphore = asyncio.Semaphore(5)  # Limit concurrent requests
    
    async def get_suggestions_with_semaphore(keyword):
        async with semaphore:
            suggestions = await get_google_autocomplete_suggestions(keyword)
            return (keyword, suggestions)
    
    tasks = [get_suggestions_with_semaphore(kw) for kw in list(all_keywords_set)[:30]]  # Limit to 30 keywords
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Process results and identify high-volume keywords
    keyword_volume_data = {}
    for result in results:
        if isinstance(result, tuple):
            keyword, suggestions = result
            # More suggestions = higher search volume indicator
            keyword_volume_data[keyword] = {
                "keyword": keyword,
                "autocomplete_count": len(suggestions),
                "suggestions": suggestions[:5]  # Top 5 suggestions
            }
        elif isinstance(result, Exception):
            print(f"Error getting suggestions: {str(result)}")
    
    # Sort by autocomplete count (indicator of search volume)
    sorted_keywords = sorted(
        keyword_volume_data.items(),
        key=lambda x: x[1]["autocomplete_count"],
        reverse=True
    )
    
    # Get top high-volume keywords
    high_volume_keywords = []
    for keyword, data in sorted_keywords[:max_keywords]:
        high_volume_keywords.append({
            "keyword": keyword,
            "search_volume_indicator": data["autocomplete_count"],
            "related_suggestions": data["suggestions"],
            "competitors_using": [
                url for url, keywords in all_competitor_keywords.items()
                if keyword in keywords
            ]
        })
    
    return {
        "competitor_keywords": all_competitor_keywords,
        "high_volume_keywords": high_volume_keywords,
        "total_competitors_analyzed": len(competitor_data_list),
        "total_keywords_found": len(all_keywords_set)
    }


async def cluster_keywords_by_intent_difficulty_opportunity(
    keywords: List[str],
    rankings_data: List[Dict[str, Any]],
    website_url: str
) -> Dict[str, Any]:
    """
    Cluster keywords by intent, difficulty, and opportunity using AI analysis.
    
    Args:
        keywords: List of keywords to cluster
        rankings_data: List of ranking results for keywords
        website_url: Website URL for context
        
    Returns:
        Dictionary with clustered keywords:
        - informational: Keywords with informational intent
        - navigational: Keywords with navigational intent
        - transactional: Keywords with transactional intent
        - commercial: Keywords with commercial intent
        - low_difficulty: Easy to rank keywords
        - medium_difficulty: Medium difficulty keywords
        - high_difficulty: Hard to rank keywords
        - high_opportunity: High opportunity keywords
        - medium_opportunity: Medium opportunity keywords
        - low_opportunity: Low opportunity keywords
    """
    import os
    from openai import AsyncOpenAI
    from dotenv import load_dotenv
    
    load_dotenv()
    
    def get_openai_client():
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key or api_key == "sk-placeholder" or api_key.startswith("sk-placeholder"):
            raise ValueError("OpenAI API key is not configured.")
        return AsyncOpenAI(api_key=api_key)
    
    # Create ranking map for quick lookup
    ranking_map = {r.get('keyword', ''): r for r in rankings_data if r}
    
    # Prepare keyword data with ranking info
    keyword_data = []
    for kw in keywords[:30]:  # Limit to 30 keywords for analysis
        ranking_info = ranking_map.get(kw, {})
        keyword_data.append({
            'keyword': kw,
            'ranking': ranking_info.get('position') if ranking_info.get('found') else None,
            'found': ranking_info.get('found', False)
        })
    
    try:
        client = get_openai_client()
        
        prompt = f"""Analyze and cluster the following keywords for the website {website_url}:

Keywords with Ranking Data:
{chr(10).join([f"- {kw['keyword']}: {'Ranking #' + str(kw['ranking']) if kw['ranking'] else 'Not ranking'} ({'Found' if kw['found'] else 'Not found'})" for kw in keyword_data])}

Cluster these keywords into the following categories:

1. **Search Intent** (categorize each keyword):
   - Informational: User wants to learn/understand something
   - Navigational: User wants to find a specific website/page
   - Transactional: User wants to buy/purchase something
   - Commercial: User wants to compare/buy (research phase)

2. **Difficulty** (estimate ranking difficulty 1-10, where 1=easy, 10=very hard):
   - Low (1-4): Easy to rank, low competition
   - Medium (5-7): Moderate competition
   - High (8-10): High competition, difficult to rank

3. **Opportunity** (estimate opportunity score 1-10, based on search volume, competition, and current ranking):
   - High (8-10): High search volume, low competition, not ranking well
   - Medium (5-7): Moderate opportunity
   - Low (1-4): Low opportunity (already ranking well or very competitive)

Return a JSON object with this structure:
{{
  "intent": {{
    "informational": ["keyword1", "keyword2"],
    "navigational": ["keyword3"],
    "transactional": ["keyword4"],
    "commercial": ["keyword5"]
  }},
  "difficulty": {{
    "low": [{{"keyword": "kw1", "score": 3}}],
    "medium": [{{"keyword": "kw2", "score": 6}}],
    "high": [{{"keyword": "kw3", "score": 9}}]
  }},
  "opportunity": {{
    "high": [{{"keyword": "kw1", "score": 9, "reason": "High volume, low competition"}}],
    "medium": [{{"keyword": "kw2", "score": 6}}],
    "low": [{{"keyword": "kw3", "score": 3}}]
  }}
}}

Only return valid JSON, no additional text."""
        
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert SEO analyst specializing in keyword research and clustering. Return only valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        import json
        result_text = response.choices[0].message.content.strip()
        # Remove markdown code blocks if present
        if result_text.startswith("```"):
            result_text = result_text.split("```")[1]
            if result_text.startswith("json"):
                result_text = result_text[4:]
        result_text = result_text.strip()
        
        clustered = json.loads(result_text)
        return clustered
        
    except Exception as e:
        print(f"Error clustering keywords: {str(e)}")
        # Return basic structure on error
        return {
            "intent": {
                "informational": [],
                "navigational": [],
                "transactional": [],
                "commercial": []
            },
            "difficulty": {
                "low": [],
                "medium": [],
                "high": []
            },
            "opportunity": {
                "high": [],
                "medium": [],
                "low": []
            },
            "error": str(e)
        }


async def get_competitor_high_volume_keywords(website_url: str, max_competitors: int = 5, max_keywords: int = 10) -> Dict[str, Any]:
    """
    Complete workflow: Find competitors, crawl them, and extract high-volume keywords they rank for.
    
    Args:
        website_url: The website URL to analyze
        max_competitors: Maximum number of competitors to analyze
        max_keywords: Maximum number of high-volume keywords to return
        
    Returns:
        Dictionary with competitor keyword analysis and recommendations
    """
    try:
        print(f"Finding competitors for {website_url}...")
        competitor_urls = await find_competitors_by_website(website_url, max_results=max_competitors)
        
        if not competitor_urls:
            print("No competitors found")
            return {
                "competitors_found": 0,
                "high_volume_keywords": [],
                "recommendations": "No competitors found. Unable to analyze competitor keywords."
            }
        
        print(f"Found {len(competitor_urls)} competitors, crawling...")
        competitor_data = await crawl_competitors(competitor_urls, max_concurrent=3)
        
        if not competitor_data:
            print("Failed to crawl competitor data")
            return {
                "competitors_found": len(competitor_urls),
                "high_volume_keywords": [],
                "recommendations": "Found competitors but failed to crawl their content."
            }
        
        print(f"Successfully crawled {len(competitor_data)} competitors, analyzing keywords...")
        keyword_analysis = await analyze_competitor_keywords(competitor_data, max_keywords=max_keywords)
        
        return {
            "competitors_found": len(competitor_urls),
            "competitors_crawled": len(competitor_data),
            **keyword_analysis
        }
    except Exception as e:
        print(f"Error in competitor keyword analysis: {str(e)}")
        return {
            "competitors_found": 0,
            "high_volume_keywords": [],
            "recommendations": f"Error analyzing competitors: {str(e)}"
        }

