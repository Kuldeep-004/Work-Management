import express from 'express';
import Task from '../models/Task.js';
import Priority from '../models/Priority.js';
import CustomColumn from '../models/CustomColumn.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';
import mongoose from 'mongoose';
import { uploadTaskFilesMiddleware } from '../middleware/uploadMiddleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Team from '../models/Team.js';
import Client from '../models/Client.js';
import ClientGroup from '../models/ClientGroup.js';
import WorkType from '../models/WorkType.js';
import Notification from '../models/Notification.js';
import { uploadFile, deleteFile } from '../utils/cloudinary.js';
import { promisify } from 'util';
import ActivityLogger from '../utils/activityLogger.js';
import { truncateTaskName, getVerifierType } from '../utils/notificationUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper function to validate priority - check both static and dynamic priorities
const isValidPriority = async (priorityName) => {
  // Default/static priorities that always exist
  const defaultPriorities = [
    'urgent', 'today', 'lessThan3Days', 'thisWeek', 'thisMonth', 
    'regular', 'filed', 'dailyWorksOffice', 'monthlyWorks'
  ];
  
  // Check if it's a default priority
  if (defaultPriorities.includes(priorityName)) {
    return true;
  }
  
  // Check if it's a custom priority in database
  const priority = await Priority.findOne({ name: priorityName, isDefault: false });
  return !!priority;
};

// Ensure uploads/audio directory exists
const uploadsDir = path.join(__dirname, '../uploads');
const audioDir = path.join(uploadsDir, 'audio');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true });
}

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, audioDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const uploadAudio = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const unlinkAsync = promisify(fs.unlink);

// Middleware to check if user can assign task to target user
const canAssignTask = async (req, res, next) => {
  try {
    const { assignedTo } = req.body;
    // Check if assignedTo is an array and not empty
    if (!Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res.status(400).json({ message: 'assignedTo must be a non-empty array of user IDs' });
    }
    // Check each assignee exists
    for (const assigneeId of assignedTo) {
      const assignee = await User.findById(assigneeId);
      if (!assignee) {
        return res.status(404).json({ message: `Assignee with ID ${assigneeId} not found` });
      }
    }
    next();
  } catch (error) {
    console.error('Error in canAssignTask middleware:', error);
    res.status(500).json({ message: 'Error checking task assignment permissions' });
  }
};

// Get task counts for assigned tasks
router.get('/assigned/counts', protect, async (req, res) => {
  try {
    // Execution: status not completed and no first verifier
    const executionCount = await Task.countDocuments({
      assignedBy: req.user._id,
      status: { $ne: 'completed' },
      verificationAssignedTo: { $exists: false }
    });

    // Verification: status not completed and has first or second verifier
    const verificationCount = await Task.countDocuments({
      assignedBy: req.user._id,
      status: { $ne: 'completed' },
      $or: [
        { verificationAssignedTo: { $exists: true, $ne: null } },
        { secondVerificationAssignedTo: { $exists: true, $ne: null } },
        { thirdVerificationAssignedTo: { $exists: true, $ne: null } },
        { fourthVerificationAssignedTo: { $exists: true, $ne: null } },
        { fifthVerificationAssignedTo: { $exists: true, $ne: null } }
      ]
    });

    // Completed: status completed
    const completedCount = await Task.countDocuments({
      assignedBy: req.user._id,
      status: 'completed'
    });

    res.json({
      execution: executionCount,
      verification: verificationCount,
      completed: completedCount
    });
  } catch (error) {
    console.error('Error fetching assigned task counts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get task counts for received tasks
router.get('/received/counts', protect, async (req, res) => {
  try {
    // Execution: Rule 1 (old): not completed, no verifiers, assigned to current user
    // Rule 2 (new): not completed, verification is accepted, assigned to current user (even if has verifiers)
    // These rules work as "OR" to each other
    const executionCount = await Task.countDocuments({
      status: { $ne: 'completed' },
      assignedTo: req.user._id,
      $or: [
        // Rule 1: no verifiers
        {
          verificationAssignedTo: { $exists: false },
          secondVerificationAssignedTo: { $exists: false },
          thirdVerificationAssignedTo: { $exists: false },
          fourthVerificationAssignedTo: { $exists: false },
          fifthVerificationAssignedTo: { $exists: false }
        },
        // Rule 2: verification is accepted (even if has verifiers)
        {
          verification: 'accepted'
        }
      ]
    });
    // Received for verification: not completed, user is the latest assigned verifier
    // AND verification is not accepted
    const verifierFields = [
      'verificationAssignedTo',
      'secondVerificationAssignedTo',
      'thirdVerificationAssignedTo',
      'fourthVerificationAssignedTo',
      'fifthVerificationAssignedTo',
    ];
    const orConditions = verifierFields.map((field, idx) => {
      const laterFields = verifierFields.slice(idx + 1);
      const laterNulls = Object.fromEntries(laterFields.map(f => [f, { $in: [null, undefined] }]));
      return {
        [field]: req.user._id,
        ...laterNulls
      };
    });
    const receivedVerificationCount = await Task.countDocuments({
      status: { $ne: 'completed' },
      verification: { $ne: 'accepted' }, // Don't count tasks with verification accepted
      $or: orConditions
    });
    // Issued for verification: not completed, first verifier is set, assigned to current user
    // AND verification is not accepted
    const issuedVerificationCount = await Task.countDocuments({
      status: { $ne: 'completed' },
      assignedTo: req.user._id,
      verificationAssignedTo: { $exists: true, $ne: null },
      verification: { $ne: 'accepted' } // Don't count tasks with verification accepted
    });
    // Completed: status is completed and assignedTo is current user
    const completedCount = await Task.countDocuments({
      status: 'completed',
      assignedTo: req.user._id
    });
    // Guidance: tasks where current user is a guide and status is not completed
    const guidanceCount = await Task.countDocuments({
      guides: req.user._id,
      status: { $ne: 'completed' }
    });
    res.json({
      execution: executionCount,
      receivedVerification: receivedVerificationCount,
      issuedVerification: issuedVerificationCount,
      completed: completedCount,
      guidance: guidanceCount
    });
  } catch (error) {
    console.error('Error fetching received task counts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all tasks for the user (dashboard)
router.get('/', protect, async (req, res) => {
  try {
    // Always exclude tasks with verificationStatus 'pending'
    const tasks = await Task.find({
      $and: [
        {
          $or: [
            { assignedTo: req.user._id },
            { assignedBy: req.user._id }
          ]
        },
        { verificationStatus: { $ne: 'pending' } },
        { status: { $ne: 'completed' } }
      ]
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .populate('guides', 'firstName lastName photo')
      .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy createdAt updatedAt files comments billed selfVerification customFields')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all tasks (admin, head, team head)
router.get('/all', protect, async (req, res) => {
  try {
    let tasks;
    if (['Admin', 'Senior', 'Team Head'].includes(req.user.role)) {
      // All privileged roles: show tasks that are not pending verification
      // and exclude tasks that are fully completed to avoid sending completed
      // tasks to the frontend (reduces payload / improves dashboard load).
      tasks = await Task.find({ verificationStatus: { $ne: 'pending' }, status: { $ne: 'completed' } })
        .populate('assignedTo', 'firstName lastName photo group')
        .populate('assignedBy', 'firstName lastName photo group')
        .populate('verificationAssignedTo', 'firstName lastName photo')
        .populate('secondVerificationAssignedTo', 'firstName lastName photo')
        .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
        .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
        .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
        .populate('files.uploadedBy', 'firstName lastName photo')
        .populate('comments.createdBy', 'firstName lastName photo')
        .populate('guides', 'firstName lastName photo')
        .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides customFields')
        .sort({ createdAt: -1 });
    } else {
      return res.status(403).json({ message: 'You are not authorized to access all tasks' });
    }
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching all tasks:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tasks for verification (tasks assigned to user for verification)
router.get('/for-verification', protect, async (req, res) => {
  try {
    let isTaskVerifier = false;
    if (Array.isArray(req.user.role2)) {
      isTaskVerifier = req.user.role2.includes('Task Verifier');
    } else {
      isTaskVerifier = req.user.role2 === 'Task Verifier';
    }
    let tasks;
    if (req.user.role === 'Admin' || isTaskVerifier) {
      // Admins and Task Verifiers see all pending tasks
      tasks = await Task.find({
        verificationStatus: 'pending'
      })
        .populate('assignedTo', 'firstName lastName photo')
        .populate('assignedBy', 'firstName lastName photo')
        .populate('verificationAssignedTo', 'firstName lastName photo')
        .populate('secondVerificationAssignedTo', 'firstName lastName photo')
        .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
        .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
        .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
        .populate('originalAssignee', 'firstName lastName photo')
        .populate('comments.createdBy', 'firstName lastName photo')
        .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification customFields')
        .sort({ createdAt: -1 });
      res.json(tasks);
      return;
    }
    // Default: only show tasks assigned to this user for verification
    tasks = await Task.find({
      $or: [
        { verificationAssignedTo: req.user._id },
        { secondVerificationAssignedTo: req.user._id },
        { thirdVerificationAssignedTo: req.user._id },
        { fourthVerificationAssignedTo: req.user._id },
        { fifthVerificationAssignedTo: req.user._id }
      ],
      verificationStatus: { $nin: ['completed', 'rejected'] }
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('originalAssignee', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification customFields')
      .sort({ createdAt: -1 });
    // Filter: if user is first verifier, exclude tasks with status 'first_verified'
    const filteredTasks = tasks.filter(task => {
      if (task.verificationAssignedTo && task.verificationAssignedTo._id.toString() === req.user._id.toString()) {
        return task.verificationStatus !== 'first_verified';
      }
      return true;
    });
    res.json(filteredTasks);
  } catch (error) {
    console.error('Error fetching tasks for verification:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tasks under verification (tasks sent by user for verification)
router.get('/under-verification', protect, async (req, res) => {
  try {
    const tasks = await Task.find({
      originalAssignee: req.user._id,
      status: 'under_verification'
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('originalAssignee', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments taskType createdAt updatedAt files comments billed selfVerification customFields')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks under verification:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tasks by type (execution or verification)
router.get('/type/:type', protect, async (req, res) => {
  try {
    const { type } = req.params;
    if (!['execution', 'verification'].includes(type)) {
      return res.status(400).json({ message: 'Invalid task type' });
    }

    const tasks = await Task.find({ 
      taskType: type,
      $or: [
        { assignedTo: req.user._id },
        { verificationAssignedTo: req.user._id },
        { secondVerificationAssignedTo: req.user._id },
        { thirdVerificationAssignedTo: req.user._id },
        { fourthVerificationAssignedTo: req.user._id },
        { fifthVerificationAssignedTo: req.user._id }
      ]
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments taskType createdAt updatedAt files comments billed selfVerification customFields')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks by type:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get assigned tasks (tasks created by the user)
router.get('/assigned', protect, async (req, res) => {
  try {
    const { tab = 'execution' } = req.query;
    let query = { assignedBy: req.user._id };
    switch (tab) {
      case 'execution':
        query.status = { $ne: 'completed' };
        query.verificationAssignedTo = { $exists: false };
        break;
      case 'verification':
        query.status = { $ne: 'completed' };
        query.$or = [
          { verificationAssignedTo: { $exists: true, $ne: null } },
          { secondVerificationAssignedTo: { $exists: true, $ne: null } },
          { thirdVerificationAssignedTo: { $exists: true, $ne: null } },
          { fourthVerificationAssignedTo: { $exists: true, $ne: null } },
          { fifthVerificationAssignedTo: { $exists: true, $ne: null } }
        ];
        break;
      case 'completed':
        query.status = 'completed';
        break;
      default:
        query.status = { $ne: 'completed' };
        query.verificationAssignedTo = { $exists: false };
    }
    const tasks = await Task.find(query)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .populate('guides', 'firstName lastName photo')
      .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides customFields')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching assigned tasks:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get received tasks (tasks assigned to the user)
router.get('/received', protect, async (req, res) => {
  try {
    const { tab = 'execution' } = req.query;
    let query = {};
    switch (tab) {
      case 'execution':
        // Tasks for execution: 
        // Rule 1 (old): not completed, no verifiers, assigned to current user
        // Rule 2 (new): not completed, verification is accepted, assigned to current user (even if has verifiers)
        // These rules work as "OR" to each other
        query = {
          status: { $ne: 'completed' },
          assignedTo: req.user._id,
          $or: [
            // Rule 1: no verifiers
            {
              verificationAssignedTo: { $exists: false },
              secondVerificationAssignedTo: { $exists: false },
              thirdVerificationAssignedTo: { $exists: false },
              fourthVerificationAssignedTo: { $exists: false },
              fifthVerificationAssignedTo: { $exists: false }
            },
            // Rule 2: verification is accepted (even if has verifiers)
            {
              verification: 'accepted'
            }
          ]
        };
        break;
      case 'receivedVerification': {
        // Tasks where status is not completed, user is the latest assigned verifier
        // AND verification is not accepted
        const verifierFields = [
          'verificationAssignedTo',
          'secondVerificationAssignedTo',
          'thirdVerificationAssignedTo',
          'fourthVerificationAssignedTo',
          'fifthVerificationAssignedTo',
        ];
        const orConditions = verifierFields.map((field, idx) => {
          // All later fields must be null or not exist
          const laterFields = verifierFields.slice(idx + 1);
          const laterNulls = Object.fromEntries(laterFields.map(f => [f, { $in: [null, undefined] }]));
          return {
            [field]: req.user._id,
            ...laterNulls
          };
        });
        query = {
          status: { $ne: 'completed' },
          verification: { $ne: 'accepted' }, // Don't show tasks with verification accepted
          $or: orConditions
        };
        break;
      }
      case 'issuedVerification':
        // Tasks issued for verification: not completed, first verifier is set, assigned to current user
        // AND verification is not accepted
        query = {
          status: { $ne: 'completed' },
          assignedTo: req.user._id,
          verificationAssignedTo: { $exists: true, $ne: null },
          verification: { $ne: 'accepted' } // Don't show tasks with verification accepted
        };
        break;
      case 'completed':
        // Completed tasks: status is completed
        query = {
          status: 'completed',
          $or: [
            { assignedTo: req.user._id },
            { verificationAssignedTo: req.user._id },
            { secondVerificationAssignedTo: req.user._id },
            { thirdVerificationAssignedTo: req.user._id },
            { fourthVerificationAssignedTo: req.user._id },
            { fifthVerificationAssignedTo: req.user._id }
          ]
        };
        break;
      default:
        // Default to execution tab
        // Rule 1 (old): not completed, no verifiers, assigned to current user
        // Rule 2 (new): not completed, verification is accepted, assigned to current user (even if has verifiers)
        // These rules work as "OR" to each other
        query = {
          status: { $ne: 'completed' },
          assignedTo: req.user._id,
          $or: [
            // Rule 1: no verifiers
            {
              verificationAssignedTo: { $exists: false },
              secondVerificationAssignedTo: { $exists: false },
              thirdVerificationAssignedTo: { $exists: false },
              fourthVerificationAssignedTo: { $exists: false },
              fifthVerificationAssignedTo: { $exists: false }
            },
            // Rule 2: verification is accepted (even if has verifiers)
            {
              verification: 'accepted'
            }
          ]
        };
    }
    const tasks = await Task.find(query)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('guides', 'firstName lastName photo')
      .select('title description clientName clientGroup workType status priority verification inwardEntryDate dueDate assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides customFields')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching received tasks:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get tasks for guidance (where current user is a guide)
router.get('/received/guidance', protect, async (req, res) => {
  try {
    const tasks = await Task.find({
      guides: req.user._id
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('guides', 'firstName lastName photo')
      .select('title description clientName clientGroup workType status priority verification inwardEntryDate dueDate assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides customFields')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching guidance tasks:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get a single task by ID
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }
    const task = await Task.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('guides', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .select('title description clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo priority status verification inwardEntryDate dueDate targetDate billed selfVerification guides files comments verificationStatus verificationComments createdAt updatedAt customFields');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: error.message });
  }
});

// Create a new task
router.post('/', protect, canAssignTask, async (req, res) => {
  // Log incoming request for debugging
  console.log('Incoming task create request body:', req.body);
  try {
    const {
      title,
      description,
      clientName,
      clientGroup,
      workType,
      assignedTo,
      priority,
      inwardEntryDate,
      inwardEntryTime,
      dueDate,
      targetDate,
      verificationAssignedTo,
      billed,
      status, // Add status to destructuring
      customFields // Add custom fields to destructuring
    } = req.body;

    // Validate priority
    if (priority && !(await isValidPriority(priority))) {
      return res.status(400).json({ message: 'Invalid priority value' });
    }

    // Debug: Log incoming customFields for PATCH /:taskId/custom-fields
    if (req.method === 'PATCH' && req.originalUrl.includes('/custom-fields')) {
      console.log('PATCH /:taskId/custom-fields received customFields:', customFields);
    }

    // Only process customFields if provided (for PATCH endpoint)
    let processedCustomFields = undefined;
    if (customFields) {
      // Get all active custom columns to validate and set defaults
      const activeColumns = await CustomColumn.find({ isActive: true });
      processedCustomFields = {};
      for (const column of activeColumns) {
        if (customFields.hasOwnProperty(column.name)) {
          // Use provided value
          processedCustomFields[column.name] = customFields[column.name];
        } else {
          // Use default value
          processedCustomFields[column.name] = column.defaultValue;
        }

      }
    }

    const createdTasks = [];

    // Fetch assigner details for notification message
    const assigner = await User.findById(req.user._id).select('firstName lastName');

    // Combine date and time for inwardEntryDate
    let combinedInwardEntryDate = null;
    // Accept ISO string directly if valid
    if (inwardEntryDate && typeof inwardEntryDate === 'string' && inwardEntryDate.includes('T')) {
      const dt = new Date(inwardEntryDate);
      if (!isNaN(dt.getTime())) {
        combinedInwardEntryDate = dt;
      }
    }
    // If not ISO, try to combine date and time as before
    if (!combinedInwardEntryDate && inwardEntryDate && inwardEntryTime) {
      const [year, month, day] = inwardEntryDate.split('-');
      const [hours, minutes] = inwardEntryTime.split(':');
      combinedInwardEntryDate = new Date(year, month - 1, day, hours, minutes);
    } else if (!combinedInwardEntryDate && inwardEntryDate) {
      combinedInwardEntryDate = new Date(inwardEntryDate);
    }
    // Extra validation: reject if date is invalid
    if (!combinedInwardEntryDate || isNaN(combinedInwardEntryDate.getTime()) || combinedInwardEntryDate.toString() === 'Invalid Date') {
      console.error('Invalid inwardEntryDate received:', inwardEntryDate, 'combined:', combinedInwardEntryDate);
      return res.status(400).json({ message: 'Invalid inwardEntryDate. Please provide a valid date and time.' });
    }

    for (const userId of assignedTo) {
      // Always set verification status to 'pending' to ensure all tasks go through approval
      const verificationStatus = 'pending';
      const task = new Task({
        title,
        description,
        clientName,
        clientGroup,
        workType,
        assignedTo: userId,
        assignedBy: req.user._id,
        priority,
        status: status || 'yet_to_start', // Use provided status or default
        inwardEntryDate: combinedInwardEntryDate,
        dueDate,
        targetDate,
        verificationAssignedTo,
        billed: billed !== undefined ? billed : true,
        selfVerification: req.body.selfVerification ?? false,
        verificationStatus,
        customFields: processedCustomFields // Add custom fields
      });
      const savedTask = await task.save();
      createdTasks.push(savedTask);

      // Create notification for the assigned user with new format
      const truncatedTaskName = truncateTaskName(title);
      const notificationMessage = `${assigner.firstName} ${assigner.lastName} assigned you "${truncatedTaskName}" of ${clientName}.`;
      const notification = new Notification({
        recipient: userId,
        task: savedTask._id,
        assigner: req.user._id,
        message: notificationMessage
      });
      await notification.save();

      // Log task creation activity
      await ActivityLogger.logTaskActivity(
        req.user._id,
        'task_created',
        savedTask._id,
        `Created task "${title}" for ${clientName} and assigned to ${Array.isArray(assignedTo) ? assignedTo.length : 1} user(s)`,
        null,
        {
          title,
          clientName,
          workType,
          assignedTo: userId,
          priority,
          billed
        },
        req,
        {
          assignedUsers: assignedTo,
          clientGroup,
          dueDate,
          targetDate
        }
      );
    }
    
    res.status(201).json(createdTasks);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update task
router.put('/:id', protect, async (req, res) => {
    // Handle inwardEntryDate update logic (accept ISO string or date+time)
    let { inwardEntryDate, inwardEntryTime } = req.body;
    if (inwardEntryDate) {
      let combinedInwardEntryDate = null;
      if (typeof inwardEntryDate === 'string' && inwardEntryDate.includes('T')) {
        const dt = new Date(inwardEntryDate);
        if (!isNaN(dt.getTime())) {
          combinedInwardEntryDate = dt;
        }
      }
      if (!combinedInwardEntryDate && inwardEntryDate && inwardEntryTime) {
        const [year, month, day] = inwardEntryDate.split('-');
        const [hours, minutes] = inwardEntryTime.split(':');
        combinedInwardEntryDate = new Date(year, month - 1, day, hours, minutes);
      } else if (!combinedInwardEntryDate && inwardEntryDate) {
        combinedInwardEntryDate = new Date(inwardEntryDate);
      }
      if (!combinedInwardEntryDate || isNaN(combinedInwardEntryDate.getTime()) || combinedInwardEntryDate.toString() === 'Invalid Date') {
        return res.status(400).json({ message: 'Invalid inwardEntryDate. Please provide a valid date and time.' });
      }
      req.body.inwardEntryDate = combinedInwardEntryDate;
    }
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Store old values for activity logging
    const oldValues = {
      title: task.title,
      description: task.description,
      clientName: task.clientName,
      workType: task.workType,
      priority: task.priority,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate,
      targetDate: task.targetDate,
      billed: task.billed
    };

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('assignedTo', 'firstName lastName photo')
     .populate('assignedBy', 'firstName lastName photo')
     .populate('verificationAssignedTo', 'firstName lastName photo')
     .populate('secondVerificationAssignedTo', 'firstName lastName photo')
     .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
     .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
     .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
     .populate('guides', 'firstName lastName photo')
     .populate('files.uploadedBy', 'firstName lastName photo')
     .populate('comments.createdBy', 'firstName lastName photo');

    // Log task update activity
    await ActivityLogger.logTaskActivity(
      req.user._id,
      'task_updated',
      updatedTask._id,
      `Updated task "${updatedTask.title}"`,
      oldValues,
      {
        title: updatedTask.title,
        description: updatedTask.description,
        clientName: updatedTask.clientName,
        workType: updatedTask.workType,
        priority: updatedTask.priority,
        assignedTo: updatedTask.assignedTo,
        dueDate: updatedTask.dueDate,
        targetDate: updatedTask.targetDate,
        billed: updatedTask.billed
      },
      req
    );

    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update the task status route to be completely independent
router.patch('/:taskId/status', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const { status } = req.body;
    // Handle reject as a special case
    if (status === 'reject') {
      task.verificationAssignedTo = undefined;
      task.secondVerificationAssignedTo = undefined;
      task.thirdVerificationAssignedTo = undefined;
      task.fourthVerificationAssignedTo = undefined;
      task.fifthVerificationAssignedTo = undefined;
      task.status = 'yet_to_start';
      await task.save();
      const updatedTask = await Task.findById(task._id)
        .populate('assignedTo', 'firstName lastName photo')
        .populate('assignedBy', 'firstName lastName photo')
        .populate('verificationAssignedTo', 'firstName lastName photo')
        .populate('secondVerificationAssignedTo', 'firstName lastName photo')
        .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
        .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
        .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
        .populate('files.uploadedBy', 'firstName lastName photo');
      return res.json(updatedTask);
    }

    // Enforce selfVerification check before allowing completion
    if (status === 'completed' && !task.selfVerification) {
      return res.status(400).json({ message: 'Self verification must be completed before marking this task as completed.' });
    }

    // If changing from completed to any other status, reset selfVerification to false
    if (task.status === 'completed' && status !== 'completed') {
      console.log(`Resetting selfVerification to false for task ${task._id} when changing from completed to ${status}`);
      task.selfVerification = false;
    }

    // Update status
    task.status = status;
    await task.save();

    // Fetch the updated task with all populated fields
    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo');

    if (!updatedTask) {
      throw new Error('Failed to fetch updated task');
    }

    // Log task status change activity
    let logMessage = `Changed status of task "${updatedTask.title}" to ${status}`;
    let oldData = { status: task.status };
    let newData = { status };
    
    // If selfVerification was reset, include that in the log
    if (task.status === 'completed' && status !== 'completed') {
      logMessage += ' and reset self verification';
      oldData.selfVerification = true;
      newData.selfVerification = false;
    }
    
    await ActivityLogger.logTaskActivity(
      req.user._id,
      'task_status_changed',
      updatedTask._id,
      logMessage,
      oldData,
      newData,
      req,
      {
        taskTitle: updatedTask.title,
        clientName: updatedTask.clientName,
        assignedTo: updatedTask.assignedTo?._id
      }
    );

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ 
      message: 'Error updating task status',
      error: error.message 
    });
  }
});



// Controller for updating task description
async function updateTaskDescription(req, res) {
  try {
    const { description } = req.body;
    if (typeof description !== 'string') {
      return res.status(400).json({ message: 'Description is required.' });
    }
    const task = await Task.findByIdAndUpdate(
      req.params.taskId,
      { description },
      { new: true }
    )
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo');
    if (!task) {
      return res.status(404).json({ message: 'Task not found.' });
    }
    res.json(task);
  } catch (error) {
    console.error('Error updating description:', error);
    res.status(500).json({ message: 'Failed to update description.' });
  }
}

// PATCH /:taskId/description
router.patch('/:taskId/description', protect, updateTaskDescription);

// PATCH /:taskId/priority
router.patch('/:taskId/priority', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Allow assignee or any verifier to update the task priority
    const isAssignee = task.assignedTo._id.toString() === req.user._id.toString();
    const isFirstVerifier = task.verificationAssignedTo && task.verificationAssignedTo._id && task.verificationAssignedTo._id.toString() === req.user._id.toString();
    const isSecondVerifier = task.secondVerificationAssignedTo && task.secondVerificationAssignedTo._id && task.secondVerificationAssignedTo._id.toString() === req.user._id.toString();
    const isThirdVerifier = task.thirdVerificationAssignedTo && task.thirdVerificationAssignedTo._id && task.thirdVerificationAssignedTo._id.toString() === req.user._id.toString();
    const isFourthVerifier = task.fourthVerificationAssignedTo && task.fourthVerificationAssignedTo._id && task.fourthVerificationAssignedTo._id.toString() === req.user._id.toString();
    const isFifthVerifier = task.fifthVerificationAssignedTo && task.fifthVerificationAssignedTo._id && task.fifthVerificationAssignedTo._id.toString() === req.user._id.toString();

    if (!isAssignee && !isFirstVerifier && !isSecondVerifier && !isThirdVerifier && !isFourthVerifier && !isFifthVerifier) {
      return res.status(403).json({ message: 'Not authorized to update task priority' });
    }

    const { priority } = req.body;

    // Validate priority dynamically (includes both default and custom priorities)
    if (!(await isValidPriority(priority))) {
      return res.status(400).json({ message: 'Invalid priority value' });
    }

    // Update priority
    const oldPriority = task.priority;
    task.priority = priority;
    await task.save();

    // Fetch the updated task with all populated fields
    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo');

    if (!updatedTask) {
      throw new Error('Failed to fetch updated task');
    }

    // Log priority change activity
    await ActivityLogger.logTaskActivity(
      req.user._id,
      'task_priority_changed',
      updatedTask._id,
      `Changed priority of task "${updatedTask.title}" from ${oldPriority} to ${priority}`,
      { priority: oldPriority },
      { priority },
      req,
      {
        taskTitle: updatedTask.title,
        clientName: updatedTask.clientName
      }
    );

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task priority:', error);
    res.status(500).json({ 
      message: 'Error updating task priority',
      error: error.message 
    });
  }
});

// PATCH /:taskId/verification
router.patch('/:taskId/verification', protect, async (req, res) => {
  try {
    console.log('Updating verification for task:', req.params.taskId, 'new verification:', req.body.verification);
    
    const task = await Task.findById(req.params.taskId)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo');

    if (!task) {
      console.log('Task not found:', req.params.taskId);
      return res.status(404).json({ message: 'Task not found' });
    }

    const { verification, remarks } = req.body;

    // Validate verification value
    const validVerifications = ['pending', 'rejected', 'accepted', 'next verification'];
    if (!validVerifications.includes(verification)) {
      console.log('Invalid verification value:', verification);
      return res.status(400).json({ message: 'Invalid verification value' });
    }

    console.log('Current verification:', task.verification, 'New verification:', verification);
    
    // Handle different verification statuses
    if (verification === 'rejected') {
      // Clear all verifiers and set verification to pending (not rejected)
      task.verificationAssignedTo = undefined;
      task.secondVerificationAssignedTo = undefined;
      task.thirdVerificationAssignedTo = undefined;
      task.fourthVerificationAssignedTo = undefined;
      task.fifthVerificationAssignedTo = undefined;
      task.verification = 'pending'; // Set to pending instead of rejected
      // Don't change task status when rejecting verification
      // Set selfVerification to false when rejecting
      task.selfVerification = false;
      // Save remarks (optional)
      task.verificationRemarks = remarks ? remarks.trim() : '';

      // Create notification for the assigned user
      if (task.assignedTo) {
        const truncatedTaskName = truncateTaskName(task.title);
        const rejectionMessage = remarks ? 
          `${req.user.firstName} ${req.user.lastName} Has Returned "${truncatedTaskName}" with remarks "${remarks.trim()}"` :
          `${req.user.firstName} ${req.user.lastName} Has Returned "${truncatedTaskName}"`;

        const notification = new Notification({
          recipient: task.assignedTo._id,
          task: task._id,
          assigner: req.user._id,
          message: rejectionMessage,
          type: 'verification_rejected'
        });
        await notification.save();
      }

    } else if (verification === 'accepted') {
      // When accepting, keep verifiers intact and just update verification status
      task.verification = 'accepted';
      // Keep status as is - task goes back to executor for execution
      // Don't clear verifiers - they stay intact
      // Save remarks (optional)
      task.verificationRemarks = remarks ? remarks.trim() : '';

      // Create notification for the assigned user
      if (task.assignedTo) {
        const truncatedTaskName = truncateTaskName(task.title);
        const acceptanceMessage = remarks ? 
          `${req.user.firstName} ${req.user.lastName} has accepted "${truncatedTaskName}" with remarks "${remarks.trim()}"` :
          `${req.user.firstName} ${req.user.lastName} has accepted "${truncatedTaskName}"`;
        
        const notification = new Notification({
          recipient: task.assignedTo._id,
          task: task._id,
          assigner: req.user._id,
          message: acceptanceMessage,
          type: 'verification_accepted'
        });
        await notification.save();
      }
    } else {
      // For 'pending' and 'next verification', just update the verification field
      task.verification = verification;
    }
    
    await task.save();

    console.log('Verification updated successfully');

    // Log verification activity
    if (verification === 'rejected') {
      await ActivityLogger.logTaskActivity(
        req.user._id,
        'task_verification_rejected',
        task._id,
        `Returned verification for task "${task.title}"${remarks ? ` with remarks: "${remarks}"` : ''}`,
        { verification: task.verification, verificationRemarks: task.verificationRemarks },
        { verification: 'rejected', verificationRemarks: remarks },
        req
      );
    } else if (verification === 'accepted') {
      await ActivityLogger.logTaskActivity(
        req.user._id,
        'task_verification_accepted',
        task._id,
        `Accepted verification for task "${task.title}"${remarks ? ` with remarks: "${remarks}"` : ''}`,
        { verification: task.verification, verificationRemarks: task.verificationRemarks },
        { verification: 'accepted', verificationRemarks: remarks },
        req
      );
    }

    // Fetch the updated task with all populated fields
    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo');

    if (!updatedTask) {
      throw new Error('Failed to fetch updated task');
    }

    console.log('Updated task verification:', updatedTask.verification);
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task verification:', error);
    res.status(500).json({ 
      message: 'Error updating task verification',
      error: error.message 
    });
  }
});

// Delete task
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Log the delete action before actually deleting
    await ActivityLogger.logTaskActivity(
      req.user._id,
      'task_deleted',
      task._id,
      `Deleted task "${task.title}"`,
      task.toObject(),
      null,
      req
    );

    await Task.findByIdAndDelete(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: error.message });
  }
});

// Upload files to a task
router.post('/:taskId/files', protect, uploadTaskFilesMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Add uploaded files to task
    const uploadedFiles = [];
    
    for (const file of req.files) {
      try {
        // Upload to pCloud
        const cloudResult = await uploadFile(file.path, 'files');
        // Delete local file after cloud upload
        try {
          await unlinkAsync(file.path);
        } catch (unlinkError) {
          // Ignore errors if file doesn't exist
          if (unlinkError.code !== 'ENOENT') {
            console.error('Error deleting local file:', unlinkError);
          }
        }
        uploadedFiles.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.filename,
          cloudUrl: cloudResult.url,
          uploadedBy: req.user._id
        });
      } catch (cloudError) {
        console.error('Error uploading to pCloud:', cloudError);
        // Do not push to uploadedFiles if upload fails
      }
    }

    task.files.push(...uploadedFiles);
    await task.save();

    // Populate the uploadedBy field
    await task.populate('files.uploadedBy', 'firstName lastName photo');

    // Log file upload activity for each uploaded file
    for (const file of uploadedFiles) {
      await ActivityLogger.logFileActivity(
        req.user._id,
        'task_file_uploaded',
        task._id,
        `Uploaded file "${file.originalName}" to task "${task.title}"`,
        {
          fileName: file.originalName,
          fileSize: req.files.find(f => f.originalname === file.originalName)?.size || 0,
          fileType: req.files.find(f => f.originalname === file.originalName)?.mimetype || 'unknown'
        },
        req
      );
    }

    res.json(task.files);
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a file from a task
router.delete('/:taskId/files/:fileId', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Find the file
    const fileIndex = task.files.findIndex(f => f._id.toString() === req.params.fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Remove file from array
    const removedFile = task.files.splice(fileIndex, 1)[0];

    // Delete file from filesystem
    const filePath = path.join(__dirname, '../uploads', removedFile.filename);
    try {
      await unlinkAsync(filePath);
    } catch (unlinkError) {
      // Ignore errors if file doesn't exist
      if (unlinkError.code !== 'ENOENT') {
        console.error('Error deleting file:', unlinkError);
      }
    }

    await task.save();
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all files for a task
router.get('/:taskId/files', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('files.uploadedBy', 'firstName lastName photo');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task.files);   
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: error.message });
  }
});

// Complete task (by assignee)
router.post('/:taskId/complete', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { response } = req.body;

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is the assignee
    if (task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to complete this task' });
    }

    // Enforce selfVerification check before allowing completion
    if (!task.selfVerification) {
      return res.status(400).json({ message: 'Self verification must be completed before marking this task as completed.' });
    }

    // Update task
    task.status = 'completed';
    await task.save();

    const updatedTask = await Task.findById(taskId)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .populate('originalAssignee', 'firstName lastName photo');

    res.json(updatedTask);
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ message: error.message });
  }
});

// Verify task (by verifier)
router.post('/:taskId/verify', protect, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { action, comments } = req.body; // action can be 'approve' or 'reject'

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Allow Admins and Task Verifiers to approve/reject any pending task
    const isAdminOrTaskVerifier = req.user.role === 'Admin' || (req.user.role2 && req.user.role2.includes('Task Verifier'));
    const isFirstVerifier = task.verificationAssignedTo?.toString() === req.user._id.toString();
    const isSecondVerifier = task.secondVerificationAssignedTo?.toString() === req.user._id.toString();
    const isThirdVerifier = task.thirdVerificationAssignedTo?.toString() === req.user._id.toString();
    const isFourthVerifier = task.fourthVerificationAssignedTo?.toString() === req.user._id.toString();
    const isFifthVerifier = task.fifthVerificationAssignedTo?.toString() === req.user._id.toString();

    if (!isFirstVerifier && !isSecondVerifier && !isThirdVerifier && !isFourthVerifier && !isFifthVerifier && !isAdminOrTaskVerifier) {
      return res.status(403).json({ message: 'Not authorized to verify this task' });
    }

    if (action === 'approve') {
      task.verificationStatus = 'completed';
      task.verificationComments = comments;
      await task.save();

      // Log task verification activity
      await ActivityLogger.logTaskActivity(
        req.user._id,
        'task_verified',
        task._id,
        `Verified and approved task "${task.title}"`,
        { verificationStatus: 'pending' },
        { verificationStatus: 'completed', verificationComments: comments },
        req,
        {
          taskTitle: task.title,
          clientName: task.clientName,
          assignedTo: task.assignedTo
        }
      );

      return res.json(task);
    } else if (action === 'reject') {
      // Log task rejection before deletion
      await ActivityLogger.logTaskActivity(
        req.user._id,
        'task_rejected',
        task._id,
        `Returned and deleted task "${task.title}"`,
        { verificationStatus: 'pending' },
        { verificationStatus: 'rejected', verificationComments: comments },
        req,
        {
          taskTitle: task.title,
          clientName: task.clientName,
          assignedTo: task.assignedTo,
          reason: comments
        }
      );

      await Task.deleteOne({ _id: taskId });
      return res.json({ message: 'Task rejected and deleted.' });
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error verifying task:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add a text comment to a task (admin only)
router.post('/:taskId/comments', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const { content } = req.body;
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    task.comments.push({
      type: 'text',
      content,
      createdBy: req.user._id
    });

    await task.save();

    // Create notifications for assignedTo and assignedBy
    const commenterId = req.user._id.toString();
    const assignedToId = task.assignedTo.toString();
    const assignedById = task.assignedBy.toString();

    // Fetch commenter details for notification message
    const commenter = await User.findById(req.user._id).select('firstName lastName');
    const truncatedTaskName = truncateTaskName(task.title);
    const message = `${commenter.firstName} ${commenter.lastName} has commented on "${truncatedTaskName}" of ${task.clientName} as ${content}`;
    const recipients = new Set();

    if (assignedToId !== commenterId) {
      recipients.add(assignedToId);
    }
    if (assignedById !== commenterId) {
      recipients.add(assignedById);
    }

    if (recipients.size > 0) {
      const notificationPromises = Array.from(recipients).map(recipientId => {
        return Notification.create({
          recipient: recipientId,
          task: task._id,
          assigner: req.user._id,
          message: message
        });
      });
      await Promise.all(notificationPromises);
    }

    // Populate the createdBy field
    await task.populate('comments.createdBy', 'firstName lastName photo');

    res.json(task.comments);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add an audio comment to a task (admin only)
router.post('/:taskId/comments/audio', protect, uploadAudio.single('audio'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Audio file is required' });
    }

    // Debug logging
    try {
      const stats = fs.statSync(req.file.path);
      console.log('Audio file path:', req.file.path);
      console.log('Audio file size:', stats.size);
      console.log('Audio file mimetype:', req.file.mimetype);
    } catch (err) {
      console.error('Error getting audio file stats:', err);
    }

    let audioUrl;
    try {
      // Upload to pCloud
      const cloudResult = await uploadFile(req.file.path, 'files');
      console.log('pCloud upload result:', cloudResult);
      audioUrl = cloudResult.url;
      // Delete local file after cloud upload
      try {
        await unlinkAsync(req.file.path);
      } catch (unlinkError) {
        if (unlinkError.code !== 'ENOENT') {
          console.error('Error deleting local audio file:', unlinkError);
        }
      }
    } catch (cloudError) {
      console.error('Error uploading audio to pCloud:', cloudError);
      // Clean up temp file if upload fails
      try {
        if (req.file && req.file.path) await unlinkAsync(req.file.path);
      } catch (e) {}
      return res.status(500).json({ message: 'Error uploading audio to pCloud' });
    }

    // Store just the filename or cloud URL
    task.comments.push({
      type: 'audio',
      content: 'Audio comment',
      audioUrl: audioUrl, // Store cloud URL or local filename
      createdBy: req.user._id
    });

    await task.save();

    // Create notifications for assignedTo and assignedBy
    const commenterId = req.user._id.toString();
    const assignedToId = task.assignedTo.toString();
    const assignedById = task.assignedBy.toString();

    // Fetch commenter details for notification message
    const commenter = await User.findById(req.user._id).select('firstName lastName');
    const truncatedTaskName = truncateTaskName(task.title);
    const message = `${commenter.firstName} ${commenter.lastName} has commented on "${truncatedTaskName}" of ${task.clientName} as Audio comment`;
    const recipients = new Set();

    if (assignedToId !== commenterId) {
      recipients.add(assignedToId);
    }
    if (assignedById !== commenterId) {
      recipients.add(assignedById);
    }

    if (recipients.size > 0) {
      const notificationPromises = Array.from(recipients).map(recipientId => {
        return Notification.create({
          recipient: recipientId,
          task: task._id,
          assigner: req.user._id,
          message: message
        });
      });
      await Promise.all(notificationPromises);
    }

    // Populate the createdBy field
    await task.populate('comments.createdBy', 'firstName lastName photo');

    res.json(task.comments);
  } catch (error) {
    console.error('Error adding audio comment:', error);
    res.status(500).json({ 
      message: error.message || 'Error uploading audio comment',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all comments for a task
router.get('/:taskId/comments', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId)
      .populate('comments.createdBy', 'firstName lastName photo');
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task.comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete a comment (admin only)
router.delete('/:taskId/comments/:commentId', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const comment = task.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    // allow user to delete their own comment
    if (comment.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }

    task.comments.pull(req.params.commentId);
    await task.save();

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: error.message });
  }
});

// Add a new route to get completed/verified tasks assigned to the user
router.get('/received/completed', protect, async (req, res) => {
  try {
    const query = {
      assignedTo: req.user._id,
      status: 'completed',
      verificationStatus: 'completed'
    };
    const tasks = await Task.find(query)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo')
      .select('title description clientName clientGroup workType status priority verification inwardEntryDate dueDate assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard tasks for Head (see all except tasks involving Admins or other Heads)
router.get('/head-dashboard', protect, async (req, res) => {
  try {
    if (req.user.role !== 'Senior') {
      return res.status(403).json({ message: 'Only Seniors can access this endpoint' });
    }
    // Get all users who are not Admin or Senior
    const users = await User.find({ role: { $nin: ['Admin', 'Senior'] } }).select('_id');
    const userIds = users.map(u => u._id.toString());
    // Include self
    userIds.push(req.user._id.toString());
    // Find tasks where assignedTo or assignedBy is in userIds
    const tasks = await Task.find({
      $or: [
        { assignedTo: { $in: userIds } },
        { assignedBy: { $in: userIds } }
      ]
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .populate('guides', 'firstName lastName photo')
      .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy createdAt updatedAt files comments billed selfVerification')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching head dashboard tasks:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard tasks for Senior (see all tasks for their team members and self)
router.get('/team-head-dashboard', protect, async (req, res) => {
  try {
    if (req.user.role !== 'Team Head') {
      return res.status(403).json({ message: 'Only Team Heads can access this endpoint' });
    }
    if (!req.user.team) {
      return res.status(400).json({ message: 'Team Head user does not have a team assigned' });
    }
    // Find all users in the same team
    const teamUsers = await User.find({ team: req.user.team, isEmailVerified: true }).select('_id');
    const teamUserIds = teamUsers.map(u => u._id.toString());
    // Include self
    teamUserIds.push(req.user._id.toString());
    // Find tasks where assignedTo or assignedBy is in teamUserIds
    const tasks = await Task.find({
      $or: [
        { assignedTo: { $in: teamUserIds } },
        { assignedBy: { $in: teamUserIds } }
      ]
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .populate('guides', 'firstName lastName photo')
      .select('title description status priority verification inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy createdAt updatedAt files comments billed selfVerification')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching team head dashboard tasks:', error);
    res.status(500).json({ message: error.message });
  }
});

router.get('/unique/client-names', protect, async (req, res) => {
  try {
    const clientNames = await Task.distinct('clientName');
    res.json(clientNames);
  } catch (error) {
    console.error('Error fetching unique client names:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/unique/client-groups', protect, async (req, res) => {
  try {
    const clientGroups = await Task.distinct('clientGroup');
    res.json(clientGroups);
  } catch (error) {
    console.error('Error fetching unique client groups:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

router.get('/unique/work-types', protect, async (req, res) => {
  try {
    const workTypes = await Task.distinct('workType');
    res.json(workTypes);
  } catch (error) {
    console.error('Error fetching unique work types:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// PATCH /:taskId/verifier - update the first or second verifier for a task
router.patch('/:taskId/verifier', protect, async (req, res) => {
  try {
    const { verificationAssignedTo, secondVerificationAssignedTo, thirdVerificationAssignedTo, fourthVerificationAssignedTo, fifthVerificationAssignedTo, verification } = req.body;
    if (!verificationAssignedTo && !secondVerificationAssignedTo && !thirdVerificationAssignedTo && !fourthVerificationAssignedTo && !fifthVerificationAssignedTo) {
      return res.status(400).json({ message: 'At least one verifier is required' });
    }
    const task = await Task.findById(req.params.taskId)
      .populate('assignedTo', 'firstName lastName')
      .populate('assignedBy', 'firstName lastName');
      
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    // Check if verification status is "next verification" and change it to "pending"
    if (task.verification === 'next verification') {
      task.verification = 'pending';
      console.log('Changed verification from "next verification" to "pending" after assigning verifier');
    }
    
    // Check if verification status should be changed from "accepted" to "pending" (for execution tab)
    if (verification === 'pending' && task.verification === 'accepted') {
      task.verification = 'pending';
      console.log('Changed verification from "accepted" to "pending" after assigning new verifier in execution tab');
    }
    
    // Get the assigner information
    const assigner = await User.findById(req.user._id).select('firstName lastName');
    
    // Track newly assigned verifiers for notifications
    const newlyAssignedVerifiers = [];
    
    // Allow any authenticated user to update any verifier
    if (verificationAssignedTo && verificationAssignedTo !== task.verificationAssignedTo?.toString()) {
      task.verificationAssignedTo = verificationAssignedTo;
      newlyAssignedVerifiers.push({
        userId: verificationAssignedTo,
        verifierType: 'first',
        field: 'verificationAssignedTo'
      });
    }
    if (secondVerificationAssignedTo && secondVerificationAssignedTo !== task.secondVerificationAssignedTo?.toString()) {
      task.secondVerificationAssignedTo = secondVerificationAssignedTo;
      newlyAssignedVerifiers.push({
        userId: secondVerificationAssignedTo,
        verifierType: 'second',
        field: 'secondVerificationAssignedTo'
      });
    }
    if (thirdVerificationAssignedTo && thirdVerificationAssignedTo !== task.thirdVerificationAssignedTo?.toString()) {
      task.thirdVerificationAssignedTo = thirdVerificationAssignedTo;
      newlyAssignedVerifiers.push({
        userId: thirdVerificationAssignedTo,
        verifierType: 'third',
        field: 'thirdVerificationAssignedTo'
      });
    }
    if (fourthVerificationAssignedTo && fourthVerificationAssignedTo !== task.fourthVerificationAssignedTo?.toString()) {
      task.fourthVerificationAssignedTo = fourthVerificationAssignedTo;
      newlyAssignedVerifiers.push({
        userId: fourthVerificationAssignedTo,
        verifierType: 'fourth',
        field: 'fourthVerificationAssignedTo'
      });
    }
    if (fifthVerificationAssignedTo && fifthVerificationAssignedTo !== task.fifthVerificationAssignedTo?.toString()) {
      task.fifthVerificationAssignedTo = fifthVerificationAssignedTo;
      newlyAssignedVerifiers.push({
        userId: fifthVerificationAssignedTo,
        verifierType: 'fifth',
        field: 'fifthVerificationAssignedTo'
      });
    }
    
    await task.save();
    
    // Send notifications to newly assigned verifiers
    for (const verifierInfo of newlyAssignedVerifiers) {
      const { userId, verifierType, field } = verifierInfo;
      
      // Determine who is assigning this verifier
      let assignerName = '';
      let assignerType = '';
      
      // Check if the assigner is the task's assignedTo user
      if (task.assignedTo && task.assignedTo._id.toString() === req.user._id.toString()) {
        assignerName = `${task.assignedTo.firstName} ${task.assignedTo.lastName}`;
        assignerType = 'assignedTo';
      } 
      // Check if the assigner is the task's assignedBy user  
      else if (task.assignedBy && task.assignedBy._id.toString() === req.user._id.toString()) {
        assignerName = `${task.assignedBy.firstName} ${task.assignedBy.lastName}`;
        assignerType = 'assignedBy';
      }
      // Check if the assigner is a previous verifier
      else {
        const verifierFields = ['verificationAssignedTo', 'secondVerificationAssignedTo', 'thirdVerificationAssignedTo', 'fourthVerificationAssignedTo', 'fifthVerificationAssignedTo'];
        for (const vField of verifierFields) {
          if (task[vField] && task[vField].toString() === req.user._id.toString()) {
            assignerName = `${assigner.firstName} ${assigner.lastName}`;
            assignerType = 'verifier';
            break;
          }
        }
        
        // If not found in verifiers, use the current user info
        if (!assignerName) {
          assignerName = `${assigner.firstName} ${assigner.lastName}`;
          assignerType = 'user';
        }
      }
      
      // Create the notification message with truncated task name
      const truncatedTaskName = truncateTaskName(task.title);
      let notificationMessage = '';
      
      if (verifierType === 'first') {
        if (assignerType === 'assignedTo') {
          notificationMessage = `${assignerName} assigned you "${truncatedTaskName}" for verification.`;
        } else {
          notificationMessage = `${assignerName} assigned you "${truncatedTaskName}" for verification.`;
        }
      } else {
        if (assignerType === 'assignedTo') {
          notificationMessage = `${assignerName} assigned you "${truncatedTaskName}" for ${verifierType} verification.`;
        } else if (assignerType === 'verifier') {
          notificationMessage = `${assignerName} assigned you "${truncatedTaskName}" for ${verifierType} verification.`;
        } else {
          notificationMessage = `${assignerName} assigned you "${truncatedTaskName}" for ${verifierType} verification.`;
        }
      }
      
      // Create notification
      const notification = new Notification({
        recipient: userId,
        task: task._id,
        assigner: req.user._id,
        message: notificationMessage,
        type: 'verifier_assignment'
      });
      
      await notification.save();
    }
    
    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('thirdVerificationAssignedTo', 'firstName lastName photo')
      .populate('fourthVerificationAssignedTo', 'firstName lastName photo')
      .populate('fifthVerificationAssignedTo', 'firstName lastName photo');
    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating verifier:', error);
    res.status(500).json({ message: 'Failed to update verifier' });
  }
});

// Update guides for a task
router.put('/:id/guides', protect, async (req, res) => {
  try {
    const { guides } = req.body;
    if (!Array.isArray(guides)) {
      return res.status(400).json({ message: 'Guides must be an array of user IDs' });
    }
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { guides },
      { new: true }
    ).populate('guides', 'firstName lastName photo');
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /:taskId/custom-fields - update custom fields for a task
router.patch('/:taskId/custom-fields', protect, async (req, res) => {
  try {
    const { customFields } = req.body;
    const task = await Task.findById(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update custom fields
    task.customFields = { ...task.customFields, ...customFields };
    await task.save();

    // Log the update
    await ActivityLogger.logTaskActivity(
      req.user._id,
      'task_custom_fields_updated',
      task._id,
      `Updated custom fields for task "${task.title}"`,
      null,
      customFields,
      req
    );

    res.json(task);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get analytics data for the current user
router.get('/analytics/data', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all tasks
    const allTasks = await Task.find().populate('assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo');

    // Total tasks assigned to current user (exclude completed tasks)
    const totalTasks = allTasks.filter(task => 
      task.assignedTo._id.toString() === userId.toString() &&
      task.status !== 'completed'
    ).length;

    // Execution tasks: Rule 1 (old): tasks assigned to current user with no verifiers and status not completed
    // Rule 2 (new): tasks assigned to current user with verification accepted and status not completed
    // These rules work as "OR" to each other
    const executionTasks = allTasks.filter(task => 
      task.assignedTo._id.toString() === userId.toString() &&
      task.status !== 'completed' &&
      (
        // Rule 1: no verifiers
        (!task.verificationAssignedTo &&
         !task.secondVerificationAssignedTo &&
         !task.thirdVerificationAssignedTo &&
         !task.fourthVerificationAssignedTo &&
         !task.fifthVerificationAssignedTo) ||
        // Rule 2: verification is accepted (even if has verifiers)
        task.verification === 'accepted'
      )
    ).length;

    // Helper function to check if user is the latest verifier
    const isLatestVerifier = (task, userId) => {
      const verifiers = [
        task.fifthVerificationAssignedTo,
        task.fourthVerificationAssignedTo,
        task.thirdVerificationAssignedTo,
        task.secondVerificationAssignedTo,
        task.verificationAssignedTo
      ].filter(v => v); // Remove null/undefined values

      if (verifiers.length === 0) return false;
      
      // Return true if user is the latest (first non-null) verifier
      return verifiers[0]._id.toString() === userId.toString();
    };

    // Verification tasks: tasks where current user is the latest verifier, status not completed
    // AND verification is not accepted
    const verificationTasks = allTasks.filter(task => 
      task.status !== 'completed' &&
      task.verification !== 'accepted' && // Don't count tasks with verification accepted
      isLatestVerifier(task, userId)
    ).length;

    // Issued for verification: tasks assigned to current user with verifiers, status not completed
    // AND verification is not accepted
    const issuedForVerificationTasks = allTasks.filter(task => 
      task.assignedTo._id.toString() === userId.toString() &&
      task.status !== 'completed' &&
      task.verification !== 'accepted' && // Don't count tasks with verification accepted
      (task.verificationAssignedTo || 
       task.secondVerificationAssignedTo || 
       task.thirdVerificationAssignedTo || 
       task.fourthVerificationAssignedTo || 
       task.fifthVerificationAssignedTo)
    ).length;

    // Priority distribution for tasks assigned to current user (exclude completed tasks)
    const userTasks = allTasks.filter(task => 
      task.assignedTo._id.toString() === userId.toString() &&
      task.status !== 'completed'
    );

    const priorityDistribution = {
      urgent: userTasks.filter(task => task.priority === 'urgent').length,
      today: userTasks.filter(task => task.priority === 'today').length,
      regular: userTasks.filter(task => task.priority === 'regular').length,
      inOneWeek: userTasks.filter(task => task.priority === 'inOneWeek' || task.priority === 'thisWeek').length,
      inFifteenDays: userTasks.filter(task => task.priority === 'inFifteenDays').length,
      inOneMonth: userTasks.filter(task => task.priority === 'inOneMonth' || task.priority === 'thisMonth').length,
    };

    const analyticsData = {
      totalTasks,
      executionTasks,
      verificationTasks,
      issuedForVerificationTasks,
      priorityDistribution
    };

    res.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all tasks for Excel export (Admin only)
router.get('/export/excel', protect, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }

    // Fetch all tasks with all related data
    const tasks = await Task.find({})
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('verificationAssignedTo', 'firstName lastName email')
      .populate('secondVerificationAssignedTo', 'firstName lastName email')
      .populate('thirdVerificationAssignedTo', 'firstName lastName email')
      .populate('fourthVerificationAssignedTo', 'firstName lastName email')
      .populate('fifthVerificationAssignedTo', 'firstName lastName email')
      .populate('files.uploadedBy', 'firstName lastName email')
      .populate('comments.createdBy', 'firstName lastName email')
      .populate('guides', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks for Excel export:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router; 