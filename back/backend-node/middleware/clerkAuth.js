const { verifyToken } = require('@clerk/backend');

const clerkAuthMiddleware = async (req, res, next) => {
  try {
    console.log('=== CLERK AUTH DEBUG START ===');
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    
    const authHeader = req.headers.authorization;
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid auth header');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Token length:', token.length);
    console.log('Token preview:', token.substring(0, 20) + '...');
    console.log('Full token:', token);
    
    // Check for required environment variables
    const clerkSecretKey = process.env.CLERK_SECRET_KEY || process.env.CLERK_JWT_KEY;
    // Let Clerk SDK resolve issuer from token automatically
    const clerkIssuerUrl = process.env.CLERK_ISSUER_URL; // Optional - for fallback only
    // Don't enforce audience validation - use issuer + signature only
    const clerkAudience = null;
    
    console.log('Environment variables:');
    console.log('- CLERK_SECRET_KEY:', clerkSecretKey ? 'Set' : 'Not set');
    console.log('- CLERK_ISSUER_URL:', clerkIssuerUrl || 'Not set (will auto-resolve)');
    console.log('- CLERK_AUDIENCE:', clerkAudience);
    
    if (!clerkSecretKey) {
      console.log('❌ CLERK_SECRET_KEY not found');
      return res.status(500).json({ error: 'Clerk configuration missing' });
    }
    
    // Verify the token with Clerk
    console.log('Verifying token...');
    try {
      const verifyOptions = {
        jwtKey: clerkSecretKey,
        // Don't enforce audience validation - use issuer + signature only
      };
      
      // Only add issuer if explicitly set (let Clerk auto-resolve otherwise)
      if (clerkIssuerUrl) {
        verifyOptions.issuer = clerkIssuerUrl;
        console.log('Using explicit issuer URL:', clerkIssuerUrl);
      } else {
        console.log('Letting Clerk auto-resolve issuer from token');
      }
      
      const payload = await verifyToken(token, verifyOptions);

      console.log('✅ Token verified successfully');
      console.log('Payload:', {
        sub: payload.sub,
        email: payload.email,
        firstName: payload.first_name,
        lastName: payload.last_name
      });

      // Add user info to request
      req.user = {
        userId: payload.sub, // Clerk user ID
        email: payload.email,
        firstName: payload.first_name,
        lastName: payload.last_name,
      };

      console.log('✅ User added to request');
      console.log('=== CLERK AUTH DEBUG END ===');
      next();
    } catch (verifyError) {
      console.error('❌ Token verification failed:', verifyError);
      console.log('=== CLERK AUTH DEBUG END ===');
      return res.status(403).json({ error: 'Invalid token' });
    }
  } catch (error) {
    console.error('❌ Clerk auth error:', error);
    console.log('=== CLERK AUTH DEBUG END ===');
    return res.status(403).json({ error: 'Invalid token' });
  }
};

module.exports = { clerkAuthMiddleware };
