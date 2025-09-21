const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4001";
const AI_API_URL = process.env.REACT_APP_PYTHON_API_URL || "http://localhost:5000";

// Helper function to get auth headers
const getAuthHeaders = async () => {
  let token = null;
  try {
    // Get token from Clerk session
    if (window.Clerk && window.Clerk.session) {
      token = await window.Clerk.session.getToken();
    }
  } catch (error) {
    console.error('Error getting Clerk token:', error);
  }
  
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

export const login = async (email, password) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

export const register = async (email, password) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const getCaption = async (text) => {
  try {
    const response = await fetch(`${AI_API_URL}/api/captions/generate`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ text })
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Caption generation error:', error);
    throw error;
  }
};

export const createOrLinkClerkUser = async (clerkUserId, email) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/create-clerk-user`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        clerkUserId,
        email
      })
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error creating/linking Clerk user:', error);
    throw error;
  }
};

export const checkSubscriptionStatus = async (clerkUserId) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/subscription-status`, {
      method: 'GET',
      headers: await getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error checking subscription status:', error);
    throw error;
  }
};

export const checkSubscriptionByEmail = async (email) => {
  try {
    const response = await fetch(`${API_URL}/api/stripe/subscription-by-email/${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: await getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error checking subscription by email:', error);
    throw error;
  }
};

export const publishNow = async (postData) => {
  try {
    const response = await fetch(`${API_URL}/api/publisher/publish`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(postData)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error publishing post:', error);
    throw error;
  }
};

export async function getPriceId(plan, cycle) {
  const r = await fetch(`${API_URL}/api/billing/get-price-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, cycle })
  });
  if (!r.ok) {
    let errorData;
    try {
      errorData = await r.json();
    } catch {
      const txt = await r.text();
      throw new Error(`getPriceId: ${r.status} ${txt}`);
    }
    
    // Enhanced error message for missing price IDs
    if (r.status === 400 && errorData.varName) {
      throw new Error(`Pricing configuration error: ${errorData.error}. Please contact support.`);
    }
    
    throw new Error(`getPriceId: ${r.status} ${errorData.error || 'Unknown error'}`);
  }
  return r.json(); // { priceId }
}

export async function getCheckoutSession(sessionId) {
  const res = await fetch(`${API_URL}/api/billing/checkout-session?session_id=${sessionId}`);
  if (!res.ok) throw new Error("Failed to fetch checkout session");
  return res.json();
}

export const createSubscriptionSession = async (priceId, { clerkUserId, plan, billingCycle, promoCode } = {}) => {
  try {
    // Creating subscription session (logging removed for security)

    const response = await fetch(`${API_URL}/api/billing/create-checkout-session`, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, clerkUserId, plan, billingCycle, promoCode })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating subscription session:', error);
    throw error;
  }
};

// Get user's daily usage status
export const getUserUsageStatus = async () => {
  try {
    const response = await fetch(`${API_URL}/api/publisher/usage/status`, {
      method: 'GET',
      headers: await getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error getting usage status:', error);
    throw error;
  }
};
