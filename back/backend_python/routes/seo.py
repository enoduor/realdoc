from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, List
from utils.seo_helper import generate_seo_report
import asyncio

router = APIRouter()

class SEORequest(BaseModel):
    website_url: str
    business_type: str = "saas"
    target_keywords: Optional[str] = None
    current_seo_issues: Optional[str] = None
    focus_areas: List[str] = ["on-page", "technical", "content"]
    language: str = "en"

    @validator('business_type')
    def validate_business_type(cls, v):
        valid_types = ["saas", "ecommerce", "blog", "portfolio", "corporate", "nonprofit", "other"]
        if v not in valid_types:
            raise ValueError(f"Invalid business_type. Must be one of: {', '.join(valid_types)}")
        return v.lower()

    @validator('focus_areas')
    def validate_focus_areas(cls, v):
        valid_areas = ["on-page", "technical", "content", "off-page", "local", "mobile", "speed", "accessibility"]
        if v:
            invalid = [area for area in v if area not in valid_areas]
            if invalid:
                raise ValueError(f"Invalid focus_areas: {', '.join(invalid)}. Must be one of: {', '.join(valid_areas)}")
        return v

class SEOResponse(BaseModel):
    report: str
    word_count: int
    estimated_read_time: int
    website_url: str

def count_words(text: str) -> int:
    """Count words in text"""
    return len(text.split())

def estimate_read_time(word_count: int) -> int:
    """Estimate reading time in minutes (average 200 words per minute)"""
    return max(1, round(word_count / 200))

@router.post("/", response_model=SEOResponse)
async def create_seo_report(request: SEORequest):
    try:
        report = await generate_seo_report(
            website_url=request.website_url,
            business_type=request.business_type,
            target_keywords=request.target_keywords,
            current_seo_issues=request.current_seo_issues,
            focus_areas=request.focus_areas,
            language=request.language
        )
        
        word_count = count_words(report)
        estimated_read_time = estimate_read_time(word_count)
        
        response = SEOResponse(
            report=report,
            word_count=word_count,
            estimated_read_time=estimated_read_time,
            website_url=request.website_url
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

