# CreatorSync - Features and Flows Documentation

## 🚀 Features to Implement

### Media Upload Enhancements
- **Drag and drop upload** - Intuitive file upload interface
- **Multiple file support** - Upload multiple images/videos at once
- **Image preview** - Real-time preview before upload
- **Platform-specific validation** - Validate media against platform requirements
- **Auto-resize/crop options** - Automatic optimization for each platform
- **Progress indicator** - Visual upload progress tracking
- **Error handling** - Comprehensive error messages and recovery
- **Preview in PlatformPreview component** - Integrated preview system

### Social Media Portal
- **Social channels for your business** - Multi-platform management
- **Manage more than one** - Handle multiple accounts per platform
- **New post creation**:
  - Select all social channels
  - Deselect specific platforms
  - Post now option
  - Draft saving
  - Schedule date and time
  - Schedule post to be repeated
- **Post management**:
  - Click a post to view engagement
  - Modify and update scheduled posts
  - Context about hashtags
- **Analytics dashboard** - Monitor stats from social media side by side

## 🔄 Complete System Flows

### Media Upload Flow

#### 1. **Frontend (MediaUploader.jsx)**:
- User selects a file (image or video)
- File is validated for type and size
- Local preview is shown
- On upload button click, file is sent to backend via `axios.post` to `http://localhost:5001/api/v1/upload`
- FormData includes:
  - `file`: The actual file
  - `platform`: Selected platform (instagram, facebook, etc.)

#### 2. **Backend (main.py)**:
- Receives request at `/api/v1/upload`
- Routes to media.py through the router configuration:
```python
app.include_router(media_router, prefix="/api/v1", tags=["media"])
```

#### 3. **Backend (media.py)**:
- Handles the upload in `upload_media` function
- Processes the file:
  - For images: Resizes according to platform requirements
  - For videos: Uploads as is
- Uploads to S3 using pre-signed URLs
- Returns response with:
  - `url`: Pre-signed S3 URL
  - `type`: Media type (image/video)
  - `dimensions`: For images
  - `filename`: Generated filename

#### 4. **Frontend (MediaUploader.jsx)**:
- Receives response
- Updates content context with:
  - `mediaUrl`: S3 URL
  - `mediaType`: Type of media
  - `mediaDimensions`: Dimensions (for images)
- Shows preview using the S3 URL

#### 5. **Frontend (PlatformPreviewPanel.jsx)**:
- Displays the media based on type:
  - Images: Shows with platform-specific dimensions
  - Videos: Shows with controls and platform-specific dimensions
- Shows platform requirements and recommendations

### Caption Generator Flow

#### 1. **Frontend (CaptionGenerator.jsx)**:
- Sends POST request to `http://localhost:5001/api/v1/captions`

#### 2. **Backend (main.py)**:
- Receives request and routes it to `captions.py`

#### 3. **Backend (captions.py)**:
- Validates the platform and request data
- Uses OpenAI helper to generate the caption
- Applies platform-specific character limits
- Stores the caption in memory
- Returns CaptionResponse with generated caption

#### 4. **Response Flow**:
- Response goes back through `main.py` to frontend

#### 5. **Frontend Display**:
- Frontend displays the generated caption in the UI

### Hashtag Generator Flow

#### 1. **Frontend (HashtagGenerator.jsx)**:
- Sends POST request to `http://localhost:5001/api/v1/hashtags`

#### 2. **Backend (main.py)**:
- Receives request and routes it to `hashtags.py`

#### 3. **Backend (hashtags.py)**:
- Validates the platform and count
- Generates hashtags based on the topic
- Stores hashtags in memory
- Returns HashtagResponse with generated hashtags

#### 4. **Response Flow**:
- Response goes back through `main.py` to frontend

#### 5. **Frontend Display**:
- Frontend displays results in HashtagGenerator.js

### Dashboard Flow

#### 1. Authentication Check
- Checks if user is authenticated via AuthContext

#### 2. Backend Connection
- Connects to Node.js backend running on port 4001

#### 3. Session Management
- Maintains session via localStorage token

#### 4. Authentication Redirect
- If not authenticated, redirects to `/login`
- If authenticated, loads Dashboard component

#### 5. Feature Grid Display
- Displays available features in a grid layout
- Each feature links to its respective component

#### 6. State Management
- Manages user state and authentication status
- Handles loading states and error conditions

#### 7. Logout Process
- Clear localStorage (token and user data)
- Reset user state
- Redirect to login page

## 🏗️ Architecture Overview

### Frontend (React)
- **Authentication**: Clerk integration for user management
- **State Management**: Context API for global state
- **Routing**: React Router for navigation
- **API Integration**: Axios for backend communication

### Backend (Node.js)
- **Authentication**: Clerk middleware for token verification
- **Subscription Management**: Stripe integration
- **User Management**: Minimal MongoDB storage for usage tracking
- **API Routes**: RESTful endpoints for all features

### Backend (Python)
- **AI Services**: OpenAI integration for caption and hashtag generation
- **Media Processing**: Image/video optimization and S3 upload
- **Platform Validation**: Platform-specific requirements checking

### External Services
- **Clerk**: User authentication and management
- **Stripe**: Payment processing and subscription management
- **AWS S3**: Media file storage
- **OpenAI**: AI-powered content generation

## 🔧 Technical Implementation Notes

### File Structure
```
creatorsync/
├── frontend/                 # React application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── context/          # Context providers
│   │   ├── api/              # API service functions
│   │   └── utils/            # Utility functions
├── back/
│   ├── backend-node/         # Node.js backend
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Authentication middleware
│   │   ├── models/           # Database models
│   │   └── services/         # Business logic
│   └── backend-python/       # Python AI services
│       ├── routes/           # AI API routes
│       ├── utils/            # AI helper functions
│       └── uploads/          # Temporary file storage
```

### Environment Variables
- **Frontend**: Clerk publishable key, API URLs
- **Node.js Backend**: Clerk secret key, Stripe keys, MongoDB URI
- **Python Backend**: OpenAI API key, AWS credentials

### Security Considerations
- JWT token verification for all protected routes
- File type and size validation
- Platform-specific content validation
- Secure file upload with pre-signed URLs
- CORS configuration for cross-origin requests

## 📈 Future Enhancements

### Analytics Integration
- Social media API integration for real-time stats
- Engagement tracking across platforms
- Performance analytics dashboard
- ROI measurement tools

### Advanced Scheduling
- Bulk scheduling capabilities
- Recurring post patterns
- Optimal posting time suggestions
- A/B testing for content

### Content Optimization
- AI-powered content suggestions
- Trend analysis and hashtag recommendations
- Competitor analysis
- Content performance predictions

### Team Collaboration
- Multi-user access
- Role-based permissions
- Content approval workflows
- Team analytics and reporting
