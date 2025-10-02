#!/bin/bash

echo "🛠️ Setting up environment files for all services..."

# Create directories if they don't exist
mkdir -p back/backend-node
mkdir -p back/backend_python
mkdir -p frontend

# Backend Node
echo "➡️  Creating .env in back/backend-node/"
cat <<EOF > back/backend-node/.env
MONGODB_URI=mongodb+srv://appuser:mghFD0EJinvc8vHo@creatorsync.bzk8vmo.mongodb.net/?retryWrites=true&w=majority&appName=creatorsync
STRIPE_SECRET_KEY=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
STRIPE_PUBLIC_KEY=pk_live_51RCMFRLPiEjYBNcQYp0Czn3uE51AnrqeUnw3S36BKi5G5Nwj1AU2yXFFvG750PE8VeZHhORAtEVubkMdjUzOCd8A003seIy7Nl
STRIPE_WEBHOOK_SECRET=whsec_AEGPWx9FIPhbThrYGAlDvKbARfD32Uec
JWT_SECRET=mysecretkey
PORT=4001
EOF
echo "✅ back/backend-node/.env created"

# Backend Python
echo "➡️  Creating .env in back/backend_python/"
cat <<EOF > back/backend_python/.env
OPENAI_API_KEY=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
PORT=5000
EOF
echo "✅ back/backend_python/.env created"

# Frontend (React)
echo "➡️  Creating .env in frontend/"
cat <<EOF > frontend/.env
REACT_APP_API_URL=http://localhost:4001
REACT_APP_AI_API=http://localhost:5000
REACT_APP_STRIPE_PUBLIC_KEY=pk_live_51RCMFRLPiEjYBNcQYp0Czn3uE51AnrqeUnw3S36BKi5G5Nwj1AU2yXFFvG750PE8VeZHhORAtEVubkMdjUzOCd8A003seIy7Nl
EOF
echo "✅ frontend/.env created"

echo "🎉 All .env files set up! You're good to go."

# Navigate to project root
cd /Users/mzmzma/Desktop/creatorsync

# Create .gitignore
cat <<EOF > .gitignore
# Environment files
.env
.env.*
!.env.example
config/.env.*
!config/.env.example

# Dependencies
node_modules/
venv/
__pycache__/
*.pyc

# Build files
/frontend/build/
/frontend/dist/
*.log

# IDE and Editor files
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Testing
/coverage
.nyc_output
.pytest_cache/

# Temporary files
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local development
.local
*.local

# Production
/build
/dist

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local
EOF

# Create example environment file
cat <<EOF > config/.env.example
# Node Backend
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
JWT_SECRET=your_jwt_secret
NODE_PORT=4001

# Python Backend
OPENAI_API_KEY=your_openai_api_key
PYTHON_PORT=5000

# Frontend
REACT_APP_API_URL=http://localhost:4001
REACT_APP_AI_API=http://localhost:5000
REACT_APP_STRIPE_PUBLIC_KEY=pk_test_your_stripe_public_key
EOF

# Initialize Git repository
git init

# Make initial commit
git add .gitignore config/.env.example
git commit -m "Initial commit: Add .gitignore and environment example"

# Create development branches
git branch develop
git branch feature/auth
git branch feature/ai-integration

# Switch to develop branch
git checkout develop

# Create new feature branch
git checkout -b feature/new-feature develop

# Merge feature into develop
git checkout develop
git merge --no-ff feature/new-feature

# Merge develop into main for release
git checkout main
git merge --no-ff develop

# 1. Ensure we're in the root directory
cd /Users/mzmzma/Desktop/creatorsync

# 2. Create/update main project directories
mkdir -p frontend/src/{components,context,api,styles}
mkdir -p back/backend-node/{routes,controllers,models,middleware}
mkdir -p back/backend_python/{routes,services,utils}
mkdir -p config
mkdir -p scripts

# 3. Update existing files and create necessary new ones
# Frontend structure
cat <<EOF > frontend/src/api/index.js
const API_URL = "http://localhost:4001";
const AI_API_URL = "http://localhost:5000";

export const login = async (email, password) => {
    // ... existing login code
};

export const register = async (email, password) => {
    // ... existing register code
};

export const getCaption = async (text) => {
    // ... existing getCaption code
};
EOF

# Update AuthContext
cat <<EOF > frontend/src/context/AuthContext.js
// ... existing AuthContext code
EOF

# Create main README
cat <<EOF > README.md
# CreatorSync

AI-powered content creation assistant platform.

## Directory Structure
\`\`\`
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
\`\`\`

## Setup Instructions
1. Run environment setup:
   \`\`\`bash
   ./scripts/setup-env.sh development
   \`\`\`

2. Start services:
   \`\`\`bash
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
   \`\`\`

## Environment Variables
See \`examples/.env.example\` for required environment variables.

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
EOF

# Create scripts README
cat <<EOF > scripts/README.md
# Utility Scripts

## setup-env.sh
Sets up environment files for all services.

Usage:
\`\`\`bash
./setup-env.sh [development|staging|production]
\`\`\`
EOF

echo "✅ File structure updated!"
echo "Would you like to commit these changes to Git?"

# 4. Initialize Git repository
git init

# 5. Add and commit files
git add .
git commit -m "feat: Initial project structure and documentation"

# 6. Create and switch to main branch
git branch -M main

# 7. Create other branches
git checkout -b develop main
git checkout -b staging develop
git checkout -b feature/auth develop
git checkout -b feature/ai-integration develop
git checkout -b feature/user-dashboard develop

# 8. Return to develop branch
git checkout develop

# 9. Show status
echo "\n✅ Git repository initialized with branches:"
git branch
echo "\nCurrent branch: $(git branch --show-current)"
echo "\n✅ Project structure created and Git initialized!"

# 10. Show next steps
echo "\n📝 Next steps:"
echo "1. Create a GitHub repository"
echo "2. Add remote: git remote add origin <repository-url>"
echo "3. Push all branches: git push -u origin --all" 