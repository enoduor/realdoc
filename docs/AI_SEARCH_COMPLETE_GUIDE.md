# AI Search Integration - Complete Guide

This document provides a comprehensive guide to the AI Search integration between `app.reelpostly.com` and `courses.reelpostly.com`, including subscription verification, state consumption, and session management.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture & Flow](#architecture--flow)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [API Endpoints](#api-endpoints)
6. [Session Management](#session-management)
7. [Configuration](#configuration)
8. [Testing](#testing)
9. [Security & Error Handling](#security--error-handling)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The AI Search integration allows users to:
- Access AI Search on `courses.reelpostly.com`
- Hit a free search limit and be redirected to subscribe
- Complete subscription on `app.reelpostly.com`
- Return to AI Search with unlimited access

**Key Components:**
- **Backend:** Node.js API (`back/backend-node/routes/aiSearchState.js`)
- **Frontend:** React hooks and components
- **Session Management:** HttpOnly cookies with MongoDB persistence
- **Subscription Verification:** Real-time checks via API

---

## Architecture & Flow

### Complete User Journey

```
┌─────────────────────┐
│  AI Search          │
│ courses.reel...   │
└──────────┬──────────┘
           │
           │ 1. User hits limit
           ▼
┌─────────────────────┐
│  Redirect to        │
│  app.reelpostly.com │
│  ?state=TOKEN&      │
│  return_url=...     │
└──────────┬──────────┘
           │
           │ 2. User signs up + subscribes
           ▼
┌─────────────────────┐
│  Payment Success    │
│  State Consumed     │
│  Session Created    │
└──────────┬──────────┘
           │
           │ 3. Redirect with clerkUserId
           ▼
┌─────────────────────┐
│  AI Search          │
│  Verifies Session   │
│  Grants Access      │
└─────────────────────┘
```

### Flow Details

**Scenario 1: New User Hits Limit**
1. User visits `courses.reelpostly.com/ux/advisor.html`
2. User performs free search (limit reached)
3. AI Search redirects: `https://app.reelpostly.com/?state=TOKEN&return_url=https://courses.reelpostly.com/ux/advisor.html`
4. User signs up with Clerk
5. User completes Stripe subscription
6. `PaymentModal` detects `state` parameter
7. Calls `POST /api/ai-search/consume-state` with `{ state, clerkUserId, subscriptionId }`
8. Backend creates session, sets cookie, forwards to Lambda
9. Lambda records mapping, returns `returnUrl`
10. Backend appends `clerkUserId` to `returnUrl`
11. User redirected to: `courses.reelpostly.com/ux/advisor.html?clerkUserId=user_abc123`
12. AI Search verifies subscription → Unlimited access ✅

**Scenario 2: Returning Subscribed User**
1. User visits `courses.reelpostly.com/ux/advisor.html`
2. AI Search calls `GET /api/ai-search/verify-session` (with cookie)
3. Backend validates session, checks subscription
4. Returns `hasActiveSubscription: true`
5. AI Search grants unlimited access ✅

**Scenario 3: Fallback to URL Parameter**
1. User visits with `?clerkUserId=user_abc123` (no cookie)
2. AI Search calls `GET /api/ai-search/verify-subscription?clerkUserId=user_abc123`
3. Backend checks MongoDB for subscription
4. Returns subscription status
5. AI Search grants/denies access accordingly

---

## Backend Implementation

### File Structure

```
back/backend-node/
├── routes/
│   └── aiSearchState.js          # Main route handlers
├── models/
│   ├── User.js                   # User model (subscription status)
│   └── AiSearchSession.js        # Session model (TTL expiry)
└── index.js                      # Route registration
```

### Models

#### AiSearchSession Model

**File:** `back/backend-node/models/AiSearchSession.js`

```javascript
{
  sessionId: String (unique, indexed),
  clerkUserId: String (indexed),
  subscriptionId: String (optional),
  createdAt: Date,
  expiresAt: Date (TTL index)
}
```

**TTL:** Automatic expiry via MongoDB TTL index (default: 7 days)

#### User Model

**File:** `back/backend-node/models/User.js`

**Subscription Status Check:**
```javascript
UserSchema.methods.hasActiveSubscription = function () {
  return this.subscriptionStatus === 'active' || 
         this.subscriptionStatus === 'trialing' || 
         this.isTrialActive();
};
```

**Status Values:**
- `"none"` - No subscription
- `"active"` - Active paid subscription
- `"trialing"` - In trial period
- `"past_due"` - Payment failed, subscription still active
- `"canceled"` - Subscription canceled
- `"unpaid"` - Payment failed, subscription inactive
- `"incomplete"` - Checkout incomplete
- `"incomplete_expired"` - Checkout expired
- `"paused"` - Subscription paused

### Route Registration

**File:** `back/backend-node/index.js` (line 123)

```javascript
app.use("/api", require("./routes/aiSearchState"));
```

---

## Frontend Implementation

### Hook: useAISearchState

**File:** `frontend/src/hooks/useAISearchState.js`

**Purpose:** Handle state consumption after authentication

**Usage:**
```javascript
const { consumeState, hasState, isProcessing, error } = useAISearchState({
  onStateConsumed: (data) => console.log('State consumed:', data),
  onError: (err) => console.error('Error:', err)
});
```

**Features:**
- Checks for `state` parameter in URL
- Waits for user authentication
- Provides `consumeState(subscriptionId)` function
- Automatically redirects using `returnUrl`

### Component Integration: PaymentModal

**File:** `frontend/src/components/PaymentModal.jsx`

**Integration Point:** After payment verification succeeds

**Code:**
```javascript
// After payment verification
if (hasState && subscriptionId) {
  await consumeState(subscriptionId);
  // consumeState handles redirect automatically
}
```

---

## API Endpoints

### 1. POST /api/ai-search/consume-state

**Purpose:** Consume state token after subscription, create session

**Request Body:**
```json
{
  "state": "state-token-from-url",
  "clerkUserId": "user_abc123",
  "subscriptionId": "sub_xyz789"
}
```

**Response:**
```json
{
  "success": true,
  "returnUrl": "https://courses.reelpostly.com/ux/advisor.html?clerkUserId=user_abc123"
}
```

**What It Does:**
1. Validates `state` and `clerkUserId`
2. Forwards to Lambda: `POST {LAMBDA_URL}/state/consume`
3. Creates MongoDB session with TTL
4. Sets HttpOnly cookie `ai_search_session`
5. Appends `clerkUserId` to `returnUrl` (if not present)
6. Returns modified `returnUrl`

**Cookie Settings:**
- `httpOnly: true`
- `secure: true` (production)
- `sameSite: "Lax"`
- `domain: ".reelpostly.com"` (production)
- `maxAge: 7 days` (configurable via `AI_SEARCH_SESSION_TTL_DAYS`)

### 2. GET /api/ai-search/verify-session

**Purpose:** Verify session via HttpOnly cookie (primary method)

**Request:** Cookie: `ai_search_session=sessionId`

**Response (Valid Session):**
```json
{
  "success": true,
  "hasActiveSubscription": true,
  "subscriptionStatus": "active",
  "subscriptionId": "sub_abc123",
  "clerkUserId": "user_xyz789",
  "email": "user@example.com"
}
```

**Response (No Session/Expired):**
```json
{
  "success": true,
  "hasActiveSubscription": false,
  "subscriptionStatus": "none",
  "subscriptionId": null
}
```

**What It Does:**
1. Reads `ai_search_session` cookie
2. Validates session in MongoDB
3. Checks expiry
4. Looks up user subscription
5. Returns subscription status

### 3. GET /api/ai-search/verify-subscription

**Purpose:** Verify subscription via `clerkUserId` (fallback method)

**Query Parameters:**
- `clerkUserId` (required)

**Request:**
```
GET /api/ai-search/verify-subscription?clerkUserId=user_abc123
```

**Response (Subscribed):**
```json
{
  "success": true,
  "hasActiveSubscription": true,
  "subscriptionStatus": "active",
  "subscriptionId": "sub_xyz789",
  "billingCycle": "monthly",
  "clerkUserId": "user_abc123",
  "email": "user@example.com"
}
```

**Response (Not Subscribed):**
```json
{
  "success": true,
  "hasActiveSubscription": false,
  "subscriptionStatus": "none",
  "subscriptionId": null,
  "billingCycle": "none"
}
```

---

## Session Management

### Session Creation

**When:** After successful subscription and state consumption

**Where:** `POST /api/ai-search/consume-state`

**Process:**
1. Generate UUID session ID
2. Calculate expiry (default: 7 days)
3. Store in MongoDB with TTL index
4. Set HttpOnly cookie

### Session Validation

**When:** On every AI Search page load

**Where:** `GET /api/ai-search/verify-session`

**Process:**
1. Read cookie from request
2. Query MongoDB for session
3. Check expiry
4. Look up user subscription
5. Return status

### Session Expiry

- **TTL Index:** MongoDB automatically deletes expired sessions
- **Cookie Expiry:** Browser removes cookie after `maxAge`
- **Manual Cleanup:** Backend clears cookie if session expired

---

## Configuration

### Environment Variables

**Backend (`back/backend-node/.env`):**
```bash
# Required
AI_SEARCH_LAMBDA_API_URL=https://YOUR_API_ID.execute-api.us-west-2.amazonaws.com/prod

# Optional
AI_SEARCH_SESSION_TTL_DAYS=7
AI_SEARCH_API_KEY=your-api-key-here  # If Lambda requires API key
```

### CORS Configuration

**File:** `back/backend-node/index.js`

**Allowed Origins:**
```javascript
origin: [
  'https://app.reelpostly.com',
  'https://courses.reelpostly.com',  // AI Search domain
  // ... other domains
],
credentials: true  // Required for cookies
```

### AWS ECS Configuration

**File:** `deployment/terraform/ecs.tf`

Add environment variable to task definition:
```terraform
{
  name  = "AI_SEARCH_LAMBDA_API_URL"
  value = "https://YOUR_API_ID.execute-api.us-west-2.amazonaws.com/prod"
}
```

Or use AWS Systems Manager Parameter Store:
```terraform
{
  name      = "AI_SEARCH_LAMBDA_API_URL"
  valueFrom = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/${var.project_name}/ai-search-lambda-api-url"
}
```

### Dependencies

**Required Package:**
```json
{
  "cookie": "^0.6.0"
}
```

**Install:**
```bash
cd back/backend-node
npm install cookie
```

---

## Testing

### Local Testing

**1. Start Backend:**
```bash
cd back/backend-node
npm start
```

**2. Start Frontend:**
```bash
cd frontend
npm start
```

**3. Test State Consumption:**
```bash
curl -X POST http://localhost:4001/api/ai-search/consume-state \
  -H "Content-Type: application/json" \
  -d '{
    "state": "test-token",
    "clerkUserId": "user_123",
    "subscriptionId": "sub_456"
  }'
```

**4. Test Session Verification:**
```bash
curl -X GET http://localhost:4001/api/ai-search/verify-session \
  -H "Cookie: ai_search_session=test-session-id"
```

**5. Test Subscription Verification:**
```bash
curl "http://localhost:4001/api/ai-search/verify-subscription?clerkUserId=user_123"
```

### Production Testing

**1. Test CORS:**
Open browser console on `courses.reelpostly.com`:
```javascript
fetch('https://app.reelpostly.com/api/ai-search/verify-session', {
  credentials: 'include'
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**2. End-to-End Flow:**
1. Visit `courses.reelpostly.com/ux/advisor.html`
2. Hit search limit
3. Complete signup + subscription
4. Verify redirect back with `clerkUserId`
5. Verify unlimited access

---

## Security & Error Handling

### Security Considerations

**1. State Token Validation:**
- Lambda validates state token (expiry, signature)
- Backend only forwards, doesn't validate
- State tokens should be single-use

**2. Session Security:**
- HttpOnly cookies prevent XSS attacks
- Secure flag in production (HTTPS only)
- SameSite: Lax prevents CSRF
- Domain: `.reelpostly.com` for subdomain sharing

**3. Rate Limiting:**
- Existing rate limiter applies to all endpoints
- Lambda should also implement rate limiting

**4. CORS:**
- Explicitly allows `courses.reelpostly.com`
- `credentials: true` for cookie support

### Error Handling

**Backend Errors:**

| Error | Status | Response |
|-------|--------|----------|
| Missing state/clerkUserId | 400 | `{ error: "Missing required fields" }` |
| Lambda timeout | 504 | `{ error: "Request timed out" }` |
| Lambda error | 500+ | Lambda's error response |
| Database error | 500 | `{ error: "Failed to verify" }` |

**Frontend Errors:**

- **State consumption fails:** Logs error, doesn't block user (payment succeeded)
- **No state parameter:** Hook does nothing (normal flow)
- **User not authenticated:** Hook waits for authentication

**AI Search Error Handling:**

- **Verification fails:** Default to limited access (safer)
- **User not found:** Treat as no subscription
- **Network error:** Retry with exponential backoff

---

## Troubleshooting

### State Not Being Consumed

**Symptoms:**
- User completes subscription but doesn't redirect
- `state` parameter remains in URL

**Checks:**
1. Verify `state` parameter exists in URL
2. Check browser console for errors
3. Verify `PaymentModal` calls `consumeState()`
4. Check backend logs for Lambda request/response
5. Verify `AI_SEARCH_LAMBDA_API_URL` is set

### Session Not Working

**Symptoms:**
- Cookie not set after subscription
- `verify-session` returns no subscription

**Checks:**
1. Verify cookie is set (check browser DevTools)
2. Check cookie domain matches (`.reelpostly.com`)
3. Verify MongoDB session exists
4. Check session expiry time
5. Verify CORS allows credentials

### Redirect Not Happening

**Symptoms:**
- State consumed but user stays on same page

**Checks:**
1. Verify Lambda returns `returnUrl`
2. Check `consumeState()` is called
3. Verify `returnUrl` includes `clerkUserId`
4. Check browser console for redirect errors
5. Verify `window.location.href` assignment

### Subscription Verification Fails

**Symptoms:**
- AI Search shows limited access for subscribed users

**Checks:**
1. Verify `clerkUserId` is passed correctly
2. Check MongoDB for user record
3. Verify subscription status in Stripe
4. Check `hasActiveSubscription()` logic
5. Verify API endpoint is accessible

### CORS Errors

**Symptoms:**
- Browser console shows CORS errors
- Requests fail with preflight errors

**Checks:**
1. Verify `courses.reelpostly.com` in CORS origins
2. Check `credentials: true` is set
3. Verify `Access-Control-Allow-Credentials` header
4. Check preflight OPTIONS requests are handled

---

## Implementation Checklist

### Backend
- ✅ `AiSearchSession` model created with TTL
- ✅ `POST /api/ai-search/consume-state` endpoint
- ✅ `GET /api/ai-search/verify-session` endpoint
- ✅ `GET /api/ai-search/verify-subscription` endpoint
- ✅ Cookie parsing and setting
- ✅ Route registered in `index.js`
- ✅ CORS configured for `courses.reelpostly.com`
- ✅ `cookie` package installed

### Frontend
- ✅ `useAISearchState` hook created
- ✅ `PaymentModal` integration
- ✅ State consumption after payment success
- ✅ Automatic redirect handling

### Configuration
- ⚠️ `AI_SEARCH_LAMBDA_API_URL` environment variable
- ⚠️ AWS ECS task definition updated
- ⚠️ Lambda endpoint `/state/consume` implemented

### AI Search Side (courses.reelpostly.com)
- ⚠️ Call `GET /api/ai-search/verify-session` with `credentials: 'include'`
- ⚠️ Fallback to `GET /api/ai-search/verify-subscription?clerkUserId=...`
- ⚠️ Extract `clerkUserId` from URL parameter if needed
- ⚠️ Grant/deny access based on `hasActiveSubscription`

---

## Files Reference

### Created Files
- `back/backend-node/routes/aiSearchState.js` - Route handlers
- `back/backend-node/models/AiSearchSession.js` - Session model
- `frontend/src/hooks/useAISearchState.js` - Frontend hook

### Modified Files
- `back/backend-node/index.js` - Route registration, CORS
- `back/backend-node/routes/seo-payment.js` - Added `subscriptionId` to response
- `frontend/src/components/PaymentModal.jsx` - State consumption integration
- `back/backend-node/package.json` - Added `cookie` dependency

---

## Summary

**Complete Flow:**
1. User hits limit → Redirected to `app.reelpostly.com` with `state` token
2. User subscribes → State consumed → Session created → Cookie set
3. User redirected → AI Search verifies session → Unlimited access ✅

**Key Features:**
- HttpOnly cookie-based sessions (secure)
- MongoDB TTL for automatic cleanup
- Fallback to URL parameter verification
- Real-time subscription status checks
- Seamless user experience

**Next Steps:**
1. Configure `AI_SEARCH_LAMBDA_API_URL` in production
2. Implement AI Search frontend verification calls
3. Test end-to-end flow
4. Monitor logs and errors
