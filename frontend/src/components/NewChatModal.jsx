import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  XMarkIcon, 
  UserIcon, 
  UserGroupIcon,
  MagnifyingGlassIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../apiConfig';

const NewChatModal = ({ onClose, onChatCreated }) => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    if (!user?.token) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chats/users/all`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserSelect = (selectedUser) => {
    if (activeTab === 'users') {
      // Create private chat immediately
      createPrivateChat(selectedUser._id);
    } else {
      // Add to group selection
      setSelectedUsers(prev => {
        const isSelected = prev.find(u => u._id === selectedUser._id);
        if (isSelected) {
          return prev.filter(u => u._id !== selectedUser._id);
        } else {
          return [...prev, selectedUser];
        }
      });
    }
  };

  const createPrivateChat = async (participantId) => {
    try {
      setCreateLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chats/private`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ participantId })
      });

      if (response.ok) {
        const newChat = await response.json();
        onChatCreated(newChat);
      }
    } catch (error) {
      console.error('Error creating private chat:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  const createGroupChat = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;
    
    // Check if user is system admin
    if (user?.role !== 'Admin') {
      alert('Only system administrators can create groups.');
      return;
    }

    try {
      setCreateLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chats/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim(),
          participantIds: selectedUsers.map(u => u._id)
        })
      });

      if (response.ok) {
        const newChat = await response.json();
        onChatCreated(newChat);
      }
    } catch (error) {
      console.error('Error creating group chat:', error);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white h-full w-full md:h-auto md:w-auto md:rounded-lg md:shadow-xl md:max-w-md md:max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">New Chat</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 rounded-lg"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'users'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <UserIcon className="h-4 w-4 inline mr-1" />
              Private Chat
            </button>
            {/* Only show Group Chat tab for system admins */}
            {user?.role === 'Admin' && (
              <button
                onClick={() => setActiveTab('group')}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'group'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <UserGroupIcon className="h-4 w-4 inline mr-1" />
                Group Chat
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Group Info (only for group tab) */}
        {activeTab === 'group' && (
          <div className="p-4 border-b border-gray-200 space-y-3">
            <input
              type="text"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <textarea
              placeholder="Group description (optional)"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
            
            {/* Selected users */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(selectedUser => (
                  <span
                    key={selectedUser._id}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"
                  >
                    {selectedUser.firstName} {selectedUser.lastName}
                    <button
                      onClick={() => handleUserSelect(selectedUser)}
                      className="ml-1 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* User List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p className="text-sm">No users found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredUsers.map(chatUser => {
                const isSelected = selectedUsers.find(u => u._id === chatUser._id);
                
                return (
                  <div
                    key={chatUser._id}
                    onClick={() => handleUserSelect(chatUser)}
                    className={`p-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative flex-shrink-0">
                        {chatUser.photo?.url ? (
                          <img
                            src={chatUser.photo.url}
                            alt={`${chatUser.firstName} ${chatUser.lastName}`}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                            <UserIcon className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                        
                        {chatUser.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {chatUser.firstName} {chatUser.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {chatUser.email}
                        </p>
                      </div>

                      {activeTab === 'group' && isSelected && (
                        <div className="text-green-600">
                          <PlusIcon className="h-5 w-5 transform rotate-45" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer (only for group chat) */}
        {activeTab === 'group' && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={createGroupChat}
              disabled={!groupName.trim() || selectedUsers.length === 0 || createLoading}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
            >
              {createLoading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewChatModal;
