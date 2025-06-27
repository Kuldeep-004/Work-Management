import express from 'express';
import Team from '../models/Team.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware to check if user is Admin
const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized as Admin' });
    }
    next();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new team (Admin only)
router.post('/', protect, isAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    const team = new Team({
      name,
      description,
      createdBy: req.user.id
    });
    await team.save();
    res.status(201).json(team);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all teams
router.get('/', protect, async (req, res) => {
  try {
    const teams = await Team.find()
      .populate('members', 'firstName lastName email');
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get a single team
router.get('/:id', protect, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('members', 'firstName lastName email');
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    res.json(team);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a team (Admin only)
router.put('/:id', protect, isAdmin, async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const team = await Team.findById(req.params.id);
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    if (name) team.name = name;
    if (description) team.description = description;
    if (members) team.members = members;

    await team.save();
    res.json(team);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a team (Admin only)
router.delete('/:id', protect, isAdmin, async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    // Delete the team
    await Team.findByIdAndDelete(req.params.id);
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add member to team (Admin only)
router.post('/:id/members', protect, isAdmin, async (req, res) => {
  try {
    const { userId } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update user's team
    user.team = team._id;
    await user.save();

    res.json({ message: 'User added to team successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Remove member from team (Admin only)
router.delete('/:id/members/:userId', protect, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Remove user's team assignment
    user.team = null;
    await user.save();

    res.json({ message: 'User removed from team successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 