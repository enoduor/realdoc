# myContentAI

A full-stack social media automation tool with AI caption generation, multi-platform scheduling, analytics, and growth recommendations.

## Setup

1. Install dependencies:
    - `npm install` in `frontend` and `backend-node`
    - `pip install -r requirements.txt` in `backend-python`

2. Add `.env` files with:
    - MongoDB URI
    - Stripe keys
    - OpenAI API key

3. Run services:
    - Frontend on port 3000
    - Node backend on port 4000
    - FastAPI AI service on port 5000

# Check Node.js version
node --version

# Check Python version
python --version

# Check npm version
npm --version

# Check pip version
pip --version

MONGODB_URI=your_mongodb_uri
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLIC_KEY=your_stripe_public_key
PORT=4000

OPENAI_API_KEY=your_openai_api_key
PORT=5000
