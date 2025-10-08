import os
from openai import OpenAI
from dotenv import load_dotenv
from .platform_constants import get_platform_limits, get_prompt_style

# Load environment variables
load_dotenv()

# Initialize OpenAI client dynamically
def get_openai_client():
    return OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_caption(platform: str, topic: str, tone: str = "professional", language: str = "en", max_length: int = None, 
                    media_type: str = None, content_category: str = None, brand_voice: str = None, 
                    cta_type: str = None, audience: str = None) -> str:
    """
    Generate a platform-specific caption using OpenAI.
    
    Args:
        platform (str): Social media platform (e.g., "Instagram", "TikTok")
        topic (str): Main topic or content of the post
        tone (str): Desired tone of the caption
        language (str): Language code for the caption
        max_length (int): Maximum character length for the caption
        media_type (str): Type of media (image, video, carousel, etc.)
        content_category (str): Content category (business, lifestyle, education, etc.)
        brand_voice (str): Brand voice description (friendly, professional, casual, etc.)
        cta_type (str): Type of call-to-action (engagement, sales, awareness, etc.)
        audience (str): Target audience description
    
    Returns:
        str: Generated caption
    """
    platform_limits = get_platform_limits(platform)
    prompt_style = get_prompt_style(platform)
    max_chars = max_length or platform_limits["max_characters"]
    
    # Build context-rich prompt
    context_parts = []
    if media_type:
        context_parts.append(f"Media type: {media_type}")
    if content_category:
        context_parts.append(f"Content category: {content_category}")
    if brand_voice:
        context_parts.append(f"Brand voice: {brand_voice}")
    if audience:
        context_parts.append(f"Target audience: {audience}")
    if cta_type:
        context_parts.append(f"Call-to-action focus: {cta_type}")
    
    context_str = "\n".join(context_parts) if context_parts else "General social media content"
    
    prompt = f"""Create a {tone} caption in {language} for a {platform} post about '{topic}'.

CONTEXT:
{context_str}

REQUIREMENTS:
- Style: {prompt_style} and engaging
- Platform: Optimized for {platform}'s audience and best practices
- Length: Maximum {max_chars} characters
- Call-to-action: Include a relevant and compelling CTA
- Voice: Match the specified tone and brand voice
- Format: Use appropriate line breaks and emojis for {platform}

Make the caption feel natural, authentic, and tailored specifically for this content and platform."""
    
    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4o",  # Use GPT-4o for better performance
            messages=[
                {"role": "system", "content": f"""You are an expert social media content creator with deep knowledge of {platform} best practices. 
                You understand platform-specific algorithms, audience behaviors, and engagement patterns. 
                You create authentic, engaging content that drives real engagement and conversions. 
                Always tailor your writing style to the platform's culture and audience expectations."""},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,  # Slightly higher for more creativity
            max_tokens=200,   # Increased for more detailed captions
            top_p=0.9,        # Better quality responses
            frequency_penalty=0.1,  # Reduce repetition
            presence_penalty=0.1    # Encourage new ideas
        )
        caption = response.choices[0].message.content.strip()
        # Ensure caption meets platform limits
        if len(caption) > max_chars:
            caption = caption[:max_chars]
        return caption
    except Exception as e:
        print(f"Error generating caption: Error code: {getattr(e, 'code', 'unknown')} - {str(e)}")
        
        # Handle specific OpenAI errors
        if hasattr(e, 'code') and e.code == 'insufficient_quota':
            return f"OpenAI API quota exceeded. Please check your billing. For now, here's a basic caption: '{topic}' - Share your thoughts below! 💬"
        elif hasattr(e, 'code') and e.code == 'rate_limit_exceeded':
            return f"Rate limit exceeded. Please wait a moment. For now, here's a basic caption: '{topic}' - What do you think? 🤔"
        else:
            # Generate contextual fallback captions based on platform and content
            platform_emojis = {
                'instagram': '📸',
                'tiktok': '🎵', 
                'twitter': '🐦',
                'facebook': '👥',
                'linkedin': '💼',
                'youtube': '📺'
            }
            
            emoji = platform_emojis.get(platform.lower(), '📱')
            
            # More contextual fallback captions
            fallback_captions = [
                f"Sharing insights about {topic} {emoji} What are your thoughts?",
                f"Excited to dive into {topic} with you! {emoji} Drop a comment below 👇",
                f"Here's what I'm thinking about {topic} {emoji} Would love to hear your perspective!",
                f"Exploring {topic} today {emoji} Tag someone who needs to see this!",
                f"Quick thoughts on {topic} {emoji} What's your experience been like?"
            ]
            import random
            selected = random.choice(fallback_captions)
            # Ensure fallback meets length requirements
            if len(selected) > max_chars:
                selected = selected[:max_chars-3] + "..."
            return selected

def generate_hashtags(topic: str, platform: str, count: int = 5) -> list:
    """
    Generate relevant hashtags using OpenAI.
    
    Args:
        topic (str): Main topic or content of the post
        platform (str): Social media platform
        count (int): Number of hashtags to generate
    
    Returns:
        list: List of generated hashtags
    """
    platform_limits = get_platform_limits(platform)
    max_hashtags = min(count, platform_limits["max_hashtags"])
    prompt_style = get_prompt_style(platform)
    
    prompt = f"""Generate {max_hashtags} relevant and trending hashtags for a {platform} post about '{topic}'.
    Make them {prompt_style} and suitable for {platform}'s audience.
    Include a mix of:
    - Specific hashtags about {topic}
    - Trending {platform} hashtags
    - Industry-relevant hashtags
    Return only the hashtags, one per line, without any additional text.
    Do not exceed {max_hashtags} hashtags."""
    
    try:
        client = get_openai_client()
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"You are a {platform} hashtag expert who knows the platform's best practices."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=100
        )
        hashtags = response.choices[0].message.content.strip().split('\n')
        # Clean and limit hashtags
        cleaned_hashtags = [tag.strip() for tag in hashtags if tag.strip()]
        return cleaned_hashtags[:max_hashtags]
    except Exception as e:
        print(f"Error generating hashtags: Error code: {getattr(e, 'code', 'unknown')} - {str(e)}")
        
        # Handle specific OpenAI errors
        if hasattr(e, 'code') and e.code == 'insufficient_quota':
            return [f"#{topic.replace(' ', '')}", f"#{platform.lower()}", "content", "socialmedia", "post"]
        elif hasattr(e, 'code') and e.code == 'rate_limit_exceeded':
            return [f"#{topic.replace(' ', '')}", f"#{platform.lower()}", "content", "socialmedia", "post"]
        else:
            # Generate basic fallback hashtags
            fallback_hashtags = [
                f"#{topic.replace(' ', '')}",
                f"#{platform.lower()}",
                "content",
                "socialmedia",
                "post",
                "share",
                "trending",
                "viral"
            ]
            return fallback_hashtags[:max_hashtags] 