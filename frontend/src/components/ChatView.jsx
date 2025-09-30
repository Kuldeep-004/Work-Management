import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeftIcon, 
  PaperAirplaneIcon, 
  PaperClipIcon,
  EllipsisVerticalIcon,
  UserGroupIcon,
  UserIcon,
  CogIcon,
  UserPlusIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../apiConfig';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import GroupManagementModal from './GroupManagementModal';

const ChatView = ({ chat, socket, onBack, onChatUpdate, onlineUsers, allUsers }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [typing, setTyping] = useState(new Set());
  const [showDropdown, setShowDropdown] = useState(false);
  const [showGroupManagement, setShowGroupManagement] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(false);
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const dropdownRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isLoadingRef = useRef(false); // Prevent duplicate loading
  const previousScrollHeight = useRef(0);

  // Memoize chat display info for better performance
  const chatDisplayInfo = useMemo(() => {
    if (chat.type === 'group') {
      return {
        name: chat.name,
        avatar: chat.avatar?.url || null,
        subtitle: `${chat.participants?.length || 0} participants`
      };
    } else {
      const otherParticipant = chat.participants?.find(p => p.user._id !== user._id);
      const isOnline = onlineUsers.has(otherParticipant?.user._id);
      return {
        name: otherParticipant ? `${otherParticipant.user.firstName} ${otherParticipant.user.lastName}` : 'Unknown User',
        avatar: otherParticipant?.user.photo?.url || null,
        subtitle: isOnline ? 'Online' : 'Offline'
      };
    }
  }, [chat, user._id, onlineUsers]);

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
      setIsInitialLoad(true);
      fetchMessages();
      markMessagesAsRead();
    } else if (chat?.isTemporary) {
      // For temporary chats, start with empty messages
      setMessages([]);
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [chat?._id, chat?.isTemporary]);

  // Smart scroll management - only scroll to bottom when needed
  useEffect(() => {
    if (shouldScrollToBottom) {
      scrollToBottom();
      setShouldScrollToBottom(false);
    }
  }, [messages, shouldScrollToBottom]);

  // Mark messages as read when messages change (new message received while chat is active)
  useEffect(() => {
    if (messages.length > 0 && chat?._id && !chat.isTemporary) {
      markMessagesAsRead();
    }
  }, [messages.length, chat?._id]);

  // Optimized message read marking
  const markMessagesAsRead = useCallback(async () => {
    if (!chat?._id || !user?.token || chat.isTemporary) return;
    
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
  }, [chat?._id, user?.token, user._id, socket, chat?.isTemporary]);

  // Optimized message handlers
  const handleNewMessage = useCallback((message) => {
    if (message.chat === chat._id) {
      setMessages(prev => [...prev, message]);
      // Always scroll to bottom when new message arrives
      setShouldScrollToBottom(true);
      markMessagesAsRead();
    }
  }, [chat._id, markMessagesAsRead]);

  const handleTypingIndicator = useCallback(({ userId, chatId, isTyping }) => {
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
  }, [chat._id, user._id]);

  const handleMessageReadUpdate = useCallback(({ messageId, userId, readAt }) => {
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
  }, []);

  const handleMessageDelivered = useCallback(({ messageId, deliveredAt }) => {
    setMessages(prev => 
      prev.map(msg => 
        msg._id === messageId 
          ? {
              ...msg,
              deliveredTo: [...(msg.deliveredTo || []), { user: user._id, deliveredAt }]
            }
          : msg
      )
    );
  }, [user._id]);

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
      
      // Listen for message delivery confirmations
      socket.on('message_delivered', handleMessageDelivered);

      return () => {
        socket.off('new_message', handleNewMessage);
        socket.off('user_typing', handleTypingIndicator);
        socket.off('message_read_update', handleMessageReadUpdate);
        socket.off('message_delivered', handleMessageDelivered);
        socket.emit('leave_chat', chat._id);
      };
    }
  }, [socket, chat?._id, chat?.isTemporary, handleNewMessage, handleTypingIndicator, handleMessageReadUpdate, handleMessageDelivered]);

  // Optimized message fetching with cursor-based pagination
  const fetchMessages = useCallback(async (loadMore = false) => {
    if (!chat?._id || !user?.token || chat.isTemporary || isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      if (loadMore) {
        setLoadingMore(true);
        // Store current scroll position before loading more
        if (chatContainerRef.current) {
          previousScrollHeight.current = chatContainerRef.current.scrollHeight;
        }
      } else {
        setLoading(true);
        setMessages([]);
      }
      
      let url = `${API_BASE_URL}/api/messages/${chat._id}?limit=30`;
      if (loadMore && nextCursor) {
        url += `&before=${nextCursor}`;
      }
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (loadMore) {
          setMessages(prev => [...data.messages, ...prev]);
          // Don't scroll to bottom when loading more messages
        } else {
          setMessages(data.messages);
          // Only scroll to bottom on initial load when chat opens
          if (isInitialLoad) {
            setShouldScrollToBottom(true);
            setIsInitialLoad(false);
          }
        }
        
        setHasMoreMessages(data.hasMore);
        setNextCursor(data.nextCursor);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [chat?._id, user?.token, chat?.isTemporary, nextCursor, isInitialLoad]);

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
        // Scroll to bottom when user sends a message
        setShouldScrollToBottom(true);
        
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

  // Optimized typing handlers with debouncing
  const handleTypingStart = useCallback(() => {
    if (socket && chat._id) {
      socket.emit('typing_start', { chatId: chat._id });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', { chatId: chat._id });
      }, 3000);
    }
  }, [socket, chat._id]);

  const handleTypingStop = useCallback(() => {
    if (socket && chat._id) {
      socket.emit('typing_stop', { chatId: chat._id });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [socket, chat._id]);

  // Optimized scroll management
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  // Load more messages when scrolling to top
  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (container && container.scrollTop === 0 && hasMoreMessages && !loadingMore) {
      fetchMessages(true);
    }
  }, [hasMoreMessages, loadingMore, fetchMessages]);

  // Maintain scroll position after loading more messages
  useEffect(() => {
    if (loadingMore === false && chatContainerRef.current && previousScrollHeight.current > 0) {
      const container = chatContainerRef.current;
      const newScrollHeight = container.scrollHeight;
      const scrollDifference = newScrollHeight - previousScrollHeight.current;
      container.scrollTop = scrollDifference;
      previousScrollHeight.current = 0;
    }
  }, [loadingMore]);

  const isGroupAdmin = () => {
    if (chat.type !== 'group') return false;
    // Only system admins can manage groups
    return user?.role === 'Admin';
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header - WhatsApp style */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center space-x-3 flex-1">
            {/* Back button - only visible on mobile */}
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
              title="Back to chats"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            
            {/* Chat Avatar */}
            <div className="relative flex-shrink-0">
              {chatDisplayInfo.avatar ? (
                <img
                  src={chatDisplayInfo.avatar}
                  alt={chatDisplayInfo.name}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-gray-100"
                />
              ) : (
                <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                  {chat.type === 'group' ? (
                    <UserGroupIcon className="h-5 w-5" />
                  ) : (
                    chatDisplayInfo.name.charAt(0).toUpperCase()
                  )}
                </div>
              )}
              
              {/* Online indicator for private chats */}
              {chat.type === 'private' && onlineUsers.has(chat.participants?.find(p => p.user._id !== user._id)?.user._id) && (
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            
            {/* Chat Info */}
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold text-gray-900 truncate">{chatDisplayInfo.name}</p>
              <p className="text-sm text-gray-500 truncate">
                {chat.type === 'group' ? (
                  <span className="flex items-center">
                    <UserGroupIcon className="h-3 w-3 mr-1" />
                    {chatDisplayInfo.subtitle}
                  </span>
                ) : (
                  <span className={`${chatDisplayInfo.subtitle === 'Online' ? 'text-green-600 font-medium' : ''}`}>
                    {chatDisplayInfo.subtitle}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-1">
            {/* Group info button */}
            {chat.type === 'group' && (
              <button
                onClick={() => setShowGroupManagement(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Group Info"
              >
                <UserGroupIcon className="h-5 w-5" />
              </button>
            )}
            
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
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

      {/* Messages Container - WhatsApp style */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 bg-gray-50"
        onScroll={handleScroll}
        style={{ 
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23f3f4f6' fill-opacity='0.03' fill-rule='evenodd'%3E%3Cpath d='m0 40l40-40h-40v40zm40 0v-40h-40l40 40z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat'
        }}
      >
        {/* Loading more indicator */}
        {loadingMore && (
          <div className="flex justify-center items-center py-4">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500"></div>
            <span className="ml-2 text-sm text-gray-500">Loading more messages...</span>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 px-8">
            <div className="text-6xl mb-4">�</div>
            <p className="text-lg font-medium mb-2 text-center">
              {chat?.type === 'group' ? 'Start the conversation' : 'Say hello!'}
            </p>
            <p className="text-sm text-center opacity-75">
              {chat?.type === 'group' 
                ? 'Send a message to get the group chat started' 
                : 'Send a message to start your conversation'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((message, index) => (
              <MessageBubble
                key={message._id}
                message={message}
                isOwn={message.sender._id === user?._id}
                showAvatar={chat?.type === 'group'} // Always show avatar in group chats
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
          </div>
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
