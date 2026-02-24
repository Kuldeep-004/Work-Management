import express from "express";
import Task from "../models/Task.js";
import TaskStatus from "../models/TaskStatus.js";
import Priority from "../models/Priority.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { protect } from "../middleware/authMiddleware.js";
import ActivityLogger from "../utils/activityLogger.js";

const router = express.Router();

// Middleware to check if user is admin or team head
const adminOrTeamHead = (req, res, next) => {
  if (req.user.role === "Admin" || req.user.role === "Team Head") {
    next();
  } else {
    res
      .status(403)
      .json({ message: "Access denied. Admin or Team Head role required." });
  }
};

// Execute bulk status name update with safety checks
router.post(
  "/execute-status-update",
  protect,
  adminOrTeamHead,
  async (req, res) => {
    try {
      const { oldName, newName } = req.body;

      if (!oldName || !newName) {
        return res.status(400).json({
          message: "oldName and newName are required",
        });
      }

      // Double check that new name doesn't exist
      const existingNewStatus = await TaskStatus.findOne({ name: newName });
      if (existingNewStatus) {
        return res.status(400).json({
          message: "A status with the new name already exists. Cannot proceed.",
        });
      }

      // Get the status to update
      const statusToUpdate = await TaskStatus.findOne({ name: oldName });
      if (!statusToUpdate) {
        return res.status(404).json({ message: "Status not found" });
      }

      // Start transaction for safety
      const session = await Task.db.startSession();

      let updatedTasksCount = 0;
      let updatedStatus = null;

      try {
        await session.withTransaction(async () => {
          // First update the status name to avoid validation issues
          statusToUpdate.name = newName;
          updatedStatus = await statusToUpdate.save({ session });

          // Then update all tasks with the old status name
          const taskUpdateResult = await Task.updateMany(
            { status: oldName },
            { $set: { status: newName } },
            { session, runValidators: false }, // Disable validators during bulk update
          );
          updatedTasksCount = taskUpdateResult.modifiedCount;
        });

        // Log the bulk update activity
        await ActivityLogger.logSystemActivity(
          req.user._id,
          "task_status_bulk_updated",
          statusToUpdate._id,
          `Bulk updated status name from "${oldName}" to "${newName}" affecting ${updatedTasksCount} tasks`,
          { oldName },
          { newName, affectedTasksCount: updatedTasksCount },
          req,
        );

        res.json({
          success: true,
          message: `Successfully updated ${updatedTasksCount} tasks and status name`,
          updatedTasksCount,
          updatedStatus,
          operation: "status_update",
        });
      } catch (transactionError) {
        throw transactionError;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      res.status(500).json({
        message: "Failed to execute bulk status update",
        error: error.message,
      });
    }
  },
);

// Execute bulk priority name update with safety checks
router.post(
  "/execute-priority-update",
  protect,
  adminOrTeamHead,
  async (req, res) => {
    try {
      const { oldName, newName } = req.body;

      if (!oldName || !newName) {
        return res.status(400).json({
          message: "oldName and newName are required",
        });
      }

      // Double check that new name doesn't exist
      const existingNewPriority = await Priority.findOne({ name: newName });
      if (existingNewPriority) {
        return res.status(400).json({
          message:
            "A priority with the new name already exists. Cannot proceed.",
        });
      }

      // Get the priority to update
      const priorityToUpdate = await Priority.findOne({ name: oldName });
      if (!priorityToUpdate) {
        return res.status(404).json({ message: "Priority not found" });
      }

      // Start transaction for safety
      const session = await Task.db.startSession();

      let updatedTasksCount = 0;
      let updatedPriority = null;

      try {
        await session.withTransaction(async () => {
          // First update the priority name
          priorityToUpdate.name = newName;
          updatedPriority = await priorityToUpdate.save({ session });

          // Then update all tasks with the old priority name
          const taskUpdateResult = await Task.updateMany(
            { priority: oldName },
            { $set: { priority: newName } },
            { session, runValidators: false }, // Disable validators during bulk update
          );
          updatedTasksCount = taskUpdateResult.modifiedCount;
        });

        // Log the bulk update activity
        await ActivityLogger.logSystemActivity(
          req.user._id,
          "priority_bulk_updated",
          priorityToUpdate._id,
          `Bulk updated priority name from "${oldName}" to "${newName}" affecting ${updatedTasksCount} tasks`,
          { oldName },
          { newName, affectedTasksCount: updatedTasksCount },
          req,
        );

        res.json({
          success: true,
          message: `Successfully updated ${updatedTasksCount} tasks and priority name`,
          updatedTasksCount,
          updatedPriority,
          operation: "priority_update",
        });
      } catch (transactionError) {
        throw transactionError;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      res.status(500).json({
        message: "Failed to execute bulk priority update",
        error: error.message,
      });
    }
  },
);

// Bulk reassign tasks to a different user
router.post("/execute-reassign", protect, adminOrTeamHead, async (req, res) => {
  try {
    const { taskIds, newAssigneeId } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        message: "taskIds array is required and must not be empty",
      });
    }

    if (!newAssigneeId) {
      return res.status(400).json({
        message: "newAssigneeId is required",
      });
    }

    // Verify the new assignee exists
    const newAssignee = await User.findById(newAssigneeId);
    if (!newAssignee) {
      return res.status(404).json({ message: "New assignee not found" });
    }

    // Fetch all tasks to be reassigned
    const tasksToReassign = await Task.find({ _id: { $in: taskIds } })
      .populate("assignedTo", "firstName lastName")
      .populate("assignedBy", "firstName lastName");

    if (tasksToReassign.length === 0) {
      return res.status(404).json({ message: "No tasks found to reassign" });
    }

    // Check if user has permission to reassign these tasks
    // Team Head can only reassign tasks within their team
    if (req.user.role === "Team Head") {
      const teamHead = await User.findById(req.user._id);
      const teamMembers = await User.find({ team: teamHead.team }).select(
        "_id",
      );
      const teamMemberIds = teamMembers.map((m) => m._id.toString());

      // Check if new assignee is in the team
      if (!teamMemberIds.includes(newAssigneeId)) {
        return res.status(403).json({
          message: "You can only reassign tasks to members of your team",
        });
      }

      // Check if all tasks belong to team members
      for (const task of tasksToReassign) {
        const taskAssignees = Array.isArray(task.assignedTo)
          ? task.assignedTo.map((a) => a._id.toString())
          : [task.assignedTo._id.toString()];

        const allInTeam = taskAssignees.every((id) =>
          teamMemberIds.includes(id),
        );
        if (
          !allInTeam &&
          task.assignedBy._id.toString() !== req.user._id.toString()
        ) {
          return res.status(403).json({
            message:
              "You can only reassign tasks assigned to your team members or tasks you created",
          });
        }
      }
    }

    // Perform bulk reassignment
    const updatedTasks = [];
    const notificationsToCreate = [];

    for (const task of tasksToReassign) {
      const oldAssignees = Array.isArray(task.assignedTo)
        ? task.assignedTo.map((a) => ({
            _id: a._id,
            firstName: a.firstName,
            lastName: a.lastName,
          }))
        : [
            {
              _id: task.assignedTo._id,
              firstName: task.assignedTo.firstName,
              lastName: task.assignedTo.lastName,
            },
          ];

      // Update task with new assignee
      task.assignedTo = [newAssigneeId];
      await task.save();

      updatedTasks.push(task);

      // Create notification for new assignee
      notificationsToCreate.push({
        recipient: newAssigneeId,
        type: "task_assignment",
        message: `Task "${task.title}" has been reassigned to you by ${req.user.firstName} ${req.user.lastName}`,
        task: task._id,
        assigner: req.user._id,
      });

      // Log the reassignment activity
      await ActivityLogger.logTaskActivity(
        req.user._id,
        "task_assigned",
        task._id,
        `Reassigned task from ${oldAssignees.map((a) => `${a.firstName} ${a.lastName}`).join(", ")} to ${newAssignee.firstName} ${newAssignee.lastName}`,
        {
          oldAssignees: oldAssignees.map((a) => ({
            id: a._id,
            name: `${a.firstName} ${a.lastName}`,
          })),
        },
        {
          newAssignee: {
            id: newAssignee._id,
            name: `${newAssignee.firstName} ${newAssignee.lastName}`,
          },
        },
        req,
      );
    }

    // Bulk insert notifications
    if (notificationsToCreate.length > 0) {
      await Notification.insertMany(notificationsToCreate);
    }

    res.json({
      success: true,
      message: `Successfully reassigned ${updatedTasks.length} task${updatedTasks.length > 1 ? "s" : ""} to ${newAssignee.firstName} ${newAssignee.lastName}`,
      reassignedCount: updatedTasks.length,
      newAssignee: {
        _id: newAssignee._id,
        firstName: newAssignee.firstName,
        lastName: newAssignee.lastName,
      },
      operation: "bulk_reassign",
    });
  } catch (error) {
    console.error("Bulk reassign error:", error);
    res.status(500).json({
      message: "Failed to execute bulk reassignment",
      error: error.message,
    });
  }
});

export default router;
