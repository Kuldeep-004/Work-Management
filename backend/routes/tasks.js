import express from 'express';
import Task from '../models/Task.js';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

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
    // Execution: not completed, no verifiers, assigned to current user
    const executionCount = await Task.countDocuments({
      status: { $ne: 'completed' },
      assignedTo: req.user._id,
      verificationAssignedTo: { $exists: false },
      secondVerificationAssignedTo: { $exists: false },
      thirdVerificationAssignedTo: { $exists: false },
      fourthVerificationAssignedTo: { $exists: false },
      fifthVerificationAssignedTo: { $exists: false }
    });
    // Received for verification: not completed, user is the latest assigned verifier
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
      $or: orConditions
    });
    // Issued for verification: not completed, first verifier is set, assigned to current user
    const issuedVerificationCount = await Task.countDocuments({
      status: { $ne: 'completed' },
      assignedTo: req.user._id,
      verificationAssignedTo: { $exists: true, $ne: null }
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
        { verificationStatus: { $ne: 'pending' } }
      ]
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .populate('guides', 'firstName lastName photo')
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy createdAt updatedAt files comments billed selfVerification')
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
    if (req.user.role === 'Admin') {
      // Admin: all tasks (including completed verification)
      tasks = await Task.find({ verificationStatus: { $ne: 'pending' } })
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
        .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'Team Head') {
      // Team Head: see own assigned/received tasks and all tasks assigned by/assigned to any Senior
      // Get all Seniors
      const seniors = await User.find({ role: 'Senior', isEmailVerified: true }).select('_id');
      const seniorIds = seniors.map(u => u._id.toString());
      seniorIds.push(req.user._id.toString()); // include self
      tasks = await Task.find({
        $or: [
          { assignedTo: { $in: seniorIds } },
          { assignedBy: { $in: seniorIds } }
        ],
        verificationStatus: { $ne: 'pending' }
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
        .populate('guides', 'firstName lastName photo')
        .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'Senior') {
      // Senior: see own assigned/received tasks and all tasks assigned to/assigned by Freshers of their team
      if (!req.user.team) {
        return res.status(400).json({ message: 'Senior user does not have a team assigned' });
      }
      // Get all Freshers in the same team
      const freshers = await User.find({ team: req.user.team, role: 'Fresher', isEmailVerified: true }).select('_id');
      const fresherIds = freshers.map(u => u._id.toString());
      fresherIds.push(req.user._id.toString()); // include self
      tasks = await Task.find({
        $or: [
          { assignedTo: { $in: fresherIds } },
          { assignedBy: { $in: fresherIds } }
        ],
        verificationStatus: { $ne: 'pending' }
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
        .populate('guides', 'firstName lastName photo')
        .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides')
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
        .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification')
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
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification')
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
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments taskType createdAt updatedAt files comments billed selfVerification')
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
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments taskType createdAt updatedAt files comments billed selfVerification')
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
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides')
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
        // Tasks for execution: not completed, no verifiers, assigned to current user
        query = {
          status: { $ne: 'completed' },
          assignedTo: req.user._id,
          verificationAssignedTo: { $exists: false },
          secondVerificationAssignedTo: { $exists: false },
          thirdVerificationAssignedTo: { $exists: false },
          fourthVerificationAssignedTo: { $exists: false },
          fifthVerificationAssignedTo: { $exists: false }
        };
        break;
      case 'receivedVerification': {
        // Tasks where status is not completed and user is the latest assigned verifier
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
          $or: orConditions
        };
        break;
      }
      case 'issuedVerification':
        // Tasks issued for verification: not completed, first verifier is set, assigned to current user
        query = {
          status: { $ne: 'completed' },
          assignedTo: req.user._id,
          verificationAssignedTo: { $exists: true, $ne: null }
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
        query = {
          status: { $ne: 'completed' },
          assignedTo: req.user._id,
          verificationAssignedTo: { $exists: false },
          secondVerificationAssignedTo: { $exists: false },
          thirdVerificationAssignedTo: { $exists: false },
          fourthVerificationAssignedTo: { $exists: false },
          fifthVerificationAssignedTo: { $exists: false }
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
      .select('title description clientName clientGroup workType workDoneBy status priority inwardEntryDate dueDate assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides')
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
      .select('title description clientName clientGroup workType workDoneBy status priority inwardEntryDate dueDate assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification guides')
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
      .populate('assignedTo', 'firstName lastName photo group')
      .populate('assignedBy', 'firstName lastName photo group')
      .populate('guides', 'firstName lastName photo')
      .select('title description clientName clientGroup workType workDoneBy assignedTo assignedBy priority inwardEntryDate inwardEntryTime dueDate targetDate billed');
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
      workDoneBy
    } = req.body;

    // Validate workDoneBy
    const validWorkDoneBy = ['First floor', 'Second floor', 'Both'];
    if (!workDoneBy || !validWorkDoneBy.includes(workDoneBy)) {
      return res.status(400).json({ message: 'workDoneBy is required and must be one of: First floor, Second floor, Both' });
    }

    const createdTasks = [];

    // Fetch assigner details for notification message
    const assigner = await User.findById(req.user._id).select('firstName lastName');

    // Combine date and time for inwardEntryDate
    let combinedInwardEntryDate = null;
    if (inwardEntryDate && inwardEntryTime) {
      const [year, month, day] = inwardEntryDate.split('-');
      const [hours, minutes] = inwardEntryTime.split(':');
      combinedInwardEntryDate = new Date(year, month - 1, day, hours, minutes);
    } else if (inwardEntryDate) {
      // If only date is provided, set time to current time
      combinedInwardEntryDate = new Date(inwardEntryDate);
    }

    for (const userId of assignedTo) {
      // Set verification status based on whether assignedBy and assignedTo are the same
      const verificationStatus = (req.user._id.toString() === userId.toString()) ? 'completed' : 'pending';
      const task = new Task({
        title,
        description,
        clientName,
        clientGroup,
        workType,
        assignedTo: userId,
        assignedBy: req.user._id,
        priority,
        inwardEntryDate: combinedInwardEntryDate,
        dueDate,
        targetDate,
        verificationAssignedTo,
        billed: billed !== undefined ? billed : true,
        selfVerification: req.body.selfVerification ?? false,
        verificationStatus,
        workDoneBy
      });
      const savedTask = await task.save();
      createdTasks.push(savedTask);

      // Create notification for the assigned user with new format
      const notificationMessage = `${assigner.firstName} ${assigner.lastName} assigned you ${title} of ${clientName}.`;
      const notification = new Notification({
        recipient: userId,
        task: savedTask._id,
        assigner: req.user._id,
        message: notificationMessage
      });
      await notification.save();
    }
    
    res.status(201).json(createdTasks);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update task
router.put('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('assignedTo', 'firstName lastName photo group')
     .populate('assignedBy', 'firstName lastName photo group');

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

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ 
      message: 'Error updating task status',
      error: error.message 
    });
  }
});

// Add new route for updating verification status
router.patch('/:taskId/verification', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const { verificationStatus, verifierId } = req.body;
    if (!['pending', 'executed', 'first_verified', 'completed', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({ message: 'Invalid verification status value' });
    }

    // Check if user is authorized to update verification status
    const isAssignee = task.assignedTo.toString() === req.user._id.toString();
    const isFirstVerifier = task.verificationAssignedTo?.toString() === req.user._id.toString();
    const isSecondVerifier = task.secondVerificationAssignedTo?.toString() === req.user._id.toString();
    const isThirdVerifier = task.thirdVerificationAssignedTo?.toString() === req.user._id.toString();
    const isFourthVerifier = task.fourthVerificationAssignedTo?.toString() === req.user._id.toString();
    const isFifthVerifier = task.fifthVerificationAssignedTo?.toString() === req.user._id.toString();

    if (!isAssignee && !isFirstVerifier && !isSecondVerifier && !isThirdVerifier && !isFourthVerifier && !isFifthVerifier) {
      return res.status(403).json({ message: 'Not authorized to update verification status' });
    }

    // Handle different verification statuses
    switch (verificationStatus) {
      case 'executed':
        if (!isAssignee) {
          return res.status(403).json({ message: 'Only assignee can mark task as executed' });
        }
        if (!verifierId) {
          return res.status(400).json({ message: 'Verifier ID is required for executed status' });
        }
        // Update task with verifier assignment
        task.verificationAssignedTo = verifierId;
        task.verificationStatus = 'executed';
        task.status = 'in_progress'; // Keep task in progress while being verified
        break;

      case 'first_verified':
        if (!isFirstVerifier) {
          return res.status(403).json({ message: 'Only first verifier can perform first verification' });
        }
        if (!verifierId) {
          return res.status(400).json({ message: 'Second verifier ID is required for first verification' });
        }
        // Assign second verifier and update status
        task.secondVerificationAssignedTo = verifierId;
        task.verificationStatus = 'first_verified';
        break;

      case 'rejected':
        if (!isFirstVerifier && !isSecondVerifier && !isThirdVerifier && !isFourthVerifier && !isFifthVerifier) {
          return res.status(403).json({ message: 'Only verifiers can reject the task' });
        }
        // Reset verification status and remove verifiers
        task.verificationStatus = 'pending';
        task.verificationAssignedTo = null;
        task.secondVerificationAssignedTo = null;
        task.thirdVerificationAssignedTo = null;
        task.fourthVerificationAssignedTo = null;
        task.fifthVerificationAssignedTo = null;
        task.status = 'in_progress';
        break;

      case 'completed':
        if (!isFirstVerifier && !isSecondVerifier && !isThirdVerifier && !isFourthVerifier && !isFifthVerifier) {
          return res.status(403).json({ message: 'Only verifiers can complete the task' });
        }
        // Mark the task as verified/completed instead of deleting
        task.verificationStatus = 'completed';
        task.status = 'completed';
        break;

      default:
        break;
    }

    // Always save the task after updating verification status
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
      .populate('originalAssignee', 'firstName lastName photo');

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ message: error.message });
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
    const allowedPriorities = [
      'urgent',
      'today',
      'lessThan3Days',
      'thisWeek',
      'thisMonth',
      'regular',
      'filed',
      'dailyWorksOffice',
      'monthlyWorks'
    ];
    if (!allowedPriorities.includes(priority)) {
      return res.status(400).json({ message: 'Invalid priority value' });
    }

    // Update priority
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

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task priority:', error);
    res.status(500).json({ 
      message: 'Error updating task priority',
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

    // Remove restriction: allow any authenticated user to delete any task
    // Previously:
    // const taskCreatorId = task.assignedBy.toString();
    // const taskAssigneeId = task.assignedTo.toString();
    // const userId = req.user._id.toString();
    // if (taskCreatorId !== userId && taskAssigneeId !== userId) {
    //   return res.status(403).json({ message: 'Not authorized to delete this task' });
    // }

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
      return res.json(task);
    } else if (action === 'reject') {
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
    const message = `${commenter.firstName} ${commenter.lastName} has commented on ${task.title} of ${task.clientName} as ${content}`;
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
    const message = `${commenter.firstName} ${commenter.lastName} has commented on ${task.title} of ${task.clientName} as Audio comment`;
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
      .select('title description clientName clientGroup workType workDoneBy status priority inwardEntryDate dueDate assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo thirdVerificationAssignedTo fourthVerificationAssignedTo fifthVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments billed selfVerification')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard tasks for Head (see all except tasks involving Admins or other Heads)
router.get('/head-dashboard', protect, async (req, res) => {
  try {
    if (req.user.role !== 'Team Head') {
      return res.status(403).json({ message: 'Only Team Heads can access this endpoint' });
    }
    // Get all users who are not Admin or Team Head
    const users = await User.find({ role: { $nin: ['Admin', 'Team Head'] } }).select('_id');
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
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy createdAt updatedAt files comments billed selfVerification')
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
    if (req.user.role !== 'Senior') {
      return res.status(403).json({ message: 'Only Seniors can access this endpoint' });
    }
    if (!req.user.team) {
      return res.status(400).json({ message: 'Senior user does not have a team assigned' });
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
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType workDoneBy assignedTo assignedBy createdAt updatedAt files comments billed selfVerification')
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
    const { verificationAssignedTo, secondVerificationAssignedTo, thirdVerificationAssignedTo, fourthVerificationAssignedTo, fifthVerificationAssignedTo } = req.body;
    if (!verificationAssignedTo && !secondVerificationAssignedTo && !thirdVerificationAssignedTo && !fourthVerificationAssignedTo && !fifthVerificationAssignedTo) {
      return res.status(400).json({ message: 'At least one verifier is required' });
    }
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    // Allow any authenticated user to update any verifier
    if (verificationAssignedTo) {
      task.verificationAssignedTo = verificationAssignedTo;
    }
    if (secondVerificationAssignedTo) {
      task.secondVerificationAssignedTo = secondVerificationAssignedTo;
    }
    if (thirdVerificationAssignedTo) {
      task.thirdVerificationAssignedTo = thirdVerificationAssignedTo;
    }
    if (fourthVerificationAssignedTo) {
      task.fourthVerificationAssignedTo = fourthVerificationAssignedTo;
    }
    if (fifthVerificationAssignedTo) {
      task.fifthVerificationAssignedTo = fifthVerificationAssignedTo;
    }
    await task.save();
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

export default router; 