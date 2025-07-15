import React, { useState, useEffect, useRef } from 'react';
import TaskList from '../../components/TaskList';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL } from '../../apiConfig';
import FilterPopup from '../../components/FilterPopup';
import ErrorBoundary from '../../components/ErrorBoundary';
import AdvancedTaskTable from '../../components/AdvancedTaskTable';

const ALL_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'description', label: 'Description' },
  { id: 'clientName', label: 'Client Name' },
  { id: 'clientGroup', label: 'Client Group' },
  { id: 'workType', label: 'Work Type' },
  { id: 'billed', label: 'Billed' },
  { id: 'status', label: 'Task Status' },
  { id: 'verificationStatus', label: 'Verification Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'inwardEntryDate', label: 'Inward Entry Date' },
  { id: 'dueDate', label: 'Due Date' },
  { id: 'targetDate', label: 'Target Date' },
  { id: 'assignedBy', label: 'Assigned By' },
  { id: 'assignedTo', label: 'Assigned To' },
  { id: 'verificationAssignedTo', label: 'First Verifier' },
  { id: 'secondVerificationAssignedTo', label: 'Second Verifier' },
  { id: 'files', label: 'Files' },
  { id: 'comments', label: 'Comments' },
];

const UnBilledTasks = () => {
  const { user, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    const userId = user?._id || 'guest';
    const key = `unbilledtasks_columns_${userId}`;
    const saved = localStorage.getItem(key);
    if (saved) return JSON.parse(saved);
    return ALL_COLUMNS.map(col => col.id);
  });
  const [filters, setFilters] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnsDropdownRef = useRef(null);
  const filterPopupRef = useRef(null);
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
        setTasks(data.filter(task => task.billed === false && task.status !== 'completed'));
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
    const key = `unbilledtasks_columns_${userId}`;
    localStorage.setItem(key, JSON.stringify(visibleColumns));
  }, [visibleColumns, user]);

  if (!isAuthenticated() || user.role !== 'Admin') return null;
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;
  if (error) return <div className="text-red-500 text-center p-4">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">UnBilled Tasks</h2>
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
          <option value="clientName">Client</option>
        </select>
      </div>
      <AdvancedTaskTable
        tasks={tasks.filter(task => task.title.toLowerCase().includes(searchTerm.toLowerCase()))}
        viewType="unbilled"
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
        currentUser={user}
        sortBy={sortBy}
      />
    </div>
  );
};

export default UnBilledTasks; 