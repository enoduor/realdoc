import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useContent } from '../context/ContentContext';
import { publishNow } from '../api';
import Scheduler from './Scheduler';
import PostStatusTracker from './PostStatusTracker';
import ErrorModal from './ErrorModal';

const SchedulerPage = () => {
    const { content } = useContent();
    const [publishedPosts, setPublishedPosts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [errorModal, setErrorModal] = useState({ 
        show: false, 
        title: '', 
        message: '', 
        type: 'error'
    });

    // Helper function to get auth token
    const getAuthToken = useCallback(async () => {
        try {
            const token = await window.Clerk.session?.getToken();
            return token;
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    }, []);



    // Handle publishing a post immediately
    const handlePublishNow = useCallback(async (publishData) => {
        setIsLoading(true);
        setError('');
        
        try {
            const token = await getAuthToken();
            if (!token) {
                throw new Error('Authentication required');
            }

            const response = await publishNow(publishData);
            
            // Add the published post to the list
            setPublishedPosts(prev => [...prev, response.post]);
            setSuccess('Post published successfully!');
            
            return response;
        } catch (err) {
            const errorMessage = err.message || 'Failed to publish post';
            setErrorModal({
                show: true,
                title: 'Publish Failed',
                message: errorMessage,
                type: 'error'
            });
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [getAuthToken]);

    // Load published posts on component mount
    useEffect(() => {
        const loadPublishedPosts = async () => {
            try {
                const token = await getAuthToken();
                if (!token) {
                    return;
                }

                // This would be implemented in the API service
                // const posts = await getUserPosts();
                // setPublishedPosts(posts);
            } catch (err) {
                console.error('Error loading published posts:', err);
            }
        };

        loadPublishedPosts();
    }, [getAuthToken]);

    // Clear success/error messages after 5 seconds
    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess('');
                setError('');
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [success, error]);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <h1 className="text-3xl font-bold text-gray-900">🚀 Publish Now</h1>
                    <Link
                        to="/app"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                {/* Success/Error Messages */}
                {success && (
                    <div className="mb-6 p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">
                        {success}
                    </div>
                )}


                <div className="space-y-8">
                    {/* Publisher Component - Full Width */}
                    <div>
                        <Scheduler 
                            onPublishNow={handlePublishNow}
                        />
                    </div>

                    {/* Published Posts Tracker - Full Width */}
                    <div>
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-medium">📊 Published Posts Tracker</h3>
                                <div className="flex-1 ml-4">
                                    <input
                                        type="text"
                                        placeholder="Search posts..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>
                            <PostStatusTracker 
                                posts={publishedPosts}
                                searchTerm={searchTerm}
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* Error Modal */}
            <ErrorModal
                isOpen={errorModal.show}
                onClose={() => setErrorModal({ show: false, title: '', message: '', type: 'error' })}
                title={errorModal.title}
                message={errorModal.message}
                type={errorModal.type}
            />
        </div>
    );
};

export default SchedulerPage;
