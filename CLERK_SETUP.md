# Clerk Authentication Setup Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Create Clerk Account
1. Go to [https://clerk.com/](https://clerk.com/)
2. Click "Start building for free"
3. Create your account

### Step 2: Create New Application
1. Click "Add application"
2. Choose "Web application"
3. Name it "Repostly"
4. Select your preferred sign-in methods (Email, Google, GitHub, etc.)

### Step 3: Get Your Keys
1. Go to "API Keys" in your Clerk dashboard
2. Copy the **Publishable Key** (starts with `pk_test_`)

### Step 4: Configure Environment Variables

#### Frontend (.env file in frontend/ directory):
```bash
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_your_actual_key_here
REACT_APP_API_URL=http://localhost:4001
REACT_APP_AI_API=http://localhost:5001
```

#### Backend (.env file in back/backend-node/ directory):
```bash
CLERK_JWT_KEY=your_jwt_key_from_clerk_dashboard
CLERK_ISSUER_URL=https://clerk.your-app.com
CLERK_AUDIENCE=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/repostly
JWT_SECRET=your_jwt_secret_here
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
PORT=4001
```

### Step 5: Configure Allowed Origins
1. In Clerk dashboard, go to "Settings" → "Domains"
2. Add `http://localhost:3000` for development
3. Add your production domain when ready

### Step 6: Start the App
```bash
# Terminal 1: Start backend
cd back/backend-node && npm start

# Terminal 2: Start frontend
cd frontend && npm start
```

## 🎯 Features You Get with Clerk

### ✅ Built-in Security
- **Multifactor Authentication** (MFA)
- **Fraud & Abuse Prevention**
- **SOC 2 Type 2 Compliant**
- **Session Management**
- **Device Management**

### ✅ Social Sign-On
- Google, GitHub, Twitter, Facebook
- 20+ providers available
- Easy to add/remove

### ✅ User Management
- **Email Verification**
- **Password Reset**
- **Profile Management**
- **Organization Support** (for B2B)

### ✅ Developer Experience
- **Pre-built UI Components**
- **Customizable Styling**
- **TypeScript Support**
- **Webhooks**

## 🔧 Customization

### Styling
Edit `frontend/src/components/Auth/ClerkLogin.jsx` and `ClerkRegister.jsx` to match your brand:

```javascript
appearance={{
  elements: {
    formButtonPrimary: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md w-full',
    // Add more custom styles here
  }
}}
```

### Sign-in Methods
In Clerk dashboard:
1. Go to "User & Authentication" → "Email, Phone, Username"
2. Enable/disable sign-in methods
3. Configure social providers

## 🚀 Production Deployment

### Environment Variables
Update your production environment variables:
```bash
REACT_APP_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
CLERK_ISSUER_URL=https://clerk.your-production-domain.com
CLERK_AUDIENCE=https://your-production-domain.com
```

### Domains
Add your production domain to Clerk:
1. Go to "Settings" → "Domains"
2. Add your production domain
3. Update redirect URLs

## 🔍 Troubleshooting

### Common Issues

#### 1. "Invalid token" errors
- Check your `CLERK_JWT_KEY` is correct
- Verify `CLERK_ISSUER_URL` matches your Clerk instance
- Ensure `CLERK_AUDIENCE` matches your frontend URL

#### 2. CORS errors
- Add your frontend URL to Clerk's allowed origins
- Check your backend CORS configuration

#### 3. Redirect loops
- Verify redirect URLs in Clerk dashboard
- Check your route configuration

### Support
- [Clerk Documentation](https://clerk.com/docs)
- [Clerk Discord](https://discord.gg/clerk)
- [Clerk Support](https://clerk.com/support)

## 🎉 You're Ready!

Your app now has enterprise-grade authentication with:
- ✅ **Secure user management**
- ✅ **Social sign-on**
- ✅ **MFA support**
- ✅ **Fraud protection**
- ✅ **Production ready**

Next step: Add real social media APIs to complete your MVP! 🚀
