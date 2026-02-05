import express from "express";
import Task from "../models/Task.js";
import Priority from "../models/Priority.js";
import Automation from "../models/Automation.js";
import { protect } from "../middleware/authMiddleware.js";
import admin from "../middleware/admin.js";
import ActivityLogger from "../utils/activityLogger.js";

const router = express.Router();

// Get tasks and automations with invalid priorities
router.get("/invalid-priorities", protect, admin, async (req, res) => {
  try {
    // Get all valid priorities
    const validPriorities = await Priority.find({}).select("name");
    const validPriorityNames = validPriorities.map((p) => p.name);

    // Find tasks with invalid priorities (including completed tasks)
    const tasksWithInvalidPriorities = await Task.find({
      priority: { $exists: true, $nin: validPriorityNames, $ne: null, $ne: "" },
    })
      .select(
        "_id title priority status assignedTo assignedBy createdAt clientName",
      )
      .populate("assignedTo assignedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    // Find automations with invalid priorities in task templates
    const automationsWithInvalidPriorities = await Automation.find({
      "taskTemplate.priority": {
        $exists: true,
        $nin: validPriorityNames,
        $ne: null,
        $ne: "",
      },
    })
      .select("_id name taskTemplate createdBy")
      .populate("createdBy", "firstName lastName");

    // Extract templates with invalid priorities
    const invalidAutomationTemplates = automationsWithInvalidPriorities.flatMap(
      (automation) =>
        automation.taskTemplate
          .filter(
            (template) =>
              template.priority &&
              !validPriorityNames.includes(template.priority),
          )
          .map((template) => ({
            automationId: automation._id,
            automationName: automation.name,
            templateTitle: template.title,
            priority: template.priority,
          })),
    );

    res.json({
      tasks: tasksWithInvalidPriorities,
      automations: automationsWithInvalidPriorities,
      invalidAutomationTemplates,
      validPriorities: validPriorityNames,
    });
  } catch (error) {
    console.error("Error finding invalid priorities:", error);
    res.status(500).json({ message: error.message });
  }
});

// Fix tasks with invalid priorities by setting them to a default priority
router.post("/fix-invalid-priorities", protect, admin, async (req, res) => {
  try {
    const { defaultPriority } = req.body;

    if (!defaultPriority) {
      return res.status(400).json({ message: "Default priority is required" });
    }

    // Verify that the default priority exists
    const priorityExists = await Priority.findOne({ name: defaultPriority });
    if (!priorityExists) {
      return res
        .status(400)
        .json({ message: "The specified default priority does not exist" });
    }

    // Get all valid priorities
    const validPriorities = await Priority.find({}).select("name");
    const validPriorityNames = validPriorities.map((p) => p.name);

    // Update tasks with invalid priorities
    const taskUpdateResult = await Task.updateMany(
      {
        priority: {
          $exists: true,
          $nin: validPriorityNames,
          $ne: null,
          $ne: "",
        },
      },
      {
        $set: { priority: defaultPriority },
      },
    );

    // Update automations with invalid priorities
    const automations = await Automation.find({
      "taskTemplate.priority": {
        $exists: true,
        $nin: validPriorityNames,
        $ne: null,
        $ne: "",
      },
    });

    let automationUpdateCount = 0;
    for (const automation of automations) {
      let updated = false;
      automation.taskTemplate = automation.taskTemplate.map((template) => {
        if (
          template.priority &&
          !validPriorityNames.includes(template.priority)
        ) {
          template.priority = defaultPriority;
          updated = true;
        }
        return template;
      });

      if (updated) {
        await automation.save();
        automationUpdateCount++;
      }
    }

    // Log cleanup activity
    await ActivityLogger.logSystemActivity(
      req.user._id,
      "priorities_cleanup",
      null,
      `Cleaned up invalid priorities: ${taskUpdateResult.modifiedCount} tasks and ${automationUpdateCount} automations updated to "${defaultPriority}"`,
      null,
      {
        tasksUpdated: taskUpdateResult.modifiedCount,
        automationsUpdated: automationUpdateCount,
        defaultPriority,
      },
      req,
    );

    res.json({
      message: "Invalid priorities fixed successfully",
      tasksUpdated: taskUpdateResult.modifiedCount,
      automationsUpdated: automationUpdateCount,
    });
  } catch (error) {
    console.error("Error fixing invalid priorities:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
