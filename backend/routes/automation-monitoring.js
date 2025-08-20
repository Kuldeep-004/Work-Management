// Additional endpoint for automation monitoring and manual control
// Add to backend/routes/automations.js

// Get automation execution status and next run times
router.get('/status', protect, async (req, res) => {
  try {
    // Only admins can view automation status
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized, admin access required' });
    }

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentDay = now.getDate();

    const automations = await Automation.find({}).sort({ createdAt: -1 });
    
    const statusReport = automations.map(automation => {
      let nextRunDate = null;
      let status = 'Active';
      
      // Calculate next run date based on automation type
      switch (automation.triggerType) {
        case 'dayOfMonth':
          if (automation.lastRunMonth === currentMonth && automation.lastRunYear === currentYear) {
            // Already ran this month, calculate next month
            const nextMonth = new Date(currentYear, currentMonth + 1, automation.dayOfMonth);
            nextRunDate = nextMonth;
            status = 'Completed this month';
          } else if (currentDay >= automation.dayOfMonth) {
            // Past this month's trigger day, next month
            const nextMonth = new Date(currentYear, currentMonth + 1, automation.dayOfMonth);
            nextRunDate = nextMonth;
            status = 'Pending next month';
          } else {
            // This month, not yet triggered
            nextRunDate = new Date(currentYear, currentMonth, automation.dayOfMonth);
            status = 'Pending this month';
          }
          break;
          
        case 'quarterly':
          // Find next quarter month
          const quarterlyMonths = automation.quarterlyMonths || [1, 4, 7, 10];
          let nextQuarterMonth = quarterlyMonths.find(month => month > currentMonth + 1);
          if (!nextQuarterMonth) {
            nextQuarterMonth = quarterlyMonths[0]; // Next year
            nextRunDate = new Date(currentYear + 1, nextQuarterMonth - 1, automation.dayOfMonth);
          } else {
            nextRunDate = new Date(currentYear, nextQuarterMonth - 1, automation.dayOfMonth);
          }
          status = automation.lastRunMonth === currentMonth && automation.lastRunYear === currentYear 
            ? 'Completed this quarter' : 'Pending';
          break;
          
        case 'halfYearly':
          const halfYearlyMonths = automation.halfYearlyMonths || [1, 7];
          let nextHalfYearMonth = halfYearlyMonths.find(month => month > currentMonth + 1);
          if (!nextHalfYearMonth) {
            nextHalfYearMonth = halfYearlyMonths[0]; // Next year
            nextRunDate = new Date(currentYear + 1, nextHalfYearMonth - 1, automation.dayOfMonth);
          } else {
            nextRunDate = new Date(currentYear, nextHalfYearMonth - 1, automation.dayOfMonth);
          }
          status = automation.lastRunMonth === currentMonth && automation.lastRunYear === currentYear 
            ? 'Completed this period' : 'Pending';
          break;
          
        case 'yearly':
          if (automation.lastRunYear === currentYear) {
            nextRunDate = new Date(currentYear + 1, automation.monthOfYear - 1, automation.dayOfMonth);
            status = 'Completed this year';
          } else {
            nextRunDate = new Date(currentYear, automation.monthOfYear - 1, automation.dayOfMonth);
            status = 'Pending this year';
          }
          break;
          
        case 'dateAndTime':
          nextRunDate = new Date(automation.specificDate);
          status = nextRunDate < now ? 'Completed/Deleted' : 'Scheduled';
          break;
      }
      
      return {
        _id: automation._id,
        name: automation.name,
        triggerType: automation.triggerType,
        status,
        nextRunDate,
        lastRunDate: automation.lastRunDate,
        templateCount: automation.taskTemplate ? automation.taskTemplate.length : 0,
        approvedTemplates: automation.taskTemplate ? 
          automation.taskTemplate.filter(t => t.verificationStatus === 'completed').length : 0,
        tasksCreated: automation.tasks ? automation.tasks.length : 0
      };
    });

    res.json({
      currentTime: now,
      totalAutomations: automations.length,
      statusReport
    });
  } catch (err) {
    console.error('Error getting automation status:', err);
    res.status(500).json({ message: 'Failed to get automation status', error: err.message });
  }
});

// Force run a specific automation (admin only, for testing)
router.post('/:id/force-run', protect, async (req, res) => {
  try {
    // Only admins can force run automations
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ message: 'Not authorized, admin access required' });
    }

    const automation = await Automation.findById(req.params.id);
    if (!automation) {
      return res.status(404).json({ message: 'Automation not found' });
    }

    // Reset the last run status to force it to run
    automation.lastRunDate = undefined;
    automation.lastRunMonth = undefined;
    automation.lastRunYear = undefined;
    await automation.save();

    // Trigger the automation check
    const { runAutomationCheck } = await import('../automationScheduler.js');
    const result = await runAutomationCheck(true);

    res.json({
      message: `Forced automation ${automation.name} to run`,
      result
    });
  } catch (err) {
    console.error('Error force running automation:', err);
    res.status(500).json({ message: 'Failed to force run automation', error: err.message });
  }
});
