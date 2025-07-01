import mongoose from 'mongoose';
import Notification from './models/Notification.js';
import User from './models/User.js';
import Task from './models/Task.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/haacas13')
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Test function to create a sample notification
const createTestNotification = async () => {
  try {
    // Get a sample user (you'll need to replace with actual user IDs from your database)
    const users = await User.find().limit(2);
    
    if (users.length < 2) {
      return;
    }

    const assigner = users[0];
    const recipient = users[1];

    // Create a test task
    const task = new Task({
      title: 'Test Task for Notifications',
      description: 'This is a test task to verify notification system',
      clientName: 'Test Client',
      clientGroup: 'Test Group',
      workType: ['Test Work'],
      assignedTo: recipient._id,
      assignedBy: assigner._id,
      priority: 'regular',
      inwardEntryDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      targetDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) // 5 days from now
    });

    const savedTask = await task.save();

    // Create notification
    const notification = new Notification({
      recipient: recipient._id,
      task: savedTask._id,
      assigner: assigner._id,
      message: `You have been assigned a new task: "Test Task for Notifications"`
    });

    const savedNotification = await notification.save();

    // Test fetching notifications
    const notifications = await Notification.find({ recipient: recipient._id })
      .populate('task', 'title')
      .populate('assigner', 'firstName lastName');

    // Test unread count
    const unreadCount = await Notification.countDocuments({
      recipient: recipient._id,
      isRead: false,
      isDeleted: false
    });

  } catch (error) {
    console.error('Error creating test notification:', error);
  } finally {
    mongoose.connection.close();
  }
};

// Run the test
createTestNotification(); 