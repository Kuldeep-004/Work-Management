import webpush from 'web-push';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import dotenv from 'dotenv';

dotenv.config();

// Configure web-push with VAPID keys
webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'your-email@example.com'),
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export const sendPushNotification = async (userId, title, body, data = {}) => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.pushSubscription || user.notificationPermission !== 'granted') {
      console.log(`User ${userId} doesn't have valid push subscription`);
      return false;
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/vite.svg',
      badge: '/vite.svg',
      data: {
        url: '/',
        ...data
      }
    });

    const subscription = {
      endpoint: user.pushSubscription.endpoint,
      keys: {
        p256dh: user.pushSubscription.keys.p256dh,
        auth: user.pushSubscription.keys.auth
      }
    };

    await webpush.sendNotification(subscription, payload);
    console.log(`Push notification sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    
    // If the subscription is invalid, remove it
    if (error.statusCode === 410 || error.statusCode === 404) {
      await User.findByIdAndUpdate(userId, {
        $unset: { pushSubscription: 1 },
        notificationPermission: 'default'
      });
    }
    return false;
  }
};

export const sendTimesheetReminder = async () => {
  try {
    // Get all users with valid push subscriptions
    const users = await User.find({
      pushSubscription: { $exists: true },
      notificationPermission: 'granted',
      status: 'approved'
    });

    const promises = users.map(async (user) => {
      // Create notification record
      await Notification.create({
        recipient: user._id,
        message: 'Fill The Timesheets',
        type: 'timesheet_reminder'
      });

      // Send push notification
      return sendPushNotification(
        user._id,
        'Timesheet Reminder',
        'Don\'t forget to fill your timesheets!',
        { type: 'timesheet_reminder' }
      );
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
    
    console.log(`Timesheet reminders sent to ${successful}/${users.length} users`);
    return { sent: successful, total: users.length };
  } catch (error) {
    console.error('Error sending timesheet reminders:', error);
    throw error;
  }
};
