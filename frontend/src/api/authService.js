import axios from 'axios';

const AUTH_URL = "http://localhost:4001";

class AuthService {
    static async login(email, password) {
        try {
            const response = await axios.post(`${AUTH_URL}/api/auth/login`, {
                email,
                password
            }, {
                headers: { 
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                mode: 'cors',
                credentials: 'same-origin'
            });

            const data = response.data;
            return {
                success: true,
                token: data.token,
                userId: data.userId,
                email: email,
                message: data.message
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async register(email, password) {
        try {
            const response = await axios.post(`${AUTH_URL}/api/auth/register`, {
                email,
                password
            });
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Error handling (matching contentService pattern)
    static handleError(error) {
        if (error.response) {
            return new Error(error.response.data.error || 'Authentication failed');
        } else if (error.request) {
            return new Error('No response from authentication server');
        } else {
            return new Error('Error setting up authentication request');
        }
    }
}

export default AuthService;
