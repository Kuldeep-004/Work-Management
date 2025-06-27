import { useState, useEffect, useRef } from 'react';
import TaskList from '../../components/TaskList';
import CreateTask from '../../components/CreateTask';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import ErrorBoundary from '../../components/ErrorBoundary';
import FilterPopup from '../../components/FilterPopup';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperClipIcon,
  ChatBubbleLeftIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';

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

const AssignedTasks = () => {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('execution');
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [taskCounts, setTaskCounts] = useState({
    execution: 0,
    verification: 0
  });
  const [filters, setFilters] = useState([]);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const filterPopupRef = useRef(null);
  const [clientNames, setClientNames] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnsDropdownRef = useRef(null);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const userId = user?._id || 'guest';
    const key = `assignedtasks_columns_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return ALL_COLUMNS.map(col => col.id);
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('http://localhost:5000/api/users', {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        if (!res.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await res.json();
        setUsers(data);
      } catch (err) {
        console.error('Error fetching users:', err);
        toast.error('Failed to fetch users');
      }
    };

    if (user && user.token) {
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    const fetchAssignedTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('http://localhost:5000/api/tasks/assigned', {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch assigned tasks');
        }
        const data = await response.json();
        setTasks(data);
      } catch (err) {
        setError(err.message);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    if (user && user.token) {
      fetchAssignedTasks();
    }
  }, [user]);

  // Fetch task counts for each tab
  useEffect(() => {
    const fetchTaskCounts = async () => {
      try {
        // Fetch assigned tasks count (execution)
        const assignedResponse = await fetch('http://localhost:5000/api/tasks/assigned', {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });
        
        // Fetch verification tasks count
        const verificationResponse = await fetch('http://localhost:5000/api/tasks/under-verification', {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        if (assignedResponse.ok && verificationResponse.ok) {
          const assignedData = await assignedResponse.json();
          const verificationData = await verificationResponse.json();
          
          const executionCount = assignedData.length;
          const verificationCount = verificationData.length;
          
          setTaskCounts({
            execution: executionCount,
            verification: verificationCount
          });
        }
      } catch (error) {
        console.error('Error fetching task counts:', error);
      }
    };

    if (user && user.token) {
      fetchTaskCounts();
    }
  }, [user]);

  useEffect(() => {
    if (user && user._id) {
      const savedFilters = localStorage.getItem(`assignedTasksFilters_${user._id}`);
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

  useEffect(() => {
    if (user && user._id) {
      const savedFilters = filters.filter(f => f.saved);
      if (savedFilters.length > 0 || sortBy !== 'createdAt' || sortOrder !== 'desc') {
        localStorage.setItem(
          `assignedTasksFilters_${user._id}`,
          JSON.stringify({ filters: savedFilters, sortBy, sortOrder })
        );
      } else {
        localStorage.removeItem(`assignedTasksFilters_${user._id}`);
      }
    }
  }, [filters, sortBy, sortOrder, user]);

  useEffect(() => {
    const fetchData = async (url, setter) => {
      try {
        const response = await fetch(url, {
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
      fetchData('http://localhost:5000/api/tasks/unique/client-names', setClientNames);
      fetchData('http://localhost:5000/api/tasks/unique/client-groups', setClientGroups);
      fetchData('http://localhost:5000/api/tasks/unique/work-types', setWorkTypes);
    }
  }, [user]);

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

  useEffect(() => {
    const userId = user?._id || 'guest';
    const key = `assignedtasks_columns_${userId}`;
    localStorage.setItem(key, JSON.stringify(visibleColumns));
  }, [visibleColumns, user]);

  const getFilteredAndSortedTasks = (tasks) => {
    if (!Array.isArray(tasks)) return [];

    let filteredTasks = tasks.filter(task => {
      // Filter by search term
      if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        const matches = (
          (task.title && task.title.toLowerCase().includes(lowercasedTerm)) ||
          (task.description && task.description.toLowerCase().includes(lowercasedTerm)) ||
          (task.clientName && task.clientName.toLowerCase().includes(lowercasedTerm)) ||
          (task.clientGroup && task.clientGroup.toLowerCase().includes(lowercasedTerm)) ||
          (task.workType &&
            (Array.isArray(task.workType)
              ? task.workType.join(', ').toLowerCase().includes(lowercasedTerm)
              : typeof task.workType === 'string'
                ? task.workType.toLowerCase().includes(lowercasedTerm)
                : false)
          )
        );
        if (!matches) {
          return false;
        }
      }

      // Filter by status
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      // Apply advanced filters with AND/OR logic
      if (!filters.length) return true;
      let result = null;
      for (let i = 0; i < filters.length; i++) {
        const filter = filters[i];
        const { column, operator, value } = filter;
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

  if (!isAuthenticated()) {
    return null;
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
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Assigned Tasks</h2>
        <CreateTask users={users} />
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-1 sm:space-x-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('execution')}
              className={`whitespace-nowrap py-3 px-0 border-b-2 font-medium text-sm ${
                activeTab === 'execution'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tasks For Execution
              <span className="bg-gray-200 text-gray-800 rounded-full px-2 py-0.5 ml-2 text-xs">
                {taskCounts.execution}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('verification')}
              className={`whitespace-nowrap py-3 px-0 border-b-2 font-medium text-sm ${
                activeTab === 'verification'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Tasks Under Verification
              <span className="bg-gray-200 text-gray-800 rounded-full px-2 py-0.5 ml-2 text-xs">
                {taskCounts.verification}
              </span>
            </button>
          </nav>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex flex-row flex-wrap items-center gap-4 w-full sm:w-auto">
          <div className="relative" ref={filterPopupRef}>
            <button
              onClick={() => setIsFilterPopupOpen(prev => !prev)}
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm"
            >
              <span>Filter</span>
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
            className="w-60 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
          <select
            className="px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="createdAt">Assigned On</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="asc">Asc</option>
            <option value="desc">Desc</option>
          </select>
        </div>
      </div>
      <ErrorBoundary>
        {activeTab === 'verification' ? (
          <TaskList taskType="verification" viewType="under_verification" showControls={false} searchTerm={searchTerm} setSearchTerm={setSearchTerm} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
        ) : (
          <TaskList taskType={activeTab} viewType="assigned" tasks={getFilteredAndSortedTasks(tasks)} showControls={false} searchTerm={searchTerm} setSearchTerm={setSearchTerm} visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns} />
        )}
      </ErrorBoundary>
    </div>
  );
};

export default AssignedTasks; 