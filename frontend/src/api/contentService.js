import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api/v1';

class ContentService {
    // Caption endpoints
    static async createCaption(data) {
        try {
            const response = await axios.post(`${API_BASE_URL}/captions`, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async getCaptions() {
        try {
            const response = await axios.get(`${API_BASE_URL}/captions`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async getCaption(id) {
        try {
            const response = await axios.get(`${API_BASE_URL}/captions/${id}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async updateCaption(id, data) {
        try {
            const response = await axios.put(`${API_BASE_URL}/captions/${id}`, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async deleteCaption(id) {
        try {
            const response = await axios.delete(`${API_BASE_URL}/captions/${id}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    // Hashtag endpoints
    static async createHashtags(data) {
        try {
            const response = await axios.post(`${API_BASE_URL}/hashtags`, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async getHashtags() {
        try {
            const response = await axios.get(`${API_BASE_URL}/hashtags`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async getHashtag(id) {
        try {
            const response = await axios.get(`${API_BASE_URL}/hashtags/${id}`);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async updateHashtags(id, data) {
        try {
            const response = await axios.put(`${API_BASE_URL}/hashtags/${id}`, data);
            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    static async deleteHashtags(id) {
        try {
            const response = await axios.delete(`${API_BASE_URL}/hashtags/${id}`);
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