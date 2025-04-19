from fastapi import APIRouter, Request
from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

router = APIRouter()

# Initialize OpenAI client with API key
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
print("✅ OPENAI key loaded:", OPENAI_API_KEY[:8] if OPENAI_API_KEY else "❌ Not found")

client = OpenAI(api_key=OPENAI_API_KEY)

# Caption generation route
@router.post("/generate-caption")
async def generate_caption(request: Request):
    data = await request.json()
    prompt = data.get("text", "")

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        return {"caption": response.choices[0].message.content}
    except Exception as e:
        print("❌ OpenAI error:", str(e))
        return {"error": str(e)}