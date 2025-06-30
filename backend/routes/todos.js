import express from 'express';
import Todo from '../models/Todo.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all todos for the logged-in user
router.get('/', protect, async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json(todos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new todo
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;

    const todo = new Todo({
      title,
      description,
      priority,
      dueDate,
      user: req.user._id,
      status: 'pending'
    });

    await todo.save();
    res.status(201).json(todo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a todo
router.patch('/:id', protect, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    const { title, description, priority, dueDate, status } = req.body;
    
    if (title) todo.title = title;
    if (description) todo.description = description;
    if (priority) todo.priority = priority;
    if (dueDate) todo.dueDate = dueDate;
    if (status) todo.status = status;

    await todo.save();
    res.json(todo);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a todo
router.delete('/:id', protect, async (req, res) => {
  try {
    const todo = await Todo.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }

    await todo.deleteOne();
    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router; 