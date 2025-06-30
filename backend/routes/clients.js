import express from 'express';
import Client from '../models/Client.js';
import ClientGroup from '../models/ClientGroup.js';
import WorkType from '../models/WorkType.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware to check if user has required role
const checkRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized to access this resource' });
    }
    next();
  };
};

// Get all clients
router.get('/', protect, async (req, res) => {
  try {
    const clients = await Client.find()
      .populate('group', 'name')
      .populate('workOffered', 'name')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.json(clients);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Create a client
router.post('/', protect, async (req, res) => {
  try {
    const { name, group, status, workOffered } = req.body;

    // Basic validation
    if (!name || !group || !status) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const newClient = new Client({
      name,
      group,
      status,
      workOffered,
      createdBy: req.user._id,
    });

    const client = await newClient.save();
    await client.populate('group', 'name');
    await client.populate('workOffered', 'name');
    res.json(client);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete a client
router.delete('/:id', protect, async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    
    if (!client) {
      return res.status(404).json({ msg: 'Client not found' });
    }

    // Check if user has permission to delete
    if (!['Admin', 'Head', 'Team Head'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Not authorized to delete clients' });
    }

    await client.deleteOne();
    res.json({ msg: 'Client removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Client not found' });
    }
    res.status(500).send('Server Error');
  }
});

// Get all client groups
router.get('/groups', protect, async (req, res) => {
  try {
    const groups = await ClientGroup.find().sort({ name: 1 });
    res.json(groups);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Create a client group
router.post('/groups', protect, async (req, res) => {
  try {
    const { name } = req.body;

    // Basic validation
    if (!name) {
      return res.status(400).json({ msg: 'Name is required' });
    }

    // Check if group already exists
    let group = await ClientGroup.findOne({ name });
    if (group) {
      return res.status(400).json({ msg: 'Group already exists' });
    }

    const newGroup = new ClientGroup({
      name,
      createdBy: req.user._id,
    });

    group = await newGroup.save();
    res.json(group);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Get all work types
router.get('/work-types', protect, async (req, res) => {
  try {
    const workTypes = await WorkType.find().sort({ name: 1 });
    res.json(workTypes);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Create a work type
router.post('/work-types', protect, async (req, res) => {
  try {
    const { name } = req.body;

    // Basic validation
    if (!name) {
      return res.status(400).json({ msg: 'Name is required' });
    }

    // Check if work type already exists
    let workType = await WorkType.findOne({ name });
    if (workType) {
      return res.status(400).json({ msg: 'Work type already exists' });
    }

    const newWorkType = new WorkType({
      name,
      createdBy: req.user._id,
    });

    workType = await newWorkType.save();
    res.json(workType);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

export default router; 