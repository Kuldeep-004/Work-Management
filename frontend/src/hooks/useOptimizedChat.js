// Custom hook for optimized chat management - WhatsApp level performance
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';

export const useOptimizedChat = (socket) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [chatPage, setChatPage] = useState(1);
  const { user } = useAuth();
  
  // Refs for performance optimization
  const lastMessageRef = useRef(null);
  const loadingRef = useRef(false);
  const chatsCache = useRef(new Map());

  // Memoized API headers
  const apiHeaders = useMemo(() => ({
    Authorization: `Bearer ${user?.token}`
  }), [user?.token]);

  // Optimized chat fetching with caching
  const fetchChats = useCallback(async (page = 1, append = false) => {
    if (!user?.token || loadingRef.current) return;
    
    try {
      loadingRef.current = true;
      if (!append) setLoading(true);
      
      const cacheKey = `chats_${page}`;
      
      // Check cache first
      if (chatsCache.current.has(cacheKey) && Date.now() - chatsCache.current.get(cacheKey).timestamp < 30000) {
        const cachedData = chatsCache.current.get(cacheKey).data;
        if (append) {
          setChats(prev => [...prev, ...cachedData]);
        } else {
          setChats(cachedData);
        }
        setHasMoreChats(cachedData.length === 50);
        setChatPage(page);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/chats?page=${page}&limit=50`, {
        headers: apiHeaders
      });
      
      if (response.ok) {
        const chatsData = await response.json();
        
        // Cache the response
        chatsCache.current.set(cacheKey, {
          data: chatsData,
          timestamp: Date.now()
        });
        
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
      setLoading(false);
      loadingRef.current = false;
    }
  }, [user?.token, apiHeaders]);

  // Optimized message handling with deduplication
  const handleNewMessage = useCallback((message) => {
    // Prevent duplicate message handling
    if (lastMessageRef.current === message._id) return;
    lastMessageRef.current = message._id;

    setChats(prevChats => {
      const updatedChats = prevChats.map(chat => {
        if (chat._id === message.chat) {
          return { 
            ...chat, 
            lastMessage: message, 
            lastActivity: message.createdAt,
            unreadCount: message.sender._id === user._id ? 0 : (chat.unreadCount || 0) + 1
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

    // Invalidate cache for affected pages
    chatsCache.current.clear();
  }, [user._id]);

  // Optimized chat update handling
  const handleChatUpdate = useCallback((updatedChat, isNewChat = false) => {
    if (isNewChat) {
      setChats(prev => [updatedChat, ...prev]);
    } else {
      setChats(prev => {
        const filteredChats = prev.filter(chat => chat._id !== updatedChat._id);
        return [updatedChat, ...filteredChats];
      });
    }
    
    // Invalidate cache
    chatsCache.current.clear();
  }, []);

  // Optimized unread count reset
  const resetUnreadCount = useCallback((chatId) => {
    setChats(prevChats => 
      prevChats.map(chat => 
        chat._id === chatId 
          ? { ...chat, unreadCount: 0 }
          : chat
      )
    );
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('new_message', handleNewMessage);
    socket.on('messages_read', ({ chatId, userId }) => {
      if (userId === user._id) {
        resetUnreadCount(chatId);
      }
    });

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('messages_read');
    };
  }, [socket, handleNewMessage, resetUnreadCount, user._id]);

  // Load more chats for pagination
  const loadMoreChats = useCallback(() => {
    if (hasMoreChats && !loadingRef.current) {
      fetchChats(chatPage + 1, true);
    }
  }, [hasMoreChats, chatPage, fetchChats]);

  // Initial load
  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // Calculate total unread count efficiently
  const totalUnreadCount = useMemo(() => {
    return chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
  }, [chats]);

  return {
    chats,
    loading,
    hasMoreChats,
    loadMoreChats,
    fetchChats,
    handleChatUpdate,
    resetUnreadCount,
    totalUnreadCount,
    refreshChats: () => {
      chatsCache.current.clear();
      fetchChats(1, false);
    }
  };
};

// Hook for optimized message management
export const useOptimizedMessages = (chatId, socket) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);
  const { user } = useAuth();
  
  const isLoadingRef = useRef(false);
  const messagesCache = useRef(new Map());

  // Memoized API headers
  const apiHeaders = useMemo(() => ({
    Authorization: `Bearer ${user?.token}`
  }), [user?.token]);

  // Optimized message fetching
  const fetchMessages = useCallback(async (loadMore = false) => {
    if (!chatId || !user?.token || isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      if (loadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setMessages([]);
      }
      
      let url = `${API_BASE_URL}/api/messages/${chatId}?limit=30`;
      if (loadMore && nextCursor) {
        url += `&before=${nextCursor}`;
      }
      
      // Check cache for initial load
      const cacheKey = `messages_${chatId}_${nextCursor || 'initial'}`;
      if (!loadMore && messagesCache.current.has(cacheKey)) {
        const cachedData = messagesCache.current.get(cacheKey);
        if (Date.now() - cachedData.timestamp < 10000) { // 10 second cache
          setMessages(cachedData.data.messages);
          setHasMoreMessages(cachedData.data.hasMore);
          setNextCursor(cachedData.data.nextCursor);
          setLoading(false);
          isLoadingRef.current = false;
          return;
        }
      }
      
      const response = await fetch(url, { headers: apiHeaders });
      
      if (response.ok) {
        const data = await response.json();
        
        // Cache the response
        if (!loadMore) {
          messagesCache.current.set(cacheKey, {
            data,
            timestamp: Date.now()
          });
        }
        
        if (loadMore) {
          setMessages(prev => [...data.messages, ...prev]);
        } else {
          setMessages(data.messages);
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
  }, [chatId, user?.token, nextCursor, apiHeaders]);

  // Optimized message addition
  const addMessage = useCallback((message) => {
    setMessages(prev => [...prev, message]);
    // Invalidate cache
    messagesCache.current.clear();
  }, []);

  // Mark messages as read efficiently
  const markAsRead = useCallback(async () => {
    if (!chatId || !user?.token) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/messages/${chatId}/read`, {
        method: 'POST',
        headers: apiHeaders
      });
      
      if (socket) {
        socket.emit('messages_read', { chatId, userId: user._id });
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [chatId, user?.token, user._id, socket, apiHeaders]);

  // Socket event listeners for real-time updates
  useEffect(() => {
    if (!socket || !chatId) return;

    const handleNewMessage = (message) => {
      if (message.chat === chatId) {
        addMessage(message);
        markAsRead();
      }
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
    };
  }, [socket, chatId, addMessage, markAsRead]);

  // Load more messages
  const loadMoreMessages = useCallback(() => {
    if (hasMoreMessages && !isLoadingRef.current) {
      fetchMessages(true);
    }
  }, [hasMoreMessages, fetchMessages]);

  // Initial load and reset when chat changes
  useEffect(() => {
    if (chatId) {
      setMessages([]);
      setNextCursor(null);
      setHasMoreMessages(true);
      messagesCache.current.clear();
      fetchMessages();
    }
  }, [chatId, fetchMessages]);

  return {
    messages,
    loading,
    loadingMore,
    hasMoreMessages,
    loadMoreMessages,
    addMessage,
    markAsRead,
    fetchMessages
  };
};

// Hook for optimized typing indicators
export const useTypingIndicators = (chatId, socket) => {
  const [typing, setTyping] = useState(new Set());
  const { user } = useAuth();
  const typingTimeoutRef = useRef(null);

  const startTyping = useCallback(() => {
    if (socket && chatId) {
      socket.emit('typing_start', { chatId });
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Auto-stop typing after 3 seconds
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', { chatId });
      }, 3000);
    }
  }, [socket, chatId]);

  const stopTyping = useCallback(() => {
    if (socket && chatId) {
      socket.emit('typing_stop', { chatId });
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
  }, [socket, chatId]);

  useEffect(() => {
    if (!socket || !chatId) return;

    const handleTyping = ({ userId, chatId: typingChatId, isTyping }) => {
      if (typingChatId === chatId && userId !== user._id) {
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

    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('user_typing', handleTyping);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [socket, chatId, user._id]);

  return {
    typing,
    startTyping,
    stopTyping
  };
};