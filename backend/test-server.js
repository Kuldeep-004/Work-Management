import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskStatus from './models/TaskStatus.js';

dotenv.config();

const app = express();
app.use(express.json());

// Test endpoint
app.get('/api/test', async (req, res) => {
  try {
    const statuses = await TaskStatus.find();
    res.json({ success: true, statuses });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/haacas13')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => console.error('MongoDB connection error:', err));

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Test server is running on port ${PORT}`);
});
