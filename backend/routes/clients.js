import express from 'express';
import Client from '../models/Client.js';
import ClientGroup from '../models/ClientGroup.js';
import WorkType from '../models/WorkType.js';
import { protect } from '../middleware/authMiddleware.js';
import ActivityLogger from '../utils/activityLogger.js';

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
router.post('/', protect, checkRole(['Admin', 'Team Head']), async (req, res) => {
  try {
    const { name, group, status, workOffered, priority } = req.body;

    // Basic validation
    if (!name || !group || !status || !priority) {
      return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    const newClient = new Client({
      name,
      group,
      status,
      workOffered,
      priority,
      createdBy: req.user._id,
    });

    const client = await newClient.save();
    await client.populate('group', 'name');
    await client.populate('workOffered', 'name');
    
    // Log client creation
    await ActivityLogger.logClientActivity(
      req.user._id,
      'client_created',
// Update a client
client._id,
`Created client "${name}"`,
null,
{ 
        name, 
        group: client.group?.name, 
        status, 
        priority,
        workOffered: client.workOffered?.map(w => w.name)
      },
      req
    );
    
    res.json(client);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});
router.put('/:id', protect, checkRole(['Admin', 'Team Head', 'Senior']), async (req, res) => {
  try {
    const { name, group, status, workOffered, priority } = req.body;
    const client = await Client.findById(req.params.id);
    if (!client) {
      return res.status(404).json({ msg: 'Client not found' });
    }
    // Update fields
    client.name = name ?? client.name;
    client.group = group ?? client.group;
    client.status = status ?? client.status;
    client.workOffered = workOffered ?? client.workOffered;
    client.priority = priority ?? client.priority;
    await client.save();
    await client.populate('group', 'name');
    await client.populate('workOffered', 'name');
    // Log client update
    await ActivityLogger.logClientActivity(
      req.user._id,
      'client_updated',
      client._id,
      `Updated client "${client.name}"`,
      null,
      {
        name: client.name,
        group: client.group?.name,
        status: client.status,
        priority: client.priority,
        workOffered: client.workOffered?.map(w => w.name)
      },
      req
    );
    res.json(client);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Client not found' });
    }
    res.status(500).send('Server Error');
  }
});

// Delete a client
router.delete('/:id', protect, async (req, res) => {
  try {
    consol
    const client = await Client.findById(req.params.id)
      .populate('group', 'name')
      .populate('workOffered', 'name');
    
    if (!client) {
      return res.status(404).json({ msg: 'Client not found' });
    }

    // Check if user has permission to delete
    if (!['Admin', 'Senior', 'Team Head'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Not authorized to delete clients' });
    }

    // Log client deletion before deleting
    await ActivityLogger.logClientActivity(
      req.user._id,
      'client_deleted',
      client._id,
      `Deleted client "${client.name}"`,
      { 
        name: client.name, 
        group: client.group?.name, 
        status: client.status,
        priority: client.priority 
      },
      null,
      req
    );

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
router.post('/groups', protect, checkRole(['Admin', 'Team Head']), async (req, res) => {
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
    
    // Log client group creation
    await ActivityLogger.logClientActivity(
      req.user._id,
      'client_group_created',
      group._id,
      `Created client group "${name}"`,
      null,
      { name },
      req
    );
    
    res.json(group);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// Delete a client group
router.delete('/groups/:id', protect, async (req, res) => {
  try {
    const group = await ClientGroup.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ msg: 'Client group not found' });
    }
    // Check if user has permission to delete
    if (!['Admin', 'Senior', 'Team Head'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Not authorized to delete client groups' });
    }
    
    // Log client group deletion before deleting
    await ActivityLogger.logClientActivity(
      req.user._id,
      'client_group_deleted',
      group._id,
      `Deleted client group "${group.name}" and all its clients`,
      { name: group.name },
      null,
      req
    );
    
    // Delete all clients in this group
    await Client.deleteMany({ group: group._id });
    // Delete the group itself
    await group.deleteOne();
    res.json({ msg: 'Client group and all its clients removed' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Client group not found' });
    }
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
router.post('/work-types', protect, checkRole(['Admin', 'Team Head']), async (req, res) => {
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
    
    // Log work type creation
    await ActivityLogger.logClientActivity(
      req.user._id,
      'work_type_created',
      workType._id,
      `Created work type "${name}"`,
      null,
      { name },
      req
    );
    
    res.json(workType);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

export default router; 