import express from 'express';
import TutorialGroup from '../models/TutorialGroup.js';
import Tutorial from '../models/Tutorial.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper function to check if user can manage tutorials (Admin or Team Head)
const canManageTutorials = (user) => {
  return user.role === 'Admin' || user.role === 'Team Head';
};

// Get all tutorial groups with their tutorials
router.get('/groups', protect, async (req, res) => {
  try {
    const groups = await TutorialGroup.find()
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    // Get tutorials for each group
    const groupsWithTutorials = await Promise.all(
      groups.map(async (group) => {
        const tutorials = await Tutorial.find({ group: group._id })
          .populate('createdBy', 'firstName lastName')
          .sort({ createdAt: -1 });
        return {
          ...group.toObject(),
          tutorials
        };
      })
    );

    res.json(groupsWithTutorials);
  } catch (error) {
    console.error('Error fetching tutorial groups:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create a new tutorial group (Admin/Team Head only)
router.post('/groups', protect, async (req, res) => {
  try {
    if (!canManageTutorials(req.user)) {
      return res.status(403).json({ msg: 'Access denied. Only Admin and Team Head can manage tutorial groups.' });
    }

    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ msg: 'Group name is required' });
    }

    // Check if group name already exists
    const existingGroup = await TutorialGroup.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } 
    });
    
    if (existingGroup) {
      return res.status(400).json({ msg: 'Tutorial group with this name already exists' });
    }

    const tutorialGroup = new TutorialGroup({
      name: name.trim(),
      createdBy: req.user.id
    });

    await tutorialGroup.save();
    await tutorialGroup.populate('createdBy', 'firstName lastName');

    res.status(201).json(tutorialGroup);
  } catch (error) {
    console.error('Error creating tutorial group:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update a tutorial group (Admin/Team Head only)
router.put('/groups/:id', protect, async (req, res) => {
  try {
    if (!canManageTutorials(req.user)) {
      return res.status(403).json({ msg: 'Access denied. Only Admin and Team Head can manage tutorial groups.' });
    }

    const { name } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ msg: 'Group name is required' });
    }

    // Check if group name already exists (excluding current group)
    const existingGroup = await TutorialGroup.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: req.params.id }
    });
    
    if (existingGroup) {
      return res.status(400).json({ msg: 'Tutorial group with this name already exists' });
    }

    const tutorialGroup = await TutorialGroup.findByIdAndUpdate(
      req.params.id,
      { 
        name: name.trim(),
        updatedBy: req.user.id
      },
      { new: true }
    ).populate('createdBy updatedBy', 'firstName lastName');

    if (!tutorialGroup) {
      return res.status(404).json({ msg: 'Tutorial group not found' });
    }

    res.json(tutorialGroup);
  } catch (error) {
    console.error('Error updating tutorial group:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete a tutorial group (Admin/Team Head only)
router.delete('/groups/:id', protect, async (req, res) => {
  try {
    if (!canManageTutorials(req.user)) {
      return res.status(403).json({ msg: 'Access denied. Only Admin and Team Head can manage tutorial groups.' });
    }

    const tutorialGroup = await TutorialGroup.findById(req.params.id);
    if (!tutorialGroup) {
      return res.status(404).json({ msg: 'Tutorial group not found' });
    }

    // Delete all tutorials in this group
    await Tutorial.deleteMany({ group: req.params.id });
    
    // Delete the group
    await TutorialGroup.findByIdAndDelete(req.params.id);

    res.json({ msg: 'Tutorial group and all its tutorials deleted successfully' });
  } catch (error) {
    console.error('Error deleting tutorial group:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all tutorials
router.get('/', protect, async (req, res) => {
  try {
    const tutorials = await Tutorial.find()
      .populate('group', 'name')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json(tutorials);
  } catch (error) {
    console.error('Error fetching tutorials:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Create a new tutorial (Admin/Team Head only)
router.post('/', protect, async (req, res) => {
  try {
    if (!canManageTutorials(req.user)) {
      return res.status(403).json({ msg: 'Access denied. Only Admin and Team Head can manage tutorials.' });
    }

    const { title, youtubeUrl, group } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ msg: 'Tutorial title is required' });
    }
    
    if (!youtubeUrl || youtubeUrl.trim() === '') {
      return res.status(400).json({ msg: 'YouTube URL is required' });
    }
    
    if (!group) {
      return res.status(400).json({ msg: 'Tutorial group is required' });
    }

    // Check if group exists
    const tutorialGroup = await TutorialGroup.findById(group);
    if (!tutorialGroup) {
      return res.status(400).json({ msg: 'Invalid tutorial group' });
    }

    const tutorial = new Tutorial({
      title: title.trim(),
      youtubeUrl: youtubeUrl.trim(),
      group,
      createdBy: req.user.id
    });

    await tutorial.save();
    await tutorial.populate('group createdBy', 'name firstName lastName');

    res.status(201).json(tutorial);
  } catch (error) {
    console.error('Error creating tutorial:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// Update a tutorial (Admin/Team Head only)
router.put('/:id', protect, async (req, res) => {
  try {
    if (!canManageTutorials(req.user)) {
      return res.status(403).json({ msg: 'Access denied. Only Admin and Team Head can manage tutorials.' });
    }

    const { title, youtubeUrl, group } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ msg: 'Tutorial title is required' });
    }
    
    if (!youtubeUrl || youtubeUrl.trim() === '') {
      return res.status(400).json({ msg: 'YouTube URL is required' });
    }
    
    if (!group) {
      return res.status(400).json({ msg: 'Tutorial group is required' });
    }

    // Check if group exists
    const tutorialGroup = await TutorialGroup.findById(group);
    if (!tutorialGroup) {
      return res.status(400).json({ msg: 'Invalid tutorial group' });
    }

    const tutorial = await Tutorial.findByIdAndUpdate(
      req.params.id,
      { 
        title: title.trim(),
        youtubeUrl: youtubeUrl.trim(),
        group,
        updatedBy: req.user.id
      },
      { new: true, runValidators: true }
    ).populate('group createdBy updatedBy', 'name firstName lastName');

    if (!tutorial) {
      return res.status(404).json({ msg: 'Tutorial not found' });
    }

    res.json(tutorial);
  } catch (error) {
    console.error('Error updating tutorial:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ msg: error.message });
    }
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delete a tutorial (Admin/Team Head only)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!canManageTutorials(req.user)) {
      return res.status(403).json({ msg: 'Access denied. Only Admin and Team Head can manage tutorials.' });
    }

    const tutorial = await Tutorial.findByIdAndDelete(req.params.id);
    if (!tutorial) {
      return res.status(404).json({ msg: 'Tutorial not found' });
    }

    res.json({ msg: 'Tutorial deleted successfully' });
  } catch (error) {
    console.error('Error deleting tutorial:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

export default router;