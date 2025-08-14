import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        // Task actions
        'task_created', 'task_updated', 'task_deleted', 'task_status_changed',
        'task_priority_changed', 'task_assigned', 'task_unassigned', 'task_completed',
        'task_verified', 'task_rejected', 'task_file_uploaded', 'task_file_deleted',
        'task_comment_added', 'task_comment_updated', 'task_comment_deleted',
        'task_due_date_changed', 'task_target_date_changed', 'task_billed_status_changed',
        'task_custom_fields_updated', 'task_verification_accepted', 'task_verification_rejected',
        // Custom column actions
        'custom_column_created', 'custom_column_toggled',
       'custom_column_deleted',
        
        // Task Status actions
        'task_status_created', 'task_status_updated', 'task_status_deleted', 'task_status_reordered',
        
        // User actions
        'user_created', 'user_updated', 'user_deleted', 'user_status_changed',
        'user_role_changed', 'user_team_changed', 'user_approved', 'user_rejected',
        'user_profile_updated', 'user_password_changed', 'user_login', 'user_logout',
        'user_blocked', 'user_unblocked', 'user_verification_changed',
        
        // Team actions
        'team_created', 'team_updated', 'team_deleted', 'team_member_added',
        'team_member_removed', 'team_head_changed',
        
        // Client actions
        'client_created', 'client_updated', 'client_deleted', 'client_group_created',
        'client_group_updated', 'client_group_deleted', 'client_work_type_added',
        'client_work_type_removed',
        
        // Work Type actions
        'work_type_created', 'work_type_updated', 'work_type_deleted',
        
        // Priority actions
        'priority_created', 'priority_updated', 'priority_deleted',
        
        // Automation actions
        'automation_created', 'automation_updated', 'automation_deleted',
        'automation_executed', 'automation_triggered', 'automation_status_reset',
        'automation_task_template_added', 'automation_task_template_created',
        'automation_task_template_updated', 'automation_task_template_deleted',
        
        // Timesheet actions
        'timesheet_created', 'timesheet_updated', 'timesheet_deleted',
        'timesheet_submitted', 'timesheet_approved', 'timesheet_rejected',
        'timesheet_verified', 'timesheet_billed_status_changed',
        'timesheet_entry_added', 'timesheet_entry_updated', 'timesheet_entry_deleted',
        
        // Announcement actions
        'announcement_created', 'announcement_updated', 'announcement_deleted',
        'announcement_published', 'announcement_unpublished',
        
        // Notification actions
        'notification_created', 'notification_sent', 'notification_read',
        'notification_deleted', 'notifications_mark_all_read',
        'push_notification_unsubscribed',
        
        // System actions
        'system_backup_created', 'system_update',
        'data_export', 'data_import', 'bulk_operation',
        
        // Authentication actions
        'password_reset_requested', 'password_reset_completed', 'email_verified',
        'otp_generated', 'otp_verified', 'account_locked', 'account_unlocked',
        
        // File actions
        'file_uploaded', 'file_downloaded', 'file_deleted', 'file_shared',
        
        // Settings actions
        'settings_updated', 'configuration_changed', 'permission_changed',
        
        // Chat actions
        'chat_created', 'chat_deleted', 'chat_participant_added', 'chat_participant_removed',
        'chat_settings_updated', 'chat_left', 'message_sent', 'message_edited', 
        'message_deleted', 'message_replied', 'message_forwarded', 'message_reacted'
      ]
    },
    entity: {
      type: String,
      required: true,
      enum: [
        'Task', 'User', 'Team', 'Client', 'ClientGroup', 'WorkType', 
        'Priority', 'TaskStatus', 'Automation', 'Timesheet', 'Announcement', 
        'Notification', 'File', 'System', 'Settings', 'Chat', 'Message'
      ]
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: function() {
        return this.entity !== 'System';
      }
    },
    description: {
      type: String,
      required: true,
    },
    oldValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValues: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      ip: String,
      userAgent: String,
      route: String,
      method: String,
      statusCode: Number,
      responseTime: Number,
      fileDetails: {
        fileName: String,
        fileSize: Number,
        fileType: String,
        uploadPath: String,
      },
      bulkOperation: {
        totalRecords: Number,
        successCount: Number,
        failureCount: Number,
        errors: [String],
      },
      additionalData: mongoose.Schema.Types.Mixed,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    relatedEntities: [{
      entityType: String,
      entityId: mongoose.Schema.Types.ObjectId,
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ severity: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);

export default ActivityLog;
