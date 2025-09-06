import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../../apiConfig';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../../styles/timesheet-calendar.css';

// Utility to normalize timesheet entries but preserve populated task data
function normalizeTimesheetTasks(ts) {
  if (!ts || !ts.entries) return ts;
  return {
    ...ts,
    entries: ts.entries.map(e => ({
      ...e,
      // Keep the original task object if it's populated, otherwise keep as is
      task: e.task
    }))
  };
}

// Helper functions for special task types
const isSpecialTaskType = (taskId) => {
  return ['other', 'permission', 'billing', 'lunch'].includes(taskId);
};

const getSpecialTaskName = (taskId) => {
  const taskNames = {
    'other': 'Other',
    'permission': 'Permission', 
    'billing': 'Billing',
    'lunch': 'Lunch'
  };
  return taskNames[taskId] || '';
};

const isSpecialTaskEntry = (entry) => {
  const specialTaskNames = ['Other', 'Permission', 'Billing', 'Lunch'];
  return isSpecialTaskType(entry.task) || specialTaskNames.includes(entry.manualTaskName);
};

const Timesheets = () => {
  const { user, isAuthenticated } = useAuth();
  const [timesheet, setTimesheet] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entryTimeParts, setEntryTimeParts] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedDates, setSubmittedDates] = useState([]); // Array of yyyy-mm-dd
  const [incompleteDates, setIncompleteDates] = useState([]); // Array of yyyy-mm-dd (red)
  const [pendingEntries, setPendingEntries] = useState([]); // For new timeslots that aren't saved yet
  const [editingEntries, setEditingEntries] = useState(new Set()); // For existing entries being edited
  const [originalEntryOrder, setOriginalEntryOrder] = useState([]); // Store original order for editing entries

  const debounceTimeout = useRef(null);
  // Fetch all submitted and incomplete timesheet dates for calendar highlight
  useEffect(() => {
    const fetchHighlightDates = async () => {
      if (!isAuthenticated() || !user) return;
      try {
        const [submittedRes, incompleteRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/timesheets/submitted-dates`, {
            headers: { Authorization: `Bearer ${user.token}` }
          }),
          fetch(`${API_BASE_URL}/api/timesheets/incomplete-dates`, {
            headers: { Authorization: `Bearer ${user.token}` }
          })
        ]);
        if (!submittedRes.ok) throw new Error('Failed to fetch submitted dates');
        if (!incompleteRes.ok) throw new Error('Failed to fetch incomplete dates');
        const submittedData = await submittedRes.json();
        const incompleteData = await incompleteRes.json();
        setSubmittedDates(submittedData.dates || []);
        setIncompleteDates(incompleteData.dates || []);
      } catch (err) {
        // Optionally toast error
      }
    };
    fetchHighlightDates();
  }, [user, isAuthenticated]);
  // For react-datepicker: highlight submitted (green) and incomplete (red) dates
  const getDayClassName = date => {
    const ymd = date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
    if (submittedDates.includes(ymd)) {
      return 'submitted-day';
    }
    if (incompleteDates.includes(ymd)) {
      return 'incomplete-day';
    }
    return undefined;
  };

  // Remove the old fetchData declaration entirely (the one before useCallback)
  // Use backend /my-tasks endpoint directly
  const fetchData = useCallback(async (date = new Date()) => {
    if (!isAuthenticated() || !user) return;
    setLoading(true);
    try {
      const dateStr = date.toISOString().split('T')[0];
      const [timesheetRes, tasksRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/timesheets/date/${dateStr}`, { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch(`${API_BASE_URL}/api/timesheets/my-tasks`, { headers: { Authorization: `Bearer ${user.token}` } })
      ]);
      if (!timesheetRes.ok || !tasksRes.ok) throw new Error('Failed to fetch initial data');
      const timesheetData = await timesheetRes.json();
      const tasksData = await tasksRes.json();
      setTimesheet(normalizeTimesheetTasks(timesheetData));
      setTasks(tasksData);
    } catch (error) {
      toast.error(error.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    fetchData(selectedDate);
  }, [fetchData, selectedDate]);

  // Handle clicking outside calendar to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCalendar && !event.target.closest('.calendar-container')) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCalendar]);

  useEffect(() => {
    if (timesheet && timesheet.entries) {
      const parts = {};
      timesheet.entries.forEach((entry) => {
        if (entry._id) {
          parts[entry._id] = {
            start: split24Hour(entry.startTime),
            end: split24Hour(entry.endTime)
          };
        }
      });
      setEntryTimeParts(parts);
    }
  }, [timesheet]);

  // Helper to convert 24-hour time string ("13:45") to 12-hour format ("01:45 PM")
  function to12Hour(time24) {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour.toString().padStart(2, '0')}:${m} ${ampm}`;
  }
  // Helper to convert 12-hour format ("01:45 PM") to 24-hour ("13:45")
  function to24Hour(time12) {
    if (!time12) return '';
    let [time, ampm] = time12.split(' ');
    let [h, m] = time.split(':');
    h = parseInt(h, 10);
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${h.toString().padStart(2, '0')}:${m}`;
  }

  // Helper to build 12-hour time string from hour, minute, ampm
  function build12Hour(hour, minute, ampm) {
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')} ${ampm}`;
  }
  // Helper to split 24-hour time string to 12-hour parts
  function split24Hour(time24) {
    if (!time24) return { hour: '12', minute: '00', ampm: 'AM' };
    let [h, m] = time24.split(':');
    let hour = parseInt(h, 10);
    let ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return { hour: hour.toString().padStart(2, '0'), minute: m, ampm };
  }

  const handleEntryChange = (entryId, field, value) => {
    // Check if this is a pending entry
    const pendingEntry = pendingEntries.find(e => e._id === entryId);
    if (pendingEntry) {
      setPendingEntries(prev => prev.map(e => 
        e._id === entryId ? { ...e, [field]: value } : e
      ));
      
      // Update manual task name logic for pending entries
      if (field === 'task' && !isSpecialTaskType(value)) {
        setPendingEntries(prev => prev.map(e => 
          e._id === entryId ? { ...e, manualTaskName: '' } : e
        ));
      }
      if (field === 'task' && isSpecialTaskType(value)) {
        setPendingEntries(prev => prev.map(e => 
          e._id === entryId ? { ...e, manualTaskName: getSpecialTaskName(value) } : e
        ));
      }
      return;
    }
    
    // Handle existing timesheet entries (but only if in editing mode)
    if (!timesheet || !editingEntries.has(entryId)) return;
    
    // Deep clone entries to avoid reference issues
    const newEntries = timesheet.entries.map(e => {
      // Create a deep copy but preserve task objects properly
      const cloned = JSON.parse(JSON.stringify(e));
      // If the original task was an object, restore it (JSON.parse converts to plain object)
      if (e.task && typeof e.task === 'object') {
        cloned.task = e.task;
      }
      return cloned;
    });
    const idx = newEntries.findIndex(e => e._id === entryId);
    if (idx !== -1) {
      newEntries[idx][field] = value;
      if (field === 'task' && !isSpecialTaskType(value)) {
        newEntries[idx].manualTaskName = '';
      }
      if (field === 'task' && isSpecialTaskType(value)) {
        newEntries[idx].manualTaskName = getSpecialTaskName(value);
      }
    }
    setTimesheet({
      ...timesheet,
      entries: newEntries
    });
    
    // No automatic saving - only save when user clicks accept
  };

  // Utility to check for valid MongoDB ObjectId
  function isValidObjectId(id) {
    // 24 hex characters
    return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
  }

  const saveEntry = async (entry, returnSaved = false, tempId = null) => {
    if (!entry) return;
    // Prevent saving if neither a task nor a manual task is selected
    const isSpecial = isSpecialTaskEntry(entry);
    if (!entry.task && !isSpecial) {
      toast.error('Please select a task before saving.');
      return;
    }
    try {
      let res;
      // Prepare payload based on task selection
      let payload = {
        workDescription: entry.workDescription,
        startTime: entry.startTime,
        endTime: entry.endTime
      };
      
      // Extract task ID properly - handle both populated objects and strings
      let taskId = null;
      if (isSpecialTaskType(entry.task)) {
        taskId = entry.task;
      } else if (entry.task) {
        // Handle populated task object or string ID
        taskId = (typeof entry.task === 'object' && entry.task._id) ? entry.task._id : entry.task;
      }
      
      // Only send manualTaskName if special task type is selected
      if (isSpecialTaskType(taskId)) {
        payload.taskId = taskId;
        payload.manualTaskName = getSpecialTaskName(taskId);
      } else if (taskId) {
        payload.taskId = taskId;
        // Do not send manualTaskName for real tasks
      } else {
        payload.taskId = null;
        payload.manualTaskName = entry.manualTaskName || '';
      }
      
      if (entry._id && isValidObjectId(entry._id)) {
        // PATCH for existing entry with valid ObjectId
        res = await fetch(`${API_BASE_URL}/api/timesheets/entry/${entry._id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify(payload),
        });
      } else {
        // POST for new entry or temp id
        res = await fetch(`${API_BASE_URL}/api/timesheets/add-entry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify(payload),
        });
      }
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to save entry');
      }
      const updatedTimesheet = await res.json();
      toast.success('Entry saved!');
      // If called for optimistic UI, return the new entry for replacement
      if (returnSaved && tempId) {
        // Find the new entry by comparing entries
        const newEntry = updatedTimesheet.entries.find(e => !e._id || e._id !== tempId);
        // Fallback: just use the last entry
        return newEntry || updatedTimesheet.entries[updatedTimesheet.entries.length - 1];
      } else {
        // Instead of replacing the whole timesheet, update only the relevant entry if possible
        setTimesheet(ts => {
          const normUpdated = normalizeTimesheetTasks(updatedTimesheet);
          if (!ts || !ts.entries) return normUpdated;
          // Find the updated entry by _id
          const updatedEntry = normUpdated.entries.find(e => e._id === entry._id);
          if (!updatedEntry) return normUpdated;
          // Deep clone all entries, replace only the relevant one
          const newEntries = ts.entries.map(e => e._id === entry._id ? JSON.parse(JSON.stringify(updatedEntry)) : JSON.parse(JSON.stringify(e)));
          return { ...ts, ...normUpdated, entries: newEntries };
        });
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };



  const handleAddTimeslot = async () => {
    if (!timesheet) return;
    
    // Get current time, round up to next multiple of 5 minutes
    const now = new Date();
    let minutes = now.getMinutes();
    let add = 5 - (minutes % 5);
    if (add === 5) add = 0;
    now.setMinutes(minutes + add);
    now.setSeconds(0);
    now.setMilliseconds(0);
    const pad = (n) => n.toString().padStart(2, '0');
    const startTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    // End time same as start time
    const endTime = startTime;
    
    // Create a temporary ID for the pending entry
    const tempId = `temp_${Date.now()}`;
    
    const newEntry = {
      _id: tempId,
      task: '', // Default to no task selected
      manualTaskName: '',
      workDescription: '',
      startTime,
      endTime,
      isPending: true
    };
    
    setPendingEntries(prev => [...prev, newEntry]);
    
    // Update entryTimeParts for the new entry
    setEntryTimeParts(parts => ({
      ...parts,
      [tempId]: {
        start: split24Hour(startTime),
        end: split24Hour(endTime)
      }
    }));
  };

  // Handle accepting a pending or editing timeslot
  const handleAcceptTimeslot = async (entryId, entry) => {
    try {
      if (entry.isPending) {
        // This is a new pending entry - save to MongoDB
        const payload = {
          workDescription: entry.workDescription || '',
          startTime: entry.startTime,
          endTime: entry.endTime,
          date: selectedDate.toISOString().split('T')[0]
        };
        
        // Extract task ID properly
        let taskId = null;
        if (isSpecialTaskType(entry.task)) {
          taskId = entry.task;
          payload.taskId = taskId;
          payload.manualTaskName = getSpecialTaskName(taskId);
        } else if (entry.task) {
          taskId = (typeof entry.task === 'object' && entry.task._id) ? entry.task._id : entry.task;
          payload.taskId = taskId;
        } else {
          payload.taskId = null;
          payload.manualTaskName = entry.manualTaskName || '';
        }
        
        if (!payload.taskId && !payload.manualTaskName) {
          toast.error('Please select a task before accepting.');
          return;
        }
        
        const res = await fetch(`${API_BASE_URL}/api/timesheets/add-entry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify(payload),
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to save timeslot');
        }
        
        const updatedTimesheet = await res.json();
        setTimesheet(normalizeTimesheetTasks(updatedTimesheet));
        
        // Remove from pending entries
        setPendingEntries(prev => prev.filter(e => e._id !== entryId));
        
        toast.success('Timeslot saved!');
      } else {
        // This is an existing entry being edited - update in MongoDB
        await saveEntry(entry);
        
        // Remove from editing state
        setEditingEntries(prev => {
          const newSet = new Set(prev);
          newSet.delete(entryId);
          // Clear original order when no more entries are being edited
          if (newSet.size === 0) {
            setOriginalEntryOrder([]);
          }
          return newSet;
        });
        
        toast.success('Timeslot updated!');
      }
    } catch (error) {
      toast.error(error.message);
    }
  };
  
  // Handle rejecting a pending or editing timeslot
  const handleRejectTimeslot = (entryId, entry) => {
    if (entry.isPending) {
      // Remove from pending entries
      setPendingEntries(prev => prev.filter(e => e._id !== entryId));
    } else {
      // Remove from editing state (revert changes)
      setEditingEntries(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        // Clear original order when no more entries are being edited
        if (newSet.size === 0) {
          setOriginalEntryOrder([]);
        }
        return newSet;
      });
      
      // Refresh data to revert any unsaved changes
      fetchData(selectedDate);
    }
  };
  
  // Handle starting to edit an existing timeslot
  const handleEditTimeslot = (entryId) => {
    // Store original sorted order when starting to edit
    if (originalEntryOrder.length === 0) {
      const sortedEntries = [...(timesheet?.entries || [])]
        .sort((a, b) => {
          if (!a.startTime || !b.startTime) return 0;
          const [aHour, aMin] = a.startTime.split(':').map(Number);
          const [bHour, bMin] = b.startTime.split(':').map(Number);
          const aTime = aHour * 60 + aMin;
          const bTime = bHour * 60 + bMin;
          return aTime - bTime;
        });
      setOriginalEntryOrder(sortedEntries.map(e => e._id));
    }
    setEditingEntries(prev => new Set([...prev, entryId]));
  };

  const formatTime = (minutes) => {
    if (!minutes || minutes <= 0) return '0h 0m';
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };
  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const getTimeOptions = (max = 150) => {
    const options = [];
    for (let i = 10; i <= max; i += 10) {
      const h = Math.floor(i / 60);
      const m = i % 60;
      let label = '';
      if (h > 0) label += `${h}h`;
      if (m > 0) label += (h > 0 ? ' ' : '') + `${m}m`;
      if (!label) label = '0m';
      options.push({ value: i, label });
    }
    return options;
  };

  // Helper functions for date checking
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isYesterday = (date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return date.toDateString() === yesterday.toDateString();
  };

  // Updated to allow editing of any date as long as timesheet is not submitted
  const isEditableDate = (date) => {
    // Allow editing of any previous date - no date restrictions
    return true;
  };

  const isEditable = (timesheet) => {
    if (!timesheet) return true; // Allow creating new timesheet entries for any date
    // Only check if timesheet is completed/submitted - no date restrictions
    return !timesheet.isCompleted;
  };

  const handleDateChange = (date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  // Helper function to calculate minutes between two times
  const getMinutesBetween = (startTime, endTime) => {
    if (!startTime || !endTime) return 0;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    let start = sh * 60 + sm;
    let end = eh * 60 + em;
    if (end < start) end += 24 * 60; // handle overnight
    return end - start;
  };

  // Remove userCanSeeTask and fetchRelevantTasks logic
  // Use backend /my-tasks endpoint directly
  

  useEffect(() => {
    fetchData(selectedDate);
    // Clear pending entries when date changes
    setPendingEntries([]);
    setEditingEntries(new Set());
    setOriginalEntryOrder([]);
  }, [fetchData, selectedDate]);

  // Auto-resize all textareas when timesheet data changes
  useEffect(() => {
    if (!timesheet || !timesheet.entries) return;
    
    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      timesheet.entries.forEach(entry => {
        const textarea = document.querySelector(`textarea[data-entry-id="${entry._id}"]`);
        if (textarea && entry.workDescription) {
          textarea.style.height = 'auto';
          textarea.style.height = (textarea.scrollHeight) + 'px';
        }
      });
    }, 50);

    return () => clearTimeout(timer);
  }, [timesheet]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  const handleEntryTimePartChange = (entryId, type, part, value) => {
    // Check if this is a pending entry
    const pendingEntry = pendingEntries.find(e => e._id === entryId);
    if (pendingEntry) {
      const prev = entryTimeParts[entryId] || { start: split24Hour(pendingEntry.startTime), end: split24Hour(pendingEntry.endTime) };
      const updated = {
        ...prev,
        [type]: {
          ...prev[type],
          [part]: value
        }
      };
      setEntryTimeParts({ ...entryTimeParts, [entryId]: updated });
      const newTime = build12Hour(updated[type].hour, updated[type].minute, updated[type].ampm);
      
      // Update pending entry
      setPendingEntries(prev => prev.map(e => 
        e._id === entryId ? { ...e, [type === 'start' ? 'startTime' : 'endTime']: to24Hour(newTime) } : e
      ));
      return;
    }
    
    // Handle existing entries (only if in editing mode)
    const entry = timesheet?.entries.find(e => e._id === entryId);
    if (!entry || !editingEntries.has(entryId)) return;
    
    const prev = entryTimeParts[entryId] || { start: split24Hour(entry.startTime), end: split24Hour(entry.endTime) };
    const updated = {
      ...prev,
      [type]: {
        ...prev[type],
        [part]: value
      }
    };
    setEntryTimeParts({ ...entryTimeParts, [entryId]: updated });
    const newTime = build12Hour(updated[type].hour, updated[type].minute, updated[type].ampm);
    handleEntryChange(entryId, type === 'start' ? 'startTime' : 'endTime', to24Hour(newTime));
  };

  // Add delete handler
  const handleDeleteEntry = async (entryId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheets/entry/${entryId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to delete entry');
      }
      const updatedTimesheet = await res.json();
      setTimesheet(normalizeTimesheetTasks(updatedTimesheet));
      toast.success('Timeslot deleted!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Calculate total time from all timeslots (excluding permission)
  const getTotalTime = () => {
    if (!timesheet || !timesheet.entries) return 0;
    let total = 0;
    timesheet.entries.forEach(entry => {
      // Skip permission entries for total calculation
      if (entry.manualTaskName === 'Permission' || entry.task === 'permission') {
        return;
      }
      if (entry.startTime && entry.endTime) {
        const [sh, sm] = entry.startTime.split(':').map(Number);
        const [eh, em] = entry.endTime.split(':').map(Number);
        let start = sh * 60 + sm;
        let end = eh * 60 + em;
        if (end < start) end += 24 * 60; // handle overnight
        total += end - start;
      }
    });
    return total;
  };
  const formatTotalTime = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Timesheets</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track and manage your daily work logs.
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isToday(selectedDate) ? 'Today' : selectedDate.toLocaleDateString()}
            {isEditable(timesheet) && (
              <span className="text-xs bg-green-500 px-1 rounded">Editable</span>
            )}
            {timesheet && timesheet.isCompleted && (
              <span className="text-xs bg-red-500 text-white px-1 rounded">Submitted</span>
            )}
          </button>
          {showCalendar && (
            <div className="absolute right-0 top-full mt-2 z-10 calendar-container">
              <DatePicker
                selected={selectedDate}
                onChange={handleDateChange}
                inline
                maxDate={new Date()}
                dateFormat="yyyy-MM-dd"
                dayClassName={getDayClassName}
              />
            </div>
          )}
        </div>
      </div>
      <div className="space-y-6">
        {/* Information Banner - Show when timesheet is submitted */}
        {timesheet && timesheet.isCompleted && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-blue-800 font-medium">Timesheet Submitted</p>
                <p className="text-blue-700 text-sm">
                  This timesheet has been submitted and is now read-only. No further changes can be made.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Warning Banner for Yesterday's Unsubmitted Timesheet */}
        {isYesterday(selectedDate) && timesheet && !timesheet.isCompleted && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-amber-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="text-amber-800 font-medium">Yesterday's Timesheet Not Submitted</p>
                <p className="text-amber-700 text-sm">
                  Don't forget to submit your timesheet for yesterday before it becomes read-only.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{formatDate(timesheet?.date)}</h3>
              <p className="text-gray-600 mt-1">
                {isToday(selectedDate) 
                  ? 'Today\'s timesheet - Editable' 
                  : isYesterday(selectedDate)
                    ? timesheet?.isCompleted 
                      ? 'Yesterday\'s timesheet (Submitted)' 
                      : 'Yesterday\'s timesheet - Editable'
                    : timesheet?.isCompleted 
                      ? 'Previous timesheet (Submitted) - View Only' 
                      : 'Previous timesheet (Not submitted) - View Only'
                }
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Total Time</p>
              <p className="text-2xl font-bold text-blue-600">{formatTotalTime(getTotalTime())}</p>
            </div>
          </div>
        </div>
        {/* Add Timeslot Button */}
        {timesheet && isEditable(timesheet) && (
          <div>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={handleAddTimeslot}
            >
              + Add Timeslot
            </button>
          </div>
        )}

        {/* Timeslot Entries */}
        <div className="space-y-4 overflow-x-auto scrollbar-hide">
          {/* Pending Entries (new timeslots) */}
          {pendingEntries.map((entry) => {
            const key = entry._id;
            const startParts = (entryTimeParts[key] && entryTimeParts[key].start) || split24Hour(entry.startTime);
            const endParts = (entryTimeParts[key] && entryTimeParts[key].end) || split24Hour(entry.endTime);
            
            return (
              <div key={key} className="bg-green-50 border-2 border-green-200 rounded-lg shadow">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 sm:gap-4">
                    <div className="flex flex-wrap gap-2 items-center justify-center w-full sm:w-auto">
                      {/* Editable Start Time */}
                      <div className="flex gap-1 items-center">
                        <select
                          value={startParts.hour}
                          onChange={e => handleEntryTimePartChange(key, 'start', 'hour', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                        >
                          {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span>:</span>
                        <select
                          value={startParts.minute}
                          onChange={e => handleEntryTimePartChange(key, 'start', 'minute', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2 max-h-32 overflow-y-auto"
                        >
                          {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={startParts.ampm}
                          onChange={e => handleEntryTimePartChange(key, 'start', 'ampm', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      <span>-</span>
                      {/* Editable End Time */}
                      <div className="flex gap-1 items-center">
                        <select
                          value={endParts.hour}
                          onChange={e => handleEntryTimePartChange(key, 'end', 'hour', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                        >
                          {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span>:</span>
                        <select
                          value={endParts.minute}
                          onChange={e => handleEntryTimePartChange(key, 'end', 'minute', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2 max-h-32 overflow-y-auto"
                        >
                          {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={endParts.ampm}
                          onChange={e => handleEntryTimePartChange(key, 'end', 'ampm', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Accept/Reject buttons for pending entries */}
                    <div className="flex gap-2 mt-2 sm:mt-0">
                      <button
                        className="bg-green-600 text-white p-2 rounded hover:bg-green-700 flex items-center justify-center"
                        onClick={() => handleAcceptTimeslot(key, entry)}
                        title="Accept"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        className="bg-red-600 text-white p-2 rounded hover:bg-red-700 flex items-center justify-center"
                        onClick={() => handleRejectTimeslot(key, entry)}
                        title="Reject"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Task Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Task
                      </label>
                      <select
                        value={entry.task || ''}
                        onChange={e => handleEntryChange(key, 'task', e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select task</option>
                        <option value="other">Other</option>
                        <option value="permission">Permission</option>
                        <option value="billing">Billing</option>
                        <option value="lunch">Lunch</option>
                        {tasks.map(task => (
                          <option key={task._id} value={task._id}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Work Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                        <span className="text-xs text-gray-500 ml-1">(Shift+Enter for new line)</span>
                      </label>
                      <textarea
                        value={entry.workDescription || ''}
                        onChange={e => handleEntryChange(key, 'workDescription', e.target.value)}
                        placeholder="Enter work description"
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[38px] max-h-72"
                        rows={1}
                      />
                    </div>
                    
                    {/* Time Spent */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Time Spent
                      </label>
                      <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                        {entry.startTime && entry.endTime ? formatTime(getMinutesBetween(entry.startTime, entry.endTime)) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {/* Existing Timeslots */}
          {[...(timesheet?.entries || [])]
            .sort((a, b) => {
              // If we have editing entries, use original order for those entries
              if (editingEntries.size > 0 && originalEntryOrder.length > 0) {
                const aEditingIndex = originalEntryOrder.indexOf(a._id);
                const bEditingIndex = originalEntryOrder.indexOf(b._id);
                
                // If both entries are in the original order (being edited), maintain that order
                if (aEditingIndex !== -1 && bEditingIndex !== -1) {
                  return aEditingIndex - bEditingIndex;
                }
                
                // If only one is being edited, place it based on whether it was in original order
                if (aEditingIndex !== -1) return aEditingIndex;
                if (bEditingIndex !== -1) return bEditingIndex;
              }
              
              // Default sort by start time (earliest to latest)
              if (!a.startTime || !b.startTime) return 0;
              const [aHour, aMin] = a.startTime.split(':').map(Number);
              const [bHour, bMin] = b.startTime.split(':').map(Number);
              const aTime = aHour * 60 + aMin;
              const bTime = bHour * 60 + bMin;
              return aTime - bTime;
            })
            .map((entry) => {
            // Robustly determine the correct value for the dropdown
            let taskValue = '';
            let taskDisplayName = '';
            
            if (entry?.task && typeof entry.task === 'object' && entry.task._id) {
              // Task is populated object
              taskValue = entry.task._id;
              taskDisplayName = entry.task.title;
            } else if (entry?.task && typeof entry.task === 'string' && !isSpecialTaskType(entry.task)) {
              // Task is just an ID string
              taskValue = entry.task;
              // Try to find the display name from available tasks
              const foundTask = tasks.find(t => t._id === entry.task);
              taskDisplayName = foundTask ? foundTask.title : null;
            } else if (isSpecialTaskEntry(entry) && !entry?.task?._id) {
              // Special task type (other, permission, billing, lunch)
              if (isSpecialTaskType(entry?.task)) {
                taskValue = entry.task;
                taskDisplayName = getSpecialTaskName(entry.task);
              } else {
                // Determine from manualTaskName
                const specialTaskNames = {
                  'Other': 'other',
                  'Permission': 'permission',
                  'Billing': 'billing',
                  'Lunch': 'lunch'
                };
                taskValue = specialTaskNames[entry?.manualTaskName] || 'other';
                taskDisplayName = entry?.manualTaskName || 'Other';
              }
            } else {
              taskValue = '';
              taskDisplayName = '';
            }
            
            const key = entry._id;
            const startParts = (entryTimeParts[key] && entryTimeParts[key].start) || split24Hour(entry.startTime);
            const endParts = (entryTimeParts[key] && entryTimeParts[key].end) || split24Hour(entry.endTime);
            const isLocked = !isEditable(timesheet);
            const isEditing = editingEntries.has(key);
            
            // Determine background color based on approval status (only for submitted timesheets)
            let backgroundClass = 'bg-white border-gray-200';
            if (timesheet?.isCompleted && !isEditing) {
              if (entry.approvalStatus === 'accepted') {
                backgroundClass = 'bg-green-50 border-green-200';
              } else if (entry.approvalStatus === 'rejected') {
                backgroundClass = 'bg-red-50 border-red-200';
              } else {
                backgroundClass = 'bg-white border-gray-200'; // pending
              }
            } else if (isEditing) {
              backgroundClass = 'bg-green-50 border-green-200';
            }
            
            return (
              <div key={key || Math.random()} className={`rounded-lg shadow border-2 ${backgroundClass}`}>
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 sm:gap-4">
                    <div className="flex flex-wrap gap-2 items-center justify-center w-full sm:w-auto">
                      {/* Editable Start Time */}
                      <div className="flex gap-1 items-center">
                        <select
                          value={startParts.hour}
                          onChange={e => isEditing && handleEntryTimePartChange(key, 'start', 'hour', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={!isEditing || isLocked}
                        >
                          {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span>:</span>
                        <select
                          value={startParts.minute}
                          onChange={e => isEditing && handleEntryTimePartChange(key, 'start', 'minute', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2 max-h-32 overflow-y-auto"
                          disabled={!isEditing || isLocked}
                        >
                          {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={startParts.ampm}
                          onChange={e => isEditing && handleEntryTimePartChange(key, 'start', 'ampm', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={!isEditing || isLocked}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                      <span>-</span>
                      {/* Editable End Time */}
                      <div className="flex gap-1 items-center">
                        <select
                          value={endParts.hour}
                          onChange={e => isEditing && handleEntryTimePartChange(key, 'end', 'hour', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={!isEditing || isLocked}
                        >
                          {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span>:</span>
                        <select
                          value={endParts.minute}
                          onChange={e => isEditing && handleEntryTimePartChange(key, 'end', 'minute', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2 max-h-32 overflow-y-auto"
                          disabled={!isEditing || isLocked}
                        >
                          {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={endParts.ampm}
                          onChange={e => isEditing && handleEntryTimePartChange(key, 'end', 'ampm', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={!isEditing || isLocked}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                    
                    {!isLocked && (
                      <div className="flex gap-2 mt-2 sm:mt-0">
                        {isEditing ? (
                          // Accept/Reject buttons when editing
                          <>
                            <button
                              className="bg-green-600 text-white p-2 rounded hover:bg-green-700 flex items-center justify-center"
                              onClick={() => handleAcceptTimeslot(key, entry)}
                              title="Accept Changes"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              className="bg-red-600 text-white p-2 rounded hover:bg-red-700 flex items-center justify-center"
                              onClick={() => handleRejectTimeslot(key, entry)}
                              title="Cancel Changes"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          // Edit/Delete buttons when not editing
                          <>
                            <button
                              className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
                              onClick={() => handleEditTimeslot(key)}
                              title="Edit"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 flex items-center justify-center"
                              onClick={() => handleDeleteEntry(entry._id)}
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Task Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Task
                      </label>
                      <select
                        value={taskValue}
                        onChange={e => isEditing && handleEntryChange(key, 'task', e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={!isEditing || isLocked}
                      >
                        <option value="">Select task</option>
                        <option value="other">Other</option>
                        <option value="permission">Permission</option>
                        <option value="billing">Billing</option>
                        <option value="lunch">Lunch</option>
                        {/* Build dropdown options: all allowed tasks, plus the selected one if missing */}
                        {(() => {
                          const selectedTaskId = taskValue;
                          const taskIds = tasks.map(t => t._id);
                          let options = [...tasks];
                          
                          // If the selected task is not in current tasks list but we have it populated
                          if (selectedTaskId && !taskIds.includes(selectedTaskId) && !isSpecialTaskType(selectedTaskId)) {
                            let selectedTaskObj = null;
                            
                            // If we have a populated task object, use it
                            if (entry.task && typeof entry.task === 'object' && entry.task._id === selectedTaskId) {
                              selectedTaskObj = entry.task;
                            } else {
                              // Fallback: try to find it in other entries
                              for (const e of timesheet.entries) {
                                if (e.task && typeof e.task === 'object' && e.task._id === selectedTaskId) {
                                  selectedTaskObj = e.task;
                                  break;
                                }
                              }
                            }
                            
                            // Last resort: create a placeholder
                            if (!selectedTaskObj) {
                              selectedTaskObj = { _id: selectedTaskId, title: '(Old/Completed Task)' };
                            }
                            
                            options = [...options, selectedTaskObj];
                          }
                          
                          const uniqueOptions = Object.values(options.reduce((acc, t) => {
                            acc[t._id] = t;
                            return acc;
                          }, {}));
                          
                          uniqueOptions.sort((a, b) => {
                            if (a._id === selectedTaskId) return -1;
                            if (b._id === selectedTaskId) return 1;
                            return 0;
                          });
                          
                          return uniqueOptions.map(task => (
                            <option key={task._id} value={task._id}>
                              {task.title}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                    
                    {/* Work Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                        <span className="text-xs text-gray-500 ml-1">(Shift+Enter for new line)</span>
                      </label>
                      <textarea
                        value={entry?.workDescription || ''}
                        data-entry-id={entry._id}
                        onChange={e => {
                          // Auto-resize
                          const ta = e.target;
                          ta.style.height = 'auto';
                          ta.style.height = (ta.scrollHeight) + 'px';
                          isEditing && handleEntryChange(key, 'workDescription', e.target.value);
                        }}
                        onInput={e => {
                          // Auto-resize on paste etc.
                          const ta = e.target;
                          ta.style.height = 'auto';
                          ta.style.height = (ta.scrollHeight) + 'px';
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                          }
                        }}
                        placeholder="Enter work description"
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none min-h-[38px] max-h-72"
                        disabled={!isEditing || isLocked}
                        rows={1}
                        style={{ overflow: 'hidden' }}
                      />
                    </div>
                    
                    {/* Time Spent */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Time Spent
                      </label>
                      <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded">
                        {entry.startTime && entry.endTime ? formatTime(getMinutesBetween(entry.startTime, entry.endTime)) : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Submit Button - Moved to bottom */}
        {timesheet && !timesheet.isCompleted && (
          <div className="mt-8">
            <button
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-lg font-semibold"
              onClick={() => setShowSubmitConfirm(true)}
            >
              Submit Timesheet
            </button>
            {/* Confirmation Popup */}
            {showSubmitConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 bg-opacity-40">
                <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
                  <h2 className="text-lg font-semibold mb-2 text-gray-800">Submit Timesheet?</h2>
                  <p className="mb-4 text-gray-700">If you submit the timesheet, you <span className='font-semibold text-red-600'>can't edit it</span> anymore. Are you sure you want to submit?</p>
                  <div className="flex justify-end gap-2">
                    <button
                      className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                      onClick={() => setShowSubmitConfirm(false)}
                      disabled={submitting}
                    >
                      Cancel
                    </button>
                    <button
                      className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                      onClick={async () => {
                        setSubmitting(true);
                        try {
                          const dateStr = selectedDate.toISOString().split('T')[0];
                          const res = await fetch(`${API_BASE_URL}/api/timesheets/submit`, {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${user.token}` 
                            },
                            body: JSON.stringify({ date: dateStr })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.message || 'Failed to submit timesheet');
                          setTimesheet(data.timesheet);
                          toast.success('Timesheet submitted!');
                          setShowSubmitConfirm(false);
                        } catch (error) {
                          toast.error(error.message);
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      disabled={submitting}
                    >
                      {submitting ? 'Submitting...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Timesheets; 