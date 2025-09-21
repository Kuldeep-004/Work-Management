import React, { useState, useEffect, useRef } from 'react';
import TaskList from '../../components/TaskList';
import { useAuth } from '../../context/AuthContext';
import { API_BASE_URL, fetchTabState, saveTabState } from '../../apiConfig';
import FilterPopup from '../../components/FilterPopup';
import ErrorBoundary from '../../components/ErrorBoundary';
import AdvancedTaskTable from '../../components/AdvancedTaskTable';

const ALL_COLUMNS = [
  { id: 'title', label: 'Client Name & Work In Brief', defaultWidth: 256 },
  { id: 'description', label: 'Description', defaultWidth: 180 },
  { id: 'clientName', label: 'Client Name', defaultWidth: 150 },
  { id: 'clientGroup', label: 'Client Group', defaultWidth: 150 },
  { id: 'workType', label: 'Work Type', defaultWidth: 150 },
  { id: 'billed', label: 'Billed', defaultWidth: 80 },
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

const UnBilledTasks = () => {
  const { user, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(() => ALL_COLUMNS.map(col => col.id));
  const [columnOrder, setColumnOrder] = useState(() => ALL_COLUMNS.map(col => col.id));
  const [columnWidths, setColumnWidths] = useState(() => Object.fromEntries(ALL_COLUMNS.map(col => [col.id, col.defaultWidth || 150])));
  const [sortBy, setSortBy] = useState(null);
  const [tableStateLoaded, setTableStateLoaded] = useState(false);
  const [filters, setFilters] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnsDropdownRef = useRef(null);
  const tableRef = useRef(null);
  const filterPopupRef = useRef(null);
  const tabId = 'unbilledTasksMain';
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [rowOrder, setRowOrder] = useState([]);

  // Fetch full table state from backend on mount
  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    (async () => {
      try {
        const state = await fetchTabState('unbilledTasks', user.token);
        if (isMounted && state) {
          setVisibleColumns(Array.isArray(state.visibleColumns) ? state.visibleColumns : ALL_COLUMNS.map(col => col.id));
          setColumnOrder(Array.isArray(state.columnOrder) ? state.columnOrder : ALL_COLUMNS.map(col => col.id));
          setColumnWidths(state.columnWidths && typeof state.columnWidths === 'object' ? state.columnWidths : Object.fromEntries(ALL_COLUMNS.map(col => [col.id, col.defaultWidth || 150])));
          setSortBy(typeof state.sortBy === 'string' ? state.sortBy : 'createdAt');
          setRowOrder(Array.isArray(state.rowOrder) ? state.rowOrder : []);
        } else if (isMounted) {
          setVisibleColumns(ALL_COLUMNS.map(col => col.id));
          setColumnOrder(ALL_COLUMNS.map(col => col.id));
          setColumnWidths(Object.fromEntries(ALL_COLUMNS.map(col => [col.id, col.defaultWidth || 150])));
          setSortBy('createdAt');
          setRowOrder([]);
        }
      } catch {
        if (isMounted) {
          setVisibleColumns(ALL_COLUMNS.map(col => col.id));
          setColumnOrder(ALL_COLUMNS.map(col => col.id));
          setColumnWidths(Object.fromEntries(ALL_COLUMNS.map(col => [col.id, col.defaultWidth || 150])));
          setSortBy('createdAt');
          setRowOrder([]);
        }
      } finally {
        if (isMounted) setTableStateLoaded(true);
      }
    })();
    return () => { isMounted = false; };
  }, [user]);

  // Save full table state to backend whenever any part changes (after initial load)
  useEffect(() => {
    if (!user?.token || !tableStateLoaded) return;
    if (!visibleColumns || !columnOrder || !columnWidths) return;
    saveTabState('unbilledTasks', { visibleColumns, columnOrder, columnWidths, sortBy, rowOrder }, user.token).catch(() => {});
  }, [visibleColumns, columnOrder, columnWidths, sortBy, rowOrder, user, tableStateLoaded]);

  const applyRowOrder = (tasks, order) => {
    if (!order || order.length === 0) return tasks;
    
    const taskMap = new Map(tasks.map(task => [task._id, task]));
    const orderedTasks = [];
    const remainingTasks = new Set(tasks.map(task => task._id));
    
    // Add tasks in the specified order
    order.forEach(id => {
      if (taskMap.has(id)) {
        orderedTasks.push(taskMap.get(id));
        remainingTasks.delete(id);
      }
    });
    
    // Add any remaining tasks that weren't in the rowOrder
    remainingTasks.forEach(id => {
      orderedTasks.push(taskMap.get(id));
    });
    
    return orderedTasks;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch tasks and rowOrder together
        const [tasksResponse, tabState] = await Promise.all([
          fetch(`${API_BASE_URL}/api/tasks/all`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
          fetchTabState('unbilledTasks', user.token)
        ]);
        if (!tasksResponse.ok) throw new Error('Failed to fetch tasks');
        let tasksData = await tasksResponse.json();
        tasksData = tasksData.filter(task => task.billed === true && task.status !== 'completed');

        // Get rowOrder from tabState
        let order = [];
        if (tabState && Array.isArray(tabState.rowOrder)) {
          order = tabState.rowOrder;
        }
        // Apply row order if available
        if (order.length > 0) {
          tasksData = applyRowOrder(tasksData, order);
        }
        setTasks(tasksData);

        // Fetch priorities
        const prioritiesResponse = await fetch(`${API_BASE_URL}/api/priorities`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        if (prioritiesResponse.ok) {
          const prioritiesData = await prioritiesResponse.json();
          setPriorities(prioritiesData);
        }
      } catch (err) {
        setError(err.message);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };
    if (user && user.token) fetchData();
  }, [user]);

  if (!isAuthenticated() || user.role !== 'Admin') return null;
  if (!tableStateLoaded || !visibleColumns || !columnOrder || !columnWidths) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div></div>;
  }
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
        {/* Replace the old <select> with the dashboard-style Group By dropdown */}
        <div className="relative flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
            onClick={() => setShowGroupByDropdown(v => !v)}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/></svg>
            <span className="font-semibold">Group By</span>
          </button>
          {showGroupByDropdown && (
            <div className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-44 animate-fade-in" style={{minWidth: '160px'}}>
              <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">Group By</div>
              <button className={`block w-full text-left px-4 py-2 rounded ${!sortBy || sortBy === '' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { setSortBy(''); setShowGroupByDropdown(false); }}>None</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${sortBy === 'createdAt' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { setSortBy('createdAt'); setShowGroupByDropdown(false); }}>Assigned On</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${sortBy === 'priority' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { setSortBy('priority'); setShowGroupByDropdown(false); }}>Priority</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${sortBy === 'status' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { setSortBy('status'); setShowGroupByDropdown(false); }}>Stages</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${sortBy === 'clientName' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { setSortBy('clientName'); setShowGroupByDropdown(false); }}>Client Name</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${sortBy === 'clientGroup' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { setSortBy('clientGroup'); setShowGroupByDropdown(false); }}>Client Group</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${sortBy === 'workType' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { setSortBy('workType'); setShowGroupByDropdown(false); }}>Work Type</button>
              <button className={`block w-full text-left px-4 py-2 rounded ${sortBy === 'billed' ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-blue-50 text-gray-700'}`} onClick={() => { setSortBy('billed'); setShowGroupByDropdown(false); }}>Billed</button>
            </div>
          )}
        </div>
      </div>
      {/* Responsive table wrapper - hide scrollbar */}
      <div className="table-wrapper-no-scrollbar w-full" ref={tableRef}>
        <AdvancedTaskTable
          tasks={sortBy ? tasks.filter(task => task.title.toLowerCase().includes(searchTerm.toLowerCase()))
                        .sort((a, b) => {
                          let aValue = a[sortBy];
                          let bValue = b[sortBy];
                          if (sortBy === 'createdAt') {
                            aValue = new Date(aValue);
                            bValue = new Date(bValue);
                          } else if (sortBy === 'priority') {
                            // Generate priority order dynamically
                            const priorityOrder = {};
                            priorities.forEach((priority, index) => {
                              priorityOrder[priority.name] = priority.order || (priority.isDefault ? index + 1 : index + 100);
                            });
                            aValue = priorityOrder[aValue] || 999;
                            bValue = priorityOrder[bValue] || 999;
                          }
                          if (aValue < bValue) return -1;
                          if (aValue > bValue) return 1;
                          return 0;
                        })
                      : tasks.filter(task => task.title.toLowerCase().includes(searchTerm.toLowerCase()))}
          viewType="unbilled"
          externalTableRef={tableRef}
          visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        setColumnOrder={setColumnOrder}
        columnWidths={columnWidths}
        setColumnWidths={setColumnWidths}
        currentUser={user}
        sortBy={sortBy}
        storageKeyPrefix="unbilledtasks"
        tabKey="unbilledTasks"
        tabId="unbilledTasksMain"
      />
      </div>
    </div>
  );
};

export default UnBilledTasks; 