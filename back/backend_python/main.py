import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes.captions import router as captions_router
from routes.hashtags import router as hashtags_router
from routes.media import router as media_router

load_dotenv()

# ---- Config ----
AI_ROOT_PATH = os.getenv("AI_ROOT_PATH", "/ai")  # external prefix via ALB
ENABLE_OPENAPI = os.getenv("AI_ENABLE_OPENAPI", "1") == "1"  # docs/schema toggle

app = FastAPI(
    title="Repostly AI Service",
    root_path=AI_ROOT_PATH,
    openapi_url="/openapi.json" if ENABLE_OPENAPI else None,
    docs_url="/docs" if ENABLE_OPENAPI else None,
    redoc_url="/redoc" if ENABLE_OPENAPI else None,
)

# ---- CORS ----
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://reelpostly.com",
        "https://www.reelpostly.com",
        "https://bigvideograb.com",
        "https://www.bigvideograb.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Static uploads ----
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ---- Routers (single mount; root_path=/ai makes them externally /ai/...) ----
# Existing mounts (internal paths)
app.include_router(captions_router, prefix="/api/v1/captions", tags=["captions"])
app.include_router(hashtags_router, prefix="/api/v1/hashtags", tags=["hashtags"])
app.include_router(media_router,    prefix="/api/v1",          tags=["media"])

# Mirror mounts (external /ai/* paths)
app.include_router(captions_router, prefix="/ai/api/v1/captions", tags=["captions"])
app.include_router(hashtags_router, prefix="/ai/api/v1/hashtags", tags=["hashtags"])
app.include_router(media_router,    prefix="/ai/api/v1",          tags=["media"])



# ---- Health ----
@app.get("/ping")
def ping():
    return {"status": "ok", "message": "AI service running"}

@app.get("/ai/ping")
def ai_ping():
    return {"status": "ok", "message": "AI service running"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5001))
    root_path = os.getenv("AI_ROOT_PATH", "/ai")
    uvicorn.run(app, host="0.0.0.0", port=port, root_path=root_path, reload=True)