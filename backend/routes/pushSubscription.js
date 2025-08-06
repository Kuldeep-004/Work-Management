import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import { sendPushNotification } from '../utils/pushNotificationService.js';
import ActivityLogger from '../utils/activityLogger.js';

const router = express.Router();

// Subscribe to push notifications
router.post('/subscribe', protect, async (req, res) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription data' });
    }

    // Update user with push subscription
    await User.findByIdAndUpdate(req.user._id, {
      pushSubscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      notificationPermission: 'granted'
    });

    // Log subscription activity
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'push_notification_subscribed',
      null,
      'User subscribed to push notifications',
      null,
      { subscribed: true },
      req
    );

    // Send test notification
    await sendPushNotification(
      req.user._id,
      'Welcome!',
      'You will now receive timesheet reminders.',
      { type: 'welcome' }
    );

    res.json({ message: 'Successfully subscribed to push notifications' });
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    res.status(500).json({ message: 'Failed to subscribe to push notifications' });
  }
});

// Unsubscribe from push notifications
router.post('/unsubscribe', protect, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      $unset: { pushSubscription: 1 },
      notificationPermission: 'denied'
    });

    // Log unsubscription activity
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'push_notification_unsubscribed',
      null,
      'User unsubscribed from push notifications',
      { subscribed: true },
      { subscribed: false },
      req
    );

    res.json({ message: 'Successfully unsubscribed from push notifications' });
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    res.status(500).json({ message: 'Failed to unsubscribe from push notifications' });
  }
});

// Update notification permission status
router.post('/permission', protect, async (req, res) => {
  try {
    const { permission } = req.body;

    if (!['granted', 'denied', 'default'].includes(permission)) {
      return res.status(400).json({ message: 'Invalid permission value' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      notificationPermission: permission
    });

    res.json({ message: 'Notification permission updated' });
  } catch (error) {
    console.error('Error updating notification permission:', error);
    res.status(500).json({ message: 'Failed to update notification permission' });
  }
});

// Get VAPID public key
router.get('/vapid-public-key', (req, res) => {
  res.json({ 
    publicKey: process.env.VAPID_PUBLIC_KEY || 'YOUR_VAPID_PUBLIC_KEY_HERE'
  });
});

export default router;
