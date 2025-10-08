import cron from 'node-cron';
import Automation from './models/Automation.js';
import Task from './models/Task.js';
import { sendTimesheetReminder } from './utils/pushNotificationService.js';
import { createAndUploadBackup, logBackupActivity } from './utils/backupUtils.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import { DateTime } from 'luxon';

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

// Run timesheet reminders every hour between 10 AM to 7 PM (Monday to Friday)
cron.schedule('0 10-19 * * 1-5', async () => {
  try {
    const result = await sendTimesheetReminder();
  } catch (error) {
    console.error('[TimesheetScheduler] Error sending timesheet reminders:', error);
  }
});

// Run database backup daily at 9:00 AM IST
cron.schedule('0 9 * * *', async () => {
  try {
    const result = await createAndUploadBackup();
    await logBackupActivity(result, null, 'system');
  } catch (error) {
    await logBackupActivity(null, error, 'system');
    console.error('[BackupScheduler] Daily backup failed:', error.message);
  }
}, {
  timezone: 'Asia/Kolkata'
});

// Function to check and process automations
export const runAutomationCheck = async (isManual = true) => {
  // Use IST timezone for all date/time operations
  const now = DateTime.now().setZone('Asia/Kolkata');
  const dayOfMonth = now.day;
  const currentHour = now.hour;
  const currentMinute = now.minute;
  const currentTimeString = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

  if (isManual) {
  }
  
  try {
    // Get automations that trigger on day of month and haven't run this month
  const currentMonth = now.month - 1; // JS Date months are 0-indexed, luxon months are 1-indexed
  const currentYear = now.year;
    
    // NEW APPROACH: Get all automations for the trigger types and check templates individually
    const monthlyAutomations = await Automation.find({ 
      triggerType: 'dayOfMonth',
      dayOfMonth: dayOfMonth,
      'taskTemplate.verificationStatus': 'completed' // Only get automations with approved templates
    });
    
    // Get quarterly automations for the current day and month (if applicable)
    const quarterlyAutomations = await Automation.find({
      triggerType: 'quarterly',
      dayOfMonth: dayOfMonth,
      quarterlyMonths: currentMonth + 1, // Convert to 1-indexed for comparison
      'taskTemplate.verificationStatus': 'completed'
    });
    
    // Get half-yearly automations for the current day and month (if applicable)
    const halfYearlyAutomations = await Automation.find({
      triggerType: 'halfYearly',
      dayOfMonth: dayOfMonth,
      halfYearlyMonths: currentMonth + 1, // Convert to 1-indexed for comparison
      'taskTemplate.verificationStatus': 'completed'
    });
    
    // Get yearly automations for the current day and month (if applicable)
    const yearlyAutomations = await Automation.find({
      triggerType: 'yearly',
      dayOfMonth: dayOfMonth,
      monthOfYear: currentMonth + 1, // Convert to 1-indexed for storage
      'taskTemplate.verificationStatus': 'completed'
    });
    
    // Get automations that trigger on specific date and time
  const todayStart = now.startOf('day').toJSDate();
  const todayEnd = now.endOf('day').toJSDate();
    
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
    } else {
    }
    
    let processedCount = 0;
    
    for (const automation of automations) {
      // Skip if no task templates are defined
      if (!automation.taskTemplate || !Array.isArray(automation.taskTemplate) || automation.taskTemplate.length === 0) {
        console.warn(`[AutomationScheduler] Skipping automation ${automation._id}: no task templates defined.`);
        continue;
      }
      
      let totalTasksCreated = 0;
      
      // Process each task template individually - check each template's execution status
      for (const template of automation.taskTemplate) {
        // Skip templates that haven't been approved yet
        if (!template.verificationStatus || template.verificationStatus !== 'completed') {
          console.warn(`[AutomationScheduler] Skipping template "${template.title}" in automation ${automation._id}: template not approved yet (status: ${template.verificationStatus || 'undefined'}).`);
          continue;
        }
        
        // NEW: Check if this specific template has already been processed this period
        const shouldSkipTemplate = (() => {
          if (['dayOfMonth', 'quarterly', 'halfYearly'].includes(automation.triggerType)) {
            // For monthly/quarterly/half-yearly: check if processed this month
            return template.lastProcessedMonth === currentMonth && template.lastProcessedYear === currentYear;
          } else if (automation.triggerType === 'yearly') {
            // For yearly: check if processed this year
            return template.lastProcessedYear === currentYear;
          }
          return false; // For dateAndTime, always process
        })();
        
        if (shouldSkipTemplate) {
          continue;
        }
        
        
        const {
          title,
          description,
          clientName,
          clientGroup,
          workType,
          assignedTo,
          assignedBy, // Get original assignedBy from template
          priority,
          status, // Add status field
          inwardEntryDate,
          inwardEntryTime,
          dueDate,
          targetDate,
          billed
        } = template || {};
        
        if (!title || !clientName || !clientGroup || !workType || !assignedTo || !priority || !inwardEntryDate) {
          console.warn(`[AutomationScheduler] Skipping template in automation ${automation._id}: missing required fields.`);
          continue;
        }

        let combinedInwardEntryDate = null;
        if (inwardEntryDate && inwardEntryTime) {
          // Always parse as IST
          combinedInwardEntryDate = DateTime.fromFormat(
            `${inwardEntryDate} ${inwardEntryTime}`,
            'yyyy-MM-dd HH:mm',
            { zone: 'Asia/Kolkata' }
          ).toJSDate();
        } else if (inwardEntryDate) {
          combinedInwardEntryDate = DateTime.fromFormat(
            inwardEntryDate,
            'yyyy-MM-dd',
            { zone: 'Asia/Kolkata' }
          ).toJSDate();
        }
        
        // Ensure assignedTo is always an array
        let assignedToArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
        
        // Filter out null, undefined or empty strings
        assignedToArray = assignedToArray.filter(id => id && String(id).trim() !== '');
        
        // Log all assignedTo IDs for debugging
        
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
          
          // Use template's assignedBy if available, otherwise fall back to automation.createdBy
          let assignedById = assignedBy || automation.createdBy;
          if (assignedById) {
            try {
              if (mongoose.Types.ObjectId.isValid(assignedById)) {
                assignedById = new mongoose.Types.ObjectId(assignedById);
              } else {
                console.warn(`[AutomationScheduler] Invalid assignedBy ID: ${assignedById}`);
                assignedById = undefined;
              }
            } catch (err) {
              console.warn(`[AutomationScheduler] Invalid assignedBy ID: ${assignedById}`, err);
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
            status: status || 'yet_to_start', // Use template status or default
            inwardEntryDate: combinedInwardEntryDate || now.toJSDate(),
            // Only include dueDate and targetDate if they were specified in the template
            ...(dueDate ? { dueDate: DateTime.fromFormat(dueDate, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' }).toJSDate() } : {}),
            ...(targetDate ? { targetDate: DateTime.fromFormat(targetDate, 'yyyy-MM-dd', { zone: 'Asia/Kolkata' }).toJSDate() } : {}),
            billed: billed !== undefined ? billed : true,
            selfVerification: false,
            verificationStatus: 'completed'
            // Deliberately excluding verification fields:
            // - verificationAssignedTo, secondVerificationAssignedTo, etc.
            // - comments, files arrays (automation creates fresh tasks)
            // - guides and other verification-related fields
          });
          
          try {
            const savedTask = await task.save();
            if (savedTask) {
              automation.tasks.push(savedTask._id);
              templateCreatedCount++;
            }
          } catch (err) {
            console.error(`[AutomationScheduler] Automation task creation error for automation ${automation._id}:`, err);
          }
        }
        
        totalTasksCreated += templateCreatedCount;
        
        // NEW: Update this template's execution tracking if tasks were created
        if (templateCreatedCount > 0) {
          // Update the template's execution tracking fields
          if (['dayOfMonth', 'quarterly', 'halfYearly'].includes(automation.triggerType)) {
            template.lastProcessedMonth = currentMonth;
            template.lastProcessedYear = currentYear;
            template.lastProcessedDate = now;
          } else if (automation.triggerType === 'yearly') {
            template.lastProcessedYear = currentYear;
            template.lastProcessedDate = now;
          }
          
          // Track created task IDs for this template
          if (!template.createdTaskIds) {
            template.createdTaskIds = [];
          }
          template.createdTaskIds.push(...automation.tasks.slice(-templateCreatedCount));
        }
      }
      
      // For recurring automations (dayOfMonth, quarterly, halfYearly, yearly), 
      // update lastRunDate and save for next run ONLY if tasks were actually created
      if (['dayOfMonth', 'quarterly', 'halfYearly', 'yearly'].includes(automation.triggerType) || !automation.triggerType) {
        // Count how many approved templates this automation has
        const approvedTemplateCount = automation.taskTemplate.filter(template => 
          template.verificationStatus === 'completed'
        ).length;
        
        // Debug logging to see what's happening
        
        if (totalTasksCreated > 0) {
          // Update the lastRunDate, lastRunMonth, and lastRunYear to track when it was executed
          automation.lastRunDate = now.toJSDate();
          automation.lastRunMonth = now.month - 1;
          automation.lastRunYear = now.year;
          
          // Ensure nested template changes are saved (Mongoose needs this for nested arrays)
          automation.markModified('taskTemplate');
          await automation.save();
          
          let nextRunInfo = 'next month';
          if (automation.triggerType === 'quarterly') nextRunInfo = 'next quarter';
          if (automation.triggerType === 'halfYearly') nextRunInfo = 'in 6 months';
          if (automation.triggerType === 'yearly') nextRunInfo = 'next year';
          
        } else if (approvedTemplateCount === 0) {
          // No approved templates at all - don't mark as run, will try again next run
        } else {
          // Had approved templates but no tasks were created (maybe due to errors) - still mark as run to avoid infinite retries
          automation.lastRunDate = now.toJSDate();
          automation.lastRunMonth = now.month - 1;
          automation.lastRunYear = now.year;
          
          // Ensure nested template changes are saved even if no tasks created
          automation.markModified('taskTemplate');
          await automation.save();
          
        }
      } 
      // For dateAndTime automations, delete them after execution since they're one-time
      else if (automation.triggerType === 'dateAndTime') {
        if (totalTasksCreated > 0) {
          // Save template changes before deleting
          automation.markModified('taskTemplate');
          await automation.save();
          await Automation.deleteOne({ _id: automation._id });
          processedCount++;
        } else {
          // Don't delete the automation if no tasks were created, so we can retry
          // But still save any template execution tracking changes
          automation.markModified('taskTemplate');
          await automation.save();
        }
      }
    }
    
    if (!isManual) {
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
    
    return { success: true, modifiedCount: result.modifiedCount };
  } catch (err) {
    console.error('[AutomationScheduler] Error resetting automation status:', err);
    return { success: false, error: err.message };
  }
};

