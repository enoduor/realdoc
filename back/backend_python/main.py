import os
import sys
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.documentation import router as documentation_router
from routes.seo import router as seo_router
from routes.analytics import router as analytics_router

load_dotenv()

# Turn off debug logs in production (keep errors)
IS_PRODUCTION = os.getenv('NODE_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production'
if IS_PRODUCTION:
    import builtins
    original_print = builtins.print
    
    def production_print(*args, **kwargs):
        # Only allow prints that explicitly go to stderr (errors)
        if kwargs.get('file') == sys.stderr:
            original_print(*args, **kwargs)
        # Suppress all other print statements (debug logs)
    
    builtins.print = production_print

# ---- Config ----
AI_ROOT_PATH = os.getenv("AI_ROOT_PATH", "/ai")  # external prefix via ALB
ENABLE_OPENAPI = os.getenv("AI_ENABLE_OPENAPI", "1") == "1"  # docs/schema toggle

app = FastAPI(
    title="DocsGen AI Service",
    root_path=AI_ROOT_PATH,
    openapi_url="/openapi.json" if ENABLE_OPENAPI else None,
    docs_url="/docs" if ENABLE_OPENAPI else None,
    redoc_url="/redoc" if ENABLE_OPENAPI else None,
)

# ---- CORS ----
# Allow all origins to support users accessing from any URL
# Users will input their own URLs, and the frontend needs to make API calls without CORS blocking
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins - no CORS blocking
    allow_credentials=False,  # Must be False when using allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers (single mount; root_path=/ai makes them externally /ai/...) ----
# Existing mounts (internal paths)
app.include_router(documentation_router, prefix="/api/v1/documentation", tags=["documentation"])
app.include_router(seo_router, prefix="/api/v1/seo", tags=["seo"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])

# Mirror mounts (external /ai/* paths)
app.include_router(documentation_router, prefix="/ai/api/v1/documentation", tags=["documentation"])
app.include_router(seo_router, prefix="/ai/api/v1/seo", tags=["seo"])
app.include_router(analytics_router, prefix="/ai/api/v1/analytics", tags=["analytics"])



# ---- Health ----
@app.get("/ping")
def ping():
    return {"status": "ok", "message": "AI service running"}

@app.get("/ai/ping")
def ai_ping():
    return {"status": "ok", "message": "AI service running"}

@app.get("/health")
def health():
    return {"status": "ok", "message": "AI service running"}

@app.get("/ai/health")
def ai_health():
    return {"status": "ok", "message": "AI service running"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5001))
    root_path = os.getenv("AI_ROOT_PATH", "/ai")
    uvicorn.run(app, host="0.0.0.0", port=port, root_path=root_path, reload=True)