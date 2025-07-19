import React, { useState, useEffect, useRef } from 'react';
import AdvancedTaskTable from '../../components/AdvancedTaskTable';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import ErrorBoundary from '../../components/ErrorBoundary';

const ALL_COLUMNS = [
  { id: 'title', label: 'Title', defaultWidth: 256 },
  { id: 'description', label: 'Description', defaultWidth: 180 },
  { id: 'clientName', label: 'Client Name', defaultWidth: 150 },
  { id: 'clientGroup', label: 'Client Group', defaultWidth: 150 },
  { id: 'workType', label: 'Work Type', defaultWidth: 150 },
  { id: 'billed', label: 'Internal Works', defaultWidth: 80 },
  { id: 'status', label: 'Task Status', defaultWidth: 120 },
  { id: 'verificationStatus', label: 'Verification Status', defaultWidth: 120 },
  { id: 'priority', label: 'Priority', defaultWidth: 120 },
  { id: 'inwardEntryDate', label: 'Inward Entry Date', defaultWidth: 150 },
  { id: 'dueDate', label: 'Due Date', defaultWidth: 120 },
  { id: 'targetDate', label: 'Target Date', defaultWidth: 120 },
  { id: 'assignedBy', label: 'Assigned By', defaultWidth: 150 },
  { id: 'assignedTo', label: 'Assigned To', defaultWidth: 150 },
  { id: 'verificationAssignedTo', label: 'First Verifier', defaultWidth: 150 },
  { id: 'secondVerificationAssignedTo', label: 'Second Verifier', defaultWidth: 150 },
  { id: 'files', label: 'Files', defaultWidth: 120 },
  { id: 'comments', label: 'Comments', defaultWidth: 120 },
];

const BilledTasks = () => {
  const { user, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const userId = user?._id || 'guest';
    const key = `billedtasks_columns_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return ALL_COLUMNS.map(col => col.id);
  });
  const [columnOrder, setColumnOrder] = useState(() => ALL_COLUMNS.map(col => col.id));
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(ALL_COLUMNS.map(col => [col.id, col.defaultWidth || 150])));
  const [sortBy, setSortBy] = useState('createdAt');

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`${API_BASE_URL}/api/tasks/all`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (!response.ok) throw new Error('Failed to fetch tasks');
        const data = await response.json();
        setTasks(data.filter(task => task.billed === true && task.status !== 'completed'));
      } catch (err) {
        setError(err.message);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    if (user && user.token) fetchTasks();
  }, [user]);

  useEffect(() => {
    const userId = user?._id || 'guest';
    const key = `billedtasks_columns_${userId}`;
    localStorage.setItem(key, JSON.stringify(visibleColumns));
  }, [visibleColumns, user]);

  if (!isAuthenticated() || user.role !== 'Admin') return null;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;
  if (error) return <div className="text-red-500 text-center p-4">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Billed Tasks</h2>
      <div className="flex flex-row gap-4 mb-4">
        <input
          type="text"
          placeholder="Search tasks..."
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <select
          className="px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
        >
          <option value="createdAt">Assigned On</option>
          <option value="priority">Priority</option>
          <option value="status">Stages</option>
          <option value="clientName">Client Name</option>
          <option value="clientGroup">Client Group</option>
          <option value="workType">Work Type</option>
          <option value="workDoneBy">Assigned To</option>
          <option value="billed">Billed</option>
        </select>
      </div>
      <AdvancedTaskTable
        tasks={tasks.filter(task => task.title.toLowerCase().includes(searchTerm.toLowerCase()))}
        viewType="billed"
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        columnOrder={columnOrder}
        setColumnOrder={setColumnOrder}
        columnWidths={columnWidths}
        setColumnWidths={setColumnWidths}
        currentUser={user}
        sortBy={sortBy}
      />
    </div>
  );
};

export default BilledTasks; 