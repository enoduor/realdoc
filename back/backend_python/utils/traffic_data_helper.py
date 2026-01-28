"""
Traffic Data Helper - Fetches real traffic data from SimilarWeb API and other sources
"""
import os
import aiohttp
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from urllib.parse import urlparse

load_dotenv()

# SimilarWeb API configuration
SIMILARWEB_API_KEY = os.getenv("SIMILARWEB_API_KEY")
SIMILARWEB_API_BASE = "https://api.similarweb.com/v1/website"


async def get_similarweb_traffic_data(domain: str) -> Optional[Dict[str, Any]]:
    """
    Fetch real traffic data from SimilarWeb API.
    
    Args:
        domain: Domain name (e.g., "descript.com" without protocol)
        
    Returns:
        Dictionary with traffic data or None if unavailable
    """
    if not SIMILARWEB_API_KEY:
        return None
    
    try:
        # Extract domain from URL if needed
        if domain.startswith(('http://', 'https://')):
            parsed = urlparse(domain)
            domain = parsed.netloc or parsed.path.split('/')[0]
        
        # Remove www. prefix
        domain = domain.replace('www.', '').strip()
        
        async with aiohttp.ClientSession() as session:
            # SimilarWeb API endpoints
            endpoints = {
                'traffic': f"{SIMILARWEB_API_BASE}/{domain}/total-traffic-and-engagement/visits",
                'sources': f"{SIMILARWEB_API_BASE}/{domain}/traffic-sources/overview",
                'geography': f"{SIMILARWEB_API_BASE}/{domain}/geo/traffic-share",
                'demographics': f"{SIMILARWEB_API_BASE}/{domain}/demographics/age",
            }
            
            traffic_data = {}
            
            # Fetch traffic data
            try:
                url = f"{endpoints['traffic']}?api_key={SIMILARWEB_API_KEY}&start_date=2024-01&end_date=2024-12&granularity=monthly&main_domain_only=false&format=json"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        if 'visits' in data:
                            # Get latest month data
                            visits = data.get('visits', [])
                            if visits:
                                latest = visits[-1] if isinstance(visits, list) else visits
                                traffic_data['monthly_visits'] = latest.get('visits') if isinstance(latest, dict) else latest
                                traffic_data['traffic_trend'] = 'increasing' if len(visits) > 1 and visits[-1] > visits[0] else 'stable'
            except Exception as e:
                print(f"Error fetching SimilarWeb traffic: {e}")
            
            # Fetch traffic sources
            try:
                url = f"{endpoints['sources']}?api_key={SIMILARWEB_API_KEY}&start_date=2024-01&end_date=2024-12&main_domain_only=false&format=json"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        traffic_data['traffic_sources'] = {
                            'organic': data.get('organic_search', {}).get('value', 0),
                            'direct': data.get('direct', {}).get('value', 0),
                            'referral': data.get('referrals', {}).get('value', 0),
                            'social': data.get('social', {}).get('value', 0),
                            'paid': data.get('paid_search', {}).get('value', 0),
                        }
            except Exception as e:
                print(f"Error fetching SimilarWeb sources: {e}")
            
            # Fetch geographic data
            try:
                url = f"{endpoints['geography']}?api_key={SIMILARWEB_API_KEY}&start_date=2024-01&end_date=2024-12&country=US&format=json"
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status == 200:
                        data = await response.json()
                        if 'countries' in data:
                            traffic_data['top_countries'] = data['countries'][:5]  # Top 5 countries
            except Exception as e:
                print(f"Error fetching SimilarWeb geography: {e}")
            
            return traffic_data if traffic_data else None
            
    except Exception as e:
        print(f"Error in SimilarWeb API call: {e}")
        return None


async def get_public_traffic_estimates(domain: str) -> Optional[Dict[str, Any]]:
    """
    Get publicly available traffic estimates using web scraping techniques.
    This is a fallback when SimilarWeb API is not available.
    
    Args:
        domain: Domain name
        
    Returns:
        Dictionary with estimated traffic data or None
    """
    # This could scrape public data sources, but for now returns None
    # to avoid rate limiting and legal issues
    return None


async def get_traffic_data_for_domain(domain: str, use_similarweb: bool = True) -> Dict[str, Any]:
    """
    Get traffic data for a domain, trying SimilarWeb first, then fallback methods.
    
    Args:
        domain: Domain name or URL
        use_similarweb: Whether to try SimilarWeb API
        
    Returns:
        Dictionary with traffic data (may be empty if no data available)
    """
    result = {
        'source': None,
        'data': {},
        'available': False
    }
    
    # Try SimilarWeb API first
    if use_similarweb and SIMILARWEB_API_KEY:
        similarweb_data = await get_similarweb_traffic_data(domain)
        if similarweb_data:
            result['source'] = 'similarweb'
            result['data'] = similarweb_data
            result['available'] = True
            return result
    
    # Fallback to public estimates (if implemented)
    public_data = await get_public_traffic_estimates(domain)
    if public_data:
        result['source'] = 'public_estimate'
        result['data'] = public_data
        result['available'] = True
        return result
    
    return result


def format_traffic_data_for_prompt(traffic_data: Dict[str, Any], domain: str) -> str:
    """
    Format traffic data for inclusion in AI prompt.
    
    Args:
        traffic_data: Traffic data dictionary
        domain: Domain name
        
    Returns:
        Formatted string for prompt
    """
    if not traffic_data.get('available'):
        return ""
    
    source = traffic_data.get('source', 'unknown')
    data = traffic_data.get('data', {})
    
    parts = []
    parts.append("═══════════════════════════════════════════════════════════════")
    parts.append(f"REAL TRAFFIC DATA - {domain.upper()}")
    parts.append(f"Data Source: {source.upper()}")
    parts.append("═══════════════════════════════════════════════════════════════")
    parts.append("")
    
    if 'monthly_visits' in data:
        parts.append(f"Monthly Visits: {data['monthly_visits']:,}")
    
    if 'traffic_sources' in data:
        sources = data['traffic_sources']
        parts.append("Traffic Sources:")
        if sources.get('organic'):
            parts.append(f"  - Organic Search: {sources['organic']:.1f}%")
        if sources.get('direct'):
            parts.append(f"  - Direct: {sources['direct']:.1f}%")
        if sources.get('referral'):
            parts.append(f"  - Referral: {sources['referral']:.1f}%")
        if sources.get('social'):
            parts.append(f"  - Social Media: {sources['social']:.1f}%")
        if sources.get('paid'):
            parts.append(f"  - Paid Advertising: {sources['paid']:.1f}%")
    
    if 'top_countries' in data:
        parts.append("Top Countries:")
        for country in data['top_countries'][:5]:
            if isinstance(country, dict):
                parts.append(f"  - {country.get('country', 'Unknown')}: {country.get('value', 0):.1f}%")
    
    if 'traffic_trend' in data:
        parts.append(f"Traffic Trend: {data['traffic_trend']}")
    
    parts.append("")
    parts.append("═══════════════════════════════════════════════════════════════")
    parts.append("")
    
    return "\n".join(parts)
