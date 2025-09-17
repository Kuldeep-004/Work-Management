import express from 'express';
import Timesheet from '../models/Timesheet.js';
import User from '../models/User.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Helper function to calculate minutes between time strings
function getMinutesBetween(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM < startM) endM += 24 * 60;
  return endM - startM;
}

// Get detailed user analytics for a date range
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Calculate date range (default to last 30 days)
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Set time boundaries
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    // Get user details
    const user = await User.findById(userId).select('firstName lastName email role team photo hourlyRate');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get timesheets for the date range - only completed timesheets
    const timesheets = await Timesheet.find({
      user: userId,
      date: { $gte: start, $lte: end },
      isCompleted: true
    }).populate('entries.task', 'title description clientName clientGroup workType').sort({ date: 1 });

    // Initialize analytics data
    const analytics = {
      user: {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        team: user.team,
        photo: user.photo,
        hourlyRate: user.hourlyRate || 0
      },
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      },
      summary: {
        totalWorkingHours: 0,  // All timeslots excluding permission
        taskHours: 0,          // Hours where user has chosen a task
        permissionHours: 0,
        lunchHours: 0,
        billingHours: 0,
        otherHours: 0,
        infrastructureHours: 0,
        totalDays: 0,
        workingHours: 0,       // For backward compatibility
        totalSalary: 0
      },
      dailyBreakdown: [],
      taskBreakdown: {},
      weeklyTrend: [],
      monthlyTrend: [],
      productivity: {
        averageDailyHours: 0,
        mostProductiveDay: null,
        leastProductiveDay: null
      }
    };
    console.log(analytics);

    // Process each timesheet
    timesheets.forEach(timesheet => {
      const dateStr = timesheet.date.toISOString().split('T')[0];
      let dailyWorking = 0;
      let dailyPermission = 0;
      let dailyLunch = 0;
      let dailyBilling = 0;
      let dailyOther = 0;
      let dailyInfrastructure = 0;

      timesheet.entries.forEach(entry => {
        const minutes = getMinutesBetween(entry.startTime, entry.endTime);
        // Categorize time
        if (entry.manualTaskName === 'Permission' || entry.task === 'permission') {
          dailyPermission += minutes;
          analytics.summary.permissionHours += minutes;
          // Permission is excluded from total working hours
        } else if (entry.manualTaskName === 'Lunch' || entry.task === 'lunch') {
          dailyLunch += minutes;
          analytics.summary.lunchHours += minutes;
          analytics.summary.totalWorkingHours += minutes; // Include lunch in total working hours
        } else if (entry.manualTaskName === 'Billing' || entry.task === 'billing') {
          dailyBilling += minutes;
          analytics.summary.billingHours += minutes;
          analytics.summary.totalWorkingHours += minutes;
        } else if (entry.manualTaskName === 'Other' || entry.task === 'other') {
          dailyOther += minutes;
          analytics.summary.otherHours += minutes;
          analytics.summary.totalWorkingHours += minutes;
        } else if (entry.manualTaskName === 'INFRASTRUCTURE ISSUES & DISCUSSION WITH VIVEK SIR' || entry.task === 'infrastructure-issues') {
          dailyInfrastructure += minutes;
          analytics.summary.infrastructureHours += minutes;
          analytics.summary.totalWorkingHours += minutes;
        } else if (
          entry.task && typeof entry.task === 'object' && entry.task._id && entry.task.title && entry.manualTaskName === ''
        ) {
          // Valid populated task with no manual name
          dailyWorking += minutes;
          analytics.summary.taskHours += minutes;
          analytics.summary.totalWorkingHours += minutes;
          // Track task breakdown
          const taskKey = entry.task._id.toString();
          if (!analytics.taskBreakdown[taskKey]) {
            analytics.taskBreakdown[taskKey] = {
              task: entry.task,
              totalMinutes: 0
            };
          }
          analytics.taskBreakdown[taskKey].totalMinutes += minutes;
        } else {
          // If manualTaskName is empty and task is missing, not populated, or deleted, count as Other
          dailyOther += minutes;
          analytics.summary.otherHours += minutes;
          analytics.summary.totalWorkingHours += minutes;
        }
      });

      // Daily breakdown
      const totalDaily = dailyWorking + dailyBilling + dailyOther + dailyInfrastructure;
      analytics.dailyBreakdown.push({
        date: dateStr,
        workingHours: totalDaily,
        permissionHours: dailyPermission,
        lunchHours: dailyLunch,
        billingHours: dailyBilling,
        otherHours: dailyOther,
        infrastructureHours: dailyInfrastructure,
        totalEntries: timesheet.entries.length
      });

      analytics.summary.workingHours += totalDaily;
    });

    analytics.summary.totalDays = timesheets.length;

    // Calculate weekly and monthly trends
    const weeklyData = {};
    const monthlyData = {};

    analytics.dailyBreakdown.forEach(day => {
      const date = new Date(day.date);
      const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)}`;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!weeklyData[weekKey]) weeklyData[weekKey] = { totalHours: 0, days: 0 };
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { totalHours: 0, days: 0 };

      weeklyData[weekKey].totalHours += day.workingHours;
      weeklyData[weekKey].days += 1;
      monthlyData[monthKey].totalHours += day.workingHours;
      monthlyData[monthKey].days += 1;
    });

    analytics.weeklyTrend = Object.entries(weeklyData).map(([week, data]) => ({
      week,
      totalHours: data.totalHours,
      averageDaily: data.totalHours / data.days
    }));

    analytics.monthlyTrend = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      totalHours: data.totalHours,
      averageDaily: data.totalHours / data.days
    }));

    // Calculate productivity metrics
    const totalWorkingHoursInHours = analytics.summary.totalWorkingHours / 60;
    analytics.summary.totalSalary = totalWorkingHoursInHours * (user.hourlyRate || 0);
    
    // Calculate average daily hours - all timeslots excluding permission divided by number of days with timesheets
    const daysWithTimesheets = analytics.dailyBreakdown.length;
    if (daysWithTimesheets > 0) {
      analytics.productivity.averageDailyHours = analytics.summary.totalWorkingHours / daysWithTimesheets;
    }

    const workingDays = analytics.dailyBreakdown.filter(day => day.workingHours > 0);
    if (workingDays.length > 0) {
      const sortedDays = workingDays.sort((a, b) => b.workingHours - a.workingHours);
      analytics.productivity.mostProductiveDay = sortedDays[0];
      analytics.productivity.leastProductiveDay = sortedDays[sortedDays.length - 1];
    }

    // Convert task breakdown to array
    analytics.taskBreakdown = Object.values(analytics.taskBreakdown).sort((a, b) => b.totalMinutes - a.totalMinutes);

    res.json(analytics);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Failed to fetch analytics', error: error.message });
  }
});

// Get list of all users for analytics dropdown
router.get('/users', protect, async (req, res) => {
  try {
    const users = await User.find({ status: { $ne: 'rejected' } })
      .select('firstName lastName email role team photo')
      .sort({ firstName: 1 });
    
    res.json(users);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

export default router;
