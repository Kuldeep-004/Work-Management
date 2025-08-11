import React, { useState, useEffect } from 'react';
import TaskList from '../../components/TaskList';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Chip, Alert, Snackbar } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

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
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const TaskVerification = () => {
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [tasks, setTasks] = useState([]);
  const [pendingAutomationTemplates, setPendingAutomationTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  const apiUrl = process.env.NODE_ENV === 'production' 
    ? 'https://work-management-backend-eight.vercel.app' 
    : 'http://localhost:5000';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch tasks for verification (original functionality)
      const tasksResponse = await fetch(`${apiUrl}/api/tasks/for-verification`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setTasks(tasksData);
      }

      // Fetch pending automation templates
      const templatesResponse = await fetch(`${apiUrl}/api/automations/templates/pending`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (templatesResponse.ok) {
        const templatesData = await templatesResponse.json();
        setPendingAutomationTemplates(templatesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleTaskUpdate = (updatedTask) => {
    setTasks(prevTasks => 
      prevTasks.map(task => 
        task._id === updatedTask._id ? updatedTask : task
      )
    );
  };

  const handleTaskDelete = (deletedTaskId) => {
    setTasks(prevTasks => 
      prevTasks.filter(task => task._id !== deletedTaskId)
    );
  };

  const handleVerifyTemplate = async (automationId, templateId, action) => {
    try {
      const response = await fetch(`${apiUrl}/api/automations/${automationId}/templates/${templateId}/verify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
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
        showNotification(`Template ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      } else {
        showNotification('Error verifying template', 'error');
      }
    } catch (error) {
      console.error('Error verifying template:', error);
      showNotification('Error verifying template', 'error');
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const renderTemplatesTable = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell><strong>Automation Name</strong></TableCell>
            <TableCell><strong>Template Name</strong></TableCell>
            <TableCell><strong>Description</strong></TableCell>
            <TableCell><strong>Priority</strong></TableCell>
            <TableCell><strong>Created By</strong></TableCell>
            <TableCell><strong>Created At</strong></TableCell>
            <TableCell><strong>Actions</strong></TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pendingAutomationTemplates.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center">
                <Typography variant="body2" color="textSecondary">
                  No automation templates pending verification
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            pendingAutomationTemplates.flatMap((automation) =>
              automation.taskTemplate.map((template) => (
                <TableRow key={`${automation._id}-${template._id}`}>
                  <TableCell>{automation.name}</TableCell>
                  <TableCell>{template.title}</TableCell>
                  <TableCell>
                    {template.description ? 
                      (template.description.length > 50 ? 
                        `${template.description.substring(0, 50)}...` : 
                        template.description) : 
                      'No description'
                    }
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={template.priority || 'No Priority'} 
                      color={
                        template.priority === 'urgent' ? 'error' :
                        template.priority === 'today' ? 'warning' : 'default'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{automation.createdBy?.firstName + ' ' + automation.createdBy?.lastName || 'Unknown'}</TableCell>
                  <TableCell>
                    {new Date(automation.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => handleVerifyTemplate(automation._id, template._id, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        startIcon={<CancelIcon />}
                        onClick={() => handleVerifyTemplate(automation._id, template._id, 'reject')}
                      >
                        Reject
                      </Button>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  if (loading) {
    return (
      <div className="p-6">
        <Typography>Loading...</Typography>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Box sx={{ width: '100%' }}>
        <Typography variant="h4" gutterBottom>
          Task Verification
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab 
              label={`Tasks For Verification (${tasks.length})`} 
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

        <TabPanel value={tabValue} index={0}>
          <TaskList 
            tasks={tasks} 
            onTaskUpdate={handleTaskUpdate}
            onTaskDelete={handleTaskDelete}
            showVerificationActions={true}
            user={user}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            Automation Templates Pending Approval
          </Typography>
          {renderTemplatesTable()}
        </TabPanel>

        <Snackbar
          open={notification.open}
          autoHideDuration={6000}
          onClose={() => setNotification({ ...notification, open: false })}
        >
          <Alert 
            onClose={() => setNotification({ ...notification, open: false })} 
            severity={notification.severity}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Box>
    </div>
  );
};

export default TaskVerification;
