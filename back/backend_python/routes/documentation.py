from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, validator
from typing import Optional, List
from utils.documentation_helper import generate_documentation
import asyncio

router = APIRouter()

class DocumentationRequest(BaseModel):
    app_name: str
    app_type: str
    doc_type: str
    feature_description: str
    technical_level: Optional[str] = "intermediate"
    style: Optional[str] = "tutorial"
    tone: Optional[str] = "technical"
    language: Optional[str] = "en"
    include_code_examples: Optional[bool] = True
    include_screenshots: Optional[bool] = False
    target_audience: Optional[str] = "developers"
    format: Optional[str] = "markdown"
    app_url: Optional[str] = None
    enable_js_render: Optional[bool] = False

    @validator('doc_type')
    def validate_doc_type(cls, v):
        valid_types = [
            "user-guide", "api-docs", "developer-guide", 
            "admin-docs", "quick-start", "faq", "release-notes"
        ]
        if v not in valid_types:
            raise ValueError(f"Invalid doc_type. Must be one of: {', '.join(valid_types)}")
        return v.lower()

    @validator('app_type')
    def validate_app_type(cls, v):
        valid_types = ["web", "mobile", "api", "saas", "desktop", "hybrid"]
        if v not in valid_types:
            raise ValueError(f"Invalid app_type. Must be one of: {', '.join(valid_types)}")
        return v.lower()

    @validator('technical_level')
    def validate_technical_level(cls, v):
        valid_levels = ["beginner", "intermediate", "advanced"]
        if v not in valid_levels:
            raise ValueError(f"Invalid technical_level. Must be one of: {', '.join(valid_levels)}")
        return v.lower()

    @validator('style')
    def validate_style(cls, v):
        valid_styles = ["tutorial", "reference", "conceptual"]
        if v not in valid_styles:
            raise ValueError(f"Invalid style. Must be one of: {', '.join(valid_styles)}")
        return v.lower()

    @validator('tone')
    def validate_tone(cls, v):
        valid_tones = ["technical", "friendly", "formal", "conversational"]
        if v not in valid_tones:
            raise ValueError(f"Invalid tone. Must be one of: {', '.join(valid_tones)}")
        return v.lower()

    @validator('format')
    def validate_format(cls, v):
        valid_formats = ["markdown", "html", "plain-text"]
        if v not in valid_formats:
            raise ValueError(f"Invalid format. Must be one of: {', '.join(valid_formats)}")
        return v.lower()

class DocumentationResponse(BaseModel):
    documentation: str
    format: str
    word_count: int
    estimated_read_time: int
    app_name: str
    doc_type: str

# Store documentation in memory for testing
documentation_store = []

def count_words(text: str) -> int:
    """Count words in text"""
    return len(text.split())

def estimate_read_time(word_count: int) -> int:
    """Estimate reading time in minutes (average 200 words per minute)"""
    return max(1, round(word_count / 200))

@router.post("/", response_model=DocumentationResponse)
async def create_documentation(request: DocumentationRequest):
    try:
        documentation = await generate_documentation(
            app_name=request.app_name,
            app_type=request.app_type,
            doc_type=request.doc_type,
            feature_description=request.feature_description,
            technical_level=request.technical_level,
            style=request.style,
            tone=request.tone,
            language=request.language,
            include_code_examples=request.include_code_examples,
            include_screenshots=request.include_screenshots,
            target_audience=request.target_audience,
            format=request.format,
            app_url=request.app_url,
            enable_js_render=request.enable_js_render,
        )
        
        word_count = count_words(documentation)
        estimated_read_time = estimate_read_time(word_count)
        
        response = DocumentationResponse(
            documentation=documentation,
            format=request.format,
            word_count=word_count,
            estimated_read_time=estimated_read_time,
            app_name=request.app_name,
            doc_type=request.doc_type
        )
        documentation_store.append(response)
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[DocumentationResponse])
async def get_documentations():
    return documentation_store

@router.get("/{doc_id}", response_model=DocumentationResponse)
async def get_documentation(doc_id: int):
    if doc_id < 0 or doc_id >= len(documentation_store):
        raise HTTPException(status_code=404, detail="Documentation not found")
    return documentation_store[doc_id]

@router.delete("/{doc_id}")
async def delete_documentation(doc_id: int):
    if doc_id < 0 or doc_id >= len(documentation_store):
        raise HTTPException(status_code=404, detail="Documentation not found")
    
    documentation_store.pop(doc_id)
    return {"message": "Documentation deleted successfully"}
