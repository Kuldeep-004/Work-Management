
import express from 'express';
import Timesheet from '../models/Timesheet.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import ActivityLogger from '../utils/activityLogger.js';

const router = express.Router();

// Get all timesheet dates with entries and isCompleted false (for red highlight)
router.get('/incomplete-dates', protect, async (req, res) => {
  try {
    const timesheets = await Timesheet.find({
      user: req.user._id,
      isCompleted: false,
      'entries.0': { $exists: true }
    }).select('date -_id');
    const dates = timesheets.map(ts => ts.date.toISOString().split('T')[0]);
    res.json({ dates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all submitted timesheet dates for the logged-in user
router.get('/submitted-dates', protect, async (req, res) => {
  try {
    const timesheets = await Timesheet.find({
      user: req.user._id,
      isCompleted: true
    }).select('date -_id');
    const dates = timesheets.map(ts => ts.date.toISOString().split('T')[0]);
    res.json({ dates });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper function to check if a timesheet is editable based on submission status
const isTimesheetEditable = async (userId, date) => {
  try {
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    
    const timesheet = await Timesheet.findOne({
      user: userId,
      date: {
        $gte: targetDate,
        $lt: nextDate
      }
    });
    
    // If timesheet doesn't exist, it's editable (can be created)
    // If timesheet exists but not completed, it's editable
    return !timesheet || !timesheet.isCompleted;
  } catch (error) {
    return false;
  }
};

// Legacy helper function maintained for backwards compatibility
const isEditableDate = (date) => {
  // This function is no longer used for date restrictions
  // Keep it for any potential legacy code references
  return true;
};

// Get timeslots
router.get('/timeslots', protect, (req, res) => {
  try {
    const timeslots = Timesheet.getTimeslots();
    res.json(timeslots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current timeslot status
router.get('/current-timeslot', protect, (req, res) => {
  try {
    const currentIndex = Timesheet.getCurrentTimeslotIndex();
    const timeslots = Timesheet.getTimeslots();
    
    res.json({
      currentIndex,
      currentTimeslot: currentIndex >= 0 ? timeslots[currentIndex] : null,
      isOfficeHours: currentIndex >= 0
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's assigned tasks for timesheet (only latest eligible user)
router.get('/my-tasks', protect, async (req, res) => {
  try {
    // Get all tasks where user is assignedTo, any verifier, or a guide
    const tasks = await Task.find({
      $or: [
        { assignedTo: req.user._id },
        { verificationAssignedTo: req.user._id },
        { secondVerificationAssignedTo: req.user._id },
        { thirdVerificationAssignedTo: req.user._id },
        { fourthVerificationAssignedTo: req.user._id },
        { fifthVerificationAssignedTo: req.user._id },
        { guides: req.user._id }
      ],
      status: { $ne: 'completed' }
    })
    .select('title description clientName clientGroup workType assignedTo verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo guides status')
    .sort({ createdAt: -1 });

    // Filter: if user is a guide, always include; else apply assignedTo/verifier rule
    const filteredTasks = tasks.filter(task => {
      // If user is a guide for this task, always allow
      if (Array.isArray(task.guides) && task.guides.map(id => id.toString()).includes(req.user._id.toString())) {
        return true;
      }
      // Otherwise, apply assignedTo/verifier rule
      const verifiers = [
        task.verificationAssignedTo,
        task.secondVerificationAssignedTo,
        task.thirdVerificationAssignedTo,
        task.fourthVerificationAssignedTo,
        task.fifthVerificationAssignedTo
      ];
      let lastAssignedVerifier = null;
      for (let i = verifiers.length - 1; i >= 0; i--) {
        if (verifiers[i]) {
          lastAssignedVerifier = verifiers[i].toString();
          break;
        }
      }

      if (task.assignedTo && task.assignedTo.toString() === req.user._id.toString()) {
        return true;
      }

      return lastAssignedVerifier === req.user._id.toString();

      return false;
    });

    res.json(filteredTasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get today's timesheet for user
router.get('/today', protect, async (req, res) => {
  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    let timesheet = await Timesheet.findOne({
      user: req.user._id,
      date: {
        $gte: today,
        $lt: tomorrow
      }
    }).populate('entries.task', 'title description clientName clientGroup workType');
    
    if (!timesheet) {
      timesheet = new Timesheet({
        user: req.user._id,
        date: today,
        entries: []
      });
    }
    
    res.json(timesheet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get timesheet for a specific date
router.get('/date/:date', protect, async (req, res) => {
  try {
    const { date } = req.params;
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    
    let timesheet = await Timesheet.findOne({
      user: req.user._id,
      date: {
        $gte: targetDate,
        $lt: nextDate
      }
    })
  .populate('user', 'firstName lastName email role team photo')
      .populate('entries.task', 'title description clientName clientGroup workType');

    if (!timesheet) {
      // Populate user manually for new/empty timesheet
  const userDoc = await User.findById(req.user._id).select('firstName lastName email role team photo');
      timesheet = {
        _id: undefined,
        user: userDoc,
        date: targetDate,
        entries: [],
        totalTimeSpent: 0,
        isCompleted: false
      };
    }
    res.json(timesheet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add entry to timesheet (today or yesterday only)
router.post('/add-entry', protect, async (req, res) => {
  try {
    const { taskId, manualTaskName, workDescription, startTime, endTime, date } = req.body;

    // Determine target date (default to today)
    let targetDate;
    if (date) {
      targetDate = new Date(date);
    } else {
      targetDate = new Date();
    }
    targetDate.setUTCHours(0, 0, 0, 0);
    
    // Check if the timesheet for this date is editable (not submitted)
    const canEdit = await isTimesheetEditable(req.user._id, targetDate);
    if (!canEdit) {
      return res.status(400).json({ 
        message: 'Cannot add entries to a submitted timesheet.' 
      });
    }
    
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    
    let timesheet = await Timesheet.findOne({
      user: req.user._id,
      date: {
        $gte: targetDate,
        $lt: nextDate
      }
    });
    
    if (timesheet && timesheet.isCompleted) {
      return res.status(400).json({ message: 'Timesheet already submitted. No more changes allowed.' });
    }
    
    if (!timesheet) {
      timesheet = new Timesheet({
        user: req.user._id,
        date: targetDate,
        entries: []
      });
    }
    
    let taskField = null;
    let manualTaskNameField = manualTaskName || '';
    
    // Handle task selection logic
    if (taskId && taskId.trim() !== '') {
      if (taskId === 'other') {
        taskField = null;
        manualTaskNameField = 'Other';
      } else if (taskId === 'internal-works') {
        taskField = null;
        manualTaskNameField = 'Internal Works';
      } else {
        // Regular task ID
        taskField = taskId;
        manualTaskNameField = manualTaskName || '';
      }
    }

    const newEntry = {
      task: taskField,
      manualTaskName: manualTaskNameField,
      workDescription: workDescription || '',
      startTime,
      endTime
    };
    
    timesheet.entries.push(newEntry);
    
    timesheet.markModified('entries');
    await timesheet.save();
    
    // Populate task details before sending response
    await timesheet.populate('entries.task', 'title description clientName clientGroup workType');
    
    // Log timesheet entry addition
    let taskTitle = 'Unnamed task';
    if (taskField) {
      try {
        const task = await Task.findById(taskField);
        taskTitle = task?.title || 'Unnamed task';
      } catch (error) {
        console.error('Error finding task for logging:', error);
        taskTitle = 'Unnamed task';
      }
    } else if (manualTaskNameField) {
      taskTitle = manualTaskNameField;
    }
    
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'timesheet_entry_added',
      timesheet._id,
      `Added timesheet entry${taskField ? ' for task' : ''} "${taskTitle}"`,
      null,
      { 
        taskId: taskField, 
        manualTaskName: manualTaskNameField, 
        workDescription, 
        startTime, 
        endTime 
      },
      req
    );
    
    res.json(timesheet);
  } catch (error) {
    console.error('Error adding timesheet entry:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete timesheet entry
router.delete('/entry/:entryId', protect, async (req, res) => {
  try {
    const { entryId } = req.params;
    
    const timesheet = await Timesheet.findOne({
      user: req.user._id,
      'entries._id': entryId
    });
    
    if (!timesheet) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Check if the timesheet is editable (not submitted)
    if (timesheet.isCompleted) {
      return res.status(400).json({ 
        message: 'Cannot delete entries from a submitted timesheet.' 
      });
    }
    
    // Find the entry to log before deletion
    const entryToDelete = timesheet.entries.id(entryId);
    
    // Log timesheet entry deletion
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'timesheet_entry_deleted',
      timesheet._id,
      `Deleted timesheet entry${entryToDelete?.task ? ' for task' : ''} "${entryToDelete?.manualTaskName || 'Task entry'}"`,
      { 
        taskId: entryToDelete?.task,
        manualTaskName: entryToDelete?.manualTaskName,
        workDescription: entryToDelete?.workDescription,
        startTime: entryToDelete?.startTime,
        endTime: entryToDelete?.endTime
      },
      null,
      req
    );
    
    timesheet.entries.pull(entryId);
    await timesheet.save();
    
    await timesheet.populate('entries.task', 'title description clientName clientGroup workType');
    
    res.json(timesheet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get subordinates' timesheets based on user role hierarchy
router.get('/subordinates', protect, async (req, res) => {
  try {
    // Check if user is Admin, TimeSheet Verifier, or Team Head
    let isTimeSheetVerifier = false;
    if (Array.isArray(req.user.role2)) {
      isTimeSheetVerifier = req.user.role2.includes('TimeSheet Verifier');
    } else {
      isTimeSheetVerifier = req.user.role2 === 'TimeSheet Verifier';
    }
    const isAdmin = req.user.role === 'Admin';
    const isTeamHead = req.user.role === 'Team Head';
    if (!(isAdmin || isTimeSheetVerifier || isTeamHead)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const { page = 1, limit = 10, startDate, userId } = req.query;
    let query = { status: { $ne: 'rejected' } };
    let subordinates;
    // Filtering logic for Team Head
    if (isTeamHead) {
      if (!req.user.team) {
        return res.status(400).json({ message: 'Team Head user does not have a team assigned' });
      }
      // All users in the same team (including self for Team Head)
      subordinates = await User.find({
        ...query,
        team: req.user.team,
        isEmailVerified: true
  }).select('_id firstName lastName email role team photo');
    } else if (isTimeSheetVerifier) {
      // TimeSheet Verifiers: show only their team members (excluding team head) + themselves
      if (req.user.team) {
        subordinates = await User.find({
          ...query,
          team: req.user.team,
          role: { $ne: 'Team Head' }, // Exclude team heads
          isEmailVerified: true
  }).select('_id firstName lastName email role team photo');
      } else {
        // If no team, show only themselves
        subordinates = [req.user];
      }
    } else if (req.user.role === 'Admin') {
      // Admins: all users except rejected
  subordinates = await User.find(query).select('_id firstName lastName email role team photo');
    }
    const subordinateIds = subordinates.map(sub => sub._id);
    // If specific user is requested, filter to that user only
    const targetUserIds = userId ? [userId] : subordinateIds;
    if (targetUserIds.length === 0) {
      return res.json({
        timesheets: [],
        subordinates: [],
        totalPages: 0,
        currentPage: parseInt(page),
        total: 0
      });
    }
    const timesheetQuery = { user: { $in: targetUserIds } };
    if (startDate) {
      const targetDate = new Date(startDate);
      targetDate.setUTCHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setUTCDate(targetDate.getUTCDate() + 1);
      timesheetQuery.date = {
        $gte: targetDate,
        $lt: nextDate
      };
    }
    const timesheets = await Timesheet.find(timesheetQuery)
      .populate('user', 'firstName lastName email role team')
      .populate('entries.task', 'title description clientName clientGroup workType')
      .sort({ date: -1, 'user.firstName': 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    const total = await Timesheet.countDocuments(timesheetQuery);
    res.json({
      timesheets,
      subordinates,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      total
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get specific subordinate's timesheet by date
router.get('/subordinate/:userId/:date', protect, async (req, res) => {
  try {
    const { userId, date } = req.params;
    
    // Verify user has permission to view this subordinate
    const subordinate = await User.findById(userId);
    if (!subordinate) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    let hasPermission = false;
    switch (req.user.role) {
      case 'Admin':
        hasPermission = true;
        break;
      case 'Senior':
        hasPermission = subordinate.role === 'Team Head';
        break;
      case 'Team Head':
        // ... logic for Team Head ...
        break;
    }
    
    if (!hasPermission) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    
    const timesheet = await Timesheet.findOne({
      user: userId,
      date: {
        $gte: targetDate,
        $lt: nextDate
      }
    }).populate('user', 'firstName lastName email role team')
      .populate('entries.task', 'title description clientName clientGroup workType');
    
    if (!timesheet) {
      return res.status(404).json({ message: 'Timesheet not found for this date' });
    }
    
    res.json(timesheet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get subordinates list for dropdown
router.get('/subordinates-list', protect, async (req, res) => {
  try {
    let query = { status: { $ne: 'rejected' } };
    let subordinates;
    const isTeamHead = req.user.role === 'Team Head';
    const isTimeSheetVerifier = Array.isArray(req.user.role2)
      ? req.user.role2.includes('TimeSheet Verifier')
      : req.user.role2 === 'TimeSheet Verifier';
    if (isTeamHead) {
      if (!req.user.team) {
        return res.status(400).json({ message: 'Team Head user does not have a team assigned' });
      }
      // All users in the same team (including self for Team Head)
      subordinates = await User.find({
        ...query,
        team: req.user.team,
        isEmailVerified: true
      }).select('_id firstName lastName email role team');
    } else if (isTimeSheetVerifier) {
      // TimeSheet Verifiers: show only their team members (excluding team head) + themselves
      if (req.user.team) {
        subordinates = await User.find({
          ...query,
          team: req.user.team,
          role: { $ne: 'Team Head' }, // Exclude team heads
          isEmailVerified: true
        }).select('_id firstName lastName email role team');
      } else {
        // If no team, show only themselves
        subordinates = [req.user];
      }
    } else if (req.user.role === 'Admin') {
      // Admins: all users except rejected
      subordinates = await User.find(query).select('_id firstName lastName email role team');
    } else {
      subordinates = [];
    }
    res.json(subordinates);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper to get minutes between two time strings (24-hour format)
function getMinutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM < startM) endM += 24 * 60;
  return endM - startM;
}

// Aggregate total hours each user worked on each task
router.get('/task-hours', protect, async (req, res) => {
  try {
    // Get all timesheet entries (both with tasks and manual tasks)
    const timesheets = await Timesheet.find({})
      .populate('user', 'firstName lastName')
      .populate('entries.task', 'title');

    // Map: { taskId: { userId: { userName, totalMinutes } } }
    const taskUserHours = {};

    timesheets.forEach(ts => {
      const user = ts.user;
      if (!user) return; // skip if user is null
      ts.entries.forEach(entry => {
        if (entry.task && entry.task._id) {
          // Regular task
          const taskId = entry.task._id.toString();
          const userId = user._id.toString();
          const userName = `${user.firstName} ${user.lastName}`;
          if (!taskUserHours[taskId]) taskUserHours[taskId] = {};
          if (!taskUserHours[taskId][userId]) {
            taskUserHours[taskId][userId] = { userId, userName, totalMinutes: 0 };
          }
          taskUserHours[taskId][userId].totalMinutes += getMinutesBetween(entry.startTime, entry.endTime);
        } else if (entry.manualTaskName) {
          // Manual task - create a special key for manual tasks
          const manualTaskKey = `manual_${entry.manualTaskName}_${user._id}`;
          const userId = user._id.toString();
          const userName = `${user.firstName} ${user.lastName}`;
          if (!taskUserHours[manualTaskKey]) taskUserHours[manualTaskKey] = {};
          if (!taskUserHours[manualTaskKey][userId]) {
            taskUserHours[manualTaskKey][userId] = { userId, userName, totalMinutes: 0, isManualTask: true, manualTaskName: entry.manualTaskName };
          }
          taskUserHours[manualTaskKey][userId].totalMinutes += getMinutesBetween(entry.startTime, entry.endTime);
        }
      });
    });

    // Flatten to array: [{ taskId, userId, userName, totalHours, isManualTask?, manualTaskName? }]
    const result = [];
    Object.entries(taskUserHours).forEach(([taskId, users]) => {
      Object.values(users).forEach(userObj => {
        result.push({
          taskId,
          userId: userObj.userId,
          userName: userObj.userName,
          totalHours: Math.round((userObj.totalMinutes || 0) / 60 * 100) / 100, // 2 decimals
          isManualTask: userObj.isManualTask || false,
          manualTaskName: userObj.manualTaskName || null
        });
      });
    });

    res.json(result);
  } catch (error) {
    console.error('Error aggregating task hours:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get total hours for each user (including manual tasks)
router.get('/user-hours', protect, async (req, res) => {
  try {
    // Get all timesheet entries
    const timesheets = await Timesheet.find({})
      .populate('user', 'firstName lastName');

    // Map: { userId: { userName, totalMinutes, manualTaskMinutes } }
    const userHours = {};

    timesheets.forEach(ts => {
      const user = ts.user;
      const userId = user._id.toString();
      const userName = `${user.firstName} ${user.lastName}`;
      
      if (!userHours[userId]) {
        userHours[userId] = { 
          userId, 
          userName, 
          totalMinutes: 0, 
          manualTaskMinutes: 0,
          regularTaskMinutes: 0
        };
      }

      ts.entries.forEach(entry => {
        const minutes = getMinutesBetween(entry.startTime, entry.endTime);
        userHours[userId].totalMinutes += minutes;
        
        if (entry.task) {
          userHours[userId].regularTaskMinutes += minutes;
        } else if (entry.manualTaskName) {
          userHours[userId].manualTaskMinutes += minutes;
        }
      });
    });

    // Convert to array format
    const result = Object.values(userHours).map(user => ({
      userId: user.userId,
      userName: user.userName,
      totalHours: Math.round((user.totalMinutes || 0) / 60 * 100) / 100,
      manualTaskHours: Math.round((user.manualTaskMinutes || 0) / 60 * 100) / 100,
      regularTaskHours: Math.round((user.regularTaskMinutes || 0) / 60 * 100) / 100
    }));

    res.json(result);
  } catch (error) {
    console.error('Error aggregating user hours:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get cost breakdown for each task (assignedTo, firstVerifier, secondVerifier, total)
router.get('/task-costs', protect, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }
    const { search, page = 1, limit = 25 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build task filter for search
    let taskFilter = {};
    if (search) {
      const searchLower = search.toLowerCase();
      taskFilter.title = { $regex: searchLower, $options: 'i' };
    }
    
    // Get tasks with pagination
    const tasks = await Task.find(taskFilter)
      .populate('assignedTo verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo guides', 'firstName lastName hourlyRate')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
      
    const totalTasks = await Task.countDocuments(taskFilter);
    
    // Get all timesheets with entries (both regular tasks and manual tasks)
    const timesheets = await Timesheet.find({}).populate('user', 'firstName lastName hourlyRate').populate('entries.task', 'title');
    // Map: { taskId: { userId: { totalMinutes } } }
    const taskUserMinutes = {};
    timesheets.forEach(ts => {
      const user = ts.user;
      if (!user) return; // skip if user is null
      ts.entries.forEach(entry => {
        if (entry.task && user) {
          // Regular task
          const taskId = entry.task._id?.toString();
          const userId = user._id?.toString();
          if (!taskId || !userId) return;
          if (!taskUserMinutes[taskId]) taskUserMinutes[taskId] = {};
          if (!taskUserMinutes[taskId][userId]) taskUserMinutes[taskId][userId] = 0;
          // Calculate minutes
          const [sh, sm] = entry.startTime.split(':').map(Number);
          const [eh, em] = entry.endTime.split(':').map(Number);
          let startM = sh * 60 + sm;
          let endM = eh * 60 + em;
          if (endM < startM) endM += 24 * 60;
          taskUserMinutes[taskId][userId] += (endM - startM);
        } else if (entry.manualTaskName && user) {
          // Manual task - create a special key for manual tasks
          const manualTaskKey = `manual_${entry.manualTaskName}_${user._id}`;
          const userId = user._id?.toString();
          if (!userId) return;
          if (!taskUserMinutes[manualTaskKey]) taskUserMinutes[manualTaskKey] = {};
          if (!taskUserMinutes[manualTaskKey][userId]) taskUserMinutes[manualTaskKey][userId] = 0;
          // Calculate minutes
          const [sh, sm] = entry.startTime.split(':').map(Number);
          const [eh, em] = entry.endTime.split(':').map(Number);
          let startM = sh * 60 + sm;
          let endM = eh * 60 + em;
          if (endM < startM) endM += 24 * 60;
          taskUserMinutes[manualTaskKey][userId] += (endM - startM);
        }
      });
    });
    // Build cost breakdown for each task
    const result = [];
    for (const task of tasks) {
      const taskId = task._id.toString();
      // Helper to get user info
      function getUserCost(user) {
        if (!user) return null;
        const userId = user._id?.toString();
        const totalMinutes = taskUserMinutes[taskId]?.[userId] || 0;
        const hours = Math.round((totalMinutes / 60) * 100) / 100;
        const cost = hours * (user.hourlyRate || 0);
        return {
          name: user.firstName + ' ' + user.lastName,
          hourlyRate: user.hourlyRate || 0,
          hours,
          cost
        };
      }
      const assignedTo = getUserCost(task.assignedTo);
      const firstVerifier = getUserCost(task.verificationAssignedTo);
      const secondVerifier = getUserCost(task.secondVerificationAssignedTo);
      const thirdVerifier = getUserCost(task.thirdVerificationAssignedTo);
      const fourthVerifier = getUserCost(task.fourthVerificationAssignedTo);
      const fifthVerifier = getUserCost(task.fifthVerificationAssignedTo);
      
      // Process guides - can have multiple guides
      const guides = [];
      if (Array.isArray(task.guides) && task.guides.length > 0) {
        task.guides.forEach(guide => {
          const guideInfo = getUserCost(guide);
          if (guideInfo) {
            guides.push(guideInfo);
          }
        });
      }
      
      const guidesCost = guides.reduce((sum, guide) => sum + (guide.cost || 0), 0);
      const totalCost = (assignedTo?.cost || 0) + (firstVerifier?.cost || 0) + (secondVerifier?.cost || 0) + 
                       (thirdVerifier?.cost || 0) + (fourthVerifier?.cost || 0) + (fifthVerifier?.cost || 0) + guidesCost;
      result.push({
        taskId: task._id,
        title: task.title,
        assignedTo,
        firstVerifier,
        secondVerifier,
        thirdVerifier,
        fourthVerifier,
        fifthVerifier,
        guides,
        totalCost
      });
    }
    
    res.json({
      tasks: result,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalTasks / parseInt(limit)),
        hasNext: parseInt(page) < Math.ceil(totalTasks / parseInt(limit)),
        hasPrev: parseInt(page) > 1,
        total: totalTasks
      }
    });
  } catch (error) {
    console.error('Error aggregating task costs:', error.stack || error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin: Get detailed timeslots for a specific task
router.get('/task/:taskId/timeslots', protect, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }

    const { taskId } = req.params;

    // Get all timesheets with entries for this specific task
    const timesheets = await Timesheet.find({
      'entries.task': taskId
    }).populate('user', 'firstName lastName role hourlyRate').populate('entries.task', 'title');

    const timeslots = [];

    timesheets.forEach(timesheet => {
      const user = timesheet.user;
      if (!user) return;

      timesheet.entries.forEach(entry => {
        if (entry.task && entry.task._id.toString() === taskId) {
          // Calculate duration in minutes
          const [startHour, startMin] = entry.startTime.split(':').map(Number);
          const [endHour, endMin] = entry.endTime.split(':').map(Number);
          
          let startMinutes = startHour * 60 + startMin;
          let endMinutes = endHour * 60 + endMin;
          
          // Handle overnight shifts
          if (endMinutes < startMinutes) {
            endMinutes += 24 * 60;
          }
          
          const duration = endMinutes - startMinutes;
          const hours = duration / 60;
          const cost = hours * (user.hourlyRate || 0);

          timeslots.push({
            userName: `${user.firstName} ${user.lastName}`,
            userRole: user.role,
            date: timesheet.date,
            startTime: entry.startTime,
            endTime: entry.endTime,
            duration: duration,
            workDescription: entry.workDescription,
            cost: cost
          });
        }
      });
    });

    // Sort by date and time
    timeslots.sort((a, b) => {
      const dateCompare = new Date(a.date) - new Date(b.date);
      if (dateCompare !== 0) return dateCompare;
      
      const [aHour, aMin] = a.startTime.split(':').map(Number);
      const [bHour, bMin] = b.startTime.split(':').map(Number);
      const aTime = aHour * 60 + aMin;
      const bTime = bHour * 60 + bMin;
      
      return aTime - bTime;
    });

    res.json(timeslots);
  } catch (error) {
    console.error('Error fetching task timeslots:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update an existing entry
router.patch('/entry/:entryId', protect, async (req, res) => {
  try {
    const { entryId } = req.params;
    const { taskId, manualTaskName, workDescription, startTime, endTime } = req.body;
    
    const timesheet = await Timesheet.findOne({
      user: req.user._id,
      'entries._id': entryId
    });
    
    if (!timesheet) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    // Check if the timesheet is editable (not submitted)
    if (timesheet.isCompleted) {
      return res.status(400).json({ 
        message: 'Cannot edit entries in a submitted timesheet.' 
      });
    }
    
    const entry = timesheet.entries.id(entryId);
    
    // Handle task selection logic
    let taskField = null;
    let manualTaskNameField = manualTaskName || '';
    
    if (taskId && taskId.trim() !== '') {
      if (taskId === 'other') {
        taskField = null;
        manualTaskNameField = 'Other';
      } else if (taskId === 'internal-works') {
        taskField = null;
        manualTaskNameField = 'Internal Works';
      } else {
        // Regular task ID
        taskField = taskId;
        manualTaskNameField = manualTaskName || '';
      }
    }
    
    entry.task = taskField;
    entry.manualTaskName = manualTaskNameField;
    entry.workDescription = workDescription || '';
    entry.startTime = startTime;
    entry.endTime = endTime;
    
    timesheet.markModified('entries');
    await timesheet.save();
    
    await timesheet.populate('entries.task', 'title description clientName clientGroup workType');
    
    res.json(timesheet);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Submit timesheet (lock it)
router.post('/submit', protect, async (req, res) => {
  try {
    const { date } = req.body;
    let targetDate;
    
    if (date) {
      // Submit for specific date
      targetDate = new Date(date);
      targetDate.setUTCHours(0, 0, 0, 0);
    } else {
      // Default to today
      targetDate = new Date();
      targetDate.setUTCHours(0, 0, 0, 0);
    }
    
    const nextDate = new Date(targetDate);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    
    let timesheet = await Timesheet.findOne({
      user: req.user._id,
      date: {
        $gte: targetDate,
        $lt: nextDate
      }
    });
    
    if (!timesheet) {
      return res.status(404).json({ message: 'No timesheet found for the specified date.' });
    }
    
    if (timesheet.isCompleted) {
      return res.status(400).json({ message: 'Timesheet already submitted.' });
    }
    
    timesheet.isCompleted = true;
    await timesheet.save();
    
    await timesheet.populate('entries.task', 'title description clientName clientGroup workType');
    
    res.json({ message: 'Timesheet submitted successfully.', timesheet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve a specific timesheet entry
router.patch('/entry/:entryId/approve', protect, async (req, res) => {
  try {
    const { entryId } = req.params;
    const timesheet = await Timesheet.findOne({ 'entries._id': entryId })
      .populate('user', 'firstName lastName email')
      .populate('entries.task', 'title');
    
    if (!timesheet) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    const entry = timesheet.entries.id(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    const previousStatus = entry.approvalStatus;
    entry.approvalStatus = 'accepted';
    await timesheet.save();

    // Log activity for timesheet entry approval
    const ActivityLogger = (await import('../utils/activityLogger.js')).default;
    const taskName = entry.task ? entry.task.title : (entry.manualTaskName || 'Manual Task');
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'timesheet_entry_approved',
      entity: 'Timesheet',
      entityId: entryId,
      description: `Approved timesheet entry: ${taskName} (${entry.startTime} - ${entry.endTime}) for ${timesheet.user.firstName} ${timesheet.user.lastName}`,
      metadata: {
        targetUserId: timesheet.user._id,
        taskName,
        timeSlot: `${entry.startTime} - ${entry.endTime}`,
        timesheetDate: timesheet.date,
        previousStatus,
        newStatus: 'accepted'
      },
      severity: 'medium',
      targetUserId: timesheet.user._id,
      req
    });
    
    res.json({ message: 'Entry approved', entry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reject a specific timesheet entry
router.patch('/entry/:entryId/reject', protect, async (req, res) => {
  try {
    const { entryId } = req.params;
    const timesheet = await Timesheet.findOne({ 'entries._id': entryId })
      .populate('user', 'firstName lastName email')
      .populate('entries.task', 'title');
    
    if (!timesheet) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    const entry = timesheet.entries.id(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    
    const previousStatus = entry.approvalStatus;
    entry.approvalStatus = 'rejected';
    // Don't modify isCompleted - keep timesheet as submitted
    await timesheet.save();

    // Log activity for timesheet entry rejection
    const ActivityLogger = (await import('../utils/activityLogger.js')).default;
    const taskName = entry.task ? entry.task.title : (entry.manualTaskName || 'Manual Task');
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'timesheet_entry_rejected',
      entity: 'Timesheet',
      entityId: entryId,
      description: `Rejected timesheet entry: ${taskName} (${entry.startTime} - ${entry.endTime}) for ${timesheet.user.firstName} ${timesheet.user.lastName}`,
      metadata: {
        targetUserId: timesheet.user._id,
        taskName,
        timeSlot: `${entry.startTime} - ${entry.endTime}`,
        timesheetDate: timesheet.date,
        previousStatus,
        newStatus: 'rejected',
        timesheetUnsubmitted: false
      },
      severity: 'high',
      targetUserId: timesheet.user._id,
      req
    });
    
    res.json({ message: 'Entry rejected', entry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Return a timesheet for editing (set isCompleted to false)
router.patch('/:timesheetId/return', protect, async (req, res) => {
  try {
    const { timesheetId } = req.params;
    const timesheet = await Timesheet.findById(timesheetId)
      .populate('user', 'firstName lastName email');
    
    if (!timesheet) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }
    
    // Set isCompleted to false so user can edit
    timesheet.isCompleted = false;
    await timesheet.save();

    // Log activity for timesheet return
    const ActivityLogger = (await import('../utils/activityLogger.js')).default;
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'timesheet_returned',
      entity: 'Timesheet',
      entityId: timesheetId,
      description: `Returned timesheet for editing: ${timesheet.user.firstName} ${timesheet.user.lastName} (${timesheet.date.toISOString().split('T')[0]})`,
      metadata: {
        targetUserId: timesheet.user._id,
        timesheetDate: timesheet.date,
        returnedForEditing: true
      },
      severity: 'medium',
      targetUserId: timesheet.user._id,
      req
    });
    
    res.json({ message: 'Timesheet returned for editing', timesheet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Accept all pending entries in a timesheet
router.patch('/:timesheetId/accept-all', protect, async (req, res) => {
  try {
    const { timesheetId } = req.params;
    const timesheet = await Timesheet.findById(timesheetId)
      .populate('user', 'firstName lastName email');
    
    if (!timesheet) {
      return res.status(404).json({ message: 'Timesheet not found' });
    }

    // Check if user has permission to approve entries
    const isTeamHead = req.user.role === 'Team Head';
    const isTimeSheetVerifier = Array.isArray(req.user.role2)
      ? req.user.role2.includes('TimeSheet Verifier')
      : req.user.role2 === 'TimeSheet Verifier';
    const isAdmin = req.user.role === 'Admin';

    if (!isTeamHead && !isTimeSheetVerifier && !isAdmin) {
      return res.status(403).json({ message: 'Access denied. You do not have permission to approve entries.' });
    }

    // Additional authorization check for Team Head - only approve subordinates
    if (isTeamHead && !isAdmin && !isTimeSheetVerifier) {
      if (!req.user.team) {
        return res.status(400).json({ message: 'Team Head user does not have a team assigned' });
      }
      if (timesheet.user.team !== req.user.team) {
        return res.status(403).json({ message: 'Access denied. You can only approve timesheets from your team.' });
      }
    }

    // Count entries that need to be accepted (pending or rejected)
    const entriesToAccept = timesheet.entries.filter(entry => 
      entry.approvalStatus === 'pending' || entry.approvalStatus === 'rejected'
    );
    
    if (entriesToAccept.length === 0) {
      return res.status(200).json({ message: 'No entries to accept. All entries are already accepted.', entriesAccepted: 0 });
    }

    // Accept all pending and rejected entries
    timesheet.entries.forEach(entry => {
      if (entry.approvalStatus === 'pending' || entry.approvalStatus === 'rejected') {
        entry.approvalStatus = 'accepted';
        entry.approvedBy = req.user._id;
        entry.approvedAt = new Date();
      }
    });

    await timesheet.save();

    // Log activity for accepting all entries
    const ActivityLogger = (await import('../utils/activityLogger.js')).default;
    await ActivityLogger.log({
      userId: req.user._id,
      action: 'timesheet_entry_approved', // valid enum value
      entity: 'Timesheet',
      entityId: timesheetId,
      description: `Accepted all ${entriesToAccept.length} pending/rejected entries for: ${timesheet.user.firstName} ${timesheet.user.lastName} (${timesheet.date.toISOString().split('T')[0]})`,
      metadata: {
        targetUserId: timesheet.user._id,
        timesheetDate: timesheet.date,
        entriesAccepted: entriesToAccept.length,
        totalEntries: timesheet.entries.length
      },
      severity: 'medium',
      targetUserId: timesheet.user._id,
      req
    });
    
    res.json({ 
      message: `Successfully accepted ${entriesToAccept.length} pending/rejected entries`, 
      timesheet,
      entriesAccepted: entriesToAccept.length 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 