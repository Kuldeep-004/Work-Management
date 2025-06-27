import express from 'express';
import Timesheet from '../models/Timesheet.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import User from '../models/User.js';

const router = express.Router();

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

// Get user's assigned tasks for timesheet
router.get('/my-tasks', protect, async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [
        { assignedTo: req.user._id },
        { verificationAssignedTo: req.user._id },
        { secondVerificationAssignedTo: req.user._id }
      ],
      status: { $ne: 'completed' }
    })
    .select('title description clientName clientGroup workType')
    .sort({ createdAt: -1 });
    
    res.json(tasks);
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

// Add entry to today's timesheet
router.post('/add-entry', protect, async (req, res) => {
  try {
    const { taskId, manualTaskName, workDescription, startTime, endTime } = req.body;

    // Get today's timesheet
    const todayDate = new Date();
    todayDate.setUTCHours(0, 0, 0, 0);
    
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setUTCDate(tomorrowDate.getUTCDate() + 1);
    
    let timesheet = await Timesheet.findOne({
      user: req.user._id,
      date: {
        $gte: todayDate,
        $lt: tomorrowDate
      }
    });
    
    if (timesheet && timesheet.isCompleted) {
      return res.status(400).json({ message: 'Timesheet already submitted. No more changes allowed.' });
    }
    
    if (!timesheet) {
      timesheet = new Timesheet({
        user: req.user._id,
        date: todayDate,
        entries: []
      });
    }
    
    const newEntry = {
      task: taskId || null,
      manualTaskName: manualTaskName || '',
      workDescription: workDescription || '',
      startTime,
      endTime
    };

    timesheet.entries.push(newEntry);
    
    timesheet.markModified('entries');
    await timesheet.save();
    
    // Populate task details before sending response
    await timesheet.populate('entries.task', 'title description clientName clientGroup workType');
    
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
    
    if (timesheet.isCompleted) {
      return res.status(400).json({ message: 'Timesheet already submitted. No more changes allowed.' });
    }
    
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
    const { page = 1, limit = 10, startDate, userId } = req.query;
    let query = { status: { $ne: 'rejected' } };
    // Always get all users except rejected
    const subordinates = await User.find(query).select('_id firstName lastName email role team');
    const subordinateIds = subordinates.map(sub => sub._id);
    // Ensure the current user is in the list
    const currentUserInList = subordinates.some(sub => sub._id.toString() === req.user._id.toString());
    if (!currentUserInList) {
      const me = await User.findById(req.user._id).select('_id firstName lastName email role team');
      if (me) {
        subordinates.unshift(me);
        subordinateIds.unshift(me._id);
      }
    }
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
    // Calculate totalTimeSpent for each timesheet
    const timesheetsWithTotal = timesheets.map(ts => {
      const entries = Array.isArray(ts.entries) ? ts.entries : [];
      const totalTimeSpent = entries.reduce((sum, entry) => {
        if (entry.startTime && entry.endTime) {
          const [sh, sm] = entry.startTime.split(':').map(Number);
          const [eh, em] = entry.endTime.split(':').map(Number);
          let startM = sh * 60 + sm;
          let endM = eh * 60 + em;
          if (endM < startM) endM += 24 * 60;
          return sum + (endM - startM);
        }
        return sum;
      }, 0);
      return { ...ts.toObject(), totalTimeSpent };
    });
    res.json({
      timesheets: timesheetsWithTotal,
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
      case 'Head':
        hasPermission = subordinate.role === 'Team Head';
        break;
      case 'Team Head':
        hasPermission = subordinate.role === 'Fresher' && subordinate.team?.toString() === req.user.team?.toString();
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
    let subordinates = await User.find(query).select('_id firstName lastName email role team');
    // Ensure current user is included
    const currentUserInList = subordinates.some(sub => sub._id.toString() === req.user._id.toString());
    if (!currentUserInList) {
      const me = await User.findById(req.user._id).select('_id firstName lastName email role team');
      if (me) subordinates.unshift(me);
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
    // Get all timesheet entries with a valid task
    const timesheets = await Timesheet.find({ 'entries.task': { $ne: null } })
      .populate('user', 'firstName lastName')
      .populate('entries.task', 'title');

    // Map: { taskId: { userId: { userName, totalMinutes } } }
    const taskUserHours = {};

    timesheets.forEach(ts => {
      const user = ts.user;
      ts.entries.forEach(entry => {
        if (entry.task) {
          const taskId = entry.task._id.toString();
          const userId = user._id.toString();
          const userName = `${user.firstName} ${user.lastName}`;
          if (!taskUserHours[taskId]) taskUserHours[taskId] = {};
          if (!taskUserHours[taskId][userId]) {
            taskUserHours[taskId][userId] = { userId, userName, totalMinutes: 0 };
          }
          taskUserHours[taskId][userId].totalMinutes += getMinutesBetween(entry.startTime, entry.endTime);
        }
      });
    });

    // Flatten to array: [{ taskId, userId, userName, totalHours }]
    const result = [];
    Object.entries(taskUserHours).forEach(([taskId, users]) => {
      Object.values(users).forEach(userObj => {
        result.push({
          taskId,
          userId: userObj.userId,
          userName: userObj.userName,
          totalHours: Math.round((userObj.totalMinutes || 0) / 60 * 100) / 100 // 2 decimals
        });
      });
    });

    res.json(result);
  } catch (error) {
    console.error('Error aggregating task hours:', error);
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
    const { search } = req.query;
    // Get all tasks
    const tasks = await Task.find().populate('assignedTo verificationAssignedTo secondVerificationAssignedTo', 'firstName lastName hourlyRate');
    // Get all timesheets with entries linked to tasks
    const timesheets = await Timesheet.find({ 'entries.task': { $ne: null } }).populate('user', 'firstName lastName hourlyRate').populate('entries.task', 'title');
    // Map: { taskId: { userId: { totalMinutes } } }
    const taskUserMinutes = {};
    timesheets.forEach(ts => {
      const user = ts.user;
      ts.entries.forEach(entry => {
        if (entry.task) {
          const taskId = entry.task._id.toString();
          const userId = user._id.toString();
          if (!taskUserMinutes[taskId]) taskUserMinutes[taskId] = {};
          if (!taskUserMinutes[taskId][userId]) taskUserMinutes[taskId][userId] = 0;
          // Calculate minutes
          const [sh, sm] = entry.startTime.split(':').map(Number);
          const [eh, em] = entry.endTime.split(':').map(Number);
          let startM = sh * 60 + sm;
          let endM = eh * 60 + em;
          if (endM < startM) endM += 24 * 60;
          taskUserMinutes[taskId][userId] += (endM - startM);
        }
      });
    });
    // Build cost breakdown for each task
    const result = [];
    for (const task of tasks) {
      // Filter by search if needed
      if (search) {
        const searchLower = search.toLowerCase();
        if (!task.title.toLowerCase().includes(searchLower)) {
          continue;
        }
      }
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
      const totalCost = (assignedTo?.cost || 0) + (firstVerifier?.cost || 0) + (secondVerifier?.cost || 0);
      result.push({
        taskId: task._id,
        title: task.title,
        assignedTo,
        firstVerifier,
        secondVerifier,
        totalCost
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error aggregating task costs:', error);
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
    
    if (timesheet.isCompleted) {
      return res.status(400).json({ message: 'Timesheet already submitted. No more changes allowed.' });
    }
    
    const entry = timesheet.entries.id(entryId);
    
    entry.task = taskId || null;
    entry.manualTaskName = manualTaskName || '';
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

// Submit today's timesheet (lock it)
router.post('/submit', protect, async (req, res) => {
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
    });
    if (!timesheet) {
      return res.status(404).json({ message: 'No timesheet found for today.' });
    }
    if (timesheet.isCompleted) {
      return res.status(400).json({ message: 'Timesheet already submitted.' });
    }
    timesheet.isCompleted = true;
    await timesheet.save();
    res.json({ message: 'Timesheet submitted successfully.', timesheet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve a specific timesheet entry
router.patch('/entry/:entryId/approve', protect, async (req, res) => {
  try {
    const { entryId } = req.params;
    const timesheet = await Timesheet.findOne({ 'entries._id': entryId });
    if (!timesheet) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    const entry = timesheet.entries.id(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    entry.approvalStatus = 'accepted';
    await timesheet.save();
    res.json({ message: 'Entry approved', entry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Reject a specific timesheet entry
router.patch('/entry/:entryId/reject', protect, async (req, res) => {
  try {
    const { entryId } = req.params;
    const timesheet = await Timesheet.findOne({ 'entries._id': entryId });
    if (!timesheet) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    const entry = timesheet.entries.id(entryId);
    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }
    entry.approvalStatus = 'rejected';
    await timesheet.save();
    res.json({ message: 'Entry rejected', entry });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 