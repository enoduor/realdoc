import React, { createContext, useContext, useState, useEffect } from 'react';
import { PLATFORMS } from '../constants/platforms';

// Create context
const ContentContext = createContext();

// Custom hook to use content context
export const useContent = () => {
    return useContext(ContentContext);
};

// Load content from localStorage
const loadContentFromStorage = () => {
    try {
        const saved = localStorage.getItem('repostly-content');
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.error('Error loading content from localStorage:', error);
    }
    
    // Default content
    return {
        platform: 'instagram',
        captions: [''],
        hashtags: [],
        mediaUrl: null,
        mediaType: null,
        mediaFile: null,
        mediaDimensions: null,
        topic: '',
        tone: 'professional',
        language: 'en'
    };
};

// Save content to localStorage
const saveContentToStorage = (content) => {
    try {
        localStorage.setItem('repostly-content', JSON.stringify(content));
    } catch (error) {
        console.error('Error saving content to localStorage:', error);
    }
};

// Content provider component
export const ContentProvider = ({ children }) => {
    const [content, setContent] = useState(loadContentFromStorage());

    // Function to update content
    const updateContent = (newContent) => {
        setContent(prev => {
            const updated = {
                ...prev,
                ...newContent
            };
            saveContentToStorage(updated);
            return updated;
        });
    };

    // Get platform-specific limits
    const platformLimits = PLATFORMS[(content.platform || 'instagram').toUpperCase()];

    // Context value
    const value = {
        content,
        updateContent,
        platformLimits,
        // Helper functions
        updatePlatform: (platform) => updateContent({ platform }),
        updateCaption: (caption) => updateContent({ caption }),
        updateHashtags: (hashtags) => updateContent({ hashtags }),
        updateMedia: (mediaUrl, mediaType = null, mediaDimensions = null) => {
            updateContent({
                mediaUrl,
                mediaType,
                mediaDimensions
            });
        },
        updateTopic: (topic) => updateContent({ topic }),
        clearContent: () => {
            const defaultContent = {
                platform: 'instagram',
                captions: [''],
                hashtags: [],
                mediaUrl: null,
                mediaType: null,
                mediaFile: null,
                mediaDimensions: null,
                topic: '',
                tone: 'professional',
                language: 'en'
            };
            saveContentToStorage(defaultContent);
            setContent(defaultContent);
        }
    };

    return (
        <ContentContext.Provider value={value}>
            {children}
        </ContentContext.Provider>
    );
};

export default ContentProvider; 