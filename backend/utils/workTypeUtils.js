import mongoose from 'mongoose';
import Task from '../models/Task.js';
import ActivityLogger from './activityLogger.js';

/**
 * Utility functions for work type operations
 */

class WorkTypeUtils {
  
  /**
   * Update work type name across all tasks that use it
   * @param {String} oldName - The current work type name
   * @param {String} newName - The new work type name
   * @param {Object} user - User performing the operation
   * @param {Object} req - Express request object for logging
   * @param {Object} session - MongoDB session for transaction
   * @returns {Object} Result object with success status and count
   */
  static async updateWorkTypeInTasks(oldName, newName, user, req = null, session = null) {
    try {
      if (!oldName || !newName || oldName === newName) {
        return { success: true, updatedCount: 0, message: 'No update needed' };
      }

      // Find all tasks that contain the old work type name
      const tasksToUpdate = await Task.find({ 
        workType: { $in: [oldName] }
      }).session(session);

      let updatedTasksCount = 0;
      const updatedTaskIds = [];
      const taskUpdatePromises = [];

      for (const task of tasksToUpdate) {
        // Replace the old work type name with the new one in the workType array
        const updatedWorkTypes = task.workType.map(wt => 
          wt === oldName ? newName : wt
        );
        
        // Update the task only if there's a change
        if (JSON.stringify(task.workType) !== JSON.stringify(updatedWorkTypes)) {
          const updatePromise = Task.findByIdAndUpdate(
            task._id,
            { workType: updatedWorkTypes },
            { session, new: true }
          );
          
          taskUpdatePromises.push(updatePromise);
          updatedTaskIds.push(task._id);
          updatedTasksCount++;
        }
      }

      // Execute all updates in parallel for better performance
      if (taskUpdatePromises.length > 0) {
        await Promise.all(taskUpdatePromises);
      }

      // Log the operation if user context is provided
      if (user) {
        await ActivityLogger.log({
          userId: user._id,
          action: 'BULK_UPDATE_WORK_TYPE_IN_TASKS',
          entity: 'Task',
          description: `Updated work type "${oldName}" to "${newName}" across ${updatedTasksCount} tasks`,
          metadata: {
            oldWorkTypeName: oldName,
            newWorkTypeName: newName,
            tasksUpdatedCount: updatedTasksCount,
            updatedTaskIds: updatedTaskIds,
            operationType: 'work_type_propagation'
          },
          severity: updatedTasksCount > 10 ? 'high' : 'medium',
          req
        });
      }

      return {
        success: true,
        updatedCount: updatedTasksCount,
        updatedTaskIds: updatedTaskIds,
        message: `Successfully updated ${updatedTasksCount} tasks`
      };

    } catch (error) {
      // Log the error if user context is provided
      if (user) {
        await ActivityLogger.log({
          userId: user._id,
          action: 'BULK_UPDATE_WORK_TYPE_FAILED',
          entity: 'Task',
          description: `Failed to update work type "${oldName}" to "${newName}": ${error.message}`,
          metadata: {
            oldWorkTypeName: oldName,
            newWorkTypeName: newName,
            error: error.message,
            operationType: 'work_type_propagation_failed'
          },
          severity: 'critical',
          req
        });
      }

      throw new Error(`Failed to update work type in tasks: ${error.message}`);
    }
  }

  /**
   * Get all tasks that use a specific work type
   * @param {String} workTypeName - The work type name to search for
   * @param {Object} session - MongoDB session for transaction
   * @returns {Array} Array of tasks using the work type
   */
  static async getTasksUsingWorkType(workTypeName, session = null) {
    try {
      const tasks = await Task.find({ 
        workType: { $in: [workTypeName] }
      })
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .session(session);

      return tasks;
    } catch (error) {
      throw new Error(`Failed to fetch tasks using work type: ${error.message}`);
    }
  }

  /**
   * Check if a work type can be safely deleted
   * @param {String} workTypeName - The work type name to check
   * @returns {Object} Result object with deletion status and task count
   */
  static async canDeleteWorkType(workTypeName) {
    try {
      const taskCount = await Task.countDocuments({ 
        workType: { $in: [workTypeName] }
      });

      return {
        canDelete: taskCount === 0,
        taskCount: taskCount,
        message: taskCount === 0 
          ? 'Work type can be safely deleted' 
          : `Cannot delete work type. It is used in ${taskCount} task(s)`
      };
    } catch (error) {
      throw new Error(`Failed to check work type deletion status: ${error.message}`);
    }
  }

  /**
   * Validate work type name
   * @param {String} name - The work type name to validate
   * @returns {Object} Validation result
   */
  static validateWorkTypeName(name) {
    if (!name || typeof name !== 'string') {
      return { isValid: false, message: 'Work type name is required' };
    }

    const trimmedName = name.trim();
    
    if (trimmedName.length === 0) {
      return { isValid: false, message: 'Work type name cannot be empty' };
    }

    if (trimmedName.length > 100) {
      return { isValid: false, message: 'Work type name cannot exceed 100 characters' };
    }

    // Check for special characters that might cause issues
    const invalidChars = /[<>\"'&]/;
    if (invalidChars.test(trimmedName)) {
      return { isValid: false, message: 'Work type name contains invalid characters' };
    }

    return { isValid: true, trimmedName: trimmedName };
  }

  /**
   * Get work type usage statistics
   * @param {String} workTypeName - The work type name to analyze
   * @returns {Object} Usage statistics
   */
  static async getWorkTypeUsageStats(workTypeName) {
    try {
      const pipeline = [
        { $match: { workType: { $in: [workTypeName] } } },
        {
          $group: {
            _id: null,
            totalTasks: { $sum: 1 },
            statuses: { $push: '$status' },
            assignedUsers: { $addToSet: '$assignedTo' }
          }
        },
        {
          $project: {
            totalTasks: 1,
            uniqueAssignedUsers: { $size: '$assignedUsers' },
            statusCounts: {
              $reduce: {
                input: '$statuses',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $cond: [
                        { $eq: [{ $type: { $getField: { field: '$$this', input: '$$value' } } }, 'missing'] },
                        { $arrayToObject: [[{ k: '$$this', v: 1 }]] },
                        { $arrayToObject: [[{ k: '$$this', v: { $add: [{ $getField: { field: '$$this', input: '$$value' } }, 1] } }]] }
                      ]
                    }
                  ]
                }
              }
            }
          }
        }
      ];

      const result = await Task.aggregate(pipeline);
      
      return result.length > 0 ? result[0] : { 
        totalTasks: 0, 
        uniqueAssignedUsers: 0, 
        statusCounts: {} 
      };
    } catch (error) {
      throw new Error(`Failed to get work type usage statistics: ${error.message}`);
    }
  }
}

export default WorkTypeUtils;
