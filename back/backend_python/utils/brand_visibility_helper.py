"""
Brand Visibility Helper - Fetches brand mentions and visibility data from multiple free sources
Sources organized by feature:
- SEO: Google News RSS, Google Search Autocomplete, People Also Ask, Google Trends, GitHub, Reddit, Hacker News, Wikipedia
- Analytics: PageSpeed Insights, BuiltWith
"""
import os
import aiohttp
import feedparser
import json
import asyncio
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from urllib.parse import urlparse, quote_plus, urlencode
from datetime import datetime, timedelta
import re
from bs4 import BeautifulSoup

load_dotenv()

# Rate limiting - add delays between requests
RATE_LIMIT_DELAY = 0.5  # 500ms between requests


async def get_google_news_mentions(brand_name: str, website_url: str = None, max_results: int = 20) -> Dict[str, Any]:
    """
    Fetch brand mentions from Google News RSS feed.
    
    Args:
        brand_name: Brand/company name to search for
        website_url: Optional website URL to filter results
        max_results: Maximum number of results to return
        
    Returns:
        Dictionary with brand mention data
    """
    try:
        # Extract domain from URL if provided
        domain = None
        if website_url:
            parsed = urlparse(website_url)
            domain = parsed.netloc.replace('www.', '') if parsed.netloc else None
        
        # Build Google News RSS URL
        search_query = brand_name
        if domain:
            search_query = f"{brand_name} {domain}"
        
        encoded_query = quote_plus(search_query)
        rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en&gl=US&ceid=US:en"
        
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(rss_url, timeout=aiohttp.ClientTimeout(total=15)) as response:
                    if response.status == 200:
                        content = await response.text()
                        feed = feedparser.parse(content)
                        
                        mentions = []
                        for entry in feed.entries[:max_results]:
                            mention = {
                                'title': entry.get('title', ''),
                                'link': entry.get('link', ''),
                                'published': entry.get('published', ''),
                                'source': entry.get('source', {}).get('title', '') if 'source' in entry else '',
                                'summary': entry.get('summary', '')[:300] if 'summary' in entry else ''
                            }
                            
                            if 'published_parsed' in entry:
                                try:
                                    mention['published_date'] = datetime(*entry.published_parsed[:6]).isoformat()
                                except:
                                    pass
                            
                            mentions.append(mention)
                        
                        return {
                            'available': True,
                            'source': 'google_news_rss',
                            'brand_name': brand_name,
                            'total_mentions': len(mentions),
                            'mentions': mentions,
                            'search_query': search_query
                        }
                    else:
                        return {'available': False, 'source': 'google_news_rss', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'google_news_rss', 'error': str(e)}
                
    except Exception as e:
        return {'available': False, 'source': 'google_news_rss', 'error': str(e)}


async def get_google_search_autocomplete(brand_name: str, max_results: int = 10) -> Dict[str, Any]:
    """
    Fetch Google Search Autocomplete suggestions for a brand.
    Shows what people commonly search after typing a brand name.
    
    Args:
        brand_name: Brand/company name
        max_results: Maximum number of suggestions
        
    Returns:
        Dictionary with autocomplete suggestions
    """
    try:
        # Google Autocomplete API endpoint
        query = quote_plus(brand_name)
        url = f"https://www.google.com/complete/search?client=firefox&q={query}"
        
        async with aiohttp.ClientSession() as session:
            try:
                await asyncio.sleep(RATE_LIMIT_DELAY)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10), headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }) as response:
                    if response.status == 200:
                        content = await response.text()
                        # Google returns JSONP, extract JSON
                        if content.startswith('window.google.ac.h('):
                            json_str = content.replace('window.google.ac.h(', '').rstrip(')')
                            data = json.loads(json_str)
                            
                            suggestions = []
                            if len(data) > 1 and isinstance(data[1], list):
                                for item in data[1][:max_results]:
                                    if isinstance(item, list) and len(item) > 0:
                                        suggestion = item[0] if isinstance(item[0], str) else str(item[0])
                                        suggestions.append(suggestion)
                            
                            return {
                                'available': True,
                                'source': 'google_autocomplete',
                                'brand_name': brand_name,
                                'suggestions': suggestions,
                                'total_suggestions': len(suggestions)
                            }
                    return {'available': False, 'source': 'google_autocomplete', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'google_autocomplete', 'error': str(e)}
    except Exception as e:
        return {'available': False, 'source': 'google_autocomplete', 'error': str(e)}


async def get_google_people_also_ask(brand_name: str, max_results: int = 8) -> Dict[str, Any]:
    """
    Scrape Google "People Also Ask" questions for a brand.
    Shows common questions users ask about a topic or product.
    
    Args:
        brand_name: Brand/company name
        max_results: Maximum number of questions
        
    Returns:
        Dictionary with PAA questions
    """
    try:
        query = quote_plus(brand_name)
        url = f"https://www.google.com/search?q={query}&hl=en"
        
        async with aiohttp.ClientSession() as session:
            try:
                await asyncio.sleep(RATE_LIMIT_DELAY)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15), headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'lxml')
                        
                        questions = []
                        # Look for PAA questions (they're in specific divs)
                        paa_divs = soup.find_all('div', {'class': re.compile(r'.*related-question.*', re.I)})
                        if not paa_divs:
                            # Try alternative selectors
                            paa_divs = soup.find_all('div', string=re.compile(r'\?', re.I))
                        
                        for div in paa_divs[:max_results]:
                            question_text = div.get_text(strip=True)
                            if question_text and '?' in question_text:
                                questions.append(question_text)
                        
                        # Fallback: look for any divs with questions
                        if not questions:
                            all_divs = soup.find_all('div')
                            for div in all_divs[:50]:
                                text = div.get_text(strip=True)
                                if '?' in text and len(text) < 200 and brand_name.lower() in text.lower():
                                    questions.append(text)
                                    if len(questions) >= max_results:
                                        break
                        
                        return {
                            'available': len(questions) > 0,
                            'source': 'google_people_also_ask',
                            'brand_name': brand_name,
                            'questions': questions[:max_results],
                            'total_questions': len(questions[:max_results])
                        }
                    return {'available': False, 'source': 'google_people_also_ask', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'google_people_also_ask', 'error': str(e)}
    except Exception as e:
        return {'available': False, 'source': 'google_people_also_ask', 'error': str(e)}


async def get_google_trends_data(brand_name: str, timeframe: str = "12m") -> Dict[str, Any]:
    """
    Fetch Google Trends data for a brand (using pytrends library).
    Shows search interest over time, seasonality, and regional interest.
    
    Args:
        brand_name: Brand/company name
        timeframe: Time range (1h, 4h, 1d, 7d, 30d, 90d, 12m, 5y, all)
        
    Returns:
        Dictionary with trends data
    """
    try:
        from pytrends.request import TrendReq
        
        # Initialize pytrends
        pytrends = TrendReq(hl='en-US', tz=360)
        pytrends.build_payload([brand_name], cat=0, timeframe=timeframe, geo='', gprop='')
        
        # Get interest over time
        interest_over_time = pytrends.interest_over_time()
        
        # Get related queries
        related_queries = pytrends.related_queries()
        
        # Get trending searches (if available)
        try:
            trending_searches = pytrends.trending_searches(pn='united_states')
            trending_list = trending_searches.tolist() if trending_searches is not None and not trending_searches.empty else []
        except:
            trending_list = []
        
        # Format interest over time data
        interest_data = {}
        if not interest_over_time.empty:
            # Convert to simple dict format
            for date, row in interest_over_time.iterrows():
                interest_data[date.strftime('%Y-%m-%d')] = int(row[brand_name]) if brand_name in row else 0
        
        return {
            'available': True,
            'source': 'google_trends',
            'brand_name': brand_name,
            'timeframe': timeframe,
            'interest_over_time': interest_data,
            'related_queries': related_queries,
            'trending_searches': trending_list
        }
    except ImportError as e:
        return {'available': False, 'source': 'google_trends', 'error': f'pytrends not installed: {str(e)}'}
    except Exception as e:
        return {'available': False, 'source': 'google_trends', 'error': str(e)}


async def get_github_mentions(brand_name: str, max_results: int = 20) -> Dict[str, Any]:
    """
    Search GitHub for mentions of a brand/product in repositories.
    Shows developer interest and adoption signals.
    
    Args:
        brand_name: Brand/company/product name
        max_results: Maximum number of results
        
    Returns:
        Dictionary with GitHub mentions
    """
    try:
        # GitHub Search API (public, no auth needed for basic searches)
        query = quote_plus(brand_name)
        url = f"https://api.github.com/search/repositories?q={query}&sort=stars&order=desc&per_page={min(max_results, 30)}"
        
        async with aiohttp.ClientSession() as session:
            try:
                await asyncio.sleep(RATE_LIMIT_DELAY)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15), headers={
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'RealDoc-BrandVisibility'
                }) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        mentions = []
                        for repo in data.get('items', [])[:max_results]:
                            mention = {
                                'name': repo.get('name', ''),
                                'full_name': repo.get('full_name', ''),
                                'description': repo.get('description', '')[:200] if repo.get('description') else '',
                                'stars': repo.get('stargazers_count', 0),
                                'url': repo.get('html_url', ''),
                                'language': repo.get('language', ''),
                                'created': repo.get('created_at', ''),
                                'updated': repo.get('updated_at', '')
                            }
                            mentions.append(mention)
                        
                        return {
                            'available': True,
                            'source': 'github',
                            'brand_name': brand_name,
                            'total_mentions': len(mentions),
                            'mentions': mentions,
                            'total_count': data.get('total_count', 0)
                        }
                    elif response.status == 403:
                        return {'available': False, 'source': 'github', 'error': 'Rate limit exceeded'}
                    else:
                        return {'available': False, 'source': 'github', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'github', 'error': str(e)}
    except Exception as e:
        return {'available': False, 'source': 'github', 'error': str(e)}


async def get_reddit_mentions(brand_name: str, max_results: int = 20) -> Dict[str, Any]:
    """
    Search Reddit for mentions of a brand using public JSON endpoints.
    Shows discussions, questions, complaints, and recommendations.
    
    Args:
        brand_name: Brand/company name
        max_results: Maximum number of results
        
    Returns:
        Dictionary with Reddit mentions
    """
    try:
        query = quote_plus(brand_name)
        url = f"https://www.reddit.com/search.json?q={query}&limit={min(max_results, 25)}&sort=relevance"
        
        async with aiohttp.ClientSession() as session:
            try:
                await asyncio.sleep(RATE_LIMIT_DELAY)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15), headers={
                    'User-Agent': 'RealDoc-BrandVisibility/1.0'
                }) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        mentions = []
                        for child in data.get('data', {}).get('children', [])[:max_results]:
                            post = child.get('data', {})
                            mention = {
                                'title': post.get('title', ''),
                                'subreddit': post.get('subreddit', ''),
                                'score': post.get('score', 0),
                                'comments': post.get('num_comments', 0),
                                'url': post.get('url', ''),
                                'permalink': f"https://reddit.com{post.get('permalink', '')}",
                                'created': datetime.fromtimestamp(post.get('created_utc', 0)).isoformat() if post.get('created_utc') else '',
                                'selftext': post.get('selftext', '')[:300] if post.get('selftext') else ''
                            }
                            mentions.append(mention)
                        
                        return {
                            'available': True,
                            'source': 'reddit',
                            'brand_name': brand_name,
                            'total_mentions': len(mentions),
                            'mentions': mentions
                        }
                    else:
                        return {'available': False, 'source': 'reddit', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'reddit', 'error': str(e)}
    except Exception as e:
        return {'available': False, 'source': 'reddit', 'error': str(e)}


async def get_hackernews_mentions(brand_name: str, max_results: int = 20) -> Dict[str, Any]:
    """
    Search Hacker News for mentions of a brand/product.
    Shows mentions in technical discussions with upvotes and engagement.
    
    Args:
        brand_name: Brand/company/product name
        max_results: Maximum number of results
        
    Returns:
        Dictionary with Hacker News mentions
    """
    try:
        # Hacker News Algolia Search API
        query = quote_plus(brand_name)
        url = f"https://hn.algolia.com/api/v1/search?query={query}&tags=story&hitsPerPage={min(max_results, 50)}"
        
        async with aiohttp.ClientSession() as session:
            try:
                await asyncio.sleep(RATE_LIMIT_DELAY)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        mentions = []
                        for hit in data.get('hits', [])[:max_results]:
                            mention = {
                                'title': hit.get('title', ''),
                                'url': hit.get('url', ''),
                                'points': hit.get('points', 0),
                                'comments': hit.get('num_comments', 0),
                                'author': hit.get('author', ''),
                                'created': datetime.fromtimestamp(hit.get('created_at_i', 0)).isoformat() if hit.get('created_at_i') else '',
                                'objectID': hit.get('objectID', ''),
                                'hn_url': f"https://news.ycombinator.com/item?id={hit.get('objectID', '')}"
                            }
                            mentions.append(mention)
                        
                        return {
                            'available': True,
                            'source': 'hackernews',
                            'brand_name': brand_name,
                            'total_mentions': len(mentions),
                            'mentions': mentions,
                            'total_hits': data.get('nbHits', 0)
                        }
                    else:
                        return {'available': False, 'source': 'hackernews', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'hackernews', 'error': str(e)}
    except Exception as e:
        return {'available': False, 'source': 'hackernews', 'error': str(e)}


async def get_wikipedia_data(brand_name: str) -> Dict[str, Any]:
    """
    Check if brand has a Wikipedia page and get pageview data.
    Shows authority and awareness signals.
    
    Args:
        brand_name: Brand/company name
        
    Returns:
        Dictionary with Wikipedia data
    """
    try:
        # First, search for Wikipedia page
        search_query = quote_plus(brand_name)
        search_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{search_query}"
        
        async with aiohttp.ClientSession() as session:
            try:
                await asyncio.sleep(RATE_LIMIT_DELAY)
                async with session.get(search_url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        page_title = data.get('title', '')
                        page_url = data.get('content_urls', {}).get('desktop', {}).get('page', '')
                        extract = data.get('extract', '')[:500] if data.get('extract') else ''
                        
                        # Get pageview data (last 30 days)
                        if page_title:
                            pageview_url = f"https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/all-agents/{quote_plus(page_title)}/daily/20240101/20241231"
                            
                            try:
                                await asyncio.sleep(RATE_LIMIT_DELAY)
                                async with session.get(pageview_url, timeout=aiohttp.ClientTimeout(total=10)) as pv_response:
                                    pageviews = []
                                    if pv_response.status == 200:
                                        pv_data = await pv_response.json()
                                        pageviews = pv_data.get('items', [])
                            except:
                                pageviews = []
                        
                        return {
                            'available': True,
                            'source': 'wikipedia',
                            'brand_name': brand_name,
                            'has_page': True,
                            'page_title': page_title,
                            'page_url': page_url,
                            'extract': extract,
                            'pageviews': pageviews[-30:] if pageviews else []  # Last 30 days
                        }
                    elif response.status == 404:
                        return {
                            'available': True,
                            'source': 'wikipedia',
                            'brand_name': brand_name,
                            'has_page': False,
                            'note': 'No Wikipedia page found'
                        }
                    else:
                        return {'available': False, 'source': 'wikipedia', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'wikipedia', 'error': str(e)}
    except Exception as e:
        return {'available': False, 'source': 'wikipedia', 'error': str(e)}


async def get_pagespeed_insights(website_url: str) -> Dict[str, Any]:
    """
    Fetch PageSpeed Insights data for a website (free, no API key needed).
    Shows Core Web Vitals performance and mobile usability.
    Uses Google's public PageSpeed Insights API endpoint.
    
    Args:
        website_url: Website URL to analyze
        
    Returns:
        Dictionary with PageSpeed data
    """
    try:
        # Try with API key first (if available), otherwise use public endpoint
        api_key = os.getenv("GOOGLE_PAGESPEED_API_KEY")
        
        if api_key:
            # Use official API with key
            url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={quote_plus(website_url)}&key={api_key}"
        else:
            # Use public PageSpeed Insights endpoint (no key required, but has rate limits)
            url = f"https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url={quote_plus(website_url)}"
        
        async with aiohttp.ClientSession() as session:
            try:
                await asyncio.sleep(RATE_LIMIT_DELAY)
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=30)) as response:
                    if response.status == 200:
                        data = await response.json()
                        
                        lighthouse_result = data.get('lighthouseResult', {})
                        categories = lighthouse_result.get('categories', {})
                        
                        # Extract Core Web Vitals
                        audits = lighthouse_result.get('audits', {})
                        core_web_vitals = {}
                        if 'largest-contentful-paint' in audits:
                            core_web_vitals['lcp'] = audits['largest-contentful-paint'].get('numericValue', 0)
                        if 'first-input-delay' in audits:
                            core_web_vitals['fid'] = audits['first-input-delay'].get('numericValue', 0)
                        if 'cumulative-layout-shift' in audits:
                            core_web_vitals['cls'] = audits['cumulative-layout-shift'].get('numericValue', 0)
                        
                        return {
                            'available': True,
                            'source': 'pagespeed_insights',
                            'website_url': website_url,
                            'performance_score': int(categories.get('performance', {}).get('score', 0) * 100) if categories.get('performance', {}).get('score') else 0,
                            'accessibility_score': int(categories.get('accessibility', {}).get('score', 0) * 100) if categories.get('accessibility', {}).get('score') else 0,
                            'best_practices_score': int(categories.get('best-practices', {}).get('score', 0) * 100) if categories.get('best-practices', {}).get('score') else 0,
                            'seo_score': int(categories.get('seo', {}).get('score', 0) * 100) if categories.get('seo', {}).get('score') else 0,
                            'core_web_vitals': core_web_vitals,
                            'using_api_key': bool(api_key)
                        }
                    elif response.status == 429:
                        return {'available': False, 'source': 'pagespeed_insights', 'error': 'Rate limit exceeded. Consider adding GOOGLE_PAGESPEED_API_KEY for higher limits.'}
                    else:
                        return {'available': False, 'source': 'pagespeed_insights', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'pagespeed_insights', 'error': str(e)}
    except Exception as e:
        return {'available': False, 'source': 'pagespeed_insights', 'error': str(e)}


async def get_builtwith_data(website_url: str) -> Dict[str, Any]:
    """
    Fetch tech stack data for a website (free, no API key needed).
    Scrapes BuiltWith public pages or uses alternative detection methods.
    Shows basic tech stack detection, CMS, analytics, and hosting.
    
    Args:
        website_url: Website URL to analyze
        
    Returns:
        Dictionary with tech stack data
    """
    try:
        # Extract domain
        parsed = urlparse(website_url)
        domain = parsed.netloc.replace('www.', '')
        
        # Try API key first (if available)
        api_key = os.getenv("BUILTWITH_API_KEY")
        
        if api_key:
            # Use official BuiltWith API
            url = f"https://api.builtwith.com/v20/api.json?KEY={api_key}&LOOKUP={domain}"
            
            async with aiohttp.ClientSession() as session:
                try:
                    await asyncio.sleep(RATE_LIMIT_DELAY)
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as response:
                        if response.status == 200:
                            data = await response.json()
                            
                            return {
                                'available': True,
                                'source': 'builtwith',
                                'website_url': website_url,
                                'domain': domain,
                                'technologies': data.get('Results', [{}])[0].get('Result', {}).get('Paths', []),
                                'using_api_key': True
                            }
                except Exception as e:
                    pass  # Fall through to scraping method
        
        # Fallback: Scrape BuiltWith public page (free, no API key)
        builtwith_url = f"https://builtwith.com/{domain}"
        
        async with aiohttp.ClientSession() as session:
            try:
                await asyncio.sleep(RATE_LIMIT_DELAY)
                async with session.get(builtwith_url, timeout=aiohttp.ClientTimeout(total=15), headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }) as response:
                    if response.status == 200:
                        html = await response.text()
                        soup = BeautifulSoup(html, 'lxml')
                        
                        # Extract technologies from BuiltWith page
                        technologies = []
                        
                        # Look for technology cards/sections
                        tech_elements = soup.find_all(['div', 'span'], class_=re.compile(r'tech|technology|stack', re.I))
                        for elem in tech_elements[:20]:  # Limit to avoid too much data
                            text = elem.get_text(strip=True)
                            if text and len(text) < 100:  # Reasonable tech name length
                                technologies.append(text)
                        
                        # Also try to detect from meta tags and scripts
                        meta_tags = soup.find_all('meta')
                        for meta in meta_tags:
                            name = meta.get('name', '').lower()
                            content = meta.get('content', '')
                            if any(keyword in name for keyword in ['generator', 'cms', 'framework', 'platform']):
                                if content:
                                    technologies.append(content)
                        
                        # Detect from script sources
                        scripts = soup.find_all('script', src=True)
                        for script in scripts[:10]:
                            src = script.get('src', '')
                            if src:
                                # Extract framework/library names from URLs
                                if 'jquery' in src.lower():
                                    technologies.append('jQuery')
                                elif 'react' in src.lower():
                                    technologies.append('React')
                                elif 'vue' in src.lower():
                                    technologies.append('Vue.js')
                                elif 'angular' in src.lower():
                                    technologies.append('Angular')
                        
                        # Remove duplicates and clean
                        technologies = list(set([t.strip() for t in technologies if t.strip()]))[:30]
                        
                        return {
                            'available': len(technologies) > 0,
                            'source': 'builtwith',
                            'website_url': website_url,
                            'domain': domain,
                            'technologies': technologies,
                            'using_api_key': False,
                            'method': 'scraped'
                        }
                    else:
                        return {'available': False, 'source': 'builtwith', 'error': f'HTTP {response.status}'}
            except Exception as e:
                return {'available': False, 'source': 'builtwith', 'error': str(e)}
    except Exception as e:
        return {'available': False, 'source': 'builtwith', 'error': str(e)}


async def get_brand_visibility_data(
    brand_name: str, 
    website_url: str = None, 
    max_results: int = 20,
    include_seo_sources: bool = True,
    include_analytics_sources: bool = False
) -> Dict[str, Any]:
    """
    Get brand visibility data from all available sources.
    
    Args:
        brand_name: Brand/company name to search for
        website_url: Optional website URL
        max_results: Maximum number of results per source
        include_seo_sources: Include SEO-related sources (Google News, Autocomplete, PAA, Trends, GitHub, Reddit, HN, Wikipedia)
        include_analytics_sources: Include analytics sources (PageSpeed, BuiltWith)
        
    Returns:
        Dictionary with brand visibility data from all sources
    """
    result = {
        'sources': [],
        'total_mentions': 0,
        'data_by_source': {},
        'available': False
    }
    
    # SEO Sources - Run in parallel for faster execution
    if include_seo_sources:
        # Create tasks for parallel execution
        tasks = [
            get_google_news_mentions(brand_name, website_url, max_results),
            get_google_search_autocomplete(brand_name, max_results),
            get_google_people_also_ask(brand_name, max_results),
            get_google_trends_data(brand_name),
            get_github_mentions(brand_name, max_results),
            get_reddit_mentions(brand_name, max_results),
            get_hackernews_mentions(brand_name, max_results),
            get_wikipedia_data(brand_name)
        ]
        
        # Execute all tasks in parallel with timeout
        try:
            # Set overall timeout for all brand visibility fetching (30 seconds)
            results = await asyncio.wait_for(
                asyncio.gather(*tasks, return_exceptions=True),
                timeout=30.0
            )
        except asyncio.TimeoutError:
            print("⚠️  Brand visibility fetch timed out after 30 seconds")
            results = [{'available': False, 'error': 'timeout'} for _ in tasks]
        
        # Process results
        google_news_data = results[0] if not isinstance(results[0], Exception) else {'available': False, 'error': str(results[0])}
        autocomplete_data = results[1] if not isinstance(results[1], Exception) else {'available': False, 'error': str(results[1])}
        paa_data = results[2] if not isinstance(results[2], Exception) else {'available': False, 'error': str(results[2])}
        trends_data = results[3] if not isinstance(results[3], Exception) else {'available': False, 'error': str(results[3])}
        github_data = results[4] if not isinstance(results[4], Exception) else {'available': False, 'error': str(results[4])}
        reddit_data = results[5] if not isinstance(results[5], Exception) else {'available': False, 'error': str(results[5])}
        hn_data = results[6] if not isinstance(results[6], Exception) else {'available': False, 'error': str(results[6])}
        wikipedia_data = results[7] if not isinstance(results[7], Exception) else {'available': False, 'error': str(results[7])}
        
        # Google News RSS
        if google_news_data.get('available'):
            result['sources'].append('google_news')
            result['data_by_source']['google_news'] = google_news_data
            result['total_mentions'] += google_news_data.get('total_mentions', 0)
            result['available'] = True
        
        # Google Search Autocomplete
        if autocomplete_data.get('available'):
            result['sources'].append('google_autocomplete')
            result['data_by_source']['google_autocomplete'] = autocomplete_data
        
        # Google People Also Ask
        if paa_data.get('available'):
            result['sources'].append('google_people_also_ask')
            result['data_by_source']['google_people_also_ask'] = paa_data
        
        # Google Trends
        result['data_by_source']['google_trends'] = trends_data
        if trends_data.get('available'):
            result['sources'].append('google_trends')
        
        # GitHub
        if github_data.get('available'):
            result['sources'].append('github')
            result['data_by_source']['github'] = github_data
            result['total_mentions'] += github_data.get('total_mentions', 0)
        
        # Reddit
        if reddit_data.get('available'):
            result['sources'].append('reddit')
            result['data_by_source']['reddit'] = reddit_data
            result['total_mentions'] += reddit_data.get('total_mentions', 0)
        
        # Hacker News
        if hn_data.get('available'):
            result['sources'].append('hackernews')
            result['data_by_source']['hackernews'] = hn_data
            result['total_mentions'] += hn_data.get('total_mentions', 0)
        
        # Wikipedia
        if wikipedia_data.get('available'):
            result['sources'].append('wikipedia')
            result['data_by_source']['wikipedia'] = wikipedia_data
    
    # Analytics Sources - Run in parallel
    if include_analytics_sources and website_url:
        # Create tasks for parallel execution
        analytics_tasks = [
            get_pagespeed_insights(website_url),
            get_builtwith_data(website_url)
        ]
        
        # Execute in parallel with timeout
        try:
            analytics_results = await asyncio.wait_for(
                asyncio.gather(*analytics_tasks, return_exceptions=True),
                timeout=20.0
            )
        except asyncio.TimeoutError:
            print("⚠️  Analytics sources fetch timed out after 20 seconds")
            analytics_results = [{'available': False, 'error': 'timeout'} for _ in analytics_tasks]
        
        # Process results
        pagespeed_data = analytics_results[0] if not isinstance(analytics_results[0], Exception) else {'available': False, 'error': str(analytics_results[0])}
        builtwith_data = analytics_results[1] if not isinstance(analytics_results[1], Exception) else {'available': False, 'error': str(analytics_results[1])}
        
        # PageSpeed Insights
        result['data_by_source']['pagespeed_insights'] = pagespeed_data
        if pagespeed_data.get('available'):
            result['sources'].append('pagespeed_insights')
        
        # BuiltWith
        result['data_by_source']['builtwith'] = builtwith_data
        if builtwith_data.get('available'):
            result['sources'].append('builtwith')
    
    return result


def format_brand_visibility_data_for_prompt(brand_data: Dict[str, Any], brand_name: str, for_seo: bool = True) -> str:
    """
    Format brand visibility data for inclusion in AI prompt.
    
    Args:
        brand_data: Brand visibility data dictionary
        brand_name: Brand name
        for_seo: If True, format for SEO reports; if False, format for analytics reports
        
    Returns:
        Formatted string for prompt
    """
    if not brand_data.get('available') and not brand_data.get('data_by_source'):
        return ""
    
    parts = []
    parts.append("═══════════════════════════════════════════════════════════════")
    parts.append("BRAND VISIBILITY & MENTIONS ANALYSIS")
    parts.append("═══════════════════════════════════════════════════════════════")
    parts.append(f"Brand Name: {brand_name}")
    parts.append(f"Total Mentions Found: {brand_data.get('total_mentions', 0)}")
    parts.append(f"Data Sources: {', '.join(brand_data.get('sources', []))}")
    parts.append("")
    
    data_by_source = brand_data.get('data_by_source', {})
    
    # Google News
    if 'google_news' in data_by_source:
        google_data = data_by_source['google_news']
        if google_data.get('available'):
            parts.append(f"📰 Google News Mentions: {google_data.get('total_mentions', 0)}")
            mentions = google_data.get('mentions', [])
            if mentions:
                for idx, mention in enumerate(mentions[:10], 1):
                    parts.append(f"  {idx}. {mention.get('title', 'N/A')}")
                    if mention.get('source'):
                        parts.append(f"     Source: {mention['source']}")
                    if mention.get('published'):
                        parts.append(f"     Published: {mention['published']}")
            parts.append("")
    
    # Google Autocomplete
    if 'google_autocomplete' in data_by_source:
        autocomplete_data = data_by_source['google_autocomplete']
        if autocomplete_data.get('available'):
            parts.append(f"🔍 Google Search Autocomplete Suggestions:")
            suggestions = autocomplete_data.get('suggestions', [])
            for idx, suggestion in enumerate(suggestions[:10], 1):
                parts.append(f"  {idx}. {suggestion}")
            parts.append("")
    
    # People Also Ask
    if 'google_people_also_ask' in data_by_source:
        paa_data = data_by_source['google_people_also_ask']
        if paa_data.get('available'):
            parts.append(f"❓ People Also Ask Questions:")
            questions = paa_data.get('questions', [])
            for idx, question in enumerate(questions[:8], 1):
                parts.append(f"  {idx}. {question}")
            parts.append("")
    
    # Google Trends
    if 'google_trends' in data_by_source:
        trends_data = data_by_source['google_trends']
        if trends_data.get('available'):
            parts.append(f"📈 Google Trends Data:")
            parts.append(f"  Timeframe: {trends_data.get('timeframe', 'N/A')}")
            interest_data = trends_data.get('interest_over_time', {})
            if interest_data:
                # Show recent trend
                recent_dates = sorted(interest_data.keys())[-7:]  # Last 7 data points
                parts.append(f"  Recent Search Interest (last 7 data points):")
                for date in recent_dates:
                    parts.append(f"    {date}: {interest_data[date]}")
            related_queries = trends_data.get('related_queries', {})
            if related_queries:
                parts.append(f"  Related Queries Available: Yes")
            parts.append("")
    
    # GitHub
    if 'github' in data_by_source:
        github_data = data_by_source['github']
        if github_data.get('available'):
            parts.append(f"💻 GitHub Mentions: {github_data.get('total_mentions', 0)} repositories")
            mentions = github_data.get('mentions', [])
            if mentions:
                for idx, mention in enumerate(mentions[:5], 1):
                    parts.append(f"  {idx}. {mention.get('full_name', 'N/A')} ({mention.get('stars', 0)} stars)")
                    if mention.get('description'):
                        parts.append(f"     {mention.get('description', '')[:100]}")
            parts.append("")
    
    # Reddit
    if 'reddit' in data_by_source:
        reddit_data = data_by_source['reddit']
        if reddit_data.get('available'):
            parts.append(f"💬 Reddit Mentions: {reddit_data.get('total_mentions', 0)} posts")
            mentions = reddit_data.get('mentions', [])
            if mentions:
                for idx, mention in enumerate(mentions[:5], 1):
                    parts.append(f"  {idx}. r/{mention.get('subreddit', 'N/A')}: {mention.get('title', 'N/A')}")
                    parts.append(f"     Score: {mention.get('score', 0)} | Comments: {mention.get('comments', 0)}")
            parts.append("")
    
    # Hacker News
    if 'hackernews' in data_by_source:
        hn_data = data_by_source['hackernews']
        if hn_data.get('available'):
            parts.append(f"🔥 Hacker News Mentions: {hn_data.get('total_mentions', 0)} posts")
            mentions = hn_data.get('mentions', [])
            if mentions:
                for idx, mention in enumerate(mentions[:5], 1):
                    parts.append(f"  {idx}. {mention.get('title', 'N/A')}")
                    parts.append(f"     Points: {mention.get('points', 0)} | Comments: {mention.get('comments', 0)}")
            parts.append("")
    
    # Wikipedia
    if 'wikipedia' in data_by_source:
        wiki_data = data_by_source['wikipedia']
        if wiki_data.get('available'):
            if wiki_data.get('has_page'):
                parts.append(f"📚 Wikipedia: Page exists")
                parts.append(f"  Title: {wiki_data.get('page_title', 'N/A')}")
                if wiki_data.get('extract'):
                    parts.append(f"  Extract: {wiki_data.get('extract', '')[:200]}...")
                if wiki_data.get('pageviews'):
                    recent_views = sum([pv.get('views', 0) for pv in wiki_data.get('pageviews', [])[-7:]])
                    parts.append(f"  Recent pageviews (last 7 days): {recent_views:,}")
            else:
                parts.append(f"📚 Wikipedia: No page found (indicates lower brand awareness)")
            parts.append("")
    
    # Analytics sources (if included)
    if not for_seo:
        # PageSpeed Insights
        if 'pagespeed_insights' in data_by_source:
            ps_data = data_by_source['pagespeed_insights']
            if ps_data.get('available'):
                parts.append(f"⚡ PageSpeed Insights:")
                parts.append(f"  Performance Score: {ps_data.get('performance_score', 0):.0f}/100")
                parts.append(f"  Accessibility Score: {ps_data.get('accessibility_score', 0):.0f}/100")
                parts.append(f"  SEO Score: {ps_data.get('seo_score', 0):.0f}/100")
                parts.append("")
        
        # BuiltWith
        if 'builtwith' in data_by_source:
            bw_data = data_by_source['builtwith']
            if bw_data.get('available'):
                parts.append(f"🛠️ BuiltWith Tech Stack:")
                technologies = bw_data.get('technologies', [])
                if technologies:
                    for tech in technologies[:10]:
                        parts.append(f"  - {tech}")
                parts.append("")
    
    parts.append("═══════════════════════════════════════════════════════════════")
    parts.append("Use this brand visibility data to:")
    if for_seo:
        parts.append("- Analyze brand presence and awareness")
        parts.append("- Identify media coverage and press mentions")
        parts.append("- Understand user intent and search behavior")
        parts.append("- Identify content gaps and opportunities")
        parts.append("- Assess brand reputation and sentiment")
        parts.append("- Provide recommendations for improving brand visibility")
    else:
        parts.append("- Analyze technical performance and constraints")
        parts.append("- Understand tech stack limitations")
        parts.append("- Connect user experience to discoverability")
    parts.append("═══════════════════════════════════════════════════════════════")
    
    return "\n".join(parts)
