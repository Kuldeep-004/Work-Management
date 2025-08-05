import ActivityLog from '../models/ActivityLog.js';
import User from '../models/User.js';

/**
 * Comprehensive Activity Logger Utility
 * Logs all user activities with detailed information
 */

class ActivityLogger {
  
  /**
   * Log an activity with comprehensive details
   * @param {Object} options - Activity log options
   * @param {String} options.userId - ID of the user performing the action
   * @param {String} options.action - Action being performed
   * @param {String} options.entity - Entity being acted upon
   * @param {String} options.entityId - ID of the entity
   * @param {String} options.description - Human readable description
   * @param {Object} options.oldValues - Previous values (for updates)
   * @param {Object} options.newValues - New values (for updates)
   * @param {Object} options.metadata - Additional metadata
   * @param {String} options.severity - Severity level
   * @param {String} options.targetUserId - Target user ID (for user-related actions)
   * @param {Array} options.relatedEntities - Related entities
   * @param {Object} options.req - Express request object (for IP, user agent, etc.)
   */
  static async log({
    userId,
    action,
    entity,
    entityId = null,
    description,
    oldValues = null,
    newValues = null,
    metadata = {},
    severity = 'medium',
    targetUserId = null,
    relatedEntities = [],
    req = null
  }) {
    try {
      // Extract metadata from request if provided
      if (req) {
        metadata.ip = req.ip || req.connection.remoteAddress;
        metadata.userAgent = req.get('User-Agent');
        metadata.route = req.route?.path || req.path;
        metadata.method = req.method;
      }

      const activityLog = new ActivityLog({
        user: userId,
        action,
        entity,
        entityId,
        description,
        oldValues,
        newValues,
        metadata,
        severity,
        targetUser: targetUserId,
        relatedEntities
      });

      await activityLog.save();
      return activityLog;
    } catch (error) {
      console.error('Error logging activity:', error);
      // Don't throw error to prevent breaking main functionality
    }
  }

  /**
   * Log task-related activities
   */
  static async logTaskActivity(userId, action, taskId, description, oldValues = null, newValues = null, req = null, metadata = {}) {
    return this.log({
      userId,
      action,
      entity: 'Task',
      entityId: taskId,
      description,
      oldValues,
      newValues,
      metadata,
      req,
      severity: this.getTaskActionSeverity(action)
    });
  }

  /**
   * Log user-related activities
   */
  static async logUserActivity(userId, action, targetUserId, description, oldValues = null, newValues = null, req = null, metadata = {}) {
    return this.log({
      userId,
      action,
      entity: 'User',
      entityId: targetUserId,
      description,
      oldValues,
      newValues,
      metadata,
      req,
      targetUserId,
      severity: this.getUserActionSeverity(action)
    });
  }

  /**
   * Log team-related activities
   */
  static async logTeamActivity(userId, action, teamId, description, oldValues = null, newValues = null, req = null, metadata = {}) {
    return this.log({
      userId,
      action,
      entity: 'Team',
      entityId: teamId,
      description,
      oldValues,
      newValues,
      metadata,
      req,
      severity: this.getTeamActionSeverity(action)
    });
  }

  /**
   * Log client-related activities
   */
  static async logClientActivity(userId, action, clientId, description, oldValues = null, newValues = null, req = null, metadata = {}) {
    return this.log({
      userId,
      action,
      entity: 'Client',
      entityId: clientId,
      description,
      oldValues,
      newValues,
      metadata,
      req,
      severity: 'medium'
    });
  }

  /**
   * Log automation-related activities
   */
  static async logAutomationActivity(userId, action, automationId, description, oldValues = null, newValues = null, req = null, metadata = {}) {
    return this.log({
      userId,
      action,
      entity: 'Automation',
      entityId: automationId,
      description,
      oldValues,
      newValues,
      metadata,
      req,
      severity: this.getAutomationActionSeverity(action)
    });
  }

  /**
   * Log timesheet-related activities
   */
  static async logTimesheetActivity(userId, action, timesheetId, description, oldValues = null, newValues = null, req = null, metadata = {}) {
    return this.log({
      userId,
      action,
      entity: 'Timesheet',
      entityId: timesheetId,
      description,
      oldValues,
      newValues,
      metadata,
      req,
      severity: this.getTimesheetActionSeverity(action)
    });
  }

  /**
   * Log authentication activities
   */
  static async logAuthActivity(userId, action, description, req = null, metadata = {}) {
    return this.log({
      userId,
      action,
      entity: 'System',
      description,
      metadata,
      req,
      severity: this.getAuthActionSeverity(action)
    });
  }

  /**
   * Log file operations
   */
  static async logFileActivity(userId, action, entityId, description, fileDetails = {}, req = null) {
    return this.log({
      userId,
      action,
      entity: 'File',
      entityId,
      description,
      metadata: { fileDetails },
      req,
      severity: 'low'
    });
  }

  /**
   * Log bulk operations
   */
  static async logBulkOperation(userId, action, entity, description, bulkData = {}, req = null) {
    return this.log({
      userId,
      action,
      entity,
      description,
      metadata: { bulkOperation: bulkData },
      req,
      severity: 'high'
    });
  }

  /**
   * Get activity logs with filters and pagination
   */
  static async getActivityLogs({
    page = 1,
    limit = 50,
    userId = null,
    entity = null,
    action = null,
    severity = null,
    startDate = null,
    endDate = null,
    search = null
  }) {
    try {
      const filter = {};
      
      if (userId) filter.user = userId;
      if (entity) filter.entity = entity;
      if (action) filter.action = action;
      if (severity) filter.severity = severity;
      
      if (startDate || endDate) {
        filter.createdAt = {};
        if (startDate) filter.createdAt.$gte = new Date(startDate);
        if (endDate) filter.createdAt.$lte = new Date(endDate);
      }
      
      if (search) {
        filter.description = { $regex: search, $options: 'i' };
      }

      const skip = (page - 1) * limit;
      
      const activities = await ActivityLog.find(filter)
        .populate('user', 'firstName lastName email role photo')
        .populate('targetUser', 'firstName lastName email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await ActivityLog.countDocuments(filter);
      
      return {
        activities,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      throw error;
    }
  }

  /**
   * Get activity statistics
   */
  static async getActivityStats(startDate = null, endDate = null) {
    try {
      const matchStage = {};
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.createdAt.$lte = new Date(endDate);
      }

      const stats = await ActivityLog.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalActivities: { $sum: 1 },
            entitiesStats: {
              $push: {
                entity: '$entity',
                action: '$action',
                severity: '$severity'
              }
            }
          }
        },
        {
          $project: {
            totalActivities: 1,
            entityBreakdown: {
              $reduce: {
                input: '$entitiesStats',
                initialValue: {},
                in: {
                  $mergeObjects: [
                    '$$value',
                    {
                      $let: {
                        vars: { entity: '$$this.entity' },
                        in: {
                          $arrayToObject: [
                            [{
                              k: '$$entity',
                              v: { $add: [{ $ifNull: [{ $getField: { field: '$$entity', input: '$$value' } }, 0] }, 1] }
                            }]
                          ]
                        }
                      }
                    }
                  ]
                }
              }
            }
          }
        }
      ]);

      return stats[0] || { totalActivities: 0, entityBreakdown: {} };
    } catch (error) {
      console.error('Error fetching activity stats:', error);
      throw error;
    }
  }

  // Severity level helpers
  static getTaskActionSeverity(action) {
    const criticalActions = ['task_deleted'];
    const highActions = ['task_created', 'task_verified', 'task_rejected'];
    const lowActions = ['task_file_uploaded', 'task_comment_added'];
    
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    if (lowActions.includes(action)) return 'low';
    return 'medium';
  }

  static getUserActionSeverity(action) {
    const criticalActions = ['user_deleted', 'user_blocked'];
    const highActions = ['user_created', 'user_role_changed', 'user_approved', 'user_rejected'];
    
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    return 'medium';
  }

  static getTeamActionSeverity(action) {
    const highActions = ['team_deleted', 'team_head_changed'];
    const mediumActions = ['team_created', 'team_updated'];
    
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    return 'low';
  }

  static getAutomationActionSeverity(action) {
    const highActions = ['automation_deleted', 'automation_executed'];
    const mediumActions = ['automation_created', 'automation_updated'];
    
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    return 'low';
  }

  static getTimesheetActionSeverity(action) {
    const highActions = ['timesheet_deleted'];
    const mediumActions = ['timesheet_approved', 'timesheet_rejected', 'timesheet_verified'];
    
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    return 'low';
  }

  static getAuthActionSeverity(action) {
    const criticalActions = ['account_locked', 'account_unlocked'];
    const highActions = ['user_login', 'password_reset_completed'];
    const mediumActions = ['password_reset_requested', 'email_verified'];
    
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    return 'low';
  }

  static getSystemActionSeverity(action) {
    const criticalActions = ['announcement_deleted', 'priority_deleted'];
    const highActions = ['announcement_created', 'priority_created', 'automation_triggered', 'automation_status_reset'];
    const mediumActions = ['priority_updated', 'notification_deleted', 'notifications_mark_all_read'];
    const lowActions = ['notification_read'];
    
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    if (lowActions.includes(action)) return 'low';
    return 'medium';
  }

  /**
   * Log system-level activities (announcements, priorities, etc.)
   */
  static async logSystemActivity(userId, action, entityId, description, oldValues = null, newValues = null, req = null, metadata = {}) {
    return this.log({
      userId,
      action,
      entity: 'System',
      entityId,
      description,
      oldValues,
      newValues,
      metadata,
      req,
      severity: this.getSystemActionSeverity(action)
    });
  }

  /**
   * Clean old activity logs (for maintenance)
   */
  static async cleanOldLogs(daysToKeep = 365) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const result = await ActivityLog.deleteMany({
        createdAt: { $lt: cutoffDate }
      });
      
      return result.deletedCount;
    } catch (error) {
      console.error('Error cleaning old logs:', error);
      throw error;
    }
  }
}

export default ActivityLogger;
