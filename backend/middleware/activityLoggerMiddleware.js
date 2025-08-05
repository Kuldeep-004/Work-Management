import ActivityLogger from '../utils/activityLogger.js';

/**
 * Middleware to automatically log activities based on HTTP requests
 */
export const activityLoggerMiddleware = (options = {}) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Store original res.json and res.send to intercept responses
    const originalJson = res.json;
    const originalSend = res.send;
    
    // Flag to ensure we only log once
    let logged = false;
    
    const logActivity = async (responseData = null) => {
      if (logged) return;
      logged = true;
      
      try {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Skip logging for certain routes or methods
        if (shouldSkipLogging(req)) {
          return;
        }
        
        const userId = req.user?.id || req.user?._id;
        if (!userId) return; // Skip if no authenticated user
        
        const action = determineAction(req, responseData);
        
        // Skip logging if no action could be determined
        if (!action) return;
        
        const entity = determineEntity(req);
        const entityId = extractEntityId(req, responseData);
        const description = generateDescription(req, action, entity, responseData);
        
        // Only log if we have required fields
        if (!action || !entity) {
          return;
        }
        
        const metadata = {
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          route: req.route?.path || req.path,
          method: req.method,
          statusCode: res.statusCode,
          responseTime,
          query: req.query,
          params: req.params,
          additionalData: options.includeBody ? sanitizeRequestBody(req.body) : null
        };
        
        await ActivityLogger.log({
          userId,
          action,
          entity,
          entityId: entityId || null, // Provide null instead of undefined
          description,
          metadata,
          req,
          severity: determineSeverity(action, req.method, res.statusCode)
        });
        
      } catch (error) {
        console.error('Error in activity logger middleware:', error);
      }
    };
    
    // Override res.json
    res.json = function(body) {
      logActivity(body);
      return originalJson.call(this, body);
    };
    
    // Override res.send
    res.send = function(body) {
      logActivity(body);
      return originalSend.call(this, body);
    };
    
    // Handle errors and other response endings
    res.on('finish', () => {
      logActivity();
    });
    
    next();
  };
};

/**
 * Determine if logging should be skipped for this request
 */
function shouldSkipLogging(req) {
  const skipRoutes = [
    '/api/activity-logs', // Don't log activity log fetching
    '/api/auth/refresh', // Skip token refresh
    '/api/notifications/check', // Skip notification checks
    '/api/health', // Skip health checks
    '/api/chats', // Skip chat fetching
    '/api/messages', // Skip message fetching
  ];
  
  const skipMethods = ['OPTIONS'];
  
  return skipRoutes.some(route => req.path.includes(route)) || 
         skipMethods.includes(req.method) ||
         req.path.includes('/files/') || // Skip file serving
         req.path.includes('/static/'); // Skip static files
}

/**
 * Determine the action based on HTTP method and route
 */
function determineAction(req, responseData) {
  const method = req.method;
  const path = req.path;
  const statusCode = req.res?.statusCode;
  
  // Handle specific route patterns
  if (path.includes('/login')) return 'user_login';
  if (path.includes('/logout')) return 'user_logout';
  if (path.includes('/register')) return 'user_created';
  if (path.includes('/verify-email')) return 'email_verified';
  if (path.includes('/forgot-password')) return 'password_reset_requested';
  if (path.includes('/reset-password')) return 'password_reset_completed';
  if (path.includes('/upload')) return 'file_uploaded';
  if (path.includes('/download')) return 'file_downloaded';
  
  // Handle CRUD operations
  switch (method) {
    case 'POST':
      if (statusCode >= 200 && statusCode < 300) {
        return getCreateAction(path);
      }
      break;
    case 'PUT':
    case 'PATCH':
      return getUpdateAction(path);
    case 'DELETE':
      return getDeleteAction(path);
    case 'GET':
      // Only log certain GET requests (not all reads)
      if (path.includes('/export') || path.includes('/report')) {
        return 'data_export';
      }
      return null; // Don't log regular GET requests
    default:
      return null;
  }
  
  return null;
}

/**
 * Get create action based on path
 */
function getCreateAction(path) {
  if (path.includes('/tasks')) return 'task_created';
  if (path.includes('/users')) return 'user_created';
  if (path.includes('/teams')) return 'team_created';
  if (path.includes('/clients')) return 'client_created';
  if (path.includes('/work-types')) return 'work_type_created';
  if (path.includes('/priorities')) return 'priority_created';
  if (path.includes('/automations')) return 'automation_created';
  if (path.includes('/timesheets')) return 'timesheet_created';
  if (path.includes('/announcements')) return 'announcement_created';
  if (path.includes('/notifications')) return 'notification_created';
  if (path.includes('/chats')) return 'chat_created';
  if (path.includes('/messages')) return 'message_sent';
  return null; // fallback for unknown create operations
}

/**
 * Get update action based on path
 */
function getUpdateAction(path) {
  if (path.includes('/tasks')) {
    if (path.includes('/status')) return 'task_status_changed';
    if (path.includes('/priority')) return 'task_priority_changed';
    if (path.includes('/assign')) return 'task_assigned';
    if (path.includes('/verify')) return 'task_verified';
    if (path.includes('/reject')) return 'task_rejected';
    return 'task_updated';
  }
  if (path.includes('/users')) {
    if (path.includes('/status')) return 'user_status_changed';
    if (path.includes('/role')) return 'user_role_changed';
    if (path.includes('/approve')) return 'user_approved';
    if (path.includes('/reject')) return 'user_rejected';
    if (path.includes('/block')) return 'user_blocked';
    if (path.includes('/unblock')) return 'user_unblocked';
    return 'user_updated';
  }
  if (path.includes('/teams')) return 'team_updated';
  if (path.includes('/clients')) return 'client_updated';
  if (path.includes('/work-types')) return 'work_type_updated';
  if (path.includes('/priorities')) return 'priority_updated';
  if (path.includes('/automations')) return 'automation_updated';
  if (path.includes('/timesheets')) {
    if (path.includes('/submit')) return 'timesheet_submitted';
    if (path.includes('/approve')) return 'timesheet_approved';
    if (path.includes('/reject')) return 'timesheet_rejected';
    if (path.includes('/verify')) return 'timesheet_verified';
    return 'timesheet_updated';
  }
  if (path.includes('/announcements')) return 'announcement_updated';
  if (path.includes('/notifications')) return 'notification_read'; // notifications are typically read, not updated
  if (path.includes('/chats')) return 'chat_settings_updated';
  if (path.includes('/messages')) return 'message_edited';
  return null; // fallback for unknown update operations
}

/**
 * Get delete action based on path
 */
function getDeleteAction(path) {
  if (path.includes('/tasks')) return 'task_deleted';
  if (path.includes('/users')) return 'user_deleted';
  if (path.includes('/teams')) return 'team_deleted';
  if (path.includes('/clients')) return 'client_deleted';
  if (path.includes('/work-types')) return 'work_type_deleted';
  if (path.includes('/priorities')) return 'priority_deleted';
  if (path.includes('/automations')) return 'automation_deleted';
  if (path.includes('/timesheets')) return 'timesheet_deleted';
  if (path.includes('/announcements')) return 'announcement_deleted';
  if (path.includes('/files')) return 'file_deleted';
  if (path.includes('/notifications')) return 'notification_deleted';
  if (path.includes('/chats')) return 'chat_deleted';
  if (path.includes('/messages')) return 'message_deleted';
  return null; // fallback for unknown delete operations
}

/**
 * Determine the entity based on the request path
 */
function determineEntity(req) {
  const path = req.path;
  
  if (path.includes('/tasks')) return 'Task';
  if (path.includes('/users')) return 'User';
  if (path.includes('/teams')) return 'Team';
  if (path.includes('/clients')) return 'Client';
  if (path.includes('/work-types')) return 'WorkType';
  if (path.includes('/priorities')) return 'Priority';
  if (path.includes('/automations')) return 'Automation';
  if (path.includes('/timesheets')) return 'Timesheet';
  if (path.includes('/announcements')) return 'Announcement';
  if (path.includes('/notifications')) return 'Notification';
  if (path.includes('/files')) return 'File';
  if (path.includes('/chats')) return 'Chat';
  if (path.includes('/messages')) return 'Message';
  if (path.includes('/auth') || path.includes('/login') || path.includes('/logout')) return 'System';
  
  return 'System';
}

/**
 * Extract entity ID from request or response
 */
function extractEntityId(req, responseData) {
  // Try to get ID from URL params
  if (req.params.id) return req.params.id;
  if (req.params.taskId) return req.params.taskId;
  if (req.params.userId) return req.params.userId;
  if (req.params.teamId) return req.params.teamId;
  if (req.params.clientId) return req.params.clientId;
  if (req.params.automationId) return req.params.automationId;
  if (req.params.timesheetId) return req.params.timesheetId;
  if (req.params.announcementId) return req.params.announcementId;
  if (req.params.chatId) return req.params.chatId;
  if (req.params.messageId) return req.params.messageId;
  
  // Try to get ID from response data
  if (responseData) {
    if (responseData._id) return responseData._id;
    if (responseData.id) return responseData.id;
    if (responseData.data && responseData.data._id) return responseData.data._id;
    if (responseData.data && responseData.data.id) return responseData.data.id;
  }
  
  return null;
}

/**
 * Generate human-readable description
 */
function generateDescription(req, action, entity, responseData) {
  const user = req.user;
  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unknown User';
  
  // Get entity name/title if available
  let entityName = '';
  if (responseData) {
    entityName = responseData.title || responseData.name || responseData.email || responseData._id || '';
  }
  
  const actionDescriptions = {
    // Task actions
    'task_created': `${userName} created a new task${entityName ? `: ${entityName}` : ''}`,
    'task_updated': `${userName} updated task${entityName ? `: ${entityName}` : ''}`,
    'task_deleted': `${userName} deleted task${entityName ? `: ${entityName}` : ''}`,
    'task_status_changed': `${userName} changed status of task${entityName ? `: ${entityName}` : ''}`,
    'task_priority_changed': `${userName} changed priority of task${entityName ? `: ${entityName}` : ''}`,
    'task_assigned': `${userName} assigned task${entityName ? `: ${entityName}` : ''}`,
    'task_verified': `${userName} verified task${entityName ? `: ${entityName}` : ''}`,
    'task_rejected': `${userName} rejected task${entityName ? `: ${entityName}` : ''}`,
    
    // User actions
    'user_created': `${userName} created a new user${entityName ? `: ${entityName}` : ''}`,
    'user_updated': `${userName} updated user${entityName ? `: ${entityName}` : ''}`,
    'user_deleted': `${userName} deleted user${entityName ? `: ${entityName}` : ''}`,
    'user_approved': `${userName} approved user${entityName ? `: ${entityName}` : ''}`,
    'user_rejected': `${userName} rejected user${entityName ? `: ${entityName}` : ''}`,
    'user_blocked': `${userName} blocked user${entityName ? `: ${entityName}` : ''}`,
    'user_unblocked': `${userName} unblocked user${entityName ? `: ${entityName}` : ''}`,
    'user_role_changed': `${userName} changed role of user${entityName ? `: ${entityName}` : ''}`,
    'user_status_changed': `${userName} changed status of user${entityName ? `: ${entityName}` : ''}`,
    
    // Authentication actions
    'user_login': `${userName} logged in`,
    'user_logout': `${userName} logged out`,
    'password_reset_requested': `${userName} requested password reset`,
    'password_reset_completed': `${userName} completed password reset`,
    'email_verified': `${userName} verified email address`,
    
    // File actions
    'file_uploaded': `${userName} uploaded a file`,
    'file_downloaded': `${userName} downloaded a file`,
    'file_deleted': `${userName} deleted a file`,
    
    // Chat actions  
    'chat_created': `${userName} created a chat${entityName ? `: ${entityName}` : ''}`,
    'chat_deleted': `${userName} deleted a chat${entityName ? `: ${entityName}` : ''}`,
    'chat_settings_updated': `${userName} updated chat settings${entityName ? `: ${entityName}` : ''}`,
    'message_sent': `${userName} sent a message`,
    'message_edited': `${userName} edited a message`,
    'message_deleted': `${userName} deleted a message`,
    
    // System actions
    'data_export': `${userName} exported data`,
  };
  
  return actionDescriptions[action] || `${userName} performed ${action} on ${entity}`;
}

/**
 * Determine severity based on action and response
 */
function determineSeverity(action, method, statusCode) {
  // Handle null or undefined action
  if (!action || typeof action !== 'string') return 'low';
  
  // Critical actions
  const criticalActions = ['user_deleted', 'task_deleted', 'team_deleted', 'data_deleted'];
  if (criticalActions.some(a => action.includes(a))) return 'critical';
  
  // High importance actions
  const highActions = ['user_created', 'user_approved', 'user_rejected', 'user_blocked', 'password_reset'];
  if (highActions.some(a => action.includes(a))) return 'high';
  
  // Error responses
  if (statusCode >= 400) return 'high';
  
  // Delete operations
  if (method === 'DELETE') return 'high';
  
  // Low importance actions
  const lowActions = ['file_uploaded', 'file_downloaded', 'login', 'logout'];
  if (lowActions.some(a => action.includes(a))) return 'low';
  
  return 'medium';
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') return body;
  
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'otp'];
  const sanitized = { ...body };
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

export default activityLoggerMiddleware;
