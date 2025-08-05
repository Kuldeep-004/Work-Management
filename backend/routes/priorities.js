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
    // Always return default priorities + custom priorities
    const defaultPriorities = [
      { name: 'urgent', isDefault: true, order: 1 },
      { name: 'today', isDefault: true, order: 2 },
      { name: 'lessThan3Days', isDefault: true, order: 3 },
      { name: 'thisWeek', isDefault: true, order: 4 },
      { name: 'thisMonth', isDefault: true, order: 5 },
      { name: 'regular', isDefault: true, order: 6 },
      { name: 'filed', isDefault: true, order: 7 },
      { name: 'dailyWorksOffice', isDefault: true, order: 8 },
      { name: 'monthlyWorks', isDefault: true, order: 9 }
    ];
    
    // Get custom priorities from database
    const customPriorities = await Priority.find({ isDefault: false }).sort({ order: 1, createdAt: 1 });
    
    // Combine and return
    const allPriorities = [...defaultPriorities, ...customPriorities];
    res.json(allPriorities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new priority (Admin and Team Head only)
router.post('/', protect, async (req, res) => {
  try {
    const { name, order } = req.body;

    // Check if user is Admin or Team Head
    if (req.user.role !== 'Admin' && req.user.role !== 'Team Head') {
      return res.status(403).json({ message: 'Access denied. Admin or Team Head role required.' });
    }

    // Check if priority name already exists (including default priorities)
    const defaultPriorities = ['urgent', 'today', 'lessThan3Days', 'thisWeek', 'thisMonth', 'regular', 'filed', 'dailyWorksOffice', 'monthlyWorks'];
    if (defaultPriorities.includes(name.trim())) {
      return res.status(400).json({ message: 'Cannot create priority with default priority name' });
    }

    const existingPriority = await Priority.findOne({ name: name.trim() });
    if (existingPriority) {
      return res.status(400).json({ message: 'Priority with this name already exists' });
    }

    const priority = new Priority({
      name: name.trim(),
      order: order || 100, // Custom priorities start from 100
      isDefault: false,
      createdBy: req.user._id
    });

    const savedPriority = await priority.save();
    await savedPriority.populate('createdBy', 'firstName lastName');
    
    // Log priority creation
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'priority_created',
      savedPriority._id,
      `Created custom priority "${name.trim()}"`,
      null,
      { name: name.trim(), order: order || 100 },
      req
    );
    
    res.status(201).json(savedPriority);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update priority (Admin and Team Head only)
router.put('/:id', protect, async (req, res) => {
  try {
    const { name, order } = req.body;

    // Check if user is Admin or Team Head
    if (req.user.role !== 'Admin' && req.user.role !== 'Team Head') {
      return res.status(403).json({ message: 'Access denied. Admin or Team Head role required.' });
    }

    const priority = await Priority.findById(req.params.id);
    if (!priority) {
      return res.status(404).json({ message: 'Priority not found' });
    }

    // Prevent editing default priorities
    if (priority.isDefault) {
      return res.status(400).json({ message: 'Cannot edit default priorities' });
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

    if (name) priority.name = name.trim();
    if (order !== undefined) priority.order = order;

    // Store old values for logging
    const oldValues = {
      name: priority.name,
      order: priority.order
    };

    const updatedPriority = await priority.save();
    await updatedPriority.populate('createdBy', 'firstName lastName');
    
    // Log priority update
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'priority_updated',
      updatedPriority._id,
      `Updated custom priority "${priority.name}"`,
      oldValues,
      { name: name?.trim(), order },
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

    // Prevent deleting default priorities
    if (priority.isDefault) {
      return res.status(400).json({ message: 'Cannot delete default priorities' });
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
      `Deleted custom priority "${priority.name}"`,
      { name: priority.name, order: priority.order },
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
