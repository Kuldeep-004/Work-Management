import cron from 'node-cron';
import Automation from './models/Automation.js';
import Task from './models/Task.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Connect to MongoDB if not already connected
if (mongoose.connection.readyState === 0) {
  mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
}

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  await runAutomationCheck(false);
});

// Function to check and process automations
export const runAutomationCheck = async (isManual = true) => {
  const now = new Date();
  const dayOfMonth = now.getDate();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  if (isManual) {
    console.log(`[AutomationScheduler] Manual check triggered at ${now.toISOString()}`);
  }
  
  try {
    // Get automations that trigger on day of month and haven't run this month
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    const monthlyAutomations = await Automation.find({ 
      triggerType: 'dayOfMonth',
      dayOfMonth: dayOfMonth,
      // Add conditions to check if it hasn't been run this month yet
      $or: [
        // Either lastRunMonth doesn't exist
        { lastRunMonth: { $exists: false } },
        // Or lastRunMonth is not the current month
        { lastRunMonth: { $ne: currentMonth } },
        // Or lastRunYear is not the current year
        { lastRunYear: { $ne: currentYear } },
      ]
    });
    
    // Get quarterly automations for the current day and month (if applicable)
    // Check if current month matches any of the selected quarterly months
    const quarterlyAutomations = await Automation.find({
      triggerType: 'quarterly',
      dayOfMonth: dayOfMonth,
      quarterlyMonths: currentMonth + 1, // Convert to 1-indexed for comparison
      // Check if it hasn't been run in the current month
      $or: [
        { lastRunMonth: { $exists: false } },
        { lastRunMonth: { $ne: currentMonth } },
        { lastRunYear: { $ne: currentYear } }
      ]
    });
    
    // Get half-yearly automations for the current day and month (if applicable)
    // Check if current month matches any of the selected half-yearly months
    const halfYearlyAutomations = await Automation.find({
      triggerType: 'halfYearly',
      dayOfMonth: dayOfMonth,
      halfYearlyMonths: currentMonth + 1, // Convert to 1-indexed for comparison
      // Check if it hasn't been run in the current month
      $or: [
        { lastRunMonth: { $exists: false } },
        { lastRunMonth: { $ne: currentMonth } },
        { lastRunYear: { $ne: currentYear } }
      ]
    });
    
    // Get yearly automations for the current day and month (if applicable)
    const yearlyAutomations = await Automation.find({
      triggerType: 'yearly',
      dayOfMonth: dayOfMonth,
      monthOfYear: currentMonth + 1, // Convert to 1-indexed for storage
      // Check if it hasn't been run this year yet
      $or: [
        { lastRunYear: { $exists: false } },
        { lastRunYear: { $ne: currentYear } }
      ]
    });
    
    // Get automations that trigger on specific date and time
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    
    // Find dateTime automations that should run now
    const dateTimeAutomations = await Automation.find({
      triggerType: 'dateAndTime',
      specificDate: {
        $gte: todayStart,
        $lte: todayEnd
      },
      specificTime: {
        $lte: currentTimeString
      }
    });
    
    // Also find any past date automations that may have been missed
    const missedAutomations = await Automation.find({
      triggerType: 'dateAndTime',
      specificDate: {
        $lt: todayStart
      }
    });
    
    const automations = [
      ...monthlyAutomations, 
      ...quarterlyAutomations,
      ...halfYearlyAutomations,
      ...yearlyAutomations,
      ...dateTimeAutomations,
      ...missedAutomations
    ];
    
    // Check if there are any monthly automations that we're skipping because they already ran this month
    const allMonthlyAutomationsToday = await Automation.find({
      triggerType: 'dayOfMonth',
      dayOfMonth: dayOfMonth
    });
    
    const skippedAutomationsCount = allMonthlyAutomationsToday.length - monthlyAutomations.length;
    
    if (!isManual) {
      console.log(`[AutomationScheduler] Found ${monthlyAutomations.length} monthly automations for day ${dayOfMonth} that haven't run this month yet`);
      console.log(`[AutomationScheduler] Skipping ${skippedAutomationsCount} monthly automations that already ran this month`);
      console.log(`[AutomationScheduler] Found ${quarterlyAutomations.length} quarterly automations for day ${dayOfMonth} of month ${currentMonth + 1}`);
      console.log(`[AutomationScheduler] Found ${halfYearlyAutomations.length} half-yearly automations for day ${dayOfMonth} of month ${currentMonth + 1}`);
      console.log(`[AutomationScheduler] Found ${yearlyAutomations.length} yearly automations for day ${dayOfMonth} of month ${currentMonth + 1}`);
      console.log(`[AutomationScheduler] Found ${dateTimeAutomations.length} date-time automations for today`);
      console.log(`[AutomationScheduler] Found ${missedAutomations.length} missed date-time automations from past days`);
    } else {
      console.log(`[AutomationScheduler] Found ${automations.length} total automations to process`);
    }
    
    let processedCount = 0;
    
    for (const automation of automations) {
      // Skip if no task templates are defined
      if (!automation.taskTemplate || !Array.isArray(automation.taskTemplate) || automation.taskTemplate.length === 0) {
        console.warn(`[AutomationScheduler] Skipping automation ${automation._id}: no task templates defined.`);
        continue;
      }
      
      let totalTasksCreated = 0;
      
      // Process each task template in the array
      for (const template of automation.taskTemplate) {
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
          billed
        } = template || {};
        
        if (!title || !clientName || !clientGroup || !workType || !assignedTo || !priority || !inwardEntryDate) {
          console.warn(`[AutomationScheduler] Skipping template in automation ${automation._id}: missing required fields.`);
          continue;
        }

        let combinedInwardEntryDate = null;
        if (inwardEntryDate && inwardEntryTime) {
          const [year, month, day] = inwardEntryDate.split('-');
          const [hours, minutes] = inwardEntryTime.split(':');
          combinedInwardEntryDate = new Date(year, month - 1, day, hours, minutes);
        } else if (inwardEntryDate) {
          combinedInwardEntryDate = new Date(inwardEntryDate);
        }
        
        // Ensure assignedTo is always an array
        let assignedToArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
        
        // Filter out null, undefined or empty strings
        assignedToArray = assignedToArray.filter(id => id && String(id).trim() !== '');
        
        // Log all assignedTo IDs for debugging
        console.log(`[AutomationScheduler] Processing template "${title}" with assignedTo IDs: ${JSON.stringify(assignedToArray)}`);
        
        // FIXED: Correctly check for valid MongoDB ObjectIds
        const validIds = [];
        const invalidIds = [];
        
        for (const id of assignedToArray) {
          // The correct way to check for valid ObjectIds
          if (mongoose.Types.ObjectId.isValid(id)) {
            validIds.push(id);
          } else {
            invalidIds.push(id);
            console.error(`[AutomationScheduler] Invalid assignedTo ID format: ${id}`);
          }
        }
        
        // Replace the array with only valid IDs
        assignedToArray = validIds;
        
        if (invalidIds.length > 0) {
          console.error(`[AutomationScheduler] ${invalidIds.length} invalid assignedTo IDs in automation ${automation._id}, template "${title}"`);
        }
        
        if (assignedToArray.length === 0) {
          console.error(`[AutomationScheduler] No valid assignedTo IDs for template "${title}" in automation ${automation._id} - SKIPPING TASK CREATION`);
          continue;
        } else {
          console.log(`[AutomationScheduler] Found ${assignedToArray.length} valid assignedTo IDs for template "${title}"`);
        }
        
        let templateCreatedCount = 0;
        for (let userId of assignedToArray) {
          try {
            const objectId = new mongoose.Types.ObjectId(userId);
            userId = objectId;
          } catch (err) {
            console.error(`[AutomationScheduler] Failed to convert assignedTo ID to ObjectId: ${userId}`, err);
            continue;
          }
          
          let verificationAssignedToId = verificationAssignedTo;
          if (verificationAssignedToId) {
            try {
              if (mongoose.Types.ObjectId.isValid(verificationAssignedToId)) {
                verificationAssignedToId = new mongoose.Types.ObjectId(verificationAssignedToId);
              } else {
                console.warn(`[AutomationScheduler] Invalid verificationAssignedTo ID: ${verificationAssignedToId}`);
                verificationAssignedToId = undefined;
              }
            } catch (err) {
              console.warn(`[AutomationScheduler] Invalid verificationAssignedTo ID: ${verificationAssignedToId}`, err);
              verificationAssignedToId = undefined;
            }
          }
          
          let assignedById = automation.createdBy;
          if (assignedById) {
            try {
              if (mongoose.Types.ObjectId.isValid(assignedById)) {
                assignedById = new mongoose.Types.ObjectId(assignedById);
              } else {
                console.warn(`[AutomationScheduler] Invalid createdBy ID: ${assignedById}`);
                assignedById = undefined;
              }
            } catch (err) {
              console.warn(`[AutomationScheduler] Invalid createdBy ID: ${assignedById}`, err);
              assignedById = undefined;
            }
          }
          
          const task = new Task({
            title,
            description,
            clientName,
            clientGroup,
            workType,
            assignedTo: userId,
            assignedBy: assignedById,
            priority,
            inwardEntryDate: combinedInwardEntryDate || new Date(),
            // Only include dueDate and targetDate if they were specified in the template
            ...(dueDate ? { dueDate: new Date(dueDate) } : {}),
            ...(targetDate ? { targetDate: new Date(targetDate) } : {}),
            verificationAssignedTo: verificationAssignedToId,
            billed: billed !== undefined ? billed : true,
            selfVerification: false,
            verificationStatus: 'completed',
            status: 'yet_to_start' // Make sure we set the correct status
          });
          
          try {
            const savedTask = await task.save();
            if (savedTask) {
              automation.tasks.push(savedTask._id);
              templateCreatedCount++;
              console.log(`[AutomationScheduler] Created task ${savedTask._id} from automation ${automation._id}`);
            }
          } catch (err) {
            console.error(`[AutomationScheduler] Automation task creation error for automation ${automation._id}:`, err);
          }
        }
        
        totalTasksCreated += templateCreatedCount;
        console.log(`[AutomationScheduler] Automation ${automation._id}, template "${title}": Created ${templateCreatedCount} tasks.`);
      }
      
      // For recurring automations (dayOfMonth, quarterly, halfYearly, yearly), 
      // update lastRunDate and save for next run
      if (['dayOfMonth', 'quarterly', 'halfYearly', 'yearly'].includes(automation.triggerType) || !automation.triggerType) {
        // Update the lastRunDate, lastRunMonth, and lastRunYear to track when it was executed
        automation.lastRunDate = now;
        automation.lastRunMonth = now.getMonth();
        automation.lastRunYear = now.getFullYear();
        await automation.save();
        
        let nextRunInfo = 'next month';
        if (automation.triggerType === 'quarterly') nextRunInfo = 'next quarter';
        if (automation.triggerType === 'halfYearly') nextRunInfo = 'in 6 months';
        if (automation.triggerType === 'yearly') nextRunInfo = 'next year';
        
        console.log(`[AutomationScheduler] ${automation.triggerType} automation ${automation._id}: Created ${totalTasksCreated} tasks total. Will run ${nextRunInfo}.`);
      } 
      // For dateAndTime automations, delete them after execution since they're one-time
      else if (automation.triggerType === 'dateAndTime') {
        if (totalTasksCreated > 0) {
          console.log(`[AutomationScheduler] One-time automation ${automation._id}: Created ${totalTasksCreated} tasks total. Deleting automation.`);
          await Automation.deleteOne({ _id: automation._id });
          processedCount++;
        } else {
          console.log(`[AutomationScheduler] One-time automation ${automation._id}: No tasks were created! Will try again next minute.`);
          // Don't delete the automation if no tasks were created, so we can retry
        }
      }
    }
    
    if (!isManual) {
      console.log(`[AutomationScheduler] Finished automation cycle at ${new Date().toISOString()}`);
    } else {
      return { success: true, processedCount };
    }
  } catch (err) {
    console.error('[AutomationScheduler] Error:', err);
    if (isManual) {
      return { success: false, error: err.message };
    }
  }
};

// Function to reset monthly automation run status (useful for testing or fixing issues)
export const resetMonthlyAutomationStatus = async (automationId = null) => {
  try {
    const query = automationId ? { _id: automationId } : { triggerType: 'dayOfMonth' };
    const result = await Automation.updateMany(query, {
      $unset: { lastRunDate: "", lastRunMonth: "", lastRunYear: "" }
    });
    
    console.log(`[AutomationScheduler] Reset ${result.modifiedCount} monthly automations run status`);
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (err) {
    console.error('[AutomationScheduler] Error resetting automation status:', err);
    return { success: false, error: err.message };
  }
};

console.log('[AutomationScheduler] Scheduler started.');
