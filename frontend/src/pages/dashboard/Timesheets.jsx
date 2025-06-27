import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';

const Timesheets = () => {
  const { user, isAuthenticated } = useAuth();
  const [timesheet, setTimesheet] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryTimeParts, setEntryTimeParts] = useState({});

  const debounceTimeout = useRef(null);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated() || !user) return;
    setLoading(true);
    try {
      const [timesheetRes, tasksRes] = await Promise.all([
        fetch('http://localhost:5000/api/timesheets/today', { headers: { Authorization: `Bearer ${user.token}` } }),
        fetch('http://localhost:5000/api/timesheets/my-tasks', { headers: { Authorization: `Bearer ${user.token}` } })
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
    fetchData();
  }, [fetchData]);

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

  const saveEntry = async (entry) => {
    if (!entry) return;
    try {
      let res;
      if (entry._id) {
        // PATCH for existing entry
        res = await fetch(`http://localhost:5000/api/timesheets/entry/${entry._id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify({
            taskId: entry.task,
            manualTaskName: entry.manualTaskName,
            workDescription: entry.workDescription,
            startTime: entry.startTime,
            endTime: entry.endTime
          }),
        });
      } else {
        // POST for new entry
        res = await fetch('http://localhost:5000/api/timesheets/add-entry', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${user.token}`
          },
          body: JSON.stringify({
            taskId: entry.task,
            manualTaskName: entry.manualTaskName,
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
      setTimesheet(updatedTimesheet);
      toast.success('Entry saved!');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const defaultStart = '09:00 AM';
  const defaultEnd = '10:00 AM';

  const handleAddTimeslot = async () => {
    // Immediately create a new timeslot with default times
    await saveEntry({
      task: null,
      manualTaskName: '',
      workDescription: '',
      startTime: to24Hour(defaultStart),
      endTime: to24Hour(defaultEnd)
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
      const res = await fetch(`http://localhost:5000/api/timesheets/entry/${entryId}`, {
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
        <div >
          <h1 className="text-2xl font-bold text-gray-800">My Timesheets</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track and manage your daily work logs.
          </p>
        </div>
      </div>
      <div className="space-y-6">
        {/* Summary Card */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">{formatDate(timesheet?.date)}</h3>
              <p className="text-gray-600 mt-1">Today's timesheet</p>
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
                  const res = await fetch('http://localhost:5000/api/timesheets/submit', {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${user.token}` }
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
        {timesheet && !timesheet.isCompleted && (
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
        <div className="space-y-4">
          {[...(timesheet?.entries || [])].slice().reverse().map((entry) => {
            let taskValue = '';
            if (entry?.task) {
              taskValue = typeof entry.task === 'object' && entry.task !== null ? entry.task._id : entry.task;
            } else if (entry && entry.task === null) {
              taskValue = 'other';
            }
            const showManualTaskName = taskValue === 'other';
            const key = entry._id;
            const startParts = (entryTimeParts[key] && entryTimeParts[key].start) || split24Hour(entry.startTime);
            const endParts = (entryTimeParts[key] && entryTimeParts[key].end) || split24Hour(entry.endTime);
            const isSaving = !entry._id;
            const isLocked = timesheet && timesheet.isCompleted;
            return (
              <div key={key || Math.random()} className="bg-white rounded-lg shadow border-2 border-gray-200">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-4 items-center">
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
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={isSaving || isLocked}
                        >
                          {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
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
                          className="border border-gray-300 rounded px-2 py-2"
                          disabled={isSaving || isLocked}
                        >
                          {['00', '15', '30', '45'].map(m => <option key={m} value={m}>{m}</option>)}
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
                        className="ml-4 bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                        onClick={() => handleDeleteEntry(entry._id)}
                        disabled={isSaving}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  {isSaving && <div className="text-blue-500 text-sm">Saving...</div>}
                  <div className={`grid ${showManualTaskName ? 'grid-cols-4' : 'grid-cols-3'} gap-4`}>
                    {/* Task Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Task
                      </label>
                      <select
                        value={taskValue}
                        onChange={(e) => !isSaving && !isLocked && handleEntryChange(key, 'task', e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSaving || isLocked}
                      >
                        <option value="">Select task</option>
                        {tasks.map(task => (
                          <option key={task._id} value={task._id}>
                            {task.title}
                          </option>
                        ))}
                        <option value="other">Other task...</option>
                      </select>
                    </div>
                    {/* Manual Task Input */}
                    {showManualTaskName && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Task Name
                        </label>
                        <input
                          type="text"
                          value={entry?.manualTaskName || ''}
                          onChange={(e) => !isSaving && !isLocked && handleEntryChange(key, 'manualTaskName', e.target.value)}
                          placeholder="Enter task name"
                          className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={isSaving || isLocked}
                        />
                      </div>
                    )}
                    {/* Work Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <input
                        type="text"
                        value={entry?.workDescription || ''}
                        onChange={(e) => !isSaving && !isLocked && handleEntryChange(key, 'workDescription', e.target.value)}
                        placeholder="Work description"
                        className="w-full border border-gray-300 rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isSaving || isLocked}
                      />
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