import { useState, useRef } from 'react';
import { 
  XMarkIcon, 
  UserPlusIcon, 
  UserMinusIcon,
  PencilIcon,
  PhotoIcon,
  StarIcon,
  UserIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';

const GroupManagementModal = ({ isOpen, onClose, chat, allUsers, onChatUpdate }) => {
  const [groupName, setGroupName] = useState(chat?.name || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  if (!isOpen || !chat) return null;

  const isAdmin = chat.participants?.find(p => p.user._id === user._id)?.role === 'admin';
  const isCreator = chat.createdBy === user._id;

  // Get available users (not already in group)
  const availableUsers = allUsers.filter(u => 
    !chat.participants.some(p => p.user._id === u._id) && u._id !== user._id
  );

  const handleUpdateGroupName = async () => {
    if (!groupName.trim() || groupName === chat.name) {
      setIsEditingName(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chats/${chat._id}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ name: groupName.trim() })
      });

      if (response.ok) {
        const updatedChat = await response.json();
        onChatUpdate(updatedChat);
        setIsEditingName(false);
      } else {
        throw new Error('Failed to update group name');
      }
    } catch (error) {
      console.error('Error updating group name:', error);
      alert('Failed to update group name');
      setGroupName(chat.name);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateGroupAvatar = async (file) => {
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch(`${API_BASE_URL}/api/chats/${chat._id}/avatar`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${user.token}`
        },
        body: formData
      });

      if (response.ok) {
        const updatedChat = await response.json();
        onChatUpdate(updatedChat);
      } else {
        throw new Error('Failed to update group avatar');
      }
    } catch (error) {
      console.error('Error updating group avatar:', error);
      alert('Failed to update group avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chats/${chat._id}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ userIds: selectedUsers })
      });

      if (response.ok) {
        const updatedChat = await response.json();
        onChatUpdate(updatedChat);
        setSelectedUsers([]);
        setShowAddMembers(false);
      } else {
        throw new Error('Failed to add members');
      }
    } catch (error) {
      console.error('Error adding members:', error);
      alert('Failed to add members');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chats/${chat._id}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`
        }
      });

      if (response.ok) {
        const updatedChat = await response.json();
        onChatUpdate(updatedChat);
      } else {
        throw new Error('Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    } finally {
      setLoading(false);
    }
  };

  const handleMakeAdmin = async (userId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chats/${chat._id}/admin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify({ userId, action: 'promote' })
      });

      if (response.ok) {
        const updatedChat = await response.json();
        onChatUpdate(updatedChat);
      } else {
        throw new Error('Failed to make admin');
      }
    } catch (error) {
      console.error('Error making admin:', error);
      alert('Failed to make admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white h-full w-full md:h-auto md:w-auto md:rounded-lg md:shadow-xl md:max-w-md md:max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Group Settings</h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 rounded"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 overflow-y-auto">
          {/* Group Info */}
          <div className="mb-6">
            {/* Avatar Section */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                {chat.avatar?.url ? (
                  <img
                    src={chat.avatar.url}
                    alt={chat.name}
                    className="h-20 w-20 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 bg-gray-200 rounded-full flex items-center justify-center">
                    <UserIcon className="h-8 w-8 text-gray-500" />
                  </div>
                )}
                
                {(isAdmin || isCreator) && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 p-1.5 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors"
                    disabled={loading}
                  >
                    <PhotoIcon className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Group Name */}
            <div className="text-center">
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="flex-1 px-3 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    onKeyPress={(e) => e.key === 'Enter' && handleUpdateGroupName()}
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateGroupName}
                    className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
                    disabled={loading}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <h3 className="text-lg font-medium text-gray-900">{chat.name}</h3>
                  {(isAdmin || isCreator) && (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="p-1 text-gray-500 hover:text-gray-700"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-sm text-gray-500">{chat.participants.length} members</p>
            </div>
          </div>

          {/* Members List */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Members</h4>
              {(isAdmin || isCreator) && (
                <button
                  onClick={() => setShowAddMembers(!showAddMembers)}
                  className="p-1 text-green-600 hover:text-green-700"
                >
                  <UserPlusIcon className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Add Members Section */}
            {showAddMembers && (isAdmin || isCreator) && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="mb-2">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Add Members</h5>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {availableUsers.map(user => (
                      <label key={user._id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedUsers([...selectedUsers, user._id]);
                            } else {
                              setSelectedUsers(selectedUsers.filter(id => id !== user._id));
                            }
                          }}
                          className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                        />
                        <span className="text-sm text-gray-700">
                          {user.firstName} {user.lastName}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleAddMembers}
                    disabled={selectedUsers.length === 0 || loading}
                    className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                  >
                    Add Selected
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMembers(false);
                      setSelectedUsers([]);
                    }}
                    className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Existing Members */}
            <div className="space-y-2">
              {chat.participants.map(participant => (
                <div key={participant.user._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center space-x-3">
                    {participant.user.photo?.url ? (
                      <img
                        src={participant.user.photo.url}
                        alt={`${participant.user.firstName} ${participant.user.lastName}`}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-sm text-gray-600">
                          {participant.user.firstName?.[0]?.toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {participant.user.firstName} {participant.user.lastName}
                        </span>
                        {participant.role === 'admin' && (
                          <StarIcon className="h-3 w-3 text-yellow-500" />
                        )}
                        {participant.user._id === user._id && (
                          <span className="text-xs text-gray-500">(You)</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 capitalize">{participant.role}</span>
                    </div>
                  </div>

                  {/* Member Actions */}
                  {(isAdmin || isCreator) && participant.user._id !== user._id && (
                    <div className="flex space-x-1">
                      {participant.role !== 'admin' && (
                        <button
                          onClick={() => handleMakeAdmin(participant.user._id)}
                          className="p-1 text-blue-600 hover:text-blue-700"
                          title="Make admin"
                          disabled={loading}
                        >
                          <StarIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveMember(participant.user._id)}
                        className="p-1 text-red-600 hover:text-red-700"
                        title="Remove member"
                        disabled={loading}
                      >
                        <UserMinusIcon className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              handleUpdateGroupAvatar(file);
            }
          }}
        />
      </div>
    </div>
  );
};

export default GroupManagementModal;
