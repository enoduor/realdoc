from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, validator
from typing import Optional, List
from utils.openai_helper import generate_caption
from utils.platform_constants import validate_platform, get_platform_limits
from utils.auth import require_api_key, require_credits

router = APIRouter()

class CaptionRequest(BaseModel):
    platform: str
    topic: str
    tone: Optional[str] = "professional"
    language: Optional[str] = "en"
    media_type: Optional[str] = None
    content_category: Optional[str] = None
    brand_voice: Optional[str] = None
    cta_type: Optional[str] = None
    audience: Optional[str] = None

    @validator('platform')
    def validate_platform_name(cls, v):
        if not validate_platform(v):
            raise ValueError(f"Invalid platform. Must be one of: {', '.join(PLATFORM_LIMITS.keys())}")
        return v.lower()

class CaptionResponse(BaseModel):
    caption: str
    platform: str
    topic: str

# Store captions in memory for testing
captions_store = []

@router.post("/", response_model=CaptionResponse)
async def create_caption(request: CaptionRequest):
    try:
        platform_limits = get_platform_limits(request.platform)
        
        caption = generate_caption(
            platform=request.platform,
            topic=request.topic,
            tone=request.tone,
            language=request.language,
            max_length=platform_limits["max_characters"],
            media_type=request.media_type,
            content_category=request.content_category,
            brand_voice=request.brand_voice,
            cta_type=request.cta_type,
            audience=request.audience
        )
        
        if len(caption) > platform_limits["max_characters"]:
            caption = caption[:platform_limits["max_characters"]]
        
        response = CaptionResponse(
            caption=caption,
            platform=request.platform,
            topic=request.topic
        )
        captions_store.append(response)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[CaptionResponse])
async def get_captions():
    return captions_store

@router.get("/{caption_id}", response_model=CaptionResponse)
async def get_caption(caption_id: int):
    if caption_id < 0 or caption_id >= len(captions_store):
        raise HTTPException(status_code=404, detail="Caption not found")
    return captions_store[caption_id]

@router.put("/{caption_id}", response_model=CaptionResponse)
async def update_caption(caption_id: int, request: CaptionRequest):
    if caption_id < 0 or caption_id >= len(captions_store):
        raise HTTPException(status_code=404, detail="Caption not found")
    
    caption = generate_caption(
        platform=request.platform,
        topic=request.topic,
        tone=request.tone,
        language=request.language,
        media_type=request.media_type,
        content_category=request.content_category,
        brand_voice=request.brand_voice,
        cta_type=request.cta_type,
        audience=request.audience
    )
    
    response = CaptionResponse(
        caption=caption,
        platform=request.platform,
        topic=request.topic
    )
    captions_store[caption_id] = response
    return response

@router.delete("/{caption_id}")
async def delete_caption(caption_id: int):
    if caption_id < 0 or caption_id >= len(captions_store):
        raise HTTPException(status_code=404, detail="Caption not found")
    
    captions_store.pop(caption_id)
    return {"message": "Caption deleted successfully"} 