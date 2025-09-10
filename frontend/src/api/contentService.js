// src/services/ContentService.js
import axios from 'axios';

/* ===== Base URLs ===== */
const ORIGIN =
  (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : '';

/**
 * If REACT_APP_AI_API is set at build time, use it.
 * Otherwise:
 *   - production:   use `${origin}/ai`
 *   - development:  use `http://localhost:5001`
 */
export const PYTHON_API_BASE_URL =
  process.env.REACT_APP_AI_API
    || (process.env.NODE_ENV === 'production'
        ? `${ORIGIN}/ai`
        : 'http://localhost:5001');

/* ===== Axios instance for AI service ===== */
const ai = axios.create({
  baseURL: PYTHON_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

/* ===== Error helper ===== */
const handleError = (error) => {
  if (error?.response) {
    const msg =
      error.response.data?.detail ||
      error.response.data?.message ||
      `Request failed (${error.response.status})`;
    return new Error(msg);
  }
  if (error?.request) return new Error('No response from server');
  return new Error(error?.message || 'Error setting up request');
};

/* ===== Caption endpoints ===== */
const createCaption = async (data) => {
  try {
    const res = await ai.post('/api/v1/captions/', data);
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

const getCaptions = async () => {
  try {
    const res = await ai.get('/api/v1/captions/');
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

const getCaption = async (id) => {
  try {
    const res = await ai.get(`/api/v1/captions/${id}`);
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

const updateCaption = async (id, data) => {
  try {
    const res = await ai.put(`/api/v1/captions/${id}`, data);
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

const deleteCaption = async (id) => {
  try {
    const res = await ai.delete(`/api/v1/captions/${id}`);
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

/* ===== Hashtag endpoints ===== */
const createHashtags = async (data) => {
  try {
    const res = await ai.post('/api/v1/hashtags/', data);
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

const getHashtags = async () => {
  try {
    const res = await ai.get('/api/v1/hashtags/');
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

const getHashtag = async (id) => {
  try {
    const res = await ai.get(`/api/v1/hashtags/${id}`);
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

const updateHashtags = async (id, data) => {
  try {
    const res = await ai.put(`/api/v1/hashtags/${id}`, data);
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

const deleteHashtags = async (id) => {
  try {
    const res = await ai.delete(`/api/v1/hashtags/${id}`);
    return res.data;
  } catch (err) {
    throw handleError(err);
  }
};

/* ===== Export API ===== */
const ContentService = {
  // captions
  createCaption,
  getCaptions,
  getCaption,
  updateCaption,
  deleteCaption,
  // hashtags
  createHashtags,
  getHashtags,
  getHashtag,
  updateHashtags,
  deleteHashtags,
};

export default ContentService;