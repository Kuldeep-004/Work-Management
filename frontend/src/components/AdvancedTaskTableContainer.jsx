import React, { useState, useEffect, useRef, useMemo } from 'react';
import AdvancedTaskTable from './AdvancedTaskTable';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';
import defaultProfile from '../assets/avatar.jpg';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';
import FileUpload from './FileUpload';
import FileList from './FileList';
import TaskComments from './TaskComments';
import VerificationRemarksModal from './VerificationRemarksModal';
import SearchableStatusDropdown from './SearchableStatusDropdown';
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

const BASE_COLUMNS = [
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
  { id: 'guides', label: 'Guide', defaultWidth: 200 },
  { id: 'files', label: 'Files', defaultWidth: 120 },
  { id: 'comments', label: 'Comments', defaultWidth: 120 },
];

// Add verification column only for receivedVerification tab
const getColumnsForTaskType = (taskType) => {
  const columns = [...BASE_COLUMNS];
  
  if (taskType === 'receivedVerification') {
    // Insert verification column after priority
    const priorityIndex = columns.findIndex(col => col.id === 'priority');
    columns.splice(priorityIndex + 1, 0, { id: 'verification', label: 'Verifications', defaultWidth: 130 });
  }
  
  return columns;
};

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

const VERIFICATION_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Return' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'next verification', label: 'Next Verification' },
];

const STATUS_OPTIONS = [
  { value: 'Yet to Start', label: 'Yet to Start' },
  { value: 'In Progress', label: 'In Progress' },
  { value: 'Completed', label: 'Completed' },
];

// Add at the top, after other useRef/useState:
const DRAG_ROW_CLASS = 'drag-row-highlight';



const AdvancedTaskTableContainer = (props) => {
  

    const { user } = useAuth();
      const [prevColumnOrder, setPrevColumnOrder] = useState([]);
      const isMounted = useRef(true);
      
      // State for dynamic priorities
      const [dynamicPriorities, setDynamicPriorities] = useState([]);
      const [prioritiesLoaded, setPrioritiesLoaded] = useState(false);
    
      // State for dynamic task statuses
      const [dynamicTaskStatuses, setDynamicTaskStatuses] = useState([]);
      const [taskStatusesLoaded, setTaskStatusesLoaded] = useState(false);
    
      // State for custom columns
      const [customColumns, setCustomColumns] = useState([]);
      const [customColumnsLoaded, setCustomColumnsLoaded] = useState(false);
      
      // State for No column dropdown functionality
      const [showDeleteDropdown, setShowDeleteDropdown] = useState(null);
      const [deleteDropdownPosition, setDeleteDropdownPosition] = useState({ x: 0, y: 0 });
      const deleteDropdownRef = useRef(null);
      // State for custom delete confirmation modal
      const [deleteConfirmTask, setDeleteConfirmTask] = useState(null);
      
      // Get columns based on task type, or use provided allColumns, plus custom columns
      const getExtendedColumns = () => {
        const baseColumns = allColumns || getColumnsForTaskType(taskType);
        
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
      };
    
      // Memoized ALL_COLUMNS that updates when custom columns change
      const ALL_COLUMNS = useMemo(() => {
        return getExtendedColumns();
      }, [allColumns, taskType, customColumns, customColumnsLoaded]);
    
      // Cleanup on unmount
      useEffect(() => {
        return () => {
          isMounted.current = false;
        };
      }, []);
    
      // Fetch dynamic priorities
      useEffect(() => {
        const fetchPriorities = async () => {
          if (!user?.token) return;
          
          try {
            const response = await fetch(`${API_BASE_URL}/api/priorities`, {
              headers: { Authorization: `Bearer ${user.token}` },
            });
            if (response.ok) {
              const priorities = await response.json();
              setDynamicPriorities(priorities);
            }
          } catch (error) {
            console.error('Error fetching priorities:', error);
            // Fallback to static priorities if fetch fails
            setDynamicPriorities([]);
          } finally {
            setPrioritiesLoaded(true);
          }
        };
    
        fetchPriorities();
      }, [user?.token]);
    
      // Fetch dynamic task statuses
      useEffect(() => {
        const fetchTaskStatuses = async () => {
          if (!user?.token) return;
          
          try {
            const response = await fetch(`${API_BASE_URL}/api/task-statuses`, {
              headers: { Authorization: `Bearer ${user.token}` },
            });
            if (response.ok) {
              const statuses = await response.json();
              setDynamicTaskStatuses(statuses);
            }
          } catch (error) {
            console.error('Error fetching task statuses:', error);
            // Fallback to static status options if fetch fails
            setDynamicTaskStatuses(STATUS_OPTIONS);
          } finally {
            setTaskStatusesLoaded(true);
          }
        };
    
        fetchTaskStatuses();
      }, [user?.token]);
    
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
    
      // Get current priority options (dynamic + static fallback)
      const getCurrentPriorityOptions = () => {
        if (!prioritiesLoaded) {
          return PRIORITY_OPTIONS; // Use static options while loading
        }
        
        if (dynamicPriorities.length > 0) {
          return dynamicPriorities.map(p => ({
            value: p.name,
            label: p.name.charAt(0).toUpperCase() + p.name.slice(1).replace(/([A-Z])/g, ' $1')
          }));
        }
        
        return PRIORITY_OPTIONS; // Fallback to static if no dynamic priorities
      };
    
      // Drag and drop state
      const [draggedColumn, setDraggedColumn] = useState(null);
      const [dragOverColumn, setDragOverColumn] = useState(null);
      const [isResizing, setIsResizing] = useState(false);
      const [resizingColumn, setResizingColumn] = useState(null);
      const [resizeStartX, setResizeStartX] = useState(0);
      const [resizeStartWidth, setResizeStartWidth] = useState(0);
      
      // Group drag and drop state
      const [draggedGroup, setDraggedGroup] = useState(null);
      const [dragOverGroup, setDragOverGroup] = useState(null);
    
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
      
      // Verification remarks modal state
      const [showRemarksModal, setShowRemarksModal] = useState(false);
      const [remarksModalTask, setRemarksModalTask] = useState(null);
      const [remarksModalType, setRemarksModalType] = useState('accepted');
      const [remarksModalLoading, setRemarksModalLoading] = useState(false);
      
      // Custom field editing states
      const [editingCustomTextTaskId, setEditingCustomTextTaskId] = useState(null);
      const [editingCustomTextColumnName, setEditingCustomTextColumnName] = useState('');
      const [editingCustomTextValue, setEditingCustomTextValue] = useState('');
      const [editingCustomTagsTaskId, setEditingCustomTagsTaskId] = useState(null);
      const [editingCustomTagsColumnName, setEditingCustomTagsColumnName] = useState('');
      const [editingPriorityTaskId, setEditingPriorityTaskId] = useState(null);
      const [priorityLoading, setPriorityLoading] = useState(false);
      const priorityDropdownRef = useRef(null);
      const [editingVerificationTaskId, setEditingVerificationTaskId] = useState(null);
      const [verificationLoading, setVerificationLoading] = useState(false);
      const verificationDropdownRef = useRef(null);
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
    
      // --- Dropdown close on outside click ---
      useEffect(() => {
        function handleClickOutside(event) {
          // Priority dropdown
          if (editingPriorityTaskId && priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target)) {
            setEditingPriorityTaskId(null);
          }
          // Verification dropdown
          if (editingVerificationTaskId && verificationDropdownRef.current && !verificationDropdownRef.current.contains(event.target)) {
            setEditingVerificationTaskId(null);
          }
          // Status dropdown
          if (editingStatusTaskId && statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
            setEditingStatusTaskId(null);
          }
          // Verifier dropdown
          if (editingVerifierTaskId && verifierDropdownRef.current && !verifierDropdownRef.current.contains(event.target)) {
            setEditingVerifierTaskId(null);
          }
          // Guide dropdown
          if (openGuideDropdownTaskId && guideDropdownRef.current && !guideDropdownRef.current.contains(event.target)) {
            setOpenGuideDropdownTaskId(null);
          }
          // Custom tags dropdown
          if (editingCustomTagsTaskId && priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target)) {
            setEditingCustomTagsTaskId(null);
            setEditingCustomTagsColumnName('');
          }
          // Delete dropdown for No column
          if (showDeleteDropdown && deleteDropdownRef.current && !deleteDropdownRef.current.contains(event.target)) {
            setShowDeleteDropdown(null);
          }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
          document.removeEventListener('mousedown', handleClickOutside);
        };
      }, [editingPriorityTaskId, editingVerificationTaskId, editingStatusTaskId, editingVerifierTaskId, openGuideDropdownTaskId, editingCustomTagsTaskId, showDeleteDropdown]);
    
      // Add scroll event listener to close delete dropdown
      useEffect(() => {
        function handleScroll() {
          if (showDeleteDropdown) {
            setShowDeleteDropdown(null);
          }
        }
        
        if (showDeleteDropdown) {
          window.addEventListener('scroll', handleScroll, true);
          return () => {
            window.removeEventListener('scroll', handleScroll, true);
          };
        }
      }, [showDeleteDropdown]);
    
      // Row drag-and-drop state
      const [draggedTaskId, setDraggedTaskId] = useState(null);
      const [dragOverTaskId, setDragOverTaskId] = useState(null);
      const [dragOverGroupKey, setDragOverGroupKey] = useState(null);
      const [orderedTasks, setOrderedTasks] = useState(tasks);
      const [orderLoaded, setOrderLoaded] = useState(false);
    
      // Add a ref to track the last set of task IDs and grouping
      const lastTaskIdsRef = useRef([]);
      const lastGroupFieldRef = useRef(null);
    
      const isControlled = !!visibleColumns && !!setVisibleColumns;
    
      // Add a new variable:
      const isColumnOrderControlled = typeof columnOrder !== 'undefined' && typeof setColumnOrder === 'function';
    
      // Fix: move selfVerification update state hooks to top level to avoid hook order issues
      const [isUpdating, setIsUpdating] = useState(false);
      const [isUpdating2, setIsUpdating2] = useState(false);
    
      // Helper functions
      const getStatusColor = (status) => {
        // Find the status in dynamic task statuses first
        const dynamicStatus = dynamicTaskStatuses.find(s => s.name === status);
        if (dynamicStatus) {
          // If it's a Tailwind class, return it directly
          if (dynamicStatus.color && !dynamicStatus.color.startsWith('#')) {
            return dynamicStatus.color;
          }
          // If it's a hex color, return null to use inline styles
          if (dynamicStatus.color && dynamicStatus.color.startsWith('#')) {
            return null;
          }
        }
        
        // Use hardcoded colors for default statuses if not found in dynamic statuses
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
    
      // Get inline styles for dynamic status colors (only for hex colors)
      const getStatusStyles = (status) => {
        const dynamicStatus = dynamicTaskStatuses.find(s => s.name === status);
        if (dynamicStatus && dynamicStatus.color && dynamicStatus.color.startsWith('#')) {
          const hex = dynamicStatus.color;
          const r = parseInt(hex.slice(1, 3), 16);
          const g = parseInt(hex.slice(3, 5), 16);
          const b = parseInt(hex.slice(5, 7), 16);
          const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
          const textColor = brightness > 128 ? '#000000' : '#FFFFFF';
          
          return {
            backgroundColor: hex,
            color: textColor
          };
        }
        return null;
      };
    
      // Get current status options (dynamic or static fallback)
      const currentStatusOptions = taskStatusesLoaded && dynamicTaskStatuses.length > 0 
        ? dynamicTaskStatuses.map(s => ({ value: s.name, label: s.name }))
        : STATUS_OPTIONS;
    
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
    
      const getVerificationColor = (verification) => {
        switch (verification) {
          case 'pending':
            return 'bg-gray-100 text-gray-800 border border-gray-200';
          case 'rejected':
            return 'bg-red-100 text-red-800 border border-red-200';
          case 'accepted':
            return 'bg-green-100 text-green-800 border border-green-200';
          case 'next verification':
            return 'bg-blue-100 text-blue-800 border border-blue-200';
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
          if (isColumnOrderControlled) {
            setColumnOrder(newOrder);
          } // else: do nothing, or use local state if implemented
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
        const orderedColumns = columnOrder.filter(colId => visibleColumns.includes(colId));
        
        // Filter out verification column for tabs other than receivedVerification
        if (taskType !== 'receivedVerification') {
          return orderedColumns.filter(colId => colId !== 'verification');
        }
        
        return orderedColumns;
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
    
      // Handle custom text field editing
      const handleCustomTextEditSave = async (task, columnName) => {
        const currentValue = task.customFields?.[columnName] || '';
        if (editingCustomTextValue === currentValue) {
          setEditingCustomTextTaskId(null);
          setEditingCustomTextColumnName('');
          setEditingCustomTextValue('');
          return;
        }
        
        try {
          const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/custom-fields`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify({
              customFields: {
                ...task.customFields,
                [columnName]: editingCustomTextValue
              }
            })
          });
          
          if (!response.ok) throw new Error('Failed to update custom field');
          
          // Update local state
          if (onTaskUpdate) {
            onTaskUpdate(task._id, (prevTask) => ({
              ...prevTask,
              customFields: {
                ...prevTask.customFields,
                [columnName]: editingCustomTextValue
              }
            }));
          }
          toast.success('Custom field updated');
        } catch (error) {
          toast.error(error.message || 'Failed to update custom field');
        }
        
        setEditingCustomTextTaskId(null);
        setEditingCustomTextColumnName('');
        setEditingCustomTextValue('');
      };
    
      // Handle custom tags field change
      const handleCustomTagsChange = async (task, columnName, newValue) => {
        try {
          const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/custom-fields`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify({
              customFields: {
                ...task.customFields,
                [columnName]: newValue
              }
            })
          });
          
          if (!response.ok) throw new Error('Failed to update custom field');
          
          // Update local state
          if (onTaskUpdate) {
            onTaskUpdate(task._id, (prevTask) => ({
              ...prevTask,
              customFields: {
                ...prevTask.customFields,
                [columnName]: newValue
              }
            }));
          }
          toast.success('Custom field updated');
        } catch (error) {
          toast.error(error.message || 'Failed to update custom field');
        }
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
          
          // Update the task in orderedTasks without changing positions
          const updatedOrderedTasks = orderedTasks.map(t => 
            t._id === task._id ? { ...t, priority: newPriority } : t
          );
          setOrderedTasks(updatedOrderedTasks);
          
          // Refresh tasks from backend if refetchTasks is available
          if (refetchTasks) {
            refetchTasks();
          }
          
          toast.success('Priority updated');
        } catch (error) {
          toast.error(error.message || 'Failed to update priority');
        }
        setPriorityLoading(false);
        setEditingPriorityTaskId(null);
      };
    
      // Get filtered verification options based on current verifier
      const getVerificationOptions = (task, currentUser) => {
        if (!currentUser) return VERIFICATION_OPTIONS;
        
        // Find which verifier the current user is
        const verifierFields = [
          'verificationAssignedTo',
          'secondVerificationAssignedTo', 
          'thirdVerificationAssignedTo',
          'fourthVerificationAssignedTo',
          'fifthVerificationAssignedTo'
        ];
        
        let currentVerifierIndex = -1;
        verifierFields.forEach((field, idx) => {
          if (task[field]?._id === currentUser._id) {
            currentVerifierIndex = idx;
          }
        });
        
        // If user is the 5th (last) verifier, remove "next verification" option
        if (currentVerifierIndex === 4) { // 5th verifier (0-indexed)
          return VERIFICATION_OPTIONS.filter(opt => opt.value !== 'next verification');
        }
        
        return VERIFICATION_OPTIONS;
      };
    
      const handleVerificationChange = async (task, newVerification) => {
        console.log('Starting verification update for task:', task._id, 'new verification:', newVerification);
        
        // If it's accepted or rejected, show the remarks modal
        if (newVerification === 'accepted' || newVerification === 'rejected') {
          setRemarksModalTask(task);
          setRemarksModalType(newVerification);
          setShowRemarksModal(true);
          setEditingVerificationTaskId(null);
          return;
        }
    
        // For other statuses (pending, next verification), proceed directly
        setVerificationLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/verification`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify({ verification: newVerification }),
          });
          
          console.log('Verification update response status:', response.status);
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update verification');
          }
          
          const updatedTask = await response.json();
          
          console.log('Updated task received:', updatedTask);
          
          if (onTaskUpdate) {
            onTaskUpdate(task._id, () => updatedTask);
          }
          
          // Update the task in orderedTasks without changing positions
          const updatedOrderedTasks = orderedTasks.map(t => 
            t._id === task._id ? { ...t, ...updatedTask } : t
          );
          setOrderedTasks(updatedOrderedTasks);
          
          // Refresh tasks from backend if refetchTasks is available
          if (refetchTasks) {
            refetchTasks();
          }
          
          toast.success('Verification updated');
        } catch (error) {
          console.error('Error updating verification:', error);
          toast.error(error.message || 'Failed to update verification');
        }
        setVerificationLoading(false);
        setEditingVerificationTaskId(null);
      };
    
      // Handle verification with remarks
      const handleVerificationWithRemarks = async (remarks) => {
        setRemarksModalLoading(true);
        try {
          const response = await fetch(`${API_BASE_URL}/api/tasks/${remarksModalTask._id}/verification`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${user.token}`,
            },
            body: JSON.stringify({ 
              verification: remarksModalType,
              remarks: remarks 
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update verification');
          }
          
          const updatedTask = await response.json();
          
          if (onTaskUpdate) {
            onTaskUpdate(remarksModalTask._id, () => updatedTask);
          }
          
          // Update the task in orderedTasks without changing positions
          const updatedOrderedTasks = orderedTasks.map(t => 
            t._id === remarksModalTask._id ? { ...t, ...updatedTask } : t
          );
          setOrderedTasks(updatedOrderedTasks);
          
          // Refresh tasks from backend if refetchTasks is available
          if (refetchTasks) {
            refetchTasks();
          }
          
      toast.success(`Task ${remarksModalType === 'rejected' ? 'returned' : remarksModalType} successfully`);
          setShowRemarksModal(false);
        } catch (error) {
          console.error('Error updating verification:', error);
          toast.error(error.message || 'Failed to update verification');
        }
        setRemarksModalLoading(false);
      };
    
      // Close remarks modal
      const closeRemarksModal = () => {
        setShowRemarksModal(false);
        setRemarksModalTask(null);
        setRemarksModalType('accepted');
        setRemarksModalLoading(false);
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
    
      // Handle left click on No column (edit task)
      const handleNoColumnLeftClick = (task) => {
        if (shouldDisableActions && shouldDisableActions(task)) return;
        
        // Check role permissions for edit
        if (['Team Head', 'Admin', 'Senior'].includes(user?.role)) {
          if (onEditTask) {
            onEditTask(task);
          }
        }
      };
    
      // Handle right click on No column (show delete dropdown)
      const handleNoColumnRightClick = (e, task) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (shouldDisableActions && shouldDisableActions(task)) return;
        
        // Check role permissions for delete dropdown - only Admin and Team Head
        if (!['Team Head', 'Admin'].includes(user?.role)) {
          return;
        }
    
        const rect = e.target.getBoundingClientRect();
        setDeleteDropdownPosition({
          x: rect.right,
          y: rect.top
        });
        setShowDeleteDropdown(task._id);
      };
    
      // Show custom delete confirmation modal
      const handleDeleteFromDropdown = (task) => {
        setShowDeleteDropdown(null);
        setDeleteConfirmTask(task);
      };
    
      // Handle confirm/cancel in custom modal
      const handleConfirmDelete = async () => {
        if (deleteConfirmTask) {
          await handleDeleteTask(deleteConfirmTask);
        }
        setDeleteConfirmTask(null);
      };
      const handleCancelDelete = () => {
        setDeleteConfirmTask(null);
      };
    
      // Close delete dropdown
      const closeDeleteDropdown = () => {
        setShowDeleteDropdown(null);
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
        : (columnOrder.includes('billed') && sortBy === 'billed') ? 'billed'
        : null
      );
      const shouldGroup = groupField && sortBy !== 'createdAt';
      let groupedTasks = null;
      if (shouldGroup) {
        let options = {};
        if (groupField === 'priority') PRIORITY_OPTIONS.forEach(opt => options[opt.value] = opt.label);
        if (groupField === 'status') currentStatusOptions.forEach(opt => options[opt.value] = opt.label);
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
    
      // Wrap the initialization useEffect for columnOrder:
      useEffect(() => {
        if (!isColumnOrderControlled) {
          if (!columnOrder.length && !visibleColumns.length) {
            const defaultOrder = ALL_COLUMNS.map(col => col.id);
            setColumnOrder(defaultOrder);
            if (!isControlled) setVisibleColumns(defaultOrder);
          }
        }
      }, [columnOrder, visibleColumns, isControlled, isColumnOrderControlled]);
    
      // Wrap the fetchColumnOrder useEffect:
      useEffect(() => {
        if (!isColumnOrderControlled) {
          if (!tabKey || !tabId) return;
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
                if (isMounted.current) {
                  setColumnOrder(order);
                  if (!isControlled && setVisibleColumns) {
                    try {
                      setVisibleColumns(order);
                    } catch (error) {
                      console.error('Error setting visible columns:', error);
                    }
                  }
                }
              }
            } catch (err) {
              console.error('Error fetching column order:', err);
              // fallback: show all columns
              if (isMounted.current) {
                setColumnOrder(ALL_COLUMNS.map(col => col.id));
                if (!isControlled && setVisibleColumns) setVisibleColumns(ALL_COLUMNS.map(col => col.id));
              }
            }
          }
          fetchColumnOrder();
          return () => { isMounted.current = false; };
        }
        // eslint-disable-next-line
      }, [tabKey, tabId, isControlled, isColumnOrderControlled]);
    
      // Wrap the saveColumnOrder useEffect:
      useEffect(() => {
        if (!isColumnOrderControlled) {
          if (!columnOrder || !Array.isArray(columnOrder) || columnOrder.length === 0) return;
          async function saveColumnOrder() {
            try {
              if (!user?.token) {
                console.error('Missing authentication token');
                return;
              }
              if (!tabKey || !tabId || !Array.isArray(columnOrder)) {
                console.error('Invalid column order data:', { tabKey, tabId, columnOrder });
                return;
              }
              const allIds = ALL_COLUMNS.map(col => col.id);
              if (columnOrder.some(colId => !allIds.includes(colId))) {
                console.error('Invalid column IDs in order:', columnOrder);
                return;
              }
              const response = await fetch(`${API_BASE_URL}/api/users/tabstate/columnOrder`, {
                method: 'PATCH',
                headers: { 
                  'Content-Type': 'application/json', 
                  Authorization: `Bearer ${user.token}` 
                },
                body: JSON.stringify({ tabKey, columnOrder, tabId }),
              });
              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error('Failed to save column order:', errorData);
                toast.error(errorData.message || 'Failed to save column order');
                // Fallback: restore previous order if save fails
                setColumnOrder(prevColumnOrder);
                if (!isControlled) setVisibleColumns(prevColumnOrder);
              } else {
                // Store successful order as previous order
                setPrevColumnOrder(columnOrder);
              }
            } catch (err) {
              console.error('Error saving column order:', err);
              toast.error('Failed to save column order');
              // Fallback: restore previous order if save fails
              setColumnOrder(prevColumnOrder);
              if (!isControlled) setVisibleColumns(prevColumnOrder);
            }
          }
          saveColumnOrder();
        }
        // eslint-disable-next-line
      }, [columnOrder, tabKey, tabId, isColumnOrderControlled]);
    
      // When component mounts, fetch initial column order
      useEffect(() => {
        if (!isColumnOrderControlled) {
          if (!tabKey || !tabId) return;
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
                if (isMounted.current) {
                  setColumnOrder(order);
                  if (!isControlled && setVisibleColumns) {
                    try {
                      setVisibleColumns(order);
                    } catch (error) {
                      console.error('Error setting visible columns:', error);
                    }
                  }
                }
              }
            } catch (err) {
              console.error('Error fetching column order:', err);
              // fallback: show all columns
              if (isMounted.current) {
                setColumnOrder(ALL_COLUMNS.map(col => col.id));
                if (!isControlled && setVisibleColumns) setVisibleColumns(ALL_COLUMNS.map(col => col.id));
              }
            }
          }
          fetchColumnOrder();
          return () => { isMounted.current = false; };
        }
        // eslint-disable-next-line
      }, [tabKey, tabId, isControlled, isColumnOrderControlled]);
    
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
          // No refetchTasks here for smooth UI
        } catch (err) {
          console.error('Error saving task order:', err);
        }
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
        
        // Get the group keys for the dragged task and drop target
        if (shouldGroup) {
          const draggedTask = orderedTasks[idxFrom];
          const dropTask = orderedTasks[idxTo];
          const draggedGroupKey = getGroupKey(draggedTask);
          const dropGroupKey = getGroupKey(dropTask);
          
          // Only allow reordering within the same group
          if (draggedGroupKey !== dropGroupKey) {
            console.log('Cannot reorder tasks between different groups');
            setDraggedTaskId(null);
            setDragOverTaskId(null);
            return;
          }
          
          // For grouped view, we need to keep tasks within their respective groups
          // First, collect all tasks by their group
          const tasksByGroup = {};
          orderedTasks.forEach(task => {
            const groupKey = getGroupKey(task);
            if (!tasksByGroup[groupKey]) tasksByGroup[groupKey] = [];
            tasksByGroup[groupKey].push(task);
          });
          
          // Then reorganize within the specific group
          const groupTasks = tasksByGroup[draggedGroupKey];
          const groupIdxFrom = groupTasks.findIndex(t => t._id === draggedTaskId);
          const groupIdxTo = groupTasks.findIndex(t => t._id === dropTaskId);
          
          // Reorder within the group
          const [groupRemoved] = groupTasks.splice(groupIdxFrom, 1);
          groupTasks.splice(groupIdxTo, 0, groupRemoved);
          
          // Reconstruct the full task order, preserving group order
          newOrder = [];
          Object.values(tasksByGroup).forEach(tasks => {
            newOrder.push(...tasks);
          });
        } else {
          // For ungrouped view, simple reordering
          newOrder = [...orderedTasks];
          const [removed] = newOrder.splice(idxFrom, 1);
          newOrder.splice(idxTo, 0, removed);
        }
        
        // Update the order in state
        setOrderedTasks(newOrder);
        
        // Save the new order to backend
        saveOrder(newOrder.map(t => t._id));
        
        // Clear drag states
        setDraggedTaskId(null);
        setDragOverTaskId(null);
      };
      const handleRowDragEnd = () => {
        setDraggedTaskId(null);
        setDragOverTaskId(null);
      };
    
      // New function for handling group drag and drop
      const handleGroupDrop = (fromGroup, toGroup) => {
        if (!shouldGroup || !fromGroup || !toGroup || fromGroup === toGroup) return;
    
        // First, collect all tasks by their group
        const tasksByGroup = {};
        const groupOrder = [];
        
        // Extract current group order
        Object.entries(renderGroupedTasks).forEach(([group, _]) => {
          groupOrder.push(group);
        });
        
        // Find the positions of the groups
        const fromIndex = groupOrder.indexOf(fromGroup);
        const toIndex = groupOrder.indexOf(toGroup);
        
        if (fromIndex === -1 || toIndex === -1) return;
        
        // Rearrange the group order
        const newGroupOrder = [...groupOrder];
        const [removed] = newGroupOrder.splice(fromIndex, 1);
        newGroupOrder.splice(toIndex, 0, removed);
        
        // Reorganize tasks according to the new group order
        let newOrderedTasks = [];
        
        // First, group all tasks
        orderedTasks.forEach(task => {
          const groupKey = getGroupKey(task);
          if (!tasksByGroup[groupKey]) tasksByGroup[groupKey] = [];
          tasksByGroup[groupKey].push(task);
        });
        
        // Then rebuild the task order based on the new group order
        newGroupOrder.forEach(group => {
          if (tasksByGroup[group]) {
            newOrderedTasks = [...newOrderedTasks, ...tasksByGroup[group]];
          }
        });
        
        // Update the task order
        setOrderedTasks(newOrderedTasks);
        
        // Save the new order to backend
        saveOrder(newOrderedTasks.map(t => t._id));
      };
      
      // Add this useEffect to ensure orderedTasks are updated with latest task data while preserving order
      useEffect(() => {
        if (!orderedTasks || !tasks || tasks.length === 0) return;
        
        // Map of task IDs to updated task data
        const taskMap = tasks.reduce((map, task) => {
          map[task._id] = task;
          return map;
        }, {});
        
        // Update orderedTasks with the latest task data while preserving order
        const updatedOrderedTasks = orderedTasks.map(task => {
          if (taskMap[task._id]) {
            // Preserve the position but update the task data
            return { ...taskMap[task._id] };
          }
          return task;
        });
        
        // Add any new tasks that aren't in orderedTasks yet
        const orderedTaskIds = new Set(updatedOrderedTasks.map(task => task._id));
        const newTasks = tasks.filter(task => !orderedTaskIds.has(task._id));
        
        if (newTasks.length > 0 || JSON.stringify(updatedOrderedTasks) !== JSON.stringify(orderedTasks)) {
          setOrderedTasks([...updatedOrderedTasks, ...newTasks]);
        }
      }, [tasks]);
    
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
    <AdvancedTaskTable {...props} />
  );
};

export default AdvancedTaskTableContainer;
