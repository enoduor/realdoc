import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Check if user is logged in on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        
        if (token && userData) {
            setUser(JSON.parse(userData));
        }
        setLoading(false);
    }, []);

    // Login function - only handles the response
    const login = async (response) => {
        try {
            if (!response.token || !response.userId) {
                throw new Error('Invalid response data');
            }
            
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify({
                id: response.userId,
                email: response.email
            }));
            
            setUser({
                id: response.userId,
                email: response.email
            });
            setError(null);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Logout function
    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setError(null);
    };

    // Get current auth token
    const getToken = () => localStorage.getItem('token');

    // Add isAuthenticated computed property
    const isAuthenticated = !!user && !!getToken();

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            error,
            login,
            logout,
            getToken,
            isAuthenticated // Add this to the context value
        }}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;