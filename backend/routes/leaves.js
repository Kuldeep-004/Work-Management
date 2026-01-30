import express from "express";
import Leave from "../models/Leave.js";
import User from "../models/User.js";
import Team from "../models/Team.js";
import Notification from "../models/Notification.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply for leave
router.post("/apply", protect, async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;
    const userId = req.user.id;

    // Get user details
    const user = await User.findById(userId).populate("team");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.team) {
      return res
        .status(400)
        .json({ message: "User is not assigned to any team" });
    }

    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const numberOfDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    if (numberOfDays <= 0) {
      return res
        .status(400)
        .json({ message: "End date must be after start date" });
    }

    // Create leave application
    const leave = new Leave({
      userId: user._id,
      userName: `${user.firstName} ${user.lastName}`,
      teamId: user.team._id,
      leaveType,
      startDate: start,
      endDate: end,
      numberOfDays,
      reason,
      status: "Pending",
    });

    await leave.save();

    // Get all team heads and admins in the team
    const teamHeadsAndAdmins = await User.find({
      team: user.team._id,
      role: { $in: ["Team Head", "Admin"] },
      _id: { $ne: userId }, // Exclude the applicant
    });

    // Create notifications for team heads and admins
    const notificationPromises = teamHeadsAndAdmins.map((recipient) =>
      Notification.create({
        recipient: recipient._id,
        type: "system",
        message: `${user.firstName} ${user.lastName} has applied for ${leaveType} from ${start.toDateString()} to ${end.toDateString()}`,
      }),
    );

    await Promise.all(notificationPromises);

    res.status(201).json({
      message: "Leave application submitted successfully",
      leave,
    });
  } catch (error) {
    console.error("Error applying for leave:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get user's own leaves
router.get("/my-leaves", protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, status } = req.query;

    let query = { userId };

    // Filter by date range if provided (filter by leave start/end dates)
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      // Check if leave overlaps with the date range
      query.$or = [
        { startDate: dateQuery },
        { endDate: dateQuery },
        {
          $and: [
            { startDate: { $lte: dateQuery.$lte || new Date() } },
            { endDate: { $gte: dateQuery.$gte || new Date() } },
          ],
        },
      ];
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const leaves = await Leave.find(query)
      .populate("approvedBy", "firstName lastName")
      .sort({ appliedAt: -1 });

    res.json({ leaves });
  } catch (error) {
    console.error("Error fetching leaves:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get all leaves (for Team Heads and Admins)
router.get("/all-leaves", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { startDate, endDate, status, userId } = req.query;
    let query = {};

    // Team Heads can only see leaves from their team
    if (user.role === "Team Head") {
      query.teamId = user.team;
    }
    // Admins can see all leaves (no filter)

    // Filter by specific user if provided
    if (userId) {
      query.userId = userId;
    }

    // Filter by date range if provided (filter by leave start/end dates)
    if (startDate || endDate) {
      const dateQuery = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateQuery.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateQuery.$lte = end;
      }
      // Check if leave overlaps with the date range
      query.$or = [
        { startDate: dateQuery },
        { endDate: dateQuery },
        {
          $and: [
            { startDate: { $lte: dateQuery.$lte || new Date() } },
            { endDate: { $gte: dateQuery.$gte || new Date() } },
          ],
        },
      ];
    }

    // Filter by status if provided
    if (status) {
      query.status = status;
    }

    const leaves = await Leave.find(query)
      .populate("userId", "firstName lastName email")
      .populate("approvedBy", "firstName lastName")
      .populate("teamId", "name")
      .sort({ appliedAt: -1 });

    res.json({ leaves });
  } catch (error) {
    console.error("Error fetching all leaves:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Approve or reject leave
router.patch("/:leaveId/status", protect, async (req, res) => {
  try {
    const { leaveId } = req.params;
    const { status, rejectionReason } = req.body;
    const approverId = req.user.id;

    // Validate status
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const approver = await User.findById(approverId);
    if (!approver) {
      return res.status(404).json({ message: "Approver not found" });
    }

    // Check if user has permission (Team Head or Admin)
    if (!["Team Head", "Admin"].includes(approver.role)) {
      return res.status(403).json({
        message: "You do not have permission to approve/reject leaves",
      });
    }

    const leave = await Leave.findById(leaveId).populate("userId");
    if (!leave) {
      return res.status(404).json({ message: "Leave application not found" });
    }

    // Team Heads can only approve leaves from their team
    if (
      approver.role === "Team Head" &&
      leave.teamId.toString() !== approver.team.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only approve leaves from your team" });
    }

    // Update leave status
    leave.status = status;
    leave.approvedBy = approverId;
    leave.approverName = `${approver.firstName} ${approver.lastName}`;
    leave.approvedAt = new Date();

    if (status === "Rejected" && rejectionReason) {
      leave.rejectionReason = rejectionReason;
    }

    await leave.save();

    // Notify the applicant
    await Notification.create({
      recipient: leave.userId._id,
      type: "system",
      message: `Your ${leave.leaveType} application has been ${status.toLowerCase()} by ${approver.firstName} ${approver.lastName}`,
    });

    res.json({
      message: `Leave ${status.toLowerCase()} successfully`,
      leave,
    });
  } catch (error) {
    console.error("Error updating leave status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get leave statistics for a user
router.get("/stats/:userId", protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const user = await User.findById(req.user.id);
    const targetUserId = userId === "me" ? req.user.id : userId;

    // Check permissions
    if (userId !== "me" && !["Team Head", "Admin"].includes(user.role)) {
      return res.status(403).json({
        message: "You do not have permission to view other users' stats",
      });
    }

    let dateQuery = { userId: targetUserId, status: "Approved" };

    if (startDate || endDate) {
      dateQuery.startDate = {};
      if (startDate) {
        dateQuery.startDate.$gte = new Date(startDate);
      }
      if (endDate) {
        dateQuery.startDate.$lte = new Date(endDate);
      }
    }

    const approvedLeaves = await Leave.find(dateQuery);

    const totalDays = approvedLeaves.reduce(
      (sum, leave) => sum + leave.numberOfDays,
      0,
    );

    const leavesByType = approvedLeaves.reduce((acc, leave) => {
      acc[leave.leaveType] = (acc[leave.leaveType] || 0) + leave.numberOfDays;
      return acc;
    }, {});

    res.json({
      totalDays,
      totalLeaves: approvedLeaves.length,
      leavesByType,
      leaves: approvedLeaves,
    });
  } catch (error) {
    console.error("Error fetching leave stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a single leave by ID (for printing)
router.get("/:leaveId", protect, async (req, res) => {
  try {
    const { leaveId } = req.params;

    const leave = await Leave.findById(leaveId)
      .populate("userId", "firstName lastName email")
      .populate("approvedBy", "firstName lastName")
      .populate("teamId", "name");

    if (!leave) {
      return res.status(404).json({ message: "Leave application not found" });
    }

    res.json({ leave });
  } catch (error) {
    console.error("Error fetching leave:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Delete leave (only if pending and own leave)
router.delete("/:leaveId", protect, async (req, res) => {
  try {
    const { leaveId } = req.params;
    const userId = req.user.id;

    const leave = await Leave.findById(leaveId);
    if (!leave) {
      return res.status(404).json({ message: "Leave application not found" });
    }

    // Check if user owns this leave and it's still pending
    if (leave.userId.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "You can only delete your own leave applications" });
    }

    if (leave.status !== "Pending") {
      return res
        .status(400)
        .json({ message: "You can only delete pending leave applications" });
    }

    await Leave.findByIdAndDelete(leaveId);

    res.json({ message: "Leave application deleted successfully" });
  } catch (error) {
    console.error("Error deleting leave:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
