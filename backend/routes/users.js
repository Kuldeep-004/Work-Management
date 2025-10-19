import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import Team from '../models/Team.js';
import { uploadMiddleware } from '../middleware/uploadMiddleware.js';
import { uploadImage, deleteFile } from '../utils/cloudinary.js';
import fs from 'fs';
import { promisify } from 'util';
import UserTabState from '../models/UserTabState.js';
import ActivityLogger from '../utils/activityLogger.js';

const unlinkAsync = promisify(fs.unlink);
const router = express.Router();

// Add this check at the start of all tabstate and user-tab-state routes:
function validateTabKey(tabKey) {
  // List of valid tabKeys (add all real page keys here)
  const validTabKeys = [
    'adminDashboard',
    'receivedTasks',
    'assignedTasks',
    'billedTasks',
    'unbilledTasks',
    'costManagement',
    'costManagementBilled',
    'costManagementUnbilled',
    'costManagementCompletedBilled',
    'costManagementCompletedUnbilled',
    // add more as needed
  ];
  if (!validTabKeys.includes(tabKey)) {
    throw new Error('Invalid tabKey');
  }
}

// Get all users
router.get('/', protect, async (req, res) => {
  try {
    const { status, includeRejected } = req.query;
    let query = {};
    
    // If status is explicitly provided, use it
    if (status) {
      query.status = status;
    } 
    // If includeRejected is not true, exclude rejected users
    else if (includeRejected !== 'true') {
      query.status = { $ne: 'rejected' };
    }
    // Always filter only verified users unless explicitly overridden
    if (typeof query.isEmailVerified === 'undefined') {
      query.isEmailVerified = true;
    }
    
    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user profile
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
router.put('/profile', protect, uploadMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, email, newPassword } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic info
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;

    // Handle profile picture upload
    if (req.file) {
      try {
        // Delete old photo if exists
        if (user.photo && user.photo.public_id) {
          await deleteFile(user.photo.public_id);
        }
        // Upload new image to pCloud
        const result = await uploadImage(req.file.path);
        user.photo = {
          public_id: result.public_id,
          url: result.url
        };
        try {
          await unlinkAsync(req.file.path);
        } catch (unlinkError) {}
      } catch (error) {
        if (req.file && req.file.path) {
          try { await unlinkAsync(req.file.path); } catch (e) {}
        }
        return res.status(500).json({ message: error.message || 'Error uploading image to pCloud' });
      }
    }

    // Update password if provided
    if (newPassword) {
      user.password = newPassword;
    }
    
    await user.save();

    // Create new token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'default_jwt_secret',
      { expiresIn: '30d' }
    );

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      team: user.team,
      photo: user.photo,
      role: user.role,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Error updating profile' });
  }
});

// Assign user to team (Admin only)
router.put('/:userId/team', protect, async (req, res) => {
  try {
    const { teamId } = req.body;
    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if user is Admin
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }

    user.team = teamId;
    await user.save();

    res.json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      team: user.team
    });
  } catch (error) {
    res.status(500).json({ message: 'Error assigning team' });
  }
});

// Get pending approval requests (Admin only)
router.get('/pending-approvals', protect, async (req, res) => {
  try {
    // Check if user is Admin
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }

    const pendingUsers = await User.find({ 
      status: 'pending',
      isEmailVerified: true 
    }).select('-password');

    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve or reject user (Admin only)
router.put('/:userId/approval', protect, async (req, res) => {
  try {
    const { status, role, team } = req.body;
    
    // Check if user is Admin
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (status === 'rejected') {
      user.status = 'rejected';
      await user.save();
      return res.status(200).json({ message: 'User rejected successfully' });
    }

    // For approval, require both role and team
    if (status === 'approved') {
      if (!role) {
        return res.status(400).json({ message: 'Role is required for approval' });
      }

      // Validate role
      if (!['Fresher', 'Senior', 'Team Head'].includes(role)) { // swapped
        return res.status(400).json({ message: 'Invalid role' });
      }

      // For Senior role, set team to null
      if (role === 'Senior') { // swapped
        user.team = null;
      } else {
        // For non-Senior roles, require team
        if (!team) {
          return res.status(400).json({ message: 'Team is required for non-Senior roles' });
        }

        // Validate team
        const teamExists = await Team.findById(team);
        if (!teamExists) {
          return res.status(400).json({ message: 'Invalid team' });
        }
        user.team = team;
      }

      user.role = role;
    }

    // If status is set to pending, clear team and role
    if (status === 'pending') {
      user.role = null;
      user.team = null;
    }

    user.status = status;
    await user.save();

    // Log user approval/rejection activity
    if (status === 'approved') {
      await ActivityLogger.logUserActivity(
        req.user.id,
        'user_approved',
        user._id,
        `Approved user ${user.firstName} ${user.lastName} (${user.email}) with role ${role}`,
        { status: 'pending' },
        { status: 'approved', role, team },
        req,
        {
          userEmail: user.email,
          assignedRole: role,
          assignedTeam: team
        }
      );
    } else if (status === 'rejected') {
      await ActivityLogger.logUserActivity(
        req.user.id,
        'user_rejected',
        user._id,
        `Rejected user ${user.firstName} ${user.lastName} (${user.email})`,
        { status: 'pending' },
        { status: 'rejected' },
        req,
        {
          userEmail: user.email
        }
      );
    }

    res.status(200).json({ message: `User ${status} successfully` });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get blocked users (Admin only)
router.get('/blocked', protect, async (req, res) => {
  try {
    // Check if user is Admin
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }

    const blockedUsers = await User.find({ 
      status: 'rejected',
      isEmailVerified: true 
    }).select('-password');

    res.json(blockedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Unblock user (Admin only)
router.put('/:userId/unblock', protect, async (req, res) => {
  try {
    // Check if user is Admin
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.status = 'pending';
    await user.save();

    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user (Admin only)
router.delete('/:userId', protect, async (req, res) => {
  try {
    // Check if user is Admin
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent deleting admin users
    if (user.role === 'Admin') {
      return res.status(400).json({ message: 'Cannot delete admin users' });
    }

    await User.findByIdAndDelete(req.params.userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user role or team (Admin only, partial update)
router.patch('/:userId/update-fields', protect, async (req, res) => {
  try {
    // Check if user is Admin
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { role, team, role2 } = req.body;
    let updatedFields = {};

    if (role) {
      updatedFields.role = role;
      // If role is Senior, remove team
      if (role === 'Senior') { // swapped
        updatedFields.team = null;
      }
    }

    // Handle team update
    if (team !== undefined) {
      // No restriction for Team Head or Senior
      updatedFields.team = team;
    }

    // Handle role2 update
    if (role2 !== undefined) {
      if (Array.isArray(role2)) {
        updatedFields.role2 = role2;
      } else if (typeof role2 === 'string') {
        updatedFields.role2 = [role2];
      }
    }

    // Update user with new fields
    const updatedUser = await User.findByIdAndUpdate(
      req.params.userId,
      { $set: updatedFields },
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found after update' });
    }

    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Get all users (except self) with hourly rates
router.get('/hourly-rates', protect, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }
  // Exclude only blocked users (status: 'rejected')
  const users = await User.find({ status: { $ne: 'rejected' } }).select('firstName lastName email role hourlyRate status');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin: Set hourly rate for a user
router.put('/:userId/hourly-rate', protect, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (adminUser.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }
    let { hourlyRate } = req.body;
    hourlyRate = Number(hourlyRate);
    if (isNaN(hourlyRate) || hourlyRate < 0) {
      return res.status(400).json({ message: 'Invalid hourly rate' });
    }
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.hourlyRate = hourlyRate;
    await user.save();
    res.json({ message: 'Hourly rate updated', userId: user._id, hourlyRate: user.hourlyRate });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users except the current user
router.get('/except-me', protect, async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id }, isEmailVerified: true, status: { $ne: 'rejected' } }).select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get per-user, per-tab state
router.get('/user-tab-state/:tabKey', protect, async (req, res) => {
  try {
    const { tabKey } = req.params;
    validateTabKey(tabKey);
    const stateDoc = await UserTabState.findOne({ user: req.user._id, tabKey });
    res.json(stateDoc ? stateDoc.state : {});
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Set per-user, per-tab state
router.post('/user-tab-state/:tabKey', protect, async (req, res) => {
  try {
    const { tabKey } = req.params;
    validateTabKey(tabKey);
    const { state } = req.body;
    if (typeof state !== 'object') {
      return res.status(400).json({ message: 'State must be an object' });
    }
    
    // Get existing state to preserve taskOrder and groupOrder
    const existing = await UserTabState.findOne({ user: req.user._id, tabKey });
    
    // Merge new state with existing state, preserving taskOrder and groupOrder for each tab
    if (existing && existing.state && Array.isArray(existing.state.tabs) && Array.isArray(state.tabs)) {
      // Create a map of existing tabs by id for quick lookup
      const existingTabsMap = new Map();
      existing.state.tabs.forEach(tab => {
        if (tab.id) {
          existingTabsMap.set(tab.id, tab);
        }
      });
      
      // Merge each new tab with its existing counterpart to preserve taskOrder and groupOrder
      state.tabs = state.tabs.map(newTab => {
        const existingTab = existingTabsMap.get(newTab.id);
        if (existingTab) {
          // Preserve taskOrder and groupOrder from existing tab
          return {
            ...newTab,
            taskOrder: existingTab.taskOrder || newTab.taskOrder,
            groupOrder: existingTab.groupOrder || newTab.groupOrder
          };
        }
        return newTab;
      });
    }
    
    const updated = await UserTabState.findOneAndUpdate(
      { user: req.user._id, tabKey },
      { state },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json(updated.state);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH: Update task order for a tab (flat array, not per-group)
router.patch('/tabstate/taskOrder', protect, async (req, res) => {
  try {
    const { tabKey, order, tabId, groupOrder } = req.body;
    validateTabKey(tabKey);
    if (!tabKey || !Array.isArray(order)) {
      return res.status(400).json({ message: 'tabKey and order array are required' });
    }
    const userId = req.user.id;
    let userTabState = await UserTabState.findOne({ user: userId, tabKey });
    if (!userTabState) {
      return res.status(400).json({ message: 'Tab state must be initialized before updating taskOrder.' });
    }
    if (!userTabState.state) userTabState.state = {};
    
    // Ensure tabs array exists for all tab types now
    if (!Array.isArray(userTabState.state.tabs)) {
      userTabState.state.tabs = [];
    }
    
    // Find or create tab object
    let tabObj;
    if (tabId) {
      tabObj = userTabState.state.tabs.find(t => t.id == tabId);
      if (!tabObj) {
        tabObj = { id: tabId };
        userTabState.state.tabs.push(tabObj);
      }
    } else {
      if (userTabState.state.tabs.length === 0) {
        tabObj = { id: 'default' };
        userTabState.state.tabs.push(tabObj);
      } else {
        tabObj = userTabState.state.tabs[0];
      }
    }
    
    // Store taskOrder and groupOrder in the tab object
    tabObj.taskOrder = order;
    if (groupOrder && Array.isArray(groupOrder)) {
      tabObj.groupOrder = groupOrder;
    }
    userTabState.markModified('state.tabs');
    await userTabState.save();
    res.json({ success: true, state: userTabState.state });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update task order' });
  }
});

// PATCH: Update column order for a tab
router.patch('/tabstate/columnOrder', protect, async (req, res) => {
  try {
    const { tabKey, columnOrder, tabId } = req.body;
    validateTabKey(tabKey);
    if (!tabKey || !Array.isArray(columnOrder) || !tabId) {
      return res.status(400).json({ message: 'tabKey, tabId, and columnOrder array are required' });
    }
    const userId = req.user.id;
    let userTabState = await UserTabState.findOne({ user: userId, tabKey });
    if (!userTabState) {
      // Create new tab state if it doesn't exist
      userTabState = new UserTabState({
        user: userId,
        tabKey,
        state: {}
      });
    }
    if (!userTabState.state) userTabState.state = {};
    if (tabKey === 'billedTasks' || tabKey === 'unbilledTasks') {
      userTabState.state.columnOrder = columnOrder;
      // Remove tabs array if it exists
      if (userTabState.state.tabs) delete userTabState.state.tabs;
      userTabState.markModified('state.columnOrder');
    } else {
      // Initialize state if it doesn't exist
      if (!userTabState.state.tabs) userTabState.state.tabs = [];
      // Find the tab or create it if it doesn't exist
      const tabIndex = userTabState.state.tabs.findIndex(t => t.id === tabId);
      if (tabIndex >= 0) {
        // Update existing tab
        userTabState.state.tabs[tabIndex].columnOrder = columnOrder;
      } else {
        // Add new tab
        userTabState.state.tabs.push({ id: tabId, columnOrder });
      }
    }
    await userTabState.save();
    res.json({ success: true, columnOrder });
  } catch (err) {
    console.error('Error updating column order:', err);
    res.status(500).json({ message: err.message || 'Failed to update column order' });
  }
});

// GET: Get column order for a tab
router.get('/tabstate/columnOrder', protect, async (req, res) => {
  try {
    const { tabKey, tabId } = req.query;
    if (!tabKey) return res.status(400).json({ message: 'tabKey is required' });
    validateTabKey(tabKey);
    const userId = req.user.id;
    const userTabState = await UserTabState.findOne({ user: userId, tabKey });
    let columnOrder = null;
    if (userTabState?.state?.tabs && Array.isArray(userTabState.state.tabs) && userTabState.state.tabs.length > 0) {
      let tabObj;
      if (tabId) {
        tabObj = userTabState.state.tabs.find(t => t.id == tabId);
      }
      if (!tabObj) {
        tabObj = userTabState.state.tabs[0];
      }
      columnOrder = tabObj?.columnOrder || null;
    }
    res.json({ columnOrder });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get column order' });
  }
});

// GET: Get task order for a tab (flat array, not per-group)
router.get('/tabstate/taskOrder', protect, async (req, res) => {
  try {
    const { tabKey, tabId } = req.query;
    if (!tabKey) return res.status(400).json({ message: 'tabKey is required' });
    validateTabKey(tabKey);
    const userId = req.user.id;
    const userTabState = await UserTabState.findOne({ user: userId, tabKey });
    let taskOrder = null;
    let groupOrder = null;
    
    if (userTabState?.state?.tabs && Array.isArray(userTabState.state.tabs) && userTabState.state.tabs.length > 0) {
      let tabObj;
      if (tabId) {
        tabObj = userTabState.state.tabs.find(t => t.id == tabId);
      }
      if (!tabObj) {
        tabObj = userTabState.state.tabs[0];
      }
      if (tabObj && Array.isArray(tabObj.taskOrder)) {
        taskOrder = tabObj.taskOrder;
      }
      if (tabObj && Array.isArray(tabObj.groupOrder)) {
        groupOrder = tabObj.groupOrder;
      }
    } else if (userTabState?.state?.rowOrder) {
      // Legacy support for old rowOrder structure
      taskOrder = userTabState.state.rowOrder;
      if (userTabState?.state?.groupOrder) {
        groupOrder = userTabState.state.groupOrder;
      }
    }
    res.json({ taskOrder, groupOrder });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get task order' });
  }
});

// PATCH: Update group order for a tab
router.patch('/tabstate/groupOrder', protect, async (req, res) => {
  try {
    const { tabKey, groupOrder, tabId } = req.body;
    validateTabKey(tabKey);
    if (!tabKey || !Array.isArray(groupOrder)) {
      return res.status(400).json({ message: 'tabKey and groupOrder array are required' });
    }
    const userId = req.user.id;
    let userTabState = await UserTabState.findOne({ user: userId, tabKey });
    if (!userTabState) {
      return res.status(400).json({ message: 'Tab state must be initialized before updating groupOrder.' });
    }
    if (!userTabState.state) userTabState.state = {};
    
    // Ensure tabs array exists for all tab types now
    if (!Array.isArray(userTabState.state.tabs)) {
      userTabState.state.tabs = [];
    }
    
    // Find or create tab object
    let tabObj;
    if (tabId) {
      tabObj = userTabState.state.tabs.find(t => t.id == tabId);
      if (!tabObj) {
        tabObj = { id: tabId };
        userTabState.state.tabs.push(tabObj);
      }
    } else {
      if (userTabState.state.tabs.length === 0) {
        tabObj = { id: 'default' };
        userTabState.state.tabs.push(tabObj);
      } else {
        tabObj = userTabState.state.tabs[0];
      }
    }
    
    // Store groupOrder in the tab object
    tabObj.groupOrder = groupOrder;
    userTabState.markModified('state.tabs');
    await userTabState.save();
    res.json({ success: true, groupOrder: groupOrder });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to update group order' });
  }
});

// GET: Get group order for a tab
router.get('/tabstate/groupOrder', protect, async (req, res) => {
  try {
    const { tabKey, tabId } = req.query;
    if (!tabKey) return res.status(400).json({ message: 'tabKey is required' });
    validateTabKey(tabKey);
    const userId = req.user.id;
    const userTabState = await UserTabState.findOne({ user: userId, tabKey });
    let groupOrder = null;
    
    if (userTabState?.state?.tabs && Array.isArray(userTabState.state.tabs) && userTabState.state.tabs.length > 0) {
      let tabObj;
      if (tabId) {
        tabObj = userTabState.state.tabs.find(t => t.id == tabId);
      }
      if (!tabObj) {
        tabObj = userTabState.state.tabs[0];
      }
      if (tabObj && Array.isArray(tabObj.groupOrder)) {
        groupOrder = tabObj.groupOrder;
      }
    } else if (userTabState?.state?.groupOrder) {
      // Legacy support for old groupOrder structure
      groupOrder = userTabState.state.groupOrder;
    }
    res.json({ groupOrder });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to get group order' });
  }
});


export default router; 