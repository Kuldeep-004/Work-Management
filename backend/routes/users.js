import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';
import jwt from 'jsonwebtoken';
import Team from '../models/Team.js';
import { uploadMiddleware } from '../middleware/uploadMiddleware.js';
import { uploadImage, deleteImage } from '../utils/cloudinary.js';
import fs from 'fs';
import { promisify } from 'util';

const unlinkAsync = promisify(fs.unlink);
const router = express.Router();

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
        // Delete old image from cloudinary if exists
        if (user.photo && user.photo.public_id) {
          await deleteImage(user.photo.public_id);
        }

        // Upload new image to cloudinary
        const result = await uploadImage(req.file.path);
        user.photo = {
          public_id: result.public_id,
          url: result.url
        };

        // Delete the local file
        try {
          await unlinkAsync(req.file.path);
        } catch (unlinkError) {
          console.error('Error deleting local file:', unlinkError);
          // Continue execution even if file deletion fails
        }
      } catch (error) {
        // Clean up the uploaded file
        if (req.file && req.file.path) {
          try {
            await unlinkAsync(req.file.path);
          } catch (unlinkError) {
            console.error('Error deleting local file:', unlinkError);
          }
        }

        // Handle specific errors
        if (error.message?.includes('time synchronization')) {
          return res.status(400).json({ 
            message: 'Upload failed due to server time mismatch. Please try again.',
            error: 'TIME_SYNC_ERROR'
          });
        }

        console.error('Error handling photo upload:', error);
        return res.status(500).json({ 
          message: error.message || 'Error uploading image to cloud storage'
        });
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
    console.error('Profile update error:', error);
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
    console.error('Team assignment error:', error);
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
      if (!['Fresher', 'Team Head', 'Head'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      // For Head role, set team to null
      if (role === 'Head') {
        user.team = null;
      } else {
        // For non-Head roles, require team
        if (!team) {
          return res.status(400).json({ message: 'Team is required for non-Head roles' });
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
      // If role is Head, remove team
      if (role === 'Head') {
        updatedFields.team = null;
      }
    }

    // Handle team update
    if (team !== undefined) {
      if (user.role === 'Head') {
        return res.status(400).json({ message: 'Head role cannot be assigned to a team' });
      }
      updatedFields.team = team;
    }

    // Handle role2 update
    if (role2) {
      updatedFields.role2 = role2;
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
    console.error('Error updating user fields:', error);
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
    // Exclude self and blocked users (status: 'rejected')
    const users = await User.find({ _id: { $ne: req.user.id }, status: { $ne: 'rejected' } }).select('firstName lastName email role hourlyRate status');
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

export default router; 