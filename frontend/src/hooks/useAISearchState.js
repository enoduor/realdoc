// /frontend/src/hooks/useAISearchState.js
// Hook to handle AI Search state consumption after signup + subscription
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';

/**
 * useAISearchState - Custom hook to consume AI Search state after authentication
 * 
 * This hook:
 * 1. Checks if 'state' parameter exists in URL (indicates redirect from AI Search)
 * 2. Waits for user to be authenticated and have a subscription
 * 3. Calls backend to consume state (which forwards to Lambda)
 * 4. Redirects user back to AI Search using returnUrl from Lambda
 * 
 * @param {Object} options
 * @param {string} options.subscriptionId - Stripe subscription ID (optional, can be passed later)
 * @param {Function} options.onStateConsumed - Callback when state is successfully consumed
 * @param {Function} options.onError - Callback for errors
 * 
 * @returns {Object} { isProcessing, error, consumeState }
 */
export const useAISearchState = ({
  subscriptionId = null,
  onStateConsumed = null,
  onError = null
} = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [hasConsumed, setHasConsumed] = useState(false);

  // Get state from URL
  const state = searchParams.get('state');
  const returnUrl = searchParams.get('return_url'); // Optional: fallback return URL

  /**
   * Consume state by calling backend endpoint
   */
  const consumeState = async (providedSubscriptionId = null) => {
    // Guard: only run if state exists
    if (!state) {
      return { success: false, reason: 'No state parameter in URL' };
    }

    // Guard: user must be authenticated
    if (!isLoaded || !isSignedIn || !user) {
      return { success: false, reason: 'User not authenticated' };
    }

    const finalSubscriptionId = providedSubscriptionId || subscriptionId;

    try {
      setIsProcessing(true);
      setError(null);

      const response = await fetch(`${window.location.origin}/api/ai-search/consume-state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state,
          clerkUserId: user.id,
          subscriptionId: finalSubscriptionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      // Mark as consumed to prevent re-processing
      setHasConsumed(true);

      // Remove state from URL to prevent re-processing on re-renders
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('state');
      newParams.delete('return_url');
      setSearchParams(newParams, { replace: true });

      // Call success callback
      if (onStateConsumed) {
        onStateConsumed(data);
      }

      // Redirect to returnUrl from Lambda, or fallback to return_url param, or stay on current page
      const redirectUrl = data.returnUrl || returnUrl;
      if (redirectUrl) {
        console.log('🔄 Redirecting to AI Search:', redirectUrl);
        window.location.href = redirectUrl;
      }

      return { success: true, data };

    } catch (err) {
      const errorMessage = err.message || 'Failed to consume state';
      setError(errorMessage);
      
      if (onError) {
        onError(err);
      }

      console.error('❌ Error consuming AI Search state:', err);
      return { success: false, error: errorMessage };
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-consume when user is authenticated and subscription is available
  // This will be called after payment success
  useEffect(() => {
    // Only auto-consume if:
    // 1. State exists in URL
    // 2. User is authenticated
    // 3. Hasn't been consumed yet
    // 4. Not currently processing
    if (state && isLoaded && isSignedIn && user && !hasConsumed && !isProcessing) {
      // Note: We don't auto-consume here because we need subscriptionId
      // Instead, we'll call consumeState() manually after subscription is created
      // This effect just ensures we're ready
    }
  }, [state, isLoaded, isSignedIn, user, hasConsumed, isProcessing]);

  return {
    state,
    returnUrl,
    isProcessing,
    error,
    hasConsumed,
    consumeState,
    hasState: !!state
  };
};

export default useAISearchState;
