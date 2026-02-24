# Work Management System - Role & Privilege Documentation

**Document Version:** 1.0  
**Last Updated:** February 23, 2026  
**Prepared For:** Client Reference

---

## Table of Contents
1. [System Overview](#system-overview)
2. [User Roles](#user-roles)
3. [Secondary Roles](#secondary-roles)
4. [Access Control Parameters](#access-control-parameters)
5. [Detailed Role Privileges](#detailed-role-privileges)
6. [Feature Access Matrix](#feature-access-matrix)
7. [API Endpoint Permissions](#api-endpoint-permissions)

---

## System Overview

The Work Management System implements a hierarchical role-based access control (RBAC) system with four primary roles and two secondary roles. Each role has specific permissions and access levels designed to maintain security and operational efficiency.

---

## User Roles

### Primary Roles (role)

The system has **4 primary roles** that determine the base level of access:

1. **Admin** - Highest privilege level, full system access
2. **Team Head** - Team management and oversight capabilities
3. **Senior** - Advanced user with task assignment privileges
4. **Fresher** - Entry-level user with basic access

### Role Hierarchy
```
Admin (Highest Authority)
  ├── Team Head (Team Management)
  │   ├── Senior (Task Assignment)
  │   │   └── Fresher (Basic User)
```

---

## Secondary Roles

### Additional Privileges (role2)

Users can be assigned **secondary roles** that grant additional specific privileges:

1. **TimeSheet Verifier** - Can review and verify subordinate timesheets
2. **Task Verifier** - Can approve/reject pending tasks
3. **None** - No additional privileges (default)

**Note:** Secondary roles are additive to primary roles and stored as an array, allowing multiple secondary roles per user.

---

## Access Control Parameters

### User Access Level (userAccessLevel)

Determines visibility scope for users in the system:

- **Team Only** - User can only see team members (default for most users)
- **All Users** - User can see all users in the system (typically Admin, Team Head, Senior)

### Timesheet View (timesheetView)

Controls which tasks appear in timesheet:

- **default** - Only shows tasks directly assigned to the user
- **team** - Shows tasks from all team members (useful for team heads)

### User Status

Account states affecting access:

- **pending** - Awaiting approval, cannot access system
- **approved** - Active account with full role privileges
- **rejected** - Denied access, cannot login
- **deleted** - Soft-deleted, blocked from all access

---

## Detailed Role Privileges

### 1. ADMIN Role

**Access Level:** Complete System Access

#### Dashboard & Navigation Access
- ✅ Full Dashboard (Advanced metrics and analytics)
- ✅ Team Dashboard
- ✅ All Tasks view
- ✅ Billed Tasks
- ✅ UnBilled Tasks
- ✅ Task Verification (Approve/Reject pending tasks)
- ✅ Activity Logs (System-wide activity monitoring)
- ✅ Analytics
- ✅ Timesheets (Personal)
- ✅ Subordinate Timesheets (All users)
- ✅ Leave Management (Approve/Reject all leaves)
- ✅ Notes (Personal notes)
- ✅ Tutorials
- ✅ Teams Management
- ✅ Announcements (Create/Edit/Delete)
- ✅ Cost Management
- ✅ Task Reports
- ✅ Clients Management
- ✅ Settings (Full system configuration)
- ✅ User Approvals (Approve/Reject new users)
- ✅ Blocked Users Management
- ✅ All Users Management

#### Task Management Privileges
- ✅ Create tasks for any user
- ✅ Edit any task (including those not assigned by them)
- ✅ Delete any task
- ✅ Change task status, priority, description
- ✅ Assign verifiers (all levels)
- ✅ Verify tasks at any stage
- ✅ Bulk update task status
- ✅ Bulk update task priority
- ✅ Upload/Delete task files
- ✅ Add/Edit/Delete comments
- ✅ View all tasks in the system
- ✅ Export task data

#### User Management Privileges
- ✅ View all users (including pending/rejected/deleted)
- ✅ Create new users
- ✅ Edit any user profile
- ✅ Delete (soft-delete) users
- ✅ Approve/Reject user registrations
- ✅ Block/Unblock users
- ✅ Change user roles
- ✅ Assign users to teams
- ✅ Set hourly rates for users
- ✅ Manage user access levels

#### System Configuration
- ✅ Create/Edit/Delete Task Statuses
- ✅ Reorder Task Statuses
- ✅ Create/Edit/Delete Priorities
- ✅ Reorder Priorities
- ✅ Create/Edit/Delete Custom Columns (Task attributes)
- ✅ Create/Edit/Delete Work Types
- ✅ Create/Edit/Delete Client Groups
- ✅ Create/Edit/Delete Clients
- ✅ Manage Automations (Task automation rules)
- ✅ System Backups

#### Team & Organization Management
- ✅ Create/Edit/Delete Teams
- ✅ Add/Remove team members
- ✅ View all teams

#### Financial & Reporting
- ✅ View cost analytics for all users
- ✅ Generate comprehensive reports
- ✅ Export data to Excel/PDF
- ✅ Access activity logs

#### Leave Management
- ✅ Apply for personal leaves
- ✅ Approve/Reject any user's leave
- ✅ View all leaves (past/present/future)
- ✅ View leave statistics for all users
- ✅ Delete leave requests

#### Timesheet Management
- ✅ Submit personal timesheets
- ✅ View all user timesheets
- ✅ Filter timesheets by any user/date range
- ✅ Export timesheet reports

#### Communication
- ✅ Create announcements visible to all users
- ✅ Private/Group chats with any user
- ✅ Access all chat features

---

### 2. TEAM HEAD Role

**Access Level:** Team Management & Oversight

#### Dashboard & Navigation Access
- ✅ Full Dashboard
- ✅ Team Dashboard
- ✅ Tasks (Received/Assigned)
- ✅ Task Verification (Pending approval tasks)
- ✅ Activity Logs
- ✅ Analytics
- ✅ Timesheets (Personal)
- ✅ Subordinate Timesheets (Team members)
- ✅ Leave Management
- ✅ Notes
- ✅ Tutorials
- ✅ Announcements (View only)
- ✅ Task Reports
- ✅ Clients
- ✅ Settings (Limited configurations)
- ❌ User Approvals (Admin only)
- ❌ Blocked Users (Admin only)
- ❌ All Users (Admin only)
- ❌ Teams Management (Admin only)
- ❌ Billed/UnBilled Tasks (Admin only)
- ❌ Cost Management (Admin only)

#### Task Management Privileges
- ✅ Create tasks for team members
- ✅ Edit tasks assigned by them or to them
- ✅ Delete tasks created by them
- ✅ Change task status/priority
- ✅ Assign verifiers
- ✅ Verify tasks assigned to them
- ✅ Bulk update status (for own tasks)
- ✅ Bulk update priority (for own tasks)
- ✅ Upload/Delete files on accessible tasks
- ✅ Add/Edit/Delete comments
- ✅ View team tasks
- ❌ Edit/Delete tasks not related to them
- ❌ View all system tasks

#### Configuration Privileges
- ✅ Create/Edit Task Statuses
- ✅ Reorder Task Statuses
- ✅ Create/Edit Priorities
- ✅ Reorder Priorities
- ✅ Create/Edit Work Types
- ✅ Create/Edit Client Groups
- ✅ Create/Edit Clients
- ❌ Delete Task Statuses (can only edit)
- ❌ Delete Priorities (can only edit)
- ❌ Manage Custom Columns (Admin only)
- ❌ Create/Delete Teams (Admin only)

#### Team Management
- ✅ View team members
- ✅ View team statistics
- ❌ Add/Remove team members (Admin only)
- ❌ Edit team settings (Admin only)

#### Leave Management
- ✅ Apply for personal leaves
- ✅ Approve/Reject team member leaves
- ✅ View team leave statistics
- ❌ Approve leaves for non-team members

#### Timesheet Management
- ✅ Submit personal timesheets
- ✅ View team member timesheets
- ✅ Filter by team members

#### Communication
- ✅ View announcements
- ✅ Private/Group chats
- ❌ Create system announcements (Admin only)

---

### 3. SENIOR Role

**Access Level:** Task Assignment & Team Support

#### Dashboard & Navigation Access
- ✅ Team Dashboard
- ✅ Tasks (Received/Assigned)
- ✅ Timesheets (Personal)
- ✅ Subordinate Timesheets (if TimeSheet Verifier role)
- ✅ Task Verification (if Task Verifier role)
- ✅ Leave Management
- ✅ Notes
- ✅ Tutorials
- ✅ Announcements (View only)
- ✅ Analytics
- ✅ Settings (Profile only)
- ✅ Task Reports
- ✅ Clients (View/Add/Edit only)
- ❌ Full Dashboard (Admin/Team Head only)
- ❌ Activity Logs (Admin/Team Head only)
- ❌ User Management features
- ❌ Billed/UnBilled Tasks (Admin only)
- ❌ Cost Management (Admin only)

#### Task Management Privileges
- ✅ Create tasks for team members (based on access level)
- ✅ Edit tasks assigned by them or to them
- ✅ Delete tasks created by them (limited)
- ✅ Change status/priority for own tasks
- ✅ Verify tasks (if assigned as verifier)
- ✅ Upload/Delete files on accessible tasks
- ✅ Add/Edit/Delete comments on accessible tasks
- ✅ View team tasks (based on access level)
- ❌ Bulk update operations
- ❌ Edit/Delete others' tasks
- ❌ System-wide task access

#### Configuration Privileges
- ✅ Create/Edit Clients
- ✅ Create/Edit Client Groups
- ❌ All system configuration (Admin/Team Head only)

#### Leave Management
- ✅ Apply for personal leaves
- ✅ View own leave history
- ❌ Approve/Reject leaves (Admin/Team Head only)

#### Timesheet Management
- ✅ Submit personal timesheets
- ✅ View team timesheets (if TimeSheet Verifier role)
- ❌ View all user timesheets

#### Communication
- ✅ View announcements
- ✅ Private/Group chats with accessible users
- ❌ Create announcements

---

### 4. FRESHER Role

**Access Level:** Basic User Access

#### Dashboard & Navigation Access
- ✅ Tasks (Received tasks only)
- ✅ Timesheets (Personal)
- ✅ Leave Management
- ✅ Notes
- ✅ Tutorials
- ✅ Announcements (View only)
- ✅ Analytics (Personal only)
- ✅ Settings (Profile only)
- ✅ Task Reports (Personal)
- ✅ Clients (View only - if not restricted)
- ✅ Subordinate Timesheets (only if TimeSheet Verifier role)
- ✅ Task Verification (only if Task Verifier role)
- ❌ Dashboard (no dashboard access)
- ❌ Assigned Tasks view
- ❌ All administrative features
- ❌ Team management features
- ❌ System configuration

#### Task Management Privileges
- ✅ View tasks assigned to them
- ✅ Update status of own tasks
- ✅ Add comments to tasks
- ✅ Upload files to assigned tasks
- ✅ Change task description (own tasks only)
- ✅ Verify tasks (if assigned as verifier)
- ❌ Create new tasks (cannot assign tasks to others)
- ❌ Delete tasks
- ❌ Edit task priority
- ❌ Assign verifiers
- ❌ View tasks not assigned to them
- ❌ Bulk operations

#### Configuration Privileges
- ✅ View Clients (if access granted)
- ❌ Create/Edit any system configuration
- ❌ Modify work types, statuses, priorities

#### Leave Management
- ✅ Apply for personal leaves
- ✅ View own leave history
- ✅ Edit pending leave requests
- ❌ Approve/Reject leaves
- ❌ View others' leaves

#### Timesheet Management
- ✅ Submit personal timesheets
- ✅ View personal timesheet history
- ✅ View team timesheets (only if TimeSheet Verifier role)
- ❌ View other users' timesheets (unless TimeSheet Verifier)

#### Communication
- ✅ View announcements
- ✅ Private chats with accessible users
- ✅ Group chats if invited
- ❌ Create announcements

---

## Feature Access Matrix

### Task Operations

| Operation | Admin | Team Head | Senior | Fresher |
|-----------|-------|-----------|--------|---------|
| View All Tasks | ✅ | ❌ | ❌ | ❌ |
| View Team Tasks | ✅ | ✅ | ✅* | ❌ |
| View Own Tasks | ✅ | ✅ | ✅ | ✅ |
| Create Tasks | ✅ | ✅ | ✅ | ❌ |
| Edit Any Task | ✅ | ❌ | ❌ | ❌ |
| Edit Own Tasks | ✅ | ✅ | ✅ | ✅ |
| Delete Any Task | ✅ | ❌ | ❌ | ❌ |
| Delete Own Tasks | ✅ | ✅ | ✅** | ❌ |
| Bulk Status Update | ✅ | ✅ | ❌ | ❌ |
| Bulk Priority Update | ✅ | ✅ | ❌ | ❌ |
| Assign Verifiers | ✅ | ✅ | ✅*** | ❌ |
| Verify Tasks | ✅ | ✅ | ✅**** | ✅**** |
| Export Tasks | ✅ | ✅ | ✅ | ❌ |

*Based on userAccessLevel setting  
**Limited to recently created tasks  
***When creating tasks  
****If assigned as verifier or has Task Verifier role

### User Management

| Operation | Admin | Team Head | Senior | Fresher |
|-----------|-------|-----------|--------|---------|
| View All Users | ✅ | ❌ | ❌ | ❌ |
| View Team Users | ✅ | ✅ | ✅* | ❌ |
| Create Users | ✅ | ❌ | ❌ | ❌ |
| Edit Users | ✅ | ❌ | ❌ | ❌ |
| Delete Users | ✅ | ❌ | ❌ | ❌ |
| Approve Users | ✅ | ❌ | ❌ | ❌ |
| Block/Unblock Users | ✅ | ❌ | ❌ | ❌ |
| Change User Roles | ✅ | ❌ | ❌ | ❌ |
| Set Hourly Rates | ✅ | ❌ | ❌ | ❌ |
| Assign to Teams | ✅ | ❌ | ❌ | ❌ |

*Based on userAccessLevel setting

### System Configuration

| Operation | Admin | Team Head | Senior | Fresher |
|-----------|-------|-----------|--------|---------|
| Manage Task Statuses | ✅ | ✅* | ❌ | ❌ |
| Manage Priorities | ✅ | ✅* | ❌ | ❌ |
| Manage Custom Columns | ✅ | ❌ | ❌ | ❌ |
| Manage Work Types | ✅ | ✅ | ❌ | ❌ |
| Manage Clients | ✅ | ✅ | ✅ | ❌** |
| Manage Client Groups | ✅ | ✅ | ✅ | ❌ |
| Manage Teams | ✅ | ❌ | ❌ | ❌ |
| Manage Automations | ✅ | ✅ | ❌ | ❌ |
| System Backups | ✅ | ❌ | ❌ | ❌ |

*Cannot delete, only edit  
**View only

### Leave Management

| Operation | Admin | Team Head | Senior | Fresher |
|-----------|-------|-----------|--------|---------|
| Apply Leave | ✅ | ✅ | ✅ | ✅ |
| View Own Leaves | ✅ | ✅ | ✅ | ✅ |
| Approve/Reject Leaves | ✅ | ✅* | ❌ | ❌ |
| View All Leaves | ✅ | ❌ | ❌ | ❌ |
| View Team Leaves | ✅ | ✅ | ❌ | ❌ |
| Delete Leave Requests | ✅ | ❌ | ❌ | ❌ |
| Leave Statistics | ✅ | ✅* | ❌ | ❌ |

*Team members only

### Timesheet Management

| Operation | Admin | Team Head | Senior | Fresher |
|-----------|-------|-----------|--------|---------|
| Submit Timesheets | ✅ | ✅ | ✅ | ✅ |
| View Own Timesheets | ✅ | ✅ | ✅ | ✅ |
| View All Timesheets | ✅ | ❌ | ❌ | ❌ |
| View Team Timesheets | ✅ | ✅ | ✅* | ✅* |
| Export Timesheets | ✅ | ✅ | ✅* | ❌ |
| Timesheet Reports | ✅ | ✅ | ✅* | ❌ |

*Only if TimeSheet Verifier role assigned

### Reporting & Analytics

| Operation | Admin | Team Head | Senior | Fresher |
|-----------|-------|-----------|--------|---------|
| Activity Logs | ✅ | ✅ | ❌ | ❌ |
| System Analytics | ✅ | ✅ | ✅ | ✅* |
| Task Reports | ✅ | ✅ | ✅ | ✅* |
| Cost Analytics | ✅ | ❌ | ❌ | ❌ |
| Export Reports | ✅ | ✅ | ✅ | ❌ |

*Personal analytics only

### Communication

| Operation | Admin | Team Head | Senior | Fresher |
|-----------|-------|-----------|--------|---------|
| Create Announcements | ✅ | ❌ | ❌ | ❌ |
| View Announcements | ✅ | ✅ | ✅ | ✅ |
| Private Chats | ✅ | ✅ | ✅ | ✅* |
| Group Chats | ✅ | ✅ | ✅ | ✅ |
| Create Group Chats | ✅ | ✅ | ✅ | ✅ |

*Based on userAccessLevel

---

## API Endpoint Permissions

### Authentication Endpoints (Public)
- POST `/api/auth/register` - Public (requires email verification)
- POST `/api/auth/login` - Public
- POST `/api/auth/forgot-password` - Public
- POST `/api/auth/verify-otp` - Public
- POST `/api/auth/resend-otp` - Public

### User Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/users` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/users/profile` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/users/profile` | PUT | ✅ | ✅ | ✅ | ✅ |
| `/api/users/:userId` | DELETE | ✅ | ❌ | ❌ | ❌ |
| `/api/users/:userId/approval` | PUT | ✅ | ❌ | ❌ | ❌ |
| `/api/users/:userId/team` | PUT | ✅ | ❌ | ❌ | ❌ |
| `/api/users/pending-approvals` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/users/blocked` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/users/:userId/unblock` | PUT | ✅ | ❌ | ❌ | ❌ |
| `/api/users/:userId/hourly-rate` | PUT | ✅ | ❌ | ❌ | ❌ |
| `/api/users/for-task-assignment` | GET | ✅ | ✅ | ✅ | ❌ |

### Task Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/tasks` | POST | ✅ | ✅ | ✅ | ❌ |
| `/api/tasks/all` | GET | ✅ | ✅* | ✅* | ❌ |
| `/api/tasks/received` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/tasks/assigned` | GET | ✅ | ✅ | ✅ | ❌ |
| `/api/tasks/:id` | PUT | ✅** | ✅** | ✅** | ✅** |
| `/api/tasks/:id` | DELETE | ✅ | ✅*** | ❌ | ❌ |
| `/api/tasks/:taskId/status` | PATCH | ✅ | ✅ | ✅ | ✅**** |
| `/api/tasks/:taskId/priority` | PATCH | ✅ | ✅ | ✅ | ❌ |
| `/api/tasks/:taskId/verify` | POST | ✅ | ✅ | ✅+ | ✅+ |
| `/api/tasks/for-verification` | GET | ✅ | ✅ | ✅+ | ✅+ |

*Filtered by team/access level  
**Can only edit tasks they have access to  
***Can only delete own tasks  
****Only for assigned tasks  
+If Task Verifier role or assigned as verifier

### Task Status Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/task-statuses` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/task-statuses` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/task-statuses/:id` | PUT | ✅ | ✅ | ❌ | ❌ |
| `/api/task-statuses/:id` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/api/task-statuses/reorder` | POST | ✅ | ✅ | ❌ | ❌ |

### Priority Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/priorities` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/priorities` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/priorities/:id` | PUT | ✅ | ✅ | ❌ | ❌ |
| `/api/priorities/:id` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/api/priorities/bulk-update-order` | PUT | ✅ | ✅ | ❌ | ❌ |

### Client Management Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/clients` | GET | ✅ | ✅ | ✅ | ✅* |
| `/api/clients` | POST | ✅ | ✅ | ✅ | ❌ |
| `/api/clients/:id` | PUT | ✅ | ✅ | ✅ | ❌ |
| `/api/clients/:id` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/api/clients/groups` | GET | ✅ | ✅ | ✅ | ✅* |
| `/api/clients/groups` | POST | ✅ | ✅ | ✅ | ❌ |
| `/api/clients/groups/:id` | PUT | ✅ | ✅ | ✅ | ❌ |
| `/api/clients/groups/:id` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/api/clients/work-types` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/clients/work-types` | POST | ✅ | ✅ | ❌ | ❌ |

*View only

### Team Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/teams` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/teams` | POST | ✅ | ❌ | ❌ | ❌ |
| `/api/teams/:id` | PUT | ✅ | ❌ | ❌ | ❌ |
| `/api/teams/:id` | DELETE | ✅ | ❌ | ❌ | ❌ |
| `/api/teams/:id/members` | POST | ✅ | ❌ | ❌ | ❌ |
| `/api/teams/:id/members/:userId` | DELETE | ✅ | ❌ | ❌ | ❌ |

### Timesheet Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/timesheets` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/timesheets` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/timesheets/subordinates` | GET | ✅ | ✅ | ✅* | ✅* |
| `/api/timesheets/:id` | PUT | ✅ | ✅ | ✅ | ✅ |
| `/api/timesheets/:id` | DELETE | ✅ | ✅ | ✅ | ✅ |

*If TimeSheet Verifier role

### Leave Management Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/leaves/apply` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/leaves/my-leaves` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/leaves/all-leaves` | GET | ✅ | ✅* | ❌ | ❌ |
| `/api/leaves/:leaveId/status` | PATCH | ✅ | ✅* | ❌ | ❌ |
| `/api/leaves/:leaveId` | DELETE | ✅ | ❌ | ❌ | ❌ |
| `/api/leaves/stats/:userId` | GET | ✅ | ✅* | ❌ | ❌ |

*Team members only

### Announcement Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/announcements` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/announcements` | POST | ✅ | ❌ | ❌ | ❌ |
| `/api/announcements/:id` | DELETE | ✅ | ❌ | ❌ | ❌ |

### Automation Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/automations` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/automations` | POST | ✅ | ✅ | ❌ | ❌ |
| `/api/automations/:id` | PUT | ✅ | ✅ | ❌ | ❌ |
| `/api/automations/:id` | DELETE | ✅ | ✅ | ❌ | ❌ |
| `/api/automations/:id/force-run` | POST | ✅ | ✅ | ❌ | ❌ |

### Custom Column Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/custom-columns` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/custom-columns` | POST | ✅ | ❌ | ❌ | ❌ |
| `/api/custom-columns/:id` | PUT | ✅ | ❌ | ❌ | ❌ |
| `/api/custom-columns/:id` | DELETE | ✅ | ❌ | ❌ | ❌ |

### Activity Log Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/activity-logs` | GET | ✅ | ✅ | ❌ | ❌ |
| `/api/activity-logs/stats` | GET | ✅ | ✅ | ❌ | ❌ |

### Analytics Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/analytics/user/:userId` | GET | ✅ | ✅* | ✅** | ✅** |
| `/api/analytics/users` | GET | ✅ | ✅ | ✅ | ❌ |

*Team members only  
**Own analytics only

### Backup Endpoints (Admin Only)
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/backup/database` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/backup/users` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/backup/tasks/:userId` | GET | ✅ | ❌ | ❌ | ❌ |
| `/api/backup/all-data` | GET | ✅ | ❌ | ❌ | ❌ |

### Chat & Messaging Endpoints
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/chats` | GET | ✅ | ✅ | ✅ | ✅* |
| `/api/chats/private` | POST | ✅ | ✅ | ✅ | ✅* |
| `/api/chats/group` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/messages/:chatId` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/messages/:chatId` | POST | ✅ | ✅ | ✅ | ✅ |

*Based on userAccessLevel

### Notes Endpoints (All Authenticated Users)
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/notes` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/notes` | POST | ✅ | ✅ | ✅ | ✅ |

### Tutorial Endpoints (All Authenticated Users)
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/tutorials` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/tutorials` | POST | ✅ | ✅ | ✅ | ✅ |
| `/api/tutorials/:id` | PUT | ✅ | ✅ | ✅ | ✅ |
| `/api/tutorials/:id` | DELETE | ✅ | ✅ | ✅ | ✅ |

### Notification Endpoints (All Authenticated Users)
| Endpoint | Method | Admin | Team Head | Senior | Fresher |
|----------|--------|-------|-----------|--------|---------|
| `/api/notifications` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/notifications/unread-count` | GET | ✅ | ✅ | ✅ | ✅ |
| `/api/notifications/:id/read` | PATCH | ✅ | ✅ | ✅ | ✅ |
| `/api/notifications/mark-all-read` | PATCH | ✅ | ✅ | ✅ | ✅ |
| `/api/notifications/:id` | DELETE | ✅ | ✅ | ✅ | ✅ |

---

## Permission Summary

### Key Points:

1. **Admin** has unrestricted access to all features and can perform any operation in the system.

2. **Team Head** can manage their team, approve leaves, verify timesheets, configure system settings (except custom columns), and has access to team analytics.

3. **Senior** can assign tasks to team members, manage clients, and has enhanced visibility compared to Freshers.

4. **Fresher** has basic task execution capabilities, can manage personal timesheets, apply for leaves, but cannot assign tasks or access administrative features.

5. **Secondary Roles** (TimeSheet Verifier, Task Verifier) grant additional specific privileges that stack on top of the primary role.

6. **Access Levels** (userAccessLevel) determine which users can be seen and interacted with:
   - "Team Only" restricts to team members
   - "All Users" allows system-wide visibility

7. **Authentication** is required for all endpoints except registration, login, and password reset.

8. **Soft Delete** is implemented - deleted users are marked as "deleted" status rather than permanently removed.

---

## Important Notes for Client:

1. **Security**: All endpoints are protected with JWT authentication. Expired or invalid tokens will result in 401 Unauthorized responses.

2. **Data Isolation**: Users with "Team Only" access level can only see and interact with users in their team, maintaining data privacy.

3. **Audit Trail**: Activity logs track all significant operations performed by Admin and Team Head roles.

4. **Flexible Permissions**: The role2 (secondary roles) system allows for flexible permission assignments without changing the user's primary role.

5. **Timesheet Verification**: TimeSheet Verifier role allows non-Team Head users to verify timesheets, useful for designated team leads.

6. **Task Verification**: Task Verifier role enables users at any level to participate in task approval workflows when assigned.

7. **Self-Service**: All users can manage their own profile, notes, timesheets, and leave applications regardless of role.

8. **Progressive Access**: The system is designed with a clear hierarchy where higher roles inherit capabilities of lower roles plus additional privileges.

---

**End of Documentation**

For technical support or clarification on any role or privilege, please contact the system administrator.
