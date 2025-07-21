import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';
import FileUpload from './FileUpload';
import FileList from './FileList';
import TaskComments from './TaskComments';
import { API_BASE_URL } from '../apiConfig';
import ReactDOM from 'react-dom';
import React from 'react';

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
  { id: 'guides', label: 'Guide', defaultWidth: 200 },
  { id: 'files', label: 'Files', defaultWidth: 120 },
  { id: 'comments', label: 'Comments', defaultWidth: 120 },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent' },
  { value: 'today', label: 'Today' },
  { value: 'lessThan3Days', label: '< 3 days' },
  { value: 'thisWeek', label: 'This week' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'regular', label: 'Regular' },
  { value: 'filed', label: 'Filed' },
  { value: 'dailyWorksOffice', label: 'Daily works office' },
  { value: 'monthlyWorks', label: 'Monthly works' },
];

const STATUS_OPTIONS = [
  { value: 'yet_to_start', label: 'Yet to Start' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'reject', label: 'Reject' },
];

// Add at the top, after other useRef/useState:
const DRAG_ROW_CLASS = 'drag-row-highlight';

const AdvancedTaskTable = ({ 
  tasks, 
  viewType, 
  taskType, 
  showControls = true,
  onTaskUpdate,
  onTaskDelete,
  onStatusChange,
  onVerificationStatusChange,
  shouldDisableActions,
  shouldDisableFileActions,
  taskHours = [],
  visibleColumns,
  setVisibleColumns,
  columnWidths,
  setColumnWidths,
  columnOrder,
  setColumnOrder,
  storageKeyPrefix = 'advancedtasktable',
  users = [],
  currentUser = null,
  refetchTasks,
  onEditTask,
  sortBy,
  tabKey = 'defaultTabKey',
  tabId,
}) => {
  const { user } = useAuth();
  
  // Drag and drop state
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

  const tableRef = useRef(null);

  // Modal state
  const [selectedTask, setSelectedTask] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [editingDescriptionTaskId, setEditingDescriptionTaskId] = useState(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');
  const [editingPriorityTaskId, setEditingPriorityTaskId] = useState(null);
  const [priorityLoading, setPriorityLoading] = useState(false);
  const priorityDropdownRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [editingStatusTaskId, setEditingStatusTaskId] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const statusDropdownRef = useRef(null);
  const [editingVerifierTaskId, setEditingVerifierTaskId] = useState(null);
  const [verifierDropdownPosition, setVerifierDropdownPosition] = useState({ top: 0, left: 0 });
  const [verifierLoading, setVerifierLoading] = useState(false);
  const verifierDropdownRef = useRef(null);

  // State for search in verifier dropdown (should be inside component, not inside render)
  const [verifierSearch, setVerifierSearch] = useState('');

  // Add at the top, after other useRef/useState:
  const guideDropdownRef = useRef(null);
  const [openGuideDropdownTaskId, setOpenGuideDropdownTaskId] = useState(null);

  // Row drag-and-drop state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [dragOverGroupKey, setDragOverGroupKey] = useState(null);
  const [orderedTasks, setOrderedTasks] = useState(tasks);
  const [orderLoaded, setOrderLoaded] = useState(false);

  // Add a ref to track the last set of task IDs and grouping
  const lastTaskIdsRef = useRef([]);
  const lastGroupFieldRef = useRef(null);

  // Helper functions
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'yet_to_start':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
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

  const getUserTaskHours = (taskId, userId) => {
    const entry = taskHours.find(
      (h) => h.taskId === (taskId?._id || taskId) && h.userId === (userId?._id || userId)
    );
    return entry ? entry.totalHours : 0;
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
    e.preventDefault();
    e.stopPropagation();
    
    isResizingRef.current = true;
    resizingColumnRef.current = columnId;
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = columnWidths[columnId] || 150;
    
    setIsResizing(true);
    setResizingColumn(columnId);
    setResizeStartX(e.clientX);
    setResizeStartWidth(columnWidths[columnId] || 150);
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    
    window.addEventListener('mousemove', handleResizeMove, { passive: false });
    window.addEventListener('mouseup', handleResizeEnd, { passive: false });
  };

  const handleResizeMove = (e) => {
    if (!isResizingRef.current || !resizingColumnRef.current) return;
    
    const deltaX = e.clientX - resizeStartXRef.current;
    const newWidth = Math.max(80, resizeStartWidthRef.current + deltaX);
    
    setColumnWidths({
      ...columnWidths,
      [resizingColumnRef.current]: newWidth
    });
    
    e.preventDefault();
  };

  const handleResizeEnd = () => {
    isResizingRef.current = false;
    resizingColumnRef.current = null;
    resizeStartXRef.current = 0;
    resizeStartWidthRef.current = 0;
    
    setIsResizing(false);
    setResizingColumn(null);
    setResizeStartX(0);
    setResizeStartWidth(0);
    
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    
    window.removeEventListener('mousemove', handleResizeMove);
    window.removeEventListener('mouseup', handleResizeEnd);
  };

  // Get ordered columns based on current order and visibility
  const getOrderedVisibleColumns = () => {
    return columnOrder.filter(colId => visibleColumns.includes(colId));
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowFileUpload(true);
  };

  const handleFileUploaded = (files) => {
    if (onTaskUpdate) {
      onTaskUpdate(selectedTask._id, (prevTask) => ({
        ...prevTask,
        files: [
          ...(prevTask.files || []),
          ...files.filter(uf => !(prevTask.files || []).some(f => f._id === uf._id))
        ]
      }));
    }
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
    if (onTaskUpdate) {
      onTaskUpdate(selectedTask._id, (prevTask) => ({
        ...prevTask,
        files: (prevTask.files || []).filter(f => f._id !== fileId)
      }));
    }
  };

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
      if (onTaskUpdate) {
        onTaskUpdate(task._id, () => ({ ...task, description: updatedTask.description }));
      }
      toast.success('Status updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
    setEditingDescriptionTaskId(null);
  };

  const handlePriorityChange = async (task, newPriority) => {
    setPriorityLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/priority`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ priority: newPriority }),
      });
      if (!response.ok) throw new Error('Failed to update priority');
      const updatedTask = await response.json();
      if (onTaskUpdate) {
        onTaskUpdate(task._id, () => ({ ...task, priority: updatedTask.priority }));
      }
      toast.success('Priority updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update priority');
    }
    setPriorityLoading(false);
    setEditingPriorityTaskId(null);
  };

  const handleStatusChangeLocal = async (task, newStatus) => {
    setStatusLoading(true);
    try {
      if (newStatus === 'reject' && viewType === 'received') {
        // Call backend to reject and clear verifiers, set status to pending
        const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/status`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`,
          },
          body: JSON.stringify({ status: 'reject' }),
        });
        if (!response.ok) throw new Error('Failed to reject task');
        const updatedTask = await response.json();
        if (onTaskUpdate) onTaskUpdate(task._id, () => updatedTask);
        toast.success('Task rejected and set to pending');
        if (refetchTasks) refetchTasks();
      } else {
        await onStatusChange(task._id, newStatus);
        if (refetchTasks) refetchTasks();
      }
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
    setStatusLoading(false);
    setEditingStatusTaskId(null);
  };

  const handleDeleteTask = async (task) => {
    if (shouldDisableActions && shouldDisableActions(task)) return;
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          throw new Error('You can only delete tasks that you created');
        }
        // Only show error toast if not 'Task not found'
        if (errorData.message !== 'Task not found') {
          throw new Error(errorData.message || 'Failed to delete task');
        } else {
          // Silently ignore 'Task not found' error
          return;
        }
      }
      if (onTaskDelete) onTaskDelete(task._id);
      if (refetchTasks) refetchTasks();
      toast.success('Task deleted successfully');
    } catch (error) {
      if (error.message !== 'Task not found') {
        console.error('Error deleting task:', error);
        toast.error(error.message || 'Failed to delete task');
      }
    }
  };

  // Helper to group tasks by a field
  function groupTasksBy(tasks, field, options = {}) {
    const groups = {};
    tasks.forEach(task => {
      let key = task[field];
      // Use label if options provided (e.g., for priority/status)
      if (options && options[key]) key = options[key];
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return groups;
  }

  if (!user) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // In the main render, before tbody:
  const groupField = (!sortBy || sortBy === 'none') ? null : (
    (columnOrder.includes('priority') && sortBy === 'priority') ? 'priority'
    : (columnOrder.includes('status') && sortBy === 'status') ? 'status'
    : (columnOrder.includes('clientName') && sortBy === 'clientName') ? 'clientName'
    : (columnOrder.includes('clientGroup') && sortBy === 'clientGroup') ? 'clientGroup'
    : (columnOrder.includes('workType') && sortBy === 'workType') ? 'workType'
    : (columnOrder.includes('workDoneBy') && sortBy === 'workDoneBy') ? 'workDoneBy'
    : (columnOrder.includes('billed') && sortBy === 'billed') ? 'billed'
    : null
  );
  const shouldGroup = groupField && sortBy !== 'createdAt';
  let groupedTasks = null;
  if (shouldGroup) {
    let options = {};
    if (groupField === 'priority') PRIORITY_OPTIONS.forEach(opt => options[opt.value] = opt.label);
    if (groupField === 'status') STATUS_OPTIONS.forEach(opt => options[opt.value] = opt.label);
    if (groupField === 'billed') {
      options[true] = 'Yes';
      options[false] = 'No';
    }
    if (groupField === 'workType') {
      // For workType, group by first type if array, or by value
      groupedTasks = {};
      tasks.forEach(task => {
        let key = Array.isArray(task.workType) ? (task.workType[0] || 'Unspecified') : (task.workType || 'Unspecified');
        if (!groupedTasks[key]) groupedTasks[key] = [];
        groupedTasks[key].push(task);
      });
    } else if (groupField === 'workDoneBy') {
      groupedTasks = {};
      tasks.forEach(task => {
        let key = task.workDoneBy || 'Unassigned';
        if (!groupedTasks[key]) groupedTasks[key] = [];
        groupedTasks[key].push(task);
      });
    } else if (groupField === 'billed') {
      groupedTasks = {};
      tasks.forEach(task => {
        let key = task.billed ? 'Yes' : 'No';
        if (!groupedTasks[key]) groupedTasks[key] = [];
        groupedTasks[key].push(task);
      });
    } else {
      groupedTasks = groupTasksBy(tasks, groupField, options);
    }
  }

  // On mount, fetch columnOrder from backend for this tabKey
  useEffect(() => {
    let isMounted = true;
    async function fetchColumnOrder() {
      try {
        if (!tabKey || !tabId) return;
        const res = await fetch(`${API_BASE_URL}/api/users/tabstate/columnOrder?tabKey=${tabKey}&tabId=${tabId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (res.ok) {
          const data = await res.json();
          let order = data.columnOrder;
          const allIds = ALL_COLUMNS.map(col => col.id);
          // Fallback: ensure all columns present
          if (!order || !Array.isArray(order) || order.some(colId => !allIds.includes(colId)) || allIds.some(colId => !order.includes(colId))) {
            order = allIds;
          }
          if (isMounted) {
            setColumnOrder(order);
            setVisibleColumns(order);
          }
        }
      } catch (err) {
        // fallback: show all columns
        setColumnOrder(ALL_COLUMNS.map(col => col.id));
        setVisibleColumns(ALL_COLUMNS.map(col => col.id));
      }
    }
    fetchColumnOrder();
    return () => { isMounted = false; };
    // eslint-disable-next-line
  }, [tabKey, tabId]);

  // When columnOrder changes, persist to backend
  useEffect(() => {
    if (!columnOrder || !Array.isArray(columnOrder) || columnOrder.length === 0) return;
    async function saveColumnOrder() {
      try {
        if (!tabKey || !tabId) return;
        await fetch(`${API_BASE_URL}/api/users/tabstate/columnOrder`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
          body: JSON.stringify({ tabKey, columnOrder, tabId }),
        });
      } catch (err) {}
    }
    saveColumnOrder();
    // eslint-disable-next-line
  }, [columnOrder, tabKey, tabId]);

  // Helper to get all assigned verifier user IDs for a task
  const getAssignedVerifierIds = (task) => [
    task.verificationAssignedTo?._id,
    task.secondVerificationAssignedTo?._id,
    task.thirdVerificationAssignedTo?._id,
    task.fourthVerificationAssignedTo?._id,
    task.fifthVerificationAssignedTo?._id,
  ].filter(Boolean);

  // Helper: get group key for a task (if grouped)
  const getGroupKey = (task) => {
    if (!shouldGroup) return null;
    if (groupField === 'workType') return Array.isArray(task.workType) ? (task.workType[0] || 'Unspecified') : (task.workType || 'Unspecified');
    if (groupField === 'workDoneBy') return task.workDoneBy || 'Unassigned';
    if (groupField === 'billed') return task.billed ? 'Yes' : 'No';
    return task[groupField];
  };

  // Refactor the useEffect that fetches and applies task order
  useEffect(() => {
    let isMounted = true;
    // Get current task IDs
    const currentTaskIds = tasks.map(t => t._id).join(',');
    // Only fetch and apply order if the set of task IDs or grouping changes
    if (
      lastTaskIdsRef.current.join(',') !== currentTaskIds ||
      lastGroupFieldRef.current !== groupField
    ) {
      async function fetchAndApplyOrder() {
        setOrderLoaded(false);
        try {
          if (!tabKey || !tabId) return;
          const res = await fetch(`${API_BASE_URL}/api/users/tabstate/taskOrder?tabKey=${tabKey}&tabId=${tabId}`, {
            headers: { Authorization: `Bearer ${user.token}` },
          });
          if (res.ok) {
            const data = await res.json();
            let orderArr = data.taskOrder;
            if (orderArr && Array.isArray(orderArr)) {
              // Use a Set for fast lookup
              const idToTask = Object.fromEntries(tasks.map(t => [t._id, t]));
              const orderedSet = new Set(orderArr);
              let newOrderedTasks = orderArr.map(id => idToTask[id]).filter(Boolean);
              for (const t of tasks) {
                if (!orderedSet.has(t._id)) newOrderedTasks.push(t);
              }
              // Only update if order actually changed
              if (isMounted && (newOrderedTasks.length !== orderedTasks.length || newOrderedTasks.some((t, i) => t !== orderedTasks[i]))) {
                setOrderedTasks(newOrderedTasks);
              }
            } else {
              if (isMounted && tasks !== orderedTasks) setOrderedTasks(tasks);
            }
          } else {
            if (isMounted && tasks !== orderedTasks) setOrderedTasks(tasks);
          }
        } catch (err) {
          if (isMounted && tasks !== orderedTasks) setOrderedTasks(tasks);
        } finally {
          if (isMounted) setOrderLoaded(true);
          lastTaskIdsRef.current = tasks.map(t => t._id);
          lastGroupFieldRef.current = groupField;
        }
      }
      fetchAndApplyOrder();
    }
    // eslint-disable-next-line
  }, [tasks, shouldGroup, groupField, tabKey, tabId]);

  // Save order to backend
  const saveOrder = async (newOrder) => {
    try {
      if (!tabKey || !tabId) return;
      await fetch(`${API_BASE_URL}/api/users/tabstate/taskOrder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` },
        body: JSON.stringify({ tabKey, order: newOrder, tabId }),
      });
    } catch (err) {}
  };

  // Drag handlers for rows
  const handleRowDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  };
  const handleRowDragOver = (e, overTaskId) => {
    e.preventDefault();
    if (draggedTaskId) {
      setDragOverTaskId(overTaskId);
    }
  };
  const handleRowDrop = (e, dropTaskId) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    let newOrder = [];
    const idxFrom = orderedTasks.findIndex(t => t._id === draggedTaskId);
    const idxTo = orderedTasks.findIndex(t => t._id === dropTaskId);
    if (idxFrom === -1 || idxTo === -1) return;
    newOrder = [...orderedTasks];
    const [removed] = newOrder.splice(idxFrom, 1);
    newOrder.splice(idxTo, 0, removed);
    setOrderedTasks(newOrder);
    saveOrder(newOrder.map(t => t._id));
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };
  const handleRowDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverTaskId(null);
  };

  // Use orderedTasks instead of tasks in rendering
  // In grouped mode, group orderedTasks by groupKey
  let renderGroupedTasks = groupedTasks;
  if (shouldGroup && orderLoaded) {
    renderGroupedTasks = {};
    for (const t of orderedTasks) {
      const gk = getGroupKey(t);
      if (!renderGroupedTasks[gk]) renderGroupedTasks[gk] = [];
      renderGroupedTasks[gk].push(t);
    }
  }

  // Prevent rendering table until orderLoaded is true in grouped mode
  if (shouldGroup && !orderLoaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      <div className="pt-4 bg-gray-50 min-h-screen">
        {/* Responsive table wrapper */}
        <div className="overflow-x-auto w-full" ref={tableRef}>
          <table className={`min-w-full divide-y divide-gray-200 ${isResizing ? 'select-none' : ''}`}> 
            {/* Only render thead at the top if not grouping */}
            {!shouldGroup && (
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="px-2 py-1 text-left text-sm font-normal bg-white tracking-wider select-none whitespace-nowrap border-r border-gray-200" style={{width: '48px', minWidth: '48px'}}>No</th>
                  {getOrderedVisibleColumns().map((colId, idx, arr) => {
                    const col = ALL_COLUMNS.find(c => c.id === colId);
                    if (!col) return null;
                    const isLast = idx === arr.length - 1;
                    return (
                      <th
                        key={colId}
                        className={`px-2 py-1 text-left text-sm font-normal bg-white tracking-wider relative select-none whitespace-nowrap ${!isLast ? 'border-r border-gray-200' : ''}`}
                        style={{
                          width: (columnWidths[colId] || 150) + 'px',
                          minWidth: (columnWidths[colId] || 150) + 'px',
                          background: dragOverColumn === colId ? '#f0f6ff' : 'white',
                          boxShadow: dragOverColumn === colId ? 'inset 2px 0 0 0 #60a5fa' : undefined,
                          borderBottom: '1px solid #e5e7eb',
                          position: 'relative',
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, colId)}
                        onDragOver={(e) => handleDragOver(e, colId)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, colId)}
                      >
                        <span style={{fontWeight: 500}} className="whitespace-nowrap overflow-hidden text-ellipsis block">{col.label}</span>
                        {!isLast && (
                          <span
                            onMouseDown={e => handleResizeStart(e, colId)}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              height: '100%',
                              width: 8,
                              cursor: 'col-resize',
                              zIndex: 10,
                              userSelect: 'none',
                              background: 'transparent',
                              pointerEvents: 'auto',
                              display: 'block',
                            }}
                            onClick={e => e.stopPropagation()}
                            title="Resize column"
                            tabIndex={-1}
                          ></span>
                        )}
                      </th>
                    );
                  })}
                  {(viewType === 'assigned' || viewType === 'admin') && (
                    <th key="actions" className="px-2 py-1 text-left text-sm font-normal bg-white tracking-wider select-none">Actions</th>
                  )}
                </tr>
              </thead>
            )}
            <tbody>
              {shouldGroup ? (
                Object.entries(renderGroupedTasks).map(([group, groupTasks]) => (
                  <React.Fragment key={group}>
                    <tr key={group + '-header'}>
                      <td colSpan={getOrderedVisibleColumns().length + ((viewType === 'assigned' || viewType === 'admin') ? 2 : 1)} className="bg-gray-100 text-gray-800 font-semibold px-4 py-2 border-t border-b border-gray-300">{group}</td>
                    </tr>
                    <tr key={group + '-columns'} className="border-b border-gray-200">
                      <th className="px-2 py-1 text-left text-sm font-normal bg-white tracking-wider select-none whitespace-nowrap border-r border-gray-200" style={{width: '48px', minWidth: '48px'}}>No</th>
                      {getOrderedVisibleColumns().map((colId, idx, arr) => {
                        const col = ALL_COLUMNS.find(c => c.id === colId);
                        if (!col) return null;
                        const isLast = idx === arr.length - 1;
                        return (
                          <th
                            key={colId}
                            className={`px-2 py-1 text-left text-sm font-normal bg-white tracking-wider relative select-none whitespace-nowrap ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{
                              width: (columnWidths[colId] || 150) + 'px',
                              minWidth: (columnWidths[colId] || 150) + 'px',
                              background: dragOverColumn === colId ? '#f0f6ff' : 'white',
                              boxShadow: dragOverColumn === colId ? 'inset 2px 0 0 0 #60a5fa' : undefined,
                              borderBottom: '1px solid #e5e7eb',
                              position: 'relative',
                            }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, colId)}
                            onDragOver={(e) => handleDragOver(e, colId)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, colId)}
                          >
                            <span style={{fontWeight: 500}} className="whitespace-nowrap overflow-hidden text-ellipsis block">{col.label}</span>
                            {!isLast && (
                              <span
                                onMouseDown={e => handleResizeStart(e, colId)}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  height: '100%',
                                  width: 8,
                                  cursor: 'col-resize',
                                  zIndex: 10,
                                  userSelect: 'none',
                                  background: 'transparent',
                                  pointerEvents: 'auto',
                                  display: 'block',
                                }}
                                onClick={e => e.stopPropagation()}
                                title="Resize column"
                                tabIndex={-1}
                              ></span>
                            )}
                          </th>
                        );
                      })}
                      {(viewType === 'assigned' || viewType === 'admin') && (
                        <th key="actions" className="px-2 py-1 text-left text-sm font-normal bg-white tracking-wider select-none">Actions</th>
                      )}
                    </tr>
                    {groupTasks.map((task, idx) => (
                      <tr
                        key={task._id}
                        className={`border-b border-gray-200 hover:bg-gray-50 transition-none ${dragOverTaskId === task._id && draggedTaskId ? DRAG_ROW_CLASS : ''}`}
                        draggable
                        onDragStart={e => handleRowDragStart(e, task._id)}
                        onDragOver={e => handleRowDragOver(e, task._id)}
                        onDrop={e => handleRowDrop(e, task._id)}
                        onDragEnd={handleRowDragEnd}
                        style={{ opacity: draggedTaskId === task._id ? 0.5 : 1 }}
                      >
                        <td
                          className="px-2 py-1 text-sm font-normal align-middle bg-white border-r border-gray-200 text-gray-500 cursor-move"
                          style={{width: '48px', minWidth: '48px', textAlign: 'right'}}
                          title="Drag to reorder"
                          draggable
                          onDragStart={e => handleRowDragStart(e, task._id)}
                        >
                          {idx + 1}
                        </td>
                        {getOrderedVisibleColumns().map((colId, idx2, arr) => {
                          const col = ALL_COLUMNS.find(c => c.id === colId);
                          if (!col) return null;
                          const isLast = idx2 === arr.length - 1;
                          
                          switch (colId) {
                            case 'title':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{verticalAlign: 'middle', width: (columnWidths[colId] || 256) + 'px', minWidth: (columnWidths[colId] || 256) + 'px', maxWidth: (columnWidths[colId] || 256) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.title}</span></div></td>;
                            
                            case 'description':
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white border-0 ${!isLast ? 'border-r border-gray-200' : ''}`} style={{verticalAlign: 'middle', width: (columnWidths[colId] || 180) + 'px', minWidth: (columnWidths[colId] || 180) + 'px', maxWidth: (columnWidths[colId] || 180) + 'px', background: 'white', overflow: 'hidden'}}>
                                  {editingDescriptionTaskId === task._id ? (
                                    <input
                                      type="text"
                                      value={editingDescriptionValue}
                                      autoFocus
                                      onChange={e => setEditingDescriptionValue(e.target.value)}
                                      onBlur={() => handleDescriptionEditSave(task)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          handleDescriptionEditSave(task);
                                        }
                                      }}
                                      className="no-border-input w-full bg-white px-1 py-1 rounded"
                                      style={{fontSize: 'inherit', height: '28px'}}
                                    />
                                  ) : (
                                    <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                      <span
                                        className="cursor-pointer block"
                                        onClick={() => {
                                          setEditingDescriptionTaskId(task._id);
                                          setEditingDescriptionValue(task.description || '');
                                        }}
                                        title="Click to edit"
                                        style={{ minHeight: '14px', color: !task.description ? '#aaa' : undefined, fontSize: 'inherit' }}
                                      >
                                        {task.description && task.description.trim() !== '' ? task.description : <span style={{fontStyle: 'italic', fontSize: 'inherit'}}></span>}
                                      </span>
                                    </div>
                                  )}
                                </td>
                              );
                            
                            case 'clientName':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span className="text-sm font-medium text-gray-900">{task.clientName}</span></div></td>;
                            
                            case 'clientGroup':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span className="text-sm text-gray-500">{task.clientGroup}</span></div></td>;
                            
                            case 'workType':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex gap-1">{task.workType && task.workType.map((type, index) => (<span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">{type}</span>))}</div></div></td>;
                            
                            case 'workDoneBy':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.workDoneBy || 'NA'}</span></div></td>;
                            
                            case 'billed':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 80) + 'px', minWidth: (columnWidths[colId] || 80) + 'px', maxWidth: (columnWidths[colId] || 80) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.billed ? 'Yes' : 'No'}</span></div></td>;
                            
                            case 'status':
                              // Show colored status but disable interaction in 'Task Issued For Verification' and 'Task For Guidance' tabs in Received Tasks
                              if (
                                viewType === 'received' &&
                                (taskType === 'issuedVerification' || taskType === 'guidance' || taskType === 'completed')
                              ) {
                                return (
                                  <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                    style={{ width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden' }}>
                                  <div className="overflow-x-auto whitespace-nowrap" style={{ width: '100%', maxWidth: '100%' }}>
                                    <span className={`inline-block px-2 py-1 rounded-4xl text-xs font-semibold ${getStatusColor(task.status)}`}>{STATUS_OPTIONS.find(opt => opt.value === task.status)?.label || task.status}</span>
                                  </div>
                                </td>
                              );
                            }
                            return (
                              <td
                                key={colId}
                                className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                style={{
                                  width: (columnWidths[colId] || 120) + 'px',
                                  minWidth: (columnWidths[colId] || 120) + 'px',
                                  maxWidth: (columnWidths[colId] || 120) + 'px',
                                  background: 'white',
                                  overflow: 'visible',
                                  cursor: viewType === 'received' ? 'pointer' : 'default',
                                  position: 'relative',
                                  zIndex: editingStatusTaskId === task._id ? 50 : 'auto',
                                }}
                                onClick={e => {
                                  if (viewType === 'received') {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setDropdownPosition({
                                      top: rect.bottom + window.scrollY,
                                      left: rect.left + window.scrollX,
                                    });
                                    setEditingStatusTaskId(task._id);
                                  }
                                }}
                              >
                                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}
                                    style={{
                                      display: 'inline-block',
                                      whiteSpace: 'nowrap',
                                      overflowX: 'auto',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '100%',
                                      verticalAlign: 'middle',
                                      scrollbarWidth: 'thin',
                                      msOverflowStyle: 'auto',
                                    }}
                                    title={task.status.replace(/_/g, ' ')}
                                  >
                                    {task.status.replace(/_/g, ' ')}
                                  </span>
                                  {/* Show dropdown as portal if open */}
                                  {editingStatusTaskId === task._id && viewType === 'received'
                                    ? ReactDOM.createPortal(
                                        <div
                                          ref={statusDropdownRef}
                                          style={{
                                            position: 'absolute',
                                            top: dropdownPosition.top,
                                            left: dropdownPosition.left,
                                            minWidth: 160,
                                            background: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 8,
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                            padding: 8,
                                            zIndex: 9999,
                                          }}
                                        >
                                          {(
                                            viewType === 'received' && taskType === 'execution'
                                              ? STATUS_OPTIONS.filter(opt => opt.value !== 'reject')
                                              : STATUS_OPTIONS
                                          ).map(opt => (
                                            <div
                                              key={opt.value}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '5px 12px',
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                background: task.status === opt.value ? '#f3f4f6' : 'transparent',
                                                marginBottom: 2,
                                                transition: 'background 0.15s',
                                                opacity: statusLoading ? 0.6 : 1,
                                              }}
                                              onClick={e => {
                                                e.stopPropagation();
                                                if (!statusLoading && task.status !== opt.value) handleStatusChangeLocal(task, opt.value);
                                                setEditingStatusTaskId(null);
                                              }}
                                              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                              onMouseLeave={e => e.currentTarget.style.background = task.status === opt.value ? '#f3f4f6' : 'transparent'}
                                            >
                                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(opt.value)}`}>{opt.label}</span>
                                              {task.status === opt.value && (
                                                <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </div>
                                          ))}
                                        </div>,
                                        document.body
                                      )
                                    : null}
                                </div>
                              </td>
                            );
                          
                            case 'priority':
                              // Only allow editing if not in guidance or issuedVerification tab
                              const canEditPriority = viewType === 'received' && (taskType === 'execution' || taskType === 'receivedVerification');
                              return (
                                <td
                                  key={colId}
                                  className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{
                                    width: (columnWidths[colId] || 120) + 'px',
                                    minWidth: (columnWidths[colId] || 120) + 'px',
                                    maxWidth: (columnWidths[colId] || 120) + 'px',
                                    background: 'white',
                                    overflow: 'visible',
                                    cursor: canEditPriority ? 'pointer' : 'default',
                                    position: 'relative',
                                    zIndex: editingPriorityTaskId === task._id ? 50 : 'auto',
                                  }}
                                  onClick={e => {
                                    if (canEditPriority) {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setDropdownPosition({
                                        top: rect.bottom + window.scrollY,
                                        left: rect.left + window.scrollX,
                                      });
                                      setEditingPriorityTaskId(task._id);
                                    }
                                  }}
                                >
                                  <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                    <span className={`inline-block px-2 py-1 rounded-4xl text-xs font-semibold ${getPriorityColor(task.priority)}`}>{PRIORITY_OPTIONS.find(opt => opt.value === task.priority)?.label || task.priority}</span>
                                  </div>
                                  {/* Show dropdown as portal if open and canEditPriority */}
                                  {editingPriorityTaskId === task._id && canEditPriority && ReactDOM.createPortal(
                                    <div
                                      ref={priorityDropdownRef}
                                      style={{
                                        position: 'absolute',
                                        top: dropdownPosition.top,
                                        left: dropdownPosition.left,
                                        minWidth: 160,
                                        background: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                        padding: 8,
                                        zIndex: 9999,
                                      }}
                                    >
                                      {PRIORITY_OPTIONS.map(opt => (
                                        <div
                                          key={opt.value}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '5px 12px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            background: task.priority === opt.value ? '#f3f4f6' : 'transparent',
                                            marginBottom: 2,
                                            transition: 'background 0.15s',
                                            opacity: priorityLoading ? 0.6 : 1,
                                          }}
                                          onClick={e => {
                                            e.stopPropagation();
                                            if (!priorityLoading && task.priority !== opt.value) handlePriorityChange(task, opt.value);
                                            setEditingPriorityTaskId(null);
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                          onMouseLeave={e => e.currentTarget.style.background = task.priority === opt.value ? '#f3f4f6' : 'transparent'}
                                        >
                                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(opt.value)}`}>{opt.label}</span>
                                          {task.priority === opt.value && (
                                            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                          )}
                                        </div>
                                      ))}
                                    </div>,
                                    document.body
                                  )}
                                </td>
                              );
                            
                            case 'selfVerification':
                              const canEditSelfVerification = viewType === 'received' && taskType === 'execution';
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                                <div className="flex justify-center items-center">
                                  <input
                                    type="checkbox"
                                    checked={!!task.selfVerification}
                                    disabled={!canEditSelfVerification}
                                    onChange={canEditSelfVerification ? async (e) => {
                                      const checked = e.target.checked;
                                      try {
                                        const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${user.token}`,
                                          },
                                          body: JSON.stringify({ selfVerification: checked }),
                                        });
                                        if (!response.ok) throw new Error('Failed to update self verification');
                                        const updatedTask = await response.json();
                                        if (onTaskUpdate) onTaskUpdate(task._id, () => updatedTask);
                                        toast.success('Self Verification updated');
                                      } catch (err) {
                                        toast.error('Failed to update Self Verification');
                                      }
                                    } : undefined}
                                  />
                                </div>
                              </td>
                            );
                          
                            case 'inwardEntryDate':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDateTime(task.inwardEntryDate)}</span></div></td>;
                          
                            case 'dueDate':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDate(task.dueDate)}</span></div></td>;
                          
                            case 'targetDate':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDate(task.targetDate)}</span></div></td>;
                          
                            case 'assignedBy':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex items-center"><img src={task.assignedBy.photo?.url || defaultProfile} alt={task.assignedBy.firstName} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} /><span className="ml-2">{task.assignedBy.firstName} {task.assignedBy.lastName}</span></div></div></td>;
                          
                            case 'assignedTo':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex items-center"><img src={task.assignedTo.photo?.url || defaultProfile} alt={task.assignedTo.firstName} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} /><span className="ml-2">{task.assignedTo.firstName} {task.assignedTo.lastName}<span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">{getUserTaskHours(task._id, task.assignedTo._id)}h</span></span></div></div></td>;
                          
                            case 'verificationAssignedTo':
                            case 'secondVerificationAssignedTo':
                            case 'thirdVerificationAssignedTo':
                            case 'fourthVerificationAssignedTo':
                            case 'fifthVerificationAssignedTo': {
                              // Map column to index (0-based)
                              const verifierFields = [
                                'verificationAssignedTo',
                                'secondVerificationAssignedTo',
                                'thirdVerificationAssignedTo',
                                'fourthVerificationAssignedTo',
                                'fifthVerificationAssignedTo',
                              ];
                              const colIdx = verifierFields.indexOf(colId);
                              const currVerifierField = verifierFields[colIdx];
                              const prevVerifierField = verifierFields[colIdx - 1];

                              // Show dropdown if:
                              // 1. For first verifier: selfVerification must be true (for execution tab)
                              // 2. For receivedVerification tab: if current user is the first verifier, allow dropdown
                              // 3. Current user is the assigned verifier for this column (nth)
                              // 4. OR, current user is the previous verifier and this column is unassigned (N+1th)
                              let userIsThisVerifier = task[currVerifierField]?._id === currentUser?._id;
                              let userIsPrevVerifier = colIdx > 0 && task[prevVerifierField]?._id === currentUser?._id && !task[currVerifierField];
                              let canEditThisVerifier =
                                viewType === 'received' &&
                                (userIsThisVerifier || userIsPrevVerifier) &&
                                taskType !== 'completed' &&
                                taskType !== 'guidance' &&
                                taskType !== 'issuedVerification';
                              // For first verifier, require selfVerification (for execution tab)
                              if (colId === 'verificationAssignedTo') {
                                canEditThisVerifier =
                                  (viewType === 'received' && taskType === 'execution' && !!task.selfVerification)
                                  || (viewType === 'received' && taskType === 'receivedVerification' && userIsThisVerifier)
                                  || (viewType === 'received' && taskType === 'issuedVerification' && task.assignedBy && task.assignedBy._id === currentUser?._id);
                              }

                              // Exclude assignedTo and all already assigned verifiers
                              const assignedVerifierIds = getAssignedVerifierIds(task);
                              const dropdownUsers = users.filter(
                                (u) =>
                                  u._id !== task.assignedTo?._id &&
                                  !assignedVerifierIds.includes(u._id) &&
                                  u._id !== currentUser?._id &&
                                  (`${u.firstName} ${u.lastName}`.toLowerCase().includes(verifierSearch.toLowerCase()))
                              );

                              if (canEditThisVerifier) {
                                return (
                                  <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                    style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden', cursor: 'pointer', position: 'relative', zIndex: editingVerifierTaskId === `${task._id}-${colId}` ? 50 : 'auto'}}
                                    onClick={e => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setVerifierDropdownPosition({
                                        top: rect.bottom + window.scrollY,
                                        left: rect.left + window.scrollX,
                                      });
                                      setEditingVerifierTaskId(`${task._id}-${colId}`);
                                      setVerifierSearch('');
                                    }}
                                  >
                                    <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                      <div className="flex items-center ">
                                        {task[colId] ? (
                                          <>
                                            <img
                                              src={task[colId].photo?.url || defaultProfile}
                                              alt={`${task[colId].firstName} ${task[colId].lastName}`}
                                              className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                                              onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }}
                                            />
                                            <span className="ml-2">
                                              {task[colId].firstName} {task[colId].lastName}
                                              <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                                {getUserTaskHours(task._id, task[colId]._id)}h
                                              </span>
                                            </span>
                                          </>
                                        ) : (
                                          <span style={{fontStyle: 'italic', fontSize: 'inherit'}}>NA</span>
                                        )}
                                        <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="ml-1 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                      </div>
                                      {/* Dropdown for selecting verifier */}
                                      {editingVerifierTaskId === `${task._id}-${colId}` && ReactDOM.createPortal(
                                        <div
                                          ref={verifierDropdownRef}
                                          style={{
                                            position: 'absolute',
                                            top: verifierDropdownPosition.top,
                                            left: verifierDropdownPosition.left,
                                            minWidth: 200,
                                            background: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 8,
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                            padding: 8,
                                            zIndex: 9999,
                                            maxHeight: 300,
                                            overflowY: 'auto',
                                          }}
                                        >
                                          {dropdownUsers.length === 0 ? (
                                            <div className="text-gray-400 text-sm px-2 py-2">No users found</div>
                                          ) : (
                                            dropdownUsers.map(u => (
                                              <div
                                                key={u._id}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 8,
                                                  padding: '6px 8px',
                                                  borderRadius: 6,
                                                  cursor: 'pointer',
                                                  background: task[colId] && task[colId]._id === u._id ? '#f3f4f6' : 'transparent',
                                                  marginBottom: 2,
                                                  transition: 'background 0.15s',
                                                  opacity: verifierLoading ? 0.6 : 1,
                                                }}
                                                onClick={async e => {
                                                  e.stopPropagation();
                                                  if (verifierLoading || (task[colId] && task[colId]._id === u._id)) return;
                                                  setVerifierLoading(true);
                                                  try {
                                                    const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/verifier`, {
                                                      method: 'PATCH',
                                                      headers: {
                                                        'Content-Type': 'application/json',
                                                        Authorization: `Bearer ${currentUser.token}`,
                                                      },
                                                      body: JSON.stringify({ [colId]: u._id }),
                                                    });
                                                    if (!response.ok) throw new Error('Failed to update verifier');
                                                    const updatedTask = await response.json();
                                                    if (onTaskUpdate) onTaskUpdate(task._id, () => updatedTask);
                                                    toast.success(`${col.label} updated`);
                                                    if (refetchTasks) refetchTasks();
                                                  } catch (err) {
                                                    toast.error(`Failed to update ${col.label.toLowerCase()}`);
                                                  }
                                                  setVerifierLoading(false);
                                                  setEditingVerifierTaskId(null);
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                                onMouseLeave={e => e.currentTarget.style.background = (task[colId] && task[colId]._id === u._id) ? '#f3f4f6' : 'transparent'}
                                              >
                                                <img src={u.photo?.url || defaultProfile} alt={`${u.firstName} ${u.lastName}`} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" style={{minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24}} />
                                                <span style={{fontSize: '14px'}}>{u.firstName} {u.lastName}</span>
                                                {task[colId] && task[colId]._id === u._id && (
                                                  <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                )}
                                              </div>
                                            ))
                                          )}
                                        </div>,
                                        document.body
                                      )}
                                    </div>
                                  </td>
                                );
                              }
                              // Otherwise, just show the value
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}>
                                  <div className="overflow-x-auto whitespace-nowrap flex items-center" style={{width: '100%', maxWidth: '100%'}}>
                                    {task[colId] ? (
                                      <>
                                        <img src={task[colId].photo?.url || defaultProfile} alt={`${task[colId].firstName} ${task[colId].lastName}`} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                                        <span className="ml-2">
                                          {task[colId].firstName} {task[colId].lastName}
                                          <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                            {getUserTaskHours(task._id, task[colId]._id)}h
                                          </span>
                                        </span>
                                      </>
                                    ) : (
                                      <span style={{fontStyle: 'italic', fontSize: 'inherit'}}>NA</span>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            case 'guides':
                              const guideChipsClass = viewType === 'received' ? 'pr-6' : 'pr-0';
                              const guideChipsMaxWidth = viewType === 'received' ? 'calc(100% - 28px)' : '100%';
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{width: (columnWidths[colId] || 200) + 'px', minWidth: (columnWidths[colId] || 200) + 'px', maxWidth: (columnWidths[colId] || 200) + 'px', background: 'white', overflow: 'hidden'}}>
                                <div className="flex items-center relative" style={{width: '100%', maxWidth: '100%'}}>
                                  {/* Scrollable chips */}
                                  <div className={`flex items-center gap-1 overflow-x-auto whitespace-nowrap ${guideChipsClass}`} style={{maxWidth: guideChipsMaxWidth}}>
                                    {Array.isArray(task.guides) && task.guides.length > 0 ? (
                                      task.guides.map(u => (
                                        <span key={u._id} className="flex items-center bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs font-medium mr-1">
                                          <img src={u.photo?.url || defaultProfile} alt={u.firstName} className="w-5 h-5 rounded-full object-cover mr-1" style={{minWidth: 20, minHeight: 20}} onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} />
                                          {u.firstName} {u.lastName}
                                          {viewType === 'received' && (
                                            <button
                                              className="ml-1 text-red-500 hover:text-red-700 focus:outline-none"
                                              style={{fontSize: '12px'}}
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const newGuides = task.guides.filter(g => g._id !== u._id).map(g => g._id);
                                                try {
                                                  const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/guides`, {
                                                    method: 'PUT',
                                                    headers: {
                                                      'Content-Type': 'application/json',
                                                      Authorization: `Bearer ${currentUser.token}`,
                                                    },
                                                    body: JSON.stringify({ guides: newGuides }),
                                                  });
                                                  if (!response.ok) throw new Error('Failed to update guides');
                                                  const updatedTask = await response.json();
                                                  if (onTaskUpdate) onTaskUpdate(task._id, (prevTask) => ({ ...prevTask, guides: updatedTask.guides }));
                                                  toast.success('Guide removed');
                                                } catch (err) {
                                                  toast.error('Failed to update guides');
                                                }
                                              }}
                                              title="Remove guide"
                                            >×</button>
                                          )}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="italic text-gray-400">No guide</span>
                                    )}
                                  </div>
                                  {/* Fixed dropdown icon at end, only in received viewType */}
                                  {viewType === 'received' && (
                                    <button
                                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-white rounded-full border border-gray-200 hover:bg-blue-100 hover:border-blue-400 transition-colors cursor-pointer z-10"
                                      style={{boxShadow: '0 1px 4px rgba(0,0,0,0.04)'}}
                                      onClick={e => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDropdownPosition({
                                          top: rect.bottom + window.scrollY,
                                          left: rect.left + window.scrollX,
                                        });
                                        setOpenGuideDropdownTaskId(task._id);
                                      }}
                                      title="Add/Remove Guides"
                                    >
                                      <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="text-gray-500 group-hover:text-blue-600 transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                  )}
                                  {/* Dropdown for selecting guides */}
                                  {viewType === 'received' && openGuideDropdownTaskId === task._id && ReactDOM.createPortal(
                                    <div
                                      ref={guideDropdownRef}
                                      style={{
                                        position: 'absolute',
                                        top: dropdownPosition.top,
                                        left: dropdownPosition.left,
                                        minWidth: 220,
                                        background: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                        padding: 8,
                                        zIndex: 9999,
                                        maxHeight: 300,
                                        overflowY: 'auto',
                                      }}
                                    >
                                      {users.filter(u => !task.guides?.some(g => g._id === u._id)).length === 0 ? (
                                        <div className="text-gray-400 text-sm px-2 py-2">No users available</div>
                                      ) : (
                                        users.filter(u => !task.guides?.some(g => g._id === u._id)).map(u => (
                                          <div
                                            key={u._id}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 8,
                                              padding: '6px 8px',
                                              borderRadius: 6,
                                              cursor: 'pointer',
                                              background: 'transparent',
                                              marginBottom: 2,
                                              transition: 'background 0.15s',
                                            }}
                                            onClick={async e => {
                                              e.stopPropagation();
                                              const newGuides = [...(task.guides?.map(g => g._id) || []), u._id];
                                              try {
                                                const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/guides`, {
                                                  method: 'PUT',
                                                  headers: {
                                                    'Content-Type': 'application/json',
                                                    Authorization: `Bearer ${currentUser.token}`,
                                                  },
                                                  body: JSON.stringify({ guides: newGuides }),
                                                });
                                                if (!response.ok) throw new Error('Failed to update guides');
                                                const updatedTask = await response.json();
                                                if (onTaskUpdate) onTaskUpdate(task._id, (prevTask) => ({ ...prevTask, guides: updatedTask.guides }));
                                                toast.success('Guide added');
                                              } catch (err) {
                                                toast.error('Failed to update guides');
                                              }
                                            }}
                                          >
                                            <img src={u.photo?.url || defaultProfile} alt={`${u.firstName} ${u.lastName}`} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" style={{minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24}} />
                                            <span style={{fontSize: '14px'}}>{u.firstName} {u.lastName}</span>
                                          </div>
                                        ))
                                      )}
                                    </div>,
                                    document.body
                                  )}
                                </div>
                              </td>
                            );
                          
                            case 'files':
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                                  <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                    <div className="flex items-center">
                                      {task.files && task.files.length > 0 ? (
                                        <div className="flex items-center space-x-2">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.files.length}</span>
                                          <button onClick={() => handleTaskClick(task)} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <span className="text-gray-400 text-sm italic">No files</span>
                                          <button onClick={() => handleTaskClick(task)} className="ml-2 text-blue-600 hover:text-blue-800 text-sm">Upload</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            
                            case 'comments':
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                                  <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.comments ? task.comments.length : 0} </span>
                                      <button onClick={() => { setSelectedTask(task); setShowComments(true); }} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                                    </div>
                                  </div>
                                </td>
                              );
                            
                            default:
                              let cellValue = task[colId];
                              if ([
                                'thirdVerificationAssignedTo',
                                'fourthVerificationAssignedTo',
                                'fifthVerificationAssignedTo'
                              ].includes(colId)) {
                                cellValue = cellValue ? (cellValue.firstName ? `${cellValue.firstName} ${cellValue.lastName}` : cellValue) : 'NA';
                              }
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{cellValue}</span></div></td>;
                          }
                        })}
                        {(viewType === 'assigned' || viewType === 'admin') && (
                          <td key="actions" className="px-2 py-1 text-sm font-normal align-middle bg-white">
                            {(!shouldDisableActions || !shouldDisableActions(task)) && (
                              <div className="flex items-center gap-0">
                                {/* Role-based action buttons */}
                                {['Team Head', 'Admin', 'Senior'].includes(currentUser?.role) && (
                                  <button
                                    onClick={() => onEditTask && onEditTask(task)}
                                    className="text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 text-xs font-semibold transition-colors"
                                    title="Edit Task"
                                  >
                                    Edit
                                  </button>
                                )}
                                {['Team Head', 'Admin'].includes(currentUser?.role) && (
                                  <button
                                    onClick={() => handleDeleteTask(task)}
                                    className="text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1 text-xs font-semibold transition-colors"
                                    title="Delete Task"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                orderedTasks.map((task, idx) => (
                  <tr
                    key={task._id}
                    className={`border-b border-gray-200 hover:bg-gray-50 transition-none ${dragOverTaskId === task._id && draggedTaskId ? DRAG_ROW_CLASS : ''}`}
                    draggable
                    onDragStart={e => handleRowDragStart(e, task._id)}
                    onDragOver={e => handleRowDragOver(e, task._id)}
                    onDrop={e => handleRowDrop(e, task._id)}
                    onDragEnd={handleRowDragEnd}
                    style={{ opacity: draggedTaskId === task._id ? 0.5 : 1 }}
                  >
                    <td
                      className="px-2 py-1 text-sm font-normal align-middle bg-white border-r border-gray-200 text-gray-500 cursor-move"
                      style={{width: '48px', minWidth: '48px', textAlign: 'right'}}
                      title="Drag to reorder"
                      draggable
                      onDragStart={e => handleRowDragStart(e, task._id)}
                    >
                      {idx + 1}
                    </td>
                    {getOrderedVisibleColumns().map((colId, idx2, arr) => {
                      const col = ALL_COLUMNS.find(c => c.id === colId);
                      if (!col) return null;
                      const isLast = idx2 === arr.length - 1;
                      
                      switch (colId) {
                        case 'title':
                          return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{verticalAlign: 'middle', width: (columnWidths[colId] || 256) + 'px', minWidth: (columnWidths[colId] || 256) + 'px', maxWidth: (columnWidths[colId] || 256) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.title}</span></div></td>;
                      
                        case 'description':
                          return (
                            <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white border-0 ${!isLast ? 'border-r border-gray-200' : ''}`} style={{verticalAlign: 'middle', width: (columnWidths[colId] || 180) + 'px', minWidth: (columnWidths[colId] || 180) + 'px', maxWidth: (columnWidths[colId] || 180) + 'px', background: 'white', overflow: 'hidden'}}>
                              {editingDescriptionTaskId === task._id ? (
                                <input
                                  type="text"
                                  value={editingDescriptionValue}
                                  autoFocus
                                  onChange={e => setEditingDescriptionValue(e.target.value)}
                                  onBlur={() => handleDescriptionEditSave(task)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleDescriptionEditSave(task);
                                    }
                                  }}
                                  className="no-border-input w-full bg-white px-1 py-1 rounded"
                                  style={{fontSize: 'inherit', height: '28px'}}
                                />
                              ) : (
                                <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                  <span
                                    className="cursor-pointer block"
                                    onClick={() => {
                                      setEditingDescriptionTaskId(task._id);
                                      setEditingDescriptionValue(task.description || '');
                                    }}
                                    title="Click to edit"
                                    style={{ minHeight: '14px', color: !task.description ? '#aaa' : undefined, fontSize: 'inherit' }}
                                  >
                                    {task.description && task.description.trim() !== '' ? task.description : <span style={{fontStyle: 'italic', fontSize: 'inherit'}}></span>}
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                      
                      case 'clientName':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span className="text-sm font-medium text-gray-900">{task.clientName}</span></div></td>;
                      
                      case 'clientGroup':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span className="text-sm text-gray-500">{task.clientGroup}</span></div></td>;
                      
                      case 'workType':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex gap-1">{task.workType && task.workType.map((type, index) => (<span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">{type}</span>))}</div></div></td>;
                      
                      case 'workDoneBy':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.workDoneBy || 'NA'}</span></div></td>;
                      
                      case 'billed':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 80) + 'px', minWidth: (columnWidths[colId] || 80) + 'px', maxWidth: (columnWidths[colId] || 80) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.billed ? 'Yes' : 'No'}</span></div></td>;
                      
                      case 'status':
                        // Show colored status but disable interaction in 'Task Issued For Verification' and 'Task For Guidance' tabs in Received Tasks
                        if (
                          viewType === 'received' &&
                          (taskType === 'issuedVerification' || taskType === 'guidance' || taskType === 'completed')
                        ) {
                          return (
                            <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                              style={{ width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden' }}>
                              <div className="overflow-x-auto whitespace-nowrap" style={{ width: '100%', maxWidth: '100%' }}>
                                <span className={`inline-block px-2 py-1 rounded-4xl text-xs font-semibold ${getStatusColor(task.status)}`}>{STATUS_OPTIONS.find(opt => opt.value === task.status)?.label || task.status}</span>
                              </div>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={colId}
                            className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{
                              width: (columnWidths[colId] || 120) + 'px',
                              minWidth: (columnWidths[colId] || 120) + 'px',
                              maxWidth: (columnWidths[colId] || 120) + 'px',
                              background: 'white',
                              overflow: 'visible',
                              cursor: viewType === 'received' ? 'pointer' : 'default',
                              position: 'relative',
                              zIndex: editingStatusTaskId === task._id ? 50 : 'auto',
                            }}
                            onClick={e => {
                              if (viewType === 'received') {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.left + window.scrollX,
                                });
                                setEditingStatusTaskId(task._id);
                              }
                            }}
                          >
                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}
                                style={{
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap',
                                  overflowX: 'auto',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                  verticalAlign: 'middle',
                                  scrollbarWidth: 'thin',
                                  msOverflowStyle: 'auto',
                                }}
                                title={task.status.replace(/_/g, ' ')}
                              >
                                {task.status.replace(/_/g, ' ')}
                              </span>
                              {/* Show dropdown as portal if open */}
                              {editingStatusTaskId === task._id && viewType === 'received'
                                ? ReactDOM.createPortal(
                                    <div
                                      ref={statusDropdownRef}
                                      style={{
                                        position: 'absolute',
                                        top: dropdownPosition.top,
                                        left: dropdownPosition.left,
                                        minWidth: 160,
                                        background: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                        padding: 8,
                                        zIndex: 9999,
                                      }}
                                    >
                                      {(
                                        viewType === 'received' && taskType === 'execution'
                                          ? STATUS_OPTIONS.filter(opt => opt.value !== 'reject')
                                          : STATUS_OPTIONS
                                      ).map(opt => (
                                        <div
                                          key={opt.value}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '5px 12px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            background: task.status === opt.value ? '#f3f4f6' : 'transparent',
                                            marginBottom: 2,
                                            transition: 'background 0.15s',
                                            opacity: statusLoading ? 0.6 : 1,
                                          }}
                                          onClick={e => {
                                            e.stopPropagation();
                                            if (!statusLoading && task.status !== opt.value) handleStatusChangeLocal(task, opt.value);
                                            setEditingStatusTaskId(null);
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                          onMouseLeave={e => e.currentTarget.style.background = task.status === opt.value ? '#f3f4f6' : 'transparent'}
                                        >
                                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(opt.value)}`}>{opt.label}</span>
                                          {task.status === opt.value && (
                                            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </div>
                                      ))}
                                    </div>,
                                    document.body
                                  )
                                : null}
                            </div>
                          </td>
                        );
                      
                      case 'priority':
                        // Only allow editing if not in guidance or issuedVerification tab
                        const canEditPriority = viewType === 'received' && (taskType === 'execution' || taskType === 'receivedVerification');
                        return (
                          <td
                            key={colId}
                            className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{
                              width: (columnWidths[colId] || 120) + 'px',
                              minWidth: (columnWidths[colId] || 120) + 'px',
                              maxWidth: (columnWidths[colId] || 120) + 'px',
                              background: 'white',
                              overflow: 'visible',
                              cursor: canEditPriority ? 'pointer' : 'default',
                              position: 'relative',
                              zIndex: editingPriorityTaskId === task._id ? 50 : 'auto',
                            }}
                            onClick={e => {
                              if (canEditPriority) {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.left + window.scrollX,
                                });
                                setEditingPriorityTaskId(task._id);
                              }
                            }}
                          >
                            <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                              <span className={`inline-block px-2 py-1 rounded-4xl text-xs font-semibold ${getPriorityColor(task.priority)}`}>{PRIORITY_OPTIONS.find(opt => opt.value === task.priority)?.label || task.priority}</span>
                            </div>
                            {/* Show dropdown as portal if open and canEditPriority */}
                            {editingPriorityTaskId === task._id && canEditPriority && ReactDOM.createPortal(
                              <div
                                ref={priorityDropdownRef}
                                style={{
                                  position: 'absolute',
                                  top: dropdownPosition.top,
                                  left: dropdownPosition.left,
                                  minWidth: 160,
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 8,
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                  padding: 8,
                                  zIndex: 9999,
                                }}
                              >
                                {PRIORITY_OPTIONS.map(opt => (
                                  <div
                                    key={opt.value}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      background: task.priority === opt.value ? '#f3f4f6' : 'transparent',
                                      marginBottom: 2,
                                      transition: 'background 0.15s',
                                      opacity: priorityLoading ? 0.6 : 1,
                                    }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (!priorityLoading && task.priority !== opt.value) handlePriorityChange(task, opt.value);
                                      setEditingPriorityTaskId(null);
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                    onMouseLeave={e => e.currentTarget.style.background = task.priority === opt.value ? '#f3f4f6' : 'transparent'}
                                  >
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(opt.value)}`}>{opt.label}</span>
                                    {task.priority === opt.value && (
                                      <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    )}
                                  </div>
                                ))}
                              </div>,
                              document.body
                            )}
                          </td>
                        );
                      
                      case 'selfVerification':
                        const canEditSelfVerification = viewType === 'received' && taskType === 'execution';
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                            <div className="flex justify-center items-center">
                              <input
                                type="checkbox"
                                checked={!!task.selfVerification}
                                disabled={!canEditSelfVerification}
                                onChange={canEditSelfVerification ? async (e) => {
                                  const checked = e.target.checked;
                                  try {
                                    const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}`, {
                                      method: 'PUT',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${user.token}`,
                                      },
                                      body: JSON.stringify({ selfVerification: checked }),
                                    });
                                    if (!response.ok) throw new Error('Failed to update self verification');
                                    const updatedTask = await response.json();
                                    if (onTaskUpdate) onTaskUpdate(task._id, () => updatedTask);
                                    toast.success('Self Verification updated');
                                  } catch (err) {
                                    toast.error('Failed to update Self Verification');
                                  }
                                } : undefined}
                              />
                            </div>
                          </td>
                        );
                      
                      case 'inwardEntryDate':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDateTime(task.inwardEntryDate)}</span></div></td>;
                      
                      case 'dueDate':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDate(task.dueDate)}</span></div></td>;
                      
                      case 'targetDate':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDate(task.targetDate)}</span></div></td>;
                      
                      case 'assignedBy':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex items-center"><img src={task.assignedBy.photo?.url || defaultProfile} alt={task.assignedBy.firstName} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} /><span className="ml-2">{task.assignedBy.firstName} {task.assignedBy.lastName}</span></div></div></td>;
                      
                      case 'assignedTo':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex items-center"><img src={task.assignedTo.photo?.url || defaultProfile} alt={task.assignedTo.firstName} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} /><span className="ml-2">{task.assignedTo.firstName} {task.assignedTo.lastName}<span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">{getUserTaskHours(task._id, task.assignedTo._id)}h</span></span></div></div></td>;
                      
                      case 'verificationAssignedTo':
                      case 'secondVerificationAssignedTo':
                      case 'thirdVerificationAssignedTo':
                      case 'fourthVerificationAssignedTo':
                      case 'fifthVerificationAssignedTo': {
                        // Map column to index (0-based)
                        const verifierFields = [
                          'verificationAssignedTo',
                          'secondVerificationAssignedTo',
                          'thirdVerificationAssignedTo',
                          'fourthVerificationAssignedTo',
                          'fifthVerificationAssignedTo',
                        ];
                        const colIdx = verifierFields.indexOf(colId);
                        const currVerifierField = verifierFields[colIdx];
                        const prevVerifierField = verifierFields[colIdx - 1];

                        // Show dropdown if:
                        // 1. For first verifier: selfVerification must be true (for execution tab)
                        // 2. For receivedVerification tab: if current user is the first verifier, allow dropdown
                        // 3. Current user is the assigned verifier for this column (nth)
                        // 4. OR, current user is the previous verifier and this column is unassigned (N+1th)
                        let userIsThisVerifier = task[currVerifierField]?._id === currentUser?._id;
                        let userIsPrevVerifier = colIdx > 0 && task[prevVerifierField]?._id === currentUser?._id && !task[currVerifierField];
                        let canEditThisVerifier =
                          viewType === 'received' &&
                          (userIsThisVerifier || userIsPrevVerifier) &&
                          taskType !== 'completed' &&
                          taskType !== 'guidance' &&
                          taskType !== 'issuedVerification';
                        // For first verifier, require selfVerification (for execution tab)
                        if (colId === 'verificationAssignedTo') {
                          canEditThisVerifier =
                            (viewType === 'received' && taskType === 'execution' && !!task.selfVerification)
                            || (viewType === 'received' && taskType === 'receivedVerification' && userIsThisVerifier)
                            || (viewType === 'received' && taskType === 'issuedVerification' && task.assignedBy && task.assignedBy._id === currentUser?._id);
                        }

                        // Exclude assignedTo and all already assigned verifiers
                        const assignedVerifierIds = getAssignedVerifierIds(task);
                        const dropdownUsers = users.filter(
                          (u) =>
                            u._id !== task.assignedTo?._id &&
                            !assignedVerifierIds.includes(u._id) &&
                            u._id !== currentUser?._id &&
                            (`${u.firstName} ${u.lastName}`.toLowerCase().includes(verifierSearch.toLowerCase()))
                        );

                        if (canEditThisVerifier) {
                          return (
                            <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                              style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden', cursor: 'pointer', position: 'relative', zIndex: editingVerifierTaskId === `${task._id}-${colId}` ? 50 : 'auto'}}
                              onClick={e => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setVerifierDropdownPosition({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.left + window.scrollX,
                                });
                                setEditingVerifierTaskId(`${task._id}-${colId}`);
                                setVerifierSearch('');
                              }}
                            >
                              <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                <div className="flex items-center ">
                                  {task[colId] ? (
                                    <>
                                      <img
                                        src={task[colId].photo?.url || defaultProfile}
                                        alt={`${task[colId].firstName} ${task[colId].lastName}`}
                                        className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                                        onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }}
                                      />
                                      <span className="ml-2">
                                        {task[colId].firstName} {task[colId].lastName}
                                        <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                          {getUserTaskHours(task._id, task[colId]._id)}h
                                        </span>
                                      </span>
                                    </>
                                  ) : (
                                    <span style={{fontStyle: 'italic', fontSize: 'inherit'}}>NA</span>
                                  )}
                                  <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="ml-1 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                                {/* Dropdown for selecting verifier */}
                                {editingVerifierTaskId === `${task._id}-${colId}` && ReactDOM.createPortal(
                                  <div
                                    ref={verifierDropdownRef}
                                    style={{
                                      position: 'absolute',
                                      top: verifierDropdownPosition.top,
                                      left: verifierDropdownPosition.left,
                                      minWidth: 200,
                                      background: '#fff',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: 8,
                                      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                      padding: 8,
                                      zIndex: 9999,
                                      maxHeight: 300,
                                      overflowY: 'auto',
                                    }}
                                  >
                                    {dropdownUsers.length === 0 ? (
                                      <div className="text-gray-400 text-sm px-2 py-2">No users found</div>
                                    ) : (
                                      dropdownUsers.map(u => (
                                        <div
                                          key={u._id}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '6px 8px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            background: task[colId] && task[colId]._id === u._id ? '#f3f4f6' : 'transparent',
                                            marginBottom: 2,
                                            transition: 'background 0.15s',
                                            opacity: verifierLoading ? 0.6 : 1,
                                          }}
                                          onClick={async e => {
                                            e.stopPropagation();
                                            if (verifierLoading || (task[colId] && task[colId]._id === u._id)) return;
                                            setVerifierLoading(true);
                                            try {
                                              const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/verifier`, {
                                                method: 'PATCH',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  Authorization: `Bearer ${currentUser.token}`,
                                                },
                                                body: JSON.stringify({ [colId]: u._id }),
                                              });
                                              if (!response.ok) throw new Error('Failed to update verifier');
                                              const updatedTask = await response.json();
                                              if (onTaskUpdate) onTaskUpdate(task._id, () => updatedTask);
                                              toast.success(`${col.label} updated`);
                                              if (refetchTasks) refetchTasks();
                                            } catch (err) {
                                              toast.error(`Failed to update ${col.label.toLowerCase()}`);
                                            }
                                            setVerifierLoading(false);
                                            setEditingVerifierTaskId(null);
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                          onMouseLeave={e => e.currentTarget.style.background = (task[colId] && task[colId]._id === u._id) ? '#f3f4f6' : 'transparent'}
                                        >
                                          <img src={u.photo?.url || defaultProfile} alt={`${u.firstName} ${u.lastName}`} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" style={{minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24}} />
                                          <span style={{fontSize: '14px'}}>{u.firstName} {u.lastName}</span>
                                          {task[colId] && task[colId]._id === u._id && (
                                            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>,
                                  document.body
                                )}
                              </div>
                            </td>
                          );
                        }
                        // Otherwise, just show the value
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}>
                            <div className="overflow-x-auto whitespace-nowrap flex items-center" style={{width: '100%', maxWidth: '100%'}}>
                              {task[colId] ? (
                                <>
                                  <img src={task[colId].photo?.url || defaultProfile} alt={`${task[colId].firstName} ${task[colId].lastName}`} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                                  <span className="ml-2">
                                    {task[colId].firstName} {task[colId].lastName}
                                    <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                      {getUserTaskHours(task._id, task[colId]._id)}h
                                    </span>
                                  </span>
                                </>
                              ) : (
                                <span style={{fontStyle: 'italic', fontSize: 'inherit'}}>NA</span>
                              )}
                            </div>
                          </td>
                        );
                      }
                      case 'guides':
                        const guideChipsClass = viewType === 'received' ? 'pr-6' : 'pr-0';
                        const guideChipsMaxWidth = viewType === 'received' ? 'calc(100% - 28px)' : '100%';
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{width: (columnWidths[colId] || 200) + 'px', minWidth: (columnWidths[colId] || 200) + 'px', maxWidth: (columnWidths[colId] || 200) + 'px', background: 'white', overflow: 'hidden'}}>
                          <div className="flex items-center relative" style={{width: '100%', maxWidth: '100%'}}>
                            {/* Scrollable chips */}
                            <div className={`flex items-center gap-1 overflow-x-auto whitespace-nowrap ${guideChipsClass}`} style={{maxWidth: guideChipsMaxWidth}}>
                              {Array.isArray(task.guides) && task.guides.length > 0 ? (
                                task.guides.map(u => (
                                  <span key={u._id} className="flex items-center bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs font-medium mr-1">
                                    <img src={u.photo?.url || defaultProfile} alt={u.firstName} className="w-5 h-5 rounded-full object-cover mr-1" style={{minWidth: 20, minHeight: 20}} onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} />
                                    {u.firstName} {u.lastName}
                                    {viewType === 'received' && (
                                      <button
                                        className="ml-1 text-red-500 hover:text-red-700 focus:outline-none"
                                        style={{fontSize: '12px'}}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const newGuides = task.guides.filter(g => g._id !== u._id).map(g => g._id);
                                          try {
                                            const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/guides`, {
                                              method: 'PUT',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${currentUser.token}`,
                                              },
                                              body: JSON.stringify({ guides: newGuides }),
                                            });
                                            if (!response.ok) throw new Error('Failed to update guides');
                                            const updatedTask = await response.json();
                                            if (onTaskUpdate) onTaskUpdate(task._id, (prevTask) => ({ ...prevTask, guides: updatedTask.guides }));
                                            toast.success('Guide removed');
                                          } catch (err) {
                                            toast.error('Failed to update guides');
                                          }
                                        }}
                                        title="Remove guide"
                                      >×</button>
                                    )}
                                  </span>
                                ))
                              ) : (
                                <span className="italic text-gray-400">No guide</span>
                              )}
                            </div>
                            {/* Fixed dropdown icon at end, only in received viewType */}
                            {viewType === 'received' && (
                              <button
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-white rounded-full border border-gray-200 hover:bg-blue-100 hover:border-blue-400 transition-colors cursor-pointer z-10"
                                style={{boxShadow: '0 1px 4px rgba(0,0,0,0.04)'}}
                                onClick={e => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDropdownPosition({
                                    top: rect.bottom + window.scrollY,
                                    left: rect.left + window.scrollX,
                                  });
                                  setOpenGuideDropdownTaskId(task._id);
                                }}
                                title="Add/Remove Guides"
                              >
                                <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="text-gray-500 group-hover:text-blue-600 transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </button>
                            )}
                            {/* Dropdown for selecting guides */}
                            {viewType === 'received' && openGuideDropdownTaskId === task._id && ReactDOM.createPortal(
                              <div
                                ref={guideDropdownRef}
                                style={{
                                  position: 'absolute',
                                  top: dropdownPosition.top,
                                  left: dropdownPosition.left,
                                  minWidth: 220,
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 8,
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                  padding: 8,
                                  zIndex: 9999,
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}
                              >
                                {users.filter(u => !task.guides?.some(g => g._id === u._id)).length === 0 ? (
                                  <div className="text-gray-400 text-sm px-2 py-2">No users available</div>
                                ) : (
                                  users.filter(u => !task.guides?.some(g => g._id === u._id)).map(u => (
                                    <div
                                      key={u._id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '6px 8px',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        background: 'transparent',
                                        marginBottom: 2,
                                        transition: 'background 0.15s',
                                      }}
                                      onClick={async e => {
                                        e.stopPropagation();
                                        const newGuides = [...(task.guides?.map(g => g._id) || []), u._id];
                                        try {
                                          const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/guides`, {
                                            method: 'PUT',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              Authorization: `Bearer ${currentUser.token}`,
                                            },
                                            body: JSON.stringify({ guides: newGuides }),
                                          });
                                          if (!response.ok) throw new Error('Failed to update guides');
                                          const updatedTask = await response.json();
                                          if (onTaskUpdate) onTaskUpdate(task._id, (prevTask) => ({ ...prevTask, guides: updatedTask.guides }));
                                          toast.success('Guide added');
                                        } catch (err) {
                                          toast.error('Failed to update guides');
                                        }
                                      }}
                                    >
                                      <img src={u.photo?.url || defaultProfile} alt={`${u.firstName} ${u.lastName}`} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" style={{minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24}} />
                                      <span style={{fontSize: '14px'}}>{u.firstName} {u.lastName}</span>
                                    </div>
                                  ))
                                )}
                              </div>,
                              document.body
                            )}
                          </div>
                        </td>
                      );
                    
                      case 'files':
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                            <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                              <div className="flex items-center">
                                {task.files && task.files.length > 0 ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.files.length}</span>
                                    <button onClick={() => handleTaskClick(task)} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <span className="text-gray-400 text-sm italic">No files</span>
                                    <button onClick={() => handleTaskClick(task)} className="ml-2 text-blue-600 hover:text-blue-800 text-sm">Upload</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      
                      case 'comments':
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                            <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.comments ? task.comments.length : 0} </span>
                                <button onClick={() => { setSelectedTask(task); setShowComments(true); }} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                              </div>
                            </div>
                          </td>
                        );
                      
                      default:
                        let cellValue = task[colId];
                        if ([
                          'thirdVerificationAssignedTo',
                          'fourthVerificationAssignedTo',
                          'fifthVerificationAssignedTo'
                        ].includes(colId)) {
                          cellValue = cellValue ? (cellValue.firstName ? `${cellValue.firstName} ${cellValue.lastName}` : cellValue) : 'NA';
                        }
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{cellValue}</span></div></td>;
                    }
                  })}
                  {(viewType === 'assigned' || viewType === 'admin') && (
                    <td key="actions" className="px-2 py-1 text-sm font-normal align-middle bg-white">
                      {(!shouldDisableActions || !shouldDisableActions(task)) && (
                        <div className="flex items-center gap-0">
                          {/* Role-based action buttons */}
                          {['Team Head', 'Admin', 'Senior'].includes(currentUser?.role) && (
                            <button
                              onClick={() => onEditTask && onEditTask(task)}
                              className="text-blue-600 hover:text-blue-800 border border-blue-200 rounded px-2 py-1 text-xs font-semibold transition-colors"
                              title="Edit Task"
                            >
                              Edit
                            </button>
                          )}
                          {['Team Head', 'Admin'].includes(currentUser?.role) && (
                            <button
                              onClick={() => handleDeleteTask(task)}
                              className="text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-1 text-xs font-semibold transition-colors"
                              title="Delete Task"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )))}
            </tbody>
          </table>
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
    </>
  );
};

export default AdvancedTaskTable; 