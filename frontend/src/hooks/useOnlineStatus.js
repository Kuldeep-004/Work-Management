// Custom hook for enhanced online status management
import { useEffect, useRef, useCallback } from 'react';

export const useOnlineStatus = (socket, isInChatSection = false) => {
  const heartbeatIntervalRef = useRef(null);
  const pageVisibilityRef = useRef(true);
  const isInChatRef = useRef(isInChatSection);

  // Update chat section status
  useEffect(() => {
    isInChatRef.current = isInChatSection;
    
    if (socket) {
      if (isInChatSection) {
        socket.emit('enter_chat_section');
      } else {
        socket.emit('leave_chat_section');
      }
    }
  }, [socket, isInChatSection]);

  // Heartbeat mechanism
  const sendHeartbeat = useCallback(() => {
    if (socket && socket.connected) {
      socket.emit('heartbeat');
    }
  }, [socket]);

  // Page visibility API
  const handleVisibilityChange = useCallback(() => {
    const isVisible = !document.hidden;
    pageVisibilityRef.current = isVisible;
    
    if (socket) {
      socket.emit('page_visibility', { isVisible });
    }
    
    // Adjust heartbeat frequency based on visibility
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    if (isVisible) {
      // Send heartbeat every 10 seconds when page is visible
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, 10000);
    } else {
      // Send heartbeat every 30 seconds when page is hidden
      heartbeatIntervalRef.current = setInterval(sendHeartbeat, 30000);
    }
  }, [socket, sendHeartbeat]);

  // Mouse and keyboard activity detection
  const handleUserActivity = useCallback(() => {
    if (pageVisibilityRef.current && socket) {
      sendHeartbeat();
    }
  }, [socket, sendHeartbeat]);

  // Setup event listeners
  useEffect(() => {
    if (!socket) return;

    // Start heartbeat when socket is ready
    if (socket.connected) {
      handleVisibilityChange(); // Initialize heartbeat
    }

    // Page visibility change
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // User activity detection (throttled)
    let activityTimeout;
    const throttledActivity = () => {
      if (activityTimeout) return;
      activityTimeout = setTimeout(() => {
        handleUserActivity();
        activityTimeout = null;
      }, 5000); // Throttle to every 5 seconds
    };
    
    document.addEventListener('mousemove', throttledActivity);
    document.addEventListener('keydown', throttledActivity);
    document.addEventListener('click', throttledActivity);
    document.addEventListener('scroll', throttledActivity);

    // Beforeunload event
    const handleBeforeUnload = () => {
      if (socket) {
        socket.emit('leave_chat_section');
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Focus events
    const handleFocus = () => {
      pageVisibilityRef.current = true;
      if (socket) {
        socket.emit('page_visibility', { isVisible: true });
        if (isInChatRef.current) {
          socket.emit('enter_chat_section');
        }
      }
    };
    
    const handleBlur = () => {
      pageVisibilityRef.current = false;
      if (socket) {
        socket.emit('page_visibility', { isVisible: false });
        socket.emit('leave_chat_section');
      }
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('mousemove', throttledActivity);
      document.removeEventListener('keydown', throttledActivity);
      document.removeEventListener('click', throttledActivity);
      document.removeEventListener('scroll', throttledActivity);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [socket, handleVisibilityChange, handleUserActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);
};

export default useOnlineStatus;