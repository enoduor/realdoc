"""
Web crawler utility for extracting content from URLs to enhance documentation generation.
"""
import re
from typing import Optional, Dict
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse


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
    return extracted


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

