import React, { createContext, useContext, useState } from 'react';

// Create context
const ContentContext = createContext();

// Custom hook to use content context
export const useContent = () => {
    return useContext(ContentContext);
};

// Content provider component
export const ContentProvider = ({ children }) => {
    const [content, setContent] = useState({});

    // Function to update content
    const updateContent = (newContent) => {
        setContent(prev => ({
            ...prev,
            ...newContent
        }));
    };

    // Context value
    const value = {
        content,
        updateContent,
        clearContent: () => setContent({})
    };

    return (
        <ContentContext.Provider value={value}>
            {children}
        </ContentContext.Provider>
    );
};

export default ContentProvider; 