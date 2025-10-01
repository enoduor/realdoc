# Platform-specific configurations and limitations
PLATFORM_LIMITS = {
    "instagram": {
        "max_characters": 2200,
        "max_hashtags": 30,
        "recommended_hashtags": 20,
        "prompt_style": "engaging and visual-focused",
        "supported_media": ["image", "video", "carousel"],
        "recommended_image_size": "1080x1080 (square), 1080x1350 (portrait)",
        "recommended_video_length": "3-60 seconds"
    },
    "twitter": {
        "max_characters": 280,
        "max_hashtags": 10,
        "recommended_hashtags": 5,
        "prompt_style": "concise and engaging",
        "supported_media": ["image", "video", "gif"],
        "recommended_image_size": "1600x900",
        "recommended_video_length": "Up to 2:20 minutes"
    },
    "facebook": {
        "max_characters": 63206,
        "max_hashtags": 30,
        "recommended_hashtags": 15,
        "prompt_style": "detailed and conversational",
        "supported_media": ["image", "video", "carousel", "link"],
        "recommended_image_size": "1200x630",
        "recommended_video_length": "Up to 240 minutes"
    },
    "linkedin": {
        "max_characters": 3000,
        "max_hashtags": 15,
        "recommended_hashtags": 10,
        "prompt_style": "professional and industry-focused",
        "supported_media": ["image", "video", "document"],
        "recommended_image_size": "1200x627",
        "recommended_video_length": "Up to 10 minutes"
    },
    "tiktok": {
        "max_characters": 150,
        "max_hashtags": 30,
        "recommended_hashtags": 20,
        "prompt_style": "trendy and entertaining",
        "supported_media": ["video"],
        "recommended_image_size": "N/A",
        "recommended_video_length": "15-60 seconds"
    },
    "youtube": {
        "max_characters": 5000,
        "max_hashtags": 15,
        "recommended_hashtags": 10,
        "prompt_style": "descriptive and SEO-friendly",
        "supported_media": ["video"],
        "recommended_image_size": "1280x720 (thumbnail)",
        "recommended_video_length": "No limit (recommended 10-15 minutes)"
    }
}

def validate_platform(platform: str) -> bool:
    """
    Validate if the given platform is supported
    """
    return platform.lower() in PLATFORM_LIMITS

def get_platform_limits(platform: str) -> dict:
    """
    Get the limits and requirements for a specific platform
    Returns default Instagram limits if platform not found
    """
    return PLATFORM_LIMITS.get(platform.lower(), PLATFORM_LIMITS["instagram"])

def get_prompt_style(platform: str) -> str:
    """
    Get the recommended prompt style for a specific platform
    """
    platform_data = get_platform_limits(platform)
    return platform_data.get("prompt_style", "engaging and professional")
