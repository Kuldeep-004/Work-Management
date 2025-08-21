import { useState, useEffect, useRef } from 'react';
import TaskList from '../../components/TaskList';
import AdvancedTaskTable from '../../components/AdvancedTaskTable';
import CreateTask from '../../components/CreateTask';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import ErrorBoundary from '../../components/ErrorBoundary';
import FilterPopup from '../../components/FilterPopup';
import TabBar from '../../components/TabBar';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperClipIcon,
  ChatBubbleLeftIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../apiConfig';

const ALL_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'clientName', label: 'Client Name' },
  { id: 'clientGroup', label: 'Client Group' },
  { id: 'workType', label: 'Work Type' },
  { id: 'billed', label: 'Internal Works' },
  { id: 'status', label: 'Task Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'selfVerification', label: 'Self Verification' },
  { id: 'inwardEntryDate', label: 'Inward Entry Date' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'targetDate', label: 'Target Date' },
  { id: 'assignedBy', label: 'Assigned By' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'verificationAssignedTo', label: 'Verifier 1' },
  { id: 'secondVerificationAssignedTo', label: 'Verifier 2' },
  { id: 'thirdVerificationAssignedTo', label: 'Third Verifier' },
  { id: 'fourthVerificationAssignedTo', label: 'Fourth Verifier' },
  { id: 'fifthVerificationAssignedTo', label: 'Fifth Verifier' },
  { id: 'guides', label: 'Guide' },
  { id: 'files', label: 'Files' },
  { id: 'comments', label: 'Comments' },
];

const AssignedTasks = () => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Get highlight task ID from URL parameters
  const searchParams = new URLSearchParams(location.search);
  const highlightTaskId = searchParams.get('highlightTask');
  
  // Track if highlight has been processed to avoid multiple calls
  const highlightProcessedRef = useRef(false);
  
  // Custom columns state
  const [customColumns, setCustomColumns] = useState([]);
  const [allColumns, setAllColumns] = useState(ALL_COLUMNS);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);

  // Fetch custom columns
  useEffect(() => {
    const fetchCustomColumns = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/custom-columns`);
        if (response.ok) {
          const columns = await response.json();
          setCustomColumns(columns);
          
          // Update all columns to include custom columns
          const customCols = columns.filter(col => col.isActive).map(col => ({
            id: col.name,
            label: col.label
          }));
          
          const updatedColumns = [...ALL_COLUMNS, ...customCols];
          setAllColumns(updatedColumns);

          // Update tabs to include new columns if they don't exist
          setTabs(prevTabs => {
            const savedTabs = localStorage.getItem('assignedTasksTabs');
            if (savedTabs) {
              const parsedTabs = JSON.parse(savedTabs);
              // Merge saved tabs with new columns
              return parsedTabs.map(tab => ({
                ...tab,
                visibleColumns: tab.visibleColumns || updatedColumns.map(col => col.id),
                columnOrder: tab.columnOrder || updatedColumns.map(col => col.id),
                columnWidths: tab.columnWidths || updatedColumns.reduce((acc, col) => ({ ...acc, [col.id]: 150 }), {}),
              }));
            }
            return [DEFAULT_TAB(updatedColumns)];
          });
        }
      } catch (error) {
        console.error('Error fetching custom columns:', error);
      }
    };

    fetchCustomColumns();
  }, []);

  const DEFAULT_TAB = (columns = ALL_COLUMNS) => ({
    id: Date.now(),
    title: 'Tab 1',
    filters: [],
    sortBy: 'createdAt',
    sortOrder: 'desc',
    searchTerm: '',
    statusFilter: 'all',
    visibleColumns: columns.map(col => col.id),
    activeTab: 'execution',
    columnOrder: columns.map(col => col.id),
    columnWidths: columns.reduce((acc, col) => ({ ...acc, [col.id]: 150 }), {}),
  });

  // Tab state
  const [tabs, setTabs] = useState(() => {
    const saved = localStorage.getItem('assignedTasksTabs');
    if (saved) return JSON.parse(saved);
    return [DEFAULT_TAB(allColumns)];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    const saved = localStorage.getItem('assignedTasksActiveTabId');
    if (saved) return Number(saved);
    return (JSON.parse(localStorage.getItem('assignedTasksTabs'))?.[0]?.id) || DEFAULT_TAB(allColumns).id;
  });

  // Keep other state as is, except filters/sort/search/visibleColumns/activeTab, which move to tab object
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [taskCounts, setTaskCounts] = useState({
    execution: 0,
    verification: 0,
    completed: 0
  });
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const filterPopupRef = useRef(null);
  const [clientNames, setClientNames] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnsDropdownRef = useRef(null);
  const [taskHours, setTaskHours] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Get active tab object
  const activeTabObj = tabs.find(tab => tab.id === activeTabId) || tabs[0] || DEFAULT_TAB(allColumns);

  // Tab actions
  const addTab = () => {
    const newId = Date.now();
    setTabs([...tabs, { ...DEFAULT_TAB(allColumns), id: newId, title: `Tab ${tabs.length + 1}` }]);
    setActiveTabId(newId);
  };
  const closeTab = (id) => {
    let idx = tabs.findIndex(tab => tab.id === id);
    if (tabs.length === 1) return; // Don't close last tab
    const newTabs = tabs.filter(tab => tab.id !== id);
    setTabs(newTabs);
    if (activeTabId === id) {
      setActiveTabId(newTabs[Math.max(0, idx - 1)].id);
    }
  };
  const renameTab = (id, newTitle) => {
    setTabs(tabs.map(tab => tab.id === id ? { ...tab, title: newTitle } : tab));
  };
  const updateActiveTab = (patch) => {
    setTabs(tabs.map(tab => tab.id === activeTabId ? { ...tab, ...patch } : tab));
  };

  // Persist tabs and activeTabId
  useEffect(() => {
    localStorage.setItem('assignedTasksTabs', JSON.stringify(tabs));
    localStorage.setItem('assignedTasksActiveTabId', activeTabId);
  }, [tabs, activeTabId]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users`, {
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
        const response = await fetch(`${API_BASE_URL}/api/tasks/assigned?tab=${activeTabObj.activeTab}`, {
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
  }, [user, activeTabObj.activeTab]);

  // Handle highlighting task from notification
  useEffect(() => {
    if (highlightTaskId && tasks.length > 0 && !highlightProcessedRef.current) {
      console.log('Highlighting task in assigned tasks:', highlightTaskId, typeof highlightTaskId);
      highlightProcessedRef.current = true;
      searchAndHighlightTask(highlightTaskId);
    }
  }, [highlightTaskId, tasks.length > 0]);

  const searchAndHighlightTask = async (taskId) => {
    console.log('searchAndHighlightTask called in assigned tasks with:', taskId, typeof taskId);
    
    // Ensure taskId is a string
    const taskIdString = String(taskId);
    console.log('taskIdString in assigned tasks:', taskIdString);
    
    // Clear URL parameter
    navigate(location.pathname, { replace: true });
    
    try {
      // First, verify the task exists and get its details
      const taskResponse = await fetch(`${API_BASE_URL}/api/tasks/${taskIdString}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      console.log('Task fetch response in assigned tasks:', taskResponse.status);
      
      if (!taskResponse.ok) {
        toast.error('Task not found or you do not have access to it');
        return;
      }
      
      const taskDetails = await taskResponse.json();
      console.log('Found task in assigned tasks:', taskDetails);
      
      // Search for the task in current tasks first
      const foundTask = tasks.find(t => t._id === taskIdString);
      
      if (foundTask) {
        console.log('Task found in current assigned tasks');
        // Highlight the task
        setHighlightedTaskId(taskIdString);
        
        // Clear highlight after 5 seconds
        setTimeout(() => {
          setHighlightedTaskId(null);
        }, 5000);
        
        toast.success(`Task found in assigned tasks - ${activeTabObj.activeTab} tab`);
        return;
      }
      
      // Search across all assigned task tabs
      const tabTypes = ['execution', 'verification', 'completed'];
      let foundTab = null;
      
      for (const tabType of tabTypes) {
        try {
          console.log(`Searching in assigned ${tabType}`);
          const response = await fetch(`${API_BASE_URL}/api/tasks/assigned?tab=${tabType}`, {
            headers: { Authorization: `Bearer ${user.token}` },
          });
          
          if (response.ok) {
            const tabTasks = await response.json();
            console.log(`Assigned tasks in ${tabType}:`, tabTasks.length);
            const task = tabTasks.find(t => t._id === taskIdString);
            
            if (task) {
              foundTab = tabType;
              break;
            }
          }
        } catch (error) {
          console.error(`Error searching in assigned ${tabType} tab:`, error);
        }
      }
      
      if (foundTab) {
        console.log(`Task found in assigned ${foundTab}`);
        // Switch to the tab where task was found
        updateActiveTab({ activeTab: foundTab });
        
        // Highlight the task
        setHighlightedTaskId(taskIdString);
        
        // Clear highlight after 5 seconds
        setTimeout(() => {
          setHighlightedTaskId(null);
        }, 5000);
        
        toast.success(`Task found in assigned tasks - ${foundTab} tab`);
      } else {
        console.log('Task not found in assigned tasks, trying received tasks');
        // Task exists but not in assigned tasks, might be in received tasks
        navigate(`/dashboard/received-tasks?highlightTask=${taskIdString}`);
        toast.success(`Task found in received tasks - redirecting...`);
      }
      
    } catch (error) {
      console.error('Error searching for task:', error);
      toast.error('Error searching for task');
    }
  };

  // Fetch task counts for each tab
  useEffect(() => {
    const fetchTaskCounts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/assigned/counts`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setTaskCounts(data);
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
          updateActiveTab({ filters: loadedFilters });
          updateActiveTab({ sortBy: parsed.sortBy ?? 'createdAt' });
          updateActiveTab({ sortOrder: parsed.sortOrder ?? 'desc' });
        } catch {
          updateActiveTab({ filters: [] });
          updateActiveTab({ sortBy: 'createdAt' });
          updateActiveTab({ sortOrder: 'desc' });
        }
      }
    }
  }, [user?._id]);

  useEffect(() => {
    if (user && user._id) {
      const savedFilters = activeTabObj.filters.filter(f => f.saved);
      if (savedFilters.length > 0 || activeTabObj.sortBy !== 'createdAt' || activeTabObj.sortOrder !== 'desc') {
        localStorage.setItem(
          `assignedTasksFilters_${user._id}`,
          JSON.stringify({ filters: savedFilters, sortBy: activeTabObj.sortBy, sortOrder: activeTabObj.sortOrder })
        );
      } else {
        localStorage.removeItem(`assignedTasksFilters_${user._id}`);
      }
    }
  }, [activeTabObj.filters, activeTabObj.sortBy, activeTabObj.sortOrder, user]);

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
      fetchData(`${API_BASE_URL}/api/tasks/unique/client-names`, setClientNames);
      fetchData(`${API_BASE_URL}/api/tasks/unique/client-groups`, setClientGroups);
      fetchData(`${API_BASE_URL}/api/tasks/unique/work-types`, setWorkTypes);
    }
  }, [user]);

  // Fetch task hours for all users
  useEffect(() => {
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
    localStorage.setItem(key, JSON.stringify(activeTabObj.visibleColumns));
  }, [activeTabObj.visibleColumns, user]);

  const getFilteredAndSortedTasks = (tasks) => {
    if (!Array.isArray(tasks)) return [];

    // Priority order mapping for sorting
    const priorityOrder = {
      'urgent': 1,
      'today': 2,
      'lessThan3Days': 3,
      'thisWeek': 4,
      'thisMonth': 5,
      'regular': 6,
      'filed': 7,
      'dailyWorksOffice': 8,
      'monthlyWorks': 9
    };

    let filteredTasks = tasks.filter(task => {
      // Filter by search term
      if (activeTabObj.searchTerm) {
        const lowercasedTerm = activeTabObj.searchTerm.toLowerCase();
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
      if (activeTabObj.statusFilter !== 'all' && task.status !== activeTabObj.statusFilter) {
        return false;
      }

      // Apply advanced filters with AND/OR logic
      if (!activeTabObj.filters.length) return true;
      let result = null;
      for (let i = 0; i < activeTabObj.filters.length; i++) {
        const filter = activeTabObj.filters[i];
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

    if (!activeTabObj.sortBy) return filteredTasks;

    return filteredTasks.sort((a, b) => {
      let aValue = a[activeTabObj.sortBy];
      let bValue = b[activeTabObj.sortBy];
      if (activeTabObj.sortBy === 'createdAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (activeTabObj.sortBy === 'priority') {
        // Use priority order mapping for priority sorting
        aValue = priorityOrder[aValue] || 999;
        bValue = priorityOrder[bValue] || 999;
        // For priority, descending should show highest priority first (urgent=1, today=2, etc.)
        // So we swap the logic for priority sorting
        if (aValue < bValue) return activeTabObj.sortOrder === 'desc' ? -1 : 1;
        if (aValue > bValue) return activeTabObj.sortOrder === 'desc' ? 1 : -1;
        return 0;
      }
      if (aValue < bValue) return activeTabObj.sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return activeTabObj.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Handler for edit
  const handleEditTask = (task) => {
    setEditTask(task);
    setEditModalOpen(true);
  };

  // Handler for create
  const handleCreateModal = (action) => {
    if (action === 'open') setCreateModalOpen(true);
    else setCreateModalOpen(false);
  };

  // Handler for after submit (edit or create)
  const handleTaskSubmit = (updatedOrCreated) => {
    setEditModalOpen(false);
    setCreateModalOpen(false);
    setEditTask(null);
    // Optionally, refetch or update tasks state here
    // For now, just reload tasks
    // You can optimize by updating state directly
    // setTasks(...)
  };

  // Debug logs
  console.log('ALL_COLUMNS:', ALL_COLUMNS);
  console.log('visibleColumns:', activeTabObj.visibleColumns);
  console.log('tasks:', tasks);

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
    <div className="p-4">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={setActiveTabId}
        onAddTab={addTab}
        onCloseTab={closeTab}
        onRenameTab={renameTab}
      />
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-1 sm:space-x-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
            {['execution', 'verification', 'completed'].map(tabKey => (
              <button
                key={tabKey}
                onClick={() => updateActiveTab({ activeTab: tabKey })}
                className={`whitespace-nowrap py-3 px-0 border-b-2 font-medium text-sm sm:px-0 ${
                  activeTabObj.activeTab === tabKey
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tabKey === 'execution' && 'Tasks For Execution'}
                {tabKey === 'verification' && 'Tasks Under Verification'}
                {tabKey === 'completed' && 'Completed'}
                <span className="bg-gray-200 text-gray-800 rounded-full px-2 py-0.5 ml-2 text-xs">
                  {taskCounts[tabKey] || 0}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-0 gap-4">
        <div className="flex flex-row flex-wrap items-center gap-4 w-full sm:w-auto">
          <div className="relative" ref={filterPopupRef}>
            <button
              onClick={() => setIsFilterPopupOpen(prev => !prev)}
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm"
            >
              <span>Filter</span>
              {activeTabObj.filters.length > 0 && (
                <span className="bg-blue-100 text-blue-800 text-xs font-semibold ml-2 px-2.5 py-0.5 rounded-full">
                  {activeTabObj.filters.length}
                </span>
              )}
            </button>
            <FilterPopup
              isOpen={isFilterPopupOpen}
              onClose={() => setIsFilterPopupOpen(false)}
              filters={activeTabObj.filters}
              setFilters={filters => updateActiveTab({ filters })}
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
            value={activeTabObj.searchTerm}
            onChange={e => updateActiveTab({ searchTerm: e.target.value })}
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
                        checked={activeTabObj.visibleColumns.includes(col.id)}
                        onChange={() => {
                          const cols = activeTabObj.visibleColumns;
                          updateActiveTab({
                            visibleColumns: cols.includes(col.id)
                              ? cols.filter(c => c !== col.id)
                              : [...cols, col.id]
                          });
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
            value={activeTabObj.sortBy}
            onChange={e => updateActiveTab({ sortBy: e.target.value })}
          >
            <option value="">None</option>
            <option value="createdAt">Assigned On</option>
            <option value="priority">Priority</option>
            <option value="status">Stages</option>
            <option value="clientName">Client Name</option>
            <option value="clientGroup">Client Group</option>
            <option value="workType">Work Type</option>
            <option value="billed">Billed</option>
          </select>
        </div>
      </div>
      <ErrorBoundary>
        <AdvancedTaskTable
          tasks={getFilteredAndSortedTasks(tasks)}
          viewType="assigned"
          taskType={activeTabObj.activeTab}
          highlightedTaskId={highlightedTaskId}
          onTaskUpdate={(taskId, updater) => {
            setTasks(prevTasks => prevTasks.map(task =>
              task._id === taskId ? updater(task) : task
            ));
          }}
          onTaskDelete={(taskId) => {
            setTasks(tasks.filter(task => task._id !== taskId));
          }}
          onStatusChange={(taskId, newStatus) => {
            setTasks(prevTasks => prevTasks.map(task =>
              task._id === taskId ? { ...task, status: newStatus } : task
            ));
          }}
          shouldDisableActions={(task) => false}
          shouldDisableFileActions={() => false}
          taskHours={taskHours}
          visibleColumns={activeTabObj.visibleColumns}
          setVisibleColumns={cols => updateActiveTab({ visibleColumns: cols })}
          storageKeyPrefix="assignedtasks"
          onEditTask={handleEditTask}
          sortBy={activeTabObj.sortBy}
          dynamicColumns={allColumns}
          customColumns={customColumns}
        />
      </ErrorBoundary>
      {/* Edit Task Modal */}
      {editModalOpen && (
        <CreateTask
          users={users}
          mode="edit"
          initialData={editTask}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSubmit={handleTaskSubmit}
        />
      )}
    </div>
  );
};

export default AssignedTasks; 