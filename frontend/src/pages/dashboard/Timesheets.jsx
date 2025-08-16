import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../../apiConfig';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

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

const Timesheets = () => {
  const { user, isAuthenticated } = useAuth();
  const [timesheet, setTimesheet] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entryTimeParts, setEntryTimeParts] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);

  const debounceTimeout = useRef(null);

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
    if (!timesheet) return;
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
      if (field === 'task' && value !== 'other') {
        newEntries[idx].manualTaskName = '';
      }
      if (field === 'task' && value === 'other') {
        newEntries[idx].manualTaskName = 'Other';
      }
    }
    setTimesheet({
      ...timesheet,
      entries: newEntries
    });
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    const entry = newEntries[idx];
    // Check if entry has task (object or string) or manual task name
    const hasTask = entry.task || entry.manualTaskName;
    if ((field === 'task' && hasTask) ||
        (field === 'startTime' && hasTask) ||
        (field === 'endTime' && hasTask)) {
      debounceTimeout.current = setTimeout(() => {
        saveEntry(entry);
      }, 500);
    } else if (hasTask && entry.workDescription) {
      debounceTimeout.current = setTimeout(() => {
        saveEntry(entry);
      }, 1000);
    }
  };

  // Utility to check for valid MongoDB ObjectId
  function isValidObjectId(id) {
    // 24 hex characters
    return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
  }

  const saveEntry = async (entry, returnSaved = false, tempId = null) => {
    if (!entry) return;
    // Prevent saving if neither a task nor a manual task is selected
    const isOther = entry.task === 'other' || entry.manualTaskName === 'Other';
    if (!entry.task && !isOther) {
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
      if (entry.task === 'other') {
        taskId = 'other';
      } else if (entry.task) {
        // Handle populated task object or string ID
        taskId = (typeof entry.task === 'object' && entry.task._id) ? entry.task._id : entry.task;
      }
      
      // Only send manualTaskName if "Other" is selected
      if (taskId === 'other') {
        payload.taskId = 'other';
        payload.manualTaskName = 'Other';
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

  const defaultStart = '09:00 AM';
  const defaultEnd = '10:00 AM';

  const handleAddTimeslot = async () => {
    if (!timesheet) return;
    try {
      const payload = {
        taskId: 'other',  // This will be converted to null in backend with manualTaskName set to 'Other'
        manualTaskName: '',  // Backend will set this to 'Other'
        workDescription: '',
        startTime: to24Hour(defaultStart),
        endTime: to24Hour(defaultEnd),
        date: selectedDate.toISOString().split('T')[0] // Pass the selected date
      };
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
        throw new Error(errorData.message || 'Failed to add timeslot');
      }
      const updatedTimesheet = await res.json();
      setTimesheet(normalizeTimesheetTasks(updatedTimesheet));
      // Update entryTimeParts for the new entry
      if (updatedTimesheet.entries && updatedTimesheet.entries.length > 0) {
        const lastEntry = updatedTimesheet.entries[updatedTimesheet.entries.length - 1];
        setEntryTimeParts(parts => ({
          ...parts,
          [lastEntry._id]: {
            start: split24Hour(lastEntry.startTime),
            end: split24Hour(lastEntry.endTime)
          }
        }));
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const formatTime = (minutes) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
  }, [fetchData, selectedDate]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  const handleEntryTimePartChange = (entryId, type, part, value) => {
    const entry = timesheet.entries.find(e => e._id === entryId);
    if (!entry) return;
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
    const entryIndex = timesheet.entries.findIndex(e => e._id === entryId);
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

  // Calculate total time from all timeslots
  const getTotalTime = () => {
    if (!timesheet || !timesheet.entries) return 0;
    let total = 0;
    timesheet.entries.forEach(entry => {
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
        {/* Submit Button */}
        {timesheet && !timesheet.isCompleted && (
          <div>
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={async () => {
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
                } catch (error) {
                  toast.error(error.message);
                }
              }}
            >
              Submit Timesheet
            </button>
          </div>
        )}
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
          {[...(timesheet?.entries || [])].map((entry) => {
            // Robustly determine the correct value for the dropdown
            let taskValue = '';
            let taskDisplayName = '';
            
            if (entry?.task && typeof entry.task === 'object' && entry.task._id) {
              // Task is populated object
              taskValue = entry.task._id;
              taskDisplayName = entry.task.title;
            } else if (entry?.task && typeof entry.task === 'string' && entry.task !== 'other') {
              // Task is just an ID string
              taskValue = entry.task;
              // Try to find the display name from available tasks
              const foundTask = tasks.find(t => t._id === entry.task);
              taskDisplayName = foundTask ? foundTask.title : null;
            } else if (
              (entry?.task === 'other' || entry?.manualTaskName === 'Other') && !entry?.task?._id
            ) {
              taskValue = 'other';
              taskDisplayName = 'Other';
            } else {
              taskValue = '';
              taskDisplayName = '';
            }

            const key = entry._id;
            const startParts = (entryTimeParts[key] && entryTimeParts[key].start) || split24Hour(entry.startTime);
            const endParts = (entryTimeParts[key] && entryTimeParts[key].end) || split24Hour(entry.endTime);
            const isSaving = entry.isNew === true ? false : !entry._id;
            const isLocked = !isEditable(timesheet);
            const handleTaskChange = async (e) => {
              const value = e.target.value;
              if (entry.isNew) {
                setTimesheet(ts => ({
                  ...ts,
                  entries: ts.entries.map(en =>
                    en._id === entry._id ? { ...en, task: value, isSaving: true } : en
                  )
                }));
                const updatedEntry = { ...entry, task: value };
                delete updatedEntry.isNew;
                try {
                  const saved = await saveEntry({
                    ...updatedEntry,
                    startTime: entry.startTime,
                    endTime: entry.endTime,
                    workDescription: entry.workDescription
                  }, true, entry._id);
                  setTimesheet(ts => ({
                    ...ts,
                    entries: ts.entries.map(en =>
                      en._id === entry._id ? saved : en
                    )
                  }));
                } catch (error) {
                  setTimesheet(ts => ({
                    ...ts,
                    entries: ts.entries.map(en =>
                      en._id === entry._id ? { ...en, isSaving: false } : en
                    )
                  }));
                }
              } else {
                handleEntryChange(key, 'task', value);
              }
            };
            return (
              <div key={key || Math.random()} className="bg-white rounded-lg shadow border-2 border-gray-200">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2 sm:gap-4">
                    <div className="flex flex-wrap gap-2 items-center justify-center w-full sm:w-auto">
                      {/* Editable Start Time */}
                      <div className="flex gap-1 items-center">
                        <select
                          value={startParts.hour}
                          onChange={e => !isSaving && !isLocked && handleEntryTimePartChange(key, 'start', 'hour', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={isSaving || isLocked}
                        >
                          {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span>:</span>
                        <select
                          value={startParts.minute}
                          onChange={e => !isSaving && !isLocked && handleEntryTimePartChange(key, 'start', 'minute', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2 max-h-32 overflow-y-auto"
                          disabled={isSaving || isLocked}
                        >
                          {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={startParts.ampm}
                          onChange={e => !isSaving && !isLocked && handleEntryTimePartChange(key, 'start', 'ampm', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={isSaving || isLocked}
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
                          onChange={e => !isSaving && !isLocked && handleEntryTimePartChange(key, 'end', 'hour', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={isSaving || isLocked}
                        >
                          {Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span>:</span>
                        <select
                          value={endParts.minute}
                          onChange={e => !isSaving && !isLocked && handleEntryTimePartChange(key, 'end', 'minute', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2 max-h-32 overflow-y-auto"
                          disabled={isSaving || isLocked}
                        >
                          {Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={endParts.ampm}
                          onChange={e => !isSaving && !isLocked && handleEntryTimePartChange(key, 'end', 'ampm', e.target.value)}
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={isSaving || isLocked}
                        >
                          <option value="AM">AM</option>
                          <option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                    {!isLocked && (
                      <button
                        className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 mt-2 sm:mt-0 sm:ml-4"
                        onClick={() => handleDeleteEntry(entry._id)}
                        disabled={isSaving}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {isSaving && <div className="text-blue-500 text-sm">Saving...</div>}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Task Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Task
                      </label>
                      {/* Always show dropdown for task selection */}
                      <select
                        value={taskValue}
                        onChange={handleTaskChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSaving || isLocked}
                      >
                        <option value="">Select task</option>
                        <option value="other">Other</option>
                        {/* Build dropdown options: all allowed tasks, plus the selected one if missing */}
                        {(() => {
                          const selectedTaskId = taskValue;
                          const taskIds = tasks.map(t => t._id);
                          let options = [...tasks];
                          
                          // If the selected task is not in current tasks list but we have it populated
                          if (selectedTaskId && !taskIds.includes(selectedTaskId) && selectedTaskId !== 'other') {
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
                      </label>
                      <input
                        type="text"
                        value={entry?.workDescription || ''}
                        onChange={(e) => !isSaving && !isLocked && handleEntryChange(key, 'workDescription', e.target.value)}
                        placeholder="Enter work description"
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSaving || isLocked}
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
      </div>
    </div>
  );
};

export default Timesheets; 