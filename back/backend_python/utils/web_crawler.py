"""
Web crawler utility for extracting content from URLs to enhance documentation generation.
"""
import re
from typing import Optional, Dict, List
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse, quote_plus
import asyncio


async def fetch_url_content(url: str, timeout: int = 10) -> Optional[str]:
    """
    Fetch content from a URL asynchronously.
    
    Args:
        url: The URL to fetch
        timeout: Request timeout in seconds
        
    Returns:
        Raw HTML content or None if error
    """
    try:
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=timeout)) as session:
            async with session.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }) as response:
                if response.status == 200:
                    return await response.text()
                else:
                    print(f"Error fetching URL {url}: Status {response.status}")
                    return None
    except Exception as e:
        print(f"Error fetching URL {url}: {str(e)}")
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


async def crawl_and_extract(url: str) -> Optional[Dict[str, str]]:
    """
    Crawl a URL and extract relevant content.
    
    Args:
        url: URL to crawl
        
    Returns:
        Dictionary with extracted content or None if error
    """
    # Validate URL
    parsed = urlparse(url)
    if not parsed.scheme:
        url = f"https://{url}"
    
    # Fetch content
    html = await fetch_url_content(url)
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

