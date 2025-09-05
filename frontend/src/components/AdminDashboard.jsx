import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import AutomationTask from './AutomationTask';
import AutomationPopup from './AutomationPopup';
import AutomationsModal from './AutomationsModal';
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
  PlusIcon,
} from '@heroicons/react/24/outline';
import FileUpload from './FileUpload';
import FileList from './FileList';
import TaskComments from './TaskComments';
import defaultProfile from '../assets/avatar.jpg';
import FilterPopup from './FilterPopup';
import EnhancedPDFColumnSelector from './EnhancedPDFColumnSelector';
import ITRColumnSelector from './ITRColumnSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { API_BASE_URL, fetchTabState, saveTabState } from '../apiConfig';
import AdvancedTaskTable from './AdvancedTaskTable';
import CreateTask from './CreateTask';
import TabBar from './TabBar';

function formatDate(date) {
  if (!date) return 'NA';
  const d = new Date(date);
  return isNaN(d) ? 'NA' : d.toLocaleDateString();
}

function formatDateTime(date) {
  if (!date) return 'NA';
  const d = new Date(date);
  if (isNaN(d)) return 'NA';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

const ALL_COLUMNS = [
  { id: 'title', label: 'Title', defaultWidth: 256 },
  { id: 'description', label: 'Status', defaultWidth: 180 },
  { id: 'clientName', label: 'Client Name', defaultWidth: 150 },
  { id: 'clientGroup', label: 'Client Group', defaultWidth: 150 },
  { id: 'workType', label: 'Work Type', defaultWidth: 150 },
  { id: 'billed', label: 'Internal Works', defaultWidth: 80 },
  { id: 'status', label: 'Stages', defaultWidth: 120 },
  { id: 'priority', label: 'Priority', defaultWidth: 120 },
  { id: 'selfVerification', label: 'Self Verification', defaultWidth: 120 },
  { id: 'inwardEntryDate', label: 'Inward Entry Date', defaultWidth: 150 },
  { id: 'dueDate', label: 'Due Date', defaultWidth: 120 },
  { id: 'targetDate', label: 'Target Date', defaultWidth: 120 },
  { id: 'assignedBy', label: 'Assigned By', defaultWidth: 150 },
  { id: 'assignedTo', label: 'Assigned To', defaultWidth: 150 },
  { id: 'verificationAssignedTo', label: 'First Verifier', defaultWidth: 150 },
  { id: 'secondVerificationAssignedTo', label: 'Second Verifier', defaultWidth: 150 },
  { id: 'thirdVerificationAssignedTo', label: 'Third Verifier', defaultWidth: 150 },
  { id: 'fourthVerificationAssignedTo', label: 'Fourth Verifier', defaultWidth: 150 },
  { id: 'fifthVerificationAssignedTo', label: 'Fifth Verifier', defaultWidth: 150 },
  { id: 'guides', label: 'Guide', defaultWidth: 150 },
  { id: 'files', label: 'Files', defaultWidth: 120 },
  { id: 'comments', label: 'Comments', defaultWidth: 120 },
];

// 1. Add columnOrder to DEFAULT_TAB
const DEFAULT_TAB = (customColumns = []) => {
  const baseColumns = ALL_COLUMNS.map(col => col.id);
  const customCols = customColumns.map(col => `custom_${col.name}`);
  const allColumns = [...baseColumns, ...customCols];
  
  return {
    id: String(Date.now()),
    title: 'Tab 1',
    filters: [],
    sortBy: 'createdAt',
    sortOrder: 'desc',
    searchTerm: '',
    visibleColumns: allColumns,
    columnWidths: Object.fromEntries([
      ...ALL_COLUMNS.map(col => [col.id, col.defaultWidth]),
      ...customColumns.map(col => [`custom_${col.name}`, 150])
    ]),
    columnOrder: allColumns,
  };
};

const AdminDashboard = () => {
  const { user } = useAuth();
  // Helper to get saved columns for the user
  // 2. Remove getSavedVisibleColumns and all per-user localStorage for columns/widths
  // 3. Update tabs state to include columnWidths per tab
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Custom columns state
  const [customColumns, setCustomColumns] = useState([]);
  const [customColumnsLoaded, setCustomColumnsLoaded] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const filterPopupRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [clientNames, setClientNames] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [taskHours, setTaskHours] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnsDropdownRef = useRef(null);
  const groupByDropdownRef = useRef(null);
  const tableRef = useRef(null);
  const [showPDFColumnSelector, setShowPDFColumnSelector] = useState(false);
  const [showITRColumnSelector, setShowITRColumnSelector] = useState(false);
  const [editingDescriptionTaskId, setEditingDescriptionTaskId] = useState(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [showAutomationsModal, setShowAutomationsModal] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [automationTasks, setAutomationTasks] = useState([]);
  const [showAddAutomationTask, setShowAddAutomationTask] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  // Template editing state
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editTemplateModalOpen, setEditTemplateModalOpen] = useState(false);
  const [editingTemplateIndex, setEditingTemplateIndex] = useState(null);
  // Bulk selection state
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [isAllSelected, setIsAllSelected] = useState(false);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  // Handler for Automation submit
  const handleAutomationSubmit = (data) => {
    setAutomationModalOpen(false);
  };

  // Fetch tasks for selected automation
  useEffect(() => {
    if (!selectedAutomation || !user?.token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/automations/${selectedAutomation._id}/tasks`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await res.json();
        setAutomationTasks(Array.isArray(data) ? data : []);
      } catch {
        setAutomationTasks([]);
      }
    })();
  }, [selectedAutomation, user, API_BASE_URL]);
  // 8. Remove columnWidths, columnOrder, setColumnWidths, setColumnOrder from top-level state (move to per-tab)
  // const [columnWidths, setColumnWidths] = useState({});
  // const [columnOrder, setColumnOrder] = useState(() => ALL_COLUMNS.map(col => col.id));
  // Add local state for filter popup
  const [filterDraft, setFilterDraft] = useState([]);
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);

  // Get active tab object - memoized
  const activeTabObj = useMemo(() => {
    return tabs.find(tab => tab.id === activeTabId) || tabs[0] || DEFAULT_TAB(customColumnsLoaded ? customColumns : []);
  }, [tabs, activeTabId, customColumnsLoaded, customColumns]);

  // Get extended columns including custom columns - memoized
  const extendedColumns = useMemo(() => {
    const baseColumns = [...ALL_COLUMNS];
    
    if (!customColumnsLoaded || customColumns.length === 0) {
      return baseColumns;
    }

    // Add custom columns after the base columns
    const customCols = customColumns.map(col => ({
      id: `custom_${col.name}`,
      label: col.label,
      defaultWidth: 150,
      isCustom: true,
      customColumn: col
    }));

    return [...baseColumns, ...customCols];
  }, [customColumnsLoaded, customColumns]);

  // 6. Update updateActiveTab to allow patching visibleColumns and columnWidths
  const updateActiveTab = useCallback((patch) => {
    setTabs(tabs.map(tab => {
      if (tab.id !== activeTabId) return tab;
      let newTab = { ...tab, ...patch };
      // If grouping by 'priority', always reset groupOrder to database order
      if (patch.groupBy === 'priority') {
        // Build group order using database priorities
        let groupOrder = priorities
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(p => p.name);
        newTab.groupOrder = groupOrder;
      }
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
  }, [tabs, activeTabId, priorities]);

  // When opening the filter popup, copy the current tab's filters to the draft
  const openFilterPopup = useCallback(() => {
    setFilterDraft([...activeTabObj.filters]);
    setIsFilterPopupOpen(true);
  }, [activeTabObj.filters]);

  // When saving filters, update the tab's filters and close the popup
  const saveFilters = useCallback(() => {
    updateActiveTab({ filters: filterDraft });
    setIsFilterPopupOpen(false);
  }, [filterDraft, updateActiveTab]);

  // Tab actions
  const addTab = async () => {
    const newId = String(Date.now());
    const newTabs = [...tabs, { ...DEFAULT_TAB(customColumns), id: newId, title: `Tab ${tabs.length + 1}` }];
    setTabs(newTabs);
    setActiveTabId(newId);

    // Sync with backend
    try {
      await fetch(`${API_BASE_URL}/api/users/user-tab-state/adminDashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ state: { tabs: newTabs, activeTabId: newId } }),
      });
    } catch (err) {
      // Optionally handle error
    }
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

  const reorderTabs = (newTabsOrder) => {
    setTabs(newTabsOrder);
  };

  // Fetch tabs and activeTabId from backend on mount
  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    (async () => {
      try {
        const tabStates = await fetchTabState('adminDashboard', user.token);
        if (isMounted && tabStates && Array.isArray(tabStates.tabs) && tabStates.tabs.length > 0) {
          setTabs(tabStates.tabs);
          setActiveTabId(tabStates.activeTabId);
        } else if (isMounted) {
          const def = { ...DEFAULT_TAB(customColumns) };
          setTabs([def]);
          setActiveTabId(def.id);
        }
      } catch {
        if (isMounted) {
          const def = { ...DEFAULT_TAB(customColumns) };
          setTabs([def]);
          setActiveTabId(def.id);
        }
      } finally {
        if (isMounted) setTabsLoaded(true);
      }
    })();
    return () => { isMounted = false; };
  }, [user]);

  // Fetch custom columns
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

  // Save tabs and activeTabId to backend whenever they change (after load)
  useEffect(() => {
    if (!user?.token || !tabsLoaded) return;
    saveTabState('adminDashboard', { tabs, activeTabId }, user.token).catch(() => {});
  }, [tabs, activeTabId, user, tabsLoaded]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      // Handle filter popup
      if (filterPopupRef.current && !filterPopupRef.current.contains(event.target)) {
        setIsFilterPopupOpen(false);
      }
      
      // Handle columns dropdown
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
      
      // Handle group by dropdown
      if (groupByDropdownRef.current && !groupByDropdownRef.current.contains(event.target)) {
        setShowGroupByDropdown(false);
      }
    };

    const handleKeyDown = (event) => {
      // Close dropdowns on ESC key
      if (event.key === 'Escape') {
        setIsFilterPopupOpen(false);
        setShowColumnDropdown(false);
        setShowGroupByDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
      fetchData('priorities', setPriorities);
    }
  }, [user]);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let endpoint = '';
      if (user.role === 'Admin' || user.role === 'Senior' || user.role === 'Team Head') {
        endpoint = 'tasks/all';
      } else {
        endpoint = 'tasks';
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
  }, [user.role, user.token]);

  useEffect(() => {
    if (tabsLoaded && activeTabId) {
      fetchTasks();
    }
  }, [tabsLoaded, fetchTasks]);

  // Clear selections when tasks or filters change
  useEffect(() => {
    setSelectedTasks([]);
    setIsAllSelected(false);
    setShowBulkActions(false);
  }, [tasks.length]);

  // Separate useEffect for filter and search changes to prevent infinite loops
  useEffect(() => {
    if (tabsLoaded) {
      setSelectedTasks([]);
      setIsAllSelected(false);
      setShowBulkActions(false);
    }
  }, [tabsLoaded, activeTabId]);

  // Optimized column visibility toggle
  const toggleColumnVisibility = useCallback((columnId) => {
    const cols = activeTabObj.visibleColumns || [];
    let newCols;
    if (cols.includes(columnId)) {
      newCols = cols.filter(c => c !== columnId);
    } else {
      newCols = [...cols, columnId];
    }
    updateActiveTab({ visibleColumns: [...newCols] });
  }, [activeTabObj.visibleColumns, updateActiveTab]);

  // Toggle bulk selection mode
  const toggleBulkSelection = useCallback(() => {
    const newShowCheckboxes = !showCheckboxes;
    setShowCheckboxes(newShowCheckboxes);
    
    // Clear selections when hiding checkboxes
    if (!newShowCheckboxes) {
      setSelectedTasks([]);
      setIsAllSelected(false);
      setShowBulkActions(false);
    }
  }, [showCheckboxes]);

  // Clear selections when showCheckboxes changes to false
  useEffect(() => {
    if (!showCheckboxes) {
      setSelectedTasks([]);
      setIsAllSelected(false);
      setShowBulkActions(false);
    }
  }, [showCheckboxes]);

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

  const getFilteredAndSortedTasks = useCallback((tasks, filtersToUse) => {
    if (!Array.isArray(tasks)) return [];
    const filters = filtersToUse || activeTabObj.filters;

    // Priority order mapping for sorting - use database order
    const priorityOrder = {};
    priorities.forEach((priority, index) => {
      priorityOrder[priority.name] = priority.order || (index + 1);
    });

    let filteredTasks = tasks.filter(task => {
      // Exclude tasks with verificationStatus 'pending'
      if (task.verificationStatus === 'pending') return false;
      // Apply search filter
      if (activeTabObj.searchTerm) {
        const lowercasedTerm = activeTabObj.searchTerm.toLowerCase();
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
        const { column, operator, value, logic } = filter;
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
        if (operator === 'any_of' && Array.isArray(value)) {
          filterResult = value.includes(String(taskValue)) || value.includes(taskValue?._id);
        } else if (taskValue === undefined || taskValue === null) {
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
          const logicType = logic || 'AND';
          if (logicType === 'AND') {
            result = result && filterResult;
          } else if (logicType === 'ANY_OF') {
            result = result || filterResult;
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
  }, [priorities, activeTabObj.filters, activeTabObj.searchTerm, activeTabObj.sortBy, activeTabObj.sortOrder]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'yet_to_start':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    // Find the priority in the priorities list to get its color
    if (priorities.length > 0) {
      const foundPriority = priorities.find(p => p.name === priority);
      if (foundPriority && foundPriority.color) {
        return foundPriority.color;
      }
    }
    
    // Fallback to default colors if priority not found
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'today':
        return 'bg-orange-100 text-orange-800 border border-orange-200';
      case 'lessThan3Days':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'thisWeek':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'thisMonth':
        return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case 'regular':
        return 'bg-gray-100 text-gray-800 border border-gray-200';
      case 'filed':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'dailyWorksOffice':
        return 'bg-teal-100 text-teal-800 border border-teal-200';
      case 'monthlyWorks':
        return 'bg-slate-100 text-slate-600 border border-slate-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  // Calculate statistics - memoized for performance
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      totalTasks: tasks.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      yetToStartTasks: tasks.filter(t => t.status === 'yet_to_start').length,
      todayTasks: tasks.filter(t => new Date(t.dueDate).toDateString() === today).length,
    };
  }, [tasks]);

  const handleStatusClick = (taskId, status) => {
    // Implement the logic to handle status click
    console.log(`Status clicked for task ${taskId}, new status: ${status}`);
  };

  const handleEditTask = useCallback((task) => {
    setEditTask(task);
    setEditModalOpen(true);
  }, []);

  const handleTaskSubmit = useCallback(async (updatedOrCreated) => {
    setEditModalOpen(false);
    setCreateModalOpen(false);
    const isUpdate = editTask !== null;
    setEditTask(null);
    
    if (isUpdate) {
      // For updates, use optimistic update instead of full refetch
      setTasks(prevTasks => prevTasks.map(task => 
        task._id === updatedOrCreated._id ? updatedOrCreated : task
      ));
      
      // Optionally refetch just this task to ensure consistency
      try {
        await new Promise(resolve => setTimeout(resolve, 100));
        const res = await fetch(`${API_BASE_URL}/api/tasks/${updatedOrCreated._id}`, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        if (res.ok) {
          const refreshedTask = await res.json();
          setTasks(prevTasks => prevTasks.map(task =>
            task._id === updatedOrCreated._id ? refreshedTask : task
          ));
        }
      } catch (e) {
        console.error('Error refreshing updated task:', e);
      }
    } else {
      // For new tasks, just add to the beginning of the list
      setTasks(prevTasks => [updatedOrCreated, ...prevTasks]);
    }
  }, [editTask, user.token]);

  // Handler for editing task templates
  const handleEditTemplate = useCallback((template, index) => {
    setEditingTemplate(template);
    setEditingTemplateIndex(index);
    setEditTemplateModalOpen(true);
  }, []);

  // Handler for template submit (when editing)
  const handleTemplateSubmit = async (updatedTemplate) => {
    try {
      if (editingTemplateIndex === null || !selectedAutomation) return;

      // Create a new array with the updated template
      const updatedTemplates = [...selectedAutomation.taskTemplate];
      updatedTemplates[editingTemplateIndex] = { 
        ...updatedTemplate, 
        _id: editingTemplate._id // Preserve the original _id
      };

      // Update the automation with the new templates array
      const response = await fetch(`${API_BASE_URL}/api/automations/${selectedAutomation._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ taskTemplate: updatedTemplates }),
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      // Update local state
      const updatedAutomation = await response.json();
      setSelectedAutomation(updatedAutomation);
      setEditTemplateModalOpen(false);
      setEditingTemplate(null);
      setEditingTemplateIndex(null);
      toast.success('Task template updated successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to update template');
      console.error('Error updating template:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete task');
      }
      // setTasks(tasks.filter(task => task._id !== taskId));
      fetchTasks(); // Light reload after delete
      toast.success('Task deleted successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to delete task');
    }
  };

  // Bulk selection handlers
  const handleTaskSelect = useCallback((taskId, isSelected) => {
    setSelectedTasks(prev => {
      const newSelected = isSelected 
        ? [...prev, taskId] 
        : prev.filter(id => id !== taskId);
      
      // Update show bulk actions based on selection and checkbox visibility
      setShowBulkActions(newSelected.length > 0 && showCheckboxes);
      
      // Update select all state
      const currentTasks = getFilteredAndSortedTasks(tasks, activeTabObj.filters);
      setIsAllSelected(newSelected.length === currentTasks.length && currentTasks.length > 0);
      
      return newSelected;
    });
  }, [showCheckboxes, tasks, activeTabObj.filters]);

  const handleSelectAll = useCallback((isSelected) => {
    const currentTasks = getFilteredAndSortedTasks(tasks, activeTabObj.filters);
    if (isSelected) {
      setSelectedTasks(currentTasks.map(task => task._id));
      setShowBulkActions(currentTasks.length > 0 && showCheckboxes);
    } else {
      setSelectedTasks([]);
      setShowBulkActions(false);
    }
    setIsAllSelected(isSelected);
  }, [tasks, activeTabObj.filters, showCheckboxes]);

  const handleBulkDelete = async () => {
    if (selectedTasks.length === 0) return;

    try {
      const deletePromises = selectedTasks.map(taskId =>
        fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${user.token}` },
        })
      );

      const responses = await Promise.all(deletePromises);
      const failedDeletes = responses.filter(response => !response.ok);

      if (failedDeletes.length > 0) {
        toast.error(`Failed to delete ${failedDeletes.length} task${failedDeletes.length > 1 ? 's' : ''}`);
      } else {
        toast.success(`Successfully deleted ${selectedTasks.length} task${selectedTasks.length > 1 ? 's' : ''}`);
      }

      // Clear selection and reload tasks
      setSelectedTasks([]);
      setIsAllSelected(false);
      setShowBulkActions(false);
      setShowDeleteConfirmation(false);
      fetchTasks();
    } catch (error) {
      toast.error('Failed to delete selected tasks');
      console.error('Bulk delete error:', error);
    }
  };

  const handleFileUploaded = (files) => {
    // Update the task in the list with new files
    setTasks(prevTasks => 
      prevTasks.map(t => 
        t._id === selectedTask._id 
          ? { ...t, files: [
              ...(t.files || []),
              ...files.filter(uf => !(t.files || []).some(f => f._id === uf._id))
            ] }
          : t
      )
    );
    setSelectedTask(prev =>
      prev && prev._id === selectedTask._id
        ? { ...prev, files: [
            ...(prev.files || []),
            ...files.filter(uf => !(prev.files || []).some(f => f._id === uf._id))
          ] }
        : prev
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

  const filteredAndSortedTasks = getFilteredAndSortedTasks(tasks);

  // PDF export handler
  const handleDownloadPDF = (selectedColumns, fontSize = 10, fontFamily = 'tahoma') => {
    const filteredTasks = getFilteredAndSortedTasks(tasks);
    // Get the selected column definitions (including custom columns)
    const allAvailableColumns = [
      ...ALL_COLUMNS.map(col => {
        // Adjust widths for PDF export
        if (col.id === 'title') return { ...col, defaultWidth: 200 };
        if (col.id === 'description' || col.id === 'status') return { ...col, defaultWidth: 140 };
        return col;
      }),
      ...customColumns.map(col => ({
        id: `custom_${col.name}`,
        label: col.label,
        defaultWidth: 150,
        isCustom: true,
        customColumn: col
      }))
    ];
  // Ensure columns are in the order selected by the user
  const selectedColumnDefs = selectedColumns.map(colId => allAvailableColumns.find(col => col.id === colId)).filter(Boolean);
    // Add No column at the start
    const headers = ['No', ...selectedColumnDefs.map(col => col.label)];
  // Use normal portrait A4, but keep reduced margins for wider table
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    // Set font family if available in jsPDF
    try {
      doc.setFont(fontFamily);
    } catch (e) {
      doc.setFont('helvetica'); // fallback
    }
    const tableData = [];
    const groupBy = activeTabObj.sortBy;
    if (groupBy && groupBy !== '') {
      const groupedTasks = {};
      filteredTasks.forEach(task => {
        let groupKey;
        switch (groupBy) {
          case 'clientName':
            groupKey = task.clientName || 'Unassigned';
            break;
          case 'clientGroup':
            groupKey = task.clientGroup || 'Unassigned';
            break;
          case 'workType':
            groupKey = Array.isArray(task.workType) ? (task.workType[0] || 'Unspecified') : (task.workType || 'Unspecified');
            break;
          case 'billed':
            groupKey = task.billed ? 'Yes' : 'No';
            break;
          default:
            groupKey = task[groupBy] || 'Unassigned';
        }
        if (!groupedTasks[groupKey]) groupedTasks[groupKey] = [];
        groupedTasks[groupKey].push(task);
      });
      Object.entries(groupedTasks).forEach(([groupKey, groupTasks], groupIndex) => {
        if (groupIndex > 0) tableData.push(Array(headers.length).fill(''));
        tableData.push([{
          content: `${groupBy.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${groupKey}`,
          colSpan: headers.length,
          styles: { fillColor: [220, 220, 220], fontStyle: 'bold', halign: 'left' }
        }]);
        groupTasks.forEach((task, idx) => {
          const row = [idx + 1];
          selectedColumnDefs.forEach(col => {
            let value = '';
            if (col.isCustom && col.id.startsWith('custom_')) {
              // Custom column value
              const customColumnName = col.id.replace('custom_', '');
              const customValue = task.customFields?.[customColumnName];
              if (col.customColumn?.type === 'checkbox') {
                value = customValue ? 'Yes' : 'No';
              } else if (col.customColumn?.type === 'tags') {
                value = Array.isArray(customValue) ? customValue.join(', ') : (customValue || '');
              } else {
                value = customValue ?? '';
              }
            } else {
              switch (col.id) {
                case 'title': value = task.title || ''; break;
                case 'description': value = task.description || ''; break;
                case 'clientName': value = task.clientName || ''; break;
                case 'clientGroup': value = task.clientGroup || ''; break;
                case 'workType': value = Array.isArray(task.workType) ? task.workType.join(', ') : (task.workType || ''); break;
                case 'billed': value = task.billed ? 'Yes' : 'No'; break;
                case 'status': value = task.status || ''; break;
                case 'priority': value = task.priority || ''; break;
                case 'selfVerification': value = task.selfVerification ? '✓' : '✗'; break;
                case 'inwardEntryDate': value = task.inwardEntryDate ? formatDateTime(task.inwardEntryDate) : ''; break;
                case 'dueDate': value = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : ''; break;
                case 'targetDate': value = task.targetDate ? new Date(task.targetDate).toLocaleDateString() : ''; break;
                case 'assignedBy': value = task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : ''; break;
                case 'assignedTo': value = Array.isArray(task.assignedTo) ? task.assignedTo.map(u => `${u.firstName} ${u.lastName}`).join(', ') : (task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : ''); break;
                case 'verificationAssignedTo': value = task.verificationAssignedTo ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}` : ''; break;
                case 'secondVerificationAssignedTo': value = task.secondVerificationAssignedTo ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}` : ''; break;
                case 'guides': value = task.guides ? task.guides.map(g => g.name).join(', ') : ''; break;
                case 'files': value = task.files && task.files.length > 0 ? task.files.map(f => f.originalName || f.originalname).join(', ') : ''; break;
                case 'comments': value = task.comments ? task.comments.length.toString() : '0'; break;
                default: value = '';
              }
            }
            row.push(value);
          });
          tableData.push(row);
        });
      });
    } else {
      filteredTasks.forEach((task, idx) => {
        const row = [idx + 1];
        selectedColumnDefs.forEach(col => {
          let value = '';
          switch (col.id) {
            case 'title': value = task.title || ''; break;
            case 'description': value = task.description || ''; break;
            case 'clientName': value = task.clientName || ''; break;
            case 'clientGroup': value = task.clientGroup || ''; break;
            case 'workType': value = Array.isArray(task.workType) ? task.workType.join(', ') : (task.workType || ''); break;
            case 'billed': value = task.billed ? 'Yes' : 'No'; break;
            case '': value = task.status || ''; break;
            case 'priority': value = task.priority || ''; break;
            case 'selfVerification': value = task.selfVerification ? '✓' : '✗'; break;
            case 'inwardEntryDate': value = task.inwardEntryDate ? formatDateTime(task.inwardEntryDate) : ''; break;
            case 'dueDate': value = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : ''; break;
            case 'targetDate': value = task.targetDate ? new Date(task.targetDate).toLocaleDateString() : ''; break;
            case 'assignedBy': value = task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : ''; break;
            case 'assignedTo': value = Array.isArray(task.assignedTo) ? task.assignedTo.map(u => `${u.firstName} ${u.lastName}`).join(', ') : (task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : ''); break;
            case 'verificationAssignedTo': value = task.verificationAssignedTo ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}` : ''; break;
            case 'secondVerificationAssignedTo': value = task.secondVerificationAssignedTo ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}` : ''; break;
            case 'guides': value = task.guides ? task.guides.map(g => g.name).join(', ') : ''; break;
            case 'files': value = task.files && task.files.length > 0 ? task.files.map(f => f.originalName || f.originalname).join(', ') : ''; break;
            case 'comments': value = task.comments ? task.comments.length.toString() : '0'; break;
            default: value = '';
          }
          row.push(value);
        });
        tableData.push(row);
      });
    }
    // Calculate available width for table
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginLeft = 24;
    const marginRight = 24;
    const availableWidth = pageWidth - marginLeft - marginRight;
    // Calculate widths for columns
    const noColWidth = 40;
    let colWidths = selectedColumnDefs.map(col => col.defaultWidth || 120);
    let totalWidth = noColWidth + colWidths.reduce((a, b) => a + b, 0);
    // If only one data column and there is extra space, expand it to fill
    if (colWidths.length === 1 && totalWidth < availableWidth) {
      colWidths[0] = availableWidth - noColWidth;
      totalWidth = noColWidth + colWidths[0];
    }
    // If multiple columns and totalWidth < availableWidth, expand last column
    if (colWidths.length > 1 && totalWidth < availableWidth) {
      colWidths[colWidths.length - 1] += (availableWidth - totalWidth);
      totalWidth = availableWidth;
    }
    doc.autoTable({
      head: [headers],
      body: tableData,
      theme: 'striped',
      margin: { left: marginLeft, right: marginRight, top: 40, bottom: 24 },
      tableWidth: 'auto',
      columnStyles: Object.fromEntries([
        [0, { cellWidth: noColWidth }],
        ...colWidths.map((w, idx) => [idx + 1, { cellWidth: w }])
      ]),
      styles: {
        fontSize: fontSize,
        font: fontFamily,
        cellPadding: 4,
        overflow: 'linebreak',
      },
      headStyles: {
        fontSize: fontSize + 1,
        font: fontFamily,
        fillColor: [33, 111, 182],
        textColor: 255,
      },
      didDrawPage: function (data) {
        doc.setFontSize(8);
        doc.text(
          `Page ${doc.internal.getNumberOfPages()}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
      },
    });
    doc.save(`tasks_${activeTabObj?.activeTab || 'dashboard'}.pdf`);
  };

  // Excel export handler
  const handleDownloadExcel = (selectedColumns, fontSize = 10, fontFamily = 'tahoma') => {
    try {
      const filteredTasks = getFilteredAndSortedTasks(tasks, activeTabObj.filters);
      
      // Prepare Excel data with selected columns
      const excelData = filteredTasks.map(task => {
        const row = {};
        
        selectedColumns.forEach(column => {
          if (column.isCustom) {
            const customValue = task.customFields && task.customFields[column.customColumn.name];
            row[column.label] = customValue !== undefined ? customValue : '';
          } else {
            switch (column.id) {
              case 'title':
                row[column.label] = task.title || '';
                break;
              case 'description':
                row[column.label] = task.description || '';
                break;
              case 'clientName':
                row[column.label] = task.clientName || '';
                break;
              case 'clientGroup':
                row[column.label] = task.clientGroup || '';
                break;
              case 'workType':
                row[column.label] = Array.isArray(task.workType) ? task.workType.join(', ') : (task.workType || '');
                break;
              case 'billed':
                row[column.label] = task.billed ? 'Yes' : 'No';
                break;
              case 'status':
                row[column.label] = task.status || '';
                break;
              case 'priority':
                row[column.label] = task.priority || '';
                break;
              case 'selfVerification':
                row[column.label] = task.selfVerification ? 'Yes' : 'No';
                break;
              case 'inwardEntryDate':
                row[column.label] = formatDate(task.inwardEntryDate);
                break;
              case 'dueDate':
                row[column.label] = formatDate(task.dueDate);
                break;
              case 'targetDate':
                row[column.label] = formatDate(task.targetDate);
                break;
              case 'assignedBy':
                row[column.label] = task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : '';
                break;
              case 'assignedTo':
                row[column.label] = task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '';
                break;
              case 'verificationAssignedTo':
                row[column.label] = task.verificationAssignedTo ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}` : '';
                break;
              case 'secondVerificationAssignedTo':
                row[column.label] = task.secondVerificationAssignedTo ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}` : '';
                break;
              case 'thirdVerificationAssignedTo':
                row[column.label] = task.thirdVerificationAssignedTo ? `${task.thirdVerificationAssignedTo.firstName} ${task.thirdVerificationAssignedTo.lastName}` : '';
                break;
              case 'fourthVerificationAssignedTo':
                row[column.label] = task.fourthVerificationAssignedTo ? `${task.fourthVerificationAssignedTo.firstName} ${task.fourthVerificationAssignedTo.lastName}` : '';
                break;
              case 'fifthVerificationAssignedTo':
                row[column.label] = task.fifthVerificationAssignedTo ? `${task.fifthVerificationAssignedTo.firstName} ${task.fifthVerificationAssignedTo.lastName}` : '';
                break;
              case 'guides':
                if (task.guides && task.guides.length > 0) {
                  row[column.label] = task.guides.map(guide => `${guide.firstName} ${guide.lastName}`).join(', ');
                } else {
                  row[column.label] = '';
                }
                break;
              case 'files':
                row[column.label] = task.files ? task.files.length : 0;
                break;
              case 'comments':
                row[column.label] = task.comments ? task.comments.length : 0;
                break;
              default:
                row[column.label] = '';
            }
          }
        });
        
        return row;
      });

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = selectedColumns.map(col => ({ wch: Math.max(col.label.length, 15) }));
      ws['!cols'] = colWidths;

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Tasks');

      // Save the file
      XLSX.writeFile(wb, `tasks_${activeTabObj?.activeTab || 'dashboard'}.xlsx`);
      
      toast.success('Excel file downloaded successfully!');
    } catch (error) {
      console.error('Error generating Excel file:', error);
      toast.error('Failed to generate Excel file');
    }
  };

  const handlePDFButtonClick = () => {
    setShowPDFColumnSelector(true);
  };

  // ITR download handlers
  const handleITRDownload = (selectedColumns, format, fontSize = 12, fontFamily = 'helvetica') => {
    if (format === 'pdf') {
      handleITRDownloadPDF(selectedColumns, fontSize, fontFamily);
    } else if (format === 'excel') {
      handleITRDownloadExcel(selectedColumns, fontSize, fontFamily);
    }
  };

  const handleITRDownloadPDF = (selectedColumns, fontSize = 12, fontFamily = 'helvetica') => {
  // Use the same filtered and sorted tasks as the normal download popup (current tab)
  const itrTasks = getFilteredAndSortedTasks(tasks, activeTabObj.filters);

  const itrData = itrTasks.map((task, index) => {
      // Get all team heads and admins for the assignedTo user's team (supports multiple)
      const assignedUser = task.assignedTo;
      let teamHeadNames = '';
      if (assignedUser && assignedUser.team) {
        // Get the team ID - handle both populated object and ObjectId string
        const assignedUserTeamId = typeof assignedUser.team === 'object' 
          ? assignedUser.team._id 
          : assignedUser.team;
        // Find all users who are admins or team heads in the same team
        const teamHeadsOrAdmins = users.filter(user => {
          if (!user.team || (user.role !== 'Team Head' && user.role !== 'Admin')) return false;
          const userTeamId = typeof user.team === 'object' 
            ? user.team._id 
            : user.team;
          return userTeamId === assignedUserTeamId;
        });
        teamHeadNames = teamHeadsOrAdmins.map(th => `${th.firstName} ${th.lastName}`).join(', ');
      }
      
      const firstVerifier = task.verificationAssignedTo 
        ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}`
        : '';
      
      const secondVerifier = task.secondVerificationAssignedTo
        ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}`
        : '';

      // For PDF export, use 'T' for true fields instead of '✓'
      return {
        no: index + 1,
        dataReceivedOn: formatDate(task.inwardEntryDate),
        nameOfAssessee: task.clientName,
        teamHead: teamHeadNames,
        allotee: task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '',
        draftFinancialsAndComputationPreparation: task.itrProgress?.draftFinancialsAndComputationPreparation === true ? 'T' : (task.itrProgress?.draftFinancialsAndComputationPreparation === false ? '' : ''),
        accountantVerification: task.itrProgress?.accountantVerification === true ? 'T' : (task.itrProgress?.accountantVerification === false ? '' : ''),
        vivekSirVerification: task.itrProgress?.vivekSirVerification === true ? 'T' : (task.itrProgress?.vivekSirVerification === false ? '' : ''),
        girijaVerification: task.itrProgress?.girijaVerification === true ? 'T' : (task.itrProgress?.girijaVerification === false ? '' : ''),
        firstVerification: firstVerifier,
        secondVerification: secondVerifier,
        hariSirVerification: task.itrProgress?.hariSirVerification === true ? 'T' : (task.itrProgress?.hariSirVerification === false ? '' : ''),
        issuedForPartnerProprietorVerification: task.itrProgress?.issuedForPartnerProprietorVerification === true ? 'T' : (task.itrProgress?.issuedForPartnerProprietorVerification === false ? '' : ''),
        challanPreparation: task.itrProgress?.challanPreparation === true ? 'T' : (task.itrProgress?.challanPreparation === false ? '' : ''),
        itrFiledOn: task.itrProgress?.itrFiledOn ? formatDate(task.itrProgress.itrFiledOn) : '',
        billPreparation: task.itrProgress?.billPreparation === true ? 'T' : (task.itrProgress?.billPreparation === false ? '' : '')
      };
    });

    // Generate PDF using the exact layout from image 2
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    
    // Set font family if available in jsPDF
    try {
      doc.setFont(fontFamily);
    } catch (e) {
      // Fall back to default font if specified font is not available
      doc.setFont('helvetica');
    }
    
    // Get columns to display
    const columnsToShow = selectedColumns.map(colId => {
      switch(colId) {
        case 'no': return { dataKey: 'no', header: 'No' };
        case 'dataReceivedOn': return { dataKey: 'dataReceivedOn', header: 'Data Received on' };
        case 'nameOfAssessee': return { dataKey: 'nameOfAssessee', header: 'Name of the Assessee' };
        case 'teamHead': return { dataKey: 'teamHead', header: 'Team Head' };
        case 'allotee': return { dataKey: 'allotee', header: 'Allotee' };
        case 'draftFinancialsAndComputationPreparation': return { dataKey: 'draftFinancialsAndComputationPreparation', header: 'Draft Financials and Computation Preparation' };
        case 'accountantVerification': return { dataKey: 'accountantVerification', header: 'Accountant Verification' };
        case 'vivekSirVerification': return { dataKey: 'vivekSirVerification', header: 'Vivek Sir Verification' };
        case 'girijaVerification': return { dataKey: 'girijaVerification', header: 'Girija Mam Verification' };
        case 'firstVerification': return { dataKey: 'firstVerification', header: '1st Verification' };
        case 'secondVerification': return { dataKey: 'secondVerification', header: '2nd Verification' };
        case 'hariSirVerification': return { dataKey: 'hariSirVerification', header: 'Hari sir Verification' };
        case 'issuedForPartnerProprietorVerification': return { dataKey: 'issuedForPartnerProprietorVerification', header: 'Issued for Partner/Proprietor Verification' };
        case 'challanPreparation': return { dataKey: 'challanPreparation', header: 'Challan Preparation' };
        case 'itrFiledOn': return { dataKey: 'itrFiledOn', header: 'ITR Filed on' };
        case 'billPreparation': return { dataKey: 'billPreparation', header: 'Bill preparation' };
        default: return null;
      }
    }).filter(Boolean);

    // Add title
    doc.setFontSize(16);
    doc.text('ITR Progress Report', 40, 40);

    // Create table
    autoTable(doc, {
      columns: columnsToShow,
      body: itrData,
      startY: 70,
      styles: {
        fontSize: fontSize,
        cellPadding: 3,
        valign: 'middle',
        halign: 'center',
        font: fontFamily,
      },
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: [255, 255, 255],
        fontSize: fontSize,
        fontStyle: 'bold',
        font: fontFamily,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { top: 60, left: 40, right: 40, bottom: 60 },
      tableWidth: 'auto',
      columnStyles: {
        0: { cellWidth: 30 }, // No column
      },
    });

    doc.save('ITR_Progress_Report.pdf');
  };

  const handleITRDownloadExcel = (selectedColumns, fontSize = 12, fontFamily = 'helvetica') => {
  // Use the same filtered and sorted tasks as the normal download popup (current tab)
  const itrTasks = getFilteredAndSortedTasks(tasks, activeTabObj.filters);

  const itrData = itrTasks.map((task, index) => {
      // Get team heads and admins for the assignedTo user's team
      const assignedUser = task.assignedTo;
      let teamHeadNames = '';
      if (assignedUser && assignedUser.team) {
        // Get the team ID - handle both populated object and ObjectId string
        const assignedUserTeamId = typeof assignedUser.team === 'object' 
          ? assignedUser.team._id 
          : assignedUser.team;
        // Find all users who are admins or team heads in the same team
        const teamMembers = users.filter(user => {
          if (!user.team || (user.role !== 'Team Head' && user.role !== 'Admin')) return false;
          const userTeamId = typeof user.team === 'object' 
            ? user.team._id 
            : user.team;
          return userTeamId === assignedUserTeamId;
        });
        teamHeadNames = teamMembers.map(th => `${th.firstName} ${th.lastName}`).join(', ');
      }
      const firstVerifier = task.verificationAssignedTo 
        ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}`
        : '';
      const secondVerifier = task.secondVerificationAssignedTo
        ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}`
        : '';
      const row = {};
      selectedColumns.forEach(colId => {
        // Use ✓ for true, ✗ for false, empty for null/undefined in status columns
        const getStatusValue = (value) => {
          if (value === true) return '✓';
          if (value === false) return '';
          return '';
        };
        
        switch(colId) {
          case 'no': row['S. No'] = index + 1; break;
          case 'dataReceivedOn': row['Data Received on'] = formatDate(task.inwardEntryDate); break;
          case 'nameOfAssessee': row['Name of the Assessee'] = task.clientName; break;
          case 'teamHead': row['Team Head'] = teamHeadNames; break;
          case 'allotee': row['Allotee'] = task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : ''; break;
          case 'draftFinancialsAndComputationPreparation': row['Draft Financials and Computation Preparation'] = getStatusValue(task.itrProgress?.draftFinancialsAndComputationPreparation); break;
          case 'accountantVerification': row['Accountant Verification'] = getStatusValue(task.itrProgress?.accountantVerification); break;
          case 'vivekSirVerification': row['Vivek Sir Verification'] = getStatusValue(task.itrProgress?.vivekSirVerification); break;
          case 'girijaVerification': row['Girija Mam Verification'] = getStatusValue(task.itrProgress?.girijaVerification); break;
          case 'firstVerification': row['1st Verification'] = firstVerifier; break;
          case 'secondVerification': row['2nd Verification'] = secondVerifier; break;
          case 'hariSirVerification': row['Hari sir Verification'] = getStatusValue(task.itrProgress?.hariSirVerification); break;
          case 'issuedForPartnerProprietorVerification': row['Issued for Partner/Proprietor Verification'] = getStatusValue(task.itrProgress?.issuedForPartnerProprietorVerification); break;
          case 'challanPreparation': row['Challan Preparation'] = getStatusValue(task.itrProgress?.challanPreparation); break;
          case 'itrFiledOn': row['ITR Filed on'] = task.itrProgress?.itrFiledOn ? formatDate(task.itrProgress.itrFiledOn) : ''; break;
          case 'billPreparation': row['Bill preparation'] = getStatusValue(task.itrProgress?.billPreparation); break;
          default: break;
        }
      });
      return row;
    });

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(itrData, { origin: 'A5' });

  // Set column widths: 'Name of the Assessee' wide, others smaller
  const colNames = Object.keys(itrData[0] || {});
  ws['!cols'] = colNames.map(name => name === 'Name of the Assessee' ? { wch: 35 } : { wch: 15 });
  ws['!rows'] = Array(itrData.length + 6).fill({ hpt: 40 });

  // Add bold, dark title row above the table
  const title = 'STAUTS OF INDIVIDUAL INCOME TAX RETURNS FILING FOR AY 2025-26';
  ws['A3'] = { t: 's', v: title, s: { font: { bold: true, sz: 18, color: { rgb: '000000' } }, alignment: { horizontal: 'center', vertical: 'center' } } };
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({ s: { r: 2, c: 0 }, e: { r: 2, c: colNames.length - 1 } });

  // Style header row (row 5) - bold, dark, thick border
  for (let c = 0; c < colNames.length; c++) {
    const cell = ws[String.fromCharCode(65 + c) + '5'];
    if (cell) {
      cell.s = {
        font: { bold: true, sz: 13, color: { rgb: '000000' } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border: {
          top: { style: 'medium', color: { rgb: '000000' } },
          bottom: { style: 'medium', color: { rgb: '000000' } },
          left: { style: 'medium', color: { rgb: '000000' } },
          right: { style: 'medium', color: { rgb: '000000' } }
        }
      };
    }
  }
  // Style all data cells (rows 6+): thick border, center, bold for ✓/✗
  for (let r = 6; r < itrData.length + 6; r++) {
    for (let c = 0; c < colNames.length; c++) {
      const cellAddr = String.fromCharCode(65 + c) + (r + 1);
      const cell = ws[cellAddr];
      if (cell) {
        if (cell.v === '✓' || cell.v === '✗') {
          cell.s = {
            font: { bold: true, sz: 18, color: { rgb: cell.v === '✓' ? '008000' : 'FF0000' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'medium', color: { rgb: '000000' } },
              right: { style: 'medium', color: { rgb: '000000' } }
            }
          };
        } else {
          cell.s = {
            font: { bold: false, sz: 12, color: { rgb: '000000' } },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
              top: { style: 'medium', color: { rgb: '000000' } },
              bottom: { style: 'medium', color: { rgb: '000000' } },
              left: { style: 'medium', color: { rgb: '000000' } },
              right: { style: 'medium', color: { rgb: '000000' } }
            }
          };
        }
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, 'ITR Progress');
  XLSX.writeFile(wb, 'ITR_Progress_Report.xlsx');
  toast.success('ITR Excel report generated successfully!');
  };

  // 7. Remove useEffects for per-user columnWidths/columnOrder/visibleColumns localStorage
  // 9. When rendering AdvancedTaskTable, pass activeTabObj.visibleColumns, activeTabObj.columnWidths, and handlers to update them
  // 4. Pass columnOrder/setColumnOrder to AdvancedTaskTable
  useEffect(() => {
    const userId = user?._id || 'guest';
    const key = `admindashboard_column_widths_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          // This effect is now redundant as columnWidths are managed per tab
          // setColumnWidths(parsed); 
        }
      } catch (e) {
        // ignore
      }
    }
    // If nothing in localStorage, set defaults
    if (!saved) {
      const defaultWidths = {};
      ALL_COLUMNS.forEach(col => {
        defaultWidths[col.id] = col.defaultWidth;
      });
      // This effect is now redundant as columnWidths are managed per tab
      // setColumnWidths(defaultWidths); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Calculate widget numbers - memoized for performance
  const dashboardCounts = useMemo(() => {
    return {
      yetToStartCount: tasks.filter(t => t.status === 'yet_to_start').length,
      todayCount: tasks.filter(t => t.priority === 'today' && t.status !== 'completed').length,
      totalCount: tasks.filter(t => t.status !== 'completed').length,
      urgentCount: tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed').length,
    };
  }, [tasks]);

  const { yetToStartCount, todayCount, totalCount, urgentCount } = dashboardCounts;

  // Only render table UI after tabsLoaded and tabs.length > 0
  if (!tabsLoaded || tabs.length === 0) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;
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
      {/* Tabs at the very top */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabClick={setActiveTabId}
        onAddTab={addTab}
        onCloseTab={closeTab}
        onRenameTab={renameTab}
        onReorderTabs={reorderTabs}
      />
      {/* Restore original summary cards/widgets here */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <ClockIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Yet To Start</h3>
              <p className="text-xl sm:text-3xl font-bold text-red-600">{yetToStartCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Today's Tasks</h3>
              <p className="text-xl sm:text-3xl font-bold text-yellow-600">{todayCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <ChartBarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-blue-500 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Total Tasks</h3>
              <p className="text-xl sm:text-3xl font-bold text-blue-600">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Urgent Tasks</h3>
              <p className="text-xl sm:text-3xl font-bold text-red-600">{urgentCount}</p>
            </div>
          </div>
        </div>
      </div>
      {/* Table and per-tab filters/grouping below summary cards */}
      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 mb-4 w-full bg-white rounded-lg shadow-sm p-3">
        {/* Mobile layout: group buttons in rows, desktop unchanged */}
        <div className="flex flex-col w-full gap-2 sm:hidden">
          {/* Row 1: Filter + Search */}
          <div className="flex w-full gap-2">
            <div className="relative flex-1" ref={filterPopupRef}>
              <button
                className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm w-full"
                onClick={openFilterPopup}
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
                filters={filterDraft}
                setFilters={filters => {
                  setFilterDraft(filters);
                  if (filters.length < filterDraft.length) {
                    updateActiveTab({ filters });
                  } else if (filters.length > 0 && filters.every(f => f.saved)) {
                    updateActiveTab({ filters });
                  }
                }}
                users={users}
                clientNames={clientNames}
                clientGroups={clientGroups}
                workTypes={workTypes}
                priorities={priorities}
                customColumns={customColumns}
              />
            </div>
            <input
              type="text"
              placeholder="Search tasks..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              value={activeTabObj.searchTerm}
              onChange={e => updateActiveTab({ searchTerm: e.target.value })}
            />
          </div>
          {/* Row 2: Columns + Group By */}
          <div className="flex w-full gap-2">
            <div className="relative flex-1">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 w-full transition-colors"
                onClick={() => setShowColumnDropdown(v => !v)}
                aria-label="Show/Hide Columns"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                Columns
              </button>
              {showColumnDropdown && (
                <div ref={columnsDropdownRef} className="absolute right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 mt-2 w-56">
                  <div className="font-semibold text-gray-700 mb-2 text-sm">Show/Hide Columns</div>
                  <div className="max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                    {extendedColumns.map(col => (
                      <label key={col.id} className="flex items-center space-x-2 mb-1 cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={activeTabObj.visibleColumns.includes(col.id)}
                          onChange={() => toggleColumnVisibility(col.id)}
                          className="accent-blue-500"
                        />
                        <span className="text-gray-800 text-sm">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="relative flex-1 flex items-center">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 w-full transition-colors"
                onClick={() => setShowGroupByDropdown(v => !v)}
                type="button"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>
                <span className="font-semibold">Group By</span>
              </button>
              {showGroupByDropdown && (
                <div ref={groupByDropdownRef} className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-44" style={{minWidth: '160px'}}>
                  <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">Group By</div>
                  <button className={`block w-full text-left px-4 py-2 rounded ${!activeTabObj.sortBy || activeTabObj.sortBy === '' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: '' }); setShowGroupByDropdown(false); }}>None</button>
                  <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'createdAt' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'createdAt' }); setShowGroupByDropdown(false); }}>Assigned On</button>
                  <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'priority' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'priority' }); setShowGroupByDropdown(false); }}>Priority</button>
                  <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'status' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'status' }); setShowGroupByDropdown(false); }}>Stages</button>
                  <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'clientName' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'clientName' }); setShowGroupByDropdown(false); }}>Client Name</button>
                  <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'clientGroup' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'clientGroup' }); setShowGroupByDropdown(false); }}>Client Group</button>
                  <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'workType' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'workType' }); setShowGroupByDropdown(false); }}>Work Type</button>
                  <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'billed' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'billed' }); setShowGroupByDropdown(false); }}>Internal Works</button>
                </div>
              )}
            </div>
          </div>
          {/* Row 3: Download + Select */}
          <div className="flex w-full gap-2">
            <button
              onClick={handlePDFButtonClick}
              className="flex-1 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-sm"
            >
              Download
            </button>
            <button
              onClick={toggleBulkSelection}
              className={`flex-1 flex items-center justify-center w-auto px-4 h-9 rounded-lg focus:outline-none focus:ring-2 shadow-sm transition-colors ${
                showCheckboxes 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-500' 
                  : 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500'
              }`}
              title={showCheckboxes ? "Hide Selection Mode" : "Enable Selection Mode"}
              type="button"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {showCheckboxes ? 'Exit Selection' : 'Select'}
            </button>
          </div>
          {/* Row 4: Automation + Plus */}
          <div className="flex w-full gap-2">
            <button
              onClick={() => setShowAutomationsModal(true)}
              className="flex-1 flex items-center justify-center cursor-pointer w-28 h-9 rounded-lg bg-purple-600 hover:bg-purple-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm mr-2"
              title="Automation"
              type="button"
            >
              Automation
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex-1 flex items-center justify-center w-8 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              title="Create Task"
              type="button"
            >
              <PlusIcon className="h-6 w-8" />
            </button>
          </div>
        </div>
        {/* Desktop layout: unchanged */}
        <div className="hidden sm:flex flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full">
          {/* ...existing code... (all original button layout for desktop) */}
          <div className="relative" ref={filterPopupRef}>
            <button
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm"
              onClick={openFilterPopup}
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
              filters={filterDraft}
              setFilters={filters => {
                setFilterDraft(filters);
                if (filters.length < filterDraft.length) {
                  updateActiveTab({ filters });
                } else if (filters.length > 0 && filters.every(f => f.saved)) {
                  updateActiveTab({ filters });
                }
              }}
              users={users}
              clientNames={clientNames}
              clientGroups={clientGroups}
              workTypes={workTypes}
              priorities={priorities}
              customColumns={customColumns}
            />
          </div>
          <input
            type="text"
            placeholder="Search tasks..."
            className="min-w-[300px] max-w-[420px] flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
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
              <div ref={columnsDropdownRef} className="absolute right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 mt-2 w-56">
                <div className="font-semibold text-gray-700 mb-2 text-sm">Show/Hide Columns</div>
                <div className="max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {extendedColumns.map(col => (
                    <label key={col.id} className="flex items-center space-x-2 mb-1 cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors">
                      <input
                        type="checkbox"
                        checked={activeTabObj.visibleColumns.includes(col.id)}
                        onChange={() => toggleColumnVisibility(col.id)}
                        className="accent-blue-500"
                      />
                      <span className="text-gray-800 text-sm">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
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
              <div ref={groupByDropdownRef} className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-44" style={{minWidth: '160px'}}>
                <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">Group By</div>
                <button className={`block w-full text-left px-4 py-2 rounded ${!activeTabObj.sortBy || activeTabObj.sortBy === '' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: '' }); setShowGroupByDropdown(false); }}>None</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'createdAt' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'createdAt' }); setShowGroupByDropdown(false); }}>Assigned On</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'priority' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'priority' }); setShowGroupByDropdown(false); }}>Priority</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'status' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'status' }); setShowGroupByDropdown(false); }}>Stages</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'clientName' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'clientName' }); setShowGroupByDropdown(false); }}>Client Name</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'clientGroup' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'clientGroup' }); setShowGroupByDropdown(false); }}>Client Group</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'workType' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'workType' }); setShowGroupByDropdown(false); }}>Work Type</button>
                <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'billed' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'billed' }); setShowGroupByDropdown(false); }}>Internal Works</button>
              </div>
            )}
          </div>
          <button
            onClick={handlePDFButtonClick}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-sm"
          >
            Download
          </button>
          <button
            onClick={toggleBulkSelection}
            className={`ml-0 flex items-center justify-center w-auto px-4 h-9 rounded-lg focus:outline-none focus:ring-2 shadow-sm transition-colors ${
              showCheckboxes 
                ? 'bg-orange-600 hover:bg-orange-700 text-white focus:ring-orange-500' 
                : 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500'
            }`}
            title={showCheckboxes ? "Hide Selection Mode" : "Enable Selection Mode"}
            type="button"
          >
            <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showCheckboxes ? 'Exit Selection' : 'Select'}
          </button>
          <button
            onClick={() => setShowAutomationsModal(true)}
            className="ml-0 flex items-center justify-center cursor-pointer w-28 h-9 rounded-lg bg-purple-600 hover:bg-purple-700 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm mr-2"
            title="Automation"
            type="button"
          >
            Automation
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="ml-0 flex items-center justify-center w-8 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            title="Create Task"
            type="button"
          >
            <PlusIcon className="h-6 w-8" />
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && showCheckboxes && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-blue-800 font-medium">
                {selectedTasks.length} task{selectedTasks.length > 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-blue-600">
              <span>•</span>
              <button
                onClick={() => {
                  setSelectedTasks([]);
                  setIsAllSelected(false);
                  setShowBulkActions(false);
                }}
                className="text-blue-600 hover:text-blue-800 font-medium transition-colors hover:underline"
              >
                Clear Selection
              </button>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowDeleteConfirmation(true)}
              className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all hover:shadow-md"
            >
              <svg className="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Selected ({selectedTasks.length})
            </button>
          </div>
        </div>
      )}

      {/* Responsive table wrapper - hide scrollbar */}
      <div className="table-wrapper-no-scrollbar w-full" ref={tableRef}>
        <AdvancedTaskTable
          tasks={getFilteredAndSortedTasks(tasks, isFilterPopupOpen ? filterDraft : activeTabObj.filters)}
          viewType="admin"
          taskType={null}
          externalTableRef={tableRef}
          onTaskUpdate={(taskId, updater) => {
            setTasks(prevTasks => prevTasks.map(task =>
              task._id === taskId ? updater(task) : task
            ));
          }}
          onTaskDelete={() => {}}
          onStatusChange={async (taskId, newStatus) => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${user.token}`,
                },
                body: JSON.stringify({ status: newStatus }),
              });
              if (!response.ok) throw new Error('Failed to update status');
              const updatedTask = await response.json();
              setTasks(prevTasks => prevTasks.map(task =>
                task._id === taskId ? updatedTask : task
              ));
            } catch (err) {
              toast.error('Failed to update status');
            }
          }}
          shouldDisableActions={() => false}
          shouldDisableFileActions={() => true}
          taskHours={taskHours}
          storageKeyPrefix="admindashboard"
          visibleColumns={activeTabObj.visibleColumns}
          setVisibleColumns={cols => updateActiveTab({ visibleColumns: cols })}
          columnWidths={activeTabObj.columnWidths}
          setColumnWidths={widths => updateActiveTab({ columnWidths: widths })}
          columnOrder={activeTabObj.columnOrder}
          setColumnOrder={order => updateActiveTab({ columnOrder: order })}
          onEditTask={handleEditTask}
          users={users}
          currentUser={user}
          refetchTasks={fetchTasks}
          sortBy={activeTabObj.sortBy}
          filters={isFilterPopupOpen ? filterDraft : activeTabObj.filters}
          tabKey="adminDashboard"
          tabId={activeTabObj.id}
          allColumns={extendedColumns}
          // Bulk selection props
          enableBulkSelection={showCheckboxes}
          selectedTasks={selectedTasks}
          onTaskSelect={handleTaskSelect}
          isAllSelected={isAllSelected}
          onSelectAll={handleSelectAll}
        />
      </div>
      {/* Edit Task Modal */}
  {/* Edit modal is now managed inside AdvancedTaskTable to prevent unnecessary unmounting of tasks */}
      {/* Create Task Modal */}
      {createModalOpen && (
        <CreateTask
          users={users}
          mode="create"
          initialData={null}
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSubmit={handleTaskSubmit}
        />
      )}
      {/* Automations Modal */}
      {showAutomationsModal && (
        <AutomationsModal
          isOpen={showAutomationsModal}
          onClose={() => { 
            setShowAutomationsModal(false); 
            setSelectedAutomation(null); 
            setTemplateSearchTerm('');
          }}
          onSelectAutomation={auto => { 
            setSelectedAutomation(auto); 
            setShowAutomationsModal(false); 
            setTemplateSearchTerm('');
          }}
          user={user}
          API_BASE_URL={API_BASE_URL}
        />
      )}

      {/* Automation's Tasks Modal */}
      {selectedAutomation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl min-h-[320px] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedAutomation.name}</h2>
                <div className="text-xs text-gray-500 mt-1">{selectedAutomation.description}</div>
                <div className="flex items-center mt-2">
                  <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 font-medium rounded-full">
                    Day: {selectedAutomation.dayOfMonth}
                  </div>
                  {Array.isArray(selectedAutomation.taskTemplate) && (
                    <div className="text-xs px-2 py-1 bg-green-100 text-green-700 font-medium rounded-full ml-2">
                      {selectedAutomation.taskTemplate.length} {selectedAutomation.taskTemplate.length === 1 ? 'template' : 'templates'}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={() => {
                setSelectedAutomation(null);
                setTemplateSearchTerm('');
              }} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
            </div>
            <div className="flex-1 mb-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-md font-semibold text-gray-800">Task Templates</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  {Array.isArray(selectedAutomation.taskTemplate) ? selectedAutomation.taskTemplate.length : 0} templates
                </span>
              </div>
              
              {/* Search bar for templates */}
              {Array.isArray(selectedAutomation.taskTemplate) && selectedAutomation.taskTemplate.length > 0 && (
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={templateSearchTerm}
                    onChange={(e) => setTemplateSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
              
              {Array.isArray(selectedAutomation.taskTemplate) && selectedAutomation.taskTemplate.length > 0 ? (
                (() => {
                  // Filter out templates with verificationStatus 'pending' first
                  const filteredTemplates = selectedAutomation.taskTemplate
                    .filter(template => template.verificationStatus !== 'pending')
                    .filter(template =>
                      !templateSearchTerm ||
                      (template.title && template.title.toLowerCase().includes(templateSearchTerm.toLowerCase()))
                    );
                  return filteredTemplates.length > 0 ? (
                    <ul className="space-y-2 mt-2 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: "420px" }}>
                      {filteredTemplates.map((template, idx) => (
                    <li key={idx} className="py-3 px-4 flex items-center justify-between bg-yellow-50 border-l-4 border-yellow-400 rounded-md hover:bg-yellow-100 transition-colors shadow-sm">
                      <div className="flex-1">
                        <span className="font-medium text-gray-800">{template.title || 'Scheduled Task'}</span>
                        <div className="text-xs text-gray-500 mt-1">
                          Created on {new Date().toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          className="text-blue-500 hover:text-blue-700 text-xs bg-white hover:bg-blue-50 border border-blue-200 px-3 py-1 rounded-md transition-colors flex items-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Find the original index in the full template array
                            const originalIndex = selectedAutomation.taskTemplate.findIndex(t => 
                              t.title === template.title && 
                              t.clientName === template.clientName &&
                              t.clientGroup === template.clientGroup
                            );
                            handleEditTemplate(template, originalIndex);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button 
                          className="text-red-500 hover:text-red-700 text-xs bg-white hover:bg-red-50 border border-red-200 px-3 py-1 rounded-md transition-colors flex items-center"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm(`Are you sure you want to delete this template: ${template.title}?`)) {
                              try {
                                // Create a new array without this template
                                const updatedTemplates = selectedAutomation.taskTemplate.filter((_, i) => i !== idx);
                              
                              // Update the automation with the new templates array
                              const response = await fetch(`${API_BASE_URL}/api/automations/${selectedAutomation._id}`, {
                                method: 'PUT',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${user.token}`,
                                },
                                body: JSON.stringify({ taskTemplate: updatedTemplates }),
                              });
                              
                              if (!response.ok) {
                                throw new Error('Failed to delete template');
                              }
                              
                              // Update local state
                              const updatedAutomation = await response.json();
                              setSelectedAutomation(updatedAutomation);
                              toast.success('Task template deleted successfully');
                            } catch (error) {
                              toast.error(error.message || 'Failed to delete template');
                              console.error('Error deleting template:', error);
                            }
                          }
                        }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-100 shadow-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19l-7-7 7-7m5 14l7-7-7-7" />
                      </svg>
                      <p className="text-sm text-gray-500 font-medium">No templates found matching "{templateSearchTerm}"</p>
                      <p className="text-xs text-gray-400 mt-2">Try adjusting your search term.</p>
                    </div>
                  );
                })()
              ) : (
                <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-100 shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm text-gray-500 font-medium">No task templates in this automation yet.</p>
                  <p className="text-xs text-gray-400 mt-2">Add a template using the button below.</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowAddAutomationTask(true)}
              className="bg-blue-600 text-white rounded-md py-2.5 font-semibold hover:bg-blue-700 transition w-full flex items-center justify-center shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add New Task Template
            </button>
          </div>
        </div>
      )}

      {/* Add Task to Automation Modal */}
      {showAddAutomationTask && selectedAutomation && (
        <AutomationTask
          users={users}
          mode="create"
          initialData={null}
          isOpen={showAddAutomationTask}
          onClose={() => setShowAddAutomationTask(false)}
          automationId={selectedAutomation._id}
          onSubmit={(taskTemplate) => {
            // After adding a template, fetch the updated automation with all templates
            (async () => {
              try {
                // Fetch the updated automation
                const res = await fetch(`${API_BASE_URL}/api/automations/${selectedAutomation._id}`, {
                  headers: { Authorization: `Bearer ${user.token}` },
                });
                const updatedAutomation = await res.json();
                if (updatedAutomation && updatedAutomation._id) {
                  setSelectedAutomation(updatedAutomation);
                }
                
                // Also update task list if needed
                const tasksRes = await fetch(`${API_BASE_URL}/api/automations/${selectedAutomation._id}/tasks`, {
                  headers: { Authorization: `Bearer ${user.token}` },
                });
                const tasksData = await tasksRes.json();
                setAutomationTasks(Array.isArray(tasksData) ? tasksData : []);
              } catch (error) {
                console.error("Error fetching updated automation:", error);
              }
            })();
            setShowAddAutomationTask(false);
          }}
        />
      )}
      {/* PDF Column Selector Modal */}
      <EnhancedPDFColumnSelector
        isOpen={showPDFColumnSelector}
        onClose={() => setShowPDFColumnSelector(false)}
        onDownload={handleDownloadPDF}
        onDownloadExcel={handleDownloadExcel}
        onOpenITR={() => {
          setShowPDFColumnSelector(false);
          setShowITRColumnSelector(true);
        }}
        availableColumns={[
          ...ALL_COLUMNS,
          ...customColumns.map(col => ({
            id: `custom_${col.name}`,
            label: col.label,
            defaultWidth: 150,
            isCustom: true,
            customColumn: col
          }))
        ]}
      />

      {/* ITR Column Selector Modal */}
      <ITRColumnSelector
        isOpen={showITRColumnSelector}
        onClose={() => setShowITRColumnSelector(false)}
        onDownload={handleITRDownload}
        tasks={getFilteredAndSortedTasks(tasks, activeTabObj.filters)}
      />

      {/* File Upload and Comments Modal */}
      {selectedTask && (showFileUpload || showComments) && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">
                {showFileUpload ? 'Task Files' : 'Task Comments'}
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
                </>
              ) : (
                <TaskComments taskId={selectedTask._id} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Template Modal */}
      {editTemplateModalOpen && (
        <AutomationTask
          users={users}
          mode="edit"
          initialData={editingTemplate}
          isOpen={editTemplateModalOpen}
          onClose={() => {
            setEditTemplateModalOpen(false);
            setEditingTemplate(null);
            setEditingTemplateIndex(null);
          }}
          onSubmit={handleTemplateSubmit}
          automationId={selectedAutomation?._id}
          isEditingTemplate={true}
        />
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-gray-50/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center mb-4">
              <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mr-4">
                <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Delete Tasks</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <div className="mb-6">
              <p className="text-gray-700">
                Are you sure you want to delete <span className="font-semibold text-red-600">{selectedTasks.length}</span> selected task{selectedTasks.length > 1 ? 's' : ''}?
              </p>
            </div>
            <div className="flex space-x-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                Delete {selectedTasks.length} Task{selectedTasks.length > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;