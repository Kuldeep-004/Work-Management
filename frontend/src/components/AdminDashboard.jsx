import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperClipIcon,
  ChatBubbleLeftIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import FileUpload from './FileUpload';
import FileList from './FileList';
import TaskComments from './TaskComments';
import defaultProfile from '../assets/avatar.jpg';
import FilterPopup from './FilterPopup';
import * as XLSX from 'xlsx';
import { API_BASE_URL } from '../apiConfig';

function formatDate(date) {
  if (!date) return 'NA';
  const d = new Date(date);
  return isNaN(d) ? 'NA' : d.toLocaleDateString();
}

const ALL_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'clientName', label: 'Client Name' },
  { id: 'clientGroup', label: 'Client Group' },
  { id: 'workType', label: 'Work Type' },
  { id: 'status', label: 'Task Status' },
  { id: 'verificationStatus', label: 'Verification Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'inwardEntryDate', label: 'Inward Entry Date' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'targetDate', label: 'Target Date' },
  { id: 'assignedBy', label: 'Assigned By' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'verificationAssignedTo', label: 'First Verifier' },
  { id: 'secondVerificationAssignedTo', label: 'Second Verifier' },
  { id: 'files', label: 'Files' },
  { id: 'comments', label: 'Comments' },
];

const Dashboard = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const filterPopupRef = useRef(null);

  const [filters, setFilters] = useState([]);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [users, setUsers] = useState([]);
  const [clientNames, setClientNames] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [taskHours, setTaskHours] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const userId = user?._id || 'guest';
    const key = `admindashboard_columns_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return ALL_COLUMNS.map(col => col.id);
  });

  const columnsDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterPopupRef.current && !filterPopupRef.current.contains(event.target)) {
        setIsFilterPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchData = async (url, setter) => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/${url}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!response.ok) {
          throw new Error(`Failed to fetch data from ${url}`);
        }
        const data = await response.json();
        setter(data);
      } catch (error) {
        console.error(error);
        toast.error(error.message);
      }
    };

    if (user && user.token) {
      fetchData('users', setUsers);
      fetchData('tasks/unique/client-names', setClientNames);
      fetchData('tasks/unique/client-groups', setClientGroups);
      fetchData('tasks/unique/work-types', setWorkTypes);
    }
  }, [user]);

  useEffect(() => {
    if (user && user._id) {
      const savedFilters = localStorage.getItem(`adminDashboardFilters_${user._id}`);
      if (savedFilters) {
        try {
          const parsed = JSON.parse(savedFilters);
          const loadedFilters = (parsed.filters ?? []).map(f => ({ ...f, saved: true }));
          setFilters(loadedFilters);
          setSortBy(parsed.sortBy ?? 'createdAt');
          setSortOrder(parsed.sortOrder ?? 'desc');
        } catch {
          setFilters([]);
          setSortBy('createdAt');
          setSortOrder('desc');
        }
      }
    }
  }, [user?._id]);

  // Save to localStorage on change
  useEffect(() => {
    if (user && user._id) {
      const savedFilters = filters.filter(f => f.saved);
      if (savedFilters.length > 0 || sortBy !== 'createdAt' || sortOrder !== 'desc') {
        localStorage.setItem(
          `adminDashboardFilters_${user._id}`,
          JSON.stringify({ filters: savedFilters, sortBy, sortOrder })
        );
      } else {
        localStorage.removeItem(`adminDashboardFilters_${user._id}`);
      }
    }
  }, [filters, sortBy, sortOrder, user]);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        let endpoint = '';
        if (user.role === 'Admin') {
          endpoint = 'tasks/all';
        } else if (user.role === 'Head') {
          endpoint = 'tasks/all';
        } else if (user.role === 'Team Head') {
          endpoint = 'tasks/all';
        } else {
          setError('Unauthorize: dInvalid role');
          setTasks([]);
          setLoading(false);
          return;
        }
        const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch tasks');
        }
        const data = await response.json();
        if (!Array.isArray(data)) {
          throw new Error('Invalid response format');
        }
        setTasks(data);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        setError(error.message);
        toast.error(error.message || 'Failed to fetch tasks');
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, [user]);

  useEffect(() => {
    // Fetch task hours for all users
    const fetchTaskHours = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/timesheets/task-hours`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch task hours');
        const data = await response.json();
        setTaskHours(data);
      } catch (error) {
        console.error('Error fetching task hours:', error);
      }
    };
    if (user && user.token) {
      fetchTaskHours();
    }
  }, [user]);

  const getFilteredAndSortedTasks = () => {
    if (!Array.isArray(tasks)) return [];

    let filteredTasks = tasks.filter(task => {
      // Apply search filter
      if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        const matches = (
          (task.title?.toString().toLowerCase().includes(lowercasedTerm)) ||
          (task.description?.toString().toLowerCase().includes(lowercasedTerm)) ||
          (task.clientName?.toString().toLowerCase().includes(lowercasedTerm)) ||
          (task.clientGroup?.toString().toLowerCase().includes(lowercasedTerm)) ||
          (task.workType?.toString().toLowerCase().includes(lowercasedTerm))
        );
        if (!matches) {
          return false;
        }
      }

      // Apply advanced filters with AND/OR logic
      if (!filters.length) return true;
      let result = null;
      for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];
        const { column, operator, value } = filter;
        // Handle nested properties like assignedTo.firstName
        const getTaskValue = (task, column) => {
          const keys = column.split('.');
          let result = task;
          for (const key of keys) {
            if (result === null || result === undefined) {
              return undefined;
            }
            result = result[key];
          }
          return result;
        };
        const taskValue = getTaskValue(task, column);
        let filterResult;
        if (taskValue === undefined || taskValue === null) {
          if (operator === 'is_empty') filterResult = true;
          else if (operator === 'is_not_empty') filterResult = false;
          else filterResult = false;
        } else {
          switch (operator) {
            case 'is':
              if (column === 'assignedTo' || column === 'assignedBy') {
                filterResult = taskValue._id === value;
              } else {
                filterResult = String(taskValue) === String(value);
              }
              break;
            case 'is_not':
              if (column === 'assignedTo' || column === 'assignedBy') {
                filterResult = taskValue._id !== value;
              } else {
                filterResult = String(taskValue) !== String(value);
              }
              break;
            case 'contains':
              filterResult = String(taskValue).toLowerCase().includes(String(value).toLowerCase());
              break;
            case 'does_not_contain':
              filterResult = !String(taskValue).toLowerCase().includes(String(value).toLowerCase());
              break;
            case 'is_empty':
              filterResult = taskValue === '' || taskValue === null || taskValue === undefined;
              break;
            case 'is_not_empty':
              filterResult = taskValue !== '' && taskValue !== null && taskValue !== undefined;
              break;
            default:
              filterResult = true;
          }
        }
        if (i === 0) {
          result = filterResult;
        } else {
          const logic = filter.logic || 'AND';
          if (logic === 'AND') {
            result = result && filterResult;
          } else {
            result = result || filterResult;
          }
        }
      }
      return result;
    });

    return filteredTasks.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'createdAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'inOneWeek':
        return 'bg-orange-100 text-orange-800';
      case 'inFifteenDays':
        return 'bg-yellow-100 text-yellow-800';
      case 'inOneMonth':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate statistics
  const stats = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    todayTasks: tasks.filter(t => new Date(t.dueDate).toDateString() === new Date().toDateString()).length,
  };

  const handleStatusClick = (taskId, status) => {
    // Implement the logic to handle status click
    console.log(`Status clicked for task ${taskId}, new status: ${status}`);
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete task');
      }

      setTasks(tasks.filter(task => task._id !== taskId));
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(error.message || 'Failed to delete task');
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowFileUpload(true);
  };

  const handleFileUploaded = (files) => {
    // Update the task in the list with new files
    setTasks(prevTasks => 
      prevTasks.map(t => 
        t._id === selectedTask._id 
          ? { ...t, files: [...(t.files || []), ...files] }
          : t
      )
    );
  };

  const handleFileDeleted = (fileId) => {
    // Update the task in the list after file deletion
    setTasks(prevTasks => 
      prevTasks.map(t => 
        t._id === selectedTask._id 
          ? { ...t, files: (t.files || []).filter(f => f._id !== fileId) }
          : t
      )
    );
  };

  const handleCommentSubmit = async (comment) => {
    if (!selectedTask) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${selectedTask._id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ content: comment }),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      const updatedTask = await response.json();
      setTasks(tasks.map(task => task._id === selectedTask._id ? updatedTask : task));
      toast.success('Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(error.message || 'Failed to add comment');
    }
  };

  // Helper to get hours for a user on a task
  const getUserTaskHours = (taskId, userId) => {
    const entry = taskHours.find(
      (h) => h.taskId === (taskId?._id || taskId) && h.userId === (userId?._id || userId)
    );
    return entry ? entry.totalHours : 0;
  };

  const filteredAndSortedTasks = getFilteredAndSortedTasks();

  // Excel export handler
  const handleDownloadExcel = () => {
    const filteredTasks = getFilteredAndSortedTasks();
    const data = filteredTasks.map(task => ({
      'Title': task.title,
      'Description': task.description,
      'Client Name': task.clientName,
      'Client Group': task.clientGroup,
      'Work Type': Array.isArray(task.workType) ? task.workType.join(', ') : task.workType,
      'Task Status': task.status,
      'Verification Status': task.verificationStatus,
      'Priority': task.priority,
      'Inward Entry Date': task.inwardEntryDate ? new Date(task.inwardEntryDate).toLocaleDateString() : '',
      'Due Date': task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '',
      'Target Date': task.targetDate ? new Date(task.targetDate).toLocaleDateString() : '',
      'Assigned By': task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : '',
      'Assigned To': Array.isArray(task.assignedTo)
        ? task.assignedTo.map(u => `${u.firstName} ${u.lastName}`).join(', ')
        : (task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : ''),
      'First Verifier': task.verificationAssignedTo ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}` : '',
      'Second Verifier': task.secondVerificationAssignedTo ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}` : '',
      'Files': task.files && task.files.length > 0 ? task.files.map(f => f.originalName || f.originalname).join(', ') : '',
      'Comments': task.comments ? task.comments.length : 0,
    }));
    const ws = XLSX.utils.json_to_sheet(data, {header: [
      'Title','Description','Client Name','Client Group','Work Type','Task Status','Verification Status','Priority','Inward Entry Date','Due Date','Target Date','Assigned By','Assigned To','First Verifier','Second Verifier','Files','Comments']});
    // Set column widths for better spacing
    ws['!cols'] = [
      { wch: 20 }, // Title
      { wch: 30 }, // Description
      { wch: 20 }, // Client Name
      { wch: 20 }, // Client Group
      { wch: 20 }, // Work Type
      { wch: 15 }, // Task Status
      { wch: 20 }, // Verification Status
      { wch: 10 }, // Priority
      { wch: 18 }, // Inward Entry Date
      { wch: 15 }, // Due Date
      { wch: 15 }, // Target Date
      { wch: 20 }, // Assigned By
      { wch: 25 }, // Assigned To
      { wch: 20 }, // First Verifier
      { wch: 20 }, // Second Verifier
      { wch: 30 }, // Files
      { wch: 10 }, // Comments
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    XLSX.writeFile(wb, 'tasks_dashboard.xlsx');
  };

  useEffect(() => {
    const userId = user?._id || 'guest';
    const key = `admindashboard_columns_${userId}`;
    localStorage.setItem(key, JSON.stringify(visibleColumns));
  }, [visibleColumns, user]);

  useEffect(() => {
    if (!showColumnDropdown) return;
    function handleClickOutside(event) {
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnDropdown]);

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500 text-center">
          <p className="text-lg font-semibold">Error loading tasks</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <ClockIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Pending</h3>
              <p className="text-xl sm:text-3xl font-bold text-red-600">{stats.pendingTasks}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Today's Tasks</h3>
              <p className="text-xl sm:text-3xl font-bold text-yellow-600">{stats.todayTasks}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Total Tasks</h3>
              <p className="text-xl sm:text-3xl font-bold text-blue-600">{stats.totalTasks}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <UserGroupIcon className="h-6 w-6 sm:h-8 sm:w-8 text-green-500 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Users</h3>
              <p className="text-xl sm:text-3xl font-bold text-green-600">{users.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
        <div className="flex flex-col w-full sm:flex-row sm:items-center gap-4">
          <div className="relative w-full sm:w-auto" ref={filterPopupRef}>
            <button
              onClick={() => setIsFilterPopupOpen(prev => !prev)}
              className="w-full sm:w-auto flex items-center justify-center px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="text-sm">Filter</span>
              {filters.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold ml-2 px-2.5 py-0.5 rounded-full">
                  {filters.length}
                </span>
              )}
            </button>
            <FilterPopup
              isOpen={isFilterPopupOpen}
              onClose={() => setIsFilterPopupOpen(false)}
              filters={filters}
              setFilters={setFilters}
              users={users}
              clientNames={clientNames}
              clientGroups={clientGroups}
              workTypes={workTypes}
            />
          </div>
          <input
            type="text"
            placeholder="Search tasks..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* Modern Columns Dropdown */}
          <div className="relative">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
              onClick={() => setShowColumnDropdown(v => !v)}
              aria-label="Show/Hide Columns"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              Columns
            </button>
            {showColumnDropdown && (
              <div ref={columnsDropdownRef} className="absolute right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 mt-2 w-56 animate-fade-in">
                <div className="font-semibold text-gray-700 mb-2 text-sm">Show/Hide Columns</div>
                <div className="max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {ALL_COLUMNS.map(col => (
                    <label key={col.id} className="flex items-center space-x-2 mb-1 cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors">
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(col.id)}
                        onChange={() => {
                          setVisibleColumns(cols =>
                            cols.includes(col.id)
                              ? cols.filter(c => c !== col.id)
                              : [...cols, col.id]
                          );
                        }}
                        className="accent-blue-500"
                      />
                      <span className="text-gray-800 text-sm">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[90px] transition-colors"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="createdAt">Assigned On</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
          </select>
          <select
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[90px] transition-colors"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
          <button
            onClick={handleDownloadExcel}
            className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-sm"
          >
            Download Excel
          </button>
        </div>
      </div>

      {/* Responsive table wrapper */}
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
                <th key={col.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedTasks.map((task) => (
              <tr key={task._id} className="align-middle">
                {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => {
                  // Render each cell based on col.id
                  switch (col.id) {
                    case 'title':
                      return <td key={col.id} className="px-6 py-4 w-64 whitespace-nowrap overflow-x-auto invisible-scrollbar align-middle text-sm font-medium text-gray-900" title={task.title} style={{verticalAlign: 'middle', width: '16rem', maxWidth: '16rem'}}><div className="overflow-x-auto invisible-scrollbar" style={{maxWidth: '16rem'}}><span>{task.title}</span></div></td>;
                    case 'description':
                      return <td key={col.id} className="px-6 py-4 w-64 whitespace-nowrap overflow-x-auto invisible-scrollbar align-middle text-sm text-gray-500" title={task.title} style={{verticalAlign: 'middle', width: '16rem', maxWidth: '16rem'}}><div className="overflow-x-auto invisible-scrollbar" style={{maxWidth: '16rem'}}><span>{task.description}</span></div></td>;
                    case 'clientName':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{task.clientName}</div></td>;
                    case 'clientGroup':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-gray-500">{task.clientGroup}</div></td>;
                    case 'workType':
                      return <td key={col.id} className="px-6 py-4"><div className="flex overflow-x-auto whitespace-nowrap gap-1 no-scrollbar">{task.workType && task.workType.map((type, index) => (<span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">{type}</span>))}</div></td>;
                    case 'status':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-500"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${task.status === 'completed' ? 'bg-green-100 text-green-800' : task.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : task.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{task.status.replace('_', ' ')}</span></td>;
                    case 'verificationStatus':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-500"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${task.verificationStatus === 'completed' ? 'bg-green-100 text-green-800' : task.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' : task.verificationStatus === 'first_verified' ? 'bg-blue-100 text-blue-800' : task.verificationStatus === 'executed' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>{task.verificationStatus ? task.verificationStatus.replace(/_/g, ' ') : 'Pending'}</span></td>;
                    case 'priority':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-500"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${task.priority === 'urgent' ? 'bg-red-100 text-red-800' : task.priority === 'inOneWeek' ? 'bg-orange-100 text-orange-800' : task.priority === 'inFifteenDays' ? 'bg-yellow-100 text-yellow-800' : task.priority === 'inOneMonth' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>{task.priority.replace(/([A-Z])/g, ' $1').trim()}</span></td>;
                    case 'inwardEntryDate':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-500">{task.inwardEntryDate ? new Date(task.inwardEntryDate).toLocaleDateString() : 'N/A'}</td>;
                    case 'dueDate':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-500">{formatDate(task.dueDate)}</td>;
                    case 'targetDate':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-500">{formatDate(task.targetDate)}</td>;
                    case 'assignedBy':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-500"><div className="flex items-center"><img src={task.assignedBy.photo?.url || 'https://via.placeholder.com/40'} alt={task.assignedBy.firstName} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" /><span className="ml-2">{task.assignedBy.firstName} {task.assignedBy.lastName}</span></div></td>;
                    case 'assignedTo':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap align-middle text-sm text-gray-500"><div className="flex items-center"><img src={task.assignedTo.photo?.url || 'https://via.placeholder.com/40'} alt={task.assignedTo.firstName} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" /><span className="ml-2">{task.assignedTo.firstName} {task.assignedTo.lastName}<span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">{getUserTaskHours(task._id, task.assignedTo._id)}h</span></span></div></td>;
                    case 'verificationAssignedTo':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><div className="flex items-center space-x-2">{task.verificationAssignedTo ? (<><img src={task.verificationAssignedTo.photo?.url || defaultProfile} alt={`${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}`} className="h-8 w-8 rounded-full object-cover" onError={(e) => {e.target.onerror = null;e.target.src = defaultProfile;}} /><span>{`${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}`}<span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">{getUserTaskHours(task._id, task.verificationAssignedTo._id)}h</span></span></>) : (<span>N/A</span>)}</div></td>;
                    case 'secondVerificationAssignedTo':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"><div className="flex items-center space-x-2">{task.secondVerificationAssignedTo ? (<><img src={task.secondVerificationAssignedTo.photo?.url || defaultProfile} alt={`${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}`} className="h-8 w-8 rounded-full object-cover" onError={(e) => {e.target.onerror = null;e.target.src = defaultProfile;}} /><span>{`${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}`}<span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">{getUserTaskHours(task._id, task.secondVerificationAssignedTo._id)}h</span></span></>) : (<span>N/A</span>)}</div></td>;
                    case 'files':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap"><div className="flex items-center">{task.files && task.files.length > 0 ? (<div className="flex items-center space-x-2"><span className="text-blue-600">{task.files.length}</span><span className="text-gray-500">files</span><button onClick={() => handleTaskClick(task)} className="text-blue-600 hover:text-blue-800 text-sm">View</button></div>) : (<div className="flex items-center"><span className="text-gray-400 text-sm italic">No files</span><button onClick={() => handleTaskClick(task)} className="ml-2 text-blue-600 hover:text-blue-800 text-sm">Upload</button></div>)}</div></td>;
                    case 'comments':
                      return <td key={col.id} className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.comments ? task.comments.length : 0} comments</span><button onClick={() => {setSelectedTask(task);setShowComments(true);}} className="ml-2 text-blue-600 hover:text-blue-800 text-xs">View</button></div></td>;
                    default:
                      return null;
                  }
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedTask && (showFileUpload || showComments) && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {showFileUpload ? 'Task Details' : 'Task Comments'}
              </h2>
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setShowFileUpload(false);
                  setShowComments(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {showFileUpload ? (
                <>
                  {/* Task details */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-gray-700">Title</h3>
                      <p className="text-gray-900">{selectedTask.title}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">Status</h3>
                      <p className="text-gray-900">{selectedTask.status}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">Priority</h3>
                      <p className="text-gray-900">{selectedTask.priority}</p>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-700">Due Date</h3>
                      <p className="text-gray-900">
                        {formatDate(selectedTask.dueDate)}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <h3 className="font-medium text-gray-700">Description</h3>
                      <p className="text-gray-900">{selectedTask.description}</p>
                    </div>
                  </div>

                  {/* File upload section */}
                  <div className="border-t pt-4">
                    <h3 className="text-lg font-medium mb-4">Files</h3>
                    <FileUpload
                      taskId={selectedTask._id}
                      onFileUploaded={handleFileUploaded}
                      onFileDeleted={handleFileDeleted}
                    />
                    {selectedTask.files && selectedTask.files.length > 0 && (
                      <div className="mt-4">
                        <FileList
                          taskId={selectedTask._id}
                          files={selectedTask.files}
                          onFileDeleted={handleFileDeleted}
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="border-t pt-4">
                  <TaskComments taskId={selectedTask._id} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

<style>{`
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
    background: #f1f1f1;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
`}</style> 