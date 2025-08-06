import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeftIcon, 
  PaperAirplaneIcon, 
  PaperClipIcon,
  EllipsisVerticalIcon,
  UserGroupIcon,
  UserIcon,
  CogIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../apiConfig';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import GroupManagementModal from './GroupManagementModal';

const ChatView = ({ chat, socket, onBack, onChatUpdate, onlineUsers, allUsers }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(new Set());
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (chat?._id && !chat.isTemporary) {
      fetchMessages();
      markMessagesAsRead();
    } else if (chat?.isTemporary) {
      // For temporary chats, start with empty messages
      setMessages([]);
      setLoading(false);
    }
  }, [chat?._id, chat?.isTemporary]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Mark messages as read when messages change (new message received while chat is active)
  useEffect(() => {
    if (messages.length > 0 && chat?._id && !chat.isTemporary) {
      markMessagesAsRead();
    }
  }, [messages.length, chat?._id]);

  useEffect(() => {
    if (socket && chat?._id && !chat.isTemporary) {
      // Join chat room
      socket.emit('join_chat', chat._id);

      // Listen for new messages
      socket.on('new_message', handleNewMessage);
      
      // Listen for typing indicators
      socket.on('user_typing', handleTypingIndicator);
      
      // Listen for message read updates
      socket.on('message_read_update', handleMessageReadUpdate);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('user_typing', handleTypingIndicator);
        socket.off('message_read_update', handleMessageReadUpdate);
        socket.emit('leave_chat', chat._id);
      };
    }
  }, [socket, chat?._id, chat?.isTemporary]);

  const fetchMessages = async () => {
    if (!chat?._id || !user?.token || chat.isTemporary) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/messages/${chat._id}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (response.ok) {
        const messagesData = await response.json();
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    if (!chat?._id || !user?.token) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/messages/${chat._id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      // Emit socket event to notify other users
      if (socket) {
        socket.emit('messages_read', { chatId: chat._id, userId: user._id });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleNewMessage = (message) => {
    if (message.chat === chat._id) {
      setMessages(prev => [...prev, message]);
      markMessagesAsRead();
    }
  };

  const handleTypingIndicator = ({ userId, chatId, isTyping }) => {
    if (chatId === chat._id && userId !== user._id) {
      setTyping(prev => {
        const newTyping = new Set(prev);
        if (isTyping) {
          newTyping.add(userId);
        } else {
          newTyping.delete(userId);
        }
        return newTyping;
      });
    }
  };

  const handleMessageReadUpdate = ({ messageId, userId, readAt }) => {
    setMessages(prev => 
      prev.map(msg => 
        msg._id === messageId 
          ? {
              ...msg,
              readBy: [...(msg.readBy || []), { user: userId, readAt }]
            }
          : msg
      )
    );
  };

  const sendMessage = async (content, type = 'text', file = null) => {
    if (!content.trim() && !file) return;

    try {
      let actualChat = chat;

      // If this is a temporary chat, create the real chat first
      if (chat.isTemporary) {
        const createChatResponse = await fetch(`${API_BASE_URL}/api/chats/private`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify({ participantId: chat.targetUser._id })
        });

        if (createChatResponse.ok) {
          actualChat = await createChatResponse.json();
          
          // Update parent component with the new chat
          onChatUpdate(actualChat, true); // true indicates it's a new chat
          
          // Join the chat room
          if (socket) {
            socket.emit('join_chat', actualChat._id);
          }
        } else {
          throw new Error('Failed to create chat');
        }
      }

      let response;
      
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        if (content) formData.append('content', content);

        response = await fetch(`${API_BASE_URL}/api/messages/${actualChat._id}/file`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${user.token}` },
          body: formData
        });
      } else {
        response = await fetch(`${API_BASE_URL}/api/messages/${actualChat._id}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}` 
          },
          body: JSON.stringify({ content, type })
        });
      }

      if (response.ok) {
        const newMessage = await response.json();
        setMessages(prev => [...prev, newMessage]);
        
        // Emit to socket
        if (socket) {
          socket.emit('send_message', {
            chatId: actualChat._id,
            message: newMessage
          });
        }

        // Update chat in parent
        onChatUpdate({
          ...actualChat,
          lastMessage: newMessage,
          lastActivity: newMessage.createdAt
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleTypingStart = () => {
    if (socket) {
      socket.emit('typing_start', { chatId: chat._id });
    }
  };

  const handleTypingStop = () => {
    if (socket) {
      socket.emit('typing_stop', { chatId: chat._id });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  const getChatDisplayInfo = () => {
    if (chat.type === 'group') {
      return {
        name: chat.name,
        avatar: chat.avatar?.url || null,
        subtitle: `${chat.participants.length} members`,
        isOnline: false
      };
    } else {
      const otherParticipant = chat.participants.find(p => p.user._id !== user?._id)?.user;
      const isOnline = onlineUsers.has(otherParticipant?._id);
      console.log(otherParticipant);
      // Use lastOnline from otherParticipant if available
      const lastSeen = otherParticipant?.lastSeen;
      return {
        name: otherParticipant ? `${otherParticipant.firstName} ${otherParticipant.lastName}` : 'Unknown',
        avatar: otherParticipant?.photo?.url || null,
        subtitle: isOnline ? 'Online' : `Last seen ${formatLastSeen(lastSeen)}`,
        isOnline
      };
    }
  };

  const isGroupAdmin = () => {
    if (chat.type !== 'group') return false;
    const participant = chat.participants?.find(p => p.user._id === user._id);
    return participant?.role === 'admin' || chat.createdBy === user._id;
  };

  const formatLastSeen = (lastSeen) => {
    if (!lastSeen) return 'recently';
    
    const date = new Date(lastSeen);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
    return date.toLocaleDateString();
  };

  const { name, avatar, subtitle, isOnline } = getChatDisplayInfo();

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Back button - only visible on mobile */}
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to chats"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            
            <div className="relative flex-shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                  {chat.type === 'group' ? (
                    <UserGroupIcon className="h-5 w-5 text-gray-500" />
                  ) : (
                    <UserIcon className="h-5 w-5 text-gray-500" />
                  )}
                </div>
              )}
              
              {chat.type === 'private' && isOnline && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            
            <div className="min-w-0 flex-1">
              <p className="text-base font-medium text-gray-900 truncate">{name}</p>
              <p className="text-sm text-gray-500 truncate">{subtitle}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <EllipsisVerticalIcon className="h-5 w-5" />
              </button>
              
              {/* Dropdown Menu */}
              {showDropdown && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  {chat.type === 'group' && isGroupAdmin() && (
                    <button
                      onClick={() => {
                        setShowGroupManagement(true);
                        setShowDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <CogIcon className="h-4 w-4" />
                      <span>Group Settings</span>
                    </button>
                  )}
                  {chat.type === 'group' && (
                    <button
                      onClick={() => {
                        // Show group info (members list)
                        setShowDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <UserGroupIcon className="h-4 w-4" />
                      <span>Group Info</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f3f4f6' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}
      >
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-4xl mb-2">👋</div>
            <p className="text-sm text-center">
              Say hello to start the conversation!
            </p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageBubble
                key={message._id}
                message={message}
                isOwn={message.sender._id === user?._id}
                showAvatar={
                  chat?.type === 'group' && (
                    index === 0 || 
                    messages[index - 1].sender._id !== message.sender._id
                  )
                }
                showTimestamp={
                  index === messages.length - 1 || 
                  messages[index + 1]?.sender._id !== message.sender._id ||
                  new Date(messages[index + 1]?.createdAt) - new Date(message.createdAt) > 300000 // 5 minutes
                }
              />
            ))}
            
            {/* Typing indicators */}
            {typing.size > 0 && (
              <div className="flex items-center space-x-2 text-gray-500 text-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span>Someone is typing...</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-gray-200 bg-white">
        <MessageInput
          onSendMessage={sendMessage}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
        />
      </div>

      {/* Group Management Modal */}
      {showGroupManagement && (
        <GroupManagementModal
          isOpen={showGroupManagement}
          onClose={() => setShowGroupManagement(false)}
          chat={chat}
          allUsers={allUsers || []}
          onChatUpdate={onChatUpdate}
        />
      )}
    </div>
  );
};

export default ChatView;
