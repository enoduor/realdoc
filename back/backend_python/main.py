from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routes.captions import router as captions_router
from routes.hashtags import router as hashtags_router
from routes.media import router as media_router
import os
from dotenv import load_dotenv

load_dotenv()

# Respect AI_ROOT_PATH env var (so ECS task can set /ai)
AI_ROOT_PATH = os.getenv("AI_ROOT_PATH", "/ai")

app = FastAPI(title="Repostly AI Service", root_path=AI_ROOT_PATH)


# CORS (allow dev + prod frontends)
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

# Ensure uploads dir always exists
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Routers
# Existing (internal) paths
app.include_router(captions_router, prefix="/api/v1/captions", tags=["captions"])
app.include_router(hashtags_router, prefix="/api/v1/hashtags", tags=["hashtags"])
app.include_router(media_router,    prefix="/api/v1",          tags=["media"])

# Mirror under /ai for ALB
app.include_router(captions_router, prefix="/ai/api/v1/captions", tags=["captions"])
app.include_router(hashtags_router, prefix="/ai/api/v1/hashtags", tags=["hashtags"])
app.include_router(media_router,    prefix="/ai/api/v1",          tags=["media"])

# Health check (works internally at /ping, externally at /ai/ping)
@app.get("/ping")
def ping():
    return {"status": "ok", "message": "AI service running"}

# Health check for ALB (external path /ai/ping)
@app.get("/ai/ping")
def ai_ping():
    return {"status": "ok", "message": "AI service running"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 5001))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)