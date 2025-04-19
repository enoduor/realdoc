from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import captions

app = FastAPI()

# CORS: Allow access from frontend + backend-node
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Update to specific domains in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic health check
@app.get("/ping")
def ping():
    return {"message": "Python AI service active"}

# Mount caption route
app.include_router(captions.router)