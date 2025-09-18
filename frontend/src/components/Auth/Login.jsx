import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import AuthService from '../../api/authService';
import { useNavigate, Link } from 'react-router-dom';
import './Login.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            // First, make the API call using apiLogin from api.js
            const response = await AuthService.login(email, password);

            // Then, update the auth context with the response
            if (response.success) {
                await login(response);  // This is from useAuth()
                // Change this to your main page route
                navigate('/');  // or navigate('/home') depending on your setup
            } else {
                throw new Error(response.error || 'Login failed');
            }
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Failed to login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <h2>Login</h2>
            {error && <div className="error-message">{error}</div>}
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={isLoading}
                    className="login-button"
                >
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>
            </form>

            <div className="login-footer">
                <p>Don't have an account? <Link to="/register">Register</Link></p>
                <p><Link to="/forgot-password">Forgot Password</Link></p>
            </div>
        </div>
    );
};

export default Login;