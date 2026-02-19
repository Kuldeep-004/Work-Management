// mongorestore --gzip --archive=database-backup.gz --nsFrom='Work.*' --nsTo='test11.*' "mongodb+srv://kuldeep:@cluster0.vnqof.mongodb.net"
// THIS WILL DROP ALL DATA IN test11 DATABASE AND REPLACE IT WITH DATA FROM Work DATABASE IN THE BACKUP FILE mongorestore --gzip --archive=Backup-Name-Here.gz --drop --uri="mongodb+srv://kuldeep:@cluster0.vnqof.mongodb.net"

// Options -MultiViews
// RewriteEngine On
// RewriteCond %{REQUEST_FILENAME} !-f
// RewriteCond %{REQUEST_FILENAME} !-d
// RewriteRule ^ index.html [QSA,L]

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import jwt from "jsonwebtoken";
import { createServer } from "http";
import { Server } from "socket.io";
import authRoutes from "./routes/auth.js";
import taskRoutes from "./routes/tasks.js";
import userRoutes from "./routes/users.js";
import teamRoutes from "./routes/teams.js";
import announcementRoutes from "./routes/announcements.js";
import clientRoutes from "./routes/clients.js";
import timesheetRoutes from "./routes/timesheets.js";
import notificationRoutes from "./routes/notifications.js";
import priorityRoutes from "./routes/priorities.js";
import initializePriorityRoutes from "./routes/initializePriorities.js";
import customColumnRoutes from "./routes/customColumns.js";
import automationsRouter from "./routes/automations.js";
import activityLogRoutes from "./routes/activityLogs.js";
import chatRoutes from "./routes/chats.js";
import messageRoutes from "./routes/messages.js";
import pushSubscriptionRoutes from "./routes/pushSubscription.js";
import noteRoutes from "./routes/notes.js";
import taskStatusRoutes from "./routes/taskStatuses.js";
import backupRoutes from "./routes/backup.js";
import workTypeRoutes from "./routes/workTypes.js";
import bulkUpdateRoutes from "./routes/bulkStatusUpdate.js";
import analyticsRoutes from "./routes/analytics.js";
import tutorialRoutes from "./routes/tutorials.js";
import leaveRoutes from "./routes/leaves.js";
import cleanupRoutes from "./routes/cleanup.js";
import { activityLoggerMiddleware } from "./middleware/activityLoggerMiddleware.js";
import Team from "./models/Team.js";
import User from "./models/User.js";
import Chat from "./models/Chat.js";
import "./models/UserTabState.js";
// Import automation scheduler to ensure it runs when the server starts
import "./automationScheduler.js";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Load environment variables
dotenv.config({ path: path.join(__dirname, ".env") });

// Verify JWT_SECRET is loaded
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not defined in environment variables");
  process.exit(1);
}

const app = express();
const server = createServer(app);

const allowedOrigins = ["https://works.haacas.com", "http://localhost:5173"];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

// Increase payload size limit for file uploads
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Set timeout for all requests (5 minutes for file uploads)
app.use((req, res, next) => {
  req.setTimeout(300000); // 5 minutes
  res.setTimeout(300000); // 5 minutes
  next();
});

// Activity logging middleware (place before routes)
app.use(activityLoggerMiddleware({ includeBody: false }));

// Serve static files from uploads directory with proper headers
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    setHeaders: (res, path) => {
      if (path.endsWith(".webm")) {
        res.set("Content-Type", "audio/webm");
      }
    },
  }),
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/timesheets", timesheetRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/priorities", priorityRoutes);
app.use("/api/admin", initializePriorityRoutes);
app.use("/api/custom-columns", customColumnRoutes);
app.use("/api/automations", automationsRouter);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/push-subscription", pushSubscriptionRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/task-statuses", taskStatusRoutes);
app.use("/api/work-types", workTypeRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/bulk-update", bulkUpdateRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/tutorials", tutorialRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/cleanup", cleanupRoutes);

// Socket.IO for real-time chat - WhatsApp level optimization
const connectedUsers = new Map(); // userId -> { socketId, lastSeen, isInChat }
const userTypingState = new Map(); // Track typing states to prevent spam
const userHeartbeats = new Map(); // Track user activity heartbeats

// Heartbeat cleanup interval - mark users as offline if no heartbeat for 30 seconds
setInterval(() => {
  const now = Date.now();
  const HEARTBEAT_TIMEOUT = 30000; // 30 seconds

  for (const [userId, data] of connectedUsers.entries()) {
    if (now - data.lastSeen > HEARTBEAT_TIMEOUT) {
      // User is considered offline
      connectedUsers.delete(userId);

      // Update database status
      User.findByIdAndUpdate(
        userId,
        {
          isOnline: false,
          lastSeen: new Date(),
        },
        { lean: true },
      ).catch((err) => console.error("Error updating offline status:", err));

      // Notify other users
      io.emit("user_online", {
        userId: userId,
        isOnline: false,
      });

      console.log(`User ${userId} marked offline due to heartbeat timeout`);
    }
  }
}, 15000); // Check every 15 seconds

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Handle user authentication
  socket.on("authenticate", async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id)
        .select("_id firstName lastName")
        .lean();

      if (user) {
        socket.userId = user._id.toString();

        // Store user connection data with heartbeat
        connectedUsers.set(user._id.toString(), {
          socketId: socket.id,
          lastSeen: Date.now(),
          isInChat: false,
        });

        // Update user online status efficiently
        await User.findByIdAndUpdate(
          user._id,
          {
            isOnline: true,
            lastSeen: new Date(),
          },
          { lean: true },
        );

        socket.join(user._id.toString());
        console.log(`User ${user.firstName} ${user.lastName} authenticated`);

        // Notify contacts about online status
        socket.broadcast.emit("user_online", {
          userId: user._id,
          isOnline: true,
        });

        // Send current online users to the newly connected user
        const onlineUserIds = Array.from(connectedUsers.keys());
        socket.emit("online_users_list", onlineUserIds);
      }
    } catch (error) {
      console.error("Authentication error:", error);
      socket.emit("auth_error", "Invalid token");
    }
  });

  // Handle joining chat rooms
  socket.on("join_chat", (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.userId} joined chat ${chatId}`);
  });

  // Handle leaving chat rooms
  socket.on("leave_chat", (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.userId} left chat ${chatId}`);
  });

  // Handle user entering chat section
  socket.on("enter_chat_section", () => {
    if (socket.userId && connectedUsers.has(socket.userId)) {
      const userData = connectedUsers.get(socket.userId);
      userData.isInChat = true;
      userData.lastSeen = Date.now();
      connectedUsers.set(socket.userId, userData);
      console.log(`User ${socket.userId} entered chat section`);
    }
  });

  // Handle user leaving chat section
  socket.on("leave_chat_section", () => {
    if (socket.userId && connectedUsers.has(socket.userId)) {
      const userData = connectedUsers.get(socket.userId);
      userData.isInChat = false;
      userData.lastSeen = Date.now();
      connectedUsers.set(socket.userId, userData);
      console.log(`User ${socket.userId} left chat section`);
    }
  });

  // Handle heartbeat to keep user online
  socket.on("heartbeat", () => {
    if (socket.userId && connectedUsers.has(socket.userId)) {
      const userData = connectedUsers.get(socket.userId);
      userData.lastSeen = Date.now();
      connectedUsers.set(socket.userId, userData);
    }
  });

  // Handle page visibility change
  socket.on("page_visibility", ({ isVisible }) => {
    if (socket.userId && connectedUsers.has(socket.userId)) {
      const userData = connectedUsers.get(socket.userId);
      userData.lastSeen = Date.now();

      // If page becomes hidden, mark as potentially away
      if (!isVisible) {
        userData.isInChat = false;
      }

      connectedUsers.set(socket.userId, userData);
      console.log(`User ${socket.userId} page visibility: ${isVisible}`);
    }
  });

  // Handle sending messages - Optimized for batch operations
  socket.on("send_message", (data) => {
    // Emit to chat room immediately for real-time feel
    socket.to(data.chatId).emit("new_message", data.message);

    // Emit delivery confirmation to sender
    socket.emit("message_delivered", {
      messageId: data.message._id,
      chatId: data.chatId,
      deliveredAt: new Date(),
    });

    // Update unread counts for users in the chat (async for performance)
    updateUnreadCountsAsync(data.chatId, data.message.sender._id);
  });

  // Handle typing indicators with throttling to prevent spam
  socket.on("typing_start", (data) => {
    const typingKey = `${socket.userId}_${data.chatId}`;
    if (!userTypingState.has(typingKey)) {
      userTypingState.set(typingKey, true);
      socket.to(data.chatId).emit("user_typing", {
        userId: socket.userId,
        chatId: data.chatId,
        isTyping: true,
      });

      // Auto-stop typing after 3 seconds
      setTimeout(() => {
        if (userTypingState.get(typingKey)) {
          userTypingState.delete(typingKey);
          socket.to(data.chatId).emit("user_typing", {
            userId: socket.userId,
            chatId: data.chatId,
            isTyping: false,
          });
        }
      }, 3000);
    }
  });

  socket.on("typing_stop", (data) => {
    const typingKey = `${socket.userId}_${data.chatId}`;
    if (userTypingState.has(typingKey)) {
      userTypingState.delete(typingKey);
      socket.to(data.chatId).emit("user_typing", {
        userId: socket.userId,
        chatId: data.chatId,
        isTyping: false,
      });
    }
  });

  // Handle message read status
  socket.on("message_read", (data) => {
    socket.to(data.chatId).emit("message_read_update", {
      messageId: data.messageId,
      userId: socket.userId,
      readAt: new Date(),
    });
  });

  // Handle messages read (when user reads all messages in a chat)
  socket.on("messages_read", (data) => {
    // Emit to all users in the chat that messages have been read
    socket.to(data.chatId).emit("messages_read", {
      chatId: data.chatId,
      userId: data.userId,
      readAt: new Date(),
    });

    // Emit unread count reset to the current user
    socket.emit("unread_count_update", {
      chatId: data.chatId,
      reset: true,
    });
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    console.log("User disconnected:", socket.id);

    if (socket.userId) {
      // Remove from connected users
      connectedUsers.delete(socket.userId);

      // Clear typing states for this user
      for (const [key, value] of userTypingState.entries()) {
        if (key.startsWith(socket.userId)) {
          userTypingState.delete(key);
        }
      }

      // Update user offline status efficiently
      await User.findByIdAndUpdate(
        socket.userId,
        {
          isOnline: false,
          lastSeen: new Date(),
        },
        { lean: true },
      );

      // Notify contacts about offline status
      socket.broadcast.emit("user_online", {
        userId: socket.userId,
        isOnline: false,
      });

      console.log(`User ${socket.userId} went offline`);
    }
  });
});

// Make io available to routes
app.set("io", io);

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/haacas13")
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => console.error("MongoDB connection error:", err));

// Async function to update unread counts without blocking socket response
async function updateUnreadCountsAsync(chatId, senderId) {
  try {
    const chat = await Chat.findById(chatId).select("participants").lean();
    if (!chat) return;

    const otherParticipants = chat.participants
      .filter((p) => p.user.toString() !== senderId)
      .map((p) => p.user);

    if (otherParticipants.length > 0) {
      const bulkOps = otherParticipants.map((participantId) => ({
        updateOne: {
          filter: {
            _id: chatId,
            "unreadCounts.user": participantId,
          },
          update: {
            $inc: { "unreadCounts.$.count": 1 },
          },
        },
      }));

      const addUnreadCountOps = otherParticipants.map((participantId) => ({
        updateOne: {
          filter: {
            _id: chatId,
            "unreadCounts.user": { $ne: participantId },
          },
          update: {
            $push: {
              unreadCounts: { user: participantId, count: 1 },
            },
          },
        },
      }));

      await Chat.bulkWrite([...bulkOps, ...addUnreadCountOps]);

      // Emit real-time unread count updates to affected users
      otherParticipants.forEach((participantId) => {
        const socketId = connectedUsers.get(participantId.toString())?.socketId;
        if (socketId) {
          io.to(socketId).emit("unread_count_update", {
            chatId: chatId,
            increment: 1,
          });
        }
      });
    }
  } catch (error) {
    console.error("Error updating unread counts:", error);
  }
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

app.get("/", (req, res) => {
  res.send("<h1>HAACAS Server Is Running</h1>");
});
