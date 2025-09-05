import express from 'express';
import mongoose from 'mongoose';
import WorkType from '../models/WorkType.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import admin from '../middleware/admin.js';
import ActivityLogger from '../utils/activityLogger.js';
import WorkTypeUtils from '../utils/workTypeUtils.js';

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

    // Validate work type name
    const validation = WorkTypeUtils.validateWorkTypeName(name);
    if (!validation.isValid) {
      return res.status(400).json({ message: validation.message });
    }

    const workType = await WorkType.findById(req.params.id);
    if (!workType) {
      return res.status(404).json({ message: 'Work type not found' });
    }

    // Check if another work type with the same name exists
    const existingWorkType = await WorkType.findOne({ 
      name: { $regex: new RegExp(`^${validation.trimmedName}$`, 'i') },
      _id: { $ne: req.params.id }
    });

    if (existingWorkType) {
      return res.status(400).json({ message: 'Work type with this name already exists' });
    }

    const oldName = workType.name;
    const newName = validation.trimmedName;
    
    // Only proceed if the name is actually changing
    if (oldName === newName) {
      return res.json(workType);
    }

    // Start a transaction to ensure data consistency
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Update the work type
      workType.name = newName;
      const updatedWorkType = await workType.save({ session });

      // Update all tasks that use this work type using the utility function
      const updateResult = await WorkTypeUtils.updateWorkTypeInTasks(
        oldName, 
        newName, 
        req.user, 
        req, 
        session
      );

      // Commit the transaction
      await session.commitTransaction();

      // Log this critical activity
      await ActivityLogger.log({
        userId: req.user._id,
        action: 'UPDATE_WORK_TYPE_WITH_TASK_PROPAGATION',
        entity: 'WorkType',
        entityId: workType._id,
        description: `Updated work type "${oldName}" to "${newName}" and propagated changes to ${updateResult.updatedCount} tasks`,
        oldValues: { name: oldName },
        newValues: { name: newName },
        metadata: {
          tasksUpdatedCount: updateResult.updatedCount,
          updatedTaskIds: updateResult.updatedTaskIds,
          operationType: 'critical_work_type_update'
        },
        severity: 'high',
        req
      });

      console.log(`Work type "${oldName}" updated to "${newName}". Updated ${updateResult.updatedCount} tasks.`);
      
      res.json({
        ...updatedWorkType.toObject(),
        message: `Work type updated successfully. ${updateResult.updatedCount} tasks were updated with the new work type name.`,
        updatedTasksCount: updateResult.updatedCount,
        updatedTaskIds: updateResult.updatedTaskIds
      });

    } catch (updateError) {
      // Rollback the transaction in case of error
      await session.abortTransaction();
      
      // Log the error
      await ActivityLogger.log({
        userId: req.user._id,
        action: 'UPDATE_WORK_TYPE_FAILED',
        entity: 'WorkType',
        entityId: workType._id,
        description: `Failed to update work type "${oldName}" to "${newName}": ${updateError.message}`,
        metadata: {
          error: updateError.message,
          operationType: 'critical_work_type_update_failed'
        },
        severity: 'critical',
        req
      });
      
      throw updateError;
    } finally {
      // End the session
      session.endSession();
    }

  } catch (error) {
    console.error('Error updating work type:', error);
    res.status(500).json({ 
      message: 'Failed to update work type and associated tasks',
      error: error.message 
    });
  }
});

// Get work type usage statistics
router.get('/:id/usage-stats', protect, isAdminOrTeamHead, async (req, res) => {
  try {
    const workType = await WorkType.findById(req.params.id);
    if (!workType) {
      return res.status(404).json({ message: 'Work type not found' });
    }

    const usageStats = await WorkTypeUtils.getWorkTypeUsageStats(workType.name);
    res.json({
      workType: workType.name,
      ...usageStats
    });
  } catch (error) {
    console.error('Error fetching work type usage statistics:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tasks that will be affected by work type update
router.get('/:id/affected-tasks', protect, isAdminOrTeamHead, async (req, res) => {
  try {
    const workType = await WorkType.findById(req.params.id);
    if (!workType) {
      return res.status(404).json({ message: 'Work type not found' });
    }

    const affectedTasks = await WorkTypeUtils.getTasksUsingWorkType(workType.name);
    res.json({
      workType: workType.name,
      taskCount: affectedTasks.length,
      tasks: affectedTasks.map(task => ({
        id: task._id,
        title: task.title,
        clientName: task.clientName,
        assignedTo: task.assignedTo,
        status: task.status,
        workTypes: task.workType
      }))
    });
  } catch (error) {
    console.error('Error fetching affected tasks:', error);
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

    // Check if this work type can be safely deleted
    const deletionCheck = await WorkTypeUtils.canDeleteWorkType(workType.name);

    if (!deletionCheck.canDelete) {
      return res.status(400).json({ 
        message: `Cannot delete work type "${workType.name}" as it is being used in ${deletionCheck.taskCount} task(s). Please update or remove these tasks first.`,
        tasksCount: deletionCheck.taskCount
      });
    }

    await WorkType.findByIdAndDelete(req.params.id);
    
    // Log the deletion
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'DELETE_WORK_TYPE',
      entity: 'WorkType',
      entityId: workType._id,
      description: `Deleted work type "${workType.name}"`,
      oldValues: { name: workType.name },
      metadata: {
        operationType: 'work_type_deletion'
      },
      severity: 'medium',
      req
    });

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

    const deletionCheck = await WorkTypeUtils.canDeleteWorkType(workType.name);
    
    res.json({ 
      canDelete: deletionCheck.canDelete,
      tasksCount: deletionCheck.taskCount,
      message: deletionCheck.message
    });
  } catch (error) {
    console.error('Error checking work type deletion:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
