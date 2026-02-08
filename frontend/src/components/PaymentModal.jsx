import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ErrorModal from './ErrorModal';
import { useAISearchState } from '../hooks/useAISearchState';

/**
 * usePaymentModal - Custom hook for handling Stripe payment flow
 * 
 * @param {Object} options
 * @param {Function} options.onPaymentSuccess - Callback when payment is verified and successful. Receives (formData) as parameter
 * @param {Function} options.onPaymentError - Optional callback for payment errors. Receives (error) as parameter
 * @param {Function} options.validateForm - Optional function to validate form data before creating checkout. Returns { valid: boolean, error?: string }
 * @param {Object} options.formData - Form data to store in Stripe metadata
 * @param {string} options.successRedirectPath - Path to redirect to after successful payment (default: current path)
 * @param {string} options.cancelRedirectPath - Path to redirect to after cancelled payment (default: current path)
 * @param {string} options.apiEndpoint - API endpoint for creating checkout session (default: '/api/seo-payment/create-checkout-session')
 * @param {string} options.verifyEndpoint - API endpoint for verifying session (default: '/api/seo-payment/verify-session')
 * 
 * @returns {Object} { createCheckoutSession, loading, errorModal, setErrorModal, ErrorModalComponent }
 */
export const usePaymentModal = ({
    onPaymentSuccess,
    onPaymentError,
    validateForm,
    formData,
    successRedirectPath,
    cancelRedirectPath,
    apiEndpoint = '/api/seo-payment/create-checkout-session',
    verifyEndpoint = '/api/seo-payment/verify-session'
}) => {
    const [searchParams] = useSearchParams();
    const [errorModal, setErrorModal] = useState({ 
        show: false, 
        title: '', 
        message: '', 
        type: 'error'
    });
    const [loading, setLoading] = useState(false);
    const [verifiedSubscriptionId, setVerifiedSubscriptionId] = useState(null);

    // ============================================================================
    // ORIGINAL PAYMENT FLOW - Handle payment success and verify
    // ============================================================================
    useEffect(() => {
        const sessionId = searchParams.get('session_id');
        const paymentStatus = searchParams.get('payment');
        
        if (sessionId && paymentStatus === 'success') {
            // We compute redirect path once so we can always clean the URL
            const redirectPath = successRedirectPath || window.location.pathname;

            // Verify payment and call success callback
            const verifyAndProcess = async () => {
                try {
                    setLoading(true);
                    
                    // Verify payment
                    const verifyResponse = await fetch(`${window.location.origin}${verifyEndpoint}/${sessionId}`);
                    if (!verifyResponse.ok) {
                        throw new Error('Payment verification failed');
                    }
                    
                    const { formData: savedFormData, paid, subscriptionId } = await verifyResponse.json();
                    
                    if (!paid) {
                        throw new Error('Payment not completed');
                    }
                    
                    // Call success callback with saved form data
                    if (onPaymentSuccess) {
                        await onPaymentSuccess(savedFormData);
                    }
                    
                    // Store subscription ID for AI Search integration (if needed)
                    if (subscriptionId) {
                        setVerifiedSubscriptionId(subscriptionId);
                    }
                    
                    // Clean URL so we don't keep re-verifying on re-renders
                    window.history.replaceState({}, '', redirectPath);
                } catch (err) {
                    const errorMessage = err?.message || 'Failed to verify payment';
                    setErrorModal({
                        show: true,
                        title: 'Payment Verification Failed',
                        message: errorMessage,
                        type: 'error'
                    });
                    if (onPaymentError) {
                        onPaymentError(err);
                    }
                    // Even on error, clear the URL query so we don't spam verification
                    const redirectPath = successRedirectPath || window.location.pathname;
                    window.history.replaceState({}, '', redirectPath);
                } finally {
                    setLoading(false);
                }
            };
            
            verifyAndProcess();
        } else if (paymentStatus === 'cancelled') {
            setErrorModal({
                show: true,
                title: 'Payment Cancelled',
                message: 'Payment was cancelled. Please try again when you are ready.',
                type: 'info'
            });
            const redirectPath = cancelRedirectPath || window.location.pathname;
            window.history.replaceState({}, '', redirectPath);
        }
    }, [searchParams, onPaymentSuccess, onPaymentError, successRedirectPath, cancelRedirectPath, verifyEndpoint]);

    // ============================================================================
    // AI SEARCH INTEGRATION - Consume state after payment success
    // ============================================================================
    // This section handles AI Search redirects (only runs if state param exists)
    // It's kept separate from the main payment flow for clarity
    const { consumeState, hasState } = useAISearchState({
        onStateConsumed: (data) => {
            console.log('✅ AI Search state consumed successfully:', data);
            // State consumption will handle redirect automatically
        },
        onError: (err) => {
            console.error('❌ AI Search state consumption error:', err);
            // Don't show error modal for AI Search - it's optional
            // Payment was successful, just state consumption failed
        }
    });

    // Consume AI Search state after subscription is verified
    useEffect(() => {
        // Only run if:
        // 1. State parameter exists (user came from AI Search)
        // 2. Subscription ID is available (payment was verified)
        // 3. Not currently processing
        if (hasState && verifiedSubscriptionId && !loading) {
            console.log('🔄 Consuming AI Search state after payment success...');
            consumeState(verifiedSubscriptionId);
            // Note: consumeState will handle redirect automatically
            // Clear subscription ID to prevent re-processing
            setVerifiedSubscriptionId(null);
        }
    }, [hasState, verifiedSubscriptionId, loading, consumeState]);

    // ============================================================================
    // ORIGINAL PAYMENT FLOW - Create Stripe checkout session
    // ============================================================================
    /**
     * Create Stripe checkout session and redirect to payment
     */
    const createCheckoutSession = async (extraPayload = {}) => {
        // Validate form if validator provided
        if (validateForm) {
            const validation = validateForm();
            if (!validation.valid) {
                setErrorModal({
                    show: true,
                    title: 'Validation Error',
                    message: validation.error || 'Please check your form inputs',
                    type: 'error'
                });
                return;
            }
        }
        
        try {
            setLoading(true);
            
            // Create Stripe checkout session
            const response = await fetch(`${window.location.origin}${apiEndpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formData: formData,
                    redirectPath: successRedirectPath || window.location.pathname,
                    ...extraPayload
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to create checkout session');
            }
            
            const { url } = await response.json();
            
            if (url) {
                // Redirect to Stripe checkout
                window.location.href = url;
            } else {
                throw new Error('No checkout URL received');
            }
        } catch (err) {
            setErrorModal({
                show: true,
                title: 'Checkout Failed',
                message: err.message || 'Failed to start checkout. Please try again.',
                type: 'error'
            });
            if (onPaymentError) {
                onPaymentError(err);
            }
            setLoading(false);
        }
    };

    return {
        createCheckoutSession,
        loading,
        errorModal,
        setErrorModal,
        ErrorModalComponent: (
            <ErrorModal
                isOpen={errorModal.show}
                onClose={() => setErrorModal({ show: false, title: '', message: '', type: 'error' })}
                title={errorModal.title}
                message={errorModal.message}
                type={errorModal.type}
            />
        )
    };
};

export default usePaymentModal;
