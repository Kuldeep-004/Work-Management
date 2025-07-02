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
import { uploadFile, deleteImage } from '../utils/cloudinary.js'; // Now uses ImageKit
import { promisify } from 'util';
import ffmpeg from 'fluent-ffmpeg';

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
    const assigner = await User.findById(req.user._id);
    
    // Check if assignedTo is an array and not empty
    if (!Array.isArray(assignedTo) || assignedTo.length === 0) {
      return res.status(400).json({ message: 'assignedTo must be a non-empty array of user IDs' });
    }

    // Fresher cannot create tasks
    if (assigner.role === 'Fresher') {
      return res.status(403).json({ message: 'Freshers cannot create tasks' });
    }

    // Check each assignee's permissions
    for (const assigneeId of assignedTo) {
      const assignee = await User.findById(assigneeId);
      if (!assignee) {
        return res.status(404).json({ message: `Assignee with ID ${assigneeId} not found` });
      }

      // Admin can assign to anyone (including themselves)
      if (assigner.role === 'Admin') {
        // No restrictions - Admin can assign to anyone
        continue;
      }

      // Head can assign to any Team Head and Fresher (including themselves)
      if (assigner.role === 'Head') {
        if (assignee.role === 'Admin') {
          return res.status(403).json({ message: 'Heads cannot assign tasks to Admins' });
        }
        // Head can assign to Team Head, Fresher, and themselves
        continue;
      }

      // Team Head can assign to any Fresher from their team (including themselves)
      if (assigner.role === 'Team Head') {
        // Team Head can always assign to themselves
        if (assigneeId === req.user._id.toString()) {
          continue;
        }
        
        // Check if assignee is in the same team and is a Fresher
        if (assignee.team?.toString() !== assigner.team?.toString()) {
          return res.status(403).json({ message: 'Team Heads can only assign tasks to members of their team' });
        }
        
        if (assignee.role !== 'Fresher') {
          return res.status(403).json({ message: 'Team Heads can only assign tasks to Freshers in their team' });
        }
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
    const executionCount = await Task.countDocuments({
      assignedBy: req.user._id,
      verificationStatus: { $in: ['pending'] }
    });
    
    const verificationCount = await Task.countDocuments({
      assignedBy: req.user._id,
      verificationStatus: { $in: ['executed', 'first_verified'] }
    });
    
    const completedCount = await Task.countDocuments({
      assignedBy: req.user._id,
      verificationStatus: { $in: ['completed'] }
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
    const executionCount = await Task.countDocuments({
      $or: [
        { assignedTo: req.user._id, verificationStatus: 'pending' },
        { verificationAssignedTo: req.user._id, verificationStatus: 'executed' },
        { secondVerificationAssignedTo: req.user._id, verificationStatus: 'first_verified' }
      ]
    });
    
    const verificationCount = await Task.countDocuments({
      assignedTo: req.user._id,
      verificationStatus: { $in: ['executed', 'first_verified'] }
    });
    
    const completedCount = await Task.countDocuments({
      assignedTo: req.user._id,
      verificationStatus: 'completed'
    });
    
    res.json({
      execution: executionCount,
      verification: verificationCount,
      completed: completedCount
    });
  } catch (error) {
    console.error('Error fetching received task counts:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all tasks for the user (dashboard)
router.get('/', protect, async (req, res) => {
  try {
    const tasks = await Task.find({
      $or: [
        { assignedTo: req.user._id },
        { assignedBy: req.user._id }
      ]
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy createdAt updatedAt files comments')
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
      tasks = await Task.find({})
        .populate('assignedTo', 'firstName lastName photo group')
        .populate('assignedBy', 'firstName lastName photo group')
        .populate('verificationAssignedTo', 'firstName lastName photo')
        .populate('secondVerificationAssignedTo', 'firstName lastName photo')
        .populate('files.uploadedBy', 'firstName lastName photo')
        .populate('comments.createdBy', 'firstName lastName photo')
        .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'Head') {
      // Head: all except tasks involving Admins or other Heads (including completed verification)
      const users = await User.find({ role: { $nin: ['Admin', 'Head'] }, isEmailVerified: true }).select('_id');
      const userIds = users.map(u => u._id.toString());
      userIds.push(req.user._id.toString());
      tasks = await Task.find({
        $or: [
          { assignedTo: { $in: userIds } },
          { assignedBy: { $in: userIds } }
        ]
      })
        .populate('assignedTo', 'firstName lastName photo')
        .populate('assignedBy', 'firstName lastName photo')
        .populate('verificationAssignedTo', 'firstName lastName photo')
        .populate('secondVerificationAssignedTo', 'firstName lastName photo')
        .populate('files.uploadedBy', 'firstName lastName photo')
        .populate('comments.createdBy', 'firstName lastName photo')
        .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'Team Head') {
      // Team Head: all tasks for their team members and self (including completed verification)
      if (!req.user.team) {
        return res.status(400).json({ message: 'Team Head user does not have a team assigned' });
      }
      const teamUsers = await User.find({ team: req.user.team, isEmailVerified: true }).select('_id');
      const teamUserIds = teamUsers.map(u => u._id.toString());
      teamUserIds.push(req.user._id.toString());
      tasks = await Task.find({
        $or: [
          { assignedTo: { $in: teamUserIds } },
          { assignedBy: { $in: teamUserIds } },
          { verificationAssignedTo: req.user._id },
          { secondVerificationAssignedTo: req.user._id }
        ]
      })
        .populate('assignedTo', 'firstName lastName photo')
        .populate('assignedBy', 'firstName lastName photo')
        .populate('verificationAssignedTo', 'firstName lastName photo')
        .populate('secondVerificationAssignedTo', 'firstName lastName photo')
        .populate('files.uploadedBy', 'firstName lastName photo')
        .populate('comments.createdBy', 'firstName lastName photo')
        .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments')
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
    const tasks = await Task.find({
      $or: [
        { verificationAssignedTo: req.user._id },
        { secondVerificationAssignedTo: req.user._id }
      ],
      verificationStatus: { $nin: ['completed', 'rejected'] }
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('originalAssignee', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
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
      .populate('originalAssignee', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo verificationStatus verificationComments taskType createdAt updatedAt files comments')
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
        { verificationAssignedTo: req.user._id }
      ]
    })
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo verificationStatus verificationComments taskType createdAt updatedAt files comments')
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
    
    // Filter based on tab
    switch (tab) {
      case 'execution':
        // Tasks for execution: tasks that are still being worked on
        query.verificationStatus = { $in: ['pending'] };
        break;
      case 'verification':
        // Tasks under verification: tasks that are being verified
        query.verificationStatus = { $in: ['executed', 'first_verified'] };
        break;
      case 'completed':
        // Completed tasks: tasks that have been fully completed
        query.verificationStatus = { $in: ['completed'] };
        break;
      default:
        // Default to execution tab
        query.verificationStatus = { $in: ['pending'] };
    }
    
    const tasks = await Task.find(query)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .populate('files.uploadedBy', 'firstName lastName photo')
      .populate('comments.createdBy', 'firstName lastName photo')
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments')
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
    
    // Filter based on tab
    switch (tab) {
      case 'execution':
        // Tasks for execution: tasks that the user is currently working on
        // For assignedTo users: verificationStatus = 'pending'
        // For verifiers: verificationStatus = 'executed' (for first verifier) or 'first_verified' (for second verifier)
        query = {
          $or: [
            { assignedTo: req.user._id, verificationStatus: 'pending' },
            { verificationAssignedTo: req.user._id, verificationStatus: 'executed' },
            { secondVerificationAssignedTo: req.user._id, verificationStatus: 'first_verified' }
          ]
        };
        break;
      case 'verification':
        // Tasks under verification: tasks that are being verified by someone else
        // Only show for assignedTo users when task is being verified by others
        query = {
          assignedTo: req.user._id,
          verificationStatus: { $in: ['executed', 'first_verified'] }
        };
        break;
      case 'completed':
        // Completed tasks: only show for assignedTo user
        query = {
          assignedTo: req.user._id,
          verificationStatus: 'completed'
        };
        break;
      default:
        // Default to execution tab
        query = {
          $or: [
            { assignedTo: req.user._id, verificationStatus: 'pending' },
            { verificationAssignedTo: req.user._id, verificationStatus: 'executed' },
            { secondVerificationAssignedTo: req.user._id, verificationStatus: 'first_verified' }
          ]
        };
    }
    
    const tasks = await Task.find(query)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('secondVerificationAssignedTo', 'firstName lastName photo')
      .select('title description clientName clientGroup workType status priority inwardEntryDate dueDate targetDate assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments')
      .sort({ createdAt: -1 });
    
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching received tasks:', error);
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
      .populate('assignedBy', 'firstName lastName photo group');
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
      verificationAssignedTo
    } = req.body;

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
        verificationAssignedTo
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
      .populate('files.uploadedBy', 'firstName lastName photo');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Only the assignee can update the task status
    if (task.assignedTo._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to update task status' });
    }

    const { status } = req.body;
    if (!['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    // Update status
    task.status = status;
    await task.save();

    // Fetch the updated task with all populated fields
    const updatedTask = await Task.findById(task._id)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
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

    if (!isAssignee && !isFirstVerifier && !isSecondVerifier) {
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
        if (!isFirstVerifier && !isSecondVerifier) {
          return res.status(403).json({ message: 'Only verifiers can reject the task' });
        }
        // Reset verification status and remove verifiers
        task.verificationStatus = 'pending';
        task.verificationAssignedTo = null;
        task.secondVerificationAssignedTo = null;
        task.status = 'in_progress';
        break;

      case 'completed':
        if (!isFirstVerifier && !isSecondVerifier) {
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
      .populate('originalAssignee', 'firstName lastName photo');

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete task
router.delete('/:id', protect, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Convert IDs to strings for comparison
    const taskCreatorId = task.assignedBy.toString();
    const taskAssigneeId = task.assignedTo.toString();
    const userId = req.user._id.toString();

    // Allow both creator and assignee to delete the task
    if (taskCreatorId !== userId && taskAssigneeId !== userId) {
      return res.status(403).json({ message: 'Not authorized to delete this task' });
    }

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

    // Check if user is authorized (either assignee or creator)
    const isAssignee = task.assignedTo.toString() === req.user._id.toString();
    const isCreator = task.assignedBy.toString() === req.user._id.toString();
    const isVerifier = task.verificationAssignedTo?.toString() === req.user._id.toString();

    if (!isAssignee && !isCreator && !isVerifier) {
      return res.status(403).json({ message: 'Not authorized to upload files to this task' });
    }

    // Add uploaded files to task
    const uploadedFiles = [];
    
    for (const file of req.files) {
      try {
        // Upload to Cloudinary
        const cloudResult = await uploadFile(file.path, 'task_files');
        
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
        console.error('Error uploading to Cloudinary:', cloudError);
        // Fallback to local storage if cloud upload fails
        uploadedFiles.push({
          filename: file.filename,
          originalName: file.originalname,
          path: file.filename,
          uploadedBy: req.user._id
        });
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

    // Check if user is authorized (either assignee or creator)
    const isAssignee = task.assignedTo.toString() === req.user._id.toString();
    const isCreator = task.assignedBy.toString() === req.user._id.toString();
    const isVerifier = task.verificationAssignedTo?.toString() === req.user._id.toString();

    if (!isAssignee && !isCreator && !isVerifier) {
      return res.status(403).json({ message: 'Not authorized to delete files from this task' });
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

    // Update task
    task.status = 'completed';
    await task.save();

    const updatedTask = await Task.findById(taskId)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
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

    // Check if user is the verifier (either first or second)
    const isFirstVerifier = task.verificationAssignedTo && task.verificationAssignedTo.toString() === req.user._id.toString();
    const isSecondVerifier = task.secondVerificationAssignedTo && task.secondVerificationAssignedTo.toString() === req.user._id.toString();

    if (!isFirstVerifier && !isSecondVerifier) {
      return res.status(403).json({ message: 'Not authorized to verify this task' });
    }

    if (action === 'approve') {
      // If second verifier, mark as completed
      if (isSecondVerifier) {
        task.status = 'completed';
        task.verificationStatus = 'completed';
        task.verificationComments = comments;
        task.verificationAssignedTo = null;
        task.secondVerificationAssignedTo = null;
      } else {
        // Approve the task (first verifier)
        task.status = 'completed';
        task.verificationStatus = 'approved';
        task.verificationComments = comments;
      }
    } else if (action === 'reject') {
      // Reject the task and send back to original assignee
      task.status = 'rejected';
      task.verificationStatus = 'rejected';
      task.verificationComments = comments;
      task.assignedTo = task.originalAssignee; // Reassign to original assignee
      task.verificationAssignedTo = null; // Clear verifier
      task.secondVerificationAssignedTo = null;
    }

    await task.save();

    const updatedTask = await Task.findById(taskId)
      .populate('assignedTo', 'firstName lastName photo')
      .populate('assignedBy', 'firstName lastName photo')
      .populate('verificationAssignedTo', 'firstName lastName photo')
      .populate('originalAssignee', 'firstName lastName photo');

    res.json(updatedTask);
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
    let tempMp3Path = null;
    try {
      let uploadPath = req.file.path;
      let uploadMimetype = req.file.mimetype;
      // If the file is .webm, convert to .mp3
      if (req.file.mimetype === 'audio/webm' || req.file.originalname.endsWith('.webm')) {
        tempMp3Path = req.file.path.replace(/\.webm$/, '.mp3');
        await new Promise((resolve, reject) => {
          ffmpeg(req.file.path)
            .toFormat('mp3')
            .on('end', resolve)
            .on('error', reject)
            .save(tempMp3Path);
        });
        uploadPath = tempMp3Path;
        uploadMimetype = 'audio/mpeg';
        console.log('Converted .webm to .mp3:', tempMp3Path);
      }
      // Upload to ImageKit
      const cloudResult = await uploadFile(uploadPath, '/audio_comments', uploadMimetype);
      console.log('ImageKit upload result:', cloudResult);
      audioUrl = cloudResult.url;
      // Delete local files after cloud upload
      try {
        await unlinkAsync(req.file.path);
        if (tempMp3Path) await unlinkAsync(tempMp3Path);
      } catch (unlinkError) {
        if (unlinkError.code !== 'ENOENT') {
          console.error('Error deleting local audio file:', unlinkError);
        }
      }
    } catch (cloudError) {
      console.error('Error uploading audio to ImageKit:', cloudError);
      // Clean up temp files if conversion/upload fails
      try {
        if (req.file && req.file.path) await unlinkAsync(req.file.path);
        if (tempMp3Path) await unlinkAsync(tempMp3Path);
      } catch (e) {}
      return res.status(500).json({ message: 'Error uploading audio to ImageKit' });
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
      .select('title description clientName clientGroup workType status priority inwardEntryDate dueDate targetDate assignedTo assignedBy verificationAssignedTo secondVerificationAssignedTo verificationStatus verificationComments createdAt updatedAt files comments')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard tasks for Head (see all except tasks involving Admins or other Heads)
router.get('/head-dashboard', protect, async (req, res) => {
  try {
    if (req.user.role !== 'Head') {
      return res.status(403).json({ message: 'Only Heads can access this endpoint' });
    }
    // Get all users who are not Admin or Head
    const users = await User.find({ role: { $nin: ['Admin', 'Head'] } }).select('_id');
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
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy createdAt updatedAt files comments')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching head dashboard tasks:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get dashboard tasks for Team Head (see all tasks for their team members and self)
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
      .select('title description status priority inwardEntryDate dueDate targetDate clientName clientGroup workType assignedTo assignedBy createdAt updatedAt files comments')
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

export default router; 