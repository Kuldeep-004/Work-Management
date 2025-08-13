import express from 'express';
import TaskStatus from '../models/TaskStatus.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import ActivityLogger from '../utils/activityLogger.js';

const router = express.Router();

// Middleware to check if user is admin or team head
const adminOrTeamHead = (req, res, next) => {
  if (req.user.role === 'Admin' || req.user.role === 'Team Head') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin or Team Head role required.' });
  }
};

// Initialize default task statuses
const initializeDefaultStatuses = async () => {
  const defaultStatuses = [
    { 
      name: 'Yet to Start', 
      color: 'bg-gray-100 text-gray-800', 
      isDefault: true, 
      order: 1 
    },
    { 
      name: 'In Progress', 
      color: 'bg-blue-100 text-blue-800', 
      isDefault: true, 
      order: 2 
    },
    { 
      name: 'Completed', 
      color: 'bg-green-100 text-green-800', 
      isDefault: true, 
      order: 3 
    }
  ];

  for (const status of defaultStatuses) {
    await TaskStatus.findOneAndUpdate(
      { name: status.name },
      status,
      { upsert: true, new: true }
    );
  }
};

// Initialize defaults on server start
initializeDefaultStatuses();

// Get all task statuses
router.get('/', protect, async (req, res) => {
  try {
    const statuses = await TaskStatus.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json(statuses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch task statuses' });
  }
});

// Create new task status (Admin and Team Head only)
router.post('/', protect, adminOrTeamHead, async (req, res) => {
  try {
    const { name, color } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Check if status already exists
    const existingStatus = await TaskStatus.findOne({ name });
    if (existingStatus) {
      return res.status(409).json({ message: 'Task status already exists' });
    }

    // Get next order number
    const maxOrder = await TaskStatus.findOne().sort({ order: -1 });
    const nextOrder = maxOrder ? maxOrder.order + 1 : 4;

    const taskStatus = new TaskStatus({
      name,
      color: color || 'bg-purple-100 text-purple-800',
      order: nextOrder,
      isDefault: false
    });

    await taskStatus.save();

    // Log activity
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'task_status_created',
      taskStatus._id,
      `Created task status "${name}"`,
      null,
      { name: taskStatus.name, color: taskStatus.color }
    );

    res.status(201).json(taskStatus);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create task status', error: error.message });
  }
});

// Update task status (Admin and Team Head only)
router.put('/:id', protect, adminOrTeamHead, async (req, res) => {
  try {
    const { name, color, order } = req.body;
    
    const taskStatus = await TaskStatus.findById(req.params.id);
    if (!taskStatus) {
      return res.status(404).json({ message: 'Task status not found' });
    }

    // Don't allow updating default statuses' names
    if (taskStatus.isDefault && name) {
      return res.status(400).json({ message: 'Cannot change name of default task status' });
    }

    if (name) taskStatus.name = name;
    if (color) taskStatus.color = color;
    if (order !== undefined) taskStatus.order = order;

    await taskStatus.save();

    // Log activity
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'task_status_updated',
      taskStatus._id,
      `Updated task status "${taskStatus.name}"`,
      null,
      { name: taskStatus.name, color, order }
    );

    res.json(taskStatus);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update task status', error: error.message });
  }
});

// Delete task status (Admin and Team Head only)
router.delete('/:id', protect, adminOrTeamHead, async (req, res) => {
  try {
    const taskStatus = await TaskStatus.findById(req.params.id);
    if (!taskStatus) {
      return res.status(404).json({ message: 'Task status not found' });
    }

    // Don't allow deleting default statuses
    if (taskStatus.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default task status' });
    }

    // Check if any tasks are using this status
    const tasksUsingStatus = await Task.countDocuments({ status: taskStatus.name });
    if (tasksUsingStatus > 0) {
      return res.status(400).json({ 
        message: `Cannot delete task status. ${tasksUsingStatus} task(s) are currently using this status.` 
      });
    }

    await TaskStatus.findByIdAndDelete(req.params.id);

    // Log activity
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'task_status_deleted',
      req.params.id,
      `Deleted task status "${taskStatus.name}"`,
      null,
      { name: taskStatus.name }
    );

    res.json({ message: 'Task status deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete task status', error: error.message });
  }
});

// Get task status usage count
router.get('/:id/usage', protect, adminOrTeamHead, async (req, res) => {
  try {
    const taskStatus = await TaskStatus.findById(req.params.id);
    if (!taskStatus) {
      return res.status(404).json({ message: 'Task status not found' });
    }

    const count = await Task.countDocuments({ status: taskStatus.name });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get task status usage count', error: error.message });
  }
});

// Reorder task statuses
router.post('/reorder', protect, adminOrTeamHead, async (req, res) => {
  try {
    const { statusOrder } = req.body; // Array of status IDs in new order

    if (!Array.isArray(statusOrder)) {
      return res.status(400).json({ message: 'Status order must be an array' });
    }

    // Update order for each status
    for (let i = 0; i < statusOrder.length; i++) {
      await TaskStatus.findByIdAndUpdate(statusOrder[i], { order: i + 1 });
    }

    // Log activity
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'task_statuses_reordered',
      null,
      'Reordered task statuses',
      null,
      { newOrder: statusOrder }
    );

    const reorderedStatuses = await TaskStatus.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json(reorderedStatuses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to reorder task statuses', error: error.message });
  }
});

export default router;