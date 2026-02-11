from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, List
from utils.analytics_helper import generate_analytics_report
import asyncio

router = APIRouter()

class AnalyticsRequest(BaseModel):
    website_url: str
    competitor_urls: Optional[str] = None
    analysis_depth: str = "comprehensive"
    include_revenue_analysis: bool = True
    include_traffic_analysis: bool = True
    include_competitor_comparison: bool = True
    language: str = "en"
    enable_js_render: bool = False

    @validator('analysis_depth')
    def validate_analysis_depth(cls, v):
        valid_depths = ["quick", "standard", "comprehensive", "deep"]
        if v not in valid_depths:
            raise ValueError(f"Invalid analysis_depth. Must be one of: {', '.join(valid_depths)}")
        return v.lower()

class AnalyticsResponse(BaseModel):
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

@router.post("/", response_model=AnalyticsResponse)
async def create_analytics_report(request: AnalyticsRequest):
    try:
        competitor_list = None
        if request.competitor_urls:
            # Split by comma and clean up URLs
            competitor_list = []
            for url in request.competitor_urls.split(','):
                url = url.strip()
                if url:
                    # Normalize URL
                    if not url.startswith(('http://', 'https://')):
                        url = f"https://{url}"
                    url = url.rstrip('/')
                    competitor_list.append(url)
        
        report = await generate_analytics_report(
            website_url=request.website_url,
            competitor_urls=competitor_list if competitor_list else None,
            analysis_depth=request.analysis_depth,
            include_revenue_analysis=request.include_revenue_analysis,
            include_traffic_analysis=request.include_traffic_analysis,
            include_competitor_comparison=request.include_competitor_comparison,
            language=request.language,
            enable_js_render=request.enable_js_render,
        )
        
        word_count = count_words(report)
        estimated_read_time = estimate_read_time(word_count)
        
        response = AnalyticsResponse(
            report=report,
            word_count=word_count,
            estimated_read_time=estimated_read_time,
            website_url=request.website_url
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

