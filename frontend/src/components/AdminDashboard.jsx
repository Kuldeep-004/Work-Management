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
  PlusIcon,
} from '@heroicons/react/24/outline';
import FileUpload from './FileUpload';
import FileList from './FileList';
import TaskComments from './TaskComments';
import defaultProfile from '../assets/avatar.jpg';
import FilterPopup from './FilterPopup';
import PDFColumnSelector from './PDFColumnSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  { id: 'workDoneBy', label: 'Work Done', defaultWidth: 120 },
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
const DEFAULT_TAB = () => ({
  id: String(Date.now()),
  title: 'Tab 1',
  filters: [],
  sortBy: 'createdAt',
  sortOrder: 'desc',
  searchTerm: '',
  visibleColumns: ALL_COLUMNS.map(col => col.id),
  columnWidths: Object.fromEntries(ALL_COLUMNS.map(col => [col.id, col.defaultWidth])),
  columnOrder: ALL_COLUMNS.map(col => col.id),
});

const Dashboard = () => {
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
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
  const filterPopupRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [clientNames, setClientNames] = useState([]);
  const [clientGroups, setClientGroups] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [taskHours, setTaskHours] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnsDropdownRef = useRef(null);
  const tableRef = useRef(null);
  const [showPDFColumnSelector, setShowPDFColumnSelector] = useState(false);
  const [editingDescriptionTaskId, setEditingDescriptionTaskId] = useState(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  // 8. Remove columnWidths, columnOrder, setColumnWidths, setColumnOrder from top-level state (move to per-tab)
  // const [columnWidths, setColumnWidths] = useState({});
  // const [columnOrder, setColumnOrder] = useState(() => ALL_COLUMNS.map(col => col.id));
  // Add local state for filter popup
  const [filterDraft, setFilterDraft] = useState([]);
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);

  // When opening the filter popup, copy the current tab's filters to the draft
  const openFilterPopup = () => {
    setFilterDraft([...activeTabObj.filters]);
    setIsFilterPopupOpen(true);
  };

  // When saving filters, update the tab's filters and close the popup
  const saveFilters = () => {
    updateActiveTab({ filters: filterDraft });
    setIsFilterPopupOpen(false);
  };

  // Get active tab object
  const activeTabObj = tabs.find(tab => tab.id === activeTabId) || tabs[0] || DEFAULT_TAB();

  // Tab actions
  const addTab = async () => {
    const newId = String(Date.now());
    const newTabs = [...tabs, { ...DEFAULT_TAB(), id: newId, title: `Tab ${tabs.length + 1}` }];
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
  // 6. Update updateActiveTab to allow patching visibleColumns and columnWidths
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
          const def = { ...DEFAULT_TAB() };
          setTabs([def]);
          setActiveTabId(def.id);
        }
      } catch {
        if (isMounted) {
          const def = { ...DEFAULT_TAB() };
          setTabs([def]);
          setActiveTabId(def.id);
        }
      } finally {
        if (isMounted) setTabsLoaded(true);
      }
    })();
    return () => { isMounted = false; };
  }, [user]);

  // Save tabs and activeTabId to backend whenever they change (after load)
  useEffect(() => {
    if (!user?.token || !tabsLoaded) return;
    saveTabState('adminDashboard', { tabs, activeTabId }, user.token).catch(() => {});
  }, [tabs, activeTabId, user, tabsLoaded]);

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

  const fetchTasks = async () => {
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
      // Fetch saved order for this tab
      let orderedTasks = data;
      try {
        const tabKey = 'adminDashboard';
        const tabId = activeTabObj.id;
        const orderRes = await fetch(`${API_BASE_URL}/api/users/tabstate/taskOrder?tabKey=${tabKey}&tabId=${tabId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (orderRes.ok) {
          const orderData = await orderRes.json();
          const savedOrder = orderData.taskOrder;
          if (savedOrder && Array.isArray(savedOrder)) {
            const idToTask = Object.fromEntries(data.map(t => [t._id, t]));
            orderedTasks = savedOrder.map(id => idToTask[id]).filter(Boolean);
            // Add any new tasks not in savedOrder
            for (const t of data) if (!orderedTasks.includes(t)) orderedTasks.push(t);
          }
        }
      } catch (err) {
        // If order fetch fails, just use default order
      }
      setTasks(orderedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError(error.message);
      toast.error(error.message || 'Failed to fetch tasks');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeTabId]);

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

  const getFilteredAndSortedTasks = (tasks, filtersToUse) => {
    if (!Array.isArray(tasks)) return [];
    const filters = filtersToUse || activeTabObj.filters;

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
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border border-red-200'; // Red - Highest importance
      case 'today':
        return 'bg-orange-100 text-orange-800 border border-orange-200'; // Orange - Very high importance
      case 'lessThan3Days':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200'; // Yellow - High importance
      case 'thisWeek':
        return 'bg-blue-100 text-blue-800 border border-blue-200'; // Blue - Medium-high importance
      case 'thisMonth':
        return 'bg-indigo-100 text-indigo-800 border border-indigo-200'; // Indigo - Medium importance
      case 'regular':
        return 'bg-gray-100 text-gray-800 border border-gray-200'; // Gray - Normal importance
      case 'filed':
        return 'bg-purple-100 text-purple-800 border border-purple-200'; // Purple - Low importance
      case 'dailyWorksOffice':
        return 'bg-teal-100 text-teal-800 border border-teal-200'; // Teal - Very low importance
      case 'monthlyWorks':
        return 'bg-slate-100 text-slate-600 border border-slate-200'; // Slate - Lowest importance
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  // Calculate statistics
  const stats = {
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'completed').length,
    inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
    pendingTasks: tasks.filter(t => t.status === 'pending').length,
    yetToStartTasks: tasks.filter(t => t.status === 'yet_to_start').length,
    todayTasks: tasks.filter(t => new Date(t.dueDate).toDateString() === new Date().toDateString()).length,
  };

  const handleStatusClick = (taskId, status) => {
    // Implement the logic to handle status click
    console.log(`Status clicked for task ${taskId}, new status: ${status}`);
  };

  const handleEditTask = (task) => {
    setEditTask(task);
    setEditModalOpen(true);
  };
  const handleTaskSubmit = (updatedOrCreated) => {
    setEditModalOpen(false);
    setCreateModalOpen(false);
    setEditTask(null);
    fetchTasks(); // Light reload after create or edit
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

  const filteredAndSortedTasks = getFilteredAndSortedTasks();

  // PDF export handler
  const handleDownloadPDF = (selectedColumns) => {
    const filteredTasks = getFilteredAndSortedTasks();
    
    // Get the selected column definitions
    const selectedColumnDefs = ALL_COLUMNS.filter(col => selectedColumns.includes(col.id));
    
    // Prepare data based on selected columns
    const data = filteredTasks.map(task => {
      const row = {};
      selectedColumnDefs.forEach(col => {
        switch (col.id) {
          case 'title':
            row[col.label] = task.title;
            break;
          case 'description':
            row[col.label] = task.description;
            break;
          case 'clientName':
            row[col.label] = task.clientName;
            break;
          case 'clientGroup':
            row[col.label] = task.clientGroup;
            break;
          case 'workType':
            row[col.label] = Array.isArray(task.workType) ? task.workType.join(', ') : task.workType;
            break;
          case 'workDoneBy':
            row[col.label] = task.workDoneBy || '';
            break;
          case 'billed':
            row[col.label] = task.billed ? 'Yes' : 'No';
            break;
          case 'status':
            row[col.label] = task.status;
            break;
          case 'priority':
            row[col.label] = task.priority;
            break;
          case 'selfVerification':
            row[col.label] = task.selfVerification ? '✔' : '✖';
            break;
          case 'inwardEntryDate':
            row[col.label] = task.inwardEntryDate ? formatDateTime(task.inwardEntryDate) : '';
            break;
          case 'dueDate':
            row[col.label] = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '';
            break;
          case 'targetDate':
            row[col.label] = task.targetDate ? new Date(task.targetDate).toLocaleDateString() : '';
            break;
          case 'assignedBy':
            row[col.label] = task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : '';
            break;
          case 'assignedTo':
            row[col.label] = Array.isArray(task.assignedTo)
              ? task.assignedTo.map(u => `${u.firstName} ${u.lastName}`).join(', ')
              : (task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '');
            break;
          case 'verificationAssignedTo':
            row[col.label] = task.verificationAssignedTo ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}` : '';
            break;
          case 'secondVerificationAssignedTo':
            row[col.label] = task.secondVerificationAssignedTo ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}` : '';
            break;
          case 'guides':
            row[col.label] = task.guides ? task.guides.map(g => g.name).join(', ') : '';
            break;
          case 'files':
            row[col.label] = task.files && task.files.length > 0 ? task.files.map(f => f.originalName || f.originalname).join(', ') : '';
            break;
          case 'comments':
            row[col.label] = task.comments ? task.comments.length : 0;
            break;
          default:
            row[col.label] = '';
        }
      });
      return row;
    });

    // Create PDF
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(16);
    doc.text('Tasks Dashboard Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 30);
    doc.text(`Total Tasks: ${filteredTasks.length}`, 14, 37);

    // Prepare table data
    const headers = selectedColumnDefs.map(col => col.label);
    const tableData = data.map(row => selectedColumnDefs.map(col => row[col.label]));

    // Add table
    doc.autoTable({
      head: [headers],
      body: tableData,
      startY: 45,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246], // Blue color
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // Light gray
      },
      columnStyles: {
        0: { cellWidth: 30 }, // Title
        1: { cellWidth: 40 }, // Description
        2: { cellWidth: 25 }, // Client Name
        3: { cellWidth: 25 }, // Client Group
        4: { cellWidth: 25 }, // Work Type
        5: { cellWidth: 15 }, // Billed
        6: { cellWidth: 20 }, // Task Status
        7: { cellWidth: 25 }, // Priority
        8: { cellWidth: 15 }, // Self Verification
        9: { cellWidth: 25 }, // Inward Entry Date
        10: { cellWidth: 25 }, // Due Date
        11: { cellWidth: 20 }, // Target Date
        12: { cellWidth: 25 }, // Assigned By
        13: { cellWidth: 30 }, // Assigned To
        14: { cellWidth: 25 }, // First Verifier
        15: { cellWidth: 25 }, // Second Verifier
        16: { cellWidth: 30 }, // Guide
        17: { cellWidth: 30 }, // Files
        18: { cellWidth: 15 }, // Comments
      },
      didDrawPage: function (data) {
        // Add page number
        doc.setFontSize(8);
        doc.text(
          `Page ${doc.internal.getNumberOfPages()}`,
          data.settings.margin.left,
          doc.internal.pageSize.height - 10
        );
      },
    });

    doc.save('tasks_dashboard.pdf');
  };

  const handlePDFButtonClick = () => {
    setShowPDFColumnSelector(true);
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

  // Calculate widget numbers before return
  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const todayCount = tasks.filter(t => {
    if (!t.dueDate) return false;
    const today = new Date();
    const taskDate = new Date(t.dueDate);
    return taskDate.toDateString() === today.toDateString();
  }).length;
  const totalCount = tasks.length;
  const urgentCount = tasks.filter(t => t.priority === 'urgent').length;

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
      />
      {/* Restore original summary cards/widgets here */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-md p-3 sm:p-4">
          <div className="flex items-center">
            <ClockIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Pending</h3>
              <p className="text-xl sm:text-3xl font-bold text-red-600">{pendingCount}</p>
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
      <div className="flex flex-nowrap items-center gap-4 mb-4 ">
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
              // If a filter was deleted, persist immediately
              if (filters.length < filterDraft.length) {
                updateActiveTab({ filters });
              }
              // If all filters are saved, persist as well
              else if (filters.length > 0 && filters.every(f => f.saved)) {
                updateActiveTab({ filters });
              }
            }}
            users={users}
            clientNames={clientNames}
            clientGroups={clientGroups}
            workTypes={workTypes}
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
            <div ref={columnsDropdownRef} className="absolute right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 mt-2 w-56 animate-fade-in">
              <div className="font-semibold text-gray-700 mb-2 text-sm">Show/Hide Columns</div>
              <div className="max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {ALL_COLUMNS.map(col => (
                  <label key={col.id} className="flex items-center space-x-2 mb-1 cursor-pointer hover:bg-blue-50 rounded px-2 py-1 transition-colors">
                    <input
                      type="checkbox"
                      checked={activeTabObj.visibleColumns.includes(col.id)}
                      onChange={() => {
                        const cols = activeTabObj.visibleColumns || [];
                        let newCols;
                        if (cols.includes(col.id)) {
                          newCols = cols.filter(c => c !== col.id);
                        } else {
                          newCols = [...cols, col.id];
                        }
                        // Always create a new array to trigger React state update
                        updateActiveTab({ visibleColumns: [...newCols] });
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
        {/* Enhanced Group By Dropdown */}
        <div className="relative flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
            onClick={() => setShowGroupByDropdown(v => !v)}
            type="button"
          >
            {/* Modern grouping icon (e.g., grid or layers) */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>
            <span className="font-semibold">Group By</span>
          </button>
          {/* Remove applied group pill here */}
          {showGroupByDropdown && (
            <div className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-44 animate-fade-in" style={{minWidth: '160px'}}>
              <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">Group By</div>
              <button className={`block w-full text-left px-4 py-2 rounded ${!activeTabObj.sortBy || activeTabObj.sortBy === '' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: '' }); setShowGroupByDropdown(false); }}>None</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'createdAt' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'createdAt' }); setShowGroupByDropdown(false); }}>Assigned On</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'priority' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'priority' }); setShowGroupByDropdown(false); }}>Priority</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'status' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'status' }); setShowGroupByDropdown(false); }}>Stages</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'clientName' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'clientName' }); setShowGroupByDropdown(false); }}>Client Name</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'clientGroup' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'clientGroup' }); setShowGroupByDropdown(false); }}>Client Group</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'workType' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'workType' }); setShowGroupByDropdown(false); }}>Work Type</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${activeTabObj.sortBy === 'workDoneBy' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { updateActiveTab({ sortBy: 'workDoneBy' }); setShowGroupByDropdown(false); }}>Work Done</button>
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
          onClick={() => setCreateModalOpen(true)}
          className="ml-0 flex items-center justify-center w-8 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          title="Create Task"
          type="button"
        >
          <PlusIcon className="h-6 w-8" />
        </button>
      </div>

      {/* Responsive table wrapper */}
      <div className="overflow-x-auto w-full" ref={tableRef}>
        <AdvancedTaskTable
          tasks={getFilteredAndSortedTasks(tasks, isFilterPopupOpen ? filterDraft : activeTabObj.filters)}
          viewType="admin"
          taskType={null}
          onTaskUpdate={(taskId, updater) => {
            setTasks(prevTasks => prevTasks.map(task =>
              task._id === taskId ? updater(task) : task
            ));
          }}
          onTaskDelete={() => {}}
          onStatusChange={() => {}}
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
        />
      </div>
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
    </div>
  );
};

export default Dashboard;