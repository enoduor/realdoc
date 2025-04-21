from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, List
from utils.openai_helper import generate_caption
from utils.platform_constants import validate_platform, get_platform_limits

router = APIRouter()

class CaptionRequest(BaseModel):
    platform: str
    topic: str
    tone: Optional[str] = "professional"
    language: Optional[str] = "en"

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
            max_length=platform_limits["max_characters"]
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
        language=request.language
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