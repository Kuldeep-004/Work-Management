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
import PDFColumnSelector from './PDFColumnSelector';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_BASE_URL } from '../apiConfig';
import AdvancedTaskTable from './AdvancedTaskTable';

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
  { id: 'billed', label: 'Billed', defaultWidth: 80 },
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
  { id: 'guides', label: 'Guide', defaultWidth: 150 },
  { id: 'files', label: 'Files', defaultWidth: 120 },
  { id: 'comments', label: 'Comments', defaultWidth: 120 },
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

  // Drag and drop state
  const [columnOrder, setColumnOrder] = useState(() => {
    const userId = user?._id || 'guest';
    const key = `admindashboard_column_order_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return ALL_COLUMNS.map(col => col.id);
  });

  const [columnWidths, setColumnWidths] = useState({});

  const [draggedColumn, setDraggedColumn] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizingColumn, setResizingColumn] = useState(null);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

  // Use refs to track resizing state for event handlers
  const isResizingRef = useRef(false);
  const resizingColumnRef = useRef(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(0);

  const columnsDropdownRef = useRef(null);
  const tableRef = useRef(null);

  // State for PDF column selector
  const [showPDFColumnSelector, setShowPDFColumnSelector] = useState(false);

  const [editingDescriptionTaskId, setEditingDescriptionTaskId] = useState(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');

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
      } else if (sortBy === 'priority') {
        // Use priority order mapping for priority sorting
        aValue = priorityOrder[aValue] || 999;
        bValue = priorityOrder[bValue] || 999;
        // For priority, descending should show highest priority first (urgent=1, today=2, etc.)
        // So we swap the logic for priority sorting
        if (aValue < bValue) return sortOrder === 'desc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'desc' ? 1 : -1;
        return 0;
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

  const handleDescriptionEditSave = async (task) => {
    if (editingDescriptionValue === task.description) {
      setEditingDescriptionTaskId(null);
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/description`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ description: editingDescriptionValue }),
      });
      if (!response.ok) throw new Error('Failed to update description');
      const updatedTask = await response.json();
      setTasks(tasks.map(t => t._id === task._id ? {...t, description: updatedTask.description} : t));
      toast.success('Status updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
    setEditingDescriptionTaskId(null);
  };

  // Drag and drop handlers
  const handleDragStart = (e, columnId) => {
    setDraggedColumn(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', columnId);
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetColumnId) => {
    e.preventDefault();
    if (draggedColumn && draggedColumn !== targetColumnId) {
      const newOrder = [...columnOrder];
      const draggedIndex = newOrder.indexOf(draggedColumn);
      const targetIndex = newOrder.indexOf(targetColumnId);
      
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedColumn);
      
      setColumnOrder(newOrder);
    }
    setDraggedColumn(null);
    setDragOverColumn(null);
  };

  // Column resize handlers
  const handleResizeStart = (e, columnId) => {
    console.log('🖱️ Resize start clicked for column:', columnId);
    e.preventDefault();
    e.stopPropagation();
    
    // Set refs immediately (synchronous)
    isResizingRef.current = true;
    resizingColumnRef.current = columnId;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = columnWidths[columnId] || 150;
    
    // Set React state for UI updates
    setIsResizing(true);
    setResizingColumn(columnId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[columnId] || 150);
    
    console.log('📏 Starting width:', columnWidths[columnId] || 150);
    console.log('📍 Start X:', e.clientX);
    console.log('🔧 Refs set - isResizing:', isResizingRef.current, 'column:', resizingColumnRef.current);
    
    // Add cursor style to body
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    // Add event listeners immediately
    console.log('🔗 Adding event listeners');
    window.addEventListener('mousemove', handleResizeMove, { passive: false });
    window.addEventListener('mouseup', handleResizeEnd, { passive: false });
  };

  const handleResizeMove = (e) => {
    console.log('🔄 Mouse move event fired, isResizing:', isResizingRef.current, 'resizingColumn:', resizingColumnRef.current);
    
    if (!isResizingRef.current || !resizingColumnRef.current) return;
    
    const deltaX = e.clientX - resizeStartXRef.current;
    const newWidth = Math.max(80, resizeStartWidthRef.current + deltaX); // Minimum width of 80px
    
    console.log('🔄 Resizing:', resizingColumnRef.current, 'Delta:', deltaX, 'New width:', newWidth);
    
    setColumnWidths(prev => {
      const updated = {
        ...prev,
        [resizingColumnRef.current]: newWidth
      };
      console.log('📊 Updated widths:', updated);
      return updated;
    });
    
    // Prevent text selection during resize
    e.preventDefault();
  };

  const handleResizeEnd = () => {
    console.log('✅ Resize ended');
    
    // Reset refs
    isResizingRef.current = false;
    resizingColumnRef.current = null;
    resizeStartXRef.current = 0;
    resizeStartWidthRef.current = 0;
    
    // Reset React state
    setIsResizing(false);
    setResizingColumn(null);
    setResizeStartX(0);
    setResizeStartWidth(0);
    
    // Reset cursor and user select
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
  };

  // Get ordered columns based on current order and visibility
  const getOrderedVisibleColumns = () => {
    return ALL_COLUMNS.map(col => col.id).filter(colId => visibleColumns.includes(colId));
  };

  // Replace the useEffect for loading columnWidths with this:
  useEffect(() => {
    const userId = user?._id || 'guest';
    const key = `admindashboard_column_widths_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setColumnWidths(parsed);
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
      setColumnWidths(defaultWidths);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  // Save to localStorage on every change
  useEffect(() => {
    const userId = user?._id || 'guest';
    const key = `admindashboard_column_widths_${userId}`;
    if (columnWidths && Object.keys(columnWidths).length > 0) {
      localStorage.setItem(key, JSON.stringify(columnWidths));
    }
  }, [columnWidths, user]);

  // Persist column order to localStorage whenever it changes
  useEffect(() => {
    const userId = user?._id || 'guest';
    const key = `admindashboard_column_order_${userId}`;
    if (columnOrder && columnOrder.length > 0) {
      localStorage.setItem(key, JSON.stringify(columnOrder));
    }
  }, [columnOrder, user]);

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
            <ExclamationCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 mr-2 sm:mr-4" />
            <div>
              <h3 className="text-sm sm:text-lg font-semibold text-gray-800">Urgent Tasks</h3>
              <p className="text-xl sm:text-3xl font-bold text-red-600">{tasks.filter(t => t.priority === 'urgent').length}</p>
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
            className="px-1 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[80px] transition-colors"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="createdAt">Assigned On</option>
            <option value="priority">Priority</option>
            <option value="status">Status</option>
            <option value="clientName">Client</option>
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
            onClick={handlePDFButtonClick}
            className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 text-sm"
          >
            Download
          </button>
        </div>
      </div>

      {/* Responsive table wrapper */}
      <div className="overflow-x-auto w-full" ref={tableRef}>
        <AdvancedTaskTable
          tasks={getFilteredAndSortedTasks(tasks)}
          viewType="admin"
          taskType={null}
          onTaskUpdate={() => {}}
          onTaskDelete={() => {}}
          onStatusChange={() => {}}
          shouldDisableActions={() => true}
          shouldDisableFileActions={() => true}
          taskHours={taskHours}
          storageKeyPrefix="admindashboard"
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
        />
      </div>

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