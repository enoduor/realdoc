import { useState } from 'react';
import MediaUploader from './MediaUploader';

const PostEditor = ({ onMediaUpload, onCaptionChange }) => {
  const [media, setMedia] = useState([]);
  const [caption, setCaption] = useState('');
  const [postType, setPostType] = useState('single'); // single, carousel, or text

  const handleMediaUpload = (data) => {
    setMedia(data.uploaded);
    onMediaUpload(data);
  };

  const handleCaptionChange = (e) => {
    const newCaption = e.target.value;
    setCaption(newCaption);
    onCaptionChange(newCaption);
  };

  const getPostType = () => {
    if (media.length === 0) return 'text';
    if (media.length === 1) {
      const file = media[0];
      if (file.type.startsWith('video/')) return 'video';
      if (file.type.startsWith('image/')) return 'image';
    }
    if (media.length > 1) return 'carousel';
    return 'text';
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-4">Create New Post</h2>
        
        <div className="mb-4">
          <MediaUploader onUpload={handleMediaUpload} />
        </div>

        <div className="mb-4">
          <textarea
            value={caption}
            onChange={handleCaptionChange}
            placeholder="Write a caption..."
            className="w-full p-2 border rounded-md"
            rows="4"
          />
        </div>

        <div className="text-sm text-gray-600">
          Post Type: {getPostType()}
        </div>

        {/* Preview Section */}
        <div className="mt-6 border rounded-lg p-4">
          <h3 className="font-medium mb-2">Preview</h3>
          <div className="grid gap-2">
            {media.map((file, index) => (
              <div key={index} className="relative">
                {file.type.startsWith('image/') ? (
                  <img 
                    src={file.fileUrl} 
                    alt={`Preview ${index + 1}`}
                    className="max-h-48 object-contain"
                  />
                ) : file.type.startsWith('video/') ? (
                  <video 
                    src={file.fileUrl}
                    controls
                    className="max-h-48"
                  />
                ) : null}
              </div>
            ))}
            {caption && (
              <div className="mt-2 text-sm">
                {caption}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PostEditor; 