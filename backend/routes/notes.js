import express from 'express';
import Note from '../models/Note.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get user's note
router.get('/', protect, async (req, res) => {
  try {
    const note = await Note.findOne({ userId: req.user._id });
    res.json({
      content: note ? note.content : ''
    });
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save/Update user's note
router.post('/', protect, async (req, res) => {
  try {
    const { content } = req.body;
    
    const note = await Note.findOneAndUpdate(
      { userId: req.user._id },
      { content },
      { upsert: true, new: true }
    );
    
    res.json({
      content: note.content,
      message: 'Note saved successfully'
    });
  } catch (error) {
    console.error('Error saving note:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;