// mongorestore --gzip --archive=database-backup.gz --nsFrom='Work.*' --nsTo='test11.*' "mongodb+srv://kuldeep:@cluster0.vnqof.mongodb.net"
// THIS WILL DROP ALL DATA IN test11 DATABASE AND REPLACE IT WITH DATA FROM Work DATABASE IN THE BACKUP FILE mongorestore --gzip --archive=Backup-Name-Here.gz --drop --uri="mongodb+srv://kuldeep:@cluster0.vnqof.mongodb.net"


// Options -MultiViews
// RewriteEngine On
// RewriteCond %{REQUEST_FILENAME} !-f
// RewriteCond %{REQUEST_FILENAME} !-d
// RewriteRule ^ index.html [QSA,L]


import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import userRoutes from './routes/users.js';
import teamRoutes from './routes/teams.js';
import announcementRoutes from './routes/announcements.js';
import clientRoutes from './routes/clients.js';
import timesheetRoutes from './routes/timesheets.js';
import notificationRoutes from './routes/notifications.js';
import priorityRoutes from './routes/priorities.js';
import initializePriorityRoutes from './routes/initializePriorities.js';
import customColumnRoutes from './routes/customColumns.js';
import automationsRouter from './routes/automations.js';
import activityLogRoutes from './routes/activityLogs.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';
import pushSubscriptionRoutes from './routes/pushSubscription.js';
import noteRoutes from './routes/notes.js';
import taskStatusRoutes from './routes/taskStatuses.js';
import backupRoutes from './routes/backup.js';
import workTypeRoutes from './routes/workTypes.js';
import bulkUpdateRoutes from './routes/bulkStatusUpdate.js';
import analyticsRoutes from './routes/analytics.js';
import { activityLoggerMiddleware } from './middleware/activityLoggerMiddleware.js';
import Team from './models/Team.js';
import User from './models/User.js';
import './models/UserTabState.js';
// Import automation scheduler to ensure it runs when the server starts
import './automationScheduler.js';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Verify JWT_SECRET is loaded
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not defined in environment variables');
  process.exit(1);
}

const app = express();
const server = createServer(app);

const allowedOrigins = ['https://works.haacas.com', 'http://localhost:5173'];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Activity logging middleware (place before routes)
app.use(activityLoggerMiddleware({ includeBody: false }));

// Serve static files from uploads directory with proper headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.webm')) {
      res.set('Content-Type', 'audio/webm');
    }
  }
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/priorities', priorityRoutes);
app.use('/api/admin', initializePriorityRoutes);
app.use('/api/custom-columns', customColumnRoutes);
app.use('/api/automations', automationsRouter);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/push-subscription', pushSubscriptionRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/task-statuses', taskStatusRoutes);
app.use('/api/work-types', workTypeRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/bulk-update', bulkUpdateRoutes);
app.use('/api/analytics', analyticsRoutes);

// Socket.IO for real-time chat
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user authentication
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user) {
        socket.userId = user._id.toString();
        connectedUsers.set(user._id.toString(), socket.id);
        
        // Update user online status
        await User.findByIdAndUpdate(user._id, { 
          isOnline: true,
          lastSeen: new Date()
        });
        
        socket.join(user._id.toString());
        console.log(`User ${user.firstName} ${user.lastName} authenticated`);
        
        // Notify contacts about online status
        socket.broadcast.emit('user_online', {
          userId: user._id,
          isOnline: true
        });
      }
    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth_error', 'Invalid token');
    }
  });

  // Handle joining chat rooms
  socket.on('join_chat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.userId} joined chat ${chatId}`);
  });

  // Handle leaving chat rooms
  socket.on('leave_chat', (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.userId} left chat ${chatId}`);
  });

  // Handle sending messages
  socket.on('send_message', (data) => {
    socket.to(data.chatId).emit('new_message', data.message);
  });

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    socket.to(data.chatId).emit('user_typing', {
      userId: socket.userId,
      chatId: data.chatId,
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    socket.to(data.chatId).emit('user_typing', {
      userId: socket.userId,
      chatId: data.chatId,
      isTyping: false
    });
  });

  // Handle message read status
  socket.on('message_read', (data) => {
    socket.to(data.chatId).emit('message_read_update', {
      messageId: data.messageId,
      userId: socket.userId,
      readAt: new Date()
    });
  });

  // Handle messages read (when user reads all messages in a chat)
  socket.on('messages_read', (data) => {
    // Emit to all users in the chat that messages have been read
    socket.to(data.chatId).emit('messages_read', {
      chatId: data.chatId,
      userId: data.userId,
      readAt: new Date()
    });
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      
      // Update user offline status
      await User.findByIdAndUpdate(socket.userId, { 
        isOnline: false,
        lastSeen: new Date()
      });
      
      // Notify contacts about offline status
      socket.broadcast.emit('user_online', {
        userId: socket.userId,
        isOnline: false
      });
    }
  });
});

// Make io available to routes
app.set('io', io);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/haacas13')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 