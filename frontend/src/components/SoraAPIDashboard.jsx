import React, { useState, useEffect } from 'react';
import { useUser, useAuth, useClerk } from '@clerk/clerk-react';
import { Link, useNavigate } from 'react-router-dom';
import './SoraAPIDashboard.css';

const SoraAPIDashboard = () => {
  const { user } = useUser();
  const { getToken } = useAuth();
  const { signOut } = useClerk();
  const navigate = useNavigate();
  const [apiKeys, setApiKeys] = useState([]);
  const [credits, setCredits] = useState(0);
  const [balance, setBalance] = useState(0);
  const [totalPurchases, setTotalPurchases] = useState(0);
  const [totalPaidGross, setTotalPaidGross] = useState(0);
  const [totalCreditsPurchased, setTotalCreditsPurchased] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creatingKey, setCreatingKey] = useState(false);
  const [showAddCredits, setShowAddCredits] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [deletingKey, setDeletingKey] = useState(null);

  // Set Sora API dashboard preference when user visits
  useEffect(() => {
    localStorage.setItem('preferredDashboard', 'sora-api');
  }, []);

  useEffect(() => {
    loadDashboardData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setDeletingKey(null); // Reset any pending delete operations
      
      const API_URL = process.env.REACT_APP_API_URL || 'https://reelpostly.com';
      const token = await getToken();
      
      console.log('Loading dashboard data...');
      
      // Fetch user's API keys
      const keysResponse = await fetch(`${API_URL}/api/sora/keys`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const keysData = await keysResponse.json();
      
      console.log('Keys response:', keysData);
      
      if (keysData.success) {
        setApiKeys(keysData.keys || []);
        console.log('🔑 API Keys loaded:', keysData.keys);
        console.log('🔑 Number of keys:', keysData.keys?.length || 0);
        // Debug each key
        keysData.keys?.forEach((key, index) => {
          console.log(`🔑 Key ${index + 1}:`, {
            id: key.id,
            name: key.name,
            status: key.status,
            credits: key.credits
          });
        });
      } else {
        console.error('Keys API error:', keysData.error);
      }
      
      // Fetch stats
      const statsResponse = await fetch(`${API_URL}/api/sora/stats`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const statsData = await statsResponse.json();
      
      console.log('Stats response:', statsData);
      
      if (statsData.success) {
        setCredits(statsData.stats.credits || 0);
        setBalance(statsData.stats.balance || 0);
        setTotalPurchases(statsData.stats.totalPurchases || 0);
        setTotalPaidGross(statsData.stats.totalPaidGross || 0);
        setTotalCreditsPurchased(statsData.stats.totalCreditsPurchased || 0);
        console.log('Stats loaded:', statsData.stats);
      } else {
        console.error('Stats API error:', statsData.error);
      }
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAPIKey = async () => {
    // Check if user has made any purchases first
    if (totalCreditsPurchased === 0) {
      const shouldPurchase = window.confirm(
        '🔒 Payment Required\n\n' +
        'You need to purchase tokens before creating an API key.\n\n' +
        'Would you like to purchase tokens now?'
      );
      
      if (shouldPurchase) {
        setShowAddCredits(true);
        return;
      } else {
        return;
      }
    }

    try {
      setCreatingKey(true);
      
      const API_URL = process.env.REACT_APP_API_URL || 'https://reelpostly.com';
      const token = await getToken();
      
      const response = await fetch(`${API_URL}/api/sora/keys/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          name: `${user?.firstName || user?.username}'s API Key` 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setNewApiKey(data.apiKey);
        setShowKeyModal(true);
        
        // Reload dashboard data
        await loadDashboardData();
        
        // Show success message
        setTimeout(() => {
          alert('🎉 API Key created successfully!');
        }, 1000);
      } else {
        throw new Error(data.error || 'Failed to create API key');
      }
      
    } catch (error) {
      console.error('Error creating API key:', error);
      alert(`Failed to create API key: ${error.message}`);
    } finally {
      setCreatingKey(false);
    }
  };

  const deleteAPIKey = async (apiKeyId) => {
    // Find the key to get its token count
    const keyToDelete = apiKeys.find(key => key.id === apiKeyId);
    const tokenCount = keyToDelete?.credits || 0;
    
    let confirmMessage = 'Are you sure you want to delete this API key? This action cannot be undone.';
    
    if (tokenCount > 0) {
      confirmMessage = `⚠️ WARNING: This API key has ${tokenCount} tokens remaining.\n\nDeleting this key will PERMANENTLY LOSE all ${tokenCount} tokens.\n\nAre you sure you want to delete this API key? This action cannot be undone.`;
    }
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      setDeletingKey(apiKeyId);
      
      const API_URL = process.env.REACT_APP_API_URL || 'https://reelpostly.com';
      const token = await getToken();
      
      console.log('Deleting API key:', apiKeyId); // DEBUG
      console.log('API URL:', `${API_URL}/api/sora/keys/${apiKeyId}`); // DEBUG
      
      const response = await fetch(`${API_URL}/api/sora/keys/${apiKeyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Delete response status:', response.status); // DEBUG
      const data = await response.json();
      console.log('Delete response data:', data); // DEBUG
      
      if (data.success) {
        console.log('Delete successful, reloading dashboard...'); // DEBUG
        // Immediately reload data and reset state
        await loadDashboardData();
        console.log('Dashboard reloaded, resetting deletingKey state'); // DEBUG
        setDeletingKey(null);
        alert('API key deleted successfully');
      } else {
        throw new Error(data.error || 'Failed to delete API key');
      }
      
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert(`Failed to delete API key: ${error.message}`);
      setDeletingKey(null); // Reset state on error
    }
  };

  const handleAddCredits = async () => {
    if (isPaying) return;
    try {
      setIsPaying(true);
      const API_URL = process.env.REACT_APP_API_URL || 'https://reelpostly.com';
      const token = await getToken();
      
      // Use the Sora API implementation that handles $10, $20, $50, $100
      console.log('🔄 [Frontend] Sending amount:', selectedAmount);
      const response = await fetch(`${API_URL}/api/sora/credits/checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount: selectedAmount })
      });
      
      const data = await response.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        alert(data.message || 'Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Error initiating payment:', error);
      alert('Failed to initiate payment. Please try again.');
    } finally {
      setIsPaying(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('API key copied to clipboard!');
  };

  const maskKey = (k = '') => (k.length <= 8 ? '********' : `${k.slice(0,4)}••••••••${k.slice(-4)}`);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  // Calculate estimated days based on credits (simplified calculation)
  const estimatedDays = credits > 0 ? Math.floor(credits / 10) : 0;

  if (loading) {
    return (
      <div className="sora-dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sora-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-left">
            <Link to="/" className="logo">
              <img src="/logo.png" alt="ReelPostly" />
              <span>ReelPostly API</span>
            </Link>
          </div>
          <div className="header-right">
            <Link to="/sora-api" className="nav-link">API Docs</Link>
            <Link to="/app/dashboard" className="nav-link">Main Dashboard</Link>
            <div className="user-info">
              <img src={user?.imageUrl} alt="Profile" className="user-avatar" />
              <span>{user?.firstName || user?.username}</span>
            </div>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="dashboard-container">
        {/* Page Title */}
        <div className="page-title">
          <h1>Sora API Dashboard</h1>
          <p>Manage your API keys, credits, and usage</p>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card stat-card-primary">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <div className="stat-label">Tokens</div>
              <div className="stat-value">{credits.toLocaleString()}</div>
              <div className="stat-sub">Available for API calls</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <div className="stat-label">Lifetime Purchases</div>
              <div className="stat-value">{totalCreditsPurchased.toLocaleString()}</div>
              <div className="stat-sub">Total Tokens Bought</div>
            </div>
          </div>

        </div>

        {/* API Keys Section */}
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2>API Keys</h2>
              <p>Create and manage your API keys for authentication</p>
            </div>
            <button 
              onClick={createAPIKey} 
              disabled={creatingKey}
              className="btn-primary"
            >
              {creatingKey ? 'Creating...' : '+ Create API Key'}
            </button>
          </div>

          <div className="api-keys-list">
            {apiKeys.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔑</div>
                <h3>No API Keys Yet</h3>
                <p>Create your first API key to start using the Sora API</p>
              </div>
            ) : (
              apiKeys.map((key) => (
                <div key={key.id} className="api-key-item">
                  <div className="key-icon">🔑</div>
                  <div className="key-details">
                    <div className="key-name">{key.name}</div>
                    <div className="key-value">
                      <code>{maskKey(key.key)}</code>
                      <button 
                        onClick={() => copyToClipboard(key.key)}
                        className="btn-copy"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <div className="key-meta">
                      <span className="key-credits">⚡ {key.credits?.toLocaleString() || 0} tokens</span> • Created {new Date(key.created).toLocaleDateString()} • Last used {new Date(key.lastUsed).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="key-actions">
                    <button
                      onClick={() => {
                        console.log('🗑️ Delete button clicked for key:', key.id); // DEBUG
                        console.log('Current deletingKey state:', deletingKey); // DEBUG
                        console.log('Button disabled?', deletingKey === key.id); // DEBUG
                        deleteAPIKey(key.id);
                      }}
                      disabled={deletingKey === key.id}
                      className="btn-delete"
                      title="Delete API key"
                      style={{
                        opacity: deletingKey === key.id ? 0.6 : 1,
                        cursor: deletingKey === key.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {deletingKey === key.id ? '⏳' : '🗑️'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Credits Section */}
        <div className="section-card">
          <div className="section-header">
            <div>
              <h2>Add Sora API Credits</h2>
              <p>Purchase credits to generate AI videos</p>
            </div>
          </div>

          <div className="credits-form">
            <div className="amount-selector">
              <label>Select Amount</label>
              <div className="amount-buttons">
                {[
                  { amount: 10, credits: 4 },
                  { amount: 20, credits: 8 },
                  { amount: 50, credits: 20 },
                  { amount: 100, credits: 40 }
                ].map(({ amount, credits }) => (
                  <button
                    key={amount}
                    onClick={() => setSelectedAmount(amount)}
                    className={`amount-btn ${selectedAmount === amount ? 'active' : ''}`}
                  >
                    <div className="amount-price">${amount}</div>
                    <div className="amount-credits">{credits} tokens</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="payment-method">
              <label>Payment Method</label>
              <div className="payment-option">
                <div className="payment-logo">
                  <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
                    <rect width="60" height="24" rx="4" fill="#635BFF"/>
                    <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="10" fontWeight="600">Stripe</text>
                  </svg>
                </div>
                <span>Secure payment via Stripe</span>
              </div>
            </div>

            <button onClick={handleAddCredits} disabled={isPaying} className={`btn-primary btn-large ${isPaying ? 'disabled' : ''}`}>
              {isPaying ? 'Redirecting…' : `Pay $${selectedAmount} • Get ${Math.round(selectedAmount * 0.4)} Tokens`}
            </button>
          </div>
        </div>

        {/* Debug Section - Remove this after fixing */}

      </div>

      {/* New API Key Modal */}
      {showKeyModal && (
        <div className="modal-overlay" onClick={() => setShowKeyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ API Key Created Successfully</h3>
            </div>
            <div className="modal-body">
              <p className="modal-warning">
                ⚠️ <strong>Important:</strong> Copy your API key now. You won't be able to see it again!
              </p>
              <div className="key-display">
                <code>{newApiKey}</code>
                <button 
                  onClick={() => copyToClipboard(newApiKey)}
                  className="btn-copy-large"
                >
                  📋 Copy Key
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowKeyModal(false)} className="btn-primary">
                I've Saved My Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SoraAPIDashboard;
