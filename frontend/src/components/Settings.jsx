import defaultProfile from '../assets/avatar.jpg';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';
import ColumnManagement from './ColumnManagement';
import * as XLSX from 'xlsx';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const Settings = () => {
  const { user, updateUser } = useAuth();
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
  });
  const [tasks, setTasks] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('Account settings');
  
  // Priority management state
  const [priorities, setPriorities] = useState([]);
  const [loadingPriorities, setLoadingPriorities] = useState(false);
  const [newPriorityData, setNewPriorityData] = useState({ name: '', color: 'bg-gray-100 text-gray-800 border border-gray-200' });
  const [addingPriority, setAddingPriority] = useState(false);
  const [editingPriority, setEditingPriority] = useState(null);
  const [editPriorityData, setEditPriorityData] = useState({ name: '', color: '' });
  const [updatingPriority, setUpdatingPriority] = useState(false);
  const [prioritySearchTerm, setPrioritySearchTerm] = useState('');

  // Task Status/Stages management state
  const [taskStatuses, setTaskStatuses] = useState([]);
  const [loadingTaskStatuses, setLoadingTaskStatuses] = useState(false);
  const [newStatusData, setNewStatusData] = useState({ name: '', color: '#6B7280' });
  const [addingStatus, setAddingStatus] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [editingStatus, setEditingStatus] = useState(null);
  const [editStatusData, setEditStatusData] = useState({ name: '', color: '' });
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusSearchTerm, setStatusSearchTerm] = useState('');

  // Work Types management state
  const [workTypes, setWorkTypes] = useState([]);
  const [loadingWorkTypes, setLoadingWorkTypes] = useState(false);
  const [newWorkTypeName, setNewWorkTypeName] = useState('');
  const [addingWorkType, setAddingWorkType] = useState(false);
  const [editingWorkType, setEditingWorkType] = useState(null);
  const [editWorkTypeName, setEditWorkTypeName] = useState('');
  
  // Backup dropdown state
  const [showBackupDropdown, setShowBackupDropdown] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [exportingUser, setExportingUser] = useState(null);
  const [updatingWorkType, setUpdatingWorkType] = useState(false);
  const [workTypeSearchTerm, setWorkTypeSearchTerm] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [tasksRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/tasks?type=received`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);
        const tasksData = await tasksRes.json();
        setTasks(tasksData);
      } catch (error) {
        toast.error('Failed to fetch user stats');
      } finally {
        setLoadingStats(false);
      }
    };
    fetchStats();
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showBackupDropdown && !event.target.closest('.backup-dropdown-container')) {
        setShowBackupDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBackupDropdown]);

  // Calculate stats
  const totalTasks = tasks.length;
  const pendingOrInProgressTasks = tasks.filter(t => t.status === 'yet_to_start' || t.status === 'in_progress').length;
  const urgentTasks = tasks.filter(t => (t.status === 'yet_to_start' || t.status === 'in_progress') && t.priority === 'urgent').length;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhotoClick = () => {
    fileInputRef.current.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    setUploading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${user.token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload photo');
      }

      const data = await response.json();
      updateUser(data);
      toast.success('Profile photo updated successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const data = await response.json();
      updateUser(data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Priority management functions
  const fetchPriorities = async () => {
    if (user.role !== 'Admin' && user.role !== 'Team Head') return;
    
    setLoadingPriorities(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/priorities`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch priorities');
      const data = await response.json();
      setPriorities(data);
    } catch (error) {
      toast.error('Failed to fetch priorities');
    } finally {
      setLoadingPriorities(false);
    }
  };

  const addPriority = async () => {
    if (!newPriorityData.name.trim()) {
      toast.error('Priority name is required');
      return;
    }

    setAddingPriority(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/priorities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ 
          name: newPriorityData.name.trim(),
          color: newPriorityData.color
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add priority');
      }

      toast.success('Priority added successfully');
      setNewPriorityData({ name: '', color: 'bg-gray-100 text-gray-800 border border-gray-200' });
      fetchPriorities();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAddingPriority(false);
    }
  };

  const deletePriority = async (priorityId) => {
    if (!confirm('Are you sure you want to delete this priority?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/priorities/${priorityId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete priority');
      }

      toast.success('Priority deleted successfully');
      fetchPriorities();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const updatePriority = async (priorityId, newData) => {
    if (!newData.name.trim()) {
      toast.error('Priority name is required');
      return;
    }

    setUpdatingPriority(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/priorities/${priorityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ 
          name: newData.name.trim(),
          color: newData.color
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update priority');
      }

      toast.success('Priority updated successfully');
      setEditingPriority(null);
      setEditPriorityData({ name: '', color: '' });
      fetchPriorities();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingPriority(false);
    }
  };

  const handleEditPriority = (priority) => {
    setEditingPriority(priority._id);
    setEditPriorityData({ 
      name: priority.name,
      color: priority.color || 'bg-gray-100 text-gray-800 border border-gray-200' 
    });
  };

  const cancelEditPriority = () => {
    setEditingPriority(null);
    setEditPriorityData({ name: '', color: '' });
  };

  // Handle priority drag and drop
  const handlePriorityDragEnd = async (result) => {
    if (!result.destination) {
      return;
    }

    const filteredPriorities = priorities.filter(priority => 
      prioritySearchTerm === '' || 
      priority.name.toLowerCase().includes(prioritySearchTerm.toLowerCase())
    );

    const reorderedPriorities = Array.from(filteredPriorities);
    const [reorderedItem] = reorderedPriorities.splice(result.source.index, 1);
    reorderedPriorities.splice(result.destination.index, 0, reorderedItem);

    // Update the local state immediately for better UX
    const newPriorities = priorities.map(priority => {
      const indexInFiltered = filteredPriorities.findIndex(p => p._id === priority._id);
      if (indexInFiltered !== -1) {
        const newIndex = reorderedPriorities.findIndex(p => p._id === priority._id);
        return { ...priority, order: newIndex + 1 };
      }
      return priority;
    });
    
    setPriorities(newPriorities.sort((a, b) => a.order - b.order));

    // Send update to backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/priorities/bulk-update-order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          priorities: reorderedPriorities
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update priority order');
      }

      toast.success('Priority order updated successfully');
      // Refresh the priorities to ensure consistency
      fetchPriorities();
    } catch (error) {
      toast.error(error.message);
      // Revert the local state on error
      fetchPriorities();
    }
  };

  // Bulk update functions
  const updatePriorityWithBulkCheck = async (priorityId, newData, oldName) => {
    // If name hasn't changed, proceed with normal update
    if (newData.name.trim() === oldName) {
      return updatePriority(priorityId, newData);
    }

    // If name changed, execute bulk update directly
    setUpdatingPriority(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bulk-update/execute-priority-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          oldName: oldName,
          newName: newData.name.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update priority');
      }

      const result = await response.json();
      toast.success(`Successfully updated ${result.updatedTasksCount} tasks and priority name`);
      
      fetchPriorities();
      setEditingPriority(null);
      setEditPriorityData({ name: '', color: '' });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingPriority(false);
    }
  };

  const updateStatusWithBulkCheck = async (statusId, newData, oldName) => {
    // If name hasn't changed, proceed with normal update
    if (newData.name.trim() === oldName) {
      return updateTaskStatus(statusId, newData);
    }

    // If name changed, execute bulk update directly
    setUpdatingStatus(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bulk-update/execute-status-update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          oldName: oldName,
          newName: newData.name.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status');
      }

      const result = await response.json();
      toast.success(`Successfully updated ${result.updatedTasksCount} tasks and status name`);
      
      fetchTaskStatuses();
      setEditingStatus(null);
      setEditStatusData({ name: '', color: '' });
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Fetch priorities when tab changes to Priority Management
  useEffect(() => {
    if (activeTab === 'Priority Management') {
      fetchPriorities();
      setPrioritySearchTerm('');
      setNewPriorityData({ name: '', color: 'bg-gray-100 text-gray-800 border border-gray-200' });
    } else if (activeTab === 'Stages') {
      fetchTaskStatuses();
      setStatusSearchTerm('');
      setNewStatusData({ name: '', color: '#6B7280' });
    } else if (activeTab === 'Works') {
      fetchWorkTypes();
      setWorkTypeSearchTerm('');
      setNewWorkTypeName('');
    }
  }, [activeTab]);

  // Task Status/Stages management functions
  const fetchTaskStatuses = async () => {
    setLoadingTaskStatuses(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/task-statuses`, {
        headers: { 
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch task statuses');
      }
      const data = await response.json();
      setTaskStatuses(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingTaskStatuses(false);
    }
  };

  const addTaskStatus = async () => {
    if (!newStatusData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setAddingStatus(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/task-statuses`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newStatusData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add task status');
      }

      toast.success('Task status added successfully');
      setNewStatusData({ name: '', color: '#6B7280' });
      fetchTaskStatuses();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAddingStatus(false);
    }
  };

  const deleteTaskStatus = async (statusId, statusName) => {
    if (!confirm(`Are you sure you want to delete the "${statusName}" status? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/task-statuses/${statusId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete task status');
      }

      toast.success('Task status deleted successfully');
      fetchTaskStatuses();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const updateTaskStatus = async (statusId, newData) => {
    if (!newData.name.trim()) {
      toast.error('Status name is required');
      return;
    }

    setUpdatingStatus(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/task-statuses/${statusId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(newData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update task status');
      }

      toast.success('Task status updated successfully');
      setEditingStatus(null);
      setEditStatusData({ name: '', color: '' });
      fetchTaskStatuses();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEditTaskStatus = (status) => {
    setEditingStatus(status._id);
    setEditStatusData({ 
      name: status.name, 
      color: status.hexColor || status.color || '#6B7280' 
    });
  };

  const cancelEditTaskStatus = () => {
    setEditingStatus(null);
    setEditStatusData({ name: '', color: '' });
  };

  // Handle task status drag and drop
  const handleStatusDragEnd = async (result) => {
    if (!result.destination) {
      return;
    }

    const filteredStatuses = taskStatuses.filter(status => 
      statusSearchTerm === '' || 
      status.name.toLowerCase().includes(statusSearchTerm.toLowerCase())
    );

    const reorderedStatuses = Array.from(filteredStatuses);
    const [reorderedItem] = reorderedStatuses.splice(result.source.index, 1);
    reorderedStatuses.splice(result.destination.index, 0, reorderedItem);

    // Update the local state immediately for better UX
    const newStatuses = taskStatuses.map(status => {
      const indexInFiltered = filteredStatuses.findIndex(s => s._id === status._id);
      if (indexInFiltered !== -1) {
        const newIndex = reorderedStatuses.findIndex(s => s._id === status._id);
        return { ...status, order: newIndex + 1 };
      }
      return status;
    });
    
    setTaskStatuses(newStatuses.sort((a, b) => a.order - b.order));

    // Send update to backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/task-statuses/bulk-update-order`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          statuses: reorderedStatuses
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update status order');
      }

      toast.success('Status order updated successfully');
      // Refresh the statuses to ensure consistency
      fetchTaskStatuses();
    } catch (error) {
      toast.error(error.message);
      // Revert the local state on error
      fetchTaskStatuses();
    }
  };

  // Work Types management functions
  const fetchWorkTypes = async () => {
    if (user.role !== 'Admin' && user.role !== 'Team Head') return;
    
    setLoadingWorkTypes(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/work-types`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch work types');
      const data = await response.json();
      setWorkTypes(data);
    } catch (error) {
      toast.error('Failed to fetch work types');
    } finally {
      setLoadingWorkTypes(false);
    }
  };

  const addWorkType = async () => {
    if (!newWorkTypeName.trim()) {
      toast.error('Work type name is required');
      return;
    }

    setAddingWorkType(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/work-types`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ name: newWorkTypeName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add work type');
      }

      toast.success('Work type added successfully');
      setNewWorkTypeName('');
      fetchWorkTypes();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAddingWorkType(false);
    }
  };

  const updateWorkType = async (workTypeId, newName) => {
    if (!newName.trim()) {
      toast.error('Work type name is required');
      return;
    }

    setUpdatingWorkType(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/work-types/${workTypeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update work type');
      }

      toast.success('Work type updated successfully');
      setEditingWorkType(null);
      setEditWorkTypeName('');
      fetchWorkTypes();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setUpdatingWorkType(false);
    }
  };

  const deleteWorkType = async (workTypeId, workTypeName) => {
    // First check if it can be deleted
    try {
      const checkResponse = await fetch(`${API_BASE_URL}/api/work-types/${workTypeId}/can-delete`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      if (!checkResponse.ok) {
        throw new Error('Failed to check work type deletion');
      }
      
      const checkData = await checkResponse.json();
      
      if (!checkData.canDelete) {
        toast.error(`Cannot delete "${workTypeName}". It is being used in ${checkData.tasksCount} task(s).`);
        return;
      }

      if (!confirm(`Are you sure you want to delete the "${workTypeName}" work type?`)) {
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/work-types/${workTypeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete work type');
      }

      toast.success('Work type deleted successfully');
      fetchWorkTypes();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleEditWorkType = (workType) => {
    setEditingWorkType(workType._id);
    setEditWorkTypeName(workType.name);
  };

  const cancelEditWorkType = () => {
    setEditingWorkType(null);
    setEditWorkTypeName('');
  };

  // Database backup function (Admin only) - No confirmation needed
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/backup/database`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create backup');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'database-backup.gz';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary anchor element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Database backup downloaded successfully');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Excel export function (Admin only) - Show dropdown instead of immediate export
  const handleExcelExport = async () => {
    if (!showBackupDropdown) {
      // Fetch users first
      setLoadingUsers(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/backup/users`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${user.token}`,
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch users');
        }

        const usersData = await response.json();
        setUsers(usersData);
        setShowBackupDropdown(true);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoadingUsers(false);
      }
    } else {
      setShowBackupDropdown(false);
    }
  };

  // Export tasks for specific user
  const handleUserTaskExport = async (userId, userName) => {
    setExportingUser(userId);
    try {
      const response = await fetch(`${API_BASE_URL}/api/backup/tasks/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to export tasks');
      }

      const tasks = await response.json();

      if (!tasks || tasks.length === 0) {
        toast.error(`No tasks found for ${userName}`);
        return;
      }

      // Prepare data for Excel export
      const excelData = tasks.map(task => ({
        'Task ID': task._id,
        'Title': task.title,
        'Description': task.description,
        'Status': task.status,
        'Priority': task.priority,
        'Client Name': task.clientName || '',
        'Client Group': task.clientGroup || '',
        'Work Type': task.workType || '',
        'Assigned To': task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '',
        'Assigned To Email': task.assignedTo?.email || '',
        'Assigned By': task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : '',
        'Assigned By Email': task.assignedBy?.email || '',
        'Verification Status': task.verificationStatus || '',
        'Verification': task.verification || '',
        'Primary Verifier': task.verificationAssignedTo ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}` : '',
        'Second Verifier': task.secondVerificationAssignedTo ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}` : '',
        'Third Verifier': task.thirdVerificationAssignedTo ? `${task.thirdVerificationAssignedTo.firstName} ${task.thirdVerificationAssignedTo.lastName}` : '',
        'Fourth Verifier': task.fourthVerificationAssignedTo ? `${task.fourthVerificationAssignedTo.firstName} ${task.fourthVerificationAssignedTo.lastName}` : '',
        'Fifth Verifier': task.fifthVerificationAssignedTo ? `${task.fifthVerificationAssignedTo.firstName} ${task.fifthVerificationAssignedTo.lastName}` : '',
        'Guides': task.guides?.map(guide => `${guide.firstName} ${guide.lastName}`).join(', ') || '',
        'Inward Entry Date': task.inwardEntryDate ? new Date(task.inwardEntryDate).toLocaleDateString() : '',
        'Due Date': task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '',
        'Target Date': task.targetDate ? new Date(task.targetDate).toLocaleDateString() : '',
        'Created At': new Date(task.createdAt).toLocaleDateString(),
        'Updated At': new Date(task.updatedAt).toLocaleDateString(),
        'Billed': task.billed ? 'Yes' : 'No',
        'Self Verification': task.selfVerification ? 'Yes' : 'No',
        'Files Count': task.files?.length || 0,
        'Comments Count': task.comments?.length || 0,
        'Custom Fields': task.customFields ? JSON.stringify(task.customFields) : '',
        'Verification Comments': task.verificationComments || ''
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Auto-size columns
      const colWidths = [];
      const headers = Object.keys(excelData[0] || {});
      if (headers.length > 0) {
        headers.forEach((header, index) => {
          const maxLength = Math.max(
            header.length,
            ...excelData.map(row => (row[header] || '').toString().length)
          );
          colWidths[index] = { wch: Math.min(maxLength + 2, 50) }; // Max width of 50
        });
        worksheet['!cols'] = colWidths;
      }

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, `Tasks - ${userName}`);

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `tasks_${userName.replace(/\s+/g, '_')}_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(workbook, filename);

      toast.success(`Tasks for ${userName} exported successfully`);
      setShowBackupDropdown(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExportingUser(null);
    }
  };

  // Export all data (tasks, priorities, stages, work types)
  const handleAllDataExport = async () => {
    setExportingUser('all');
    try {
      const response = await fetch(`${API_BASE_URL}/api/backup/all-data`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${user.token}`,
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to export all data');
      }

      const data = await response.json();
      const { tasks, priorities, taskStatuses, workTypes } = data;

      // Create workbook
      const workbook = XLSX.utils.book_new();

      // Tasks Sheet
      if (tasks && tasks.length > 0) {
        const tasksData = tasks.map(task => ({
          'Task ID': task._id,
          'Title': task.title,
          'Description': task.description,
          'Status': task.status,
          'Priority': task.priority,
          'Client Name': task.clientName || '',
          'Client Group': task.clientGroup || '',
          'Work Type': task.workType || '',
          'Assigned To': task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : '',
          'Assigned To Email': task.assignedTo?.email || '',
          'Assigned By': task.assignedBy ? `${task.assignedBy.firstName} ${task.assignedBy.lastName}` : '',
          'Assigned By Email': task.assignedBy?.email || '',
          'Verification Status': task.verificationStatus || '',
          'Verification': task.verification || '',
          'Primary Verifier': task.verificationAssignedTo ? `${task.verificationAssignedTo.firstName} ${task.verificationAssignedTo.lastName}` : '',
          'Second Verifier': task.secondVerificationAssignedTo ? `${task.secondVerificationAssignedTo.firstName} ${task.secondVerificationAssignedTo.lastName}` : '',
          'Third Verifier': task.thirdVerificationAssignedTo ? `${task.thirdVerificationAssignedTo.firstName} ${task.thirdVerificationAssignedTo.lastName}` : '',
          'Fourth Verifier': task.fourthVerificationAssignedTo ? `${task.fourthVerificationAssignedTo.firstName} ${task.fourthVerificationAssignedTo.lastName}` : '',
          'Fifth Verifier': task.fifthVerificationAssignedTo ? `${task.fifthVerificationAssignedTo.firstName} ${task.fifthVerificationAssignedTo.lastName}` : '',
          'Guides': task.guides?.map(guide => `${guide.firstName} ${guide.lastName}`).join(', ') || '',
          'Inward Entry Date': task.inwardEntryDate ? new Date(task.inwardEntryDate).toLocaleDateString() : '',
          'Due Date': task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '',
          'Target Date': task.targetDate ? new Date(task.targetDate).toLocaleDateString() : '',
          'Created At': new Date(task.createdAt).toLocaleDateString(),
          'Updated At': new Date(task.updatedAt).toLocaleDateString(),
          'Billed': task.billed ? 'Yes' : 'No',
          'Self Verification': task.selfVerification ? 'Yes' : 'No',
          'Files Count': task.files?.length || 0,
          'Comments Count': task.comments?.length || 0,
          'Custom Fields': task.customFields ? JSON.stringify(task.customFields) : '',
          'Verification Comments': task.verificationComments || ''
        }));

        const tasksWorksheet = XLSX.utils.json_to_sheet(tasksData);
        
        // Auto-size columns for tasks
        const tasksHeaders = Object.keys(tasksData[0] || {});
        if (tasksHeaders.length > 0) {
          const tasksColWidths = tasksHeaders.map(header => {
            const maxLength = Math.max(
              header.length,
              ...tasksData.map(row => (row[header] || '').toString().length)
            );
            return { wch: Math.min(maxLength + 2, 50) };
          });
          tasksWorksheet['!cols'] = tasksColWidths;
        }
        
        XLSX.utils.book_append_sheet(workbook, tasksWorksheet, 'All Tasks');
      }

      // Priorities Sheet
      if (priorities && priorities.length > 0) {
        const prioritiesData = priorities.map((priority, index) => ({
          'S.No': index + 1,
          'Priority Name': priority.name,
          'Is Default': priority.isDefault ? 'Yes' : 'No',
          'Order': priority.order || '',
          'Created At': priority.createdAt ? new Date(priority.createdAt).toLocaleDateString() : ''
        }));

        const prioritiesWorksheet = XLSX.utils.json_to_sheet(prioritiesData);
        XLSX.utils.book_append_sheet(workbook, prioritiesWorksheet, 'Priorities');
      }

      // Task Statuses/Stages Sheet
      if (taskStatuses && taskStatuses.length > 0) {
        const statusesData = taskStatuses.map((status, index) => ({
          'S.No': index + 1,
          'Status Name': status.name,
          'Color': status.color || '',
          'Is Default': status.isDefault ? 'Yes' : 'No',
          'Order': status.order || '',
          'Created At': status.createdAt ? new Date(status.createdAt).toLocaleDateString() : ''
        }));

        const statusesWorksheet = XLSX.utils.json_to_sheet(statusesData);
        XLSX.utils.book_append_sheet(workbook, statusesWorksheet, 'Task Stages');
      }

      // Work Types Sheet
      if (workTypes && workTypes.length > 0) {
        const workTypesData = workTypes.map((workType, index) => ({
          'S.No': index + 1,
          'Work Type Name': workType.name,
          'Created At': workType.createdAt ? new Date(workType.createdAt).toLocaleDateString() : ''
        }));

        const workTypesWorksheet = XLSX.utils.json_to_sheet(workTypesData);
        XLSX.utils.book_append_sheet(workbook, workTypesWorksheet, 'Work Types');
      }

      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `complete_backup_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(workbook, filename);

      toast.success('Complete data backup exported successfully');
      setShowBackupDropdown(false);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExportingUser(null);
    }
  };

  const tabs = [
    'Account settings',
    ...(user.role === 'Admin' || user.role === 'Team Head' ? ['Priority Management', 'Stages', 'Works'] : []),
    ...(user.role === 'Admin' ? ['Attributes'] : [])
  ];

  return (
    <div className="bg-white min-h-screen">
      {/* Profile Card */}
      <div className="bg-[#485bbd] px-4 sm:px-8 py-4 flex flex-col md:flex-row items-center gap-4 md:gap-6 relative">
        {/* Admin Buttons */}
        {user.role === 'Admin' && (
          <div className="absolute top-4 right-4 flex gap-2">
            {/* Excel Backup Button with Dropdown */}
            <div className="relative backup-dropdown-container">
              <button
                onClick={handleExcelExport}
                disabled={loadingUsers}
                className="bg-green-600/20 hover:bg-green-600/30 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title="Export Tasks to Excel"
              >
                {loadingUsers ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Backup Excel
                    <svg className={`h-4 w-4 transition-transform duration-200 ${showBackupDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
              
              {/* Dropdown Menu */}
              {showBackupDropdown && (
                <div className="absolute top-full right-0 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-64 max-h-80 overflow-y-auto">
                  {/* All Data Option */}
                  <div className="p-2 border-b border-gray-100">
                    <button
                      onClick={() => handleAllDataExport()}
                      disabled={exportingUser === 'all'}
                      className="w-full text-left px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors duration-200 flex items-center gap-3 text-sm font-medium text-gray-700 disabled:opacity-50"
                    >
                      {exportingUser === 'all' ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Exporting All Data...</span>
                        </>
                      ) : (
                        <>
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <div className="font-semibold text-blue-600">All Data</div>
                            <div className="text-xs text-gray-500">Tasks, Priorities, Stages & Work Types</div>
                          </div>
                        </>
                      )}
                    </button>
                  </div>
                  
                  {/* Users List */}
                  <div className="p-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-2">Select User</div>
                    {users.map((user) => (
                      <button
                        key={user._id}
                        onClick={() => handleUserTaskExport(user._id, `${user.firstName} ${user.lastName}`)}
                        disabled={exportingUser === user._id}
                        className="w-full text-left px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 flex items-center gap-3 text-sm disabled:opacity-50"
                      >
                        {exportingUser === user._id ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Exporting...</span>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-sm font-semibold">
                                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-700">{user.firstName} {user.lastName}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </div>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Database Backup Button */}
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download Database Backup"
            >
              {isBackingUp ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  Backup DB
                </>
              )}
            </button>
          </div>
        )}
        
        <div className="flex flex-col md:flex-row items-center w-full md:w-auto gap-4">
          <div className="relative">
            <img
              src={user.photo?.url || defaultProfile}
              alt="Profile"
              className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white object-cover shadow-lg bg-white"
            />
            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoChange}
              className="hidden"
              accept="image/*"
            />
            <button
              onClick={handlePhotoClick}
              disabled={uploading}
              className="absolute bottom-0 right-0 bg-gray-200 rounded-full p-1 cursor-pointer border border-gray-300 hover:bg-gray-300 transition-colors"
            >
              {uploading ? (
                <svg className="animate-spin h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13h3l8-8a2.828 2.828 0 00-4-4l-8 8v3zm0 0v3h3" />
                </svg>
              )}
            </button>
          </div>
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-xl md:text-2xl text-white">{user.firstName} {user.lastName}</span>
            <span className="text-white text-sm md:text-[14px] mt-1">{user.email}</span>
            <span className="text-xs md:text-[12px] mt-1 bg-[#4f46e5] text-white px-2 py-0.5 rounded inline-block">
              {user.role}
            </span>
          </div>
        </div>
        {/* Stats 2x2 Grid */}
        <div className="grid grid-cols-2 gap-4 w-full md:w-auto md:flex md:flex-col md:justify-around md:items-start md:pb-2 md:mt-0">
          <div className="flex flex-col items-center md:flex-row md:gap-16">
            {/* Stat: Total Tasks Ever Received */}
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-4xl text-white">{loadingStats ? '-' : totalTasks}</span>
              <span className="text-xs uppercase font-bold text-gray-300 tracking-wide mt-1 text-center">Total Tasks</span>
            </div>
            {/* Stat: Pending/In-Progress Tasks */}
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-4xl text-white">{loadingStats ? '-' : pendingOrInProgressTasks}</span>
              <span className="text-xs uppercase font-bold text-gray-300 tracking-wide mt-1 text-center">Pending Tasks</span>
            </div>
          </div>
          <div className="flex flex-col items-center md:flex-row md:gap-16 mt-0 md:mt-2">
            {/* Stat: Urgent Pending/In-Progress Tasks */}
            <div className="flex flex-col items-center">
              <span className="text-2xl md:text-4xl text-white">{loadingStats ? '-' : urgentTasks}</span>
              <span className="text-xs uppercase font-bold text-gray-300 tracking-wide mt-1 text-center">Urgent Tasks</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white">
        <nav className="-mb-px flex space-x-8 overflow-x-auto px-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm focus:outline-none transition-all ${
                tab === activeTab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-blue-700 hover:border-blue-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* Content Area */}
      <div className="max-w-4xl bg-white rounded-lg p-4 md:p-0 mx-auto">
        {activeTab === 'Account settings' && (
          <>
            <h2 className="text-lg font-semibold px-0 md:px-6 py-4">Account settings</h2>
            <form onSubmit={handleSubmit}>
              <div className="divide-y divide-gray-200">
                <div className="flex flex-col md:flex-row md:items-center px-0 md:px-6 py-3">
                  <div className="w-full md:w-1/3 text-gray-600 font-medium mb-2 md:mb-0">First Name</div>
                  <div className="w-full md:w-2/3">
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="First Name"
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center px-0 md:px-6 py-3">
                  <div className="w-full md:w-1/3 text-gray-600 font-medium mb-2 md:mb-0">Last Name</div>
                  <div className="w-full md:w-2/3">
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Last Name"
                    />
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center px-0 md:px-6 py-3">
                  <div className="w-full md:w-1/3 text-gray-600 font-medium mb-2 md:mb-0">Email</div>
                  <div className="w-full md:w-2/3">
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-gray-500 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                </div>
              </div>
              <div className="px-0 md:px-6 py-4 bg-white text-right">
                <button
                  type="submit"
                  className="w-full md:w-auto bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition-colors shadow-sm border-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Save
                </button>
              </div>
            </form>
          </>
        )}

        {activeTab === 'Priority Management' && (user.role === 'Admin' || user.role === 'Team Head') && (
          <>
            <h2 className="text-lg font-semibold px-0 md:px-6 py-4">Priority Management</h2>
            
            {/* Add New Priority */}
            <div className="px-0 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-md font-medium text-gray-800 mb-3">Add New Priority</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  value={newPriorityData.name}
                  onChange={(e) => {
                    setNewPriorityData({...newPriorityData, name: e.target.value});
                    setPrioritySearchTerm(e.target.value);
                  }}
                  placeholder="Search priorities or add new priority name"
                  className="bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex gap-2">
                  <select
                    value={newPriorityData.color}
                    onChange={(e) => setNewPriorityData({...newPriorityData, color: e.target.value})}
                    className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="bg-red-100 text-red-800 border border-red-200">Red (Urgent)</option>
                    <option value="bg-orange-100 text-orange-800 border border-orange-200">Orange (High)</option>
                    <option value="bg-yellow-100 text-yellow-800 border border-yellow-200">Yellow (Medium-High)</option>
                    <option value="bg-blue-100 text-blue-800 border border-blue-200">Blue (Medium)</option>
                    <option value="bg-indigo-100 text-indigo-800 border border-indigo-200">Indigo (Normal)</option>
                    <option value="bg-gray-100 text-gray-800 border border-gray-200">Gray (Default)</option>
                    <option value="bg-purple-100 text-purple-800 border border-purple-200">Purple (Low)</option>
                    <option value="bg-teal-100 text-teal-800 border border-teal-200">Teal (Very Low)</option>
                    <option value="bg-slate-100 text-slate-600 border border-slate-200">Slate (Lowest)</option>
                    <option value="bg-green-100 text-green-800 border border-green-200">Green</option>
                    <option value="bg-pink-100 text-pink-800 border border-pink-200">Pink</option>
                    <option value="bg-cyan-100 text-cyan-800 border border-cyan-200">Cyan</option>
                  </select>
                  <div className={`w-12 h-10 rounded-md ${newPriorityData.color} flex items-center justify-center`}>
                    <span className="text-xs font-medium">●</span>
                  </div>
                </div>
              </div>
              <button
                onClick={addPriority}
                disabled={addingPriority || !newPriorityData.name.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed w-full md:w-auto"
              >
                {addingPriority ? 'Adding...' : 'Add Priority'}
              </button>
            </div>

            {/* Priorities List */}
            <div className="px-0 md:px-6 py-4">
              <h3 className="text-md font-medium text-gray-800 mb-3">
                Current Priorities 
                <span className="text-sm text-gray-500 ml-2">(Drag to reorder)</span>
              </h3>
              
              {loadingPriorities ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading priorities...</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handlePriorityDragEnd}>
                  <Droppable droppableId="priorities">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg p-2' : ''}`}
                      >
                        {priorities
                          .filter(priority => 
                            prioritySearchTerm === '' || 
                            priority.name.toLowerCase().includes(prioritySearchTerm.toLowerCase())
                          )
                          .map((priority, index) => (
                            <Draggable
                              key={priority._id || priority.name}
                              draggableId={priority._id || priority.name}
                              index={index}
                              isDragDisabled={editingPriority === priority._id}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 transition-all ${
                                    snapshot.isDragging ? 'shadow-lg rotate-1 bg-white' : ''
                                  } ${editingPriority === priority._id ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    {/* Drag Handle */}
                                    <div
                                      {...provided.dragHandleProps}
                                      className={`cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded ${
                                        editingPriority === priority._id ? 'opacity-50 cursor-not-allowed' : ''
                                      }`}
                                      title={editingPriority === priority._id ? 'Cannot drag while editing' : 'Drag to reorder'}
                                    >
                                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM8 4h4v2H8V4zm0 4h4v2H8V8zm0 4h4v2H8v-2z"/>
                                      </svg>
                                    </div>

                                    {/* Priority Content */}
                                    <div className="flex-1">
                                      {editingPriority === priority._id ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                          <input
                                            type="text"
                                            value={editPriorityData.name}
                                            onChange={(e) => setEditPriorityData({...editPriorityData, name: e.target.value})}
                                            className="bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                            autoFocus
                                          />
                                          <div className="flex gap-2">
                                            <select
                                              value={editPriorityData.color}
                                              onChange={(e) => setEditPriorityData({...editPriorityData, color: e.target.value})}
                                              className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                              <option value="bg-red-100 text-red-800 border border-red-200">Red (Urgent)</option>
                                              <option value="bg-orange-100 text-orange-800 border border-orange-200">Orange (High)</option>
                                              <option value="bg-yellow-100 text-yellow-800 border border-yellow-200">Yellow (Medium-High)</option>
                                              <option value="bg-blue-100 text-blue-800 border border-blue-200">Blue (Medium)</option>
                                              <option value="bg-indigo-100 text-indigo-800 border border-indigo-200">Indigo (Normal)</option>
                                              <option value="bg-gray-100 text-gray-800 border border-gray-200">Gray (Default)</option>
                                              <option value="bg-purple-100 text-purple-800 border border-purple-200">Purple (Low)</option>
                                              <option value="bg-teal-100 text-teal-800 border border-teal-200">Teal (Very Low)</option>
                                              <option value="bg-slate-100 text-slate-600 border border-slate-200">Slate (Lowest)</option>
                                              <option value="bg-green-100 text-green-800 border border-green-200">Green</option>
                                              <option value="bg-pink-100 text-pink-800 border border-pink-200">Pink</option>
                                              <option value="bg-cyan-100 text-cyan-800 border border-cyan-200">Cyan</option>
                                            </select>
                                            <div className={`w-12 h-10 rounded-md ${editPriorityData.color} flex items-center justify-center`}>
                                              <span className="text-xs font-medium">●</span>
                                            </div>
                                          </div>
                                          <div className="md:col-span-2 flex gap-2">
                                            <button
                                              onClick={() => updatePriorityWithBulkCheck(priority._id, editPriorityData, priority.name)}
                                              disabled={updatingPriority || !editPriorityData.name.trim()}
                                              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors disabled:bg-gray-400"
                                            >
                                              {updatingPriority ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                              onClick={cancelEditPriority}
                                              disabled={updatingPriority}
                                              className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors disabled:bg-gray-400"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-3">
                                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${priority.color || 'bg-gray-100 text-gray-800 border border-gray-200'}`}>
                                            {priority.name}
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-600">Order: {priority.order || 'N/A'}</span>
                                            {priority.createdBy && (
                                              <span className="text-xs text-gray-500">
                                                by {priority.createdBy.firstName} {priority.createdBy.lastName}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {editingPriority !== priority._id && (
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleEditPriority(priority)}
                                        className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full transition-colors"
                                        title="Edit priority"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => deletePriority(priority._id)}
                                        className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-full transition-colors"
                                        title="Delete priority"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                        
                        {priorities.filter(priority => 
                          prioritySearchTerm === '' || 
                          priority.name.toLowerCase().includes(prioritySearchTerm.toLowerCase())
                        ).length === 0 && (
                          <p className="text-gray-600 text-center py-4">
                            {prioritySearchTerm ? 'No priorities found matching your search.' : 'No priorities found.'}
                          </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </>
        )}

        {activeTab === 'Stages' && (user.role === 'Admin' || user.role === 'Team Head') && (
          <>
            <h2 className="text-lg font-semibold px-0 md:px-6 py-4">Task Status Management</h2>
            
            {/* Add New Task Status */}
            <div className="px-0 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-md font-medium text-gray-800 mb-3">Add New Task Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  value={newStatusData.name}
                  onChange={(e) => {
                    setNewStatusData(prev => ({ ...prev, name: e.target.value }));
                    setStatusSearchTerm(e.target.value);
                  }}
                  placeholder="Search statuses or add new status name"
                  className="bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex gap-3">
                  <input
                    type="color"
                    value={newStatusData.color}
                    onChange={(e) => setNewStatusData(prev => ({ ...prev, color: e.target.value }))}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                    title="Status color"
                  />
                  <button
                    onClick={addTaskStatus}
                    disabled={addingStatus || !newStatusData.name.trim()}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {addingStatus ? 'Adding...' : 'Add Status'}
                  </button>
                </div>
              </div>
            </div>

            {/* Task Statuses List */}
            <div className="px-0 md:px-6 py-4">
              <h3 className="text-md font-medium text-gray-800 mb-3">
                Current Task Statuses 
                <span className="text-sm text-gray-500 ml-2">(Drag to reorder)</span>
              </h3>
              
              {loadingTaskStatuses ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading task statuses...</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={handleStatusDragEnd}>
                  <Droppable droppableId="taskStatuses">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`space-y-2 ${snapshot.isDraggingOver ? 'bg-blue-50 rounded-lg p-2' : ''}`}
                      >
                        {taskStatuses
                          .filter(status => 
                            statusSearchTerm === '' || 
                            status.name.toLowerCase().includes(statusSearchTerm.toLowerCase())
                          )
                          .map((status, index) => (
                            <Draggable
                              key={status._id || status.name}
                              draggableId={status._id || status.name}
                              index={index}
                              isDragDisabled={editingStatus === status._id}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 transition-all ${
                                    snapshot.isDragging ? 'shadow-lg rotate-1 bg-white' : ''
                                  } ${editingStatus === status._id ? 'ring-2 ring-blue-500' : ''}`}
                                >
                                  <div className="flex items-center gap-3 flex-1">
                                    {/* Drag Handle */}
                                    <div
                                      {...provided.dragHandleProps}
                                      className={`cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded ${
                                        editingStatus === status._id ? 'opacity-50 cursor-not-allowed' : ''
                                      }`}
                                      title={editingStatus === status._id ? 'Cannot drag while editing' : 'Drag to reorder'}
                                    >
                                      <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zM8 4h4v2H8V4zm0 4h4v2H8V8zm0 4h4v2H8v-2z"/>
                                      </svg>
                                    </div>

                                    {/* Status Content */}
                                    <div className="flex items-center space-x-4 flex-1">
                                      <div 
                                        className="w-4 h-4 rounded-full border border-gray-300"
                                        style={{ backgroundColor: status.hexColor || status.color }}
                                        title={`Status color: ${status.hexColor || status.color}`}
                                      ></div>
                                      <div className="flex-1">
                                        {editingStatus === status._id ? (
                                          <div className="flex gap-2">
                                            <input
                                              type="text"
                                              value={editStatusData.name}
                                              onChange={(e) => setEditStatusData(prev => ({ ...prev, name: e.target.value }))}
                                              className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                                              autoFocus
                                            />
                                            <input
                                              type="color"
                                              value={editStatusData.color}
                                              onChange={(e) => setEditStatusData(prev => ({ ...prev, color: e.target.value }))}
                                              className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                                              title="Status color"
                                            />
                                            <button
                                              onClick={() => updateStatusWithBulkCheck(status._id, editStatusData, status.name)}
                                              disabled={updatingStatus || !editStatusData.name.trim()}
                                              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors disabled:bg-gray-400"
                                            >
                                              {updatingStatus ? 'Saving...' : 'Save'}
                                            </button>
                                            <button
                                              onClick={cancelEditTaskStatus}
                                              disabled={updatingStatus}
                                              className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors disabled:bg-gray-400"
                                            >
                                              Cancel
                                            </button>
                                          </div>
                                        ) : (
                                          <div>
                                            <span className="font-medium text-gray-900">{status.name}</span>
                                            {status.isDefault && (
                                              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Default</span>
                                            )}
                                            {status.order && (
                                              <span className="ml-2 text-sm text-gray-600">Order: {status.order}</span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {!status.isDefault && editingStatus !== status._id && (
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleEditTaskStatus(status)}
                                        className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full transition-colors"
                                        title="Edit status"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => deleteTaskStatus(status._id, status.name)}
                                        className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-full transition-colors"
                                        title="Delete status"
                                      >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </Draggable>
                          ))}
                        {provided.placeholder}
                        
                        {taskStatuses.filter(status => 
                          statusSearchTerm === '' || 
                          status.name.toLowerCase().includes(statusSearchTerm.toLowerCase())
                        ).length === 0 && (
                          <p className="text-gray-600 text-center py-4">
                            {statusSearchTerm ? 'No statuses found matching your search.' : 'No task statuses found.'}
                          </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          </>
        )}

        {activeTab === 'Works' && (user.role === 'Admin' || user.role === 'Team Head') && (
          <>
            <h2 className="text-lg font-semibold px-0 md:px-6 py-4">Work Types Management</h2>
            
            {/* Add New Work Type */}
            <div className="px-0 md:px-6 py-4 border-b border-gray-200">
              <h3 className="text-md font-medium text-gray-800 mb-3">Add New Work Type</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newWorkTypeName}
                  onChange={(e) => {
                    setNewWorkTypeName(e.target.value);
                    setWorkTypeSearchTerm(e.target.value);
                  }}
                  placeholder="Search work types or add new work type name"
                  className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={addWorkType}
                  disabled={addingWorkType || !newWorkTypeName.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {addingWorkType ? 'Adding...' : 'Add Work Type'}
                </button>
              </div>
            </div>

            {/* Work Types List */}
            <div className="px-0 md:px-6 py-4">
              <h3 className="text-md font-medium text-gray-800 mb-3">Current Work Types</h3>
              
              {loadingWorkTypes ? (
                <p className="text-gray-600 text-center py-4">Loading work types...</p>
              ) : (
                <div className="space-y-3">
                  {workTypes
                    .filter(workType => 
                      workTypeSearchTerm === '' || 
                      workType.name.toLowerCase().includes(workTypeSearchTerm.toLowerCase())
                    )
                    .map((workType) => (
                    <div key={workType._id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        {editingWorkType === workType._id ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editWorkTypeName}
                              onChange={(e) => setEditWorkTypeName(e.target.value)}
                              className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            />
                            <button
                              onClick={() => updateWorkType(workType._id, editWorkTypeName)}
                              disabled={updatingWorkType || !editWorkTypeName.trim()}
                              className="bg-green-600 text-white px-3 py-2 rounded hover:bg-green-700 transition-colors disabled:bg-gray-400"
                            >
                              {updatingWorkType ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditWorkType}
                              disabled={updatingWorkType}
                              className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors disabled:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className="font-medium text-gray-900">{workType.name}</span>
                        )}
                      </div>
                      {editingWorkType !== workType._id && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditWorkType(workType)}
                            className="text-blue-600 hover:text-blue-800 p-2 hover:bg-blue-50 rounded-full transition-colors"
                            title="Edit work type"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => deleteWorkType(workType._id, workType.name)}
                            className="text-red-600 hover:text-red-800 p-2 hover:bg-red-50 rounded-full transition-colors"
                            title="Delete work type"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {workTypes.filter(workType => 
                    workTypeSearchTerm === '' || 
                    workType.name.toLowerCase().includes(workTypeSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <p className="text-gray-600 text-center py-4">
                      {workTypeSearchTerm ? 'No work types found matching your search.' : 'No work types found.'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'Attributes' && user.role === 'Admin' && (
          <ColumnManagement />
        )}
      </div>
    </div>
  );
};

export default Settings; 