from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes.captions import router as captions_router
from routes.hashtags import router as hashtags_router
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="CreatorSync AI Service")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with unique prefixes
app.include_router(captions_router, prefix="/api/v1/captions", tags=["captions"])
app.include_router(hashtags_router, prefix="/api/v1/hashtags", tags=["hashtags"])

@app.get("/ping")
def ping():
    return {"status": "ok", "message": "AI service running"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True) 