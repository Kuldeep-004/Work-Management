import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import axios from "axios";
import FormData from "form-data";
import ActivityLogger from "./activityLogger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PCLOUD_TOKEN = process.env.PCLOUD_TOKEN;
const PCLOUD_API = "https://api.pcloud.com";
const PCLOUD_BACKUP_FOLDER_ID = process.env.PCLOUD_BACKUP_FOLDER_ID;

/**
 * Create a MongoDB backup locally for email attachment
 * @param {Date} date - Date for the backup (defaults to current date)
 * @returns {Promise<string>} - Path to the backup file
 */
export const createLocalBackup = async (date = new Date()) => {
  // Format date as YYYY-MM-DD for filename
  const dateStr = date.toISOString().split("T")[0];
  const backupFileName = `Backup-${dateStr}.gz`;
  const backupDir = path.join(__dirname, "..", "reports");
  const backupPath = path.join(backupDir, backupFileName);

  try {
    // Create reports directory if it doesn't exist
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

    console.log(
      `[DailyEmailScheduler] Creating local backup: ${backupFileName}`,
    );

    // Create mongodump process
    const mongodumpArgs = [
      ...connectionOptions,
      "--gzip",
      "--archive=" + backupPath,
    ];

    // Create backup using mongodump
    await new Promise((resolve, reject) => {
      const mongodump = spawn("mongodump", mongodumpArgs);
      let errorOutput = "";

      mongodump.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      mongodump.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Mongodump failed with code ${code}: ${errorOutput}`),
          );
        } else {
          resolve({ success: true });
        }
      });

      mongodump.on("error", (spawnError) => {
        if (spawnError.code === "ENOENT") {
          reject(
            new Error(
              "mongodump command not found. Please ensure MongoDB Database Tools are installed.",
            ),
          );
        } else {
          reject(
            new Error(`Error starting backup process: ${spawnError.message}`),
          );
        }
      });
    });

    // Verify backup file was created
    if (!fs.existsSync(backupPath)) {
      throw new Error("Backup file was not created");
    }

    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      throw new Error("Backup file is empty");
    }

    console.log(
      `[DailyEmailScheduler] Local backup created successfully: ${Math.round((stats.size / 1024 / 1024) * 100) / 100} MB`,
    );

    return backupPath;
  } catch (error) {
    console.error(
      `[DailyEmailScheduler] Local backup creation failed:`,
      error.message,
    );

    // Clean up failed backup file if it exists
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (cleanupError) {
      console.warn(
        `[DailyEmailScheduler] Warning: Could not clean up failed backup file: ${cleanupError.message}`,
      );
    }

    throw error;
  }
};

/**
 * Create a MongoDB backup and upload it to pCloud Backup folder
 * @param {Date} date - Date for the backup (defaults to current date)
 * @returns {Promise<Object>} - Result object with success status and details
 */
export const createAndUploadBackup = async (date = new Date()) => {
  const startTime = Date.now();

  // Format date as YYYY-MM-DD for filename
  const dateStr = date.toISOString().split("T")[0];
  const backupFileName = `Backup-${dateStr}.gz`;
  const backupDir = path.join(__dirname, "..", "backups");
  const backupPath = path.join(backupDir, backupFileName);

  try {
    // Validate pCloud configuration
    if (!PCLOUD_TOKEN) {
      throw new Error("PCLOUD_TOKEN environment variable is not set");
    }

    if (!PCLOUD_BACKUP_FOLDER_ID) {
      throw new Error(
        "PCLOUD_BACKUP_FOLDER_ID environment variable is not set",
      );
    }

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

    console.log(
      `[BackupScheduler] Starting automated backup: ${backupFileName}`,
    );

    // Create mongodump process
    const mongodumpArgs = [
      ...connectionOptions,
      "--gzip",
      "--archive=" + backupPath,
    ];

    // Create backup using mongodump
    const backupResult = await new Promise((resolve, reject) => {
      const mongodump = spawn("mongodump", mongodumpArgs);
      let errorOutput = "";

      mongodump.stderr.on("data", (data) => {
        errorOutput += data.toString();
        // Don't log normal mongodump progress as errors
        if (
          !data.toString().includes("writing ") &&
          !data.toString().includes("done dumping")
        ) {
          console.error("[BackupScheduler] mongodump stderr:", data.toString());
        }
      });

      mongodump.on("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(`Mongodump failed with code ${code}: ${errorOutput}`),
          );
        } else {
          resolve({ success: true });
        }
      });

      mongodump.on("error", (spawnError) => {
        if (spawnError.code === "ENOENT") {
          reject(
            new Error(
              "mongodump command not found. Please ensure MongoDB Database Tools are installed.",
            ),
          );
        } else {
          reject(
            new Error(`Error starting backup process: ${spawnError.message}`),
          );
        }
      });
    });

    // Verify backup file was created
    if (!fs.existsSync(backupPath)) {
      throw new Error("Backup file was not created");
    }

    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      throw new Error("Backup file is empty");
    }

    console.log(
      `[BackupScheduler] Backup created successfully: ${Math.round((stats.size / 1024 / 1024) * 100) / 100} MB`,
    );

    // Upload to pCloud
    const uploadResult = await uploadToPCloudBackup(backupPath, backupFileName);

    // Clean up local backup file
    try {
      fs.unlinkSync(backupPath);
      console.log(
        `[BackupScheduler] Local backup file cleaned up: ${backupPath}`,
      );
    } catch (cleanupError) {
      console.warn(
        `[BackupScheduler] Warning: Could not clean up local backup file: ${cleanupError.message}`,
      );
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    const result = {
      success: true,
      fileName: backupFileName,
      fileSize: stats.size,
      fileSizeMB: Math.round((stats.size / 1024 / 1024) * 100) / 100,
      pcloudFileId: uploadResult.fileId,
      pcloudUrl: uploadResult.url,
      duration: duration,
      timestamp: new Date().toISOString(),
    };

    console.log(
      `[BackupScheduler] Automated backup completed successfully in ${duration}s`,
    );

    return result;
  } catch (error) {
    console.error(`[BackupScheduler] Automated backup failed:`, error.message);

    // Clean up local backup file if it exists
    try {
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    } catch (cleanupError) {
      console.warn(
        `[BackupScheduler] Warning: Could not clean up failed backup file: ${cleanupError.message}`,
      );
    }

    throw error;
  }
};

/**
 * Upload backup file to pCloud Backup folder
 * @param {string} filePath - Local file path
 * @param {string} fileName - Target filename in pCloud
 * @returns {Promise<Object>} - Upload result with file ID and URL
 */
const uploadToPCloudBackup = async (filePath, fileName) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`[BackupScheduler] Uploading to pCloud: ${fileName}`);

    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));
    form.append("filename", fileName);

    const uploadRes = await axios.post(
      `${PCLOUD_API}/uploadfile?auth=${PCLOUD_TOKEN}&folderid=${PCLOUD_BACKUP_FOLDER_ID}`,
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000, // 5 minute timeout for large backups
      },
    );

    if (uploadRes.data.result !== 0) {
      throw new Error(
        `pCloud upload failed: ${uploadRes.data.error || "Unknown error"}`,
      );
    }

    // Handle metadata response
    const meta = uploadRes.data?.metadata;
    let fileMeta = null;

    if (Array.isArray(meta)) {
      if (meta.length > 0) {
        fileMeta = meta[0];
      } else {
        throw new Error("Upload failed: metadata array is empty");
      }
    } else if (meta && typeof meta === "object" && meta.fileid) {
      fileMeta = meta;
    } else {
      throw new Error(
        `Upload failed: metadata is missing or malformed. Received: ${JSON.stringify(meta)}`,
      );
    }

    console.log(
      `[BackupScheduler] Successfully uploaded to pCloud: File ID ${fileMeta.fileid}`,
    );

    return {
      fileId: fileMeta.fileid,
      fileName: fileMeta.name,
      fileSize: fileMeta.size,
      url: `pcloud://file/${fileMeta.fileid}`, // Internal reference URL
    };
  } catch (error) {
    console.error(
      "[BackupScheduler] pCloud upload error:",
      error.response?.data || error.message,
    );
    throw new Error(`Failed to upload backup to pCloud: ${error.message}`);
  }
};

/**
 * Log backup activity for tracking and monitoring
 * @param {Object} result - Backup result object
 * @param {Object} error - Error object if backup failed
 * @param {string} userId - User ID (system user for automated backups)
 */
export const logBackupActivity = async (
  result = null,
  error = null,
  userId = "system",
) => {
  try {
    if (result) {
      // Log successful backup
      await ActivityLogger.logSystemActivity(
        userId,
        "automated_database_backup_completed",
        null,
        `Automated database backup completed successfully`,
        null,
        {
          fileName: result.fileName,
          fileSize: result.fileSize,
          fileSizeMB: result.fileSizeMB,
          pcloudFileId: result.pcloudFileId,
          duration: result.duration,
          timestamp: result.timestamp,
        },
      );
    } else if (error) {
      // Log failed backup
      await ActivityLogger.logSystemActivity(
        userId,
        "automated_database_backup_failed",
        null,
        `Automated database backup failed`,
        null,
        {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      );
    }
  } catch (logError) {
    console.error(
      "[BackupScheduler] Error logging backup activity:",
      logError.message,
    );
  }
};
