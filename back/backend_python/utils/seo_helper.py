import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional, List, Dict, Any
from utils.web_crawler import crawl_and_extract, format_crawled_content_for_prompt, analyze_keyword_rankings, get_competitor_high_volume_keywords, cluster_keywords_by_intent_difficulty_opportunity

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
    keyword_rankings_data = None
    
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
    
    # Analyze keyword rankings
    try:
        print("Analyzing keyword rankings...")
        keyword_rankings_data = await analyze_keyword_rankings(
            crawled_data=crawled_data,
            website_url=normalized_url,
            target_keywords=target_keywords,
            max_keywords=10
        )
        print(f"Keyword ranking analysis complete: {keyword_rankings_data.get('summary', 'N/A')}")
    except Exception as e:
        error_msg = str(e)
        print(f"Error analyzing keyword rankings: {error_msg}")
        keyword_rankings_data = None
    
    # Analyze competitor high-volume keywords
    competitor_keywords_data = None
    try:
        print("Analyzing competitor high-volume keywords...")
        competitor_keywords_data = await get_competitor_high_volume_keywords(
            website_url=normalized_url,
            max_competitors=5,
            max_keywords=10
        )
        print(f"Competitor keyword analysis complete: Found {competitor_keywords_data.get('competitors_crawled', 0)} competitors, {len(competitor_keywords_data.get('high_volume_keywords', []))} high-volume keywords")
    except Exception as e:
        error_msg = str(e)
        print(f"Error analyzing competitor keywords: {error_msg}")
        competitor_keywords_data = None
    
    # Cluster keywords by intent, difficulty, and opportunity
    keyword_clusters = None
    if keyword_rankings_data and keyword_rankings_data.get("rankings"):
        try:
            print("Clustering keywords by intent, difficulty, and opportunity...")
            all_keywords = keyword_rankings_data.get("extracted_keywords", []) + keyword_rankings_data.get("target_keywords", [])
            keyword_clusters = await cluster_keywords_by_intent_difficulty_opportunity(
                keywords=all_keywords[:30],
                rankings_data=keyword_rankings_data.get("rankings", []),
                website_url=normalized_url
            )
            print("Keyword clustering complete")
        except Exception as e:
            error_msg = str(e)
            print(f"Error clustering keywords: {error_msg}")
            keyword_clusters = None
    
    # Build the prompt
    focus_areas_text = ", ".join(focus_areas)
    
    system_prompt = f"""You are an expert SEO consultant with deep knowledge of search engine optimization, technical SEO, content strategy, and digital marketing. Your task is to analyze websites and provide comprehensive, actionable SEO recommendations.

CRITICAL REQUIREMENTS:
1. Provide SPECIFIC, ACTIONABLE recommendations based on the actual website content
2. Include concrete examples and specific fixes
3. Minimum 2000 words of detailed analysis
4. Use real data from the crawled website when available
5. Use the KEYWORD RANKING ANALYSIS data provided to give specific insights about current rankings
6. Reference actual ranking positions and keywords when discussing SEO performance
7. CRITICALLY IMPORTANT: Use the COMPETITOR HIGH-VOLUME KEYWORDS ANALYSIS to provide specific meta-tag recommendations:
   - Create actual title tag examples using competitor keywords
   - Create actual meta description examples using competitor keywords
   - Provide specific H1, H2, H3 header tag suggestions with competitor keywords
   - Show how to incorporate competitor keywords into content naturally
   - **ALWAYS explicitly list the competitor website names and URLs when discussing competitor keywords** - DO NOT use generic phrases like "competitors" or "similar websites"
8. **IF COMPETITOR DATA IS PROVIDED**: You MUST explicitly list each competitor's name and URL in the Competitor Keyword Analysis section. When mentioning keywords that competitors use, explicitly state which competitor website(s) use that keyword. DO NOT use generic competitor names or phrases - ALWAYS use the actual competitor URLs from the data provided.
9. Provide step-by-step implementation guides
10. Include code examples for technical SEO fixes
11. Reference specific pages, elements, or issues found on the website
12. DO NOT provide generic, templated advice

Focus Areas to Cover: {focus_areas_text}
Business Type: {business_type}
Language: {language}"""

    # Format keyword rankings data for prompt
    keyword_rankings_text = ""
    if keyword_rankings_data:
        rankings = keyword_rankings_data.get("rankings", [])
        if rankings:
            keyword_rankings_text = "\n\n═══════════════════════════════════════════════════════════════\n"
            keyword_rankings_text += "KEYWORD RANKING ANALYSIS\n"
            keyword_rankings_text += "═══════════════════════════════════════════════════════════════\n"
            keyword_rankings_text += f"Summary: {keyword_rankings_data.get('summary', 'N/A')}\n"
            keyword_rankings_text += f"Keywords Checked: {keyword_rankings_data.get('total_checked', 0)}\n"
            keyword_rankings_text += f"Keywords Found in Top 20: {keyword_rankings_data.get('found_count', 0)}\n"
            keyword_rankings_text += f"Keywords in Top 10: {keyword_rankings_data.get('top_10_count', 0)}\n"
            keyword_rankings_text += f"Keywords in Top 3: {keyword_rankings_data.get('top_3_count', 0)}\n\n"
            
            if keyword_rankings_data.get("extracted_keywords"):
                keyword_rankings_text += f"Extracted Keywords from Content: {', '.join(keyword_rankings_data['extracted_keywords'][:10])}\n\n"
            
            keyword_rankings_text += "Ranking Details:\n"
            for ranking in rankings[:15]:  # Show top 15 rankings
                if ranking.get("found"):
                    keyword_rankings_text += f"  ✓ '{ranking['keyword']}' - Position #{ranking.get('position', 'N/A')} in search results\n"
                else:
                    keyword_rankings_text += f"  ✗ '{ranking['keyword']}' - Not found in top 20 results\n"
            keyword_rankings_text += "\n═══════════════════════════════════════════════════════════════\n"
    
    # Format competitor high-volume keywords data for prompt
    competitor_keywords_text = ""
    if competitor_keywords_data and competitor_keywords_data.get("high_volume_keywords"):
        high_volume_kw = competitor_keywords_data.get("high_volume_keywords", [])
        competitor_keywords_map = competitor_keywords_data.get("competitor_keywords", {})
        if high_volume_kw:
            competitor_keywords_text = "\n\n═══════════════════════════════════════════════════════════════\n"
            competitor_keywords_text += "COMPETITOR HIGH-VOLUME KEYWORDS ANALYSIS\n"
            competitor_keywords_text += "═══════════════════════════════════════════════════════════════\n"
            competitor_keywords_text += f"Competitors Analyzed: {competitor_keywords_data.get('competitors_crawled', 0)}\n"
            competitor_keywords_text += f"Total Keywords Found: {competitor_keywords_data.get('total_keywords_found', 0)}\n"
            competitor_keywords_text += f"Top High-Volume Keywords: {len(high_volume_kw)}\n\n"
            
            # List all competitor URLs analyzed
            if competitor_keywords_map:
                competitor_keywords_text += "COMPETITOR WEBSITES ANALYZED:\n"
                for idx, comp_url in enumerate(competitor_keywords_map.keys(), 1):
                    competitor_keywords_text += f"  {idx}. {comp_url}\n"
                competitor_keywords_text += "\n"
            
            competitor_keywords_text += "HIGH-VOLUME KEYWORDS COMPETITORS RANK FOR:\n"
            competitor_keywords_text += "(Keywords with more autocomplete suggestions indicate higher search volume)\n\n"
            
            for idx, kw_data in enumerate(high_volume_kw[:10], 1):
                keyword = kw_data.get("keyword", "")
                volume_indicator = kw_data.get("search_volume_indicator", 0)
                suggestions = kw_data.get("related_suggestions", [])
                competitors_using = kw_data.get("competitors_using", [])
                
                competitor_keywords_text += f"{idx}. '{keyword}'\n"
                competitor_keywords_text += f"   Search Volume Indicator: {volume_indicator} autocomplete suggestions\n"
                if suggestions:
                    competitor_keywords_text += f"   Related High-Volume Terms: {', '.join(suggestions[:3])}\n"
                if competitors_using:
                    competitor_keywords_text += f"   Used by {len(competitors_using)} competitor(s): {', '.join(competitors_using)}\n"
                competitor_keywords_text += "\n"
            
            competitor_keywords_text += "═══════════════════════════════════════════════════════════════\n"
            competitor_keywords_text += "IMPORTANT: Use these high-volume keywords to:\n"
            competitor_keywords_text += "1. Design optimized meta tags (title, description)\n"
            competitor_keywords_text += "2. Create content that targets these keywords\n"
            competitor_keywords_text += "3. Optimize existing content with these keywords\n"
            competitor_keywords_text += "4. Build internal linking strategy around these keywords\n"
            competitor_keywords_text += "═══════════════════════════════════════════════════════════════\n"
    
    # Format keyword clusters data for prompt
    keyword_clusters_text = ""
    if keyword_clusters and not keyword_clusters.get("error"):
        clusters = keyword_clusters
        keyword_clusters_text = "\n\n═══════════════════════════════════════════════════════════════\n"
        keyword_clusters_text += "KEYWORD CLUSTERING: INTENT, DIFFICULTY & OPPORTUNITY\n"
        keyword_clusters_text += "═══════════════════════════════════════════════════════════════\n"
        
        # Intent clusters
        intent = clusters.get("intent", {})
        if intent:
            keyword_clusters_text += "\n📊 SEARCH INTENT CLUSTERS:\n"
            for intent_type, keywords in intent.items():
                if keywords:
                    keyword_clusters_text += f"  • {intent_type.title()}: {', '.join(keywords[:10])}\n"
        
        # Difficulty clusters
        difficulty = clusters.get("difficulty", {})
        if difficulty:
            keyword_clusters_text += "\n⚡ RANKING DIFFICULTY:\n"
            for diff_level, kw_list in difficulty.items():
                if kw_list:
                    kw_str = ', '.join([f"{kw.get('keyword', kw)} (score: {kw.get('score', 'N/A')})" if isinstance(kw, dict) else kw for kw in kw_list[:5]])
                    keyword_clusters_text += f"  • {diff_level.title()}: {kw_str}\n"
        
        # Opportunity clusters
        opportunity = clusters.get("opportunity", {})
        if opportunity:
            keyword_clusters_text += "\n🎯 OPPORTUNITY SCORE:\n"
            for opp_level, kw_list in opportunity.items():
                if kw_list:
                    kw_str = ', '.join([f"{kw.get('keyword', kw)} (score: {kw.get('score', 'N/A')}, reason: {kw.get('reason', 'N/A')})" if isinstance(kw, dict) else kw for kw in kw_list[:5]])
                    keyword_clusters_text += f"  • {opp_level.title()}: {kw_str}\n"
        
        keyword_clusters_text += "\n═══════════════════════════════════════════════════════════════\n"
        keyword_clusters_text += "Use these clusters to prioritize keyword targeting and content strategy.\n"
        keyword_clusters_text += "Focus on HIGH OPPORTUNITY + LOW/MEDIUM DIFFICULTY keywords first.\n"
        keyword_clusters_text += "═══════════════════════════════════════════════════════════════\n"
    
    user_prompt = f"""Analyze the following website and provide a comprehensive SEO report:

Website URL: {normalized_url}
Business Type: {business_type}

{f"Target Keywords: {target_keywords}" if target_keywords else ""}
{f"Known Issues: {current_seo_issues}" if current_seo_issues else ""}

Website Content (crawled):
{website_context if website_context else "No website content available. Provide general SEO recommendations based on the business type."}

{keyword_rankings_text if keyword_rankings_text else ""}

{competitor_keywords_text if competitor_keywords_text else ""}

{keyword_clusters_text if keyword_clusters_text else ""}

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

4. **Content SEO & Keyword Rankings**
   - Current keyword ranking performance (based on actual search results analysis)
   - Keywords the website currently ranks for and their positions
   - Keywords that need optimization (not ranking or ranking low)
   - **KEYWORD CLUSTERING ANALYSIS** (if provided):
     * Keywords clustered by search intent (Informational, Navigational, Transactional, Commercial)
     * Keywords categorized by ranking difficulty (Low, Medium, High)
     * Keywords prioritized by opportunity score (High, Medium, Low)
     * Strategic recommendations based on intent, difficulty, and opportunity clusters
   - Content quality assessment
   - Keyword research and targeting recommendations
   - Content gaps and opportunities
   - Content optimization recommendations
   - Blog/content strategy
   - E-A-T (Expertise, Authoritativeness, Trustworthiness) signals
   - Specific recommendations to improve rankings for target keywords

5. **Competitor Keyword Analysis & Meta-Tag Optimization**
   - **CRITICAL**: Start this section by explicitly listing each competitor website name and URL that was analyzed. For example: "Competitors Analyzed: [Competitor Name 1] (competitor1.com), [Competitor Name 2] (competitor2.com), etc."
   - High-volume keywords that competitors rank for (from competitor analysis)
   - **For each keyword mentioned**: Explicitly state which competitor website(s) use that keyword (e.g., "Keyword 'X' is used by [Competitor Name] (competitor-url.com)")
   - Specific meta-tag recommendations using competitor keywords:
     * Title tag optimization with high-volume keywords
     * Meta description optimization with competitor keywords
     * Header tag (H1, H2, H3) optimization suggestions
   - Content strategy recommendations based on competitor keyword analysis
   - How to incorporate competitor keywords into existing content
   - Internal linking opportunities using high-volume competitor keywords
   - Content creation ideas targeting competitor keywords

6. **Off-Page SEO** (if in focus areas)
   - Backlink profile analysis
   - Link building opportunities
   - Social signals
   - Local SEO (if applicable)
   - Brand mentions

7. **Mobile SEO** (if in focus areas)
   - Mobile-first indexing readiness
   - Mobile usability issues
   - AMP implementation
   - Mobile page speed

8. **Local SEO** (if in focus areas)
   - Google Business Profile optimization
   - Local citations
   - NAP consistency
   - Local keyword targeting

9. **Page Speed Optimization** (if in focus areas)
   - Current performance metrics
   - Specific optimization recommendations
   - Code minification
   - Image optimization
   - Caching strategies
   - CDN recommendations

10. **Accessibility** (if in focus areas)
   - WCAG compliance
   - Screen reader compatibility
   - Keyboard navigation
   - Color contrast
   - ARIA labels

11. **Implementation Roadmap**
    - Priority 1 (Quick wins - implement immediately)
    - Priority 2 (High impact - implement within 1 month)
    - Priority 3 (Long-term - implement within 3-6 months)
    - Timeline and resource requirements

12. **Tools and Resources**
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


async def generate_production_ready_meta_tags(
    website_url: str,
    page_type: str = "homepage",
    business_type: str = "saas",
    target_keywords: Optional[str] = None,
    crawled_data: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Generate production-ready meta tags, schema markup, and HTML code.
    
    Args:
        website_url: Website URL
        page_type: Type of page (homepage, product, blog, etc.)
        business_type: Type of business
        target_keywords: Target keywords
        crawled_data: Crawled website data
        
    Returns:
        Dictionary with production-ready code:
        - meta_tags: HTML meta tags
        - schema_markup: JSON-LD schema
        - open_graph: Open Graph tags
        - twitter_card: Twitter Card tags
    """
    try:
        client = get_openai_client()
        
        # Extract current data
        current_title = crawled_data.get("title", "") if crawled_data else ""
        current_description = crawled_data.get("description", "") if crawled_data else ""
        
        prompt = f"""Generate production-ready SEO code for:
- Website: {website_url}
- Page Type: {page_type}
- Business Type: {business_type}
- Target Keywords: {target_keywords or 'Not specified'}
- Current Title: {current_title}
- Current Description: {current_description}

Generate the following in valid HTML/JSON format:

1. **Meta Tags** (HTML):
   - Title tag (50-60 characters, includes primary keyword)
   - Meta description (150-160 characters, includes keywords)
   - Meta keywords (optional, comma-separated)
   - Canonical URL
   - Robots meta tag
   - Viewport meta tag
   - Charset meta tag

2. **Schema Markup** (JSON-LD):
   - Organization schema (if homepage)
   - WebSite schema with SearchAction
   - WebPage schema
   - BreadcrumbList (if applicable)
   - Product schema (if e-commerce)
   - Article schema (if blog)
   - LocalBusiness schema (if local business)

3. **Open Graph Tags**:
   - og:title
   - og:description
   - og:url
   - og:type
   - og:image (suggest placeholder URL)
   - og:site_name

4. **Twitter Card Tags**:
   - twitter:card
   - twitter:title
   - twitter:description
   - twitter:image

Return ONLY valid HTML and JSON code, ready to copy-paste into production. Format as:

META TAGS:
[HTML code here]

SCHEMA MARKUP:
[JSON-LD code here]

OPEN GRAPH:
[HTML code here]

TWITTER CARD:
[HTML code here]"""
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert SEO developer. Generate production-ready, valid HTML and JSON-LD code."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=2000
        )
        
        generated_code = response.choices[0].message.content.strip()
        
        # Parse the response into structured format
        result = {
            "meta_tags": "",
            "schema_markup": "",
            "open_graph": "",
            "twitter_card": "",
            "full_code": generated_code
        }
        
        # Simple parsing (can be enhanced)
        sections = generated_code.split("\n\n")
        current_section = None
        for section in sections:
            if "META TAGS:" in section.upper():
                current_section = "meta_tags"
                result["meta_tags"] = section.replace("META TAGS:", "").strip()
            elif "SCHEMA MARKUP:" in section.upper():
                current_section = "schema_markup"
                result["schema_markup"] = section.replace("SCHEMA MARKUP:", "").strip()
            elif "OPEN GRAPH:" in section.upper():
                current_section = "open_graph"
                result["open_graph"] = section.replace("OPEN GRAPH:", "").strip()
            elif "TWITTER CARD:" in section.upper():
                current_section = "twitter_card"
                result["twitter_card"] = section.replace("TWITTER CARD:", "").strip()
            elif current_section:
                result[current_section] += "\n" + section
        
        return result
        
    except Exception as e:
        return {
            "error": str(e),
            "meta_tags": "",
            "schema_markup": "",
            "open_graph": "",
            "twitter_card": "",
            "full_code": ""
        }


async def ai_rewrite_seo_content(
    original_content: str,
    rewrite_type: str = "improve",
    focus: Optional[str] = None
) -> str:
    """
    Use AI to rewrite/improve SEO content.
    
    Args:
        original_content: Original content to rewrite
        rewrite_type: Type of rewrite (improve, simplify, expand, optimize)
        focus: Focus area (meta tags, headings, content, etc.)
        
    Returns:
        Rewritten content
    """
    try:
        client = get_openai_client()
        
        rewrite_instructions = {
            "improve": "Improve the SEO content while maintaining the original meaning and making it more engaging and optimized for search engines.",
            "simplify": "Simplify the content to make it more readable while maintaining SEO value.",
            "expand": "Expand the content with more details, examples, and SEO-optimized information.",
            "optimize": "Optimize the content specifically for SEO, improving keyword density, readability, and structure."
        }
        
        instruction = rewrite_instructions.get(rewrite_type, rewrite_instructions["improve"])
        
        prompt = f"""Rewrite the following SEO content. {instruction}

{f"Focus on: {focus}" if focus else ""}

Original Content:
{original_content}

Return the rewritten content, maintaining the same format and structure but with improved SEO optimization."""
        
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert SEO content writer. Rewrite content to improve SEO while maintaining quality and readability."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        return f"Error rewriting content: {str(e)}"


def quality_assurance_check(report: str, website_url: str) -> Dict[str, Any]:
    """
    Perform quality assurance checks on the SEO report.
    
    Args:
        report: Generated SEO report
        website_url: Website URL
        
    Returns:
        Dictionary with QA results:
        - word_count: Word count
        - sections: Number of sections
        - has_meta_tags: Whether meta tag recommendations are present
        - has_schema: Whether schema recommendations are present
        - has_keywords: Whether keyword analysis is present
        - has_competitor_analysis: Whether competitor analysis is present
        - quality_score: Overall quality score (0-100)
        - issues: List of issues found
    """
    issues = []
    quality_score = 100
    
    # Check word count
    word_count = len(report.split())
    if word_count < 1000:
        issues.append("Report is too short (less than 1000 words)")
        quality_score -= 20
    elif word_count < 2000:
        issues.append("Report could be more comprehensive (less than 2000 words)")
        quality_score -= 10
    
    # Check for key sections
    required_sections = [
        "Executive Summary",
        "Technical SEO",
        "On-Page SEO",
        "Content SEO",
        "Keyword",
        "Competitor"
    ]
    
    found_sections = sum(1 for section in required_sections if section.lower() in report.lower())
    if found_sections < len(required_sections) * 0.7:
        issues.append(f"Missing key sections (found {found_sections}/{len(required_sections)})")
        quality_score -= 15
    
    # Check for meta tags
    if "meta" not in report.lower() and "title tag" not in report.lower():
        issues.append("Missing meta tag recommendations")
        quality_score -= 10
    
    # Check for schema
    if "schema" not in report.lower():
        issues.append("Missing schema markup recommendations")
        quality_score -= 5
    
    # Check for keywords
    if "keyword" not in report.lower():
        issues.append("Missing keyword analysis")
        quality_score -= 15
    
    # Check for competitor analysis
    if "competitor" not in report.lower():
        issues.append("Missing competitor analysis")
        quality_score -= 5
    
    quality_score = max(0, quality_score)
    
    return {
        "word_count": word_count,
        "sections_found": found_sections,
        "has_meta_tags": "meta" in report.lower() or "title tag" in report.lower(),
        "has_schema": "schema" in report.lower(),
        "has_keywords": "keyword" in report.lower(),
        "has_competitor_analysis": "competitor" in report.lower(),
        "quality_score": quality_score,
        "issues": issues,
        "status": "excellent" if quality_score >= 90 else "good" if quality_score >= 70 else "needs_improvement"
    }

