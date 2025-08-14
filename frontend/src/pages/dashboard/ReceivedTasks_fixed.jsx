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

// All columns including verification - this will be used for dropdown and column management
const ALL_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'clientName', label: 'Client Name' },
  { id: 'clientGroup', label: 'Client Group' },
  { id: 'workType', label: 'Work Type' },
  { id: 'billed', label: 'Internal Works' },
  { id: 'status', label: 'Task Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'verification', label: 'Verifications', defaultWidth: 130 },
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

const DEFAULT_TAB = (taskType = 'execution', customColumns = []) => {
  const baseColumns = ALL_COLUMNS.map(col => col.id);
  const customCols = customColumns.map(col => `custom_${col.name}`);
  const allColumns = [...baseColumns, ...customCols];
  
  return {
    id: Date.now(),
    title: 'Tab 1',
    filters: [],
    sortBy: 'createdAt',
    sortOrder: 'desc',
    searchTerm: '',
    statusFilter: 'all',
    visibleColumns: allColumns,
    columnOrder: allColumns,
    columnWidths: Object.fromEntries([
      ...ALL_COLUMNS.map(col => [col.id, col.defaultWidth || 150]),
      ...customColumns.map(col => [`custom_${col.name}`, 150])
    ]),
    activeTab: taskType,
  };
};

const ReceivedTasks = () => {
  const { user, isAuthenticated } = useAuth();
  
  // ALL STATE - moved to top to avoid hooks order issues
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [taskCounts, setTaskCounts] = useState({
    execution: 0,
    receivedVerification: 0,
    issuedVerification: 0,
    completed: 0,
    guidance: 0,
  });
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const [clientNames, setClientNames] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [taskHours, setTaskHours] = useState([]);
  const [showCreateTaskModal, setShowCreateTaskModal] = useState(false);
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnsLoaded, setCustomColumnsLoaded] = useState(false);
  const [rowOrder, setRowOrder] = useState([]);
  
  // REFS
  const filterPopupRef = useRef(null);
  const columnsDropdownRef = useRef(null);

  // Get active tab object (defensive)
  const activeTabObj = tabs.find(tab => tab.id === activeTabId) || tabs[0] || DEFAULT_TAB('execution', customColumnsLoaded ? customColumns : []);

  // Get extended columns including custom columns
  const getExtendedColumns = () => {
    const baseColumns = [...ALL_COLUMNS];
    
    if (!customColumnsLoaded || customColumns.length === 0) {
      return baseColumns;
    }

    const customCols = customColumns.map(col => ({
      id: `custom_${col.name}`,
      label: col.label,
      defaultWidth: 150,
      isCustom: true,
      customColumn: col
    }));

    return [...baseColumns, ...customCols];
  };

  const extendedColumns = getExtendedColumns();

  // HELPER FUNCTIONS
  const addTab = () => {
    const newId = Date.now();
    const currentTaskType = activeTabObj.activeTab || 'execution';
    setTabs([...tabs, { ...DEFAULT_TAB(currentTaskType, customColumns), id: newId, title: `Tab ${tabs.length + 1}` }]);
    setActiveTabId(newId);
  };
  
  const closeTab = (id) => {
    let idx = tabs.findIndex(tab => tab.id === id);
    if (tabs.length === 1) return;
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
      
      const [tasksResponse, tabState] = await Promise.all([
        fetch(url, {
          headers: { Authorization: `Bearer ${user.token}` },
        }),
        fetchTabState('receivedTasks', user.token)
      ]);
      
      if (!tasksResponse.ok) throw new Error('Failed to fetch tasks');
      let tasksData = await tasksResponse.json();
      
      let order = [];
      if (tabState && Array.isArray(tabState.rowOrder)) {
        order = tabState.rowOrder;
        setRowOrder(order);
      }
      
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
      setTasksLoaded(true);
    }
  };

  // ALL USEEFFECTS - moved to top level to avoid hook order issues
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
        setUsersLoaded(true);
      }
    };

    if (user && user.token) {
      setUsersLoaded(false);
      fetchUsers();
    }
  }, [user]);

  useEffect(() => {
    if (user && user.token) {
      setTasksLoaded(false);
      fetchTasksAndTabState();
    }
  }, [user, activeTabObj.activeTab]);

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
    const fetchCustomColumns = async () => {
      if (!user?.token) return;
      
      try {
        const response = await fetch(`${API_BASE_URL}/api/custom-columns`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (response.ok) {
          const columns = await response.json();
          setCustomColumns(columns);
        }
      } catch (error) {
        console.error('Error fetching custom columns:', error);
        setCustomColumns([]);
      } finally {
        setCustomColumnsLoaded(true);
      }
    };

    fetchCustomColumns();
  }, [user?.token]);

  useEffect(() => {
    const loadTabState = async () => {
      if (!user?.token) return;
      
      try {
        const tabState = await fetchTabState('receivedTasks', user.token);
        if (tabState && Array.isArray(tabState.tabs) && tabState.tabs.length > 0) {
          const updatedTabs = tabState.tabs.map(tab => {
            const defaultTab = DEFAULT_TAB(tab.activeTab || 'execution', customColumns);
            return {
              ...defaultTab,
              ...tab,
              visibleColumns: tab.visibleColumns || defaultTab.visibleColumns,
              columnOrder: tab.columnOrder || defaultTab.columnOrder,
              columnWidths: { ...defaultTab.columnWidths, ...(tab.columnWidths || {}) },
            };
          });
          setTabs(updatedTabs);
          setActiveTabId(tabState.activeTabId || updatedTabs[0]?.id);
        } else {
          const defaultTab = DEFAULT_TAB('execution', customColumns);
          setTabs([defaultTab]);
          setActiveTabId(defaultTab.id);
        }
      } catch (error) {
        console.error('Error loading tab state:', error);
        const defaultTab = DEFAULT_TAB('execution', customColumns);
        setTabs([defaultTab]);
        setActiveTabId(defaultTab.id);
      } finally {
        setTabsLoaded(true);
      }
    };

    if (customColumnsLoaded) {
      loadTabState();
    }
  }, [user?.token, customColumnsLoaded, customColumns]);

  useEffect(() => {
    const saveTabStateData = async () => {
      if (!user?.token || !tabsLoaded || tabs.length === 0) return;
      
      try {
        const tabState = {
          tabs,
          activeTabId,
          rowOrder
        };
        await saveTabState('receivedTasks', tabState, user.token);
      } catch (error) {
        console.error('Error saving tab state:', error);
      }
    };

    saveTabStateData();
  }, [tabs, activeTabId, rowOrder, user?.token, tabsLoaded]);

  useEffect(() => {
    const loadFiltersAndWorkTypes = async () => {
      try {
        const [clientNamesRes, clientGroupsRes, workTypesRes, prioritiesRes, taskHoursRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/clients/names`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(`${API_BASE_URL}/api/clients/groups`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(`${API_BASE_URL}/api/tasks/work-types`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(`${API_BASE_URL}/api/priorities`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetch(`${API_BASE_URL}/api/tasks/task-hours`, {
            headers: { Authorization: `Bearer ${user.token}` },
          })
        ]);

        if (clientNamesRes.ok) {
          const clientNames = await clientNamesRes.json();
          setClientNames(clientNames);
        }

        if (clientGroupsRes.ok) {
          const clientGroups = await clientGroupsRes.json();
          setClientGroups(clientGroups);
        }

        if (workTypesRes.ok) {
          const workTypes = await workTypesRes.json();
          setWorkTypes(workTypes);
        }

        if (prioritiesRes.ok) {
          const priorities = await prioritiesRes.json();
          setPriorities(priorities);
        }

        if (taskHoursRes.ok) {
          const taskHours = await taskHoursRes.json();
          setTaskHours(taskHours);
        }
      } catch (error) {
        console.error('Error loading filters and work types:', error);
        toast.error('Failed to load filters');
      }
    };

    if (user && user.token) {
      loadFiltersAndWorkTypes();
    }
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
      if (filterPopupRef.current && !filterPopupRef.current.contains(event.target)) {
        setIsFilterPopupOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // EARLY RETURN CHECKS - after all hooks
  if (!isAuthenticated()) {
    return null;
  }

  const getFilteredAndSortedTasks = (tasks) => {
    if (!Array.isArray(tasks)) return [];
    
    let filteredTasks = tasks.filter(task => {
      // Apply filters based on activeTabObj.filters
      for (const filter of activeTabObj.filters || []) {
        if (filter.type === 'clientName' && filter.values.length > 0) {
          if (!filter.values.includes(task.clientName)) return false;
        }
        if (filter.type === 'clientGroup' && filter.values.length > 0) {
          if (!filter.values.includes(task.clientGroup)) return false;
        }
        if (filter.type === 'workType' && filter.values.length > 0) {
          const taskWorkTypes = Array.isArray(task.workType) ? task.workType : [task.workType];
          if (!taskWorkTypes.some(wt => filter.values.includes(wt))) return false;
        }
        if (filter.type === 'priority' && filter.values.length > 0) {
          if (!filter.values.includes(task.priority)) return false;
        }
        if (filter.type === 'status' && filter.values.length > 0) {
          if (!filter.values.includes(task.description)) return false;
        }
        if (filter.type === 'assignedBy' && filter.values.length > 0) {
          const assignedByName = typeof task.assignedBy === 'object' && task.assignedBy ? task.assignedBy.name : task.assignedBy;
          if (!filter.values.includes(assignedByName)) return false;
        }
        if (filter.type === 'assignedTo' && filter.values.length > 0) {
          const assignedToName = typeof task.assignedTo === 'object' && task.assignedTo ? task.assignedTo.name : task.assignedTo;
          if (!filter.values.includes(assignedToName)) return false;
        }
        if (filter.type === 'verificationAssignedTo' && filter.values.length > 0) {
          const verifierName = typeof task.verificationAssignedTo === 'object' && task.verificationAssignedTo ? task.verificationAssignedTo.name : task.verificationAssignedTo;
          if (!filter.values.includes(verifierName)) return false;
        }
        if (filter.type === 'dateRange' && filter.startDate && filter.endDate) {
          const taskDate = new Date(task.inwardEntryDate);
          const startDate = new Date(filter.startDate);
          const endDate = new Date(filter.endDate);
          if (taskDate < startDate || taskDate > endDate) return false;
        }
        if (filter.type === 'dueDateRange' && filter.startDate && filter.endDate) {
          const taskDate = new Date(task.dueDate);
          const startDate = new Date(filter.startDate);
          const endDate = new Date(filter.endDate);
          if (taskDate < startDate || taskDate > endDate) return false;
        }
      }
      
      if (activeTabObj.searchTerm && activeTabObj.searchTerm.trim() !== '') {
        const searchTerm = activeTabObj.searchTerm.toLowerCase().trim();
        const searchableFields = [
          task.title,
          task.description,
          task.clientName,
          task.clientGroup,
          Array.isArray(task.workType) ? task.workType.join(' ') : task.workType,
          task.priority,
          typeof task.assignedBy === 'object' && task.assignedBy ? task.assignedBy.name : task.assignedBy,
          typeof task.assignedTo === 'object' && task.assignedTo ? task.assignedTo.name : task.assignedTo,
          typeof task.verificationAssignedTo === 'object' && task.verificationAssignedTo ? task.verificationAssignedTo.name : task.verificationAssignedTo
        ];
        
        const matchesSearch = searchableFields.some(field => {
          if (field && typeof field === 'string') {
            return field.toLowerCase().includes(searchTerm);
          }
          return false;
        });
        
        if (!matchesSearch) return false;
      }
      
      if (activeTabObj.statusFilter && activeTabObj.statusFilter !== 'all') {
        if (activeTabObj.statusFilter !== task.description) return false;
      }
      
      return true;
    });

    const sortBy = activeTabObj.sortBy || 'createdAt';
    const sortOrder = activeTabObj.sortOrder || 'desc';
    
    return filteredTasks.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];
      
      if (sortBy === 'assignedBy' || sortBy === 'assignedTo' || sortBy === 'verificationAssignedTo') {
        aVal = typeof aVal === 'object' && aVal ? aVal.name : aVal;
        bVal = typeof bVal === 'object' && bVal ? bVal.name : bVal;
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const reorderTasks = async (newTaskOrder) => {
    try {
      const reorderedTasks = newTaskOrder.map((taskId, index) => {
        const task = tasks.find(t => t._id === taskId);
        return task ? { ...task, orderIndex: index } : null;
      }).filter(Boolean);
      
      if (reorderedTasks.length > 0) {
        const updatedTasks = [...tasks];
        reorderedTasks.forEach(reorderedTask => {
          const index = updatedTasks.findIndex(t => t._id === reorderedTask._id);
          if (index !== -1) {
            updatedTasks[index] = reorderedTask;
          }
        });
        
        setTasks(updatedTasks);
        setRowOrder(newTaskOrder);
        return updatedTasks;
      }
    } catch (error) {
      console.error('Error reordering tasks:', error);
      toast.error('Failed to reorder tasks');
      const revertedTasks = [...tasks];
      setTasks(revertedTasks);
      setRowOrder([]);
      return revertedTasks;
    }
  };

  const refetchTasks = async () => {
    if (!user?.token) return;
    try {
      await fetchTasksAndTabState();
    } catch (error) {
      console.error('Error refetching tasks:', error);
    }
  };

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
        taskCounts={taskCounts}
        customColumns={extendedColumns}
        visibleColumns={activeTabObj.visibleColumns}
        setVisibleColumns={(columns) => updateActiveTab({ visibleColumns: columns })}
        columnWidths={activeTabObj.columnWidths}
        setColumnWidths={(widths) => updateActiveTab({ columnWidths: widths })}
        columnOrder={activeTabObj.columnOrder}
        setColumnOrder={(order) => updateActiveTab({ columnOrder: order })}
        activeTab={activeTabObj.activeTab}
        onActiveTabChange={(tab) => updateActiveTab({ activeTab: tab })}
        searchTerm={activeTabObj.searchTerm}
        setSearchTerm={(searchTerm) => updateActiveTab({ searchTerm })}
        statusFilter={activeTabObj.statusFilter}
        setStatusFilter={(statusFilter) => updateActiveTab({ statusFilter })}
        sortBy={activeTabObj.sortBy}
        setSortBy={(sortBy) => updateActiveTab({ sortBy })}
        sortOrder={activeTabObj.sortOrder}
        setSortOrder={(sortOrder) => updateActiveTab({ sortOrder })}
        filters={activeTabObj.filters}
        setFilters={(filters) => updateActiveTab({ filters })}
        clientNames={clientNames}
        clientGroups={clientGroups}
        workTypes={workTypes}
        priorities={priorities}
      />
      
      <div className="mt-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="relative" ref={filterPopupRef}>
            <button
              onClick={() => setIsFilterPopupOpen(!isFilterPopupOpen)}
              className="flex items-center space-x-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <AdjustmentsHorizontalIcon className="h-4 w-4" />
              <span>Filter</span>
              {activeTabObj.filters && activeTabObj.filters.length > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                  {activeTabObj.filters.length}
                </span>
              )}
            </button>
            {isFilterPopupOpen && (
              <FilterPopup
                isOpen={isFilterPopupOpen}
                onClose={() => setIsFilterPopupOpen(false)}
                filters={activeTabObj.filters || []}
                onFiltersChange={(filters) => updateActiveTab({ filters })}
                clientNames={clientNames}
                clientGroups={clientGroups}
                workTypes={workTypes}
                priorities={priorities}
                users={users}
              />
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
          onTaskUpdate={async (taskId, updater) => {
            setTasks(prevTasks => prevTasks.map(task =>
              task._id === taskId ? updater(task) : task
            ));
            
            try {
              await new Promise(resolve => setTimeout(resolve, 100));
              const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
                headers: { Authorization: `Bearer ${user.token}` }
              });
              if (res.ok) {
                const updatedTask = await res.json();
                setTasks(prevTasks => prevTasks.map(task =>
                  task._id === taskId ? updatedTask : task
                ));
              }
            } catch (error) {
              console.error('Error fetching updated task:', error);
            }
          }}
          onTaskDelete={(taskId) => {
            setTasks(prevTasks => prevTasks.filter(task => task._id !== taskId));
            toast.success('Task deleted successfully');
          }}
          onStatusChange={(taskId, newStatus) => {
            setTasks(prevTasks => 
              prevTasks.map(task => 
                task._id === taskId ? { ...task, description: newStatus } : task
              )
            );
          }}
          onVerificationStatusChange={(taskId, newVerificationStatus) => {
            setTasks(prevTasks => 
              prevTasks.map(task => 
                task._id === taskId ? { ...task, verification: newVerificationStatus } : task
              )
            );
          }}
          shouldDisableActions={false}
          shouldDisableFileActions={false}
          taskHours={taskHours}
          visibleColumns={activeTabObj.visibleColumns}
          setVisibleColumns={(columns) => updateActiveTab({ visibleColumns: columns })}
          columnWidths={activeTabObj.columnWidths}
          setColumnWidths={(widths) => updateActiveTab({ columnWidths: widths })}
          columnOrder={activeTabObj.columnOrder}
          setColumnOrder={(order) => updateActiveTab({ columnOrder: order })}
          storageKeyPrefix={`receivedTasks-${activeTabId}`}
          refetchTasks={refetchTasks}
          sortBy={activeTabObj.sortBy}
          tabKey="receivedTasks"
          tabId={activeTabId}
          allColumns={extendedColumns}
          onRowOrderChange={reorderTasks}
        />
      </ErrorBoundary>
      
      {showCreateTaskModal && (
        <CreateTask
          onClose={() => setShowCreateTaskModal(false)}
          onTaskCreated={refetchTasks}
          users={users}
        />
      )}
    </div>
  );
};

export default ReceivedTasks;
