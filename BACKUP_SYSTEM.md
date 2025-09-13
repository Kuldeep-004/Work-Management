# Automatic Database Backup System

## Overview
This system provides automatic daily database backups to pCloud storage, complementing the existing manual backup functionality.

## Current Backup Button Analysis

### How it works:
1. **Frontend**: Settings page has a "Backup DB" button that triggers `/api/backup/database`
2. **Backend**: Creates MongoDB dump using `mongodump` command
3. **Process**: 
   - Generates filename: `Backup-{timestamp}.gz`
   - Uses `mongodump` with gzip compression
   - Streams file directly to browser for download
   - Cleans up temporary file after download
4. **Logging**: Uses ActivityLogger to track backup operations

### Status: ✅ WORKING PROPERLY
The manual backup functionality is robust with proper error handling, activity logging, and cleanup.

## New Automatic Backup System

### Features:
- **Daily Schedule**: Runs every day at 9:00 AM IST
- **pCloud Integration**: Uploads backups to your pCloud "Backup" folder
- **Date-based Naming**: Files named as `Backup-YYYY-MM-DD.gz`
- **Activity Logging**: Tracks success/failure in system logs
- **Error Handling**: Comprehensive error handling with cleanup

### Files Added/Modified:

#### 1. `/backend/utils/backupUtils.js` (NEW)
- `createAndUploadBackup()`: Main function for automated backups
- `uploadToPCloudBackup()`: Handles pCloud upload
- `logBackupActivity()`: Logs backup operations

#### 2. `/backend/automationScheduler.js` (MODIFIED)
- Added daily cron job: `cron.schedule('0 9 * * *', ...)`
- Imports backup utilities
- Runs at 9:00 AM IST daily

#### 3. `/backend/routes/backup.js` (MODIFIED)
- Added test route: `POST /api/backup/test-pcloud`
- For manual testing of pCloud backup functionality

## Environment Variables Required

You need to add this environment variable to your backend:

```env
PCLOUD_BACKUP_FOLDER_ID=your_backup_folder_id_here
```

### How to get the Backup Folder ID:

1. **Option 1 - Using pCloud API:**
   ```bash
   curl "https://api.pcloud.com/listfolder?auth=YOUR_PCLOUD_TOKEN&path=/Backup"
   ```
   Look for `folderid` in the response.

2. **Option 2 - Using pCloud Web Interface:**
   - Go to pcloud.com
   - Navigate to your Backup folder
   - Check the URL or use browser developer tools to find folder ID

3. **Option 3 - Create via API if it doesn't exist:**
   ```bash
   curl "https://api.pcloud.com/createfolder?auth=YOUR_PCLOUD_TOKEN&name=Backup&folderid=0"
   ```

## Current pCloud Configuration

Your system already has these pCloud environment variables:
- `PCLOUD_TOKEN` - Authentication token
- `PCLOUD_PUBLIC_PROFILE_FOLDER_ID` - For profile images  
- `PCLOUD_PUBLIC_FILES_FOLDER_ID` - For general files

## Testing the System

### Manual Test:
```bash
# Test the new pCloud backup functionality
curl -X POST http://localhost:5000/api/backup/test-pcloud \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

### Logs to Monitor:
- `[BackupScheduler]` - Automatic backup logs
- `[BackupTest]` - Manual test logs
- Activity logs in your database under system activities

## Backup Schedule

- **Time**: 9:00 AM IST daily
- **Timezone**: Asia/Kolkata
- **Frequency**: Every day (including weekends)
- **Location**: pCloud Backup folder
- **Retention**: Manual cleanup required (automatic cleanup can be added later)

## File Naming Convention

- **Manual Backup**: `Backup-2024-09-13T10-30-45-123Z.gz`
- **Automatic Backup**: `Backup-2024-09-13.gz`

The automatic backups use a simpler date-only format for easier organization.

## Error Handling

The system handles various error scenarios:
- MongoDB connection issues
- mongodump command not found
- pCloud upload failures
- Network connectivity issues
- File system errors

All errors are logged both to console and system activity logs.

## Benefits

1. **Automated**: No manual intervention required
2. **Cloud Storage**: Safe offsite backup storage
3. **Consistent**: Daily backups ensure minimal data loss
4. **Monitored**: All operations are logged and trackable
5. **Complements**: Works alongside existing manual backup system

## Next Steps

1. Add the `PCLOUD_BACKUP_FOLDER_ID` environment variable
2. Restart your backend server
3. Test using the test endpoint
4. Monitor logs for successful daily backups
5. Optional: Add backup retention policies (delete old backups)
6. Optional: Add notification system for backup failures
