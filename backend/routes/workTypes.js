import express from 'express';
import WorkType from '../models/WorkType.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import admin from '../middleware/admin.js';

const router = express.Router();

// Middleware to check if user is admin or team head
const isAdminOrTeamHead = (req, res, next) => {
  if (req.user.role !== 'Admin' && req.user.role !== 'Team Head') {
    return res.status(403).json({ message: 'Access denied. Only admins and team heads can manage work types.' });
  }
  next();
};

// Get all work types
router.get('/', protect, async (req, res) => {
  try {
    const workTypes = await WorkType.find().sort({ name: 1 });
    res.json(workTypes);
  } catch (error) {
    console.error('Error fetching work types:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new work type
router.post('/', protect, isAdminOrTeamHead, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Work type name is required' });
    }

    // Check if work type already exists
    const existingWorkType = await WorkType.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });

    if (existingWorkType) {
      return res.status(400).json({ message: 'Work type with this name already exists' });
    }

    const workType = new WorkType({
      name: name.trim(),
      createdBy: req.user._id
    });

    const savedWorkType = await workType.save();
    res.status(201).json(savedWorkType);
  } catch (error) {
    console.error('Error creating work type:', error);
    res.status(500).json({ message: error.message });
  }
});

// Update a work type
router.put('/:id', protect, isAdminOrTeamHead, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Work type name is required' });
    }

    const workType = await WorkType.findById(req.params.id);
    if (!workType) {
      return res.status(404).json({ message: 'Work type not found' });
    }

    // Check if another work type with the same name exists
    const existingWorkType = await WorkType.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: req.params.id }
    });

    if (existingWorkType) {
      return res.status(400).json({ message: 'Work type with this name already exists' });
    }

    const oldName = workType.name;
    workType.name = name.trim();
    const updatedWorkType = await workType.save();

    // Note: We do NOT automatically update tasks to prevent data corruption.
    // Tasks will continue to work with the old work type names.
    // Admin should manually update tasks if needed.

    res.json(updatedWorkType);
  } catch (error) {
    console.error('Error updating work type:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a work type
router.delete('/:id', protect, isAdminOrTeamHead, async (req, res) => {
  try {
    const workType = await WorkType.findById(req.params.id);
    if (!workType) {
      return res.status(404).json({ message: 'Work type not found' });
    }

    // Check if this work type is being used in any tasks
    // Use exact match to avoid false positives with similar names
    const tasksUsingWorkType = await Task.countDocuments({ 
      workType: { $in: [workType.name] }
    });

    if (tasksUsingWorkType > 0) {
      return res.status(400).json({ 
        message: `Cannot delete work type "${workType.name}" as it is being used in ${tasksUsingWorkType} task(s). Please update or remove these tasks first.`,
        tasksCount: tasksUsingWorkType
      });
    }

    await WorkType.findByIdAndDelete(req.params.id);
    res.json({ message: 'Work type deleted successfully' });
  } catch (error) {
    console.error('Error deleting work type:', error);
    res.status(500).json({ message: error.message });
  }
});

// Check if work type can be deleted
router.get('/:id/can-delete', protect, isAdminOrTeamHead, async (req, res) => {
  try {
    const workType = await WorkType.findById(req.params.id);
    if (!workType) {
      return res.status(404).json({ message: 'Work type not found' });
    }

    const tasksUsingWorkType = await Task.countDocuments({ 
      workType: { $in: [workType.name] }
    });

    res.json({ 
      canDelete: tasksUsingWorkType === 0,
      tasksCount: tasksUsingWorkType
    });
  } catch (error) {
    console.error('Error checking work type deletion:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
