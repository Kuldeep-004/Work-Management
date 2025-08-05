# Comprehensive Activity Logging System

## Overview

This system provides complete activity tracking for the Work Management application, capturing every action performed by users across all modules. The system is designed to be comprehensive, capturing minor details for audit and monitoring purposes.

## System Components

### 1. Backend Components

#### ActivityLog Model (`/backend/models/ActivityLog.js`)
- Comprehensive schema for storing all activity data
- Supports various entity types and action types
- Includes metadata like IP address, user agent, timestamps
- Stores old and new values for audit trail
- Supports severity levels for prioritization

#### ActivityLogger Utility (`/backend/utils/activityLogger.js`)
- Central logging utility with helper methods for different entity types
- Provides severity level determination
- Includes methods for bulk operations and cleanup
- Supports comprehensive metadata collection

#### Activity Logger Middleware (`/backend/middleware/activityLoggerMiddleware.js`)
- Automatic activity logging for all HTTP requests
- Intelligent action determination based on routes and methods
- Configurable filtering to skip irrelevant requests
- Request/response metadata collection

#### Activity Logs Routes (`/backend/routes/activityLogs.js`)
- REST API endpoints for activity log management
- Advanced filtering and pagination
- Statistics and analytics endpoints
- CSV export functionality
- Admin-only maintenance endpoints

### 2. Frontend Components

#### Activity Logs Page (`/frontend/src/pages/dashboard/ActivityLogs.jsx`)
- Comprehensive dashboard for viewing all activities
- Advanced filtering by user, entity, action, severity, date range
- Real-time statistics and overview cards
- Detailed activity modal with full metadata display
- CSV export functionality
- Restricted to Admin and Team Head roles

### 3. Integration Points

#### Server Setup (`/backend/server.js`)
- Activity logging middleware integrated before routes
- Activity logs route mounted at `/api/activity-logs`

#### Dashboard Layout (`/frontend/src/layouts/DashboardLayout.jsx`)
- Activity Logs menu item added for Admin and Team Head roles
- Proper icon and navigation setup

#### Route Definitions (`/frontend/src/pages/Dashboard.jsx`)
- Activity Logs route configured for appropriate user roles

## Activity Types Tracked

### Task Activities
- `task_created` - New task creation
- `task_updated` - Task updates (any field)
- `task_deleted` - Task deletion
- `task_status_changed` - Status modifications
- `task_priority_changed` - Priority updates
- `task_assigned` - Task assignment changes
- `task_verified` - Task verification/approval
- `task_rejected` - Task rejection
- `task_file_uploaded` - File attachments
- `task_file_deleted` - File removals
- `task_comment_added` - Comments and notes

### User Activities
- `user_created` - New user registration
- `user_updated` - Profile updates
- `user_deleted` - User removal
- `user_approved` - User approval by admin
- `user_rejected` - User rejection by admin
- `user_role_changed` - Role modifications
- `user_team_changed` - Team assignments
- `user_blocked` - User blocking
- `user_unblocked` - User unblocking
- `user_login` - Login activities
- `user_logout` - Logout activities

### Team Activities
- `team_created` - New team creation
- `team_updated` - Team modifications
- `team_deleted` - Team removal
- `team_member_added` - Adding team members
- `team_member_removed` - Removing team members
- `team_head_changed` - Team head assignments

### Client Activities
- `client_created` - New client creation
- `client_updated` - Client modifications
- `client_deleted` - Client removal
- `client_group_created` - Client group creation
- `client_group_updated` - Client group modifications
- `client_work_type_added` - Work type associations

### System Activities
- `password_reset_requested` - Password reset requests
- `password_reset_completed` - Password resets
- `email_verified` - Email verifications
- `data_export` - Data export operations
- `system_maintenance` - System maintenance tasks

### File Activities
- `file_uploaded` - File uploads
- `file_downloaded` - File downloads
- `file_deleted` - File deletions
- `file_shared` - File sharing

## Severity Levels

### Critical
- User deletions
- Account lockouts/unlocks
- Data deletions
- Security-related events

### High
- User creations and approvals
- Role changes
- Team modifications
- Task verifications
- System errors

### Medium
- Task updates
- Profile changes
- Regular operations
- Configuration changes

### Low
- File operations
- Login/logout
- View operations
- Minor updates

## API Endpoints

### Get Activity Logs
```
GET /api/activity-logs
Query Parameters:
- page: Page number (default: 1)
- limit: Items per page (default: 50)
- search: Search term
- entity: Filter by entity type
- action: Filter by action type
- severity: Filter by severity level
- userId: Filter by user
- startDate: Start date filter
- endDate: End date filter
- sortBy: Sort field (default: createdAt)
- sortOrder: Sort order (default: desc)
```

### Get Activity Statistics
```
GET /api/activity-logs/stats
Query Parameters:
- startDate: Start date for statistics
- endDate: End date for statistics
- groupBy: Grouping interval (hour, day, week, month)
```

### Get Recent Activities
```
GET /api/activity-logs/recent
Query Parameters:
- limit: Number of recent activities (default: 10)
```

### Export Activities
```
GET /api/activity-logs/export/csv
Query Parameters: Same as main listing endpoint
```

### Cleanup Old Logs (Admin Only)
```
DELETE /api/activity-logs/maintenance/cleanup
Body:
- daysToKeep: Number of days to retain (default: 365)
```

## Usage Examples

### Backend Logging

#### Manual Logging
```javascript
import ActivityLogger from '../utils/activityLogger.js';

// Log task creation
await ActivityLogger.logTaskActivity(
  userId,
  'task_created',
  taskId,
  `Created task "${taskTitle}" for ${clientName}`,
  null, // no old values for creation
  { title, clientName, priority }, // new values
  req
);

// Log user approval
await ActivityLogger.logUserActivity(
  adminId,
  'user_approved',
  userId,
  `Approved user ${userEmail} with role ${role}`,
  { status: 'pending' }, // old values
  { status: 'approved', role }, // new values
  req
);
```

#### Automatic Middleware Logging
All HTTP requests are automatically logged by the middleware, which:
- Determines action type from HTTP method and route
- Extracts entity information from URL parameters
- Captures request metadata (IP, user agent, etc.)
- Logs successful operations with appropriate severity

### Frontend Usage

#### Accessing Activity Logs
1. Login as Admin or Team Head
2. Navigate to "Activity Logs" in the sidebar
3. Use filters to narrow down activities
4. Click "View Details" for comprehensive information
5. Export to CSV for external analysis

#### Filtering Activities
- **Search**: Free text search across descriptions
- **Entity**: Filter by Task, User, Team, Client, etc.
- **Action**: Filter by specific action types
- **Severity**: Filter by importance level
- **User**: Filter by who performed the action
- **Date Range**: Filter by time period

## Security and Privacy

### Access Control
- Activity logs are restricted to Admin and Team Head roles
- Regular users cannot access activity information
- API endpoints validate user permissions

### Data Protection
- Sensitive fields (passwords, tokens) are automatically redacted
- IP addresses and user agents are logged for security audit
- Personal data is handled according to privacy policies

### Data Retention
- Configurable retention period (default: 365 days)
- Automatic cleanup functionality for old logs
- Manual cleanup available for compliance requirements

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields
- Efficient pagination for large datasets
- Aggregation pipelines for statistics

### Logging Performance
- Asynchronous logging to prevent blocking main operations
- Error handling to ensure main functionality continues
- Configurable middleware to skip irrelevant requests

### Frontend Optimization
- Pagination to handle large result sets
- Debounced search to reduce API calls
- Efficient filtering and sorting

## Monitoring and Maintenance

### System Health
- Monitor activity log volume and growth
- Alert on unusual activity patterns
- Regular cleanup of old logs

### Performance Monitoring
- Track logging performance impact
- Monitor database query performance
- Optimize based on usage patterns

### Compliance and Audit
- Regular export of activity logs for compliance
- Audit trail maintenance for security requirements
- Documentation of system changes and maintenance

## Future Enhancements

### Potential Improvements
- Real-time activity notifications
- Advanced analytics and reporting
- Machine learning for anomaly detection
- Integration with external audit systems
- Mobile app activity tracking

### Scalability Considerations
- Database sharding for large datasets
- Separate analytics database
- Event streaming for real-time processing
- Archival strategies for long-term retention

This comprehensive activity logging system ensures complete visibility into all user actions within the Work Management application, providing the detailed audit trail requested for administrative oversight and compliance requirements.
