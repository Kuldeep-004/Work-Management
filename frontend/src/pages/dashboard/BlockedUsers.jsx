import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../../apiConfig';

const BlockedUsers = () => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchBlockedUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/blocked`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch blocked users');
        }

        const data = await response.json();
        setBlockedUsers(data);
        setError(null);
      } catch (error) {
        console.error('Error fetching blocked users:', error);
        setError(error.message);
        toast.error('Failed to fetch blocked users');
      } finally {
        setLoading(false);
      }
    };

    if (user && user.token) {
      fetchBlockedUsers();
    }
  }, [user]);

  const handleUnblock = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/${userId}/unblock`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to unblock user');
      }

      // Remove the user from the blocked list
      setBlockedUsers(blockedUsers.filter(user => user._id !== userId));
      toast.success('User unblocked successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500 text-center">
          <p className="text-lg font-semibold">Error loading blocked users</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (blockedUsers.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500 text-center">
          <p className="text-lg font-semibold">No blocked users</p>
          <p className="text-sm">All users are active</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Blocked Users</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blockedUsers.map((blockedUser) => (
          <div key={blockedUser._id} className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white text-lg font-bold leading-none flex-shrink-0">
                  {blockedUser.firstName.charAt(0).toUpperCase()}{blockedUser.lastName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-800">
                    {blockedUser.firstName} {blockedUser.lastName}
                  </h4>
                  <p className="text-sm text-gray-600">{blockedUser.email}</p>
                  <p className="text-xs text-gray-500">Role: {blockedUser.role}</p>
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => handleUnblock(blockedUser._id)}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Unblock User
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlockedUsers; 