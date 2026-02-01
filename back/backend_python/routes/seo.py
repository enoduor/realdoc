from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from utils.seo_helper import generate_seo_report, generate_production_ready_meta_tags, ai_rewrite_seo_content, quality_assurance_check
from utils.web_crawler import crawl_and_extract
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
        
        # Quality assurance check
        qa_result = quality_assurance_check(report, request.website_url)
        
        word_count = count_words(report)
        estimated_read_time = estimate_read_time(word_count)
        
        response = SEOResponse(
            report=report,
            word_count=word_count,
            estimated_read_time=estimated_read_time,
            website_url=request.website_url
        )
        # Add QA data to response (extend model if needed)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ProductionMetaTagsRequest(BaseModel):
    website_url: str
    page_type: str = "homepage"
    business_type: str = "saas"
    target_keywords: Optional[str] = None


class ProductionMetaTagsResponse(BaseModel):
    meta_tags: str
    schema_markup: str
    open_graph: str
    twitter_card: str
    full_code: str


@router.post("/production-meta-tags", response_model=ProductionMetaTagsResponse)
async def get_production_meta_tags(request: ProductionMetaTagsRequest):
    """Generate production-ready meta tags, schema markup, and social tags."""
    try:
        # Crawl website for context
        crawled_data = await crawl_and_extract(request.website_url)
        
        result = await generate_production_ready_meta_tags(
            website_url=request.website_url,
            page_type=request.page_type,
            business_type=request.business_type,
            target_keywords=request.target_keywords,
            crawled_data=crawled_data
        )
        
        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])
        
        return ProductionMetaTagsResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RewriteRequest(BaseModel):
    content: str
    rewrite_type: str = "improve"  # improve, simplify, expand, optimize
    focus: Optional[str] = None


class RewriteResponse(BaseModel):
    rewritten_content: str
    original_length: int
    rewritten_length: int


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_content(request: RewriteRequest):
    """Use AI to rewrite/improve SEO content."""
    try:
        rewritten = await ai_rewrite_seo_content(
            original_content=request.content,
            rewrite_type=request.rewrite_type,
            focus=request.focus
        )
        
        return RewriteResponse(
            rewritten_content=rewritten,
            original_length=len(request.content),
            rewritten_length=len(rewritten)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class QACheckRequest(BaseModel):
    report: str
    website_url: str


@router.post("/quality-check")
async def check_quality(request: QACheckRequest):
    """Perform quality assurance check on SEO report."""
    try:
        qa_result = quality_assurance_check(request.report, request.website_url)
        return qa_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

