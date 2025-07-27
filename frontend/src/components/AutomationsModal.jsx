import { useState, useEffect } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';

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
  const [showCreate, setShowCreate] = useState(false);
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
    period: 'AM'
  });
  const [loading, setLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false); // For checking automations
  const [checkResult, setCheckResult] = useState(null); // To show results of check
  const [error, setError] = useState('');

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
      
      if (automationData.triggerType === 'dateAndTime') {
        if (!automationData.specificDate || !automationData.specificTime) {
          throw new Error('Both date and time are required');
        }
        
        // Validate date is in the future
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
        period: 'AM'
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md min-h-[320px] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Automations</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl">×</button>
        </div>
        {showCreate ? (
          <div className="flex flex-col gap-4">
            {showTriggerSelect ? (
              <div className="flex flex-col gap-4">
                <h3 className="text-md font-semibold text-gray-800 mb-2">Select Trigger Type</h3>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => handleTriggerSelect('dayOfMonth')}
                    className="border border-gray-300 rounded-md p-4 flex flex-col gap-2 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-medium text-gray-800">Day of the Month</span>
                    </div>
                    <p className="text-xs text-gray-500">Create recurring tasks on a specific day each month</p>
                  </button>
                  <button
                    onClick={() => handleTriggerSelect('dateAndTime')}
                    className="border border-gray-300 rounded-md p-4 flex flex-col gap-2 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium text-gray-800">Date and Time</span>
                    </div>
                    <p className="text-xs text-gray-500">Create one-time tasks on a specific date and time</p>
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center mb-2">
                  <button 
                    onClick={handleBackToTrigger}
                    className="mr-2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h3 className="text-md font-semibold text-gray-800">
                    {triggerType === 'dayOfMonth' ? 'Monthly Automation' : 'One-time Automation'}
                  </h3>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Automation Name</label>
                  <input
                    type="text"
                    placeholder="Client Report"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newAutomation.name}
                    onChange={e => setNewAutomation({ ...newAutomation, name: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    placeholder="Brief description of what this automation does"
                    className="w-full border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={newAutomation.description}
                    onChange={e => setNewAutomation({ ...newAutomation, description: e.target.value })}
                    rows={2}
                  />
                </div>
                
                {triggerType === 'dayOfMonth' ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Trigger Day (1-31)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        placeholder="Day of month when tasks should be created"
                        className="w-full border rounded-md pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        value={newAutomation.dayOfMonth}
                        onChange={e => setNewAutomation({ ...newAutomation, dayOfMonth: e.target.value })}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Tasks will be created automatically on this day each month.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Specific Date</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <input
                          type="date"
                          className="w-full border rounded-md pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          value={newAutomation.specificDate}
                          onChange={e => setNewAutomation({ ...newAutomation, specificDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Specific Time (12-hour format)</label>
                      <div className="flex space-x-2 items-center">
                        <div className="w-1/3 relative">
                          <select
                            className="w-full border rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        </div>
                        <div className="w-1/3 relative">
                          <select
                            className="w-full border rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        </div>
                        <div className="w-1/3 relative">
                          <select
                            className="w-full border rounded-md py-2 px-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Tasks will be created only once at this exact date and time, then the automation will be deleted. Must be a future date and time.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            
            {!showTriggerSelect && error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-2 rounded">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-4 w-4 text-red-500 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-2">
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {!showTriggerSelect && (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={handleBackToTrigger}
                  className="flex-1 bg-white border border-gray-300 text-gray-700 rounded-md py-2 font-medium hover:bg-gray-50 transition"
                  disabled={loading}
                >Back</button>
                <button
                  onClick={handleCreateAutomation}
                  className="flex-1 bg-blue-600 text-white rounded-md py-2 font-medium hover:bg-blue-700 transition flex items-center justify-center"
                  disabled={
                    loading || 
                    !newAutomation.name || 
                    (triggerType === 'dayOfMonth' && !newAutomation.dayOfMonth) ||
                    (triggerType === 'dateAndTime' && (!newAutomation.specificDate || !newAutomation.specificTime))
                  }
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>Create Automation</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 mb-4">
              {loading ? (
                <div className="text-center py-8 flex flex-col items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-3"></div>
                  <p className="text-gray-500">Loading automations...</p>
                </div>
              ) : automations.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <p className="text-gray-500 font-medium mb-1">No automations yet</p>
                  <p className="text-gray-400 text-sm mb-4">Create your first automation to get started</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white rounded-md py-1.5 px-3 text-sm font-medium hover:bg-blue-700 transition"
                  >
                    <PlusIcon className="h-4 w-4" /> Create Now
                  </button>
                </div>
              ) : (
                automations.map(auto => (
                  <button
                    key={auto._id}
                    onClick={() => onSelectAutomation(auto)}
                    className="w-full text-left p-4 rounded-md border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-200 transition flex flex-col gap-2 shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800">{auto.name}</span>
                        <span className="text-xs text-gray-500 mt-1">{auto.description}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {auto.triggerType === 'dayOfMonth' || !auto.triggerType ? (
                          <div className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Monthly: Day {auto.dayOfMonth}
                          </div>
                        ) : (
                          <div className="bg-purple-100 text-purple-800 text-xs font-medium px-2 py-1 rounded-full flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {new Date(auto.specificDate).toLocaleDateString()} at {
                              auto.specificTime ? 
                              convert24hTo12h(auto.specificTime) : 
                              'Unknown time'
                            }
                          </div>
                        )}
                        {auto.taskTemplate && Array.isArray(auto.taskTemplate) && (
                          <div className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-full flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {auto.taskTemplate.length || 0} {auto.taskTemplate.length === 1 ? 'template' : 'templates'}
                          </div>
                        )}
                      </div>
                    </div>
                    {auto.taskTemplate && Array.isArray(auto.taskTemplate) && auto.taskTemplate.length > 0 && (
                      <div className="mt-1 text-xs flex items-center text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {auto.triggerType === 'dateAndTime' ? 'One-time automation - ' : ''}Click to manage templates
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
            <div className="space-y-3">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md py-2.5 font-semibold hover:from-purple-700 hover:to-blue-700 transition w-full shadow-sm"
              >
                <PlusIcon className="h-5 w-5" /> Create New Automation
              </button>
              
              {/* Show check result if available */}
              {checkResult && (
                <div className={`p-3 rounded-md ${checkResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-start">
                    <div className={`flex-shrink-0 w-5 h-5 ${checkResult.success ? 'text-green-500' : 'text-red-500'}`}>
                      {checkResult.success ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="ml-3">
                      <p className={`text-sm ${checkResult.success ? 'text-green-700' : 'text-red-700'}`}>{checkResult.message}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Admin option to trigger automation check */}
              {user?.role === 'Admin' && (
                <button
                  onClick={handleTriggerAutomationCheck}
                  className="flex items-center justify-center gap-2 bg-gray-100 border border-gray-300 text-gray-700 rounded-md py-2 px-3 text-sm font-medium hover:bg-gray-200 transition w-full"
                  disabled={checkLoading}
                >
                  {checkLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-700 mr-2"></div>
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
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AutomationsModal;
