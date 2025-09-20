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

export const getPriceId = async (plan, billingCycle) => {
  try {
    const response = await fetch(`${API_URL}/api/stripe/get-price-id`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ plan, billingCycle })
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error getting price ID:', error);
    throw error;
  }
};

export const createSubscriptionSession = async (priceId) => {
  try {
    const response = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ priceId })
    });
    return await handleResponse(response);
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
