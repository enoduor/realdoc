const { verifyToken } = require('@clerk/backend');

const clerkAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Verify the token with Clerk
    const payload = await verifyToken(token, {
      jwtKey: process.env.CLERK_JWT_KEY,
      issuer: process.env.CLERK_ISSUER_URL,
      audience: process.env.CLERK_AUDIENCE || 'http://localhost:3000',
    });

    // Add user info to request
    req.user = {
      userId: payload.sub, // Clerk user ID
      email: payload.email,
      firstName: payload.first_name,
      lastName: payload.last_name,
    };

    next();
  } catch (error) {
    console.error('Clerk auth error:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = { clerkAuthMiddleware };
