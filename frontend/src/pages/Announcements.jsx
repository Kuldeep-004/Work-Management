import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_BASE_URL } from '../apiConfig';

// Create axios instance with base URL
const api = axios.create({
  baseURL: `${API_BASE_URL}/api`
});

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/announcements', {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      // Ensure we're setting an array
      setAnnouncements(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      setError('Failed to fetch announcements');
      setAnnouncements([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.token) {
      fetchAnnouncements();
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post('/announcements', {
        content,
        expiresAt: new Date(expiresAt)
      }, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      setShowForm(false);
      setContent('');
      setExpiresAt('');
      fetchAnnouncements();
    } catch (error) {
      setError('Failed to create announcement');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/announcements/${id}`, {
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      setError('Failed to delete announcement');
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-center">Loading announcements...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Announcements</h1>
          <p className="text-sm text-gray-600 mt-1">
            View and manage announcements for your team.
          </p>
        </div>
        {user.role === 'Admin' && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            Create Announcement
          </button>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Announcement</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full p-2 border rounded"
                  rows="4"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Expires At</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {announcements && announcements.length > 0 ? (
          announcements.map((announcement) => (
            <div key={announcement._id} className="bg-white p-4 rounded shadow">
              <div className="flex justify-between items-start">
                <p className="text-gray-800">{announcement.content}</p>
                {user?.role === 'Admin' && (
                  <button
                    onClick={() => handleDelete(announcement._id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500">No announcements found</div>
        )}
      </div>
    </div>
  );
};

export default Announcements; 