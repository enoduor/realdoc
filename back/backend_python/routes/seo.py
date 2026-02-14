# REPLACE THIS ENTIRE FILE CONTENT with the version below
# (or apply the marked blocks if you prefer a smaller diff)

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, List, Dict, Any
from utils.seo_helper import (
    generate_seo_report,
    generate_production_ready_meta_tags,
    ai_rewrite_seo_content,
    quality_assurance_check,
    generate_ai_optimized_recommendations,
)
from utils.web_crawler import crawl_and_extract

router = APIRouter()


class SEORequest(BaseModel):
    website_url: str
    business_type: str = "saas"
    target_keywords: Optional[str] = None
    current_seo_issues: Optional[str] = None
    focus_areas: List[str] = ["on-page", "technical", "content"]
    language: str = "en"
    enable_js_render: bool = False

    @validator("business_type")
    def validate_business_type(cls, v):
        valid_types = ["saas", "ecommerce", "blog", "portfolio", "corporate", "nonprofit", "other"]
        if v not in valid_types:
            raise ValueError(f"Invalid business_type. Must be one of: {', '.join(valid_types)}")
        return v.lower()

    @validator("focus_areas")
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
    brand_visibility_evidence: List[dict] = []
    qa: Dict[str, Any] = {}  # ADDED: return QA output


def count_words(text: str) -> int:
    return len(text.split())


def estimate_read_time(word_count: int) -> int:
    return max(1, round(word_count / 200))


@router.post("/", response_model=SEOResponse)
async def create_seo_report(request: SEORequest):
    try:
        result = await generate_seo_report(
            website_url=request.website_url,
            business_type=request.business_type,
            target_keywords=request.target_keywords,
            current_seo_issues=request.current_seo_issues,
            focus_areas=request.focus_areas,
            language=request.language,
            enable_js_render=request.enable_js_render,
        )

        report = result.get("report", "")

        # QA check
        qa_result = quality_assurance_check(report, request.website_url, focus_areas=request.focus_areas)

        word_count = count_words(report)
        estimated_read_time = estimate_read_time(word_count)

        return SEOResponse(
            report=report,
            word_count=word_count,
            estimated_read_time=estimated_read_time,
            website_url=request.website_url,
            brand_visibility_evidence=result.get("brand_visibility_evidence", []),
            qa=qa_result,  # ADDED
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ProductionMetaTagsRequest(BaseModel):
    website_url: str
    page_type: str = "homepage"
    business_type: str = "saas"
    target_keywords: Optional[str] = None
    enable_js_render: bool = False  # ADDED


class ProductionMetaTagsResponse(BaseModel):
    meta_tags: str
    schema_markup: str
    open_graph: str
    twitter_card: str
    pinterest: str = ""
    facebook: str = ""
    full_code: str


@router.post("/production-meta-tags", response_model=ProductionMetaTagsResponse)
async def get_production_meta_tags(request: ProductionMetaTagsRequest):
    try:
        # FIXED: honor JS render flag
        crawled_data = await crawl_and_extract(
            request.website_url,
            use_js_render=request.enable_js_render,
        )

        result = await generate_production_ready_meta_tags(
            website_url=request.website_url,
            page_type=request.page_type,
            business_type=request.business_type,
            target_keywords=request.target_keywords,
            crawled_data=crawled_data,
        )

        if result.get("error"):
            raise HTTPException(status_code=500, detail=result["error"])

        return ProductionMetaTagsResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RewriteRequest(BaseModel):
    content: str
    rewrite_type: str = "improve"
    focus: Optional[str] = None


class RewriteResponse(BaseModel):
    rewritten_content: str
    original_length: int
    rewritten_length: int


@router.post("/rewrite", response_model=RewriteResponse)
async def rewrite_content(request: RewriteRequest):
    try:
        rewritten = await ai_rewrite_seo_content(
            original_content=request.content,
            rewrite_type=request.rewrite_type,
            focus=request.focus,
        )

        return RewriteResponse(
            rewritten_content=rewritten,
            original_length=len(request.content),
            rewritten_length=len(rewritten),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class QACheckRequest(BaseModel):
    report: str
    website_url: str
    focus_on_competitor_analysis: bool = False


@router.post("/quality-check")
async def check_quality(request: QACheckRequest):
    try:
        qa_result = quality_assurance_check(
            request.report,
            request.website_url,
            focus_on_competitor_analysis=request.focus_on_competitor_analysis,
        )
        return qa_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AIOptimizedRecommendationsRequest(BaseModel):
    website_url: str
    seo_report: str
    business_type: str = "saas"
    target_keywords: Optional[str] = None
    enable_js_render: bool = False  # ADDED


class AIOptimizedRecommendationsResponse(BaseModel):
    recommendations: str
    word_count: int


@router.post("/ai-optimized-recommendations", response_model=AIOptimizedRecommendationsResponse)
async def get_ai_optimized_recommendations(request: AIOptimizedRecommendationsRequest):
    try:
        # FIXED: honor JS render flag
        crawled_data = await crawl_and_extract(
            request.website_url,
            use_js_render=request.enable_js_render,
        )

        recommendations = await generate_ai_optimized_recommendations(
            website_url=request.website_url,
            seo_report=request.seo_report,
            business_type=request.business_type,
            target_keywords=request.target_keywords,
            crawled_data=crawled_data,
        )

        word_count = count_words(recommendations)

        return AIOptimizedRecommendationsResponse(
            recommendations=recommendations,
            word_count=word_count,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))