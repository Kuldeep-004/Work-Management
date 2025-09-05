import express from 'express';
import Task from '../models/Task.js';
import TaskStatus from '../models/TaskStatus.js';
import Priority from '../models/Priority.js';
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

// Execute bulk status name update with safety checks
router.post('/execute-status-update', protect, adminOrTeamHead, async (req, res) => {
  try {
    const { oldName, newName } = req.body;

    if (!oldName || !newName) {
      return res.status(400).json({ 
        message: 'oldName and newName are required' 
      });
    }

    // Double check that new name doesn't exist
    const existingNewStatus = await TaskStatus.findOne({ name: newName });
    if (existingNewStatus) {
      return res.status(400).json({ 
        message: 'A status with the new name already exists. Cannot proceed.' 
      });
    }

    // Get the status to update
    const statusToUpdate = await TaskStatus.findOne({ name: oldName });
    if (!statusToUpdate) {
      return res.status(404).json({ message: 'Status not found' });
    }

    // Start transaction for safety
    const session = await Task.db.startSession();
    
    let updatedTasksCount = 0;
    let updatedStatus = null;

    try {
      await session.withTransaction(async () => {
        // First update the status name to avoid validation issues
        statusToUpdate.name = newName;
        updatedStatus = await statusToUpdate.save({ session });

        // Then update all tasks with the old status name
        const taskUpdateResult = await Task.updateMany(
          { status: oldName },
          { $set: { status: newName } },
          { session, runValidators: false } // Disable validators during bulk update
        );
        updatedTasksCount = taskUpdateResult.modifiedCount;
      });

      // Log the bulk update activity
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'task_status_bulk_updated',
        statusToUpdate._id,
        `Bulk updated status name from "${oldName}" to "${newName}" affecting ${updatedTasksCount} tasks`,
        { oldName },
        { newName, affectedTasksCount: updatedTasksCount },
        req
      );

      res.json({
        success: true,
        message: `Successfully updated ${updatedTasksCount} tasks and status name`,
        updatedTasksCount,
        updatedStatus,
        operation: 'status_update'
      });

    } catch (transactionError) {
      throw transactionError;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to execute bulk status update', 
      error: error.message 
    });
  }
});

// Execute bulk priority name update with safety checks
router.post('/execute-priority-update', protect, adminOrTeamHead, async (req, res) => {
  try {
    const { oldName, newName } = req.body;

    if (!oldName || !newName) {
      return res.status(400).json({ 
        message: 'oldName and newName are required' 
      });
    }

    // Double check that new name doesn't exist
    const existingNewPriority = await Priority.findOne({ name: newName });
    if (existingNewPriority) {
      return res.status(400).json({ 
        message: 'A priority with the new name already exists. Cannot proceed.' 
      });
    }

    // Get the priority to update
    const priorityToUpdate = await Priority.findOne({ name: oldName });
    if (!priorityToUpdate) {
      return res.status(404).json({ message: 'Priority not found' });
    }

    // Start transaction for safety
    const session = await Task.db.startSession();
    
    let updatedTasksCount = 0;
    let updatedPriority = null;

    try {
      await session.withTransaction(async () => {
        // First update the priority name
        priorityToUpdate.name = newName;
        updatedPriority = await priorityToUpdate.save({ session });

        // Then update all tasks with the old priority name
        const taskUpdateResult = await Task.updateMany(
          { priority: oldName },
          { $set: { priority: newName } },
          { session, runValidators: false } // Disable validators during bulk update
        );
        updatedTasksCount = taskUpdateResult.modifiedCount;
      });

      // Log the bulk update activity
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'priority_bulk_updated',
        priorityToUpdate._id,
        `Bulk updated priority name from "${oldName}" to "${newName}" affecting ${updatedTasksCount} tasks`,
        { oldName },
        { newName, affectedTasksCount: updatedTasksCount },
        req
      );

      res.json({
        success: true,
        message: `Successfully updated ${updatedTasksCount} tasks and priority name`,
        updatedTasksCount,
        updatedPriority,
        operation: 'priority_update'
      });

    } catch (transactionError) {
      throw transactionError;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to execute bulk priority update', 
      error: error.message 
    });
  }
});

export default router;
