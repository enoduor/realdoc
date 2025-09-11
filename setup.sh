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
STRIPE_WEBHOOK_SECRET=whsec_27b01b4f639a932dc8ef8c1da131e5c2202c8d7d1e54744be7f31625b37e5a09
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

# 1. Make sure we're in the correct directory
cd /Users/mzmzma/Desktop/creatorsync

# 2. Initialize Git
git init

# 3. Add all files
git add .

# 4. Create initial commit
git commit -m "feat: Initial project structure and documentation"

# 5. Rename default branch to main
git branch -M main

# 6. Add the remote repository
git remote add origin git@github.com:enoduor/creatorsync.git

# 7. Push to GitHub
git push -u origin main

# 8. Create and push other branches
git checkout -b develop
git checkout -b staging
git checkout -b feature/auth
git checkout -b feature/ai-integration
git push -u origin develop
git push -u origin staging
git push -u origin feature/auth
git push -u origin feature/ai-integration 