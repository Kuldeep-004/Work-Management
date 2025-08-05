import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  PlusIcon, 
  XMarkIcon, 
  MagnifyingGlassIcon,
  UserGroupIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const ChatSidebar = ({ 
  chats, 
  allUsers,
  activeChat, 
  onChatSelect, 
  onUserSelect,
  onNewGroup, 
  loading, 
  onlineUsers, 
  onClose 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getChatDisplayInfo = (chat) => {
    if (chat.type === 'group') {
      return {
        name: chat.name,
        avatar: chat.avatar?.url || null,
        isOnline: false,
        subtitle: `${chat.participants.length} members`
      };
    } else {
      const otherParticipant = chat.participants.find(p => p.user._id !== user?._id)?.user;
      const isOnline = onlineUsers.has(otherParticipant?._id);
      return {
        name: otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'Unknown',
        avatar: otherParticipant?.photo?.url || null,
        isOnline,
        subtitle: isOnline ? 'Online' : 'Offline'
      };
    }
  };

  const getLastMessagePreview = (chat) => {
    if (!chat.lastMessage) return 'No messages yet';
    
    const message = chat.lastMessage;
    if (message.type === 'text') {
      return message.content;
    } else if (message.type === 'image') {
      return '📷 Photo';
    } else if (message.type === 'file') {
      return '📄 File';
    } else if (message.type === 'audio') {
      return '🎵 Audio';
    } else if (message.type === 'video') {
      return '🎬 Video';
    }
    return 'Message';
  };

  const filteredChats = chats.filter(chat => {
    const { name } = getChatDisplayInfo(chat);
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredUsers = allUsers.filter(u => {
    const fullName = `${u.firstName} ${u.lastName}`;
    return u._id !== user?._id && 
           (fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()));
  });

  // Combine chats and users, prioritizing existing chats
  const combinedList = [...filteredChats];
  
  // Add users that don't have existing chats (excluding current user)
  filteredUsers.forEach(u => {
    // Skip current user
    if (u._id === user?._id) return;
    
    const hasExistingChat = chats.some(chat => 
      chat.type === 'private' && 
      chat.participants.some(p => p.user._id === u._id)
    );
    if (!hasExistingChat) {
      combinedList.push({
        _id: `user_${u._id}`,
        type: 'user',
        user: u,
        isUser: true
      });
    }
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Chats</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onNewGroup}
              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="New Group"
            >
              <UserGroupIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Chat/User List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading...</p>
          </div>
        ) : combinedList.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <p className="text-sm">
              {searchTerm ? 'No results found' : 'No users available'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {combinedList.map((item) => {
              let name, avatar, isOnline, subtitle, isActive;
              
              if (item.isUser) {
                // This is a user without existing chat
                const u = item.user;
                name = `${u.firstName} ${u.lastName}`;
                avatar = u.photo?.url || null;
                isOnline = onlineUsers.has(u._id);
                subtitle = isOnline ? 'Online' : 'Offline';
                isActive = false;
              } else {
                // This is an existing chat
                const chatInfo = getChatDisplayInfo(item);
                name = chatInfo.name;
                avatar = chatInfo.avatar;
                isOnline = chatInfo.isOnline;
                subtitle = chatInfo.subtitle;
                isActive = activeChat?._id === item._id;
              }
              
              return (
                <div
                  key={item._id}
                  onClick={() => item.isUser ? onUserSelect(item.user) : onChatSelect(item)}
                  className={`p-4 cursor-pointer transition-colors ${
                    isActive 
                      ? 'bg-green-50 border-r-2 border-green-500' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
                          {item.type === 'group' ? (
                            <UserGroupIcon className="h-6 w-6 text-gray-500" />
                          ) : (
                            <UserIcon className="h-6 w-6 text-gray-500" />
                          )}
                        </div>
                      )}
                      
                      {/* Online indicator for private chats */}
                      {(item.type === 'private' || item.isUser) && isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {name}
                        </p>
                        {/* Only show time for actual chats with messages, not for users without chats */}
                        {!item.isUser && item.lastMessage && item.lastActivity && (
                          <span className="text-xs text-gray-500">
                            {formatTime(item.lastActivity)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-xs text-gray-500 truncate">
                          {item.isUser ? subtitle : getLastMessagePreview(item)}
                        </p>
                        
                        {/* Unread count */}
                        {!item.isUser && item.unreadCount > 0 && (
                          <span className="bg-green-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                            {item.unreadCount > 99 ? '99+' : item.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
