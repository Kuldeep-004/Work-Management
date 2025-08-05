import express from 'express';
import ActivityLog from '../models/ActivityLog.js';
import ActivityLogger from '../utils/activityLogger.js';
import { protect } from '../middleware/authMiddleware.js';
import admin from '../middleware/admin.js';

const router = express.Router();

// Middleware to check if user is admin or head
const isAdminOrHead = (req, res, next) => {
  if (req.user.role === 'Admin' || req.user.role === 'Team Head') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin or Team Head role required.' });
  }
};

// Get all activity logs with filtering and pagination
router.get('/', protect, isAdminOrHead, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId,
      entity,
      action,
      severity,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    
    // Apply filters
    if (userId) filter.user = userId;
    if (entity) filter.entity = entity;
    if (action) filter.action = action;
    if (severity) filter.severity = severity;
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    // Search filter
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { entity: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortObj = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const activities = await ActivityLog.find(filter)
      .populate('user', 'firstName lastName email role photo team')
      .populate('targetUser', 'firstName lastName email role')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await ActivityLog.countDocuments(filter);
    
    const response = {
      activities,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1,
        limit: parseInt(limit)
      },
      filters: {
        entities: await ActivityLog.distinct('entity'),
        actions: await ActivityLog.distinct('action'),
        severities: ['low', 'medium', 'high', 'critical']
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({ message: 'Error fetching activity logs', error: error.message });
  }
});

// Get activity statistics
router.get('/stats', protect, isAdminOrHead, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // Get overall statistics
    const overallStats = await ActivityLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalActivities: { $sum: 1 },
          criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          highCount: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
          mediumCount: { $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] } },
          lowCount: { $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] } }
        }
      }
    ]);

    // Get activity by entity
    const entityStats = await ActivityLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$entity',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get activity by action
    const actionStats = await ActivityLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get top active users
    const userStats = await ActivityLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $project: {
          count: 1,
          user: {
            _id: '$user._id',
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            email: '$user.email',
            role: '$user.role'
          }
        }
      }
    ]);

    // Get activity timeline based on groupBy parameter
    let dateGrouping;
    switch (groupBy) {
      case 'hour':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' },
          hour: { $hour: '$createdAt' }
        };
        break;
      case 'day':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
        break;
      case 'week':
        dateGrouping = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'month':
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default:
        dateGrouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }

    const timelineStats = await ActivityLog.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: dateGrouping,
          count: { $sum: 1 },
          criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'critical'] }, 1, 0] } },
          highCount: { $sum: { $cond: [{ $eq: ['$severity', 'high'] }, 1, 0] } },
          mediumCount: { $sum: { $cond: [{ $eq: ['$severity', 'medium'] }, 1, 0] } },
          lowCount: { $sum: { $cond: [{ $eq: ['$severity', 'low'] }, 1, 0] } }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    const stats = {
      overall: overallStats[0] || {
        totalActivities: 0,
        criticalCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
      },
      byEntity: entityStats,
      byAction: actionStats,
      topUsers: userStats,
      timeline: timelineStats
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching activity statistics:', error);
    res.status(500).json({ message: 'Error fetching activity statistics', error: error.message });
  }
});

// Get recent activities for dashboard
router.get('/recent', protect, isAdminOrHead, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const recentActivities = await ActivityLog.find()
      .populate('user', 'firstName lastName email role photo')
      .populate('targetUser', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json(recentActivities);
  } catch (error) {
    console.error('Error fetching recent activities:', error);
    res.status(500).json({ message: 'Error fetching recent activities', error: error.message });
  }
});

// Get activity details by ID
router.get('/:id', protect, isAdminOrHead, async (req, res) => {
  try {
    const activity = await ActivityLog.findById(req.params.id)
      .populate('user', 'firstName lastName email role photo team')
      .populate('targetUser', 'firstName lastName email role')
      .lean();

    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }

    res.json(activity);
  } catch (error) {
    console.error('Error fetching activity details:', error);
    res.status(500).json({ message: 'Error fetching activity details', error: error.message });
  }
});

// Get activities for a specific user
router.get('/user/:userId', protect, isAdminOrHead, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const activities = await ActivityLog.find({ user: userId })
      .populate('user', 'firstName lastName email role photo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await ActivityLog.countDocuments({ user: userId });
    
    res.json({
      activities,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching user activities:', error);
    res.status(500).json({ message: 'Error fetching user activities', error: error.message });
  }
});

// Export activities to CSV
router.get('/export/csv', protect, isAdminOrHead, async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      entity,
      action,
      severity,
      userId
    } = req.query;

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

    const activities = await ActivityLog.find(filter)
      .populate('user', 'firstName lastName email role')
      .populate('targetUser', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .lean();

    // Convert to CSV format
    const csvHeaders = [
      'Date',
      'Time',
      'User',
      'User Role',
      'Action',
      'Entity',
      'Description',
      'Severity',
      'Target User',
      'IP Address',
      'User Agent'
    ].join(',');

    const csvRows = activities.map(activity => {
      const date = new Date(activity.createdAt);
      return [
        date.toISOString().split('T')[0],
        date.toTimeString().split(' ')[0],
        `"${activity.user ? `${activity.user.firstName} ${activity.user.lastName}` : 'Unknown'}"`,
        `"${activity.user ? activity.user.role : 'Unknown'}"`,
        `"${activity.action}"`,
        `"${activity.entity}"`,
        `"${activity.description.replace(/"/g, '""')}"`,
        `"${activity.severity}"`,
        `"${activity.targetUser ? `${activity.targetUser.firstName} ${activity.targetUser.lastName}` : ''}"`,
        `"${activity.metadata?.ip || ''}"`,
        `"${activity.metadata?.userAgent || ''}"`
      ].join(',');
    });

    const csvContent = [csvHeaders, ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);

    // Log the export activity
    await ActivityLogger.logAuthActivity(
      req.user.id,
      'data_export',
      `Exported activity logs to CSV (${activities.length} records)`,
      req,
      { exportType: 'csv', recordCount: activities.length }
    );

  } catch (error) {
    console.error('Error exporting activity logs:', error);
    res.status(500).json({ message: 'Error exporting activity logs', error: error.message });
  }
});

// Delete old activity logs (maintenance endpoint - Admin only)
router.delete('/maintenance/cleanup', protect, admin, async (req, res) => {
  try {
    const { daysToKeep = 365 } = req.body;
    
    const deletedCount = await ActivityLogger.cleanOldLogs(parseInt(daysToKeep));
    
    // Log the cleanup activity
    await ActivityLogger.logAuthActivity(
      req.user.id,
      `Cleaned up old activity logs (${deletedCount} records deleted, keeping ${daysToKeep} days)`,
      req,
      { deletedCount, daysToKeep }
    );

    res.json({ 
      message: 'Activity logs cleanup completed', 
      deletedCount,
      daysToKeep: parseInt(daysToKeep)
    });
  } catch (error) {
    console.error('Error cleaning up activity logs:', error);
    res.status(500).json({ message: 'Error cleaning up activity logs', error: error.message });
  }
});

export default router;
