import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import ChatSidebar from './ChatSidebar';
import ChatView from './ChatView';
import NewGroupModal from './NewGroupModal';
import { API_BASE_URL } from '../apiConfig';
import io from 'socket.io-client';

const ChatWindow = ({ onClose, onUnreadCountChange }) => {
  const [activeChat, setActiveChat] = useState(null);
  const [chats, setChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [chatPage, setChatPage] = useState(1); // For pagination
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const { user } = useAuth();
  const windowRef = useRef(null);
  const lastMessageRef = useRef(null); // For preventing duplicate message handling

  // Memoize socket connection to prevent reconnections
  const socketConnection = useMemo(() => {
    if (!user?.token) return null;
    
    const newSocket = io(API_BASE_URL, {
      autoConnect: false,
      forceNew: false,
      transports: ['websocket', 'polling'], // WebSocket first for better performance
    });
    
    return newSocket;
  }, [user?.token]);

  // Optimize message handling with useCallback to prevent unnecessary re-renders
  const handleNewMessage = useCallback((message) => {
    // Prevent duplicate message handling
    if (lastMessageRef.current === message._id) return;
    lastMessageRef.current = message._id;

    setChats(prevChats => {
      const updatedChats = prevChats.map(chat => {
        if (chat._id === message.chat) {
          const isActiveChat = activeChat?._id === message.chat;
          const isOwnMessage = message.sender._id === user._id;
          
          return { 
            ...chat, 
            lastMessage: message, 
            lastActivity: message.createdAt,
            unreadCount: (isActiveChat || isOwnMessage) ? 0 : (chat.unreadCount || 0) + 1
          };
        }
        return chat;
      });
      
      // Move updated chat to top efficiently
      const chatIndex = updatedChats.findIndex(chat => chat._id === message.chat);
      if (chatIndex > 0) {
        const [chatToMove] = updatedChats.splice(chatIndex, 1);
        return [chatToMove, ...updatedChats];
      }
      
      return updatedChats;
    });
  }, [activeChat?._id, user._id]);

  // Optimize message read handling
  const handleMessagesRead = useCallback(({ chatId, userId }) => {
    if (userId === user._id) {
      setChats(prevChats => 
        prevChats.map(chat => 
          chat._id === chatId 
            ? { ...chat, unreadCount: 0 }
            : chat
        )
      );
    }
  }, [user._id]);

  // Optimize online status handling
  const handleUserOnline = useCallback(({ userId, isOnline }) => {
    setOnlineUsers(prev => {
      const newSet = new Set(prev);
      if (isOnline) {
        newSet.add(userId);
      } else {
        newSet.delete(userId);
      }
      return newSet;
    });
  }, []);

  // Initialize socket connection with optimizations
  useEffect(() => {
    if (!socketConnection) return;

    socketConnection.connect();
    
    // Authenticate with the server
    socketConnection.emit('authenticate', user.token);
    
    // Handle authentication error
    socketConnection.on('auth_error', (error) => {
      console.error('Socket authentication error:', error);
    });

    // Attach optimized event handlers
    socketConnection.on('new_message', handleNewMessage);
    socketConnection.on('messages_read', handleMessagesRead);
    socketConnection.on('user_online', handleUserOnline);

    setSocket(socketConnection);

    return () => {
      socketConnection.off('new_message', handleNewMessage);
      socketConnection.off('messages_read', handleMessagesRead);
      socketConnection.off('user_online', handleUserOnline);
      socketConnection.disconnect();
    };
  }, [socketConnection, handleNewMessage, handleMessagesRead, handleUserOnline, user.token]);

  // Fetch chats
  useEffect(() => {
    fetchChats();
    fetchAllUsers();
  }, [user?.token]);

  // Calculate total unread count
  useEffect(() => {
    const totalUnread = chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
    onUnreadCountChange(totalUnread);
  }, [chats, onUnreadCountChange]);

  // Optimized fetch chats with pagination and memoization
  const fetchChats = useCallback(async (page = 1, append = false) => {
    if (!user?.token) return;
    
    try {
      if (!append) setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/chats?page=${page}&limit=50`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (response.ok) {
        const chatsData = await response.json();
        
        if (append) {
          setChats(prev => [...prev, ...chatsData]);
        } else {
          setChats(chatsData);
        }
        
        setHasMoreChats(chatsData.length === 50);
        setChatPage(page);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      if (!append) setLoading(false);
    }
  }, [user?.token]);

  // Memoized fetch all users
  const fetchAllUsers = useCallback(async () => {
    if (!user?.token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/users/all`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (response.ok) {
        const usersData = await response.json();
        setAllUsers(usersData);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }, [user?.token]);

  const handleChatSelect = (chat) => {
    setActiveChat(chat);
    setShowMobileChat(true); // Show chat on mobile
    
    // Reset unread count when chat is selected
    if (chat.unreadCount > 0) {
      setChats(prevChats => 
        prevChats.map(c => 
          c._id === chat._id 
            ? { ...c, unreadCount: 0 }
            : c
        )
      );
    }
    
    if (socket) {
      socket.emit('join_chat', chat._id);
    }
  };

  const handleUserSelect = async (selectedUser) => {
    // Check if chat already exists
    const existingChat = chats.find(chat => 
      chat && chat.type === 'private' && 
      Array.isArray(chat.participants) &&
      chat.participants.some(p => p && p.user && p.user._id === selectedUser?._id)
    );

    if (existingChat) {
      setActiveChat(existingChat);
      setShowMobileChat(true); // Show chat on mobile
      if (socket) {
        socket.emit('join_chat', existingChat._id);
      }
    } else {
      // Create a temporary chat object for new conversation
      const tempChat = {
        _id: `temp_${selectedUser._id}`,
        type: 'private',
        participants: [
          { user: user },
          { user: selectedUser }
        ],
        isTemporary: true,
        targetUser: selectedUser
      };
      
      setActiveChat(tempChat);
      setShowMobileChat(true); // Show chat on mobile
      // Don't add to chats list yet - only add when first message is sent
    }
  };

  const handleNewGroup = (newChat) => {
    setChats(prev => [newChat, ...prev]);
    setActiveChat(newChat);
    setShowMobileChat(true); // Show chat on mobile
    setIsNewGroupModalOpen(false);
  };

  // Function to handle mobile back navigation
  const handleMobileBack = () => {
    setShowMobileChat(false);
  };

  const handleCreateGroup = async (groupData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chats/group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`
        },
        body: JSON.stringify(groupData)
      });

      if (response.ok) {
        const newGroup = await response.json();
        setChats(prev => [newGroup, ...prev]);
        setActiveChat(newGroup);
        if (socket) {
          socket.emit('join_chat', newGroup._id);
        }
        setIsNewGroupModalOpen(false);
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create group');
      }
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  };

  const handleChatUpdate = (updatedChat, isDeletedOrNewChat = false) => {
    if (isDeletedOrNewChat && !updatedChat) {
      // Group was deleted - remove from chats and clear active chat if it was selected
      if (activeChat) {
        setChats(prev => prev.filter(chat => chat._id !== activeChat._id));
        setActiveChat(null);
        setShowMobileChat(false);
      }
    } else if (isDeletedOrNewChat && updatedChat) {
      // Add new chat to the top of the list
      setChats(prev => [updatedChat, ...prev]);
      setActiveChat(updatedChat);
    } else if (updatedChat) {
      // Update existing chat and move to top (WhatsApp behavior)
      setChats(prev => {
        const filteredChats = prev.filter(chat => chat._id !== updatedChat._id);
        return [updatedChat, ...filteredChats];
      });
      if (activeChat?._id === updatedChat._id) {
        setActiveChat(updatedChat);
      }
    }
  };

  return (
    <div 
      ref={windowRef}
      className="bg-white h-full w-full md:rounded-lg md:shadow-2xl md:border border-gray-200 overflow-hidden"
      style={{ 
        // Desktop styles only
        ...(window.innerWidth >= 768 && {
          width: '85vw', 
          height: '80vh',
          maxWidth: '1200px',
          maxHeight: '800px',
          minWidth: '600px',
          minHeight: '500px',
        }),
        boxShadow: window.innerWidth >= 768 ? '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' : 'none'
      }}
    >
      <div className="flex h-full">
        {/* Sidebar - Chat List - Desktop: fixed width, Mobile: full width */}
        <div className={`w-full md:w-80 border-r border-gray-200 bg-gray-50 flex-shrink-0 ${showMobileChat ? 'hidden md:block' : 'block'}`}>
          <ChatSidebar
            chats={chats}
            allUsers={allUsers}
            activeChat={activeChat}
            onChatSelect={handleChatSelect}
            onUserSelect={handleUserSelect}
            onNewGroup={() => {
              if (user?.role === 'Admin') {
                setIsNewGroupModalOpen(true);
              }
            }}
            loading={loading}
            onlineUsers={onlineUsers}
            onClose={onClose}
          />
        </div>

        {/* Chat View - Desktop: show when selected, Mobile: show when showMobileChat is true */}
        {activeChat && (
          <div className={`flex-1 flex flex-col min-w-0 ${showMobileChat ? 'block' : 'hidden md:flex'}`}>
            <ChatView
              chat={activeChat}
              socket={socket}
              onBack={handleMobileBack}
              onChatUpdate={handleChatUpdate}
              onlineUsers={onlineUsers}
              allUsers={allUsers}
            />
          </div>
        )}

        {/* Empty state - only show on desktop when no chat is selected */}
        {!activeChat && (
          <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50">
            <div className="text-center text-gray-300">
              <div className="text-8xl font-bold mb-4">HAACAS</div>
              <p className="text-xl">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* New Group Modal */}
      <NewGroupModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        allUsers={allUsers}
        onCreateGroup={handleCreateGroup}
      />
    </div>
  );
};

export default ChatWindow;
