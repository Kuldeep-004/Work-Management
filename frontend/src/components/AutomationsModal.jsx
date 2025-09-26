import { useState, useEffect } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import AutomationMonitor from './AutomationMonitor';

// Function to convert between 12-hour and 24-hour time formats
const convert12hTo24h = (hours, minutes, period) => {
  let hours24 = parseInt(hours, 10);
  
  // Convert hours to 24-hour format
  if (period === 'PM' && hours24 < 12) {
    hours24 += 12;
  } else if (period === 'AM' && hours24 === 12) {
    hours24 = 0;
  }
  
  return `${hours24.toString().padStart(2, '0')}:${minutes}`;
};

// Function to convert 24-hour time format to 12-hour format with AM/PM
const convert24hTo12h = (time24h) => {
  if (!time24h) return '';
  
  const [hours24, minutes] = time24h.split(':');
  const hours = parseInt(hours24, 10);
  
  // Determine if it's AM or PM
  const period = hours >= 12 ? 'PM' : 'AM';
  
  // Convert to 12-hour format
  const hours12 = hours % 12 || 12; // 0 should be displayed as 12
  
  return `${hours12}:${minutes} ${period}`;
};

const AutomationsModal = ({ isOpen, onClose, onSelectAutomation, user, API_BASE_URL }) => {
  const [automations, setAutomations] = useState([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState(null);
  const [showTriggerSelect, setShowTriggerSelect] = useState(true); // New state for trigger type selection
  const [triggerType, setTriggerType] = useState(''); // dayOfMonth or dateAndTime
  const [newAutomation, setNewAutomation] = useState({ 
    name: '', 
    description: '', 
    triggerType: '',
    dayOfMonth: '',
    specificDate: '',
    specificTime: '',
    // 12-hour format components
    hours: '12',
    minutes: '00',
    period: 'AM',
    // New fields for flexible month selection
    quarterlyMonths: [1, 4, 7, 10], // Default to all quarters
    halfYearlyMonths: [1, 7] // Default to both half-years
  });
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false); // For checking automations
  const [checkResult, setCheckResult] = useState(null); // To show results of check
  const [showMonitor, setShowMonitor] = useState(false); // For automation monitoring
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, name: '' });
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.token) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/automations`, {
      headers: { Authorization: `Bearer ${user.token}` },
    })
      .then(res => res.json())
      .then(data => {
        setAutomations(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [isOpen, user, API_BASE_URL]);

  const handleTriggerSelect = (selectedTrigger) => {
    setTriggerType(selectedTrigger);
    setNewAutomation({
      ...newAutomation,
      triggerType: selectedTrigger
    });
    setShowTriggerSelect(false);
  };
  
  const handleBackToTrigger = () => {
    setShowTriggerSelect(true);
    setTriggerType('');
  };
  
  // Handle showing the delete confirmation dialog
  const handleConfirmDelete = (e, automation) => {
    e.stopPropagation(); // Prevent triggering the card click (onSelectAutomation)
    setDeleteConfirm({ 
      show: true, 
      id: automation._id, 
      name: automation.name 
    });
  };
  
  // Handle canceling the deletion
  const handleCancelDelete = () => {
    setDeleteConfirm({ show: false, id: null, name: '' });
  };
  
  // Handle the actual deletion
  const handleDeleteAutomation = async () => {
    if (!deleteConfirm.id || !user?.token) return;
    
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/automations/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });
      
      if (res.ok) {
        // Remove the deleted automation from the state
        setAutomations(prev => prev.filter(auto => auto._id !== deleteConfirm.id));
        setDeleteConfirm({ show: false, id: null, name: '' });
        setCheckResult({ success: true, message: 'Automation deleted successfully' });
      } else {
        const errorData = await res.json();
        setError(errorData.message || 'Failed to delete automation');
        setCheckResult({ success: false, message: 'Failed to delete automation' });
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError('Error deleting automation');
      setCheckResult({ success: false, message: 'Error deleting automation' });
    } finally {
      setDeleteLoading(false);
    }
  };
  
  const handleTriggerAutomationCheck = async () => {
    setCheckLoading(true);
    setCheckResult(null);
    setError('');
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/automations/check-trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        }
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to trigger automation check');
      }
      
      setCheckResult({
        success: true,
        message: data.message,
        processedCount: data.processedCount
      });
    } catch (err) {
      console.error('Error triggering automation check:', err);
      setCheckResult({
        success: false,
        message: err.message || 'An error occurred while checking automations'
      });
    } finally {
      setCheckLoading(false);
    }
  };

  const handleCreateAutomation = async () => {
    setLoading(true);
    setError('');
    try {
      // Deep copy to avoid modifying state directly
      const automationData = { ...newAutomation };
      
      // Validate before sending
      if (automationData.triggerType === 'dayOfMonth' && !automationData.dayOfMonth) {
        throw new Error('Day of month is required');
      }
      
      if (automationData.triggerType === 'quarterly') {
        if (!automationData.dayOfMonth) {
          throw new Error('Day of month is required for quarterly automation');
        }
        // Ensure quarterlyMonths is set
        if (!automationData.quarterlyMonths || automationData.quarterlyMonths.length === 0) {
          automationData.quarterlyMonths = [1, 4, 7, 10]; // Default to all quarters
        }
      }
      
      if (automationData.triggerType === 'halfYearly') {
        if (!automationData.dayOfMonth) {
          throw new Error('Day of month is required for half-yearly automation');
        }
        // Ensure halfYearlyMonths is set
        if (!automationData.halfYearlyMonths || automationData.halfYearlyMonths.length === 0) {
          automationData.halfYearlyMonths = [1, 7]; // Default to both half-years
        }
      }
      
      if (automationData.triggerType === 'yearly') {
        if (!automationData.dayOfMonth) {
          throw new Error('Day of month is required for yearly automation');
        }
        
        if (!automationData.monthOfYear) {
          automationData.monthOfYear = 1; // Default to January
        }
      }
      
      
      if (automationData.triggerType === 'dateAndTime') {
        if (!automationData.specificDate || !automationData.specificTime) {
          throw new Error('Both date and time are required');
        }
        
        // Validate date is in the future (only for one-time automations)
        const selectedDateTime = new Date(`${automationData.specificDate}T${automationData.specificTime}`);
        const now = new Date();
        
        if (selectedDateTime <= now) {
          throw new Error('The date and time must be in the future');
        }
      }
      
      const res = await fetch(`${API_BASE_URL}/api/automations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(newAutomation),
      });
      if (!res.ok) throw new Error('Failed to create automation');
      const created = await res.json();
      setAutomations([...automations, created]);
      setShowCreate(false);
      setShowTriggerSelect(true);
      setTriggerType('');
      setNewAutomation({
        name: '', 
        description: '', 
        triggerType: '',
        dayOfMonth: '',
        specificDate: '',
        specificTime: '',
        hours: '12',
        minutes: '00',
        period: 'AM',
        quarterlyMonths: [1, 4, 7, 10],
        halfYearlyMonths: [1, 7]
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle editing an existing automation - start with trigger selection
  const handleEditAutomation = (automation) => {
    setEditingAutomation(automation);
    // Reset to trigger selection first, just like create flow
    setTriggerType('');
    setShowTriggerSelect(true);
    setNewAutomation({
      name: automation.name || '',
      description: automation.description || '',
      triggerType: automation.triggerType,
      dayOfMonth: automation.dayOfMonth || '',
      specificDate: automation.specificDate ? new Date(automation.specificDate).toISOString().split('T')[0] : '',
      specificTime: automation.specificTime || '',
      monthOfYear: automation.monthOfYear || '',
      quarterlyMonths: automation.quarterlyMonths || [],
      halfYearlyMonths: automation.halfYearlyMonths || [],
      hours: '12',
      minutes: '00',
      period: 'AM'
    });
    setShowEdit(true);
  };

  // Handle updating an automation
  const handleUpdateAutomation = async () => {
    if (!editingAutomation) return;
    
    setLoading(true);
    setError('');
    try {
      const automationData = { 
        ...newAutomation,
        clearTemplateHistory: true  // Flag to clear all template run history
      };
      
      // Validate before sending
      if (automationData.triggerType === 'dayOfMonth' && !automationData.dayOfMonth) {
        throw new Error('Day of month is required');
      }
      
      if (automationData.triggerType === 'dateAndTime') {
        if (!automationData.specificDate || !automationData.specificTime) {
          throw new Error('Both date and time are required');
        }
        
        // Validate date is in the future (only for one-time automations)
        const selectedDateTime = new Date(`${automationData.specificDate}T${automationData.specificTime}`);
        const now = new Date();
        
        if (selectedDateTime <= now) {
          throw new Error('The date and time must be in the future');
        }
      }
      
      const res = await fetch(`${API_BASE_URL}/api/automations/${editingAutomation._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify(automationData),
      });
      if (!res.ok) throw new Error('Failed to update automation');
      const updated = await res.json();
      
      // Update the automations list
      setAutomations(automations.map(auto => auto._id === updated._id ? updated : auto));
      
      // Reset form
      setShowEdit(false);
      setEditingAutomation(null);
      setShowTriggerSelect(true);
      setTriggerType('');
      setNewAutomation({
        name: '', 
        description: '', 
        triggerType: '',
        dayOfMonth: '',
        specificDate: '',
        specificTime: '',
        hours: '12',
        minutes: '00',
        period: 'AM',
        quarterlyMonths: [1, 4, 7, 10],
        halfYearlyMonths: [1, 7]
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      {/* Delete Confirmation Dialog */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Delete Automation</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{deleteConfirm.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAutomation}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md flex items-center"
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-xl shadow-lg p-0 w-full max-w-5xl min-h-[200px] max-h-[85vh] flex flex-col">
        <div className="flex justify-between items-center py-4 px-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Automations</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 rounded-full p-1 hover:bg-gray-100 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {(showCreate || showEdit) ? (
          <div className="flex flex-col gap-4 p-6 overflow-y-auto">
            {showTriggerSelect ? (
              <div className="flex flex-col gap-4">
                <h3 className="text-base font-medium text-gray-800 mb-6">
                  {showEdit ? 'Change Trigger Type' : 'Select Trigger Type'}
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <button
                    onClick={() => handleTriggerSelect('dateAndTime')}
                    className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:border-purple-200 hover:shadow transition-all focus:outline-none"
                  >
                    <div className="bg-purple-100 text-purple-600 p-2 rounded-full w-10 h-10 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-gray-800 text-base block mb-1">One-time Date and Time</span>
                      <p className="text-xs text-gray-500 px-2">Create one-time tasks on a specific date and time</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTriggerSelect('dayOfMonth')}
                    className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:border-blue-200 hover:shadow transition-all focus:outline-none"
                  >
                    <div className="bg-blue-100 text-blue-600 p-2 rounded-full w-10 h-10 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-gray-800 text-base block mb-1">Day of the Month</span>
                      <p className="text-xs text-gray-500 px-2">Create recurring tasks on a specific day each month</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTriggerSelect('quarterly')}
                    className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:border-green-200 hover:shadow transition-all focus:outline-none"
                  >
                    <div className="bg-green-100 text-green-600 p-2 rounded-full w-10 h-10 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-gray-800 text-base block mb-1">Quarterly</span>
                      <p className="text-xs text-gray-500 px-2">Create recurring tasks every quarter (Jan, Apr, Jul, Oct)</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTriggerSelect('halfYearly')}
                    className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:border-orange-200 hover:shadow transition-all focus:outline-none"
                  >
                    <div className="bg-orange-100 text-orange-600 p-2 rounded-full w-10 h-10 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-gray-800 text-base block mb-1">Half Yearly</span>
                      <p className="text-xs text-gray-500 px-2">Create recurring tasks twice a year (Jan & Jul)</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleTriggerSelect('yearly')}
                    className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center hover:border-red-200 hover:shadow transition-all focus:outline-none"
                  >
                    <div className="bg-red-100 text-red-600 p-2 rounded-full w-10 h-10 flex items-center justify-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <span className="font-medium text-gray-800 text-base block mb-1">Yearly</span>
                      <p className="text-xs text-gray-500 px-2">Create recurring tasks once a year on a specific date</p>
                    </div>
                  </button>
                </div>
                <div className="flex justify-end mt-6">
                  <button
                    onClick={() => {
                      if (showEdit) {
                        setShowEdit(false);
                        setEditingAutomation(null);
                      } else {
                        setShowCreate(false);
                      }
                      setShowTriggerSelect(true);
                      setTriggerType('');
                    }}
                    className="px-4 py-2 text-sm text-gray-600 font-medium border border-gray-200 rounded hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 overflow-y-auto max-h-[calc(100vh-15rem)]">
                <div className="flex items-center mb-2">
                  <button 
                    onClick={handleBackToTrigger}
                    className="mr-3 text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors p-2 rounded-full"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {showEdit ? 'Edit ' : ''}
                    {triggerType === 'dateAndTime' && 'One-time Automation'}
                    {triggerType === 'dayOfMonth' && 'Monthly Automation'}
                    {triggerType === 'quarterly' && 'Quarterly Automation'}
                    {triggerType === 'halfYearly' && 'Half Yearly Automation'}
                    {triggerType === 'yearly' && 'Yearly Automation'}
                  </h3>
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Automation Name</label>
                  <input
                    type="text"
                    placeholder="Client Report"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newAutomation.name}
                    onChange={e => setNewAutomation({ ...newAutomation, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    placeholder="Brief description of what this automation does"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newAutomation.description}
                    onChange={e => setNewAutomation({ ...newAutomation, description: e.target.value })}
                    rows={3}
                  />
                </div>
                
                {triggerType === 'dayOfMonth' ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Trigger Day (1-31)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Day of month when tasks should be created"
                        className="w-full border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={newAutomation.dayOfMonth}
                        onChange={e => setNewAutomation({ ...newAutomation, dayOfMonth: e.target.value })}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Tasks will be created automatically on this day each month.</p>
                  </div>
                ) : triggerType === 'quarterly' ? (
                  <div className="space-y-4">
                    <h4 className="text-base font-medium text-gray-800">Quarterly Settings</h4>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Day of Month (1-31)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="Which day of the month"
                          className="w-full border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={newAutomation.dayOfMonth}
                          onChange={e => setNewAutomation({ ...newAutomation, dayOfMonth: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Q1 Month</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={newAutomation.quarterlyMonths?.[0] || 1}
                          onChange={e => {
                            const newMonths = [...(newAutomation.quarterlyMonths || [1, 4, 7, 10])];
                            newMonths[0] = parseInt(e.target.value);
                            setNewAutomation({ ...newAutomation, quarterlyMonths: newMonths });
                          }}
                        >
                          <option value="1">January</option>
                          <option value="2">February</option>
                          <option value="3">March</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Q2 Month</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={newAutomation.quarterlyMonths?.[1] || 4}
                          onChange={e => {
                            const newMonths = [...(newAutomation.quarterlyMonths || [1, 4, 7, 10])];
                            newMonths[1] = parseInt(e.target.value);
                            setNewAutomation({ ...newAutomation, quarterlyMonths: newMonths });
                          }}
                        >
                          <option value="4">April</option>
                          <option value="5">May</option>
                          <option value="6">June</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Q3 Month</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={newAutomation.quarterlyMonths?.[2] || 7}
                          onChange={e => {
                            const newMonths = [...(newAutomation.quarterlyMonths || [1, 4, 7, 10])];
                            newMonths[2] = parseInt(e.target.value);
                            setNewAutomation({ ...newAutomation, quarterlyMonths: newMonths });
                          }}
                        >
                          <option value="7">July</option>
                          <option value="8">August</option>
                          <option value="9">September</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Q4 Month</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={newAutomation.quarterlyMonths?.[3] || 10}
                          onChange={e => {
                            const newMonths = [...(newAutomation.quarterlyMonths || [1, 4, 7, 10])];
                            newMonths[3] = parseInt(e.target.value);
                            setNewAutomation({ ...newAutomation, quarterlyMonths: newMonths });
                          }}
                        >
                          <option value="10">October</option>
                          <option value="11">November</option>
                          <option value="12">December</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Tasks will be created in the selected month of each quarter on the specified day.</p>
                  </div>
                ) : triggerType === 'halfYearly' ? (
                  <div className="space-y-4">
                    <h4 className="text-base font-medium text-gray-800">Half Yearly Settings</h4>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Day of Month (1-31)</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="Which day of the month"
                          className="w-full border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={newAutomation.dayOfMonth}
                          onChange={e => setNewAutomation({ ...newAutomation, dayOfMonth: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">First Half (H1) Month</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={newAutomation.halfYearlyMonths?.[0] || 1}
                          onChange={e => {
                            const newMonths = [...(newAutomation.halfYearlyMonths || [1, 7])];
                            newMonths[0] = parseInt(e.target.value);
                            setNewAutomation({ ...newAutomation, halfYearlyMonths: newMonths });
                          }}
                        >
                          <option value="1">January</option>
                          <option value="2">February</option>
                          <option value="3">March</option>
                          <option value="4">April</option>
                          <option value="5">May</option>
                          <option value="6">June</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Second Half (H2) Month</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={newAutomation.halfYearlyMonths?.[1] || 7}
                          onChange={e => {
                            const newMonths = [...(newAutomation.halfYearlyMonths || [1, 7])];
                            newMonths[1] = parseInt(e.target.value);
                            setNewAutomation({ ...newAutomation, halfYearlyMonths: newMonths });
                          }}
                        >
                          <option value="7">July</option>
                          <option value="8">August</option>
                          <option value="9">September</option>
                          <option value="10">October</option>
                          <option value="11">November</option>
                          <option value="12">December</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">Tasks will be created in the selected month of each half-year on the specified day.</p>
                  </div>
                ) : triggerType === 'yearly' ? (
                  <div className="space-y-4">
                    <h4 className="text-base font-medium text-gray-800">Yearly Settings</h4>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Day of Month (1-31)</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            placeholder="Which day of the month"
                            className="w-full border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            value={newAutomation.dayOfMonth}
                            onChange={e => setNewAutomation({ ...newAutomation, dayOfMonth: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">Month</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={newAutomation.monthOfYear || 1}
                          onChange={e => setNewAutomation({ ...newAutomation, monthOfYear: parseInt(e.target.value) })}
                        >
                          <option value="1">January</option>
                          <option value="2">February</option>
                          <option value="3">March</option>
                          <option value="4">April</option>
                          <option value="5">May</option>
                          <option value="6">June</option>
                          <option value="7">July</option>
                          <option value="8">August</option>
                          <option value="9">September</option>
                          <option value="10">October</option>
                          <option value="11">November</option>
                          <option value="12">December</option>
                        </select>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Tasks will be created once a year on the specified date.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Specific Date</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="date"
                          className="w-full border border-gray-300 rounded-lg pl-11 pr-4 py-2.5 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={newAutomation.specificDate}
                          onChange={e => setNewAutomation({ ...newAutomation, specificDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Specific Time (12-hour format)</label>
                      <div className="flex space-x-3 items-center">
                        <div className="w-1/3 relative">
                          <select
                            className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-4 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                            value={newAutomation.hours}
                            onChange={e => {
                              const hours = e.target.value;
                              // Calculate the 24h time format for backend
                              const time24h = convert12hTo24h(hours, newAutomation.minutes, newAutomation.period);
                              setNewAutomation({ 
                                ...newAutomation, 
                                hours,
                                specificTime: time24h
                              });
                            }}
                          >
                            {Array.from({ length: 12 }).map((_, i) => (
                              <option key={i} value={i === 0 ? '12' : String(i + 1)}>
                                {i === 0 ? '12' : String(i + 1)}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <div className="w-1/3 relative">
                          <select
                            className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-4 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                            value={newAutomation.minutes}
                            onChange={e => {
                              const minutes = e.target.value;
                              // Calculate the 24h time format for backend
                              const time24h = convert12hTo24h(newAutomation.hours, minutes, newAutomation.period);
                              setNewAutomation({ 
                                ...newAutomation, 
                                minutes,
                                specificTime: time24h
                              });
                            }}
                          >
                            {Array.from({ length: 60 }).map((_, i) => (
                              <option key={i} value={i.toString().padStart(2, '0')}>
                                {i.toString().padStart(2, '0')}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <div className="w-1/3 relative">
                          <select
                            className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-4 text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                            value={newAutomation.period}
                            onChange={e => {
                              const period = e.target.value;
                              // Calculate the 24h time format for backend
                              const time24h = convert12hTo24h(newAutomation.hours, newAutomation.minutes, period);
                              setNewAutomation({ 
                                ...newAutomation, 
                                period,
                                specificTime: time24h
                              });
                            }}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-2">Tasks will be created only once at this exact date and time, then the automation will be deleted. Must be a future date and time.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            
            {!showTriggerSelect && error && (
              <div className="bg-red-50 border border-red-100 p-4 rounded-lg mt-2">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {!showTriggerSelect && (
              <div className="flex gap-4 mt-6 sticky bottom-0 pt-4 bg-white border-t border-gray-100">
                <button
                  onClick={handleBackToTrigger}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 rounded-lg py-3 font-medium hover:bg-gray-50 transition-colors shadow-sm"
                  disabled={loading}
                >Back</button>
                <button
                  onClick={showEdit ? handleUpdateAutomation : handleCreateAutomation}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg py-3 font-medium hover:from-blue-600 hover:to-blue-700 transition-colors shadow-sm flex items-center justify-center"
                  disabled={
                    loading || 
                    !newAutomation.name || 
                    (triggerType === 'dayOfMonth' && !newAutomation.dayOfMonth) ||
                    (triggerType === 'dateAndTime' && (!newAutomation.specificDate || !newAutomation.specificTime))
                  }
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white mr-2"></div>
                      {showEdit ? 'Updating...' : 'Creating...'}
                    </>
                  ) : (
                    <>{showEdit ? 'Update Automation' : 'Create Automation'}</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 flex flex-col h-full overflow-hidden">
            {loading ? (
              <div className="text-center py-12 flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-3 border-blue-100 border-t-blue-500 mb-3"></div>
                <p className="text-gray-500 text-base">Loading automations...</p>
              </div>
            ) : automations.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200 flex flex-col items-center mx-4 my-6">
                <div className="bg-gray-100 p-3 rounded-full mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium text-lg mb-1">No automations yet</p>
                <p className="text-gray-500 text-sm mb-4 max-w-sm px-6">Create your first automation to start saving time on repetitive tasks</p>
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-md py-2 px-4 text-sm font-medium hover:bg-blue-700 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Create Your First Automation
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto flex-grow" style={{ maxHeight: "calc(100vh - 10rem)" }}>
                {/* Search bar */}
                <div className="px-5 pb-2">
                  <input
                    type="text"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search Automations..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-5">
                  {automations
                    .filter(auto =>
                      auto.name?.toLowerCase().includes(search.toLowerCase()) ||
                      auto.description?.toLowerCase().includes(search.toLowerCase())
                    )
                    .map(auto => (
                    <div
                      key={auto._id}
                      onClick={(e) => {
                        // Don't trigger card click if the edit or delete button was clicked
                        if (e.target.closest('button[data-action="delete"]') || 
                            e.target.closest('button[data-action="edit"]')) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        onSelectAutomation(auto);
                      }}
                      className="w-full text-left p-4 rounded-lg border border-gray-100 bg-white hover:bg-blue-50 hover:border-blue-200 transition-all flex flex-col gap-2 shadow-sm cursor-pointer"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-medium text-gray-800 text-base truncate">{auto.name}</span>
                          <span className="text-xs text-gray-500 mt-0.5 line-clamp-1">{auto.description}</span>
                        </div>
                        {auto.triggerType === 'dayOfMonth' || !auto.triggerType ? (
                          <div className="bg-yellow-50 text-yellow-700 text-xs font-medium px-2 py-1 rounded-md flex items-center whitespace-nowrap shrink-0 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Day {auto.dayOfMonth}
                          </div>
                        ) : auto.triggerType === 'quarterly' ? (
                          <div className="bg-green-50 text-green-700 text-xs font-medium px-2 py-1 rounded-md flex items-center whitespace-nowrap shrink-0 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Q{auto.monthOfYear === 1 ? '1' : 
                              auto.monthOfYear === 4 ? '2' :
                              auto.monthOfYear === 7 ? '3' :
                              auto.monthOfYear === 10 ? '4' : ''}
                          </div>
                        ) : auto.triggerType === 'halfYearly' ? (
                          <div className="bg-orange-50 text-orange-700 text-xs font-medium px-2 py-1 rounded-md flex items-center whitespace-nowrap shrink-0 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            H{auto.monthOfYear === 1 ? '1' : 
                              auto.monthOfYear === 7 ? '2' : ''}
                          </div>
                        ) : auto.triggerType === 'yearly' ? (
                          <div className="bg-red-50 text-red-700 text-xs font-medium px-2 py-1 rounded-md flex items-center whitespace-nowrap shrink-0 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Yearly
                          </div>
                        ) : (
                          <div className="bg-purple-50 text-purple-700 text-xs font-medium px-2 py-1 rounded-md flex items-center whitespace-nowrap shrink-0 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Once
                          </div>
                        )}
                      </div>
                      
                      {/* Footer with task count, edit and delete buttons */}
                      <div className="mt-1.5 flex items-center justify-between">
                        <div className="flex items-center">
                          {/* Always show task count, even if 0 */}
                          <div className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {auto.taskTemplate && Array.isArray(auto.taskTemplate) ? auto.taskTemplate.length : 0}
                          </div>
                        </div>
                        
                        {/* Action buttons container */}
                        <div className="flex items-center gap-1">
                          {/* Edit button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleEditAutomation(auto);
                            }}
                            className="bg-gray-50 text-gray-700 text-xs font-medium px-2 py-0.5 rounded flex items-center hover:bg-gray-100 transition-colors"
                            aria-label="Edit automation"
                            data-action="edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          
                          {/* Delete button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleConfirmDelete(e, auto);
                            }}
                            className="bg-red-50 text-red-700 text-xs font-medium px-2 py-0.5 rounded flex items-center hover:bg-red-100 transition-colors"
                            aria-label="Delete automation"
                            data-action="delete"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="sticky bottom-0 pt-3 px-4 pb-4 bg-white border-t border-gray-100 mt-auto">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-md py-2.5 font-medium hover:bg-blue-700 transition-colors w-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                Create New Automation
              </button>
              
              {/* Show check result if available */}
              {checkResult && (
                <div className={`p-2.5 rounded-md mt-2 text-xs ${checkResult.success ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 w-4 h-4 ${checkResult.success ? 'text-green-500' : 'text-red-500'}`}>
                      {checkResult.success ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-2">
                      <p className={`font-medium ${checkResult.success ? 'text-green-800' : 'text-red-800'}`}>{checkResult.message}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Admin option to trigger automation check */}
              {user?.role === 'Admin' && (
                <div className="space-y-2">
                  <button
                    onClick={handleTriggerAutomationCheck}
                    className="flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 rounded-md py-2 text-xs font-medium hover:bg-gray-50 transition-colors w-full"
                    disabled={checkLoading}
                  >
                    {checkLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-gray-300 border-t-gray-600 mr-1"></div>
                        Checking Automations...
                      </>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Check Pending Automations
                      </>
                    )}
                  </button>
                
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AutomationsModal;
