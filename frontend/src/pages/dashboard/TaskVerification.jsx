import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import toast from 'react-hot-toast';
import CreateTask from '../../components/CreateTask';
import FileList from '../../components/FileList';
import defaultProfile from '../../assets/avatar.jpg';
import { Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

const columns = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'clientName', label: 'Client Name' },
  { id: 'clientGroup', label: 'Client Group' },
  { id: 'workType', label: 'Work Type' },
  { id: 'priority', label: 'Priority' },
  { id: 'inwardEntryDate', label: 'Inward Entry Date' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'assignedBy', label: 'Assigned By' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'files', label: 'Files' },
];

const TaskVerification = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [users, setUsers] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  
  // New tab and automation template states
  const [tabValue, setTabValue] = useState(0);
  const [pendingAutomationTemplates, setPendingAutomationTemplates] = useState([]);
  const [automationLoading, setAutomationLoading] = useState(false);

  useEffect(() => {
    const fetchTasks = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/api/tasks/for-verification`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch tasks for verification');
        let data = await res.json();
        // Remove all logic and UI related to 'pending' status
        setTasks(data);
      } catch (err) {
        setError(err.message);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/users`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUsers(data);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    if (user && user.token) {
      fetchTasks();
      fetchUsers();
      fetchAutomationTemplates();
    }
  }, [user]);

  // New function to fetch automation templates
  const fetchAutomationTemplates = async () => {
    setAutomationLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/automations/templates/pending`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPendingAutomationTemplates(data);
      }
    } catch (err) {
      console.error('Error fetching automation templates:', err);
    } finally {
      setAutomationLoading(false);
    }
  };

  const handleAction = async (taskId, action) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      toast.success(`Task ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      setTasks(prev => prev.filter(t => t._id !== taskId));
      
      // Notify sidebar to update pending task count
      window.dispatchEvent(new CustomEvent('taskVerificationUpdate'));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEditTask = (task) => {
    setEditTask(task);
    setEditModalOpen(true);
  };

  const handleTaskSubmit = async (updatedTask) => {
    setEditModalOpen(false);
    setEditTask(null);
    // If task was accepted (approved), remove it from the list
    // Otherwise, update the task in the current list
    if (updatedTask && updatedTask.verificationStatus === 'completed') {
      // Task was accepted, remove from pending list
      setTasks(prevTasks => prevTasks.filter(task => task._id !== updatedTask._id));
      toast.success('Task updated and accepted successfully');
    } else {
      // Task was just updated, update in list
      setTasks(prevTasks => 
        prevTasks.map(task => 
          task._id === updatedTask._id ? updatedTask : task
        )
      );
      // Also refresh the tasks list to ensure we have the latest data
      await refetchTasks();
    }
  };

  const refetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks/for-verification`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tasks for verification');
      let data = await res.json();
      setTasks(data);
    } catch (err) {
      console.error('Error refetching tasks:', err);
    }
  };

  // New automation template handlers
  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleVerifyTemplate = async (automationId, templateId, action) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/automations/${automationId}/templates/${templateId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        setPendingAutomationTemplates(prev => 
          prev.map(automation => ({
            ...automation,
            taskTemplate: automation.taskTemplate.filter(template => template._id !== templateId)
          })).filter(automation => automation.taskTemplate.length > 0)
        );
        toast.success(`Template ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
        
        // Notify sidebar to update pending task count
        window.dispatchEvent(new CustomEvent('taskVerificationUpdate'));
      } else {
        toast.error('Error verifying template');
      }
    } catch (error) {
      console.error('Error verifying template:', error);
      toast.error('Error verifying template');
    }
  };

  // Tab panel component
  const TabPanel = ({ children, value, index, ...other }) => {
    return (
      <div
        role="tabpanel"
        hidden={value !== index}
        id={`verification-tabpanel-${index}`}
        aria-labelledby={`verification-tab-${index}`}
        {...other}
      >
        {value === index && (
          <Box sx={{ p: 0 }}>
            {children}
          </Box>
        )}
      </div>
    );
  };

  // Automation templates table renderer
  const renderAutomationTemplatesTable = () => (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Automation Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Template Title</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {pendingAutomationTemplates.length === 0 ? (
            <tr>
              <td colSpan="8" className="px-4 py-4 text-center text-gray-500">
                {automationLoading ? 'Loading automation templates...' : 'No automation templates pending verification.'}
              </td>
            </tr>
          ) : (
            pendingAutomationTemplates.flatMap((automation) =>
              automation.taskTemplate.map((template) => (
                <tr key={`${automation._id}-${template._id}`}>
                  <td className="px-4 py-2 whitespace-nowrap">{automation.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{template.title}</td>
                  <td className="px-4 py-2 max-w-xs overflow-hidden">
                    <div className="max-w-xs truncate hover:whitespace-normal hover:overflow-visible hover:text-clip">
                      {template.description || 'No description'}
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{template.priority || 'No Priority'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{template.clientName || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="flex items-center">
                      <img 
                        src={automation.createdBy?.profilePicture || defaultProfile} 
                        alt={`${automation.createdBy?.firstName || 'User'}`}
                        className="w-8 h-8 rounded-full mr-2 object-cover border border-gray-200"
                        onError={(e) => { e.target.src = defaultProfile; }}
                      />
                      <span>{automation.createdBy?.firstName} {automation.createdBy?.lastName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {new Date(automation.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleVerifyTemplate(automation._id, template._id, 'approve')}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleVerifyTemplate(automation._id, template._id, 'reject')}
                        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-4 relative">
      <h2 className="text-2xl font-bold mb-4">Task Verification</h2>
      
      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab 
            label={`Tasks Pending For Approval (${tasks.length})`} 
            id="verification-tab-0"
            aria-controls="verification-tabpanel-0"
          />
          <Tab 
            label={`Automation Templates Pending Approval (${pendingAutomationTemplates.reduce((acc, auto) => acc + auto.taskTemplate.length, 0)})`} 
            id="verification-tab-1"
            aria-controls="verification-tabpanel-1"
          />
        </Tabs>
      </Box>

      {/* Tab 1: Original Task Verification Content */}
      <TabPanel value={tabValue} index={0}>
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : tasks.length === 0 ? (
          <div className="text-gray-500">No tasks pending verification.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 bg-white shadow rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(col => (
                    <th key={col.id} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{col.label}</th>
                  ))}
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {tasks.map(task => (
                  <tr key={task._id}>
                    <td className="px-4 py-2 whitespace-nowrap">{task.title}</td>
                    <td className="px-4 py-2 max-w-xs overflow-hidden">
                      <div className="max-w-xs truncate hover:whitespace-normal hover:overflow-visible hover:text-clip">
                        {task.description}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{task.clientName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{task.clientGroup}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{Array.isArray(task.workType) ? task.workType.join(', ') : task.workType}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{task.priority}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{task.inwardEntryDate ? new Date(task.inwardEntryDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <img 
                          src={task.assignedBy?.profilePicture || defaultProfile} 
                          alt={`${task.assignedBy?.firstName || 'User'}`}
                          className="w-8 h-8 rounded-full mr-2 object-cover border border-gray-200"
                          onError={(e) => { e.target.src = defaultProfile; }}
                        />
                        <span>{task.assignedBy?.firstName} {task.assignedBy?.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex items-center">
                        <img 
                          src={task.assignedTo?.profilePicture || defaultProfile} 
                          alt={`${task.assignedTo?.firstName || 'User'}`}
                          className="w-8 h-8 rounded-full mr-2 object-cover border border-gray-200"
                          onError={(e) => { e.target.src = defaultProfile; }}
                        />
                        <span>{task.assignedTo?.firstName} {task.assignedTo?.lastName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="relative">
                        <button 
                          className="text-blue-500 hover:text-blue-700 underline"
                          onClick={(e) => {
                            e.stopPropagation();
                            const modal = document.getElementById(`files-modal-${task._id}`);
                            if (modal) modal.classList.toggle('hidden');
                          }}
                        >
                          {task.files?.length || 0} file(s)
                        </button>
                        <div 
                          id={`files-modal-${task._id}`}
                          className="fixed inset-0 z-50 hidden"
                          onClick={(e) => {
                            if (e.target.id === `files-modal-${task._id}`) {
                              document.getElementById(`files-modal-${task._id}`).classList.add('hidden');
                            }
                          }}
                        >
                          <div className="absolute inset-0 bg-opacity-30 backdrop-blur-sm"></div>
                          <div className="relative z-10 bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto mt-20 p-6">
                            <div className="flex justify-between items-center mb-4">
                              <h3 className="text-lg font-semibold">Files for {task.title}</h3>
                              <button 
                                onClick={() => document.getElementById(`files-modal-${task._id}`).classList.add('hidden')}
                                className="text-gray-500 hover:text-gray-700"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="overflow-y-auto max-h-[70vh]">
                              <FileList taskId={task._id} files={task.files} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditTask(task)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                          title="Edit Task"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleAction(task._id, 'approve')}
                          className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(task._id, 'reject')}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabPanel>

      {/* Tab 2: Automation Templates */}
      <TabPanel value={tabValue} index={1}>
        {renderAutomationTemplatesTable()}
      </TabPanel>

      {/* Edit Task Modal */}
      {editModalOpen && (
        <CreateTask
          users={users}
          mode="edit"
          initialData={editTask}
          isOpen={editModalOpen}
          showAcceptButton={true} // Enable Accept button for TaskVerification page
          onClose={() => {
            setEditModalOpen(false);
            setEditTask(null);
          }}
          onSubmit={handleTaskSubmit}
        />
      )}
    </div>
  );
};

export default TaskVerification; 