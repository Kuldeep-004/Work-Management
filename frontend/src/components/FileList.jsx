import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';
import { API_BASE_URL } from '../apiConfig';

const FileList = ({ taskId, files: initialFiles = [], onFileDeleted }) => {
  const { user: loggedInUser } = useAuth();
  const [files, setFiles] = useState(initialFiles);

  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles]);

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/files`, {
          headers: {
            Authorization: `Bearer ${loggedInUser.token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch files');
        }

        const data = await response.json();
        setFiles(data);
      } catch (error) {
        console.error('Error fetching files:', error);
        toast.error('Failed to load files');
      }
    };

    if (initialFiles.length === 0) {
      fetchFiles();
    }
  }, [taskId, loggedInUser.token, initialFiles]);

  const handleDelete = async (fileId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/files/${fileId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${loggedInUser.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete file');
      }

      setFiles(files.filter(f => f._id !== fileId));
      if (onFileDeleted) {
        onFileDeleted(fileId);
      }
      toast.success('File deleted successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
      case 'odt':
        return '📝';
      case 'xls':
      case 'xlsx':
      case 'ods':
        return '📊';
      case 'ppt':
      case 'pptx':
      case 'odp':
        return '📑';
      case 'jpg':
      case 'jpeg':
      case 'png':
        return '🖼️';
      case 'txt':
        return '📃';
      default:
        return '📎';
    }
  };

  if (files.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        No files uploaded yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">Attached Files</h3>
      <div className="grid gap-4">
        {files.map((file) => (
          <div
            key={file._id}
            className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-colors"
          >
            <div className="flex items-center space-x-4">
              <span className="text-2xl">{getFileIcon(file.originalName)}</span>
              <div>
                <a
                  href={file.cloudUrl ? file.cloudUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  {file.originalName}
                </a>
                {!file.cloudUrl && (
                  <div className="text-xs text-red-500">No public link available</div>
                )}
                <div className="text-sm text-gray-500">
                  Uploaded by {file.uploadedBy?.firstName} {file.uploadedBy?.lastName} on{' '}
                  {new Date(file.uploadedAt).toLocaleDateString()}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleDelete(file._id)}
              className="text-red-600 hover:text-red-800"
              title="Delete file"
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileList; 