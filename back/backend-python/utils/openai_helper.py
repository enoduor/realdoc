import os
from openai import OpenAI
from dotenv import load_dotenv
from .platform_constants import get_platform_limits, get_prompt_style

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_caption(platform: str, topic: str, tone: str = "professional", language: str = "en", max_length: int = None) -> str:
    """
    Generate a platform-specific caption using OpenAI.
    
    Args:
        platform (str): Social media platform (e.g., "Instagram", "TikTok")
        topic (str): Main topic or content of the post
        tone (str): Desired tone of the caption
        language (str): Language code for the caption
        max_length (int): Maximum character length for the caption
    
    Returns:
        str: Generated caption
    """
    platform_limits = get_platform_limits(platform)
    prompt_style = get_prompt_style(platform)
    max_chars = max_length or platform_limits["max_characters"]
    
    prompt = f"""Create a {tone} caption in {language} for a {platform} post about '{topic}'.
    The caption should be {prompt_style}, engaging, and include a call-to-action.
    Maximum length: {max_chars} characters.
    Make it platform-appropriate and optimized for {platform}'s audience."""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "You are a professional social media content creator specialized in platform-specific content."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=150
        )
        caption = response.choices[0].message.content.strip()
        # Ensure caption meets platform limits
        if len(caption) > max_chars:
            caption = caption[:max_chars]
        return caption
    except Exception as e:
        print(f"Error generating caption: {str(e)}")
        return "Error generating caption. Please try again."

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
        print(f"Error generating hashtags: {str(e)}")
        return ["Error generating hashtags. Please try again."] 