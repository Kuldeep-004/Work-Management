import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import ReceivedTasks from './dashboard/ReceivedTasks';
import AssignedTasks from './dashboard/AssignedTasks';
import TeamMembers from '../components/TeamMembers';
import Analytics from '../components/Analytics';
import Settings from '../components/Settings';
import TodoList from '../components/TodoList';
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
          <Route path="todos" element={<TodoList />} />
          <Route path="team" element={<TeamMembers />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="cost" element={<Cost />} />
          <Route path="settings" element={<Settings />} />
          <Route path="user-approvals" element={<UserApprovals />} />
          <Route path="blocked-users" element={<BlockedUsers />} />
          <Route path="add-users" element={<AddUsers />} />
          <Route path="clients" element={<Clients />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="subordinate-timesheets" element={<SubordinateTimesheets />} />
          <Route path="*" element={<AdminDashboard />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // If user is Head
  if (user?.role === 'Head') {
    return (
      <DashboardLayout>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="received-tasks" element={<ReceivedTasks />} />
          <Route path="assigned-tasks" element={<AssignedTasks />} />
          <Route path="subordinate-timesheets" element={<SubordinateTimesheets />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="todos" element={<TodoList />} />
          <Route path="clients" element={<Clients />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="*" element={<AdminDashboard/>}/>
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
          <Route path="todos" element={<TodoList />} />
          <Route path="announcements" element={<Announcements />} />
          <Route path="settings" element={<Settings />} />
          <Route path="clients" element={<Clients />} />
          <Route path="timesheets" element={<Timesheets />} />
          <Route path="*" element={<AdminDashboard />} />
        </Routes>
      </DashboardLayout>
    );
  }

  // For non-admin users, show regular dashboard
  return (
    <DashboardLayout>
      <Routes>
        <Route path="received-tasks" element={<ReceivedTasks />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="cost" element={<Cost />} />
        <Route path="subordinate-timesheets" element={<SubordinateTimesheets />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="todos" element={<TodoList />} />
        <Route path="clients" element={<Clients />} />
        <Route path="timesheets" element={<Timesheets />} />
        <Route path="/" element={<ReceivedTasks />} />
        <Route path="*" element={<ReceivedTasks />} />
      </Routes>
    </DashboardLayout>
  );
};

export default Dashboard; 