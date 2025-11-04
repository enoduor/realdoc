import os
from openai import OpenAI
from dotenv import load_dotenv
from typing import Optional
from utils.web_crawler import crawl_and_extract, format_crawled_content_for_prompt

# Load environment variables
load_dotenv()

# Initialize OpenAI client dynamically
def get_openai_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

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
    if app_url:
        try:
            crawled_data = await crawl_and_extract(app_url)
            if crawled_data:
                crawled_context = format_crawled_content_for_prompt(crawled_data)
                # Update app_name if we found a better title
                if crawled_data.get("title") and not app_name:
                    app_name = crawled_data["title"]
        except Exception as e:
            print(f"Warning: Could not crawl URL {app_url}: {str(e)}")
            # Continue without crawled content
    
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
    
    # Build prompt with crawled context if available
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
    
    prompt = f"""Create {doc_description} for an application called "{app_name}", which is a {app_type} application.
{context_section if context_section else ""}

DOCUMENTATION TYPE: {doc_type}
{doc_type_guidance}

CRITICAL REQUIREMENTS:
1. Use the EXACT app name "{app_name}" throughout - NEVER use placeholders like "example", "your-app", "mzmzma", or generic names
2. Base ALL content on this specific feature: "{feature_description}"
3. **IF APPLICATION INFORMATION FROM WEBSITE WAS PROVIDED ABOVE, IT IS THE PRIMARY SOURCE** - You MUST use that information to understand what the application actually does and document it accurately
4. **If website information mentions specific platforms, features, or APIs, document ONLY those** - Do NOT add platforms or features not mentioned (e.g., if website says "TikTok, Twitter, Facebook", do NOT add YouTube or Instagram)
5. Do NOT include features, APIs, or functionality NOT mentioned in the feature description or the application information from the website
6. **CRITICAL: Do NOT invent API endpoints, request/response formats, or code examples** - If the website mentions "API" but doesn't provide specific endpoint details, document that APIs exist but DO NOT create example endpoints, request formats, or response structures. Only include technical details that are explicitly mentioned in the website information.
7. If the website says "API Integration" or "RESTful APIs" but doesn't provide specific endpoints, write: "API integration is available. Contact the service provider for API access and documentation." DO NOT create example API calls.
8. All code examples, configuration, and instructions must be directly related to "{feature_description}" and the actual application capabilities
9. Create realistic, specific content based on "{app_name}" being a {app_type} application and the information provided from the website

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

DOCUMENTATION STRUCTURE:
- Clear headings and subheadings
- Table of contents (if document is longer than 5 sections)
- Step-by-step instructions where applicable (for tutorials)
- Code blocks with syntax highlighting (if code examples are included)
- Screenshot placeholders with descriptions (if screenshots are included)
- Warnings and tips callout boxes where relevant
- Proper formatting for {format} format

VALIDATION CHECKLIST:
✓ Every section relates to "{feature_description}"
✓ App name "{app_name}" is used consistently (not placeholders)
✓ If API endpoints are included, they are ONLY from the website information - no invented endpoints
✓ Code examples are relevant to the feature AND match what's on the website
✓ No unrelated features or examples are included
✓ Content is specific to "{app_name}" as a {app_type} application
✓ If website mentions APIs but doesn't provide endpoints, documentation states "contact for API access" rather than inventing examples

REMEMBER: This is documentation for "{app_name}" about "{feature_description}". Create specific, accurate content - not generic templates."""
    
    try:
        import asyncio
        client = get_openai_client()
        
        # Prepare the OpenAI call
        def make_openai_call():
            return client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": f"""You are an expert technical writer specializing in software documentation. 
                        You create documentation that is SPECIFIC, ACCURATE, and RELEVANT to the exact feature described by the user.
                        
                    CRITICAL RULES:
                    1. NEVER use generic templates or placeholder content
                    2. If website information was provided, it is the PRIMARY SOURCE - use it to understand what the application actually does
                    3. NEVER include features or functionality not mentioned in the feature description OR the website information
                    4. ALWAYS use the exact app name provided - never use "example" or "your-app" placeholders
                    5. If website mentions specific platforms (e.g., "TikTok, Twitter, Facebook"), document ONLY those platforms - do NOT add others
                    6. **CRITICAL: Do NOT invent API endpoints, request/response formats, or code examples** - Only include technical details explicitly mentioned in the website information. If website says "API" but doesn't provide endpoints, document that APIs exist but DO NOT create example API calls.
                    7. If website mentions "API Integration" or "RESTful APIs" without specific details, write: "API integration is available. Contact the service provider for API access and documentation." DO NOT create example endpoints or request/response formats.
                    8. ALL code examples and instructions must be directly related to the feature description AND match what the website says the app does
                    9. If the feature description mentions specific functionality, document ONLY that functionality
                    10. Create realistic, specific content based on the app name, feature description, AND website information (if provided)
                    11. Do NOT invent unrelated features or use examples from other domains
                    12. If website information contradicts generic assumptions, TRUST THE WEBSITE INFORMATION
                        
                        You adapt content for different technical levels ({technical_level}) and audiences ({target_audience}).
                        You create documentation that is comprehensive, accurate, and professionally formatted.
                        
                        Your documentation must be specific to the application and feature described, not generic templates."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,  # Lower temperature for more focused, accurate output
                max_tokens=4000,  # Increased for more comprehensive documentation
                top_p=0.9,
                frequency_penalty=0.2,  # Slightly higher to avoid repetition
                presence_penalty=0.1
            )
        
        # Run synchronous OpenAI call in executor to avoid blocking
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, make_openai_call)
        documentation = response.choices[0].message.content.strip()
        return documentation
    except Exception as e:
        print(f"Error generating documentation: Error code: {getattr(e, 'code', 'unknown')} - {str(e)}")
        
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
