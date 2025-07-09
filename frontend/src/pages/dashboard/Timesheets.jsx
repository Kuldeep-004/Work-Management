import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../../apiConfig';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

const Timesheets = () => {
  const { user, isAuthenticated } = useAuth();
  const [timesheet, setTimesheet] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entryTimeParts, setEntryTimeParts] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);

  const debounceTimeout = useRef(null);

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
      setTimesheet(timesheetData);
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
    const newTimesheet = {
      ...timesheet,
      entries: timesheet.entries.map(e => e._id === entryId ? { ...e, [field]: value } : e)
    };
    setTimesheet(newTimesheet);
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    const entry = newTimesheet.entries.find(e => e._id === entryId);
    debounceTimeout.current = setTimeout(() => {
      saveEntry(entry);
    }, 1000);
  };

  const saveEntry = async (entry, returnSaved = false, tempId = null) => {
    if (!entry) return;
    // Prevent saving if no task is selected
    if (!entry.task) {
      toast.error('Please select a task before saving.');
      return;
    }
    try {
      let res;
      if (entry._id) {
        // PATCH for existing entry
        res = await fetch(`${API_BASE_URL}/api/timesheets/entry/${entry._id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify({
            taskId: entry.task,
            workDescription: entry.workDescription,
            startTime: entry.startTime,
            endTime: entry.endTime
          }),
        });
      } else {
        // POST for new entry
        res = await fetch(`${API_BASE_URL}/api/timesheets/add-entry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify({
            taskId: entry.task,
            workDescription: entry.workDescription,
            startTime: entry.startTime,
            endTime: entry.endTime
          }),
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
        setTimesheet(updatedTimesheet);
      }
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  const defaultStart = '09:00 AM';
  const defaultEnd = '10:00 AM';

  const handleAddTimeslot = async () => {
    // Add a new unsaved entry to the timesheet UI
    if (!timesheet) return;
    const tempId = `temp-${Date.now()}`;
    const newEntry = {
      _id: tempId,
      task: '',
      workDescription: '',
      startTime: to24Hour(defaultStart),
      endTime: to24Hour(defaultEnd),
      isNew: true
    };
    setTimesheet({
      ...timesheet,
      entries: [...timesheet.entries, newEntry]
    });
    setEntryTimeParts({
      ...entryTimeParts,
      [tempId]: {
        start: split24Hour(to24Hour(defaultStart)),
        end: split24Hour(to24Hour(defaultEnd))
      }
    });
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

  const isEditable = (timesheet) => {
    if (!timesheet) return false;
    // If timesheet is completed, it's not editable
    if (timesheet.isCompleted) return false;
    // If it's today, it's editable
    if (isToday(selectedDate)) return true;
    // For previous days, only editable if not completed
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
      setTimesheet(updatedTimesheet);
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
        {/* Summary Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{formatDate(timesheet?.date)}</h3>
              <p className="text-gray-600 mt-1">
                {isToday(selectedDate) 
                  ? 'Today\'s timesheet' 
                  : timesheet?.isCompleted 
                    ? 'Previous timesheet (Submitted)' 
                    : 'Previous timesheet (Not submitted)'
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
          {[...(timesheet?.entries || [])].slice().reverse().map((entry) => {
            let taskValue = '';
            if (entry?.task) {
              taskValue = typeof entry.task === 'object' && entry.task !== null ? entry.task._id : entry.task;
            }
            const key = entry._id;
            const startParts = (entryTimeParts[key] && entryTimeParts[key].start) || split24Hour(entry.startTime);
            const endParts = (entryTimeParts[key] && entryTimeParts[key].end) || split24Hour(entry.endTime);
            const isSaving = entry.isNew === true ? false : !entry._id;
            const isLocked = !isEditable(timesheet);
            const handleTaskChange = async (e) => {
              const value = e.target.value;
              if (entry.isNew) {
                // Optimistically mark as saving
                setTimesheet(ts => ({
                  ...ts,
                  entries: ts.entries.map(en =>
                    en._id === entry._id ? { ...en, task: value, isSaving: true } : en
                  )
                }));
                // Prepare entry for saving
                const updatedEntry = { ...entry, task: value };
                delete updatedEntry.isNew;
                if (typeof updatedEntry._id === 'string' && updatedEntry._id.startsWith('temp-')) {
                  delete updatedEntry._id;
                }
                try {
                  const saved = await saveEntry({
                    ...updatedEntry,
                    startTime: entry.startTime,
                    endTime: entry.endTime,
                    workDescription: entry.workDescription
                  }, true, entry._id);
                  // Replace temp row with real entry from backend
                  setTimesheet(ts => ({
                    ...ts,
                    entries: ts.entries.map(en =>
                      en._id === entry._id ? saved : en
                    )
                  }));
                } catch (error) {
                  // On error, keep row editable and show error
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
                      <select
                        value={taskValue}
                        onChange={handleTaskChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSaving || isLocked}
                      >
                        <option value="">Select task</option>
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