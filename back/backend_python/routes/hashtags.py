from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
from typing import List, Optional
from utils.openai_helper import generate_hashtags
from utils.platform_constants import validate_platform, get_platform_limits
from utils.auth import require_api_key, require_credits

router = APIRouter()

class HashtagRequest(BaseModel):
    topic: str
    platform: str
    caption: Optional[str] = None
    count: Optional[int] = None

    @validator('platform')
    def validate_platform_name(cls, v):
        if not validate_platform(v):
            raise ValueError(f"Invalid platform. Must be one of: {', '.join(PLATFORM_LIMITS.keys())}")
        return v.lower()

    @validator('count')
    def validate_count(cls, v, values):
        if v is None:
            platform_limits = get_platform_limits(values['platform'])
            return platform_limits['recommended_hashtags']
        
        platform_limits = get_platform_limits(values['platform'])
        if v > platform_limits['max_hashtags']:
            raise ValueError(f"Maximum {platform_limits['max_hashtags']} hashtags allowed for {values['platform']}")
        return v

class HashtagResponse(BaseModel):
    hashtags: List[str]
    platform: str
    topic: str

# Store hashtags in memory for testing
hashtags_store = []

@router.post("/", response_model=HashtagResponse)
async def suggest_hashtags(request: HashtagRequest):
    try:
        platform_limits = get_platform_limits(request.platform)
        
        # If count not specified, use recommended count for platform
        count = request.count or platform_limits['recommended_hashtags']
        
        # Use caption if provided, otherwise fall back to topic
        context = request.caption if request.caption else request.topic
        
        hashtags = generate_hashtags(
            topic=context,
            platform=request.platform,
            count=min(count, platform_limits['max_hashtags'])
        )
        
        response = HashtagResponse(
            hashtags=hashtags[:platform_limits['max_hashtags']],
            platform=request.platform,
            topic=request.topic
        )
        hashtags_store.append(response)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[HashtagResponse])
async def get_hashtags():
    return hashtags_store

@router.get("/{hashtag_id}", response_model=HashtagResponse)
async def get_hashtag(hashtag_id: int):
    if hashtag_id < 0 or hashtag_id >= len(hashtags_store):
        raise HTTPException(status_code=404, detail="Hashtag not found")
    return hashtags_store[hashtag_id]

@router.put("/{hashtag_id}", response_model=HashtagResponse)
async def update_hashtag(hashtag_id: int, request: HashtagRequest):
    if hashtag_id < 0 or hashtag_id >= len(hashtags_store):
        raise HTTPException(status_code=404, detail="Hashtag not found")
    
    hashtags = generate_hashtags(
        topic=request.topic,
        platform=request.platform,
        count=request.count
    )
    
    response = HashtagResponse(
        hashtags=hashtags,
        platform=request.platform,
        topic=request.topic
    )
    hashtags_store[hashtag_id] = response
    return response

@router.delete("/{hashtag_id}")
async def delete_hashtag(hashtag_id: int):
    if hashtag_id < 0 or hashtag_id >= len(hashtags_store):
        raise HTTPException(status_code=404, detail="Hashtag not found")
    
    hashtags_store.pop(hashtag_id)
    return {"message": "Hashtag deleted successfully"} 