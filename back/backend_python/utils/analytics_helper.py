import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional, List
from utils.web_crawler import crawl_and_extract, format_crawled_content_for_prompt, crawl_competitors
from utils.traffic_data_helper import get_traffic_data_for_domain, format_traffic_data_for_prompt

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
    
    # Fetch real traffic data for main website
    traffic_data_text = ""
    if include_traffic_analysis:
        try:
            print(f"Fetching real traffic data for: {normalized_url}")
            traffic_data = await get_traffic_data_for_domain(normalized_url)
            if traffic_data.get('available'):
                traffic_data_text = format_traffic_data_for_prompt(traffic_data, normalized_url)
                print(f"✅ Real traffic data obtained from {traffic_data.get('source', 'unknown')}")
            else:
                print("⚠️  No real traffic data available, will use AI estimates")
        except Exception as e:
            print(f"Error fetching traffic data: {e}")
    
    # Normalize competitor URLs
    normalized_competitor_urls = []
    if competitor_urls:
        for url in competitor_urls:
            normalized = url.strip()
            if not normalized.startswith(('http://', 'https://')):
                normalized = f"https://{normalized}"
            normalized = normalized.rstrip('/')
            normalized_competitor_urls.append(normalized)
    
    # Fetch real traffic data for competitors
    competitor_traffic_data_text = ""
    if normalized_competitor_urls and include_competitor_comparison and include_traffic_analysis:
        try:
            print(f"Fetching real traffic data for {len(normalized_competitor_urls)} competitor(s)")
            competitor_traffic_parts = []
            for comp_url in normalized_competitor_urls:
                comp_traffic = await get_traffic_data_for_domain(comp_url)
                if comp_traffic.get('available'):
                    competitor_traffic_parts.append(format_traffic_data_for_prompt(comp_traffic, comp_url))
            
            if competitor_traffic_parts:
                competitor_traffic_data_text = "\n".join(competitor_traffic_parts)
                print(f"✅ Real traffic data obtained for {len(competitor_traffic_parts)} competitor(s)")
        except Exception as e:
            print(f"Error fetching competitor traffic data: {e}")
    
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
10. **IF COMPETITOR DATA IS PROVIDED**: You MUST explicitly list each competitor's name and URL in the Competitive Analysis section AND in any section where you use competitor data for estimates (especially Traffic Analysis). Reference specific features, content, and strategies from the competitor data provided. DO NOT use generic competitor names or phrases like "similar niche websites" - ALWAYS use the actual competitor names and URLs from the data provided. When making estimates based on competitors, explicitly state: "Based on comparison with [Competitor Name] ([competitor-url.com]), [Competitor Name 2] ([competitor-url2.com]), etc."

Analysis Depth: {analysis_depth}
Language: {language}"""

    # Build sections based on selected components
    sections = []
    section_num = 1
    
    # Always include Executive Summary
    sections.append(f"{section_num}. **Executive Summary** (ALWAYS INCLUDE)\n   - Website overview and primary purpose\n   - Key performance indicators (KPIs)\n   - Overall health score (0-100)\n   - Top strategic insights\n   - Priority recommendations")
    section_num += 1
    
    # Traffic Analysis (if selected)
    if include_traffic_analysis:
        traffic_label = "(Using REAL traffic data from SimilarWeb API)" if traffic_data_text else "(SimilarWeb-style insights)"
        traffic_instruction = "Use the REAL TRAFFIC DATA provided above. If real data is available, prioritize it over estimates. Clearly indicate when you're using real data vs estimates." if traffic_data_text else "If you provide traffic estimates based on competitor comparison, you MUST explicitly list the specific competitor websites used for comparison. For example: 'Based on comparison with [Competitor Name 1] (competitor1.com), [Competitor Name 2] (competitor2.com), and [Competitor Name 3] (competitor3.com), estimated monthly traffic is...'"
        traffic_data_label = "Monthly traffic (from real data)" if traffic_data_text else "Estimated monthly traffic (based on website structure and content)"
        
        sections.append(f"{section_num}. **Traffic Analysis** {traffic_label} (REQUIRED - Selected Component)\n   - **CRITICAL**: {traffic_instruction}\n   - {traffic_data_label}\n   - **If using competitor data for estimates**: List each competitor website name and URL that informed the traffic estimate\n   - Traffic sources breakdown:\n     * Direct traffic\n     * Organic search\n     * Referral traffic\n     * Social media\n     * Paid advertising\n   - Geographic distribution (if identifiable)\n   - Device breakdown (desktop vs mobile)\n   - Bounce rate estimates\n   - Average session duration estimates\n   - Pages per session estimates\n   - Top performing pages (based on content analysis)\n   - Traffic trends and patterns")
        section_num += 1
    
    # Website Performance Metrics (always include)
    sections.append(f"{section_num}. **Website Performance Metrics** (ALWAYS INCLUDE)\n   - Page load speed analysis\n   - Core Web Vitals assessment\n   - Mobile responsiveness\n   - User experience metrics\n   - Conversion funnel analysis (if applicable)\n   - Engagement metrics")
    section_num += 1
    
    # Content Analysis (always include)
    sections.append(f"{section_num}. **Content Analysis** (ALWAYS INCLUDE)\n   - Content quality assessment\n   - Content depth and comprehensiveness\n   - Content freshness\n   - Content gaps and opportunities\n   - SEO content performance\n   - Content marketing effectiveness")
    section_num += 1
    
    # Competitive Analysis (if selected)
    if include_competitor_comparison:
        sections.append(f"{section_num}. **Competitive Analysis** (REQUIRED - Selected Component)\n   - **List of Competitors Analyzed**: Start by explicitly listing each competitor's name and URL that was analyzed\n   - Competitive positioning\n   - Market share estimates\n   - Feature comparison with competitors (create a detailed comparison table if possible)\n   - Content comparison\n   - Traffic comparison (relative estimates)\n   - Strengths and weaknesses vs competitors (be specific about each competitor)\n   - Competitive advantages and disadvantages\n   - Market opportunities\n   - **Specific competitor insights**: For each competitor listed, provide 2-3 specific insights about their approach, features, or strategy")
        section_num += 1
    
    # Revenue Model Analysis (if selected)
    if include_revenue_analysis:
        sections.append(f"{section_num}. **Revenue Model Analysis** (REQUIRED - Selected Component)\n   - Identified revenue streams:\n     * Subscription/SaaS model\n     * Advertising revenue\n     * E-commerce/sales\n     * Affiliate marketing\n     * Freemium model\n     * Enterprise sales\n     * Other monetization methods\n   - Revenue model assessment\n   - Pricing strategy analysis\n   - Monetization effectiveness\n   - Revenue potential estimates (if possible)\n   - Revenue optimization opportunities\n   - Business model strengths and weaknesses")
        section_num += 1
    
    # Marketing & Growth Analysis (always include)
    sections.append(f"{section_num}. **Marketing & Growth Analysis** (ALWAYS INCLUDE)\n   - Marketing channels effectiveness\n   - Brand presence and awareness\n   - Social media presence\n   - Content marketing strategy\n   - SEO performance\n   - Paid advertising presence\n   - Growth opportunities")
    section_num += 1
    
    # Technical Infrastructure (always include)
    sections.append(f"{section_num}. **Technical Infrastructure** (ALWAYS INCLUDE)\n   - Website architecture\n   - Technology stack (if identifiable)\n   - Hosting and CDN analysis\n   - Security assessment\n   - Scalability considerations")
    section_num += 1
    
    # User Experience & Conversion (always include)
    sections.append(f"{section_num}. **User Experience & Conversion** (ALWAYS INCLUDE)\n   - UX/UI assessment\n   - Conversion optimization opportunities\n   - User journey analysis\n   - Friction points identification\n   - Improvement recommendations")
    section_num += 1
    
    # Strategic Recommendations (always include)
    sections.append(f"{section_num}. **Strategic Recommendations** (ALWAYS INCLUDE)\n    - Quick wins (implement immediately)\n    - High-impact improvements (1-3 months)\n    - Long-term strategic initiatives (3-12 months)\n    - Investment priorities\n    - Risk assessment")
    section_num += 1
    
    # Benchmarking & Industry Comparison (always include)
    sections.append(f"{section_num}. **Benchmarking & Industry Comparison** (ALWAYS INCLUDE)\n    - Industry benchmarks\n    - Performance vs industry standards\n    - Market positioning\n    - Competitive advantages")
    section_num += 1
    
    # Tools & Monitoring Recommendations (always include)
    sections.append(f"{section_num}. **Tools & Monitoring Recommendations** (ALWAYS INCLUDE)\n    - Analytics tools setup\n    - Key metrics to track\n    - Reporting dashboards\n    - Monitoring strategies")
    
    sections_text = "\n\n".join(sections)
    
    # Build selected components text
    selected_components = []
    if include_traffic_analysis:
        selected_components.append("Traffic Analysis")
    if include_competitor_comparison:
        selected_components.append("Competitor Comparison")
    if include_revenue_analysis:
        selected_components.append("Revenue Intelligence")
    selected_components_text = ", ".join(selected_components) if selected_components else "None"
    
    # Build traffic data sections (avoid backslashes in f-string expressions)
    traffic_section = ""
    if traffic_data_text:
        traffic_section = f"REAL TRAFFIC DATA:\n{traffic_data_text}\n"
    
    competitor_traffic_section = ""
    if competitor_traffic_data_text:
        competitor_traffic_section = f"COMPETITOR TRAFFIC DATA:\n{competitor_traffic_data_text}\n"
    
    competitor_analysis_section = ""
    if competitor_analysis and include_competitor_comparison:
        competitor_analysis_section = f"Competitor Analysis Data:\n{competitor_analysis}"
    
    user_prompt = f"""Analyze the following website and provide a comprehensive website analytics report:

Website URL: {normalized_url}

Website Content (crawled):
{website_context if website_context else "No website content available. Provide general analytics insights based on the URL and industry."}

{traffic_section}{competitor_traffic_section}{competitor_analysis_section}

Please provide a comprehensive website analytics report covering ONLY the following sections based on the selected components:

{sections_text}

**CRITICAL INSTRUCTIONS:**
- ONLY include sections that match the selected components: {selected_components_text}
- DO NOT include sections that were not selected
- Executive Summary, Website Performance, Content Analysis, Marketing & Growth, Technical Infrastructure, User Experience, Strategic Recommendations, Benchmarking, and Tools sections should always be included
- Traffic Analysis should ONLY be included if "Traffic Analysis" component is selected
- Competitive Analysis should ONLY be included if "Competitor Comparison" component is selected
- Revenue Model Analysis should ONLY be included if "Revenue Intelligence" component is selected
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

