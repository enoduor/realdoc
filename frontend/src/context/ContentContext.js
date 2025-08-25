import React, { createContext, useContext, useState } from 'react';
import { PLATFORMS } from '../constants/platforms';

// Create context
const ContentContext = createContext();

// Custom hook to use content context
export const useContent = () => {
    return useContext(ContentContext);
};

// Content provider component
export const ContentProvider = ({ children }) => {
    const [content, setContent] = useState({
        platform: 'instagram',
        caption: '',
        hashtags: [],
        mediaUrl: '',
        topic: '',
        tone: 'professional',
        language: 'en'
    });

    // Function to update content
    const updateContent = (newContent) => {
        setContent(prev => ({
            ...prev,
            ...newContent
        }));
    };

    // Get platform-specific limits
    const platformLimits = PLATFORMS[content.platform.toUpperCase()];

    // Context value
    const value = {
        content,
        updateContent,
        platformLimits,
        // Helper functions
        updatePlatform: (platform) => updateContent({ platform }),
        updateCaption: (caption) => updateContent({ caption }),
        updateHashtags: (hashtags) => updateContent({ hashtags }),
        updateMedia: (mediaUrl) => updateContent({ mediaUrl }),
        updateTopic: (topic) => updateContent({ topic }),
        clearContent: () => setContent({
            platform: 'instagram',
            caption: '',
            hashtags: [],
            mediaUrl: '',
            topic: '',
            tone: 'professional',
            language: 'en'
        })
    };

    return (
        <ContentContext.Provider value={value}>
            {children}
        </ContentContext.Provider>
    );
};

export default ContentProvider;
