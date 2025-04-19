# 🛠️ myContentAI – Implementation Guide

This document outlines the order of implementation and purpose of each core file in the project.

---

## ✅ Implementation Order Table

| # | File Path | Purpose |
|---|-----------|---------|
| 1 | `backend-node/index.js` | Initializes Express server, connects MongoDB, and registers routes. Always implement first. |
| 2 | `backend-python/main.py` | Sets up FastAPI server and registers all AI service routes. Core for caption/hashtag generation. |
| 3 | `backend-node/routes/media.js` | Defines `/upload` endpoint using `multer` to handle media uploads. |
| 4 | `backend-node/controllers/mediaController.js` | Processes file uploads and returns metadata (URL, MIME type, size). |
| 5 | `backend-node/routes/scheduler.js` | Handles `/schedule` endpoint for submitting a scheduled post. |
| 6 | `backend-node/controllers/schedulerController.js` | Saves scheduled post info (platforms, captions, media) into MongoDB. |
| 7 | `backend-node/models/ScheduledPost.js` | MongoDB schema for storing post details like media, captions, time, and status. |
| 8 | `backend-python/routes/captions.py` | FastAPI route to generate captions using OpenAI based on platform + topic. |
| 9 | `backend-python/utils/openai_helper.py` | GPT logic used by the captions route to call OpenAI API. |
| 10 | `frontend/components/PostEditor.jsx` | Ties together media upload, cover selection, caption editing, preview, and scheduling in one component. |
| 11 | `README.md` | Guide for setup instructions and environment variables. Helpful to complete early for team use. |
| 12 | `docker-compose.yml` | Optional: used to containerize services for local development or deployment. Useful after local testing. |

---

## 💡 Summary of Build Flow

1. Set up `backend-node` and MongoDB connection
2. Build `backend-python` and connect FastAPI
3. Implement file upload and test via Postman or frontend
4. Add caption generation and test GPT responses
5. Build frontend to bring together the full workflow
6. (Optional) Dockerize and deploy when ready

