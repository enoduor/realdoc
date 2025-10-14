# Logging Guide - Production-Safe Logging

## Overview
Logs are automatically turned off in production to:
- Reduce console noise
- Improve performance
- Protect sensitive information
- Keep logs clean for debugging

## How It Works

Logs are controlled by environment variables:
- **Development**: All logs visible
- **Production**: Only errors visible

---

## Frontend Logging (React)

### Location
`frontend/src/utils/logger.js`

### Usage

**Before (console.log directly):**
```javascript
console.log('User data:', userData);
console.error('API Error:', error);
```

**After (using logger):**
```javascript
import logger from '../utils/logger';

logger.log('User data:', userData);      // OFF in production
logger.error('API Error:', error);       // ALWAYS on
logger.warn('Warning:', message);        // OFF in production
logger.info('Info:', data);              // OFF in production
logger.debug('Debug:', details);         // OFF in production
```

### When to Use Each Level

- `logger.log()` - General debugging (development only)
- `logger.error()` - Errors that need attention (always logged)
- `logger.warn()` - Warnings (development only)
- `logger.info()` - Informational messages (development only)
- `logger.debug()` - Detailed debugging (development only)

---

## Backend Logging (Node.js)

### Location
`back/backend-node/utils/logger.js`

### Usage

**Before:**
```javascript
console.log('Processing request:', req.body);
console.error('Database error:', err);
```

**After:**
```javascript
const logger = require('./utils/logger');

logger.log('Processing request:', req.body);  // OFF in production
logger.error('Database error:', err);          // ALWAYS on
```

---

## Backend Logging (Python)

### Location
`back/backend_python/utils/logger.py`

### Usage

**Before:**
```python
print(f'[Sora-2] Video ID: {video_id}')
print(f'Error: {error}')
```

**After:**
```python
from utils.logger import logger

logger.log(f'[Sora-2] Video ID: {video_id}')  # OFF in production
logger.error(f'Error: {error}')                # ALWAYS on
```

---

## Example Conversions

### Frontend Component
```javascript
// VideoGenerator.jsx
import logger from '../utils/logger';

const VideoGenerator = () => {
  const handleGenerate = async () => {
    logger.log('[Sora-2] Starting video generation');  // Development only
    
    try {
      const response = await fetch(url);
      logger.log('[Sora-2] Response:', response);      // Development only
    } catch (error) {
      logger.error('[Sora-2] Generation failed:', error); // Always logged
    }
  };
};
```

### Backend Route
```javascript
// soraApi.js
const logger = require('./utils/logger');

router.post('/credits/checkout', async (req, res) => {
  logger.log('Creating checkout session:', req.body);  // Development only
  
  try {
    const session = await stripe.checkout.sessions.create(params);
    logger.log('Session created:', session.id);        // Development only
  } catch (error) {
    logger.error('Stripe error:', error);              // Always logged
  }
});
```

### Python Backend
```python
# video_generation.py
from utils.logger import logger

@router.post("/generate-video")
async def generate_video(request: VideoGenerationRequest):
    logger.log(f"[Sora-2] Request: {request.prompt}")  # Development only
    
    try:
        result = await create_video()
        logger.log(f"[Sora-2] Success: {result}")      # Development only
    except Exception as e:
        logger.error(f"[Sora-2] Error: {e}")           # Always logged
```

---

## Environment Variables

### Frontend
Set in build process:
- Development: `NODE_ENV=development`
- Production: `NODE_ENV=production`

### Backend (Node.js)
Add to ECS environment:
- `NODE_ENV=production`

### Backend (Python)
Add to ECS environment:
- `NODE_ENV=production` or `ENVIRONMENT=production`

---

## Migration Strategy

### Option 1: Gradual (Recommended)
1. Import logger in new files
2. Replace console calls as you touch files
3. Leave existing logs alone for now

### Option 2: Bulk Replace
1. Find all console.log calls
2. Replace with logger.log
3. Test thoroughly

### Option 3: Global Override (Quick Fix)
Add to index.js/main.py:
```javascript
// Override console in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // Keep console.error and console.warn
}
```

---

## Current Status

✅ Logger utilities created:
- `frontend/src/utils/logger.js`
- `back/backend-node/utils/logger.js`
- `back/backend_python/utils/logger.py`

⏳ Logs not yet converted (still using console directly)

📋 To convert logs, import logger and replace console calls

---

## Testing

**Development:**
```bash
NODE_ENV=development npm start
# You'll see all logs
```

**Production:**
```bash
NODE_ENV=production npm start
# You'll only see errors
```

---

## Best Practices

1. **Always log errors** - Use `logger.error()` for exceptions
2. **Log sparingly** - Too many logs slow down development
3. **Use meaningful messages** - Include context
4. **Don't log sensitive data** - Passwords, API keys, tokens
5. **Use structured logging** - Include timestamps, request IDs

