import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ClipboardDocumentListIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  UserPlusIcon,
  NoSymbolIcon,
  MegaphoneIcon,
  BuildingOfficeIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import TopBar from '../components/TopBar';
import { useState } from 'react';

const DashboardLayout = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [];

  // Add menu items based on user role
  if (user) {
    switch (user.role) {
      case 'Admin':
        menuItems.push(
          { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon, path: '/dashboard' },
          { id: 'received-tasks', label: 'Received Tasks', icon: ClipboardDocumentListIcon, path: '/dashboard/received-tasks' },
          { id: 'assigned-tasks', label: 'Assigned Tasks', icon: ClipboardDocumentListIcon, path: '/dashboard/assigned-tasks' },
          { id: 'timesheets', label: 'My Timesheets', icon: ClockIcon, path: '/dashboard/timesheets' },
          { id: 'subordinate-timesheets', label: 'Subordinate Timesheets', icon: ClipboardDocumentListIcon, path: '/dashboard/subordinate-timesheets' },
          { id: 'todos', label: 'My Todos', icon: CheckCircleIcon, path: '/dashboard/todos' },
          { id: 'team', label: 'Teams', icon: UserGroupIcon, path: '/dashboard/team' },
          { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon, path: '/dashboard/announcements' },
          { id: 'cost', label: 'Cost', icon: ChartBarIcon, path: '/dashboard/cost' },
          { id: 'clients', label: 'Clients', icon: BuildingOfficeIcon, path: '/dashboard/clients' },
          { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, path: '/dashboard/settings' },
          { id: 'user-approvals', label: 'User Approvals', icon: UserPlusIcon, path: '/dashboard/user-approvals' },
          { id: 'blocked-users', label: 'Blocked Users', icon: NoSymbolIcon, path: '/dashboard/blocked-users' },
          { id: 'add-users', label: 'All Users', icon: UserGroupIcon, path: '/dashboard/add-users' }
        );
        break;
      case 'Head':
        menuItems.push(
          { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon, path: '/dashboard' },
          { id: 'received-tasks', label: 'Received Tasks', icon: ClipboardDocumentListIcon, path: '/dashboard/received-tasks' },
          { id: 'assigned-tasks', label: 'Assigned Tasks', icon: ClipboardDocumentListIcon, path: '/dashboard/assigned-tasks' },
          { id: 'timesheets', label: 'My Timesheets', icon: ClockIcon, path: '/dashboard/timesheets' },
          { id: 'todos', label: 'My Todos', icon: CheckCircleIcon, path: '/dashboard/todos' },
          { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon, path: '/dashboard/announcements' },
          { id: 'clients', label: 'Clients', icon: BuildingOfficeIcon, path: '/dashboard/clients' },
          { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, path: '/dashboard/settings' }
        );
        break;
      case 'Team Head':
        menuItems.push(
          { id: 'dashboard', label: 'Dashboard', icon: ChartBarIcon, path: '/dashboard' },
          { id: 'received-tasks', label: 'Received Tasks', icon: ClipboardDocumentListIcon, path: '/dashboard/received-tasks' },
          { id: 'assigned-tasks', label: 'Assigned Tasks', icon: ClipboardDocumentListIcon, path: '/dashboard/assigned-tasks' },
          { id: 'timesheets', label: 'My Timesheets', icon: ClockIcon, path: '/dashboard/timesheets' },
          { id: 'todos', label: 'My Todos', icon: CheckCircleIcon, path: '/dashboard/todos' },
          { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon, path: '/dashboard/announcements' },
          { id: 'analytics', label: 'Analytics', icon: ChartBarIcon, path: '/dashboard/analytics' },
          { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, path: '/dashboard/settings' },
          { id: 'clients', label: 'Clients', icon: BuildingOfficeIcon, path: '/dashboard/clients' }
        );
        break;
      case 'Fresher':
        menuItems.push(
          { id: 'received-tasks', label: 'Received Tasks', icon: ClipboardDocumentListIcon, path: '/dashboard/received-tasks' },
          { id: 'timesheets', label: 'Timesheets', icon: ClockIcon, path: '/dashboard/timesheets' },
          { id: 'todos', label: 'My Todos', icon: CheckCircleIcon, path: '/dashboard/todos' },
          { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon, path: '/dashboard/announcements' },
          { id: 'analytics', label: 'Analytics', icon: ChartBarIcon, path: '/dashboard/analytics' },
          { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, path: '/dashboard/settings' }
        );
        break;
      default: // For other users
        menuItems.push(
          { id: 'received-tasks', label: 'Received Tasks', icon: ClipboardDocumentListIcon, path: '/dashboard/received-tasks' },
          { id: 'timesheets', label: 'Timesheets', icon: ClockIcon, path: '/dashboard/timesheets' },
          { id: 'todos', label: 'My Todos', icon: CheckCircleIcon, path: '/dashboard/todos' },
          { id: 'announcements', label: 'Announcements', icon: MegaphoneIcon, path: '/dashboard/announcements' },
          { id: 'analytics', label: 'Analytics', icon: ChartBarIcon, path: '/dashboard/analytics' },
          { id: 'settings', label: 'Settings', icon: Cog6ToothIcon, path: '/dashboard/settings' },
        );
        break;
    }
    // Add Subordinate Timesheets link for TimeSheet Verifier (if not already admin)
    if (user.role2 === 'TimeSheet Verifier' && user.role !== 'Admin') {
      menuItems.push({
        id: 'subordinate-timesheets',
        label: 'Subordinate Timesheets',
        icon: ClipboardDocumentListIcon,
        path: '/dashboard/subordinate-timesheets'
      });
    }
  }

  const getCurrentPath = () => {
    const path = location.pathname.split('/').pop();
    return path || 'dashboard';
  };

  // Helper to get initials
  const getInitials = (firstName, lastName) => {
    if (!firstName && !lastName) return '';
    if (firstName && lastName) return firstName[0].toUpperCase() + lastName[0].toUpperCase();
    return (firstName || lastName)[0].toUpperCase();
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-shrink-0">
        <TopBar onSidebarToggle={() => setSidebarOpen((open) => !open)} />
      </div>
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar for desktop and mobile */}
        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 backdrop-blur-xs bg-black/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar overlay"
          />
        )}
        <div
          className={`fixed z-40 inset-y-0 left-0 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out
            md:static md:translate-x-0 md:w-72 md:flex-shrink-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        >
          <nav className="h-full flex flex-col overflow-y-auto scrollbar-hide">
            <div className="flex-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = getCurrentPath() === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    className={`w-full flex items-center px-6 py-3 text-md transition-colors duration-150 rounded-none ${
                      isActive
                        ? 'bg-[#6690f4] text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                    style={{marginTop: 0, marginBottom: 0}}
                  >
                    <Icon className={`flex-shrink-0 w-5 h-5 ${isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-900'}`} />
                    <span className="ml-3 truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout; 