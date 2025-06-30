import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import userRoutes from './routes/users.js';
import todoRoutes from './routes/todos.js';
import teamRoutes from './routes/teams.js';
import announcementRoutes from './routes/announcements.js';
import clientRoutes from './routes/clients.js';
import timesheetRoutes from './routes/timesheets.js';
import notificationRoutes from './routes/notifications.js';
import Team from './models/Team.js';

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

const allowedOrigins = ['https://haacaswork.vercel.app','https://works.haacas.com', 'http://localhost:5173'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

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
app.use('/api/todos', todoRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/notifications', notificationRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/haacas13')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('JWT_SECRET is configured:', process.env.JWT_SECRET ? 'Yes' : 'No');
}); 