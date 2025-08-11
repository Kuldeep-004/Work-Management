import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { PencilSquareIcon, CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../apiConfig';

const Cost = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [hourlyRateInput, setHourlyRateInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState([]);
  const [search, setSearch] = useState('');
  const [costLoading, setCostLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetchUsers();
      fetchCosts();
    }
  }, [user]);

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

  if (user?.role !== 'Admin') {
    return <div className="p-8 text-center text-lg font-semibold">Access denied</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
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
      <div className="bg-white rounded-lg shadow p-4 overflow-x-auto mb-10">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">First Verifier</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Second Verifier</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {costLoading ? (
              <tr><td colSpan={5} className="text-center py-8">Loading...</td></tr>
            ) : !Array.isArray(costs) || costs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8">No tasks found.</td></tr>
            ) : costs.map((t) => (
              <tr key={t.taskId}>
                <td className="px-4 py-2 whitespace-nowrap font-semibold">{t.title}</td>
                {[t.assignedTo, t.firstVerifier, t.secondVerifier].map((u, idx) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-2xl font-bold mb-6">User Hourly Rates</h2>
      <div className="bg-white rounded-lg shadow p-4 mb-10 overflow-x-auto">
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
            {users.filter(u => u.status === 'approved').map((u) => (
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
  );
};

export default Cost; 