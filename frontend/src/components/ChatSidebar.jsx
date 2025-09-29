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
        subtitle: `${chat.participants?.length || 0} members`
      };
    } else {
      if (!Array.isArray(chat.participants) || !user || !user._id) {
        return {
          name: 'Unknown',
          avatar: null,
          isOnline: false,
          subtitle: 'Offline'
        };
      }
      const otherParticipant = chat.participants.find(p => p?.user && p.user._id !== user._id)?.user;
      const isOnline = otherParticipant?._id ? onlineUsers.has(otherParticipant._id) : false;
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
    // Skip if user or _id is missing
    if (!u || !u._id || !user || !user._id || u._id === user._id) return;

    const hasExistingChat = chats.some(chat => 
      chat && chat.type === 'private' && 
      Array.isArray(chat.participants) &&
      chat.participants.some(p => p && p.user && p.user._id === u._id)
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
    <div className="flex flex-col h-full bg-white">
      {/* Header - WhatsApp style */}
      <div className="bg-gray-400 text-white p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Chats</h2>
          <div className="flex items-center space-x-2">
            {/* Only show New Group button for system admins */}
            {user?.role === 'Admin' && (
              <button
                onClick={onNewGroup}
                className="p-2 text-white hover:bg-green-700 rounded-full transition-colors"
                title="New Group"
              >
                <UserGroupIcon className="h-5 w-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-white hover:bg-green-700 rounded-full transition-colors"
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
            className="w-full pl-10 pr-3 py-2.5 bg-white border-0 rounded-lg text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-300"
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
                  className={`px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 ${
                    isActive 
                      ? 'bg-gray-100' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Avatar - WhatsApp style */}
                    <div className="relative flex-shrink-0">
                      {avatar ? (
                        <img
                          src={avatar}
                          alt={name}
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-gray-100"
                        />
                      ) : (
                        <div className="h-12 w-12 bg-gray-200 rounded-full flex items-center justify-center">
                          {item.type === 'group' ? (
                            <UserGroupIcon className="h-6 w-6 text-gray-500" />
                          ) : (
                            name.charAt(0).toUpperCase()
                          )}
                        </div>
                      )}
                      
                      {/* Online indicator for private chats */}
                      {(item.type === 'private' || item.isUser) && isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {name}
                        </p>
                        {/* Time for actual chats with messages */}
                        {!item.isUser && item.lastMessage && item.lastActivity && (
                          <span className="text-xs text-gray-500 font-medium">
                            {formatTime(item.lastActivity)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-600 truncate max-w-[200px]">
                          {item.isUser ? (
                            <span className={`${isOnline ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                              {subtitle}
                            </span>
                          ) : (
                            getLastMessagePreview(item)
                          )}
                        </p>
                        
                        {/* Unread count - WhatsApp style */}
                        {!item.isUser && item.unreadCount > 0 && (
                          <div className="bg-green-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] flex items-center justify-center font-medium shadow-sm">
                            {item.unreadCount > 99 ? '99+' : item.unreadCount}
                          </div>
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
