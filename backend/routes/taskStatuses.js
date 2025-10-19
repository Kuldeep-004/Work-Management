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
      name: 'yet_to_start', 
      color: 'bg-gray-100 text-gray-800', 
      isDefault: true, 
      order: 1 
    },
    { 
      name: 'in_progress', 
      color: 'bg-blue-100 text-blue-800', 
      isDefault: true, 
      order: 2 
    },
    { 
      name: 'completed', 
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

// Create new task status (All authenticated users can create)
router.post('/', protect, async (req, res) => {
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

    // Convert hex color to Tailwind classes if needed
    let processedColor = color || 'bg-purple-100 text-purple-800';
    
    // If the color is a hex value, convert it to a Tailwind class
    if (processedColor.startsWith('#')) {
      const hexToTailwind = {
        '#EF4444': 'bg-red-100 text-red-800',
        '#DC2626': 'bg-red-100 text-red-800',
        '#F59E0B': 'bg-yellow-100 text-yellow-800',
        '#D97706': 'bg-yellow-100 text-yellow-800',
        '#10B981': 'bg-green-100 text-green-800',
        '#059669': 'bg-green-100 text-green-800',
        '#3B82F6': 'bg-blue-100 text-blue-800',
        '#2563EB': 'bg-blue-100 text-blue-800',
        '#6366F1': 'bg-indigo-100 text-indigo-800',
        '#4F46E5': 'bg-indigo-100 text-indigo-800',
        '#8B5CF6': 'bg-purple-100 text-purple-800',
        '#7C3AED': 'bg-purple-100 text-purple-800',
        '#EC4899': 'bg-pink-100 text-pink-800',
        '#DB2777': 'bg-pink-100 text-pink-800',
        '#F97316': 'bg-orange-100 text-orange-800',
        '#EA580C': 'bg-orange-100 text-orange-800',
        '#14B8A6': 'bg-teal-100 text-teal-800',
        '#0D9488': 'bg-teal-100 text-teal-800',
        '#06B6D4': 'bg-cyan-100 text-cyan-800',
        '#0891B2': 'bg-cyan-100 text-cyan-800',
        '#6B7280': 'bg-gray-100 text-gray-800',
        '#4B5563': 'bg-gray-100 text-gray-800'
      };
      
      processedColor = hexToTailwind[processedColor.toUpperCase()] || 'bg-purple-100 text-purple-800';
    }

    // Get next order number
    const maxOrder = await TaskStatus.findOne().sort({ order: -1 });
    const nextOrder = maxOrder ? maxOrder.order + 1 : 4;

    const taskStatus = new TaskStatus({
      name,
      color: processedColor,
      order: nextOrder,
      isDefault: false
    });

    await taskStatus.save();

    // Log activity
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'task_status_created',
      entity: 'TaskStatus',
      entityId: taskStatus._id,
      description: `Created task status "${name}"`,
      newValues: { name: taskStatus.name, color: taskStatus.color }
    });

    res.status(201).json(taskStatus);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create task status', error: error.message });
  }
});

// Bulk update task status orders (Admin and Team Head only) - MUST be before /:id route
router.put('/bulk-update-order', protect, adminOrTeamHead, async (req, res) => {
  try {
    const { statuses } = req.body;

    if (!Array.isArray(statuses) || statuses.length === 0) {
      return res.status(400).json({ message: 'Invalid statuses data' });
    }

    // Update each status's order
    const updatePromises = statuses.map((status, index) => {
      return TaskStatus.findByIdAndUpdate(
        status._id,
        { order: index + 1 },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    // Log bulk status order update
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'task_status_reordered',
      null,
      `Updated task status order for ${statuses.length} statuses`,
      null,
      { count: statuses.length },
      req
    );

    console.log('=== BULK UPDATE SUCCESSFUL ===');
    res.json({ message: 'Task status orders updated successfully' });
  } catch (error) {
    console.error('Error in bulk-update-order:', error);
    res.status(500).json({ message: error.message });
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

    // Check if new name already exists (excluding current status)
    if (name && name.trim() !== taskStatus.name) {
      const existingStatus = await TaskStatus.findOne({ 
        name: name.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingStatus) {
        return res.status(400).json({ message: 'Task status with this name already exists' });
      }
    }

    // Process color if provided
    let processedColor = color;
    if (color && color.startsWith('#')) {
      const hexToTailwind = {
        '#EF4444': 'bg-red-100 text-red-800',
        '#DC2626': 'bg-red-100 text-red-800',
        '#F59E0B': 'bg-yellow-100 text-yellow-800',
        '#D97706': 'bg-yellow-100 text-yellow-800',
        '#10B981': 'bg-green-100 text-green-800',
        '#059669': 'bg-green-100 text-green-800',
        '#3B82F6': 'bg-blue-100 text-blue-800',
        '#2563EB': 'bg-blue-100 text-blue-800',
        '#6366F1': 'bg-indigo-100 text-indigo-800',
        '#4F46E5': 'bg-indigo-100 text-indigo-800',
        '#8B5CF6': 'bg-purple-100 text-purple-800',
        '#7C3AED': 'bg-purple-100 text-purple-800',
        '#EC4899': 'bg-pink-100 text-pink-800',
        '#DB2777': 'bg-pink-100 text-pink-800',
        '#F97316': 'bg-orange-100 text-orange-800',
        '#EA580C': 'bg-orange-100 text-orange-800',
        '#14B8A6': 'bg-teal-100 text-teal-800',
        '#0D9488': 'bg-teal-100 text-teal-800',
        '#06B6D4': 'bg-cyan-100 text-cyan-800',
        '#0891B2': 'bg-cyan-100 text-cyan-800',
        '#6B7280': 'bg-gray-100 text-gray-800',
        '#4B5563': 'bg-gray-100 text-gray-800'
      };
      
      processedColor = hexToTailwind[color.toUpperCase()] || color;
    }

    if (name) taskStatus.name = name;
    if (processedColor) taskStatus.color = processedColor;
    if (order !== undefined) taskStatus.order = order;

    await taskStatus.save();

    // Log activity
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'task_status_updated',
      entity: 'TaskStatus',
      entityId: taskStatus._id,
      description: `Updated task status "${taskStatus.name}"`,
      newValues: { name: taskStatus.name, color: processedColor, order }
    });

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
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'task_status_deleted',
      entity: 'TaskStatus',
      entityId: req.params.id,
      description: `Deleted task status "${taskStatus.name}"`,
      oldValues: { name: taskStatus.name }
    });

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
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'task_status_reordered',
      entity: 'TaskStatus',
      description: 'Reordered task statuses',
      newValues: { newOrder: statusOrder }
    });

    const reorderedStatuses = await TaskStatus.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    res.json(reorderedStatuses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to reorder task statuses', error: error.message });
  }
});

export default router;