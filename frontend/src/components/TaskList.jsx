import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';
import FileUpload from './FileUpload';
import FileList from './FileList';
import TaskComments from './TaskComments';
import { API_BASE_URL } from '../apiConfig';

// Add this CSS class at the top of the file, after the imports
const scrollbarHide = {
  msOverflowStyle: 'none',
  scrollbarWidth: 'none',
  WebkitScrollbar: {
    display: 'none'
  }
};

// Add this style block at the top of the file after imports
const styles = `
  .hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none !important;
  }
`;

// Add the styles to the document
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

// Helper function at the top (or import if you have a utils file)
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

// Define ALL_COLUMNS at the top, similar to AdminDashboard
const ALL_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Status' },
  { id: 'clientName', label: 'Client Name' },
  { id: 'clientGroup', label: 'Client Group' },
  { id: 'workType', label: 'Work Type' },
  { id: 'billed', label: 'Internal Works' },
  { id: 'status', label: 'Task Status' },
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

const TaskList = ({ viewType, taskType, tasks: externalTasks, showControls = true, searchTerm: externalSearchTerm, setSearchTerm: setExternalSearchTerm, visibleColumns: externalVisibleColumns, setVisibleColumns: setExternalVisibleColumns }) => {
  const { user: loggedInUser, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('status');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [hoveredTaskId, setHoveredTaskId] = useState(null);
  const [hoveredTask, setHoveredTask] = useState(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [selectedTaskForVerification, setSelectedTaskForVerification] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [selectedTaskForComplete, setSelectedTaskForComplete] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [verificationStage, setVerificationStage] = useState('first');
  const [editingVerificationStatus, setEditingVerificationStatus] = useState(null);
  const [selectedVerifier, setSelectedVerifier] = useState(null);
  const [showVerifierModal, setShowVerifierModal] = useState(false);
  const [selectedTaskForVerifier, setSelectedTaskForVerifier] = useState(null);
  const [showSecondVerifierModal, setShowSecondVerifierModal] = useState(false);
  const [taskHours, setTaskHours] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [internalVisibleColumns, setInternalVisibleColumns] = useState(() => {
    const user = loggedInUser;
    const key = `tasklist_columns_${user?._id || 'guest'}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return ['title', 'description', 'clientName', 'clientGroup', 'workType', 'status', 'verificationStatus', 'priority', 'inwardEntryDate', 'dueDate', 'targetDate', 'assignedBy', 'assignedTo', 'verificationAssignedTo', 'secondVerificationAssignedTo', 'files', 'comments'];
  });
  const visibleColumns = externalVisibleColumns || internalVisibleColumns;
  const setVisibleColumns = setExternalVisibleColumns || setInternalVisibleColumns;

  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchTerm = externalSearchTerm !== undefined ? externalSearchTerm : internalSearchTerm;
  const setSearchTerm = setExternalSearchTerm || setInternalSearchTerm;

  // Add ref for the columns dropdown
  const columnsDropdownRef = useRef(null);

  // Add at the top, after useState imports
  const [editingDescriptionTaskId, setEditingDescriptionTaskId] = useState(null);
  const [editingDescriptionValue, setEditingDescriptionValue] = useState('');

  // Helper function to filter users based on role-based permissions
  const getFilteredUsers = (task = null) => {
    if (!task) {
      return users;
    }
    
    // Get all user IDs associated with the task that should be excluded
    const excludedUserIds = new Set();
    
    // Add current user
    excludedUserIds.add(loggedInUser._id);
    
    // Add assigned by user
    if (task.assignedBy && task.assignedBy._id) {
      excludedUserIds.add(task.assignedBy._id);
    }
    
    // Add assigned to user(s)
    if (task.assignedTo) {
      if (Array.isArray(task.assignedTo)) {
        task.assignedTo.forEach(user => {
          if (user._id) excludedUserIds.add(user._id);
        });
      } else if (task.assignedTo._id) {
        excludedUserIds.add(task.assignedTo._id);
      }
    }
    
    // Add first verifier
    if (task.verificationAssignedTo && task.verificationAssignedTo._id) {
      excludedUserIds.add(task.verificationAssignedTo._id);
    }
    
    // Add second verifier
    if (task.secondVerificationAssignedTo && task.secondVerificationAssignedTo._id) {
      excludedUserIds.add(task.secondVerificationAssignedTo._id);
    }
    
    // Filter out excluded users
    return users.filter(user => !excludedUserIds.has(user._id));
  };

  const fetchTasks = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      let endpoint;
      if (viewType === 'for-verification') {
        endpoint = `${API_BASE_URL}/api/tasks/for-verification`;
      } else if (viewType === 'under_verification') {
        endpoint = `${API_BASE_URL}/api/tasks/under-verification`;
      } else if (viewType === 'received_completed') {
        endpoint = `${API_BASE_URL}/api/tasks/received/completed`;
      } else {
        const baseEndpoint = viewType === 'assigned' 
          ? `${API_BASE_URL}/api/tasks/assigned`
          : `${API_BASE_URL}/api/tasks/received`;
        endpoint = baseEndpoint;
      }

      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${loggedInUser.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }

      const data = await response.json();
      setTasks(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Use external tasks if provided, otherwise use internal tasks
  const displayTasks = externalTasks || tasks;

  // Helper function to update tasks (works for both external and internal tasks)
  const updateTaskInState = (taskId, updater) => {
    if (externalTasks) {
      // If using external tasks, we need to notify the parent component
      // For now, we'll just update the internal state as a fallback
      setTasks(prevTasks => updater(prevTasks));
    } else {
      // Update internal state
      setTasks(prevTasks => updater(prevTasks));
    }
  };

  useEffect(() => {
    if (externalTasks) {
      // If external tasks are provided, use them directly
      setLoading(false);
      setError(null);
    } else {
      // Otherwise fetch tasks internally
      fetchTasks();
    }
  }, [externalTasks, viewType, loggedInUser]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
          headers: {
            Authorization: `Bearer ${loggedInUser.token}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch users');
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to fetch users');
      }
    };
    fetchUsers();
  }, [loggedInUser]);

  useEffect(() => {
    // Fetch task hours for all users
    const fetchTaskHours = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/timesheets/task-hours`, {
          headers: { Authorization: `Bearer ${loggedInUser.token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch task hours');
        const data = await response.json();
        setTaskHours(data);
      } catch (error) {
        console.error('Error fetching task hours:', error);
      }
    };
    if (loggedInUser && loggedInUser.token) {
      fetchTaskHours();
    }
  }, [loggedInUser]);

  useEffect(() => {
    const user = loggedInUser;
    const key = `tasklist_columns_${user?._id || 'guest'}`;
    localStorage.setItem(key, JSON.stringify(visibleColumns));
  }, [visibleColumns, loggedInUser]);

  const getSortedTasks = () => {
    if (!Array.isArray(displayTasks)) return [];

    let filteredTasks = [...displayTasks];
    
    // Only apply internal search filter if no external search term is provided
    if (searchTerm && !externalSearchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      filteredTasks = filteredTasks.filter(task => (
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
      ));
    }

    // If external tasks are provided, return them as-is (already sorted by parent)
    if (externalTasks) {
      return filteredTasks;
    }

    // Only apply internal sorting if no external tasks are provided
    return filteredTasks.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === 'createdAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (sortBy === 'priority') {
        aValue = priorityOrder[aValue] || 99;
        bValue = priorityOrder[bValue] || 99;
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
      case 'yet_to_start':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority) => {
    // This component should ideally receive priorities as props to get dynamic colors
    // For now, using fallback colors
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

  const getAssigneeInfo = (task) => {
    if (!task.assignedTo || task.assignedTo.length === 0) return 'Unassigned';
    return task.assignedTo.map(user => `${user.firstName} ${user.lastName}`).join(', ');
  };

  useEffect(() => {
    // No need for handleClickOutside if there's no dropdown
  }, []);

  const priorityOrder = {
    urgent: 1,
    today: 2,
    lessThan3Days: 3,
    thisWeek: 4,
    thisMonth: 5,
    regular: 6,
    filed: 7,
    dailyWorksOffice: 8,
    monthlyWorks: 9
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${loggedInUser.token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          throw new Error('You can only delete tasks that you created');
        }
        throw new Error(errorData.message || 'Failed to delete task');
      }

      updateTaskInState(taskId, prevTasks => prevTasks.filter(task => task._id !== taskId));
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Error deleting task:', error);
      toast.error(error.message || 'Failed to delete task');
    }
  };

  const handleRequestVerification = async (taskId) => {
    try {
      if (!selectedTaskForVerification?.verificationAssignedTo) {
        toast.error('Please select a verifier');
        return;
      }

      const endpoint = verificationStage === 'first' 
        ? `/api/tasks/${taskId}/send-for-first-verification`
        : `/api/tasks/${taskId}/send-for-second-verification`;

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify({
          verifierId: selectedTaskForVerification.verificationAssignedTo
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to request verification');
      }

      const updatedTask = await response.json();
      
      updateTaskInState(taskId, prevTasks => {
        const taskIndex = prevTasks.findIndex(task => task._id === taskId);
        if (taskIndex === -1) return prevTasks;
        
        const newTasks = [...prevTasks];
        newTasks[taskIndex] = updatedTask;
        return newTasks;
      });

      setShowVerificationModal(false);
      setSelectedTaskForVerification(null);
      setVerificationStage('first');
      toast.success(`${verificationStage === 'first' ? 'First' : 'Second'} verification requested successfully`);
      
      fetchTasks();
    } catch (error) {
      console.error('Error requesting verification:', error);
      toast.error(error.message || 'Failed to request verification');
    }
  };

  const handleVerificationStatusChange = async (taskId, newStatus) => {
    if (newStatus === 'executed') {
      // Show verifier selection modal for first verification
      const task = displayTasks.find(t => t._id === taskId);
      setSelectedTaskForVerifier(task);
      setShowVerifierModal(true);
    } else if (newStatus === 'first_verified') {
      // Show verifier selection modal for second verification
      const task = displayTasks.find(t => t._id === taskId);
      setSelectedTaskForVerifier(task);
      setShowSecondVerifierModal(true);
    } else if (newStatus === 'completed') {
      // If second verifier is completing, send their user ID as verifierId
      await handleVerificationUpdate(taskId, newStatus, loggedInUser._id);
    } else {
      // For other statuses, update directly
      await handleVerificationUpdate(taskId, newStatus);
    }
  };

  const handleVerificationUpdate = async (taskId, status, verifierId = null) => {
    try {
      const body = verifierId ? { verificationStatus: status, verifierId } : { verificationStatus: status };
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/verification`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update verification status');
      }

      if (status === 'completed') {
        // Only update the verificationStatus to 'completed', do not delete the task
        const updatedTask = await response.json();
        updateTaskInState(taskId, prevTasks => prevTasks.map(task =>
          task._id === taskId ? updatedTask : task
        ));
        toast.success('Verification status updated to completed');
      } else {
        const updatedTask = await response.json();
        updateTaskInState(taskId, prevTasks => prevTasks.map(task =>
          task._id === taskId ? updatedTask : task
        ));
        toast.success('Verification status updated successfully');
      }
    } catch (error) {
      console.error('Error updating verification status:', error);
      toast.error(error.message);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to complete task');
      }

      const updatedTask = await response.json();
      updateTaskInState(taskId, prevTasks => prevTasks.map(task =>
        task._id === taskId ? updatedTask : task
      ));
      setShowCompleteModal(false);
      setSelectedTaskForComplete(null);
      toast.success('Task completed successfully');
    } catch (error) {
      console.error('Error completing task:', error);
      toast.error(error.message);
    }
  };

  // Add a new function to check if actions should be disabled
  const shouldDisableActions = (task) => {
    // Disable actions for assigned tasks view
    if (viewType === 'under-verification' || viewType === 'assigned') {
      return true;
    }
    
    // Disable actions for received tasks in verification and completed tabs
    if (viewType === 'received' && (taskType === 'verification' || taskType === 'completed')) {
      return true;
    }
    
    return false;
  };

  // Add a new function to check if file/comment actions should be disabled
  const shouldDisableFileActions = (task) => {
    // Always allow file uploads and comments - never disable these
    return false;
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowFileUpload(true);
  };

  const handleFileUploaded = (uploadedFiles) => {
    updateTaskInState(selectedTask._id, prevTasks =>
      prevTasks.map(t =>
        t._id === selectedTask._id
          ? { ...t, files: [
              ...(t.files || []),
              ...uploadedFiles.filter(uf => !(t.files || []).some(f => f._id === uf._id))
            ] }
          : t
      )
    );
    setSelectedTask(prev =>
      prev && prev._id === selectedTask._id
        ? { ...prev, files: [
            ...(prev.files || []),
            ...uploadedFiles.filter(uf => !(prev.files || []).some(f => f._id === uf._id))
          ] }
        : prev
    );
  };

  const handleFileDeleted = (fileId) => {
    // Update the task in the list after file deletion
    updateTaskInState(selectedTask._id, prevTasks => 
      prevTasks.map(t => 
        t._id === selectedTask._id 
          ? { ...t, files: (t.files || []).filter(f => f._id !== fileId) }
          : t
      )
    );
  };

  const getFileIcon = (fileType) => {
    if (!fileType) return '📎'; // Default icon if no file type
    
    // Handle both mimetype and file extension
    const type = fileType.toLowerCase();
    
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('doc')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet') || type.includes('xls')) return '📊';
    if (type.includes('powerpoint') || type.includes('presentation') || type.includes('ppt')) return '📑';
    if (type.includes('text')) return '📄';
    return '📎';
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleVerifierAssignment = async (taskId, verifierId, isSecondVerifier = false) => {
    if (!verifierId) {
      toast.error('Please select a verifier');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/verification`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify({
          verificationStatus: isSecondVerifier ? 'first_verified' : 'executed',
          verifierId: verifierId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update verification status');
      }

      const updatedTask = await response.json();
      // Remove the task from the current user's view
      updateTaskInState(taskId, prevTasks => prevTasks.filter(t => t._id !== taskId));
      setShowVerifierModal(false);
      setShowSecondVerifierModal(false);
      setSelectedTaskForVerifier(null);
      toast.success(`Task assigned for ${isSecondVerifier ? 'second' : 'first'} verification successfully`);
    } catch (error) {
      console.error('Error updating verification status:', error);
      toast.error(error.message);
    }
  };

  // Update the getAllowedVerificationStatuses function to match the workflow
  const getAllowedVerificationStatuses = (task, loggedInUser) => {
    const isAssignee = task.assignedTo._id === loggedInUser._id;
    const isFirstVerifier = task.verificationAssignedTo?._id === loggedInUser._id;
    const isSecondVerifier = task.secondVerificationAssignedTo?._id === loggedInUser._id;

    let statuses = [];
    if (isAssignee) {
      statuses = ['executed'];
    } else if (isFirstVerifier) {
      statuses = ['rejected', 'first_verified', 'completed'];
    } else if (isSecondVerifier) {
      statuses = ['pending', 'rejected', 'completed'];
    } else {
      statuses = [task.verificationStatus];
    }
    // Always include the current status if not present
    if (task.verificationStatus && !statuses.includes(task.verificationStatus)) {
      statuses.push(task.verificationStatus);
    }
    return statuses;
  };

  // Update the handleStatusChange function to be independent of verification status
  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }

      const updatedTask = await response.json();
      updateTaskInState(taskId, prevTasks => prevTasks.map(task =>
        task._id === taskId ? updatedTask : task
      ));
      toast.success('Task status updated successfully');
    } catch (error) {
      console.error('Error updating task status:', error);
      toast.error(error.message);
    }
  };

  // Helper to get hours for a user on a task
  const getUserTaskHours = (taskId, userId) => {
    const entry = taskHours.find(
      (h) => h.taskId === (taskId?._id || taskId) && h.userId === (userId?._id || userId)
    );
    return entry ? entry.totalHours : 0;
  };

  // Add useEffect to close dropdown on outside click
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

  // Add this handler function in the component:
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
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify({ description: editingDescriptionValue }),
      });
      if (!response.ok) throw new Error('Failed to update description');
      const updatedTask = await response.json();
      setTasks(tasks.map(t => t._id === task._id ? {...t, description: updatedTask.description} : t));
      // updateTaskInState(task._id, prevTasks => prevTasks.map(t => t._id === task._id ? {...t, description: updatedTask.description} : t));
      toast.success('Status updated');
    } catch (error) {
      toast.error(error.message || 'Failed to update status');
    }
    setEditingDescriptionTaskId(null);
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
      <div className="text-red-500 text-center p-4">Error: {error}</div>
    );
  }

  const sortedTasks = getSortedTasks();

  return (
    <div className="space-y-4">
      {/* Responsive table wrapper */}
      <div className="overflow-x-auto w-full">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
                <th key={col.id} className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
              {viewType === 'assigned' && (
                <th className="px-4 py-3 sm:px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedTasks.map((task) => (
              <tr key={task._id} className="hover:bg-gray-50">
                {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => {
                  switch (col.id) {
                    case 'title':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{task.title}</div></td>;
                    case 'description':
                      return (
                        <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500 border border-gray-300 bg-white w-[180px] min-w-[180px]" style={{verticalAlign: 'middle'}}>
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
                              className="border border-gray-300 focus:border-blue-400 px-1 py-1 rounded w-full min-w-[140px] bg-white text-sm transition-colors"
                              style={{fontSize: '1rem', height: '32px'}}
                            />
                          ) : (
                            <span
                              className="cursor-pointer w-full block px-1 hover:border-gray-400 rounded border border-transparent"
                              style={{minWidth: '140px', display: 'block'}}
                              onClick={() => {
                                setEditingDescriptionTaskId(task._id);
                                setEditingDescriptionValue(task.description || '');
                              }}
                              title="Click to edit"
                            >
                              {task.description || 'N/A'}
                            </span>
                          )}
                        </td>
                      );
                    case 'clientName':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap"><div className="text-sm font-medium text-gray-900">{task.clientName}</div></td>;
                    case 'clientGroup':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap"><div className="text-sm text-gray-500">{task.clientGroup}</div></td>;
                    case 'workType':
                      return <td key={col.id} className="px-4 py-4 sm:px-6"><div className="flex overflow-x-auto whitespace-nowrap gap-1 no-scrollbar">{task.workType && task.workType.map((type, index) => (<span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">{type}</span>))}</div></td>;
                    case 'billed':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-center text-lg">{task.billed ? 'Yes' : 'No'}</td>;
                    case 'status':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500"><div className="flex items-center space-x-2">{task.assignedTo._id === loggedInUser._id && !shouldDisableActions(task) ? (<select value={task.status || ''} onChange={(e) => handleStatusChange(task._id, e.target.value)} className={`px-2 py-1 rounded text-sm ${getStatusColor(task.status)}`}><option value="in_progress">In Progress</option><option value="completed">Completed</option></select>) : (<span className={`px-2 py-1 rounded text-sm ${getStatusColor(task.status)}`}>{task.status ? task.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') : 'N/A'}</span>)}</div></td>;
                    case 'priority':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>{task.priority}</span></td>;
                    case 'inwardEntryDate':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500">{formatDateTime(task.inwardEntryDate)}</td>;
                    case 'dueDate':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500">{formatDate(task.dueDate)}</td>;
                    case 'targetDate':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500">{formatDate(task.targetDate)}</td>;
                    case 'assignedBy':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500"><div className="flex items-center space-x-2">{task.assignedBy ? (<><img src={task.assignedBy.photo?.url || defaultProfile} alt={`${task.assignedBy.firstName} ${task.assignedBy.lastName}`} className="h-8 w-8 rounded-full object-cover" onError={(e) => {e.target.onerror = null;e.target.src = defaultProfile;}} /><span>{`${task.assignedBy.firstName} ${task.assignedBy.lastName}`}</span></>) : (<span>N/A</span>)}</div></td>;
                    case 'assignedTo':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500"><div className="flex items-center">{task.assignedTo ? (<><img src={task.assignedTo.photo?.url || defaultProfile} alt={`${task.assignedTo.firstName} ${task.assignedTo.lastName}`} className="h-8 w-8 rounded-full object-cover border-2 border-white shadow-sm" onError={(e) => {e.target.onerror = null;e.target.src = defaultProfile;}} /><span className="ml-2">{task.assignedTo.firstName} {task.assignedTo.lastName}<span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">{getUserTaskHours(task._id, task.assignedTo._id)}h</span></span></>) : (<span>Unassigned</span>)}</div></td>;
                    case 'verificationAssignedTo':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500"><div className="flex items-center space-x-2">{task.verificationAssignedTo ? (<><img src={task.verificationAssignedTo.photo?.url || defaultProfile} alt={`${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}`} className="h-8 w-8 rounded-full object-cover" onError={(e) => {e.target.onerror = null;e.target.src = defaultProfile;}} /><span>{`${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}`}{getUserTaskHours(task._id, task.verificationAssignedTo._id) > 0 && (<span> ({getUserTaskHours(task._id, task.verificationAssignedTo._id)}h)</span>)}</span></>) : (<span>N/A</span>)}</div></td>;
                    case 'secondVerificationAssignedTo':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap text-sm text-gray-500"><div className="flex items-center space-x-2">{task.secondVerificationAssignedTo ? (<><img src={task.secondVerificationAssignedTo.photo?.url || defaultProfile} alt={`${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}`} className="h-8 w-8 rounded-full object-cover" onError={(e) => {e.target.onerror = null;e.target.src = defaultProfile;}} /><span>{`${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}`}{getUserTaskHours(task._id, task.secondVerificationAssignedTo._id) > 0 && (<span> ({getUserTaskHours(task._id, task.secondVerificationAssignedTo._id)}h)</span>)}</span></>) : (<span>N/A</span>)}</div></td>;
                    case 'files':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap"><div className="flex items-center">{task.files && task.files.length > 0 ? (<div className="flex items-center space-x-2"><span className="text-blue-600">{task.files.length}</span><span className="text-gray-500">files</span><button onClick={() => { setSelectedTask(task); setShowFileUpload(true); setShowComments(false); }} className="text-blue-600 hover:text-blue-800 text-sm">View</button></div>) : (<div className="flex items-center"><span className="text-gray-400 text-sm italic">No files</span>{!shouldDisableFileActions(task) && <button onClick={() => { setSelectedTask(task); setShowFileUpload(true); setShowComments(false); }} className="ml-2 text-blue-600 hover:text-blue-800 text-sm">Upload</button>}</div>)}</div></td>;
                    case 'comments':
                      return <td key={col.id} className="px-4 py-4 sm:px-6 whitespace-nowrap"><div className="flex items-center"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.comments ? task.comments.length : 0} comments</span><button onClick={() => { setSelectedTask(task); setShowComments(true); setShowFileUpload(false); }} className="ml-2 text-blue-600 hover:text-blue-800 text-xs">View</button></div></td>;
                    default:
                      return null;
                  }
                })}
                {viewType === 'assigned' && (
                  <td className="px-4 py-4 sm:px-6 whitespace-nowrap text-right">
                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded shadow text-xs font-semibold"
                    >
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && selectedTaskForVerification && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">
              {verificationStage === 'first' ? 'Assign First Verifier' : 'Assign Second Verifier'}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Verifier
              </label>
              <select
                value={selectedTaskForVerification.verificationAssignedTo || ''}
                onChange={(e) => {
                  const selectedUserId = e.target.value;
                  setSelectedTaskForVerification({
                    ...selectedTaskForVerification,
                    verificationAssignedTo: selectedUserId
                  });
                }}
                className="w-full border rounded-md px-3 py-2 bg-white"
                required
              >
                <option value="">Select Verifier</option>
                {getFilteredUsers(selectedTaskForVerification).map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowVerificationModal(false);
                  setSelectedTaskForVerification(null);
                  setVerificationStage('first');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRequestVerification(selectedTaskForVerification._id)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                {verificationStage === 'first' ? 'Assign First Verifier' : 'Assign Second Verifier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Confirmation Modal */}
      {showCompleteModal && selectedTaskForComplete && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white/95 rounded-lg p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-medium mb-4">Complete Task</h3>
            <p className="mb-4">Are you sure you want to mark this task as completed?</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowCompleteModal(false);
                  setSelectedTaskForComplete(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCompleteTask(selectedTaskForComplete._id)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Complete Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task details modal */}
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
                    {!shouldDisableFileActions(selectedTask) && (
                      <FileUpload
                        taskId={selectedTask._id}
                        onFileUploaded={handleFileUploaded}
                        onFileDeleted={handleFileDeleted}
                      />
                    )}
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

      {/* Verifier Selection Modal */}
      {showVerifierModal && selectedTaskForVerifier && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Assign Task for Verification</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Verifier
              </label>
              <select
                value={selectedTaskForVerifier.verificationAssignedTo || ''}
                onChange={(e) => {
                  const selectedUserId = e.target.value;
                  setSelectedTaskForVerifier({
                    ...selectedTaskForVerifier,
                    verificationAssignedTo: selectedUserId
                  });
                }}
                className="w-full border rounded-md px-3 py-2 bg-white"
                required
              >
                <option value="">Select Verifier</option>
                {getFilteredUsers(selectedTaskForVerifier).map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowVerifierModal(false);
                  setSelectedTaskForVerifier(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerifierAssignment(selectedTaskForVerifier._id, selectedTaskForVerifier.verificationAssignedTo)}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Assign Verifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Second Verifier Selection Modal */}
      {showSecondVerifierModal && selectedTaskForVerifier && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">Assign Second Verifier</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Second Verifier
              </label>
              <select
                value={selectedTaskForVerifier.secondVerificationAssignedTo || ''}
                onChange={(e) => {
                  const selectedUserId = e.target.value;
                  setSelectedTaskForVerifier({
                    ...selectedTaskForVerifier,
                    secondVerificationAssignedTo: selectedUserId
                  });
                }}
                className="w-full border rounded-md px-3 py-2 bg-white"
                required
              >
                <option value="">Select Second Verifier</option>
                {getFilteredUsers(selectedTaskForVerifier).map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => {
                  setShowSecondVerifierModal(false);
                  setSelectedTaskForVerifier(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleVerifierAssignment(
                  selectedTaskForVerifier._id, 
                  selectedTaskForVerifier.secondVerificationAssignedTo,
                  true
                )}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Assign Second Verifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add custom scrollbar styles */}
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
    </div>
  );
};

export default TaskList; 