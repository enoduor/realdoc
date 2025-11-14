import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
    DOCUMENTATION_TYPES,
    APP_TYPES,
    TECHNICAL_LEVELS,
    DOCUMENTATION_STYLES,
    TONES,
    TARGET_AUDIENCES,
    DOCUMENTATION_FORMATS
} from '../constants/documentationTypes';

const DocumentationGenerator = () => {
    const [searchParams] = useSearchParams();
    const urlDocType = searchParams.get('type');
    
    // Validate that the URL doc type is valid
    const validDocTypes = DOCUMENTATION_TYPES.map(dt => dt.id);
    const initialDocType = urlDocType && validDocTypes.includes(urlDocType) ? urlDocType : 'user-guide';
    
    const [formData, setFormData] = useState({
        app_name: '',
        app_type: 'web',
        doc_type: initialDocType,
        feature_description: '',
        technical_level: 'intermediate',
        style: 'tutorial',
        tone: 'technical',
        language: 'en',
        include_code_examples: true,
        include_screenshots: false,
        target_audience: 'developers',
        format: 'markdown',
        app_url: ''
    });
    
    // Update doc_type when URL parameter changes
    useEffect(() => {
        if (urlDocType && validDocTypes.includes(urlDocType)) {
            setFormData(prev => ({
                ...prev,
                doc_type: urlDocType
            }));
        }
    }, [urlDocType, validDocTypes]);
    
    const [documentation, setDocumentation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedDocumentation, setEditedDocumentation] = useState('');

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        setLoading(true);
        setError('');

        try {
            const ORIGIN = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
            const PYTHON_API_BASE_URL = process.env.REACT_APP_AI_API || 
                (process.env.NODE_ENV === 'production' ? `${ORIGIN}/ai` : 'http://localhost:5001');
            
            // Only include app_url if it's provided
            const requestData = { ...formData };
            if (!requestData.app_url || requestData.app_url.trim() === '') {
                delete requestData.app_url;
            }
            
            const response = await axios.post(`${PYTHON_API_BASE_URL}/api/v1/documentation/`, requestData, {
                headers: { 'Content-Type': 'application/json' }
            });
            setDocumentation(response.data);
            setEditedDocumentation(response.data.documentation);
            setIsEditing(false);
        } catch (err) {
            const errorMessage = err?.response?.data?.detail || 
                err?.response?.data?.message || 
                err?.message || 
                'Failed to generate documentation';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };


    const handleDownload = () => {
        const docToDownload = isEditing ? editedDocumentation : (documentation?.documentation || '');
        if (!docToDownload) return;
        
        const format = documentation.format || 'markdown';
        const formatInfo = DOCUMENTATION_FORMATS.find(f => f.id === format);
        const extension = formatInfo?.extension || '.md';
        const filename = `${formData.app_name.replace(/\s+/g, '_')}_${formData.doc_type}${extension}`;
        
        const blob = new Blob([docToDownload], { 
            type: format === 'html' ? 'text/html' : 'text/plain' 
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleEdit = () => {
        setEditedDocumentation(documentation.documentation);
        setIsEditing(true);
    };

    const handleSave = () => {
        if (!documentation) return;
        
        // Update the documentation with edited content
        const updatedDoc = {
            ...documentation,
            documentation: editedDocumentation,
            word_count: editedDocumentation.split(/\s+/).filter(word => word.length > 0).length,
            estimated_read_time: Math.max(1, Math.round(editedDocumentation.split(/\s+/).filter(word => word.length > 0).length / 200))
        };
        
        setDocumentation(updatedDoc);
        setIsEditing(false);
        
        // Save to localStorage for persistence
        try {
            const savedDocs = JSON.parse(localStorage.getItem('realdoc_saved_documentation') || '[]');
            const docToSave = {
                ...updatedDoc,
                app_name: formData.app_name,
                doc_type: formData.doc_type,
                timestamp: new Date().toISOString()
            };
            
            // Check if this doc already exists (by app_name and doc_type)
            const existingIndex = savedDocs.findIndex(
                (doc) => doc.app_name === formData.app_name && doc.doc_type === formData.doc_type
            );
            
            if (existingIndex >= 0) {
                savedDocs[existingIndex] = docToSave;
            } else {
                savedDocs.push(docToSave);
            }
            
            localStorage.setItem('realdoc_saved_documentation', JSON.stringify(savedDocs));
        } catch (e) {
            console.error('Failed to save to localStorage:', e);
        }
    };

    const handleCancel = () => {
        setEditedDocumentation(documentation.documentation);
        setIsEditing(false);
    };

    const handleCopyToClipboard = () => {
        const docToCopy = isEditing ? editedDocumentation : (documentation?.documentation || '');
        if (docToCopy) {
            navigator.clipboard.writeText(docToCopy);
            alert('Documentation copied to clipboard!');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Navigation Header */}
            <header className="bg-white shadow">
                <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">Documentation Generator</h1>
                        <p className="text-sm text-gray-600 mt-1">Generate comprehensive documentation for your online applications</p>
                    </div>
                    
                    <Link
                        to="/app"
                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                <div className="bg-white shadow rounded-lg p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Basic Information */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">App Name *</label>
                                <input
                                    type="text"
                                    name="app_name"
                                    value={formData.app_name}
                                    onChange={handleInputChange}
                                    placeholder="My Awesome App"
                                    className="w-full p-2 border rounded"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">App Type *</label>
                                <select
                                    name="app_type"
                                    value={formData.app_type}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded"
                                    required
                                >
                                    {APP_TYPES.map(type => (
                                        <option key={type.id} value={type.id}>{type.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Documentation Type *</label>
                            <select
                                name="doc_type"
                                value={formData.doc_type}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded"
                                required
                            >
                                {DOCUMENTATION_TYPES.map(type => (
                                    <option key={type.id} value={type.id}>{type.name} - {type.description}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">App URL (Optional)</label>
                            <input
                                type="url"
                                name="app_url"
                                value={formData.app_url}
                                onChange={handleInputChange}
                                placeholder="https://example.com or example.com"
                                className="w-full p-2 border rounded"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Provide your app's website URL to automatically gather information and improve documentation accuracy
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Feature Description *</label>
                            <textarea
                                name="feature_description"
                                value={formData.feature_description}
                                onChange={handleInputChange}
                                placeholder="Describe the feature or functionality you want to document. Include key points, use cases, and any specific details..."
                                className="w-full p-3 border rounded-lg resize-none"
                                rows="4"
                                required
                            />
                            {formData.feature_description && formData.feature_description.length < 30 && (
                                <div className="mt-2 p-2 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded text-sm">
                                    ⚠️ <strong>Tip:</strong> A more detailed description (30+ characters) will generate better, more specific documentation. 
                                    Generic descriptions like "documentation" or "guide" may result in template content.
                                </div>
                            )}
                            {formData.feature_description && (
                                <div className="mt-1 text-xs text-gray-500">
                                    {formData.feature_description.length} characters
                                </div>
                            )}
                        </div>

                        {/* Configuration Options */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                            <div>
                                <label className="block text-xs font-medium mb-1">Technical Level</label>
                                <select
                                    name="technical_level"
                                    value={formData.technical_level}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    {TECHNICAL_LEVELS.map(level => (
                                        <option key={level.id} value={level.id}>{level.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">Documentation Style</label>
                                <select
                                    name="style"
                                    value={formData.style}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    {DOCUMENTATION_STYLES.map(style => (
                                        <option key={style.id} value={style.id}>{style.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">Tone</label>
                                <select
                                    name="tone"
                                    value={formData.tone}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    {TONES.map(tone => (
                                        <option key={tone.id} value={tone.id}>{tone.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">Target Audience</label>
                                <select
                                    name="target_audience"
                                    value={formData.target_audience}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    {TARGET_AUDIENCES.map(audience => (
                                        <option key={audience.id} value={audience.id}>{audience.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-medium mb-1">Format</label>
                                <select
                                    name="format"
                                    value={formData.format}
                                    onChange={handleInputChange}
                                    className="w-full p-2 border rounded text-sm"
                                >
                                    {DOCUMENTATION_FORMATS.map(format => (
                                        <option key={format.id} value={format.id}>{format.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Language */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Language</label>
                            <select
                                name="language"
                                value={formData.language}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded"
                            >
                                <option value="en">English</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="pt">Portuguese</option>
                                <option value="it">Italian</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                                <option value="zh-CN">Chinese (Simplified)</option>
                                <option value="zh-TW">Chinese (Traditional)</option>
                            </select>
                        </div>

                        {/* Toggles */}
                        <div className="flex gap-6">
                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    name="include_code_examples"
                                    checked={formData.include_code_examples}
                                    onChange={handleInputChange}
                                    className="mr-2"
                                />
                                <span className="text-sm">Include Code Examples</span>
                            </label>

                            <label className="flex items-center">
                                <input
                                    type="checkbox"
                                    name="include_screenshots"
                                    checked={formData.include_screenshots}
                                    onChange={handleInputChange}
                                    className="mr-2"
                                />
                                <span className="text-sm">Include Screenshot Placeholders</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`py-2 px-4 rounded font-medium text-white ${
                                loading 
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            {loading ? 'Generating Documentation...' : 'Generate Documentation'}
                        </button>
                    </form>

                    {error && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
                            {error}
                        </div>
                    )}

                    {documentation && (
                        <div className="mt-6">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-lg font-medium">
                                    {isEditing ? 'Editing Documentation' : 'Generated Documentation'}
                                </h3>
                                <div className="flex gap-2">
                                    {isEditing ? (
                                        <>
                                            <button
                                                onClick={handleSave}
                                                className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
                                            >
                                                Save Changes
                                            </button>
                                            <button
                                                onClick={handleCancel}
                                                className="px-3 py-1 text-sm bg-gray-500 text-white hover:bg-gray-600 rounded"
                                            >
                                                Cancel
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleEdit}
                                                className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={handleCopyToClipboard}
                                                className="px-3 py-1 text-sm bg-gray-600 text-white hover:bg-gray-700 rounded"
                                            >
                                                Copy to Clipboard
                                            </button>
                                            <button
                                                onClick={handleDownload}
                                                className="px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded"
                                            >
                                                Download ({documentation.format?.toUpperCase() || 'MD'})
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="mb-2 text-sm text-gray-600">
                                <span>Words: {isEditing ? editedDocumentation.split(/\s+/).filter(word => word.length > 0).length : documentation.word_count}</span>
                                <span className="ml-4">Est. Read Time: {isEditing ? Math.max(1, Math.round(editedDocumentation.split(/\s+/).filter(word => word.length > 0).length / 200)) : documentation.estimated_read_time} min</span>
                                <span className="ml-4">Format: {documentation.format?.toUpperCase() || 'MARKDOWN'}</span>
                            </div>

                            {isEditing ? (
                                <div className="p-4 bg-white rounded border">
                                    <textarea
                                        value={editedDocumentation}
                                        onChange={(e) => setEditedDocumentation(e.target.value)}
                                        className="w-full p-4 border rounded-lg font-mono text-sm"
                                        rows={20}
                                        style={{ 
                                            minHeight: '400px',
                                            fontFamily: 'monospace',
                                            whiteSpace: 'pre-wrap',
                                            textAlign: 'left'
                                        }}
                                    />
                                    <div className="mt-2 text-xs text-gray-500">
                                        Tip: You can edit the documentation directly. Changes will be saved when you click "Save Changes".
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-gray-100 rounded border">
                                    {documentation.format === 'html' ? (
                                        <div 
                                            dangerouslySetInnerHTML={{ __html: documentation.documentation }}
                                            className="prose max-w-none text-left"
                                            style={{ textAlign: 'left' }}
                                        />
                                    ) : (
                                        <pre className="whitespace-pre-wrap font-mono text-sm text-left" style={{ textAlign: 'left' }}>{documentation.documentation}</pre>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default DocumentationGenerator;
