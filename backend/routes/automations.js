import express from 'express';
import Automation from '../models/Automation.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import { runAutomationCheck, resetMonthlyAutomationStatus } from '../automationScheduler.js';

const router = express.Router();

// Get all automations for the logged-in user (admin can see all)
router.get('/', protect, async (req, res) => {
  try {
    const query = req.user.role === 'Admin' ? {} : { createdBy: req.user._id };
    const automations = await Automation.find(query).sort({ createdAt: -1 });
    res.json(automations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch automations' });
  }
});

// Create a new automation
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, triggerType, dayOfMonth, specificDate, specificTime } = req.body;
    
    if (!name || !triggerType) return res.status(400).json({ message: 'Name and triggerType are required' });
    
    // Validate based on trigger type
    if (triggerType === 'dayOfMonth' && !dayOfMonth) {
      return res.status(400).json({ message: 'dayOfMonth is required for dayOfMonth trigger type' });
    }
    
    if (triggerType === 'dateAndTime' && (!specificDate || !specificTime)) {
      return res.status(400).json({ message: 'specificDate and specificTime are required for dateAndTime trigger type' });
    }
    
    const automation = new Automation({
      name,
      description,
      triggerType,
      dayOfMonth: triggerType === 'dayOfMonth' ? dayOfMonth : undefined,
      specificDate: triggerType === 'dateAndTime' ? specificDate : undefined,
      specificTime: triggerType === 'dateAndTime' ? specificTime : undefined,
      createdBy: req.user._id,
    });
    
    await automation.save();
    res.json(automation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create automation', error: err.message });
  }
});

// Get a specific automation by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id);
    if (!automation) return res.status(404).json({ message: 'Automation not found' });
    res.json(automation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch automation' });
  }
});

// Update an automation by ID
router.put('/:id', protect, async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id);
    if (!automation) return res.status(404).json({ message: 'Automation not found' });
    
    // Only allow updating certain fields
    const { name, description, triggerType, dayOfMonth, specificDate, specificTime, taskTemplate } = req.body;
    
    if (name !== undefined) automation.name = name;
    if (description !== undefined) automation.description = description;
    if (triggerType !== undefined) automation.triggerType = triggerType;
    
    // Update trigger-specific fields based on trigger type
    if (triggerType === 'dayOfMonth' && dayOfMonth !== undefined) {
      automation.dayOfMonth = dayOfMonth;
      // Clear date and time fields if changing to dayOfMonth
      automation.specificDate = undefined;
      automation.specificTime = undefined;
    } else if (triggerType === 'dateAndTime') {
      if (specificDate !== undefined) automation.specificDate = specificDate;
      if (specificTime !== undefined) automation.specificTime = specificTime;
      // Clear dayOfMonth field if changing to dateAndTime
      automation.dayOfMonth = undefined;
    } else if (dayOfMonth !== undefined && automation.triggerType === 'dayOfMonth') {
      // If not changing trigger type but updating dayOfMonth
      automation.dayOfMonth = dayOfMonth;
    }
    
    if (taskTemplate !== undefined) automation.taskTemplate = taskTemplate;
    
    await automation.save();
    res.json(automation);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update automation', error: err.message });
  }
});

// Get tasks for a specific automation
router.get('/:id/tasks', protect, async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id).populate({
      path: 'tasks',
      options: { sort: { createdAt: -1 } },
    });
    if (!automation) return res.status(404).json({ message: 'Automation not found' });
    res.json(automation.tasks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch automation tasks' });
  }
});

// Add a task to an automation
router.post('/:id/tasks', protect, async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id);
    if (!automation) return res.status(404).json({ message: 'Automation not found' });

    // Save task template data to automation, not as real tasks
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

    // Validate required fields
    const errors = {};
    if (!title) errors.title = 'Title is required';
    if (!clientName) errors.clientName = 'Client Name is required';
    if (!clientGroup) errors.clientGroup = 'Client Group is required';
    if (!workType || !Array.isArray(workType) || workType.length === 0) errors.workType = 'Work Type is required';
    if (!assignedTo || (Array.isArray(assignedTo) && assignedTo.length === 0)) errors.assignedTo = 'Assigned To is required';
    if (!priority) errors.priority = 'Priority is required';
    if (!inwardEntryDate) errors.inwardEntryDate = 'Inward Entry Date is required';
    const validWorkDoneBy = ['First floor', 'Second floor', 'Both'];
    if (!workDoneBy || !validWorkDoneBy.includes(workDoneBy)) {
      errors.workDoneBy = 'workDoneBy is required and must be one of: First floor, Second floor, Both';
    }
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation error', errors });
    }

    // Create a new task template object
    const newTaskTemplate = {
      title,
      description,
      clientName,
      clientGroup,
      workType: Array.isArray(workType) ? workType : [],
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [assignedTo].filter(Boolean),
      priority,
      inwardEntryDate,
      inwardEntryTime,
      dueDate,
      targetDate,
      verificationAssignedTo,
      billed: billed !== undefined ? billed : false,
      workDoneBy
    };

    try {
      // Initialize taskTemplate array if it doesn't exist
      if (!automation.taskTemplate || !Array.isArray(automation.taskTemplate)) {
        automation.taskTemplate = [];
      }
      
      // Add the new task template to the array
      automation.taskTemplate.push(newTaskTemplate);
      
      await automation.save();
      return res.status(200).json({ 
        message: 'Automation task template saved successfully', 
        taskTemplate: newTaskTemplate,
        allTemplates: automation.taskTemplate 
      });
    } catch (error) {
      console.error('Error saving automation task template:', error);
      return res.status(500).json({ message: 'Error saving automation task template', error: error.message });
    }
  } catch (err) {
    res.status(500).json({ message: 'Failed to save automation task template', error: err.message });
  }
});

// Route to manually trigger overdue automations (admin only)
router.post('/check-trigger', protect, async (req, res) => {
  try {
    // Only admins can trigger this manually
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized, admin access required' });
    }
    
    // Call the automation check function
    const result = await runAutomationCheck();
    
    if (result.success) {
      return res.status(200).json({ 
        message: `Successfully processed ${result.processedCount} overdue automations`,
        processedCount: result.processedCount
      });
    } else {
      return res.status(500).json({ 
        message: 'Error processing automations',
        error: result.error
      });
    }
  } catch (err) {
    console.error('Error triggering automation check:', err);
    res.status(500).json({ message: 'Failed to trigger automation check', error: err.message });
  }
});

// Reset monthly automation status (admin only)
router.post('/reset-monthly-status', protect, async (req, res) => {
  try {
    // Only admins can reset automation status
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized, admin access required' });
    }
    
    const { automationId } = req.body;
    
    // Call the reset function
    const result = await resetMonthlyAutomationStatus(automationId);
    
    if (result.success) {
      return res.status(200).json({ 
        message: `Successfully reset ${result.modifiedCount} monthly automations`,
        modifiedCount: result.modifiedCount
      });
    } else {
      return res.status(500).json({ 
        message: 'Error resetting automation status',
        error: result.error
      });
    }
  } catch (err) {
    console.error('Error resetting monthly automation status:', err);
    res.status(500).json({ message: 'Failed to reset automation status', error: err.message });
  }
});

export default router;
