// Custom hook for optimized unread count management
import { useCallback, useEffect, useMemo } from 'react';

export const useUnreadCount = (chats, socket, activeChat) => {
  // Calculate total unread count efficiently
  const totalUnreadCount = useMemo(() => {
    return chats.reduce((sum, chat) => sum + (chat.unreadCount || 0), 0);
  }, [chats]);

  // Handle real-time unread count updates
  const handleUnreadCountUpdate = useCallback(({ chatId, increment, reset }) => {
    return (prevChats) => 
      prevChats.map(chat => {
        if (chat._id === chatId) {
          if (reset) {
            return { ...chat, unreadCount: 0 };
          } else if (increment) {
            // Only increment if this chat is not currently active
            const isCurrentlyActive = activeChat?._id === chatId;
            return { 
              ...chat, 
              unreadCount: isCurrentlyActive ? 0 : (chat.unreadCount || 0) + increment 
            };
          }
        }
        return chat;
      });
  }, [activeChat?._id]);

  // Reset unread count for specific chat
  const resetUnreadCount = useCallback((chatId) => {
    return (prevChats) => 
      prevChats.map(chat => 
        chat._id === chatId 
          ? { ...chat, unreadCount: 0 }
          : chat
      );
  }, []);

  // Setup socket listeners for unread count updates
  useEffect(() => {
    if (!socket) return;

    const handleUnreadUpdate = (data) => {
      // This will be handled by the parent component
      // as it needs access to setChats
    };

    socket.on('unread_count_update', handleUnreadUpdate);

    return () => {
      socket.off('unread_count_update', handleUnreadUpdate);
    };
  }, [socket]);

  return {
    totalUnreadCount,
    handleUnreadCountUpdate,
    resetUnreadCount
  };
};

export default useUnreadCount;