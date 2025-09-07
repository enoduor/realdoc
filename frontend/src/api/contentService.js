// src/services/ContentService.js
import axios from 'axios';

/* ===== Base URLs (normalized to be origin/PUBLIC_URL-relative) ===== */
const ORIGIN =
  (typeof window !== 'undefined' && window.location && window.location.origin)
    ? window.location.origin
    : '';

const PUBLIC_BASE_RAW = process.env.PUBLIC_URL || '/repostly/';

// Ensure exactly one trailing slash
const PUBLIC_BASE = (() => {
  const t = String(PUBLIC_BASE_RAW || '/');
  return t.endsWith('/') ? t : `${t}/`;
})();

const joinUrl = (a, b = '') =>
  `${String(a).replace(/\/+$/, '')}/${String(b).replace(/^\/+/, '')}`;

// If REACT_APP_PYTHON_API_URL is provided at build time, use it.
// Otherwise, use production path or Node.js backend proxy for development.
export const PYTHON_API_BASE_URL =
  process.env.REACT_APP_PYTHON_API_URL
    || (process.env.NODE_ENV === 'production' 
        ? window.location.origin + '/repostly/ai'
        : 'http://localhost:4001/repostly/ai');

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