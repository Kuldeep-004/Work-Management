import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { protect } from "../middleware/authMiddleware.js";
import admin from "../middleware/admin.js";
import ActivityLogger from "../utils/activityLogger.js";
import {
  createAndUploadBackup,
  logBackupActivity,
  createLocalBackup,
} from "../utils/backupUtils.js";
import {
  generateTimesheetPDF,
  getPreviousWorkingDay,
} from "../utils/timesheetReportUtils.js";
import { sendDailyBackupEmail } from "../utils/emailUtils.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import Priority from "../models/Priority.js";
import TaskStatus from "../models/TaskStatus.js";
import WorkType from "../models/WorkType.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Create and download MongoDB backup (Admin only)
router.get("/database", protect, admin, async (req, res) => {
  // Expose Content-Disposition header for CORS
  res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFileName = `Backup-${timestamp}.gz`;
  const backupDir = path.join(__dirname, "..", "backups");
  const backupPath = path.join(backupDir, backupFileName);

  try {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Parse MongoDB URI to get connection details
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/Work";
    let connectionOptions = [];

    if (mongoUri.includes("mongodb+srv://")) {
      // MongoDB Atlas connection
      connectionOptions = ["--uri", mongoUri];
    } else {
      // Local MongoDB connection
      const url = new URL(mongoUri.replace("mongodb://", "http://"));
      connectionOptions = [
        "--host",
        url.hostname,
        "--port",
        url.port || "27017",
        "--db",
        url.pathname.slice(1),
      ];
      if (url.username && url.password) {
        connectionOptions.push(
          "--username",
          url.username,
          "--password",
          url.password,
        );
      }
    }

    // Log backup initiation
    try {
      await ActivityLogger.logSystemActivity(
        req.user._id,
        "database_backup_initiated",
        null,
        `Initiated MongoDB database backup`,
        null,
        { backupFileName },
        req,
      );
    } catch (logError) {
      console.error("Error logging backup initiation:", logError.message);
    }

    // Create mongodump process
    const mongodumpArgs = [
      ...connectionOptions,
      "--gzip",
      "--archive=" + backupPath,
    ];

    const mongodump = spawn("mongodump", mongodumpArgs);

    let errorOutput = "";

    mongodump.stderr.on("data", (data) => {
      errorOutput += data.toString();
      // Don't log normal mongodump progress as errors - they're just informational
      if (
        !data.toString().includes("writing ") &&
        !data.toString().includes("done dumping")
      ) {
        console.error("mongodump stderr:", data.toString());
      }
    });

    mongodump.on("close", async (code) => {
      if (code !== 0) {
        console.error("mongodump failed with code:", code);
        console.error("Error output:", errorOutput);

        // Log backup failure
        try {
          await ActivityLogger.logSystemActivity(
            req.user._id,
            "database_backup_failed",
            null,
            `Database backup failed`,
            null,
            { errorCode: code, error: errorOutput },
            req,
          );
        } catch (logError) {
          console.error("Error logging backup failure:", logError.message);
        }

        return res.status(500).json({
          message: "Backup failed",
          error: errorOutput || `Process exited with code ${code}`,
        });
      }

      try {
        // Check if backup file exists and has content
        if (!fs.existsSync(backupPath)) {
          throw new Error("Backup file was not created");
        }

        const stats = fs.statSync(backupPath);
        if (stats.size === 0) {
          throw new Error("Backup file is empty");
        }

        // Log successful backup
        try {
          await ActivityLogger.logSystemActivity(
            req.user._id,
            "database_backup_completed",
            null,
            `Database backup completed successfully`,
            null,
            {
              backupFileName,
              fileSize: stats.size,
              fileSizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
            },
            req,
          );
        } catch (logError) {
          console.error("Error logging backup completion:", logError.message);
        }

        // Set headers for file download
        res.setHeader("Content-Type", "application/gzip");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${backupFileName}"`,
        );
        res.setHeader("Content-Length", stats.size);

        // Stream the file to the response
        const fileStream = fs.createReadStream(backupPath);

        fileStream.on("end", () => {
          // Clean up the backup file after download
          setTimeout(() => {
            try {
              if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
                console.log("Backup file cleaned up:", backupPath);
              }
            } catch (cleanupError) {
              console.error("Error cleaning up backup file:", cleanupError);
            }
          }, 1000); // Wait 1 second before cleanup
        });

        fileStream.on("error", (streamError) => {
          console.error("Error streaming file:", streamError);
          if (!res.headersSent) {
            res.status(500).json({ message: "Error streaming backup file" });
          }
        });

        fileStream.pipe(res);
      } catch (fileError) {
        console.error("Error processing backup file:", fileError);

        // Log backup processing failure
        try {
          await ActivityLogger.logSystemActivity(
            req.user._id,
            "database_backup_processing_failed",
            null,
            `Database backup processing failed`,
            null,
            { error: fileError.message },
            req,
          );
        } catch (logError) {
          console.error(
            "Error logging backup processing failure:",
            logError.message,
          );
        }

        if (!res.headersSent) {
          res.status(500).json({
            message: "Error processing backup file",
            error: fileError.message,
          });
        }
      }
    });

    mongodump.on("error", async (spawnError) => {
      console.error("Error spawning mongodump:", spawnError);

      // Log spawn error
      try {
        await ActivityLogger.logSystemActivity(
          req.user._id,
          "database_backup_spawn_failed",
          null,
          `Failed to start database backup process`,
          null,
          { error: spawnError.message },
          req,
        );
      } catch (logError) {
        console.error("Error logging backup spawn failure:", logError.message);
      }

      if (!res.headersSent) {
        if (spawnError.code === "ENOENT") {
          res.status(500).json({
            message:
              "mongodump command not found. Please ensure MongoDB Database Tools are installed on the server.",
            error: spawnError.message,
          });
        } else {
          res.status(500).json({
            message: "Error starting backup process",
            error: spawnError.message,
          });
        }
      }
    });
  } catch (error) {
    console.error("Backup route error:", error);

    // Log general backup error
    try {
      await ActivityLogger.logSystemActivity(
        req.user._id,
        "database_backup_error",
        null,
        `Database backup encountered an error`,
        null,
        { error: error.message },
        req,
      );
    } catch (logError) {
      console.error("Error logging backup error:", logError.message);
    }

    res.status(500).json({
      message: "Internal server error during backup",
      error: error.message,
    });
  }
});

// Get all users for Excel export dropdown
router.get("/users", protect, admin, async (req, res) => {
  try {
    const users = await User.find({
      isEmailVerified: true,
      status: { $ne: "rejected" },
    })
      .select("firstName lastName email")
      .sort({ firstName: 1 });

    res.json(users);
  } catch (error) {
    console.error("Error fetching users for backup:", error);
    res.status(500).json({
      message: "Error fetching users",
      error: error.message,
    });
  }
});

// Get tasks by user for Excel export
router.get("/tasks/:userId", protect, admin, async (req, res) => {
  try {
    const { userId } = req.params;

    const tasks = await Task.find({ assignedTo: userId })
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName email")
      .populate("verificationAssignedTo", "firstName lastName email")
      .populate("secondVerificationAssignedTo", "firstName lastName email")
      .populate("thirdVerificationAssignedTo", "firstName lastName email")
      .populate("fourthVerificationAssignedTo", "firstName lastName email")
      .populate("fifthVerificationAssignedTo", "firstName lastName email")
      .populate("guides", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks for user:", error);
    res.status(500).json({
      message: "Error fetching tasks for user",
      error: error.message,
    });
  }
});

// Get all data for complete Excel export
router.get("/all-data", protect, admin, async (req, res) => {
  try {
    // Fetch all data in parallel
    const [tasks, priorities, taskStatuses, workTypes] = await Promise.all([
      Task.find({})
        .populate("assignedTo", "firstName lastName email")
        .populate("assignedBy", "firstName lastName email")
        .populate("verificationAssignedTo", "firstName lastName email")
        .populate("secondVerificationAssignedTo", "firstName lastName email")
        .populate("thirdVerificationAssignedTo", "firstName lastName email")
        .populate("fourthVerificationAssignedTo", "firstName lastName email")
        .populate("fifthVerificationAssignedTo", "firstName lastName email")
        .populate("guides", "firstName lastName email")
        .sort({ createdAt: -1 }),

      // Get all priorities (including default ones)
      Priority.find({ isDefault: false }).sort({ order: 1, createdAt: 1 }),

      // Get all task statuses
      TaskStatus.find({}).sort({ order: 1, createdAt: 1 }),

      // Get all work types
      WorkType.find({}).sort({ name: 1 }),
    ]);

    // Add default priorities
    const defaultPriorities = [
      { name: "urgent", isDefault: true, order: 1 },
      { name: "today", isDefault: true, order: 2 },
      { name: "lessThan3Days", isDefault: true, order: 3 },
      { name: "thisWeek", isDefault: true, order: 4 },
      { name: "thisMonth", isDefault: true, order: 5 },
      { name: "regular", isDefault: true, order: 6 },
      { name: "filed", isDefault: true, order: 7 },
      { name: "dailyWorksOffice", isDefault: true, order: 8 },
      { name: "monthlyWorks", isDefault: true, order: 9 },
    ];
    const allPriorities = [...defaultPriorities, ...priorities];

    res.json({
      tasks,
      priorities: allPriorities,
      taskStatuses,
      workTypes,
    });
  } catch (error) {
    console.error("Error fetching all data:", error);
    res.status(500).json({
      message: "Error fetching all data",
      error: error.message,
    });
  }
});

// Test route for pCloud backup functionality (Admin only)
router.post("/test-pcloud", protect, admin, async (req, res) => {
  try {
    console.log("[BackupTest] Testing pCloud backup functionality");

    const result = await createAndUploadBackup();
    await logBackupActivity(result, null, req.user._id);

    res.json({
      success: true,
      message: "pCloud backup test completed successfully",
      data: {
        fileName: result.fileName,
        fileSize: result.fileSizeMB + " MB",
        pcloudFileId: result.pcloudFileId,
        duration: result.duration + " seconds",
        timestamp: result.timestamp,
      },
    });
  } catch (error) {
    await logBackupActivity(null, error, req.user._id);
    console.error("[BackupTest] pCloud backup test failed:", error.message);

    res.status(500).json({
      success: false,
      message: "pCloud backup test failed",
      error: error.message,
    });
  }
});

// Test route for daily backup and timesheet email (Admin only)
router.post("/test-daily-email", protect, admin, async (req, res) => {
  let backupFilePath = null;
  let timesheetFilePath = null;

  try {
    console.log(
      "[DailyEmailTest] Starting test of daily backup and timesheets email...",
    );

    // Get all admin users
    const adminUsers = await User.find({
      role: "Admin",
      status: "approved",
      isEmailVerified: true,
    }).select("email firstName lastName");

    if (adminUsers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No admin users found",
      });
    }

    const adminEmails = adminUsers.map((user) => user.email);

    // Create local backup for email attachment
    try {
      backupFilePath = await createLocalBackup();
    } catch (backupError) {
      console.error(
        "[DailyEmailTest] Backup creation failed:",
        backupError.message,
      );
    }

    // Generate timesheets report for previous working day
    const previousWorkingDay = getPreviousWorkingDay();
    try {
      timesheetFilePath = await generateTimesheetPDF(previousWorkingDay);
    } catch (timesheetError) {
      console.error(
        "[DailyEmailTest] Timesheet generation failed:",
        timesheetError.message,
      );
    }

    // Send email
    if (backupFilePath || timesheetFilePath) {
      await sendDailyBackupEmail(
        adminEmails,
        backupFilePath,
        timesheetFilePath,
        new Date(),
        previousWorkingDay,
      );

      // Clean up temporary files
      if (backupFilePath && fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath);
      }
      if (timesheetFilePath && fs.existsSync(timesheetFilePath)) {
        fs.unlinkSync(timesheetFilePath);
      }

      res.json({
        success: true,
        message: "Daily backup and timesheet email sent successfully",
        data: {
          recipients: adminEmails,
          backupIncluded: !!backupFilePath,
          timesheetIncluded: !!timesheetFilePath,
          timesheetDate: previousWorkingDay.toISOString().split("T")[0],
        },
      });
    } else {
      res.status(400).json({
        success: false,
        message: "No files could be generated for the email",
      });
    }
  } catch (error) {
    console.error("[DailyEmailTest] Test failed:", error.message);

    // Clean up on error
    try {
      if (backupFilePath && fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath);
      }
      if (timesheetFilePath && fs.existsSync(timesheetFilePath)) {
        fs.unlinkSync(timesheetFilePath);
      }
    } catch (cleanupError) {
      console.warn("[DailyEmailTest] Cleanup error:", cleanupError.message);
    }

    res.status(500).json({
      success: false,
      message: "Daily email test failed",
      error: error.message,
    });
  }
});

export default router;
