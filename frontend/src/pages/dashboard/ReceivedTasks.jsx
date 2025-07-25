import React, { useState, useEffect, useRef } from 'react';
import TaskList from '../../components/TaskList';
import AdvancedTaskTable from '../../components/AdvancedTaskTable';
import CreateTask from '../../components/CreateTask';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import ErrorBoundary from '../../components/ErrorBoundary';
import FilterPopup from '../../components/FilterPopup';
import TabBar from '../../components/TabBar';
import {
  ChartBarIcon,
  UserGroupIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperClipIcon,
  ChatBubbleLeftIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import { API_BASE_URL, fetchTabState, saveTabState } from '../../apiConfig';

const ALL_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'clientName', label: 'Client Name' },
  { id: 'clientGroup', label: 'Client Group' },
  { id: 'workType', label: 'Work Type' },
  { id: 'workDoneBy', label: 'Work Done' },
  { id: 'billed', label: 'Internal Works' },
  { id: 'status', label: 'Task Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'selfVerification', label: 'Self Verification' },
  { id: 'inwardEntryDate', label: 'Inward Entry Date' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'targetDate', label: 'Target Date' },
  { id: 'assignedBy', label: 'Assigned By' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'verificationAssignedTo', label: 'First Verifier' },
  { id: 'secondVerificationAssignedTo', label: 'Second Verifier' },
  { id: 'thirdVerificationAssignedTo', label: 'Third Verifier' },
  { id: 'fourthVerificationAssignedTo', label: 'Fourth Verifier' },
  { id: 'fifthVerificationAssignedTo', label: 'Fifth Verifier' },
  { id: 'guides', label: 'Guide' },
  { id: 'files', label: 'Files' },
  { id: 'comments', label: 'Comments' },
];

const DEFAULT_TAB = () => ({
  id: Date.now(),
  title: 'Tab 1',
  filters: [],
  sortBy: 'createdAt',
  sortOrder: 'desc',
  searchTerm: '',
  statusFilter: 'all',
  visibleColumns: ALL_COLUMNS.map(col => col.id),
  columnOrder: ALL_COLUMNS.map(col => col.id),
  columnWidths: Object.fromEntries(ALL_COLUMNS.map(col => [col.id, col.defaultWidth || 150])),
  activeTab: 'execution',
});

const ReceivedTasks = () => {
  const { user, isAuthenticated } = useAuth();
  // Tab state
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabsLoaded, setTabsLoaded] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false); // NEW
  const [usersLoaded, setUsersLoaded] = useState(false); // NEW
  const [error, setError] = useState(null);
  const [taskCounts, setTaskCounts] = useState({
    execution: 0,
    receivedVerification: 0,
    issuedVerification: 0,
    completed: 0,
    guidance: 0,
  });
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const filterPopupRef = useRef(null);
  const [clientNames, setClientNames] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnsDropdownRef = useRef(null);
  const [taskHours, setTaskHours] = useState([]);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);

  // Get active tab object (defensive)
  const activeTabObj = tabs.find(tab => tab.id === activeTabId) || tabs[0] || DEFAULT_TAB();

  // Tab actions
  const addTab = () => {
    const newId = Date.now();
    setTabs([...tabs, { ...DEFAULT_TAB(), id: newId, title: `Tab ${tabs.length + 1}` }]);
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
    setTabs(tabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      let newTab = { ...tab, ...patch };
      if (patch.visibleColumns) {
        // Remove hidden columns from order, add new visible columns at the end
        const currentOrder = newTab.columnOrder || ALL_COLUMNS.map(col => col.id);
        const newOrder = currentOrder.filter(colId => patch.visibleColumns.includes(colId));
        patch.visibleColumns.forEach(colId => {
          if (!newOrder.includes(colId)) newOrder.push(colId);
        });
        newTab.columnOrder = newOrder;
      }
      return newTab;
    }));
  };

  // --- ROW ORDER LOGIC ---
  const [rowOrder, setRowOrder] = useState([]);
  const applyRowOrder = (tasks, order) => {
    if (!order || order.length === 0) return tasks;
    const taskMap = new Map(tasks.map(task => [task._id, task]));
    const orderedTasks = [];
    const remainingTasks = new Set(tasks.map(task => task._id));
    order.forEach(id => {
      if (taskMap.has(id)) {
        orderedTasks.push(taskMap.get(id));
        remainingTasks.delete(id);
      }
    });
    remainingTasks.forEach(id => {
      orderedTasks.push(taskMap.get(id));
    });
    return orderedTasks;
  };

  const fetchTasksAndTabState = async () => {
    try {
      let url;
      if (activeTabObj.activeTab === 'guidance') {
        url = `${API_BASE_URL}/api/tasks/received/guidance`;
      } else {
        url = `${API_BASE_URL}/api/tasks/received?tab=${activeTabObj.activeTab}`;
      }
      // Fetch tasks and tab state together
      const [tasksResponse, tabState] = await Promise.all([
        fetch(url, {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        fetchTabState('receivedTasks', user.token)
      ]);
      if (!tasksResponse.ok) throw new Error('Failed to fetch tasks');
      let tasksData = await tasksResponse.json();
      // Get rowOrder from tabState
      let order = [];
      if (tabState && Array.isArray(tabState.rowOrder)) {
        order = tabState.rowOrder;
        setRowOrder(order);
      }
      // Apply row order if available
      if (order.length > 0) {
        tasksData = applyRowOrder(tasksData, order);
      }
      setTasks(tasksData);
      setError(null);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError(error.message);
      toast.error('Failed to fetch tasks');
      setTasks([]);
    } finally {
      setTasksLoaded(true); // NEW
    }
  };

  if (!isAuthenticated()) {
    return null;
  }

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/except-me`, {
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
      } finally {
        setUsersLoaded(true); // NEW
      }
    };

    if (user && user.token) {
      setUsersLoaded(false); // NEW: reset before fetching
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    if (user && user.token) {
      setTasksLoaded(false); // NEW: reset before fetching
      fetchTasksAndTabState();
    }
    // eslint-disable-next-line
  }, [user, activeTabObj.activeTab]);

  // Fetch task counts for each tab
  useEffect(() => {
    const fetchTaskCounts = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/received/counts`, {
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
      fetchData(`${API_BASE_URL}/api/priorities`, setPriorities);
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

  const getFilteredAndSortedTasks = (tasks) => {
    if (!Array.isArray(tasks)) return [];

    // Priority order mapping for sorting (dynamic from API)
    const priorityOrder = {};
    if (priorities.length > 0) {
      priorities.forEach((priority, index) => {
        priorityOrder[priority.name] = priority.order || (index + 1);
      });
    } else {
      // Fallback to default priority order if API priorities not loaded
      const defaultOrder = {
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
      Object.assign(priorityOrder, defaultOrder);
    }

    let filteredTasks = tasks.filter(task => {
      // Exclude tasks with verificationStatus 'pending'
      if (task.verificationStatus === 'pending') return false;

      // For guidance tab, only show tasks where status !== 'completed'
      if (activeTabObj.activeTab === 'guidance' && task.status === 'completed') return false;

      // For completed tab, only show tasks where assignedTo is current user and status is completed
      if (activeTabObj.activeTab === 'completed' && (!task.assignedTo || (task.assignedTo._id !== user._id && task.assignedTo !== user._id || task.status !== 'completed'))) return false;

      // For receivedVerification tab, only show tasks where status is not completed and latest verifier is current user
      if (activeTabObj.activeTab === 'receivedVerification') {
        if (task.status === 'completed') return false;
        // Find the latest assigned verifier (from 1st to 5th)
        const verifierFields = [
          'verificationAssignedTo',
          'secondVerificationAssignedTo',
          'thirdVerificationAssignedTo',
          'fourthVerificationAssignedTo',
          'fifthVerificationAssignedTo',
        ];
        let latestVerifier = null;
        for (let i = verifierFields.length - 1; i >= 0; i--) {
          if (task[verifierFields[i]] && task[verifierFields[i]]._id) {
            latestVerifier = task[verifierFields[i]]._id;
            break;
          }
        }
        if (!latestVerifier || String(latestVerifier) !== String(user._id)) return false;
      }

      // Filter by search term
      if (activeTabObj.searchTerm) {
        const lowercasedTerm = activeTabObj.searchTerm.toLowerCase();
        const matches = (
          (task.title && task.title.toLowerCase().includes(lowercasedTerm)) ||
          (task.description && task.description.toLowerCase().includes(lowercasedTerm)) ||
          (task.clientName && task.clientName.toLowerCase().includes(lowercasedTerm)) ||
          (task.clientGroup && task.clientGroup.toLowerCase().includes(lowercasedTerm)) ||
          (task.workType && (
            (typeof task.workType === 'string' && task.workType.toLowerCase().includes(lowercasedTerm)) ||
            (Array.isArray(task.workType) && task.workType.join(', ').toLowerCase().includes(lowercasedTerm))
          ))
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

  const handleStatusChange = async (taskId, newStatus) => {
    let response;
    try {
      console.log('Starting status update for task:', taskId, 'new status:', newStatus);
      
      response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('Response data:', data);

      if (!response.ok) {
        console.error('Server error response:', {
          status: response.status,
          statusText: response.statusText,
          data
        });
        throw new Error(data.message || 'Failed to update task status');
      }

      console.log('Updating tasks state with new data');
      // Update the task in the state with the server response
      setTasks(prevTasks => {
        const updatedTasks = prevTasks.map(task => 
          task._id === taskId ? data : task
        );
        console.log('Updated tasks state:', updatedTasks);
        return updatedTasks;
      });

      toast.success('Task status updated successfully');
    } catch (error) {
      console.error('Error in handleStatusChange:', {
        error,
        responseStatus: response?.status,
        responseStatusText: response?.statusText,
        errorMessage: error.message
      });
      
      // Revert the optimistic update if it failed
      setTasks(prevTasks => {
        const revertedTasks = prevTasks.map(task => 
          task._id === taskId ? { ...task, status: task.status } : task
        );
        console.log('Reverted tasks state:', revertedTasks);
        return revertedTasks;
      });
      
      toast.error(error.message || 'Failed to update task status');
    }
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
        if (response.status === 403) {
          throw new Error('You can only delete tasks that you created or are assigned to');
        }
        throw new Error(errorData.message || 'Failed to delete task');
      }

      setTasks(tasks.filter(task => task._id !== taskId));
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(error.message || 'Failed to delete task');
    }
  };

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

  // Fetch tabs and activeTabId from backend on mount
  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    (async () => {
      try {
        const tabStates = await fetchTabState('receivedTasks', user.token);
        if (isMounted && tabStates && Array.isArray(tabStates.tabs)) {
          setTabs(tabStates.tabs);
          setActiveTabId(tabStates.activeTabId);
        } else if (isMounted) {
          setTabs([DEFAULT_TAB()]);
          setActiveTabId(DEFAULT_TAB().id);
        }
      } catch {
        if (isMounted) {
          setTabs([DEFAULT_TAB()]);
          setActiveTabId(DEFAULT_TAB().id);
        }
      } finally {
        if (isMounted) setTabsLoaded(true);
      }
    })();
    return () => { isMounted = false; };
  }, [user]);

  // Save tabs and activeTabId to backend whenever they change
  useEffect(() => {
    if (!user?.token || !tabsLoaded) return;
    saveTabState('receivedTasks', { tabs, activeTabId, rowOrder }, user.token).catch(() => {});
  }, [tabs, activeTabId, rowOrder, user, tabsLoaded]);

  // Combine all loading states
  const isPageLoading = !tabsLoaded || !usersLoaded || !tasksLoaded;

  if (isPageLoading) {
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
        {/* Replace nav tabs with a select for activeTab in the current tab */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-1 sm:space-x-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
            {['execution', 'receivedVerification', 'issuedVerification', 'guidance', 'completed'].map(tabKey => (
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
                {tabKey === 'receivedVerification' && 'Task Received For Verification'}
                {tabKey === 'issuedVerification' && 'Task Issued For Verification'}
                {tabKey === 'guidance' && 'Task For Guidance'}
                {tabKey === 'completed' && 'Completed'}
                <span className="bg-gray-200 text-gray-800 rounded-full px-2 py-0.5 ml-2 text-xs">
                  {taskCounts[tabKey] || 0}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
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
              priorities={priorities}
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
          {/* Replace the old <select> with the dashboard-style Group By dropdown */}
          <div className="relative flex items-center gap-2">
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
              onClick={() => setShowGroupByDropdown(v => !v)}
              type="button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>
              <span className="font-semibold">Group By</span>
            </button>
            {showGroupByDropdown && (
              <div className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-44 animate-fade-in" style={{minWidth: '160px'}}>
                <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">Group By</div>
                <button className={`block w-full text-left px-4 py-2 rounded ${!activeTabObj.sortBy || activeTabObj.sortBy === '' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: '' }); setShowGroupByDropdown(false); }}>None</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'createdAt' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'createdAt' }); setShowGroupByDropdown(false); }}>Received On</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'priority' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'priority' }); setShowGroupByDropdown(false); }}>Priority</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'status' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'status' }); setShowGroupByDropdown(false); }}>Stages</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'clientName' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'clientName' }); setShowGroupByDropdown(false); }}>Client Name</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'clientGroup' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'clientGroup' }); setShowGroupByDropdown(false); }}>Client Group</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'workType' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'workType' }); setShowGroupByDropdown(false); }}>Work Type</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'workDoneBy' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'workDoneBy' }); setShowGroupByDropdown(false); }}>Assigned To</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'billed' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'billed' }); setShowGroupByDropdown(false); }}>Billed</button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowCreateTaskModal(true)}
            className="ml-0 flex items-center justify-center w-7 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            title="Create Task"
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
      </div>
      <ErrorBoundary>
        <AdvancedTaskTable
          tasks={getFilteredAndSortedTasks(tasks)}
          viewType="received"
          taskType={activeTabObj.activeTab}
          users={users}
          currentUser={user}
          onTaskUpdate={(taskId, updater) => {
            // Update task in the local state
            setTasks(prevTasks => prevTasks.map(task =>
              task._id === taskId ? updater(task) : task
            ));
            // No need to call fetchTasks here as the AdvancedTaskTable component will
            // handle refreshing data when needed for priority changes
          }}
          onTaskDelete={handleDeleteTask}
          onStatusChange={handleStatusChange}
          shouldDisableActions={(task) => false}
          shouldDisableFileActions={() => false}
          taskHours={taskHours}
          visibleColumns={activeTabObj.visibleColumns}
          setVisibleColumns={cols => updateActiveTab({ visibleColumns: cols })}
          columnOrder={activeTabObj.columnOrder}
          setColumnOrder={order => updateActiveTab({ columnOrder: order })}
          columnWidths={activeTabObj.columnWidths}
          setColumnWidths={widths => updateActiveTab({ columnWidths: widths })}
          storageKeyPrefix="receivedtasks"
          refetchTasks={fetchTasksAndTabState}
          sortBy={activeTabObj.sortBy}
          tabId={activeTabObj.id}
          tabKey="receivedTasks"
        />
      </ErrorBoundary>
      <CreateTask
        isOpen={showCreateTaskModal}
        onClose={() => setShowCreateTaskModal(false)}
        users={users}
      />
    </div>
  );
};

export default ReceivedTasks; 