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

    // Find ALL automations with task templates
    const allAutomations = await Automation.find({
      taskTemplate: { $exists: true, $ne: [] },
    })
      .select("_id name taskTemplate createdBy")
      .populate("createdBy", "firstName lastName");

    // Filter to find automations with invalid priorities
    const automationsWithInvalidPriorities = allAutomations.filter(
      (automation) =>
        automation.taskTemplate.some(
          (template) =>
            template.priority &&
            template.priority !== "" &&
            !validPriorityNames.includes(template.priority),
        ),
    );

    // Extract templates with invalid priorities
    const invalidAutomationTemplates = allAutomations.flatMap((automation) =>
      automation.taskTemplate
        .filter(
          (template) =>
            template.priority &&
            template.priority !== "" &&
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

    // Update automations with invalid priorities - fetch ALL automations and filter in code
    const allAutomations = await Automation.find({
      taskTemplate: { $exists: true, $ne: [] },
    });

    let automationUpdateCount = 0;
    let templateUpdateCount = 0;

    for (const automation of allAutomations) {
      let updated = false;
      automation.taskTemplate = automation.taskTemplate.map((template) => {
        if (
          template.priority &&
          template.priority !== "" &&
          !validPriorityNames.includes(template.priority)
        ) {
          console.log(
            `Updating automation "${automation.name}" template "${template.title}" priority from "${template.priority}" to "${defaultPriority}"`,
          );
          template.priority = defaultPriority;
          updated = true;
          templateUpdateCount++;
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
      `Cleaned up invalid priorities: ${taskUpdateResult.modifiedCount} tasks and ${automationUpdateCount} automations (${templateUpdateCount} templates) updated to "${defaultPriority}"`,
      null,
      {
        tasksUpdated: taskUpdateResult.modifiedCount,
        automationsUpdated: automationUpdateCount,
        templatesUpdated: templateUpdateCount,
        defaultPriority,
      },
      req,
    );

    res.json({
      message: "Invalid priorities fixed successfully",
      tasksUpdated: taskUpdateResult.modifiedCount,
      automationsUpdated: automationUpdateCount,
      templatesUpdated: templateUpdateCount,
    });
  } catch (error) {
    console.error("Error fixing invalid priorities:", error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
