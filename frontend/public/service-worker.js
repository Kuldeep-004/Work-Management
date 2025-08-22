// Service Worker for push notifications

self.addEventListener('push', function(event) {
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Notification',
        body: event.data.text(),
        icon: '/vite.svg',
        badge: '/vite.svg'
      };
    }
  }

  const isTimesheetReminder = data.data && data.data.type === 'timesheet_reminder';
  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    data: data.data || {},
    requireInteraction: !isTimesheetReminder, // Only require interaction for non-timesheet notifications
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Close'
      }
    ]
  };

  event.waitUntil(
    (async () => {
      const notification = await self.registration.showNotification(data.title || 'Work Management', options);
      if (isTimesheetReminder) {
        // Close the notification after 2 seconds
        setTimeout(async () => {
          const notifications = await self.registration.getNotifications({ tag: options.tag });
          notifications.forEach(n => n.close());
        }, 2000);
      }
    })()
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // Open the app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      // If there's already a window open, focus it
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

self.addEventListener('notificationclose', function(event) {
  // Handle notification close if needed
  console.log('Notification closed:', event.notification.data);
});

// Install event
self.addEventListener('install', function(event) {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', function(event) {
  console.log('Service Worker activating...');
  event.waitUntil(self.clients.claim());
});
