import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { protect } from '../middleware/authMiddleware.js';
import admin from '../middleware/admin.js';
import ActivityLogger from '../utils/activityLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Create and download MongoDB backup (Admin only)
router.get('/database', protect, admin, async (req, res) => {
  // Expose Content-Disposition header for CORS
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `Backup-${timestamp}.gz`;
  const backupDir = path.join(__dirname, '..', 'backups');
  const backupPath = path.join(backupDir, backupFileName);

  try {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Parse MongoDB URI to get connection details
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/Work';
    let connectionOptions = [];
    
    if (mongoUri.includes('mongodb+srv://')) {
      // MongoDB Atlas connection
      connectionOptions = ['--uri', mongoUri];
    } else {
      // Local MongoDB connection
      const url = new URL(mongoUri.replace('mongodb://', 'http://'));
      connectionOptions = ['--host', url.hostname, '--port', url.port || '27017', '--db', url.pathname.slice(1)];
      if (url.username && url.password) {
        connectionOptions.push('--username', url.username, '--password', url.password);
      }
    }

    // Log backup initiation
    try {
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'database_backup_initiated',
        null,
        `Initiated MongoDB database backup`,
        null,
        { backupFileName },
        req
      );
    } catch (logError) {
      console.error('Error logging backup initiation:', logError.message);
    }

    // Create mongodump process
    const mongodumpArgs = [
      ...connectionOptions,
      '--gzip',
      '--archive=' + backupPath
    ];

    const mongodump = spawn('mongodump', mongodumpArgs);

    let errorOutput = '';

    mongodump.stderr.on('data', (data) => {
      errorOutput += data.toString();
      // Don't log normal mongodump progress as errors - they're just informational
      if (!data.toString().includes('writing ') && !data.toString().includes('done dumping')) {
        console.error('mongodump stderr:', data.toString());
      }
    });

    mongodump.on('close', async (code) => {
      if (code !== 0) {
        console.error('mongodump failed with code:', code);
        console.error('Error output:', errorOutput);
        
        // Log backup failure
        try {
          await ActivityLogger.logSystemActivity(
            req.user._id,
            'database_backup_failed',
            null,
            `Database backup failed`,
            null,
            { errorCode: code, error: errorOutput },
            req
          );
        } catch (logError) {
          console.error('Error logging backup failure:', logError.message);
        }
        
        return res.status(500).json({ 
          message: 'Backup failed', 
          error: errorOutput || `Process exited with code ${code}` 
        });
      }

      try {
        // Check if backup file exists and has content
        if (!fs.existsSync(backupPath)) {
          throw new Error('Backup file was not created');
        }

        const stats = fs.statSync(backupPath);
        if (stats.size === 0) {
          throw new Error('Backup file is empty');
        }

        // Log successful backup
        try {
          await ActivityLogger.logSystemActivity(
            req.user._id,
            'database_backup_completed',
            null,
            `Database backup completed successfully`,
            null,
            { 
              backupFileName, 
              fileSize: stats.size,
              fileSizeMB: Math.round(stats.size / 1024 / 1024 * 100) / 100
            },
            req
          );
        } catch (logError) {
          console.error('Error logging backup completion:', logError.message);
        }

        // Set headers for file download
        res.setHeader('Content-Type', 'application/gzip');
        res.setHeader('Content-Disposition', `attachment; filename="${backupFileName}"`);
        res.setHeader('Content-Length', stats.size);

        // Stream the file to the response
        const fileStream = fs.createReadStream(backupPath);
        
        fileStream.on('end', () => {
          // Clean up the backup file after download
          setTimeout(() => {
            try {
              if (fs.existsSync(backupPath)) {
                fs.unlinkSync(backupPath);
                console.log('Backup file cleaned up:', backupPath);
              }
            } catch (cleanupError) {
              console.error('Error cleaning up backup file:', cleanupError);
            }
          }, 1000); // Wait 1 second before cleanup
        });

        fileStream.on('error', (streamError) => {
          console.error('Error streaming file:', streamError);
          if (!res.headersSent) {
            res.status(500).json({ message: 'Error streaming backup file' });
          }
        });

        fileStream.pipe(res);

      } catch (fileError) {
        console.error('Error processing backup file:', fileError);
        
        // Log backup processing failure
        try {
          await ActivityLogger.logSystemActivity(
            req.user._id,
            'database_backup_processing_failed',
            null,
            `Database backup processing failed`,
            null,
            { error: fileError.message },
            req
          );
        } catch (logError) {
          console.error('Error logging backup processing failure:', logError.message);
        }

        if (!res.headersSent) {
          res.status(500).json({ message: 'Error processing backup file', error: fileError.message });
        }
      }
    });

    mongodump.on('error', async (spawnError) => {
      console.error('Error spawning mongodump:', spawnError);
      
      // Log spawn error
      try {
        await ActivityLogger.logSystemActivity(
          req.user._id,
          'database_backup_spawn_failed',
          null,
          `Failed to start database backup process`,
          null,
          { error: spawnError.message },
          req
        );
      } catch (logError) {
        console.error('Error logging backup spawn failure:', logError.message);
      }

      if (!res.headersSent) {
        if (spawnError.code === 'ENOENT') {
          res.status(500).json({ 
            message: 'mongodump command not found. Please ensure MongoDB Database Tools are installed on the server.',
            error: spawnError.message 
          });
        } else {
          res.status(500).json({ 
            message: 'Error starting backup process', 
            error: spawnError.message 
          });
        }
      }
    });

  } catch (error) {
    console.error('Backup route error:', error);
    
    // Log general backup error
    try {
      await ActivityLogger.logSystemActivity(
        req.user._id,
        'database_backup_error',
        null,
        `Database backup encountered an error`,
        null,
        { error: error.message },
        req
      );
    } catch (logError) {
      console.error('Error logging backup error:', logError.message);
    }

    res.status(500).json({ 
      message: 'Internal server error during backup', 
      error: error.message 
    });
  }
});

export default router;
