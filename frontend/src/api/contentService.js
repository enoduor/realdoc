import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_AI_API?.replace(/\/$/, '') || 'https://videograb-alb-1069883284.us-west-2.elb.amazonaws.com/repostly/ai';

class ContentService {
    // Caption endpoints
    static async createCaption(data) {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/v1/captions/`, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async getCaptions() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/captions/`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async getCaption(id) {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/captions/${id}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async updateCaption(id, data) {
        try {
            const response = await axios.put(`${API_BASE_URL}/api/v1/captions/${id}`, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async deleteCaption(id) {
        try {
            const response = await axios.delete(`${API_BASE_URL}/api/v1/captions/${id}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Hashtag endpoints
    static async createHashtags(data) {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/v1/hashtags/`, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async getHashtags() {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/hashtags/`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async getHashtag(id) {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/v1/hashtags/${id}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async updateHashtags(id, data) {
        try {
            const response = await axios.put(`${API_BASE_URL}/api/v1/hashtags/${id}`, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async deleteHashtags(id) {
        try {
            const response = await axios.delete(`${API_BASE_URL}/api/v1/hashtags/${id}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Error handling
    static handleError(error) {
        if (error.response) {
            // Server responded with error
            return new Error(error.response.data.detail || 'An error occurred');
        } else if (error.request) {
            // Request made but no response
            return new Error('No response from server');
        } else {
            // Something else went wrong
            return new Error('Error setting up request');
        }
    }
}

export default ContentService; 