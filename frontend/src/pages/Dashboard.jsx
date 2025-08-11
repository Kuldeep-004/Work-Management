import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import ReceivedTasks from './dashboard/ReceivedTasks';
import AssignedTasks from './dashboard/AssignedTasks';
import TeamMembers from '../components/TeamMembers';
import Analytics from '../components/Analytics';
import Settings from '../components/Settings';
import UserApprovals from '../components/UserApprovals';
import BlockedUsers from '../components/BlockedUsers';
import AddUsers from './dashboard/AddUsers';
import AdminDashboard from '../components/AdminDashboard';
import Announcements from './Announcements';
import Clients from './dashboard/Clients';
import { useAuth } from '../context/AuthContext';
import Timesheets from './dashboard/Timesheets';
import SubordinateTimesheets from './dashboard/SubordinateTimesheets';
import Cost from './dashboard/Cost';
import Notes from '../components/Notes';
import BilledTasks from './dashboard/BilledTasks';
import UnBilledTasks from './dashboard/UnBilledTasks';
import TaskVerification from './dashboard/TaskVerification';
import ActivityLogs from './dashboard/ActivityLogs';

const Dashboard = () => {
  const { user } = useAuth();

  // If user is admin, show admin dashboard and all sidebar routes
  if (user?.role === 'Admin') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="received-tasks" element={<ReceivedTasks />} />
          <Route path="assigned-tasks" element={<AssignedTasks />} />
          <Route path="task-verification" element={<TaskVerification />} />
          <Route path="activity-logs" element={<ActivityLogs />} />
          <Route path="notes" element={<Notes />} />
          <Route path="team" element={<TeamMembers />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="cost" element={<Cost />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="user-approvals" element={<UserApprovals />} />
          <Route path="blocked-users" element={<BlockedUsers />} />
          <Route path="add-users" element={<AddUsers />} />
          <Route path="clients" element={<Clients />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="subordinate-timesheets" element={<SubordinateTimesheets />} />
          <Route path="billed-tasks" element={<BilledTasks />} />
          <Route path="unbilled-tasks" element={<UnBilledTasks />} />
          <Route path="*" element={<AdminDashboard />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // If user is Team Head
  if (user?.role === 'Team Head') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="received-tasks" element={<ReceivedTasks />} />
          <Route path="assigned-tasks" element={<AssignedTasks />} />
          <Route path="subordinate-timesheets" element={<SubordinateTimesheets />} />
          <Route path="activity-logs" element={<ActivityLogs />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="task-verification" element={<TaskVerification />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="notes" element={<Notes />} />
          <Route path="clients" element={<Clients />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="*" element={<AdminDashboard/>}/>
        </Routes>
      </DashboardLayout>
    );
  }

  // If user is Senior
  if (user?.role === 'Senior') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="received-tasks" element={<ReceivedTasks />} />
          <Route path="assigned-tasks" element={<AssignedTasks />} />
          <Route path="subordinate-timesheets" element={<SubordinateTimesheets />} />
          <Route path="notes" element={<Notes />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="clients" element={<Clients />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="*" element={<AdminDashboard />} />
          <Route path="task-verification" element={<TaskVerification />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // For non-admin users, show regular dashboard
  return (
    <DashboardLayout>
      <Routes>
      <Route path="/" element={<AdminDashboard />} />
        <Route path="received-tasks" element={<ReceivedTasks />} />
        <Route path="assigned-tasks" element={<AssignedTasks />} />
        {/* Only show Task Verification for Task Verifier (role2) */}
        {(Array.isArray(user?.role2) ? user.role2.includes('Task Verifier') : user?.role2 === 'Task Verifier') && (
          <Route path="task-verification" element={<TaskVerification />} />
        )}
        <Route path="announcements" element={<Announcements />} />
        <Route path="cost" element={<Cost />} />
        {/* Only show Subordinate Timesheets for TimeSheet Verifier (role2) */}
        {(Array.isArray(user?.role2) ? user.role2.includes('TimeSheet Verifier') : user?.role2 === 'TimeSheet Verifier') && (
          <Route path="subordinate-timesheets" element={<SubordinateTimesheets />} />
        )}
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="notes" element={<Notes />} />
        <Route path="clients" element={<Clients />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="*" element={<ReceivedTasks />} />
      </Routes>
    </DashboardLayout>
  );
};

export default Dashboard; 