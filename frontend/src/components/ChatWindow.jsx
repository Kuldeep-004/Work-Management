import { useState, useEffect, useRef } from 'react';
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
  const [showMobileChat, setShowMobileChat] = useState(false); // Mobile navigation state
  const { user } = useAuth();
  const windowRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    if (user?.token) {
      const newSocket = io(API_BASE_URL, {
        autoConnect: false
      });

      newSocket.connect();
      
      // Authenticate with the server
      newSocket.emit('authenticate', user.token);
      
      // Handle authentication error
      newSocket.on('auth_error', (error) => {
        console.error('Socket authentication error:', error);
      });

      // Handle new messages
      newSocket.on('new_message', (message) => {
        setChats(prevChats => {
          const updatedChats = prevChats.map(chat => {
            if (chat._id === message.chat) {
              // If this chat is currently active, don't increment unread count
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
          
          // Move the updated chat to the top (WhatsApp behavior)
          const chatIndex = updatedChats.findIndex(chat => chat._id === message.chat);
          if (chatIndex > 0) {
            const [chatToMove] = updatedChats.splice(chatIndex, 1);
            return [chatToMove, ...updatedChats];
          }
          
          return updatedChats;
        });
      });

      // Handle message read updates
      newSocket.on('messages_read', ({ chatId, userId }) => {
        if (userId === user._id) {
          // Reset unread count when current user reads messages
          setChats(prevChats => 
            prevChats.map(chat => 
              chat._id === chatId 
                ? { ...chat, unreadCount: 0 }
                : chat
            )
          );
        }
      });

      // Handle user online status
      newSocket.on('user_online', ({ userId, isOnline }) => {
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          if (isOnline) {
            newSet.add(userId);
          } else {
            newSet.delete(userId);
          }
          return newSet;
        });
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user?.token]);

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

  const fetchChats = async () => {
    if (!user?.token) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/chats`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (response.ok) {
        const chatsData = await response.json();
        setChats(chatsData);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllUsers = async () => {
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
  };

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

  const handleChatUpdate = (updatedChat, isNewChat = false) => {
    if (isNewChat) {
      // Add new chat to the top of the list
      setChats(prev => [updatedChat, ...prev]);
      setActiveChat(updatedChat);
    } else {
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
            onNewGroup={() => setIsNewGroupModalOpen(true)}
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
