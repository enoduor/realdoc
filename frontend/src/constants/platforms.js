// Platform-specific configurations and limitations
export const PLATFORMS = {
    INSTAGRAM: {
        id: 'instagram',
        name: 'Instagram',
        maxCharacters: 2200,
        maxHashtags: 30,
        requiresMedia: true,
        icon: '📸',
        supportedMedia: ['image', 'video', 'carousel'],
        recommendedImageSize: '1080x1080 (square), 1080x1350 (portrait)',
        recommendedVideoLength: '3-60 seconds',
        prompt_style: 'visual and engaging'
    },
    TWITTER: {
        id: 'twitter',
        name: 'Twitter',
        maxCharacters: 280,
        maxHashtags: 25,
        requiresMedia: false,
        icon: '🐦',
        supportedMedia: ['image', 'video', 'gif'],
        recommendedImageSize: '1600x900',
        recommendedVideoLength: 'Up to 2:20 minutes',
        prompt_style: 'concise and conversational'
    },
    FACEBOOK: {
        id: 'facebook',
        name: 'Facebook',
        maxCharacters: 63206,
        maxHashtags: 100,
        requiresMedia: false,
        icon: '👤',
        supportedMedia: ['image', 'video', 'carousel', 'link'],
        recommendedImageSize: '1200x630',
        recommendedVideoLength: 'Up to 240 minutes',
        prompt_style: 'community-focused and engaging'
    },
    LINKEDIN: {
        id: 'linkedin',
        name: 'LinkedIn',
        maxCharacters: 3000,
        maxHashtags: 50,
        requiresMedia: false,
        icon: '💼',
        supportedMedia: ['image', 'video', 'document'],
        recommendedImageSize: '1200x627',
        recommendedVideoLength: 'Up to 10 minutes',
        prompt_style: 'professional and informative'
    },
    TIKTOK: {
        id: 'tiktok',
        name: 'TikTok',
        maxCharacters: 150,
        maxHashtags: 20,
        requiresMedia: true,
        icon: '🎵',
        supportedMedia: ['video'],
        recommendedImageSize: 'N/A',
        recommendedVideoLength: '15-60 seconds',
        prompt_style: 'trendy and entertaining'
    },
    YOUTUBE: {
        id: 'youtube',
        name: 'YouTube',
        maxCharacters: 5000,
        maxHashtags: 100,
        requiresMedia: true,
        icon: '▶️',
        supportedMedia: ['video'],
        recommendedImageSize: '1280x720 (thumbnail)',
        recommendedVideoLength: 'No limit (recommended 10-15 minutes)',
        prompt_style: 'descriptive and engaging'
    }
};

// Helper functions for platform-specific validations
export const isPlatformValid = (platformId) => {
    return Object.values(PLATFORMS).some(platform => platform.id === platformId);
};

export const getCharacterLimit = (platformId) => {
    const platform = Object.values(PLATFORMS).find(p => p.id === platformId);
    return platform ? platform.maxCharacters : 0;
};

export const getHashtagLimit = (platformId) => {
    const platform = Object.values(PLATFORMS).find(p => p.id === platformId);
    return platform ? platform.maxHashtags : 0;
};

export const getSupportedMedia = (platformId) => {
    const platform = Object.values(PLATFORMS).find(p => p.id === platformId);
    return platform ? platform.supportedMedia : [];
};

export const getPlatformIcon = (platformId) => {
    const platform = Object.values(PLATFORMS).find(p => p.id === platformId);
    return platform ? platform.icon : '📱';
};

export const requiresMedia = (platformId) => {
    const platform = Object.values(PLATFORMS).find(p => p.id === platformId);
    return platform ? platform.requiresMedia : false;
};
