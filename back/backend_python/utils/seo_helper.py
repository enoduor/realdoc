import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional, List
from utils.web_crawler import crawl_and_extract, format_crawled_content_for_prompt

# Load environment variables
load_dotenv()

# Initialize OpenAI client dynamically
def get_openai_client():
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "sk-placeholder" or api_key.startswith("sk-placeholder"):
        raise ValueError(
            "OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env file. "
            "Get your API key from https://platform.openai.com/api-keys"
        )
    return OpenAI(api_key=api_key)

async def generate_seo_report(
    website_url: str,
    business_type: str = "saas",
    target_keywords: Optional[str] = None,
    current_seo_issues: Optional[str] = None,
    focus_areas: List[str] = None,
    language: str = "en"
) -> str:
    """
    Generate comprehensive SEO analysis and recommendations using OpenAI.
    
    Args:
        website_url (str): URL of the website to analyze
        business_type (str): Type of business (saas, ecommerce, blog, etc.)
        target_keywords (str): Comma-separated target keywords
        current_seo_issues (str): Known SEO issues or concerns
        focus_areas (List[str]): Areas to focus on (on-page, technical, content, etc.)
        language (str): Language code
    
    Returns:
        str: Generated SEO report
    """
    
    if focus_areas is None:
        focus_areas = ["on-page", "technical", "content"]
    
    # Normalize URL - ensure it has a protocol
    normalized_url = website_url.strip()
    if not normalized_url.startswith(('http://', 'https://')):
        normalized_url = f"https://{normalized_url}"
    # Remove trailing slashes
    normalized_url = normalized_url.rstrip('/')
    
    # Crawl the website
    crawled_data = None
    website_context = ""
    
    try:
        print(f"Attempting to crawl website: {normalized_url}")
        crawled_data = await crawl_and_extract(normalized_url)
        if crawled_data:
            website_context = format_crawled_content_for_prompt(crawled_data)
            print(f"Successfully crawled website: {normalized_url}")
        else:
            website_context = f"Note: Could not fetch content from {normalized_url}. The website may be blocking crawlers or may not be accessible. Analysis will proceed with provided information."
            print(f"Failed to crawl website: {normalized_url} - No data returned")
    except Exception as e:
        error_msg = str(e)
        website_context = f"Note: Could not crawl website {normalized_url} ({error_msg}). Analysis will proceed with provided information."
        print(f"Error crawling website {normalized_url}: {error_msg}")
    
    # Build the prompt
    focus_areas_text = ", ".join(focus_areas)
    
    system_prompt = f"""You are an expert SEO consultant with deep knowledge of search engine optimization, technical SEO, content strategy, and digital marketing. Your task is to analyze websites and provide comprehensive, actionable SEO recommendations.

CRITICAL REQUIREMENTS:
1. Provide SPECIFIC, ACTIONABLE recommendations based on the actual website content
2. Include concrete examples and specific fixes
3. Minimum 2000 words of detailed analysis
4. Use real data from the crawled website when available
5. Provide step-by-step implementation guides
6. Include code examples for technical SEO fixes
7. Reference specific pages, elements, or issues found on the website
8. DO NOT provide generic, templated advice

Focus Areas to Cover: {focus_areas_text}
Business Type: {business_type}
Language: {language}"""

    user_prompt = f"""Analyze the following website and provide a comprehensive SEO report:

Website URL: {normalized_url}
Business Type: {business_type}

{f"Target Keywords: {target_keywords}" if target_keywords else ""}
{f"Known Issues: {current_seo_issues}" if current_seo_issues else ""}

Website Content (crawled):
{website_context if website_context else "No website content available. Provide general SEO recommendations based on the business type."}

Please provide a comprehensive SEO analysis report covering:

1. **Executive Summary**
   - Current SEO health score (0-100)
   - Key strengths and weaknesses
   - Priority action items

2. **Technical SEO Analysis**
   - Site structure and architecture
   - Page speed and Core Web Vitals
   - Mobile responsiveness
   - Schema markup
   - XML sitemap and robots.txt
   - HTTPS and security
   - URL structure
   - Canonical tags
   - 404 errors and redirects
   - Specific technical issues found and fixes

3. **On-Page SEO**
   - Title tags optimization (provide specific examples)
   - Meta descriptions (provide specific examples)
   - Header tags (H1, H2, H3) structure
   - Image alt text optimization
   - Internal linking structure
   - Content quality and keyword optimization
   - URL optimization
   - Specific recommendations for each page type

4. **Content SEO**
   - Content quality assessment
   - Keyword research and targeting
   - Content gaps and opportunities
   - Content optimization recommendations
   - Blog/content strategy
   - E-A-T (Expertise, Authoritativeness, Trustworthiness) signals

5. **Off-Page SEO** (if in focus areas)
   - Backlink profile analysis
   - Link building opportunities
   - Social signals
   - Local SEO (if applicable)
   - Brand mentions

6. **Mobile SEO** (if in focus areas)
   - Mobile-first indexing readiness
   - Mobile usability issues
   - AMP implementation
   - Mobile page speed

7. **Local SEO** (if in focus areas)
   - Google Business Profile optimization
   - Local citations
   - NAP consistency
   - Local keyword targeting

8. **Page Speed Optimization** (if in focus areas)
   - Current performance metrics
   - Specific optimization recommendations
   - Code minification
   - Image optimization
   - Caching strategies
   - CDN recommendations

9. **Accessibility** (if in focus areas)
   - WCAG compliance
   - Screen reader compatibility
   - Keyboard navigation
   - Color contrast
   - ARIA labels

10. **Implementation Roadmap**
    - Priority 1 (Quick wins - implement immediately)
    - Priority 2 (High impact - implement within 1 month)
    - Priority 3 (Long-term - implement within 3-6 months)
    - Timeline and resource requirements

11. **Tools and Resources**
    - Recommended SEO tools
    - Monitoring and tracking setup
    - Analytics configuration

Format the report in Markdown with clear sections, code examples where applicable, and actionable recommendations. Be specific and reference actual elements from the website when possible."""

    try:
        client = get_openai_client()
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=6000,
            frequency_penalty=0.1,
            presence_penalty=0.05
        )
        
        report = response.choices[0].message.content.strip()
        return report
        
    except ValueError as e:
        # API key error
        error_msg = str(e)
        return f"""# ⚠️ OpenAI API Key Error

The OpenAI API key is invalid or not configured correctly.

**Error Details:**
- Error Type: ValueError
- Message: {error_msg}

**To fix this:**
1. Get your API key from https://platform.openai.com/api-keys
2. Set it in `back/backend_python/.env` as: `OPENAI_API_KEY=sk-your-actual-key-here`
3. Restart the backend server

## SEO Analysis for {website_url}

Once the API key is configured, you can generate comprehensive SEO recommendations for this website."""
    
    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)
        
        # Check for specific OpenAI errors
        if "AuthenticationError" in error_type or "invalid_api_key" in error_msg.lower():
            return f"""# ⚠️ OpenAI API Key Error

The OpenAI API key is invalid or not configured correctly.

**Error Details:**
- Error Type: {error_type}
- Message: {error_msg}

**To fix this:**
1. Get your API key from https://platform.openai.com/api-keys
2. Set it in `back/backend_python/.env` as: `OPENAI_API_KEY=sk-your-actual-key-here`
3. Restart the backend server

## SEO Analysis for {website_url}

Once the API key is configured, you can generate comprehensive SEO recommendations for this website."""
        
        elif "insufficient_quota" in error_msg.lower() or "quota" in error_msg.lower():
            return f"""# ⚠️ OpenAI API Quota Exceeded

Your OpenAI API quota has been exceeded.

**Error Details:**
- Error Type: {error_type}
- Message: {error_msg}

**To fix this:**
1. Check your OpenAI account usage at https://platform.openai.com/usage
2. Add payment method or upgrade your plan
3. Wait for quota reset or contact OpenAI support

## SEO Analysis for {website_url}

Once the quota issue is resolved, you can generate SEO recommendations for this website."""
        
        elif "rate_limit" in error_msg.lower():
            return f"""# ⚠️ OpenAI API Rate Limit

The OpenAI API rate limit has been exceeded. Please try again in a moment.

**Error Details:**
- Error Type: {error_type}
- Message: {error_msg}

## SEO Analysis for {website_url}

Please wait a moment and try generating the SEO report again."""
        
        else:
            return f"""# ⚠️ Error Generating SEO Report

An error occurred while generating the SEO report.

**Error Details:**
- Error Type: {error_type}
- Message: {error_msg}

## SEO Analysis for {website_url}

Please check the backend logs for more details and try again."""

