import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';

const FileUpload = ({ taskId, onFileUploaded, onFileDeleted }) => {
  const { user: loggedInUser } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/files`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to upload files');
      }

      const uploadedFiles = await response.json();
      toast.success('Files uploaded successfully');
      setFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (onFileUploaded) {
        onFileUploaded(uploadedFiles);
      }
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${loggedInUser.token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete file');
      }

      toast.success('File deleted successfully');
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <input
          type="file"
          multiple
          onChange={handleFileSelect}
          ref={fileInputRef}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
        <button
          onClick={handleUpload}
          disabled={uploading || files.length === 0}
          className={`px-4 py-2 rounded-md text-white font-medium
            ${uploading || files.length === 0
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      </div>
      {files.length > 0 && (
        <div className="mt-2">
          <p className="text-sm text-gray-600">Selected files:</p>
          <ul className="mt-1 space-y-1">
            {files.map((file, index) => (
              <li key={index} className="text-sm text-gray-700">
                {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 