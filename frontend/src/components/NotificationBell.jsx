import { useState, useEffect, useRef } from 'react';
import { BellIcon, XMarkIcon, InboxIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchNotifications = async () => {
    if (!user?.token) return;
    try {
      setLoading(true);
      const [notificationsRes, unreadRes] = await Promise.all([
        fetch('http://localhost:5000/api/notifications', {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        fetch('http://localhost:5000/api/notifications/unread-count', {
          headers: { Authorization: `Bearer ${user.token}` },
        })
      ]);
      if (notificationsRes.ok && unreadRes.ok) {
        const notificationsData = await notificationsRes.json();
        const unreadData = await unreadRes.json();
        setNotifications(notificationsData);
        setUnreadCount(unreadData.count);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const handleDeleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (response.ok) {
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        const unreadRes = await fetch('http://localhost:5000/api/notifications/unread-count', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (unreadRes.ok) {
          const unreadData = await unreadRes.json();
          setUnreadCount(unreadData.count);
        }
        toast.success('Notification deleted');
      } else {
        toast.error('Failed to delete notification');
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const response = await fetch(`http://localhost:5000/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const formatTime = (timestamp) => {
    const now = new Date();
    const notificationTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now - notificationTime) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <BellIcon className="h-7 w-7" />
        {unreadCount > 0 && (
          <span className="animate-ping absolute -top-1 -right-1 inline-flex h-5 w-5 rounded-full bg-red-400 opacity-75"></span>
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold shadow-md border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-96 max-w-[95vw] rounded-2xl shadow-2xl z-50 border border-gray-200 backdrop-blur-xl bg-white/90 ring-1 ring-black/5 transition-all duration-200" style={{ minWidth: '320px' }}>
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-indigo-500 font-semibold bg-indigo-50 px-2 py-1 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto custom-scrollbar bg-transparent">
            {loading ? (
              <div className="p-6 text-center text-gray-400 text-base font-medium">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <InboxIcon className="h-12 w-12 mb-2" />
                <span className="text-base font-medium">No notifications</span>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`group flex items-start gap-3 px-4 py-4 transition-all duration-150 cursor-pointer ${!notification.isRead ? 'bg-indigo-50/80' : 'bg-white'} hover:bg-indigo-100/80 rounded-xl shadow-sm mb-2`}
                    onClick={() => !notification.isRead && handleMarkAsRead(notification._id)}
                    style={{ boxShadow: !notification.isRead ? '0 2px 8px 0 rgba(99,102,241,0.08)' : '0 1px 4px 0 rgba(0,0,0,0.03)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 font-semibold">
                          {notification.message}
                        </span>
                        {!notification.isRead && (
                          <span className="ml-1 w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        from <span className="font-medium text-indigo-600">{notification.assigner?.firstName} {notification.assigner?.lastName}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {formatTime(notification.createdAt)}
                      </div>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handleDeleteNotification(notification._id);
                      }}
                      className="ml-2 p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors focus:outline-none focus:ring-2 focus:ring-red-200"
                      aria-label="Delete notification"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell; 