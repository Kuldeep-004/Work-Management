import express from 'express';
import Notification from '../models/Notification.js';
import { protect } from '../middleware/authMiddleware.js';
import ActivityLogger from '../utils/activityLogger.js';

const router = express.Router();

// Get all notifications for the current user
router.get('/', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id,
      isDeleted: false
    })
      .populate('task', 'title')
      .populate('assigner', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 notifications

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get unread notification count
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
      isDeleted: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mark notification as read
router.patch('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
        isDeleted: false
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Log notification read
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'notification_read',
      notification._id,
      `Marked notification as read: "${notification.message}"`,
      { isRead: false },
      { isRead: true },
      req
    );

    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: error.message });
  }
});

// Mark all notifications as read
router.patch('/mark-all-read', protect, async (req, res) => {
  try {
    const result = await Notification.updateMany(
      {
        recipient: req.user._id,
        isRead: false,
        isDeleted: false
      },
      { isRead: true }
    );

    // Log marking all notifications as read
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'notifications_mark_all_read',
      null,
      `Marked ${result.modifiedCount} notifications as read`,
      null,
      { modifiedCount: result.modifiedCount },
      req
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete all notifications for the current user (must come before /:id route)
router.delete('/clear-all', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user._id
    });

    if (notifications.length === 0) { 
      return res.json({ message: 'No notifications to clear' });
    }

    // Log the bulk deletion activity
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'notifications_cleared',
      null,
      `Cleared all ${notifications.length} notification(s)`,
      { notificationCount: notifications.length },
      null,
      req
    );

    // Delete all notifications for the user
    await Notification.deleteMany({
      recipient: req.user._id
    });

    res.json({ message: `All ${notifications.length} notifications cleared successfully` });
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete notification (permanent delete)
router.delete('/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Log notification deletion before deleting
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'notification_deleted',
      notification._id,
      `Deleted notification: "${notification.message}"`,
      { 
        message: notification.message,
        isRead: notification.isRead 
      },
      null,
      req
    );

    await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id
    });

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router; 