import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional
from utils.web_crawler import (
    crawl_and_extract, 
    format_crawled_content_for_prompt,
    analyze_competitors_and_crawl
)

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

async def generate_documentation(
    app_name: str,
    app_type: str,
    doc_type: str,
    feature_description: str,
    technical_level: str = "intermediate",
    style: str = "tutorial",
    tone: str = "technical",
    language: str = "en",
    include_code_examples: bool = True,
    include_screenshots: bool = False,
    target_audience: str = "developers",
    format: str = "markdown",
    app_url: Optional[str] = None
) -> str:
    """
    Generate documentation for online applications using OpenAI.
    
    Args:
        app_name (str): Name of the application
        app_type (str): Type of app (web, mobile, api, saas, etc.)
        doc_type (str): Type of documentation (user-guide, api-docs, developer-guide, etc.)
        feature_description (str): Description of the feature/functionality to document
        technical_level (str): Technical level (beginner, intermediate, advanced)
        style (str): Documentation style (tutorial, reference, conceptual)
        tone (str): Tone (technical, friendly, formal, conversational)
        language (str): Language code
        include_code_examples (bool): Whether to include code examples
        include_screenshots (bool): Whether to include screenshot placeholders
        target_audience (str): Target audience (developers, end-users, admins, etc.)
        format (str): Output format (markdown, html, plain-text)
    
    Returns:
        str: Generated documentation
    """
    
    # Map doc types to descriptions and specific guidance
    doc_type_map = {
        "user-guide": {
            "description": "user guide with step-by-step instructions",
            "guidance": "Focus on how end users interact with the feature. Include step-by-step instructions, screenshots placeholders, and user-facing explanations."
        },
        "api-docs": {
            "description": "API documentation with endpoints, parameters, and examples",
            "guidance": "Document ONLY the API endpoints related to the feature described. Include request/response formats, authentication requirements, and code examples. Do NOT invent unrelated endpoints."
        },
        "developer-guide": {
            "description": "developer guide covering setup, architecture, and integration",
            "guidance": "Focus on technical setup, architecture decisions, and integration patterns specific to the feature. Include code examples and configuration details."
        },
        "admin-docs": {
            "description": "admin documentation for configuration and management",
            "guidance": "Document configuration options, management tasks, and administrative features related to the specific feature described."
        },
        "quick-start": {
            "description": "quick start guide to get started in minutes",
            "guidance": "Provide a concise, step-by-step guide to quickly get started with the feature. Keep it brief and focused on the essentials."
        },
        "faq": {
            "description": "FAQ document with common questions and answers",
            "guidance": "Create questions and answers based on the feature description. Focus on common issues, usage patterns, and clarifications related to the specific feature."
        },
        "release-notes": {
            "description": "release notes with version changes and new features",
            "guidance": "Document changes, new features, improvements, and breaking changes related to the feature. Base version numbers and changes on realistic assumptions."
        }
    }
    
    doc_info = doc_type_map.get(doc_type, {"description": "documentation", "guidance": "Create comprehensive documentation"})
    doc_description = doc_info["description"]
    doc_type_guidance = doc_info["guidance"]
    
    # Crawl URL if provided
    crawled_context = ""
    competitor_analysis = ""
    
    if app_url:
        try:
            crawled_data = await crawl_and_extract(app_url)
            if crawled_data:
                crawled_context = format_crawled_content_for_prompt(crawled_data)
                # Update app_name if we found a better title
                if crawled_data.get("title") and not app_name:
                    app_name = crawled_data["title"]
            
            # Perform competitor analysis after crawling the main app
            print("Starting competitor analysis...")
            competitor_result = await analyze_competitors_and_crawl(
                app_name=app_name,
                app_type=app_type,
                app_url=app_url
            )
            if competitor_result.get("analysis"):
                competitor_analysis = competitor_result["analysis"]
                print(f"Competitor analysis completed: {competitor_result.get('count', 0)} competitors analyzed")
        except Exception as e:
            print(f"Warning: Could not crawl URL {app_url}: {str(e)}")
            # Continue without crawled content
    else:
        # Even without app_url, we can still do competitor analysis if we have app_name
        if app_name:
            try:
                print(f"Starting competitor analysis for '{app_name}' (without app URL)...")
                competitor_result = await analyze_competitors_and_crawl(
                    app_name=app_name,
                    app_type=app_type,
                    app_url=None
                )
                if competitor_result and competitor_result.get("analysis"):
                    competitor_analysis = competitor_result["analysis"]
                    print(f"Competitor analysis completed: {competitor_result.get('count', 0)} competitors analyzed")
                else:
                    print("Competitor analysis returned no results")
            except Exception as e:
                print(f"Warning: Could not perform competitor analysis: {str(e)}")
                import traceback
                traceback.print_exc()
    
    # Build context parts
    context_parts = []
    if include_code_examples:
        context_parts.append("Include code examples with syntax highlighting placeholders")
    if include_screenshots:
        context_parts.append("Include screenshot placeholders with descriptions")
    if style == "tutorial":
        context_parts.append("Use step-by-step instructions with clear numbering")
    elif style == "reference":
        context_parts.append("Organize as a reference with clear sections and subsections")
    elif style == "conceptual":
        context_parts.append("Explain concepts and architecture clearly")
    
    context_str = "\n".join(f"- {part}" for part in context_parts) if context_parts else "- General documentation structure"
    
    # Format-specific instructions
    format_instructions = {
        "markdown": "Use Markdown formatting with headers, code blocks, lists, and emphasis",
        "html": "Use HTML formatting with proper semantic tags",
        "plain-text": "Use clear plain text with proper spacing and structure"
    }
    
    # Build prompt with crawled context and competitor analysis
    context_section = ""
    if crawled_context:
        context_section = f"""

═══════════════════════════════════════════════════════════════
CRITICAL: APPLICATION INFORMATION FROM WEBSITE (REQUIRED)
═══════════════════════════════════════════════════════════════
The following information was extracted from the application's website at {app_url}:

{crawled_context}

YOU MUST USE THIS INFORMATION AS THE PRIMARY SOURCE for creating the documentation. 
- Base ALL content on what is described above
- Use the exact application name, features, and capabilities mentioned
- Do NOT invent features or capabilities not mentioned in the website information
- **CRITICAL: Do NOT invent API endpoints, request/response formats, or code examples unless they are explicitly provided in the website information above**
- If the website mentions "API" but doesn't provide specific endpoints, document that APIs exist but DO NOT create example endpoints or request/response formats
- The documentation must accurately reflect what the application actually does based on the website content
- If specific technical details (like endpoint URLs, request formats, response structures) are not in the website information, either omit them or clearly state that they are conceptual examples
═══════════════════════════════════════════════════════════════

"""
    
    # Add competitor analysis section
    competitor_section = ""
    if competitor_analysis:
        competitor_section = f"""

{competitor_analysis}

IMPORTANT: Use competitor information to enhance documentation comprehensiveness:
- Include features and sections that competitors commonly address
- Follow industry best practices for documentation structure
- Ensure the documentation is competitive and comprehensive
- However, ALWAYS prioritize accuracy - only include features that are relevant to "{app_name}" based on the feature description and website information
- Do NOT copy competitor features verbatim - use them as inspiration for comprehensive coverage

"""
    
    # Check if feature description is too vague
    is_vague = len(feature_description.strip()) < 20 or feature_description.lower() in [
        "documentation", "docs", "guide", "tutorial", "help", "information", 
        "documentation for", "docs for", "guide for", "documentation about"
    ]
    
    vague_warning = ""
    if is_vague:
        vague_warning = f"""
⚠️⚠️⚠️ CRITICAL: The feature description "{feature_description}" is too vague!
You MUST expand on this and create COMPREHENSIVE, DETAILED documentation.
DO NOT create generic placeholder content like "First step", "Second step", "Follow these steps".
Instead, you MUST:
- Research what "{app_name}" actually does (it's a well-known platform)
- Create SPECIFIC, DETAILED instructions based on real functionality
- Include actual code examples, commands, or procedures that would work for "{app_name}"
- Write at least 1000+ words of meaningful content
- Include multiple detailed sections with real information
- If "{app_name}" is GitHub, include actual Git commands, repository setup, branching strategies, etc.
- If it's a developer guide, include actual setup steps, architecture diagrams descriptions, integration examples
- NEVER use generic placeholders like "First step", "Second step", "Additional Resources" without real content

FAILURE TO CREATE DETAILED CONTENT WILL RESULT IN USELESS GENERIC OUTPUT.
"""
    
    prompt = f"""Create a COMPREHENSIVE, DETAILED {doc_description} for an application called "{app_name}", which is a {app_type} application.
{context_section if context_section else ""}
{competitor_section if competitor_section else ""}
{vague_warning}

DOCUMENTATION TYPE: {doc_type}
{doc_type_guidance}

ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:
1. **NEVER use generic placeholders** like "First step", "Second step", "Third step", "Follow these steps", "Additional Resources", "For more information, please refer to the main documentation"
2. **NEVER create template content** - Every single sentence must be specific and meaningful
3. Use the EXACT app name "{app_name}" throughout - NEVER use placeholders
4. Base ALL content on this specific feature: "{feature_description}"
5. **IF APPLICATION INFORMATION FROM WEBSITE WAS PROVIDED ABOVE, IT IS THE PRIMARY SOURCE** - You MUST use that information
6. **If "{app_name}" is a well-known platform (like GitHub, GitLab, etc.), you MUST use your knowledge of that platform to create accurate, detailed documentation**
7. **For developer guides**: Include actual setup commands, configuration files, architecture explanations, integration code examples
8. **For API docs**: Include actual endpoint structures, request/response examples, authentication methods (if known for the platform)
9. **For user guides**: Include actual step-by-step procedures with specific UI elements, buttons, menus
10. **Minimum content requirement**: Create at least 1000+ words of meaningful, specific content - NOT generic templates
11. All code examples must be REAL, WORKING examples relevant to "{app_name}" and "{feature_description}"
12. Every section must contain SUBSTANTIAL, SPECIFIC content - not just headings with placeholder text

FEATURE TO DOCUMENT:
{feature_description}

DOCUMENTATION REQUIREMENTS:
- Target Audience: {target_audience}
- Technical Level: {technical_level}
- Documentation Style: {style}
- Tone: {tone}
- Language: {language}
- Format: {format_instructions.get(format, 'Markdown')}

ADDITIONAL INSTRUCTIONS:
{context_str}

DOCUMENTATION STRUCTURE (with REAL content, not placeholders):
- Clear headings and subheadings with ACTUAL content under each
- Table of contents (if document is longer than 5 sections)
- Step-by-step instructions with SPECIFIC, DETAILED steps (for tutorials)
- Code blocks with REAL, WORKING code examples (if code examples are included)
- Screenshot placeholders with DESCRIPTIVE descriptions (if screenshots are included)
- Warnings and tips callout boxes with ACTUAL useful information
- Proper formatting for {format} format

WHAT TO INCLUDE (be specific):
- For "{app_name}" as a {app_type} application, include actual:
  * Setup/installation procedures
  * Configuration examples
  * Code snippets that would actually work
  * Real-world use cases
  * Troubleshooting tips
  * Best practices specific to this platform/application

WHAT TO NEVER INCLUDE:
- Generic "First step", "Second step" without actual steps
- "For more information, please refer to..." without providing information
- "Additional Resources" sections with no actual resources
- Placeholder text of any kind
- Generic templates

VALIDATION CHECKLIST (ALL must be true):
✓ Every section has SUBSTANTIAL, SPECIFIC content (not just headings)
✓ App name "{app_name}" is used consistently
✓ Content is specific to "{app_name}" as a {app_type} application
✓ At least 1000+ words of meaningful content
✓ NO generic placeholders like "First step", "Second step"
✓ Code examples are REAL and would work for "{app_name}"
✓ All instructions are DETAILED and SPECIFIC
✓ Content demonstrates deep understanding of "{app_name}" and "{feature_description}"

REMEMBER: This is documentation for "{app_name}" about "{feature_description}". 
Create COMPREHENSIVE, DETAILED, SPECIFIC content - NOT generic templates or placeholders.
If you create generic content, you have FAILED. Be specific, be detailed, be comprehensive."""
    
    try:
        import asyncio
        # Validate API key before proceeding
        try:
            client = get_openai_client()
        except ValueError as e:
            error_msg = str(e)
            print(f"ERROR: {error_msg}")
            return f"""# {app_name} - {doc_description}

## ⚠️ Configuration Error

{error_msg}

## Feature: {feature_description}

Please configure your OpenAI API key in the backend .env file to generate documentation."""
        
        # Prepare the OpenAI call
        def make_openai_call():
            return client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are an expert technical writer specializing in software documentation. 
                        You create documentation that is SPECIFIC, ACCURATE, DETAILED, and COMPREHENSIVE.
                        
                    ABSOLUTE RULES - NO EXCEPTIONS:
                    1. **NEVER use generic templates or placeholder content** - Every sentence must be specific and meaningful
                    2. **NEVER write "First step", "Second step", "Third step"** without actual detailed steps
                    3. **NEVER write "For more information, please refer to..."** without providing the information
                    4. **NEVER create "Additional Resources" sections** with no actual resources
                    5. **ALWAYS create at least 1000+ words** of meaningful, specific content
                    6. If website information was provided, it is the PRIMARY SOURCE - use it to understand what the application actually does
                    7. If the app name is a well-known platform (GitHub, GitLab, etc.), use your knowledge to create accurate, detailed documentation
                    8. ALWAYS use the exact app name provided - never use "example" or "your-app" placeholders
                    9. **For developer guides**: Include actual setup commands, configuration files, architecture details, integration examples
                    10. **For API docs**: Include actual endpoint structures, request/response examples (if known for the platform)
                    11. **For user guides**: Include actual step-by-step procedures with specific UI elements
                    12. ALL code examples must be REAL, WORKING examples relevant to the app and feature
                    13. Every section must contain SUBSTANTIAL, SPECIFIC content - not just headings
                    14. If website mentions specific platforms, document ONLY those platforms
                    15. **CRITICAL: Do NOT invent API endpoints** - Only include technical details explicitly mentioned OR use your knowledge of well-known platforms
                    16. Create realistic, specific content based on the app name, feature description, AND website information (if provided)
                    17. Do NOT invent unrelated features or use examples from other domains
                    18. If website information contradicts generic assumptions, TRUST THE WEBSITE INFORMATION
                        
                        You adapt content for different technical levels ({technical_level}) and audiences ({target_audience}).
                        You create documentation that is comprehensive (1000+ words), detailed, accurate, and professionally formatted.
                        
                        Your documentation must be SPECIFIC, DETAILED, and COMPREHENSIVE - NOT generic templates or placeholders.
                        If you create generic content like "First step", "Second step", you have FAILED."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,  # Slightly higher for more creative, detailed content
                max_tokens=6000,  # Increased for comprehensive documentation
                top_p=0.95,
                frequency_penalty=0.1,  # Lower to allow more detailed content
                presence_penalty=0.05
            )
        
        # Run synchronous OpenAI call in executor to avoid blocking
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, make_openai_call)
        documentation = response.choices[0].message.content.strip()
        return documentation
    except Exception as e:
        error_code = getattr(e, 'code', 'unknown')
        error_type = type(e).__name__
        error_message = str(e)
        print(f"Error generating documentation: Type={error_type}, Code={error_code}, Message={error_message}")
        
        # Handle API key errors
        if 'api key' in error_message.lower() or 'authentication' in error_message.lower() or 'invalid' in error_message.lower():
            return f"""# {app_name} - {doc_description}

## ⚠️ OpenAI API Key Error

The OpenAI API key is invalid or not configured correctly.

**Error Details:**
- Error Type: {error_type}
- Error Code: {error_code}
- Message: {error_message}

**To fix this:**
1. Get your API key from https://platform.openai.com/api-keys
2. Set it in `back/backend_python/.env` as: `OPENAI_API_KEY=sk-your-actual-key-here`
3. Restart the backend server

## Feature: {feature_description}

Once the API key is configured, you can generate comprehensive documentation for this feature."""
        
        # Handle specific OpenAI errors
        if hasattr(e, 'code') and e.code == 'insufficient_quota':
            return f"""# {app_name} - {doc_description}

OpenAI API quota exceeded. Please check your billing.

## Feature: {feature_description}

## Overview

This section describes {feature_description} for {app_name}.

## Getting Started

1. Understand the feature
2. Follow the steps
3. Review the results

## Additional Information

For more details, please contact support."""
        elif hasattr(e, 'code') and e.code == 'rate_limit_exceeded':
            return f"""# {app_name} - {doc_description}

Rate limit exceeded. Please wait a moment and try again.

## Feature: {feature_description}

Please retry the documentation generation after a brief wait."""
        else:
            # Generate basic fallback documentation
            return f"""# {app_name} - {doc_description}

## Overview

This documentation covers {feature_description} for {app_name}.

## Feature Description

{feature_description}

## Target Audience

{target_audience}

## Technical Level

{technical_level}

## Getting Started

Follow these steps to get started with this feature:

1. First step
2. Second step
3. Third step

## Additional Resources

For more information, please refer to the main documentation."""
