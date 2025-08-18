import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { PencilSquareIcon, CheckIcon, MagnifyingGlassIcon, EyeIcon } from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../apiConfig';

const Cost = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [hourlyRateInput, setHourlyRateInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState([]);
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [costLoading, setCostLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('taskCosting');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskDetails, setTaskDetails] = useState(null);
  const [taskTimeslots, setTaskTimeslots] = useState([]);
  const [taskDetailsLoading, setTaskDetailsLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetchUsers();
      if (activeTab === 'taskCosting') {
        fetchCosts();
      }
    }
  }, [user, activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/hourly-rates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      toast.error('Failed to load users');
    }
    setLoading(false);
  };

  const fetchCosts = async (q = '') => {
    setCostLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheets/task-costs${q ? `?search=${encodeURIComponent(q)}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCosts(data);
    } catch (e) {
      toast.error('Failed to load costs');
    }
    setCostLoading(false);
  };

  const fetchTaskDetails = async (taskId) => {
    setTaskDetailsLoading(true);
    try {
      // Fetch task details
      const taskRes = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const task = await taskRes.json();
      setTaskDetails(task);

      // Fetch timeslots for this specific task
      const timeslotsRes = await fetch(`${API_BASE_URL}/api/timesheets/task/${taskId}/timeslots`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const timeslots = await timeslotsRes.json();
      setTaskTimeslots(timeslots);
    } catch (e) {
      toast.error('Failed to load task details');
      console.error('Error fetching task details:', e);
    }
    setTaskDetailsLoading(false);
  };

  const handleEdit = (userId, currentRate) => {
    setEditingUserId(userId);
    setHourlyRateInput(currentRate);
  };

  const handleSave = async (userId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/hourly-rate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hourlyRate: Number(hourlyRateInput) }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Hourly rate updated');
      setEditingUserId(null);
      setHourlyRateInput('');
      fetchUsers();
      fetchCosts();
    } catch (e) {
      toast.error('Update failed');
    }
    setLoading(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCosts(search);
  };

  const handleUserSearch = (e) => {
    e.preventDefault();
    // User search is handled client-side through filtering
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
    fetchTaskDetails(task.taskId);
  };

  const filteredUsers = users.filter(u => 
    u.status === 'approved' && 
    (u.firstName.toLowerCase().includes(userSearch.toLowerCase()) ||
     u.lastName.toLowerCase().includes(userSearch.toLowerCase()) ||
     u.email.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const TaskDetailModal = () => {
    if (!showTaskModal || !selectedTask) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">Task Analysis: {selectedTask.title}</h3>
            <button
              onClick={() => {
                setShowTaskModal(false);
                setSelectedTask(null);
                setTaskDetails(null);
                setTaskTimeslots([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {taskDetailsLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Task Overview */}
              {taskDetails && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-lg font-semibold mb-3">Task Overview</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Client</p>
                      <p className="font-medium">{taskDetails.clientName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Work Type</p>
                      <p className="font-medium">{taskDetails.workType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Status</p>
                      <p className="font-medium">{taskDetails.status}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Priority</p>
                      <p className="font-medium">{taskDetails.priority}</p>
                    </div>
                  </div>
                  {taskDetails.description && (
                    <div className="mt-4">
                      <p className="text-sm text-gray-600">Description</p>
                      <p className="font-medium">{taskDetails.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-3">Cost Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedTask.assignedTo && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Assigned To</p>
                      <p className="font-medium">{selectedTask.assignedTo.name}</p>
                      <p className="text-sm text-blue-600">{selectedTask.assignedTo.hours}h × ₹{selectedTask.assignedTo.hourlyRate} = ₹{selectedTask.assignedTo.cost.toFixed(2)}</p>
                    </div>
                  )}
                  {selectedTask.firstVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">First Verifier</p>
                      <p className="font-medium">{selectedTask.firstVerifier.name}</p>
                      <p className="text-sm text-blue-600">{selectedTask.firstVerifier.hours}h × ₹{selectedTask.firstVerifier.hourlyRate} = ₹{selectedTask.firstVerifier.cost.toFixed(2)}</p>
                    </div>
                  )}
                  {selectedTask.secondVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Second Verifier</p>
                      <p className="font-medium">{selectedTask.secondVerifier.name}</p>
                      <p className="text-sm text-blue-600">{selectedTask.secondVerifier.hours}h × ₹{selectedTask.secondVerifier.hourlyRate} = ₹{selectedTask.secondVerifier.cost.toFixed(2)}</p>
                    </div>
                  )}
                </div>
                <div className="mt-4 text-right">
                  <p className="text-xl font-bold text-green-700">Total Cost: ₹{selectedTask.totalCost.toFixed(2)}</p>
                </div>
              </div>

              {/* Timeslots */}
              <div className="bg-white rounded-lg border">
                <h4 className="text-lg font-semibold p-4 border-b">All Timeslots</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time Slot</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {taskTimeslots.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                            No timeslots found for this task
                          </td>
                        </tr>
                      ) : (
                        taskTimeslots.map((slot, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium">{slot.userName}</div>
                              <div className="text-sm text-gray-500">{slot.userRole}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {new Date(slot.date).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {slot.startTime} - {slot.endTime}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm">
                              {formatTime(slot.duration)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {slot.workDescription || '-'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                              ₹{slot.cost?.toFixed(2) || '0.00'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleEdit = (userId, currentRate) => {
    setEditingUserId(userId);
    setHourlyRateInput(currentRate);
  };

  const handleSave = async (userId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/hourly-rate`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ hourlyRate: Number(hourlyRateInput) }),
      });
      if (!res.ok) throw new Error('Failed to update');
      toast.success('Hourly rate updated');
      setEditingUserId(null);
      setHourlyRateInput('');
      fetchUsers();
      if (activeTab === 'taskCosting') {
        fetchCosts();
      }
    } catch (e) {
      toast.error('Update failed');
    }
    setLoading(false);
  };

  if (user?.role !== 'Admin') {
    return <div className="p-8 text-center text-lg font-semibold">Access denied</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Cost Management</h1>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('taskCosting')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'taskCosting'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Task Costing
          </button>
          <button
            onClick={() => setActiveTab('userRates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'userRates'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            User Hourly Rates
          </button>
        </nav>
      </div>

      {/* Task Costing Tab */}
      {activeTab === 'taskCosting' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">Task Costing</h2>
          <form onSubmit={handleSearch} className="mb-4 flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by task or user..."
              className="border rounded px-3 py-2 w-64"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1">
              <MagnifyingGlassIcon className="w-4 h-4" /> Search
            </button>
          </form>
          <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-white">Task</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">First Verifier</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Second Verifier</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Third Verifier</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fourth Verifier</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fifth Verifier</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Cost (₹)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {costLoading ? (
                  <tr><td colSpan={9} className="text-center py-8">Loading...</td></tr>
                ) : !Array.isArray(costs) || costs.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8">No tasks found.</td></tr>
                ) : costs.map((t) => (
                  <tr key={t.taskId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap font-semibold sticky left-0 bg-white border-r">
                      {t.title}
                    </td>
                    {[t.assignedTo, t.firstVerifier, t.secondVerifier, t.thirdVerifier, t.fourthVerifier, t.fifthVerifier].map((u, idx) => (
                      <td key={idx} className="px-4 py-2 whitespace-nowrap">
                        {u ? (
                          <div>
                            <div className="font-medium">{u.name}</div>
                            <div className="inline-block bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs mt-1">
                              {u.hours} hr | ₹{u.cost.toFixed(2)}
                            </div>
                          </div>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2 whitespace-nowrap font-bold text-green-700">₹{t.totalCost.toFixed(2)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <button
                        onClick={() => handleTaskClick(t)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm flex items-center gap-1"
                      >
                        <EyeIcon className="w-4 h-4" />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Hourly Rates Tab */}
      {activeTab === 'userRates' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">User Hourly Rates</h2>
          <form onSubmit={handleUserSearch} className="mb-4 flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by name or email..."
              className="border rounded px-3 py-2 w-64"
              value={userSearch}
              onChange={e => setUserSearch(e.target.value)}
            />
            <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-1">
              <MagnifyingGlassIcon className="w-4 h-4" /> Search
            </button>
          </form>
          <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hourly Rate (₹)</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u._id}>
                    <td className="px-4 py-2 whitespace-nowrap">{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{u.role}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {editingUserId === u._id ? (
                        <input
                          type="number"
                          min="0"
                          className="border rounded px-2 py-1 w-24"
                          value={hourlyRateInput}
                          onChange={e => setHourlyRateInput(e.target.value)}
                          disabled={loading}
                        />
                      ) : (
                        <span>{u.hourlyRate}</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {editingUserId === u._id ? (
                        <button
                          className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded"
                          onClick={() => handleSave(u._id)}
                          disabled={loading}
                        >
                          <CheckIcon className="w-4 h-4 inline" />
                        </button>
                      ) : (
                        <button
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                          onClick={() => handleEdit(u._id, u.hourlyRate)}
                        >
                          <PencilSquareIcon className="w-4 h-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal />
    </div>
  );
                    >
                      <CheckIcon className="w-4 h-4 inline" />
                    </button>
                  ) : (
                    <button
                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                      onClick={() => handleEdit(u._id, u.hourlyRate)}
                    >
                      <PencilSquareIcon className="w-4 h-4 inline" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Cost; 