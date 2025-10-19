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

export const createOrLinkClerkUser = async (user) => {
  try {
    const payload = {
      clerkUserId: user?.id, // ✅ include Clerk user id for server-side linking
      email: user?.primaryEmailAddress?.emailAddress,
      firstName: user?.firstName,
      lastName: user?.lastName
    };

    const response = await fetch(`${API_URL}/api/auth/sync-user`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error syncing user:', error);
    throw error;
  }
};

export const checkSubscriptionStatus = async (clerkUserId) => {
  try {
    const qs = clerkUserId ? `?clerkUserId=${encodeURIComponent(clerkUserId)}` : "";
    const response = await fetch(`${API_URL}/api/auth/subscription-status${qs}`, {
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
    // Check if request is from Sora Videos Dashboard flow
    const isSoraFlow = localStorage.getItem('preferredDashboard') === 'sora';
    
    // Add Sora flow flag to post data
    const dataWithFlow = {
      ...postData,
      soraFlow: isSoraFlow
    };
    
    const response = await fetch(`${API_URL}/api/publisher/publish`, {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify(dataWithFlow)
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error publishing post:', error);
    throw error;
  }
};

export async function getPriceId(plan, cycle) {
  const r = await fetch(`${API_URL}/api/stripe/get-price-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan, billingCycle: cycle })
  });

  // Read ONCE
  const text = await r.text();
  const isJson = (r.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? JSON.parse(text) : text;

  if (!r.ok) {
    // Enhanced error message for missing price IDs
    if (r.status === 400 && typeof data === "object" && data.varName) {
      throw new Error(`Pricing configuration error: ${data.error}. Please contact support.`);
    }
    
    throw new Error(`getPriceId: ${r.status} ${typeof data === "string" ? data : data?.error || 'Unknown error'}`);
  }
  return data; // { priceId }
}

export async function getCheckoutSession(sessionId) {
  const res = await fetch(`${API_URL}/api/stripe/subscription-by-session/${sessionId}`);
  
  // Read ONCE
  const text = await res.text();
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const data = isJson ? JSON.parse(text) : text;

  if (!res.ok) {
    throw new Error(typeof data === "string" ? data : data?.error || "Failed to fetch checkout session");
  }
  return data;
}

export const createSubscriptionSession = async (priceId, { clerkUserId, plan, billingCycle, promoCode, email } = {}) => {
  try {
    const res = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, clerkUserId, plan, billingCycle, promoCode, email }),
    });

    // Read ONCE
    const text = await res.text();
    const isJson = (res.headers.get("content-type") || "").includes("application/json");
    const data = isJson ? JSON.parse(text) : text;

    if (!res.ok) {
      throw new Error(typeof data === "string" ? data : data?.error || res.statusText);
    }
    return data; // { url, sessionId }
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
