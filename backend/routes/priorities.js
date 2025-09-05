import express from 'express';
import Priority from '../models/Priority.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import admin from '../middleware/admin.js';
import ActivityLogger from '../utils/activityLogger.js';

const router = express.Router();

// Get all priorities (public for all authenticated users)
router.get('/', protect, async (req, res) => {
  try {
    // Get all priorities from database sorted by order
    const priorities = await Priority.find({}).sort({ order: 1 }).populate('createdBy', 'firstName lastName');
    res.json(priorities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new priority (Admin and Team Head only)
router.post('/', protect, async (req, res) => {
  try {
    const { name, color, order } = req.body;

    // Check if user is Admin or Team Head
    if (req.user.role !== 'Admin' && req.user.role !== 'Team Head') {
      return res.status(403).json({ message: 'Access denied. Admin or Team Head role required.' });
    }

    // Check if priority name already exists
    const existingPriority = await Priority.findOne({ name: name.trim() });
    if (existingPriority) {
      return res.status(400).json({ message: 'Priority with this name already exists' });
    }

    // If no order provided, set it to be the last
    let finalOrder = order;
    if (!finalOrder) {
      const lastPriority = await Priority.findOne({}).sort({ order: -1 });
      finalOrder = lastPriority ? lastPriority.order + 1 : 1;
    }

    const priority = new Priority({
      name: name.trim(),
      color: color || 'bg-gray-100 text-gray-800 border border-gray-200',
      order: finalOrder,
      createdBy: req.user._id
    });

    const savedPriority = await priority.save();
    await savedPriority.populate('createdBy', 'firstName lastName');
    
    // Log priority creation
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'priority_created',
      savedPriority._id,
      `Created priority "${name.trim()}"`,
      null,
      { name: name.trim(), color: color || 'bg-gray-100 text-gray-800 border border-gray-200', order: finalOrder },
      req
    );
    
    res.status(201).json(savedPriority);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk update priority orders (Admin and Team Head only)
router.put('/bulk-update-order', protect, async (req, res) => {
  try {
    const { priorities } = req.body;

    // Check if user is Admin or Team Head
    if (req.user.role !== 'Admin' && req.user.role !== 'Team Head') {
      return res.status(403).json({ message: 'Access denied. Admin or Team Head role required.' });
    }

    if (!Array.isArray(priorities) || priorities.length === 0) {
      return res.status(400).json({ message: 'Invalid priorities data' });
    }

    // Update each priority's order
    const updatePromises = priorities.map((priority, index) => {
      return Priority.findByIdAndUpdate(
        priority._id,
        { order: index + 1 },
        { new: true }
      );
    });

    await Promise.all(updatePromises);

    // Log bulk priority order update
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'priorities_order_updated',
      null,
      `Updated priority order for ${priorities.length} priorities`,
      null,
      { count: priorities.length },
      req
    );

    res.json({ message: 'Priority orders updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update priority (Admin and Team Head only)
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, color, order } = req.body;

    // Check if user is Admin or Team Head
    if (req.user.role !== 'Admin' && req.user.role !== 'Team Head') {
      return res.status(403).json({ message: 'Access denied. Admin or Team Head role required.' });
    }

    const priority = await Priority.findById(req.params.id);
    if (!priority) {
      return res.status(404).json({ message: 'Priority not found' });
    }

    // Check if new name already exists (excluding current priority)
    if (name && name.trim() !== priority.name) {
      const existingPriority = await Priority.findOne({ 
        name: name.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingPriority) {
        return res.status(400).json({ message: 'Priority with this name already exists' });
      }
    }

    // Store old values for logging
    const oldValues = {
      name: priority.name,
      color: priority.color,
      order: priority.order
    };

    if (name) priority.name = name.trim();
    if (color) priority.color = color;
    if (order !== undefined) priority.order = order;

    const updatedPriority = await priority.save();
    await updatedPriority.populate('createdBy', 'firstName lastName');
    
    // Log priority update
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'priority_updated',
      updatedPriority._id,
      `Updated priority "${priority.name}"`,
      oldValues,
      { name: name?.trim(), color, order },
      req
    );
    
    res.json(updatedPriority);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete priority (Admin and Team Head only)
router.delete('/:id', protect, async (req, res) => {
  try {
    // Check if user is Admin or Team Head
    if (req.user.role !== 'Admin' && req.user.role !== 'Team Head') {
      return res.status(403).json({ message: 'Access denied. Admin or Team Head role required.' });
    }

    const priority = await Priority.findById(req.params.id);
    if (!priority) {
      return res.status(404).json({ message: 'Priority not found' });
    }

    // Check if priority is being used in any tasks
    const tasksWithPriority = await Task.countDocuments({ priority: priority.name });
    if (tasksWithPriority > 0) {
      return res.status(400).json({ 
        message: `Cannot delete priority. It is currently used in ${tasksWithPriority} task(s).`,
        tasksCount: tasksWithPriority
      });
    }

    // Log priority deletion before deleting
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'priority_deleted',
      priority._id,
      `Deleted priority "${priority.name}"`,
      { name: priority.name, color: priority.color, order: priority.order },
      null,
      req
    );

    await Priority.findByIdAndDelete(req.params.id);
    res.json({ message: 'Priority deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
