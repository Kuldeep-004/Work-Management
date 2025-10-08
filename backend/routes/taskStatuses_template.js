import express from 'express';
import Automation from '../models/Automation.js';
import Task from '../models/Task.js';
import { protect } from '../middleware/authMiddleware.js';
import { runAutomationCheck, resetMonthlyAutomationStatus } from '../automationScheduler.js';
import ActivityLogger from '../utils/activityLogger.js';

const router = express.Router();

// Get all automations (shared among all users)
router.get('/', protect, async (req, res) => {
  try {
    const automations = await Automation.find({}).sort({ createdAt: -1 });
    res.json(automations);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch automations' });
  }
});

// Get automation templates pending verification (MUST be before /:id route)
router.get('/templates/pending', protect, async (req, res) => {
  try {
    // Only admins and task verifiers can see pending templates
    const isAdmin = req.user.role === 'Admin';
    const isTaskVerifier = Array.isArray(req.user.role2) 
      ? req.user.role2.includes('Task Verifier')
      : req.user.role2 === 'Task Verifier';
    
    if (!isAdmin && !isTaskVerifier) {
      return res.status(403).json({ message: 'Access denied. Admin or Task Verifier role required.' });
    }

    // Find all automations that have task templates with verificationStatus: 'pending'
    const automations = await Automation.find({
      'taskTemplate.verificationStatus': 'pending'
    })
    .populate('createdBy', 'firstName lastName profilePicture')
    .sort({ createdAt: -1 });

    // Filter to only return automations with pending task templates
    const pendingAutomations = automations.map(automation => ({
      ...automation.toObject(),
      taskTemplate: automation.taskTemplate.filter(template => template.verificationStatus === 'pending')
    })).filter(automation => automation.taskTemplate.length > 0);

    console.log('Found pending automation templates:', pendingAutomations.length);
    res.json(pendingAutomations);
  } catch (err) {
    console.error('Error fetching pending automation templates:', err);
    res.status(500).json({ message: 'Failed to fetch pending automation templates', error: err.message });
  }
});

// Create a new automation
router.post('/', protect, async (req, res) => {
  try {
    const { name, description, triggerType, dayOfMonth, specificDate, specificTime, quarterlyMonths, halfYearlyMonths } = req.body;
    
    if (!name || !triggerType) return res.status(400).json({ message: 'Name and triggerType are required' });
    
    // Validate based on trigger type
    if (triggerType === 'dayOfMonth' && !dayOfMonth) {
      return res.status(400).json({ message: 'dayOfMonth is required for dayOfMonth trigger type' });
    }
    
    if (triggerType === 'dateAndTime' && (!specificDate || !specificTime)) {
      return res.status(400).json({ message: 'specificDate and specificTime are required for dateAndTime trigger type' });
    }
    
    // Monthly or yearly-based recurrences
    if (['quarterly', 'halfYearly', 'yearly'].includes(triggerType) && !dayOfMonth) {
      return res.status(400).json({ message: `dayOfMonth is required for ${triggerType} trigger type` });
    }
    
    const { monthOfYear } = req.body;
    
    const automation = new Automation({
      name,
      description,
      triggerType,
      dayOfMonth: ['dayOfMonth', 'quarterly', 'halfYearly', 'yearly'].includes(triggerType) ? dayOfMonth : undefined,
      monthOfYear: triggerType === 'yearly' ? monthOfYear : undefined,
      quarterlyMonths: triggerType === 'quarterly' ? quarterlyMonths : undefined,
      halfYearlyMonths: triggerType === 'halfYearly' ? halfYearlyMonths : undefined,
      specificDate: triggerType === 'dateAndTime' ? specificDate : undefined,
      specificTime: triggerType === 'dateAndTime' ? specificTime : undefined,
      createdBy: req.user._id,
    });
    
    await automation.save();
    
    // Log automation creation
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'automation_created',
      automation._id,
      `Created automation "${name}" with trigger type "${triggerType}"`,
      null,
      { 
        name, 
        triggerType, 
        dayOfMonth, 
        specificDate, 
        specificTime,
        quarterlyMonths,
        halfYearlyMonths
      },
      req
    );
    
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
    const { name, description, triggerType, dayOfMonth, monthOfYear, specificDate, specificTime, taskTemplate, quarterlyMonths, halfYearlyMonths } = req.body;
    
    if (name !== undefined) automation.name = name;
    if (description !== undefined) automation.description = description;
    if (triggerType !== undefined) automation.triggerType = triggerType;
    
    // Update trigger-specific fields based on trigger type
    if (['dayOfMonth', 'quarterly', 'halfYearly', 'yearly'].includes(triggerType || automation.triggerType)) {
      if (dayOfMonth !== undefined) automation.dayOfMonth = dayOfMonth;
      
      // Set monthOfYear for yearly type only
      if (triggerType === 'yearly' || automation.triggerType === 'yearly') {
        if (monthOfYear !== undefined) automation.monthOfYear = monthOfYear;
      }
      
      // Set quarterlyMonths for quarterly type
      if (triggerType === 'quarterly' || automation.triggerType === 'quarterly') {
        if (quarterlyMonths !== undefined) automation.quarterlyMonths = quarterlyMonths;
      }
      
      // Set halfYearlyMonths for halfYearly type
      if (triggerType === 'halfYearly' || automation.triggerType === 'halfYearly') {
        if (halfYearlyMonths !== undefined) automation.halfYearlyMonths = halfYearlyMonths;
      }
      
      // Clear date and time fields when changing to a time-based type
      if (triggerType && ['dayOfMonth', 'quarterly', 'halfYearly', 'yearly'].includes(triggerType)) {
        automation.specificDate = undefined;
        automation.specificTime = undefined;
      }
    } else if (triggerType === 'dateAndTime' || automation.triggerType === 'dateAndTime') {
      if (specificDate !== undefined) automation.specificDate = specificDate;
      if (specificTime !== undefined) automation.specificTime = specificTime;
      
      // Clear dayOfMonth and monthOfYear when changing to dateAndTime type
      if (triggerType === 'dateAndTime') {
        automation.dayOfMonth = undefined;
        automation.monthOfYear = undefined;
        automation.quarterlyMonths = undefined;
        automation.halfYearlyMonths = undefined;
      }
    }
    
    if (taskTemplate !== undefined) automation.taskTemplate = taskTemplate;
    
    // Store old values for logging
    const oldValues = {
      name: automation.name,
      description: automation.description,
      triggerType: automation.triggerType,
      dayOfMonth: automation.dayOfMonth,
      monthOfYear: automation.monthOfYear,
      specificDate: automation.specificDate,
      specificTime: automation.specificTime
    };
    
    await automation.save();
    
    // Log automation update
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'automation_updated',
      automation._id,
      `Updated automation "${automation.name}"`,
      oldValues,
      { 
        name, 
        description, 
        triggerType, 
        dayOfMonth, 
        monthOfYear, 
        specificDate, 
        specificTime 
      },
      req
    );
    
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
    // Exclude verification-related fields (verifiers, guides, comments)
    const {
      title,
      description,
      clientName,
      clientGroup,
      workType,
      assignedTo,
      assignedBy, // Add assignedBy field
      priority,
      inwardEntryDate,
      inwardEntryTime,
      dueDate,
      targetDate,
      billed
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
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: 'Validation error', errors });
    }

    // Create a new task template object
    // Exclude verification-related fields (verifiers, guides, comments)
    const newTaskTemplate = {
      title,
      description,
      clientName,
      clientGroup,
      workType: Array.isArray(workType) ? workType : [],
      assignedTo: Array.isArray(assignedTo) ? assignedTo : [assignedTo].filter(Boolean),
      assignedBy, // Preserve original assignedBy
      priority,
      inwardEntryDate,
      inwardEntryTime,
      dueDate,
      targetDate,
      billed: billed !== undefined ? billed : false,
      verificationStatus: 'pending' // Explicitly set pending status for approval
      // Deliberately excluding verification fields:
      // - verificationAssignedTo, secondVerificationAssignedTo, etc.
      // - comments, files arrays
      // - guides and other verification-related fields
    };

    try {
      // Initialize taskTemplate array if it doesn't exist
      if (!automation.taskTemplate || !Array.isArray(automation.taskTemplate)) {
        automation.taskTemplate = [];
      }
      
      // Add the new task template to the array
      automation.taskTemplate.push(newTaskTemplate);
      
      await automation.save();
      
      // Log task template addition
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'automation_task_template_added',
        automation._id,
        `Added task template "${title}" to automation "${automation.name}"`,
        null,
        { title, clientName, priority, assignedTo },
        req
      );
      
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
    
    // Log automation trigger
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'automation_triggered',
      null,
      `Manually triggered automation check - processed ${result.processedCount || 0} automations`,
      null,
      { processedCount: result.processedCount, success: result.success },
      req
    );
    
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
    
    // Log automation status reset
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'automation_status_reset',
      automationId,
      `Reset monthly automation status${automationId ? ` for automation ${automationId}` : ' for all automations'}`,
      null,
      { automationId, modifiedCount: result.modifiedCount },
      req
    );
    
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

// Get automation templates pending for verification
router.get('/templates/for-verification', protect, async (req, res) => {
  try {
    let isTaskVerifier = false;
    if (Array.isArray(req.user.role2)) {
      isTaskVerifier = req.user.role2.includes('Task Verifier');
    } else {
      isTaskVerifier = req.user.role2 === 'Task Verifier';
    }
    
    if (req.user.role !== 'Admin' && !isTaskVerifier) {
      return res.status(403).json({ message: 'Not authorized to verify automation templates' });
    }

    // Get all automations with pending task templates
    const automations = await Automation.find({
      'taskTemplate.verificationStatus': 'pending'
    })
    .populate('createdBy', 'firstName lastName photo')
    .populate('taskTemplate.assignedTo', 'firstName lastName photo')
    .populate('taskTemplate.verificationAssignedTo', 'firstName lastName photo')
    .sort({ createdAt: -1 });

    // Extract only pending templates with automation info
    const pendingTemplates = [];
    for (const automation of automations) {
      for (const template of automation.taskTemplate) {
        if (template.verificationStatus === 'pending') {
          pendingTemplates.push({
            _id: template._id,
            automationId: automation._id,
            automationName: automation.name,
            automationDescription: automation.description,
            createdBy: automation.createdBy,
            createdAt: automation.createdAt,
            title: template.title,
            description: template.description,
            clientName: template.clientName,
            clientGroup: template.clientGroup,
            workType: template.workType,
            assignedTo: template.assignedTo,
            priority: template.priority,
            inwardEntryDate: template.inwardEntryDate,
            inwardEntryTime: template.inwardEntryTime,
            dueDate: template.dueDate,
            targetDate: template.targetDate,
            verificationAssignedTo: template.verificationAssignedTo,
            billed: template.billed,
            verificationStatus: template.verificationStatus,
            files: template.files
          });
        }
      }
    }

    res.json(pendingTemplates);
  } catch (error) {
    console.error('Error fetching automation templates for verification:', error);
    res.status(500).json({ message: error.message });
  }
});

// Verify automation template (approve or reject)
router.post('/templates/:templateId/verify', protect, async (req, res) => {
  try {
    let isTaskVerifier = false;
    if (Array.isArray(req.user.role2)) {
      isTaskVerifier = req.user.role2.includes('Task Verifier');
    } else {
      isTaskVerifier = req.user.role2 === 'Task Verifier';
    }
    
    if (req.user.role !== 'Admin' && !isTaskVerifier) {
      return res.status(403).json({ message: 'Not authorized to verify automation templates' });
    }

    const { action, comments } = req.body; // action can be 'approve' or 'reject'
    const templateId = req.params.templateId;

    // Find the automation containing this template
    const automation = await Automation.findOne({
      'taskTemplate._id': templateId
    });

    if (!automation) {
      return res.status(404).json({ message: 'Automation template not found' });
    }

    // Find the specific template
    const template = automation.taskTemplate.id(templateId);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (action === 'approve') {
      template.verificationStatus = 'completed';
      await automation.save();

      // Log template approval activity
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'automation_template_approved',
        automation._id,
        `Approved automation template "${template.title}" for automation "${automation.name}"`,
        { verificationStatus: 'pending' },
        { verificationStatus: 'completed', verificationComments: comments },
        req,
        {
          templateTitle: template.title,
          automationName: automation.name,
          clientName: template.clientName
        }
      );

      return res.json({ message: 'Automation template approved successfully' });
    } else if (action === 'reject') {
      // Log template rejection before removal
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'automation_template_rejected',
        automation._id,
        `Rejected and removed automation template "${template.title}" from automation "${automation.name}"`,
        { verificationStatus: 'pending' },
        { verificationStatus: 'rejected', verificationComments: comments },
        req,
        {
          templateTitle: template.title,
          automationName: automation.name,
          clientName: template.clientName,
          reason: comments
        }
      );

      // Remove the template from the automation
      automation.taskTemplate.id(templateId).remove();
      await automation.save();

      return res.json({ message: 'Automation template rejected and removed successfully' });
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error verifying automation template:', error);
    res.status(500).json({ message: error.message });
  }
});

// Delete an automation
router.delete('/:id', protect, async (req, res) => {
  try {
    const automation = await Automation.findById(req.params.id);
    
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }
    
    // Since automations are now shared, any authenticated user can delete them
    
    // Log automation deletion before deleting
    await ActivityLogger.logSystemActivity(
      req.user._id,
      'automation_deleted',
      automation._id,
      `Deleted automation "${automation.name}"`,
      { 
        name: automation.name, 
        triggerType: automation.triggerType,
        taskTemplateCount: automation.taskTemplate?.length || 0
      },
      null,
      req
    );
    
    // Delete the automation
    await Automation.findByIdAndDelete(req.params.id);
    
    // Delete any associated tasks templates
    if (automation.taskTemplate && automation.taskTemplate.length > 0) {
      // This doesn't delete actual created tasks, just the templates
      console.log(`Deleted automation ${req.params.id} with ${automation.taskTemplate.length} task templates`);
    }
    
    res.json({ message: 'Automation deleted successfully' });
  } catch (err) {
    console.error('Error deleting automation:', err);
    res.status(500).json({ message: 'Failed to delete automation', error: err.message });
  }
});

// Verify automation template (approve/reject) - moved before /:automationId routes
router.put('/:automationId/templates/:templateId/verify', protect, async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be either "approve" or "reject"' });
    }

    // Only admins and task verifiers can verify templates
    const isAdmin = req.user.role === 'Admin';
    const isTaskVerifier = Array.isArray(req.user.role2) 
      ? req.user.role2.includes('Task Verifier')
      : req.user.role2 === 'Task Verifier';
    
    if (!isAdmin && !isTaskVerifier) {
      return res.status(403).json({ message: 'Access denied. Admin or Task Verifier role required.' });
    }

    const automation = await Automation.findById(req.params.automationId);
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }

    const template = automation.taskTemplate.id(req.params.templateId);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    if (action === 'approve') {
      // Approve: Set verification status to 'completed'
      template.verificationStatus = 'completed';
      await automation.save();

      // Log the approval action
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'automation_task_template_updated',
        automation._id,
        `Approved automation template "${template.title}" in automation "${automation.name}"`,
        null,
        { 
          automationName: automation.name,
          templateTitle: template.title,
          templateId: template._id,
          action: 'approved'
        },
        req
      );

      res.json({ 
        message: `Template approved successfully`,
        automation,
        template
      });
    } else if (action === 'reject') {
      // Reject: Remove the template from the automation
      const templateTitle = template.title;
      automation.taskTemplate.pull(req.params.templateId);
      await automation.save();

      // Log the rejection action
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'automation_task_template_deleted',
        automation._id,
        `Rejected and removed automation template "${templateTitle}" from automation "${automation.name}"`,
        null,
        { 
          automationName: automation.name,
          templateTitle: templateTitle,
          templateId: req.params.templateId,
          action: 'rejected'
        },
        req
      );

      res.json({ 
        message: `Template rejected and removed successfully`,
        automation
      });
    }
  } catch (err) {
    console.error('Error verifying automation template:', err);
    res.status(500).json({ message: 'Failed to verify template', error: err.message });
  }
});

export default router;
