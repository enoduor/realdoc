# RealDoc

AI-powered documentation generator platform for creating comprehensive documentation for online applications.

## Directory Structure
```
├── frontend/
│   ├── src/
│   │   ├── api/          # API integration
│   │   ├── components/   # React components
│   │   ├── context/      # Context providers
│   │   └── styles/       # CSS styles
├── back/
│   ├── backend-node/
│   │   ├── routes/       # Express routes
│   │   ├── controllers/  # Route controllers
│   │   ├── models/       # MongoDB models
│   │   └── middleware/   # Express middleware
│   └── backend_python/
│       ├── routes/       # Flask routes
│       ├── services/     # AI services
│       └── utils/        # Utility functions
├── config/              # Environment configs
└── scripts/            # Utility scripts
```

## Setup Instructions
1. Run environment setup:
   ```bash
   ./scripts/setup-env.sh development
   ```

2. Start services:
   ```bash
   # Node.js backend
   cd back/backend-node
   npm install
   node index.js

   # Python backend
   cd back/backend_python
   source venv/bin/activate
   pip install -r requirements.txt
   python app.py

   # Frontend
   cd frontend
   npm install
   npm start
   ```

## Environment Variables
See `examples/.env.example` for required environment variables.

## API Documentation
- Authentication API (Port 4001)
  - POST /api/auth/register
  - POST /api/auth/login

- AI Services API (Port 5000)
  - POST /generate-caption

## Development
- Main branch: Production
- Develop branch: Development
- Feature branches: New features
