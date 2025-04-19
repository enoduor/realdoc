from dotenv import load_dotenv
import os

# Load .env file from current folder
load_dotenv()

# ✅ Correct variable names
MONGODB_URI = os.getenv("MONGODB_URI")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLIC_KEY = os.getenv("STRIPE_PUBLIC_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
PORT = int(os.getenv("PORT", 5000))

# Optional debug
print("✅ MONGODB_URI:", MONGODB_URI)
print("✅ STRIPE_SECRET_KEY:", STRIPE_SECRET_KEY[:10] + "..." if STRIPE_SECRET_KEY else "None")
print("✅ OPENAI_API_KEY:", OPENAI_API_KEY[:10] + "..." if OPENAI_API_KEY else "None")