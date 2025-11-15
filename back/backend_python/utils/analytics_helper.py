import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional, List
from utils.web_crawler import crawl_and_extract, format_crawled_content_for_prompt, crawl_competitors

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

async def generate_analytics_report(
    website_url: str,
    competitor_urls: Optional[List[str]] = None,
    analysis_depth: str = "comprehensive",
    include_revenue_analysis: bool = True,
    include_traffic_analysis: bool = True,
    include_competitor_comparison: bool = True,
    language: str = "en"
) -> str:
    """
    Generate comprehensive website analytics report with competitor analysis and revenue insights.
    
    Args:
        website_url (str): URL of the website to analyze
        competitor_urls (List[str]): List of competitor URLs for comparison
        analysis_depth (str): Depth of analysis (quick, standard, comprehensive, deep)
        include_revenue_analysis (bool): Include revenue model analysis
        include_traffic_analysis (bool): Include traffic analysis (SimilarWeb-style)
        include_competitor_comparison (bool): Include competitor comparison
        language (str): Language code
    
    Returns:
        str: Generated analytics report
    """
    
    # Normalize URL - ensure it has a protocol
    normalized_url = website_url.strip()
    if not normalized_url.startswith(('http://', 'https://')):
        normalized_url = f"https://{normalized_url}"
    # Remove trailing slashes
    normalized_url = normalized_url.rstrip('/')
    
    # Crawl the main website
    website_data = None
    website_context = ""
    
    try:
        print(f"Attempting to crawl website: {normalized_url}")
        website_data = await crawl_and_extract(normalized_url)
        if website_data:
            website_context = format_crawled_content_for_prompt(website_data)
            print(f"Successfully crawled website: {normalized_url}")
        else:
            website_context = f"Note: Could not fetch content from {normalized_url}. The website may be blocking crawlers or may not be accessible. Analysis will proceed with available information."
            print(f"Failed to crawl website: {normalized_url} - No data returned")
    except Exception as e:
        error_msg = str(e)
        website_context = f"Note: Could not crawl website {normalized_url} ({error_msg}). Analysis will proceed with available information."
        print(f"Error crawling website {normalized_url}: {error_msg}")
    
    # Normalize competitor URLs
    normalized_competitor_urls = []
    if competitor_urls:
        for url in competitor_urls:
            normalized = url.strip()
            if not normalized.startswith(('http://', 'https://')):
                normalized = f"https://{normalized}"
            normalized = normalized.rstrip('/')
            normalized_competitor_urls.append(normalized)
    
    # Crawl competitors if provided
    competitor_analysis = ""
    if normalized_competitor_urls and include_competitor_comparison:
        try:
            print(f"Attempting to crawl {len(normalized_competitor_urls)} competitor(s)")
            competitor_data_list = await crawl_competitors(normalized_competitor_urls, max_concurrent=3)
            if competitor_data_list and len(competitor_data_list) > 0:
                # Format competitor data for the prompt
                competitor_parts = []
                competitor_parts.append("═══════════════════════════════════════════════════════════════")
                competitor_parts.append(f"COMPETITOR ANALYSIS - {len(competitor_data_list)} Competitor(s) Analyzed")
                competitor_parts.append("═══════════════════════════════════════════════════════════════")
                competitor_parts.append("")
                
                for idx, competitor in enumerate(competitor_data_list, 1):
                    comp_parts = [f"COMPETITOR {idx}:"]
                    
                    if competitor.get("url"):
                        comp_parts.append(f"  URL: {competitor['url']}")
                    
                    if competitor.get("title"):
                        comp_parts.append(f"  Name: {competitor['title']}")
                    
                    if competitor.get("description"):
                        comp_parts.append(f"  Description: {competitor['description'][:400]}")
                    
                    if competitor.get("features"):
                        comp_parts.append(f"  Key Features: {', '.join(competitor['features'][:8])}")
                    
                    if competitor.get("headings"):
                        comp_parts.append(f"  Main Sections: {', '.join(competitor['headings'][:5])}")
                    
                    if competitor.get("content"):
                        content_preview = competitor['content'][:800]
                        comp_parts.append(f"  Content Summary: {content_preview}")
                    
                    competitor_parts.append("\n".join(comp_parts))
                    competitor_parts.append("")
                
                competitor_parts.append("═══════════════════════════════════════════════════════════════")
                competitor_analysis = "\n".join(competitor_parts)
                print(f"Successfully analyzed {len(competitor_data_list)} competitor(s)")
            else:
                competitor_analysis = "Note: Could not crawl competitor websites. Analysis will proceed without competitor data."
                print("Failed to crawl competitor data - no data returned")
        except Exception as e:
            error_msg = str(e)
            competitor_analysis = f"Note: Could not analyze competitors ({error_msg}). Analysis will proceed without competitor data."
            print(f"Error analyzing competitors: {error_msg}")
    
    # Build depth-specific instructions
    depth_instructions = {
        "quick": "Provide a high-level overview with key metrics and top recommendations. Keep it concise (800-1200 words).",
        "standard": "Provide a detailed analysis with metrics, insights, and actionable recommendations (1500-2500 words).",
        "comprehensive": "Provide an exhaustive analysis covering all aspects with detailed metrics, deep insights, and comprehensive recommendations (3000-4000 words).",
        "deep": "Provide an extremely detailed, in-depth analysis with extensive metrics, strategic insights, and detailed implementation plans (4000+ words)."
    }
    
    depth_instruction = depth_instructions.get(analysis_depth, depth_instructions["comprehensive"])
    
    system_prompt = f"""You are an expert digital marketing analyst and business intelligence consultant with deep knowledge of:
- Website analytics and traffic analysis (SimilarWeb, Google Analytics, etc.)
- Competitive intelligence and market research
- Revenue model analysis and monetization strategies
- Digital marketing metrics and KPIs
- Business model analysis

Your task is to analyze websites and provide comprehensive, data-driven analytics reports with competitor insights and revenue intelligence.

CRITICAL REQUIREMENTS:
1. Provide SPECIFIC, DATA-DRIVEN insights based on the actual website content
2. Include realistic estimates and metrics (clearly marked as estimates when actual data isn't available)
3. Minimum word count based on analysis depth: {depth_instruction}
4. Use real data from crawled websites when available
5. Provide actionable business intelligence
6. Include competitive positioning analysis
7. Analyze revenue models and monetization strategies
8. Reference specific pages, features, or elements found on the website
9. DO NOT provide generic, templated analysis
10. **IF COMPETITOR DATA IS PROVIDED**: You MUST explicitly list each competitor's name and URL in the Competitive Analysis section. Reference specific features, content, and strategies from the competitor data provided. DO NOT use generic competitor names - use the actual competitor names and URLs from the data provided.

Analysis Depth: {analysis_depth}
Language: {language}"""

    user_prompt = f"""Analyze the following website and provide a comprehensive analytics report:

Website URL: {normalized_url}

Website Content (crawled):
{website_context if website_context else "No website content available. Provide general analytics insights based on the URL and industry."}

{f"Competitor Analysis Data:\n{competitor_analysis}" if competitor_analysis and include_competitor_comparison else ""}

Please provide a comprehensive website analytics report covering:

1. **Executive Summary**
   - Website overview and primary purpose
   - Key performance indicators (KPIs)
   - Overall health score (0-100)
   - Top strategic insights
   - Priority recommendations

2. **Traffic Analysis** {"(SimilarWeb-style insights)" if include_traffic_analysis else ""}
   - Estimated monthly traffic (based on website structure and content)
   - Traffic sources breakdown:
     * Direct traffic
     * Organic search
     * Referral traffic
     * Social media
     * Paid advertising
   - Geographic distribution (if identifiable)
   - Device breakdown (desktop vs mobile)
   - Bounce rate estimates
   - Average session duration estimates
   - Pages per session estimates
   - Top performing pages (based on content analysis)
   - Traffic trends and patterns

3. **Website Performance Metrics**
   - Page load speed analysis
   - Core Web Vitals assessment
   - Mobile responsiveness
   - User experience metrics
   - Conversion funnel analysis (if applicable)
   - Engagement metrics

4. **Content Analysis**
   - Content quality assessment
   - Content depth and comprehensiveness
   - Content freshness
   - Content gaps and opportunities
   - SEO content performance
   - Content marketing effectiveness

5. **Competitive Analysis** {"(if competitors provided)" if include_competitor_comparison else ""}
   {f"""
   - **List of Competitors Analyzed**: Start by explicitly listing each competitor's name and URL that was analyzed
   - Competitive positioning
   - Market share estimates
   - Feature comparison with competitors (create a detailed comparison table if possible)
   - Content comparison
   - Traffic comparison (relative estimates)
   - Strengths and weaknesses vs competitors (be specific about each competitor)
   - Competitive advantages and disadvantages
   - Market opportunities
   - **Specific competitor insights**: For each competitor listed, provide 2-3 specific insights about their approach, features, or strategy
   """ if include_competitor_comparison else ""}

6. **Revenue Model Analysis** {"(How they make money)" if include_revenue_analysis else ""}
   {f"""
   - Identified revenue streams:
     * Subscription/SaaS model
     * Advertising revenue
     * E-commerce/sales
     * Affiliate marketing
     * Freemium model
     * Enterprise sales
     * Other monetization methods
   - Revenue model assessment
   - Pricing strategy analysis
   - Monetization effectiveness
   - Revenue potential estimates (if possible)
   - Revenue optimization opportunities
   - Business model strengths and weaknesses
   """ if include_revenue_analysis else ""}

7. **Marketing & Growth Analysis**
   - Marketing channels effectiveness
   - Brand presence and awareness
   - Social media presence
   - Content marketing strategy
   - SEO performance
   - Paid advertising presence
   - Growth opportunities

8. **Technical Infrastructure**
   - Website architecture
   - Technology stack (if identifiable)
   - Hosting and CDN analysis
   - Security assessment
   - Scalability considerations

9. **User Experience & Conversion**
   - UX/UI assessment
   - Conversion optimization opportunities
   - User journey analysis
   - Friction points identification
   - Improvement recommendations

10. **Strategic Recommendations**
    - Quick wins (implement immediately)
    - High-impact improvements (1-3 months)
    - Long-term strategic initiatives (3-12 months)
    - Investment priorities
    - Risk assessment

11. **Benchmarking & Industry Comparison**
    - Industry benchmarks
    - Performance vs industry standards
    - Market positioning
    - Competitive advantages

12. **Tools & Monitoring Recommendations**
    - Analytics tools setup
    - Key metrics to track
    - Reporting dashboards
    - Monitoring strategies

{depth_instruction}

Format the report in Markdown with clear sections, data tables where appropriate, and actionable insights. Be specific and reference actual elements from the website when possible. When providing estimates, clearly mark them as such."""

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

## Website Analytics for {website_url}

Once the API key is configured, you can generate comprehensive analytics reports for this website."""
    
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

## Website Analytics for {website_url}

Once the API key is configured, you can generate comprehensive analytics reports for this website."""
        
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

## Website Analytics for {website_url}

Once the quota issue is resolved, you can generate analytics reports for this website."""
        
        elif "rate_limit" in error_msg.lower():
            return f"""# ⚠️ OpenAI API Rate Limit

The OpenAI API rate limit has been exceeded. Please try again in a moment.

**Error Details:**
- Error Type: {error_type}
- Message: {error_msg}

## Website Analytics for {website_url}

Please wait a moment and try generating the analytics report again."""
        
        else:
            return f"""# ⚠️ Error Generating Analytics Report

An error occurred while generating the analytics report.

**Error Details:**
- Error Type: {error_type}
- Message: {error_msg}

## Website Analytics for {website_url}

Please check the backend logs for more details and try again."""

