import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { PencilSquareIcon, CheckIcon, MagnifyingGlassIcon, EyeIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { API_BASE_URL, saveTabState, fetchTabState } from '../../apiConfig';

const Cost = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [hourlyRateInput, setHourlyRateInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState([]); // Array of tasks
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [costLoading, setCostLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('billedTaskCosting');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskDetails, setTaskDetails] = useState(null);
  const [taskTimeslots, setTaskTimeslots] = useState([]);
  const [taskDetailsLoading, setTaskDetailsLoading] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [totalTasks, setTotalTasks] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const TASKS_PER_PAGE = 25;
  
  // Refs for infinite scroll
  const loadMoreTriggerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const initialLoadCompletedRef = useRef(false);

  // Column management state - separate for each tab
  const [billedVisibleColumns, setBilledVisibleColumns] = useState([]);
  const [unbilledVisibleColumns, setUnbilledVisibleColumns] = useState([]);
  const [completedBilledVisibleColumns, setCompletedBilledVisibleColumns] = useState([]);
  const [completedUnbilledVisibleColumns, setCompletedUnbilledVisibleColumns] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const columnsDropdownRef = useRef(null);

  // All available columns for Cost page
  const ALL_COLUMNS = [
    { id: 'taskTitle', label: 'Task', type: 'text' },
    { id: 'assignedTo', label: 'Assigned To', type: 'user' },
    { id: 'firstVerifier', label: 'First Verifier', type: 'user' },
    { id: 'secondVerifier', label: 'Second Verifier', type: 'user' },
    { id: 'thirdVerifier', label: 'Third Verifier', type: 'user' },
    { id: 'fourthVerifier', label: 'Fourth Verifier', type: 'user' },
    { id: 'fifthVerifier', label: 'Fifth Verifier', type: 'user' },
    { id: 'guides', label: 'Guide', type: 'guides' },
    { id: 'totalCost', label: 'Total Cost (₹)', type: 'cost' }
  ];

  // Default visible columns
  const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.map(col => col.id);

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetchUsers();
    }
  }, [user]);

  // Load tab state (visible columns) on mount - separate for each tab
  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    (async () => {
      try {
        console.log('Loading tab states for all cost management tabs...');
        const [billedTabState, unbilledTabState, completedBilledTabState, completedUnbilledTabState] = await Promise.all([
          fetchTabState('costManagementBilled', user.token),
          fetchTabState('costManagementUnbilled', user.token),
          fetchTabState('costManagementCompletedBilled', user.token),
          fetchTabState('costManagementCompletedUnbilled', user.token)
        ]);
        console.log('Loaded cost management tab states:', { billedTabState, unbilledTabState, completedBilledTabState, completedUnbilledTabState });
        if (isMounted) {
          // Set billed columns
          if (billedTabState && billedTabState.visibleColumns && Array.isArray(billedTabState.visibleColumns) && billedTabState.visibleColumns.length > 0) {
            console.log('Setting billed columns from saved state:', billedTabState.visibleColumns);
            setBilledVisibleColumns(billedTabState.visibleColumns);
          } else {
            console.log('Using default visible columns for billed:', DEFAULT_VISIBLE_COLUMNS);
            setBilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          }
          
          // Set unbilled columns
          if (unbilledTabState && unbilledTabState.visibleColumns && Array.isArray(unbilledTabState.visibleColumns) && unbilledTabState.visibleColumns.length > 0) {
            console.log('Setting unbilled columns from saved state:', unbilledTabState.visibleColumns);
            setUnbilledVisibleColumns(unbilledTabState.visibleColumns);
          } else {
            console.log('Using default visible columns for unbilled:', DEFAULT_VISIBLE_COLUMNS);
            setUnbilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          }
          
          // Set completed billed columns
          if (completedBilledTabState && completedBilledTabState.visibleColumns && Array.isArray(completedBilledTabState.visibleColumns) && completedBilledTabState.visibleColumns.length > 0) {
            console.log('Setting completed billed columns from saved state:', completedBilledTabState.visibleColumns);
            setCompletedBilledVisibleColumns(completedBilledTabState.visibleColumns);
          } else {
            console.log('Using default visible columns for completed billed:', DEFAULT_VISIBLE_COLUMNS);
            setCompletedBilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          }
          
          // Set completed unbilled columns
          if (completedUnbilledTabState && completedUnbilledTabState.visibleColumns && Array.isArray(completedUnbilledTabState.visibleColumns) && completedUnbilledTabState.visibleColumns.length > 0) {
            console.log('Setting completed unbilled columns from saved state:', completedUnbilledTabState.visibleColumns);
            setCompletedUnbilledVisibleColumns(completedUnbilledTabState.visibleColumns);
          } else {
            console.log('Using default visible columns for completed unbilled:', DEFAULT_VISIBLE_COLUMNS);
            setCompletedUnbilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          }
        }
      } catch (error) {
        console.error('Error loading tab state:', error);
        if (isMounted) {
          console.log('Error occurred, setting default columns for all tabs');
          setBilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          setUnbilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          setCompletedBilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          setCompletedUnbilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
        }
      } finally {
        if (isMounted) {
          console.log('Tab state loading complete, setting tabsLoaded to true');
          setTabsLoaded(true);
        }
      }
    })();
    return () => { isMounted = false; };
  }, [user]);

  // Save visible columns to backend whenever they change - separate for each tab
  useEffect(() => {
    if (!user?.token || !tabsLoaded || billedVisibleColumns.length === 0) return;
    console.log('Saving billed visible columns to backend:', billedVisibleColumns);
    saveTabState('costManagementBilled', { visibleColumns: billedVisibleColumns }, user.token)
      .then(() => {
        console.log('Successfully saved billed tab state');
      })
      .catch((error) => {
        console.error('Error saving billed tab state:', error);
      });
  }, [billedVisibleColumns, user, tabsLoaded]);

  useEffect(() => {
    if (!user?.token || !tabsLoaded || unbilledVisibleColumns.length === 0) return;
    console.log('Saving unbilled visible columns to backend:', unbilledVisibleColumns);
    saveTabState('costManagementUnbilled', { visibleColumns: unbilledVisibleColumns }, user.token)
      .then(() => {
        console.log('Successfully saved unbilled tab state');
      })
      .catch((error) => {
        console.error('Error saving unbilled tab state:', error);
      });
  }, [unbilledVisibleColumns, user, tabsLoaded]);

  useEffect(() => {
    if (!user?.token || !tabsLoaded || completedBilledVisibleColumns.length === 0) return;
    console.log('Saving completed billed visible columns to backend:', completedBilledVisibleColumns);
    saveTabState('costManagementCompletedBilled', { visibleColumns: completedBilledVisibleColumns }, user.token)
      .then(() => {
        console.log('Successfully saved completed billed tab state');
      })
      .catch((error) => {
        console.error('Error saving completed billed tab state:', error);
      });
  }, [completedBilledVisibleColumns, user, tabsLoaded]);

  useEffect(() => {
    if (!user?.token || !tabsLoaded || completedUnbilledVisibleColumns.length === 0) return;
    console.log('Saving completed unbilled visible columns to backend:', completedUnbilledVisibleColumns);
    saveTabState('costManagementCompletedUnbilled', { visibleColumns: completedUnbilledVisibleColumns }, user.token)
      .then(() => {
        console.log('Successfully saved completed unbilled tab state');
      })
      .catch((error) => {
        console.error('Error saving completed unbilled tab state:', error);
      });
  }, [completedUnbilledVisibleColumns, user, tabsLoaded]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (columnsDropdownRef.current && !columnsDropdownRef.current.contains(event.target)) {
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Combined effect for initial load and search with debouncing
  useEffect(() => {
    if (activeTab === 'billedTaskCosting' || activeTab === 'unbilledTaskCosting' || 
        activeTab === 'completedBilledTaskCosting' || activeTab === 'completedUnbilledTaskCosting') {
      // Clear the previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      
      // For initial load (no search), fetch immediately only if not already loaded
      if (!search.trim() && !initialLoadCompletedRef.current) {
        initialLoadCompletedRef.current = true;
        setCurrentPage(1);
        setCosts([]);
        fetchCosts('', 1, true);
        return;
      }
      
      // For all other cases (search queries or clearing search), use debounced search
      searchTimeoutRef.current = setTimeout(() => {
        setCurrentPage(1);
        setCosts([]);
        fetchCosts(search.trim(), 1, true);
      }, 300);
      
      return () => {
        if (searchTimeoutRef.current) {
          clearTimeout(searchTimeoutRef.current);
        }
      };
    }
  }, [search, activeTab]);

  // Reset initial load flag when switching away from task costing tabs
  useEffect(() => {
    if (activeTab !== 'billedTaskCosting' && activeTab !== 'unbilledTaskCosting' && 
        activeTab !== 'completedBilledTaskCosting' && activeTab !== 'completedUnbilledTaskCosting') {
      initialLoadCompletedRef.current = false;
    }
  }, [activeTab]);

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

  const fetchCosts = useCallback(async (searchQuery = '', page = 1, reset = false) => {
    if (reset) {
      setCostLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: TASKS_PER_PAGE.toString()
      });
      
      if (searchQuery && searchQuery.trim()) {
        params.append('search', searchQuery);
      }
      
      // Determine which API endpoint to use based on active tab
      let endpoint = `${API_BASE_URL}/api/timesheets/task-costs`;
      if (activeTab === 'billedTaskCosting') {
        endpoint = `${API_BASE_URL}/api/timesheets/task-costs/billed`;
      } else if (activeTab === 'unbilledTaskCosting') {
        endpoint = `${API_BASE_URL}/api/timesheets/task-costs/unbilled`;
      } else if (activeTab === 'completedBilledTaskCosting') {
        endpoint = `${API_BASE_URL}/api/timesheets/task-costs/completed-billed`;
      } else if (activeTab === 'completedUnbilledTaskCosting') {
        endpoint = `${API_BASE_URL}/api/timesheets/task-costs/completed-unbilled`;
      }
      
      const res = await fetch(`${endpoint}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      
      if (reset) {
        setCosts(data.tasks || []);
      } else {
        setCosts(prev => [...prev, ...(data.tasks || [])]);
      }
      
      setCurrentPage(data.pagination?.current || page);
      setHasNextPage(data.pagination?.hasNext || false);
      setTotalTasks(data.pagination?.total || 0);
    } catch (e) {
      toast.error('Failed to load costs');
      if (reset) {
        setCosts([]);
      }
    } finally {
      setCostLoading(false);
      setIsLoadingMore(false);
    }
  }, [token, activeTab]);

  // Load more tasks function
  const loadMoreTasks = useCallback(() => {
    if (hasNextPage && !isLoadingMore && !costLoading) {
      fetchCosts(search, currentPage + 1, false);
    }
  }, [hasNextPage, isLoadingMore, costLoading, fetchCosts, search, currentPage]);

  // Infinite scroll implementation
  useEffect(() => {
    const triggerElement = loadMoreTriggerRef.current;
    if (!triggerElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasNextPage && !isLoadingMore && !costLoading) {
          loadMoreTasks();
        }
      },
      {
        root: null,
        rootMargin: '200px', // Load more when 200px from bottom
        threshold: 0.01
      }
    );

    observer.observe(triggerElement);

    return () => {
      if (triggerElement) {
        observer.unobserve(triggerElement);
      }
    };
  }, [hasNextPage, isLoadingMore, costLoading, loadMoreTasks]);

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
      // Refresh costs data to reflect rate changes
      if (activeTab === 'billedTaskCosting' || activeTab === 'unbilledTaskCosting' || 
          activeTab === 'completedBilledTaskCosting' || activeTab === 'completedUnbilledTaskCosting') {
        setCurrentPage(1);
        setCosts([]);
        fetchCosts(search, 1, true);
      }
    } catch (e) {
      toast.error('Update failed');
    }
    setLoading(false);
  };

  // Column management functions - works with current active tab's columns
  const getCurrentVisibleColumns = () => {
    if (activeTab === 'billedTaskCosting') {
      return billedVisibleColumns;
    } else if (activeTab === 'unbilledTaskCosting') {
      return unbilledVisibleColumns;
    } else if (activeTab === 'completedBilledTaskCosting') {
      return completedBilledVisibleColumns;
    } else if (activeTab === 'completedUnbilledTaskCosting') {
      return completedUnbilledVisibleColumns;
    }
    return [];
  };

  const setCurrentVisibleColumns = (newColumns) => {
    if (activeTab === 'billedTaskCosting') {
      setBilledVisibleColumns(newColumns);
    } else if (activeTab === 'unbilledTaskCosting') {
      setUnbilledVisibleColumns(newColumns);
    } else if (activeTab === 'completedBilledTaskCosting') {
      setCompletedBilledVisibleColumns(newColumns);
    } else if (activeTab === 'completedUnbilledTaskCosting') {
      setCompletedUnbilledVisibleColumns(newColumns);
    }
  };

  const toggleColumn = (columnId) => {
    console.log('Toggling column:', columnId);
    const currentColumns = getCurrentVisibleColumns();
    console.log('Previous visible columns:', currentColumns);
    
    if (currentColumns.includes(columnId)) {
      // Don't allow hiding all columns
      if (currentColumns.length <= 1) {
        console.log('Cannot hide last column');
        return;
      }
      const newColumns = currentColumns.filter(id => id !== columnId);
      console.log('New visible columns (removed):', newColumns);
      setCurrentVisibleColumns(newColumns);
    } else {
      const newColumns = [...currentColumns, columnId];
      console.log('New visible columns (added):', newColumns);
      setCurrentVisibleColumns(newColumns);
    }
  };

  // Function to render table cell content based on column type
  const renderCellContent = (task, columnId) => {
    switch (columnId) {
      case 'taskTitle':
        return (
          <div 
            className="max-w-[320px] overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 cursor-pointer hover:text-blue-600 font-semibold"
            onClick={() => handleTaskClick(task)}
          >
            <span className="inline-block min-w-full align-middle">{task.title}</span>
          </div>
        );
      case 'assignedTo':
      case 'firstVerifier':
      case 'secondVerifier':
      case 'thirdVerifier':
      case 'fourthVerifier':
      case 'fifthVerifier':
        const user = task[columnId];
        return user ? (
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="inline-block bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs mt-1">
              {user.hours} hr | ₹{user.cost.toFixed(2)}
            </div>
          </div>
        ) : <span className="text-gray-400">-</span>;
      case 'guides':
        return task.guides && task.guides.length > 0 ? (
          <div className="space-y-1">
            {task.guides.map((guide, idx) => (
              <div key={idx}>
                <div className="font-medium text-sm">{guide.name}</div>
                <div className="inline-block bg-purple-100 text-purple-700 rounded px-2 py-0.5 text-xs">
                  {guide.hours} hr | ₹{guide.cost.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        ) : <span className="text-gray-400">-</span>;
      case 'totalCost':
        return <span className="font-bold text-green-700">₹{task.totalCost.toFixed(2)}</span>;
      default:
        return '-';
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    // Search is now handled automatically by useEffect
  };

  const handleUserSearch = (e) => {
    e.preventDefault();
    // User search is handled client-side through filtering automatically
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
    fetchTaskDetails(task.taskId);
  };

  const filteredUsers = users.filter(u => 
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
      <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
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
                      <div className="max-w-full overflow-x-auto">
                        <p className="font-medium whitespace-nowrap">{taskDetails.description}</p>
                      </div>
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
                  {selectedTask.thirdVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Third Verifier</p>
                      <p className="font-medium">{selectedTask.thirdVerifier.name}</p>
                      <p className="text-sm text-blue-600">{selectedTask.thirdVerifier.hours}h × ₹{selectedTask.thirdVerifier.hourlyRate} = ₹{selectedTask.thirdVerifier.cost.toFixed(2)}</p>
                    </div>
                  )}
                  {selectedTask.fourthVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Fourth Verifier</p>
                      <p className="font-medium">{selectedTask.fourthVerifier.name}</p>
                      <p className="text-sm text-blue-600">{selectedTask.fourthVerifier.hours}h × ₹{selectedTask.fourthVerifier.hourlyRate} = ₹{selectedTask.fourthVerifier.cost.toFixed(2)}</p>
                    </div>
                  )}
                  {selectedTask.fifthVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Fifth Verifier</p>
                      <p className="font-medium">{selectedTask.fifthVerifier.name}</p>
                      <p className="text-sm text-blue-600">{selectedTask.fifthVerifier.hours}h × ₹{selectedTask.fifthVerifier.hourlyRate} = ₹{selectedTask.fifthVerifier.cost.toFixed(2)}</p>
                    </div>
                  )}
                  {selectedTask.guides && selectedTask.guides.length > 0 && selectedTask.guides.map((guide, idx) => (
                    <div key={idx} className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Guide {idx + 1}</p>
                      <p className="font-medium">{guide.name}</p>
                      <p className="text-sm text-purple-600">{guide.hours}h × ₹{guide.hourlyRate} = ₹{guide.cost.toFixed(2)}</p>
                    </div>
                  ))}
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
            onClick={() => {
              setActiveTab('billedTaskCosting');
              setCosts([]); // Clear costs when switching to this tab
              initialLoadCompletedRef.current = false; // Reset initial load flag
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'billedTaskCosting'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Billed Tasks Costing
          </button>
          <button
            onClick={() => {
              setActiveTab('unbilledTaskCosting');
              setCosts([]); // Clear costs when switching to this tab
              initialLoadCompletedRef.current = false; // Reset initial load flag
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'unbilledTaskCosting'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Unbilled Tasks Costing
          </button>
          <button
            onClick={() => {
              setActiveTab('completedBilledTaskCosting');
              setCosts([]); // Clear costs when switching to this tab
              initialLoadCompletedRef.current = false; // Reset initial load flag
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'completedBilledTaskCosting'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Completed Billed Tasks Costing
          </button>
          <button
            onClick={() => {
              setActiveTab('completedUnbilledTaskCosting');
              setCosts([]); // Clear costs when switching to this tab
              initialLoadCompletedRef.current = false; // Reset initial load flag
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'completedUnbilledTaskCosting'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Completed Unbilled Tasks Costing
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

      {/* Billed Task Costing Tab */}
      {activeTab === 'billedTaskCosting' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Billed Tasks Costing</h2>
            {totalTasks > 0 && (
              <div className="text-sm text-gray-600">
                Total Tasks: <span className="font-semibold">{totalTasks}</span>
              </div>
            )}
          </div>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by task or user..."
                className="border rounded px-3 py-2 pl-10 w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            {/* Column Dropdown */}
            <div className="relative" ref={columnsDropdownRef}>
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2"
              >
                Columns
                <ChevronDownIcon className="w-4 h-4" />
              </button>

              {showColumnDropdown && (
                <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Show/Hide Columns</div>
                    {ALL_COLUMNS.map((column) => (
                      <label key={column.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={getCurrentVisibleColumns().includes(column.id)}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!tabsLoaded && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center py-8">Loading table configuration...</div>
            </div>
          )}
          {tabsLoaded && getCurrentVisibleColumns().length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {ALL_COLUMNS.filter(col => getCurrentVisibleColumns().includes(col.id)).map((column) => (
                      <th 
                        key={column.id} 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-white"
                        style={{ width: `${100 / getCurrentVisibleColumns().length}%` }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {costLoading && costs.length === 0 ? (
                  <tr><td colSpan={getCurrentVisibleColumns().length} className="text-center py-8">Loading...</td></tr>
                ) : costs.length === 0 ? (
                  <tr><td colSpan={getCurrentVisibleColumns().length} className="text-center py-8">No billed tasks found.</td></tr>
                ) : (
                  <>
                    {costs.map((task) => (
                      <tr key={task.taskId} className="hover:bg-gray-50">
                        {ALL_COLUMNS.filter(col => getCurrentVisibleColumns().includes(col.id)).map((column) => (
                          <td 
                            key={column.id} 
                            className="px-4 py-2 whitespace-nowrap"
                            style={{ width: `${100 / getCurrentVisibleColumns().length}%` }}
                          >
                            {renderCellContent(task, column.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
            
            {/* Infinite scroll trigger element */}
            <div
              ref={loadMoreTriggerRef}
              className="w-full h-4"
              style={{ height: '1px' }}
            ></div>
            
            {/* Load more info */}
            {costs.length > 0 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Showing {costs.length} of {totalTasks} tasks
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* Unbilled Task Costing Tab */}
      {activeTab === 'unbilledTaskCosting' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Unbilled Task Costing</h2>
            {totalTasks > 0 && (
              <div className="text-sm text-gray-600">
                Total Tasks: <span className="font-semibold">{totalTasks}</span>
              </div>
            )}
          </div>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by task or user..."
                className="border rounded px-3 py-2 pl-10 w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            {/* Column Dropdown */}
            <div className="relative" ref={columnsDropdownRef}>
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2"
              >
                Columns
                <ChevronDownIcon className="w-4 h-4" />
              </button>

              {showColumnDropdown && (
                <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Show/Hide Columns</div>
                    {ALL_COLUMNS.map((column) => (
                      <label key={column.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={getCurrentVisibleColumns().includes(column.id)}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!tabsLoaded && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center py-8">Loading table configuration...</div>
            </div>
          )}
          {tabsLoaded && getCurrentVisibleColumns().length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {ALL_COLUMNS.filter(col => getCurrentVisibleColumns().includes(col.id)).map((column) => (
                      <th 
                        key={column.id} 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-white"
                        style={{ width: `${100 / getCurrentVisibleColumns().length}%` }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {costLoading && costs.length === 0 ? (
                  <tr><td colSpan={getCurrentVisibleColumns().length} className="text-center py-8">Loading...</td></tr>
                ) : costs.length === 0 ? (
                  <tr><td colSpan={getCurrentVisibleColumns().length} className="text-center py-8">No unbilled tasks found.</td></tr>
                ) : (
                  <>
                    {costs.map((task) => (
                      <tr key={task.taskId} className="hover:bg-gray-50">
                        {ALL_COLUMNS.filter(col => getCurrentVisibleColumns().includes(col.id)).map((column) => (
                          <td 
                            key={column.id} 
                            className="px-4 py-2 whitespace-nowrap"
                            style={{ width: `${100 / getCurrentVisibleColumns().length}%` }}
                          >
                            {renderCellContent(task, column.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
            
            {/* Infinite scroll trigger element */}
            <div
              ref={loadMoreTriggerRef}
              className="w-full h-4"
              style={{ height: '1px' }}
            ></div>
            
            {/* Load more info */}
            {costs.length > 0 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Showing {costs.length} of {totalTasks} tasks
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* Completed Billed Task Costing Tab */}
      {activeTab === 'completedBilledTaskCosting' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Completed Billed Task Costing</h2>
            {totalTasks > 0 && (
              <div className="text-sm text-gray-600">
                Total Tasks: <span className="font-semibold">{totalTasks}</span>
              </div>
            )}
          </div>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by task or user..."
                className="border rounded px-3 py-2 pl-10 w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            {/* Column Dropdown */}
            <div className="relative" ref={columnsDropdownRef}>
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2"
              >
                Columns
                <ChevronDownIcon className="w-4 h-4" />
              </button>

              {showColumnDropdown && (
                <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Show/Hide Columns</div>
                    {ALL_COLUMNS.map((column) => (
                      <label key={column.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={getCurrentVisibleColumns().includes(column.id)}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!tabsLoaded && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center py-8">Loading table configuration...</div>
            </div>
          )}
          {tabsLoaded && getCurrentVisibleColumns().length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {ALL_COLUMNS.filter(col => getCurrentVisibleColumns().includes(col.id)).map((column) => (
                      <th 
                        key={column.id} 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-white"
                        style={{ width: `${100 / getCurrentVisibleColumns().length}%` }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {costLoading && costs.length === 0 ? (
                  <tr><td colSpan={getCurrentVisibleColumns().length} className="text-center py-8">Loading...</td></tr>
                ) : costs.length === 0 ? (
                  <tr><td colSpan={getCurrentVisibleColumns().length} className="text-center py-8">No completed billed tasks found.</td></tr>
                ) : (
                  <>
                    {costs.map((task) => (
                      <tr key={task.taskId} className="hover:bg-gray-50">
                        {ALL_COLUMNS.filter(col => getCurrentVisibleColumns().includes(col.id)).map((column) => (
                          <td 
                            key={column.id} 
                            className="px-4 py-2 whitespace-nowrap"
                            style={{ width: `${100 / getCurrentVisibleColumns().length}%` }}
                          >
                            {renderCellContent(task, column.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
            
            {/* Infinite scroll trigger element */}
            <div
              ref={loadMoreTriggerRef}
              className="w-full h-4"
              style={{ height: '1px' }}
            ></div>
            
            {/* Load more info */}
            {costs.length > 0 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Showing {costs.length} of {totalTasks} tasks
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* Completed Unbilled Task Costing Tab */}
      {activeTab === 'completedUnbilledTaskCosting' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Completed Unbilled Task Costing</h2>
            {totalTasks > 0 && (
              <div className="text-sm text-gray-600">
                Total Tasks: <span className="font-semibold">{totalTasks}</span>
              </div>
            )}
          </div>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by task or user..."
                className="border rounded px-3 py-2 pl-10 w-64"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            
            {/* Column Dropdown */}
            <div className="relative" ref={columnsDropdownRef}>
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 flex items-center gap-2"
              >
                Columns
                <ChevronDownIcon className="w-4 h-4" />
              </button>

              {showColumnDropdown && (
                <div className="absolute z-50 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg">
                  <div className="py-2">
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Show/Hide Columns</div>
                    {ALL_COLUMNS.map((column) => (
                      <label key={column.id} className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={getCurrentVisibleColumns().includes(column.id)}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{column.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!tabsLoaded && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center py-8">Loading table configuration...</div>
            </div>
          )}
          {tabsLoaded && getCurrentVisibleColumns().length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {ALL_COLUMNS.filter(col => getCurrentVisibleColumns().includes(col.id)).map((column) => (
                      <th 
                        key={column.id} 
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-white"
                        style={{ width: `${100 / getCurrentVisibleColumns().length}%` }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {costLoading && costs.length === 0 ? (
                  <tr><td colSpan={getCurrentVisibleColumns().length} className="text-center py-8">Loading...</td></tr>
                ) : costs.length === 0 ? (
                  <tr><td colSpan={getCurrentVisibleColumns().length} className="text-center py-8">No completed unbilled tasks found.</td></tr>
                ) : (
                  <>
                    {costs.map((task) => (
                      <tr key={task.taskId} className="hover:bg-gray-50">
                        {ALL_COLUMNS.filter(col => getCurrentVisibleColumns().includes(col.id)).map((column) => (
                          <td 
                            key={column.id} 
                            className="px-4 py-2 whitespace-nowrap"
                            style={{ width: `${100 / getCurrentVisibleColumns().length}%` }}
                          >
                            {renderCellContent(task, column.id)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
            
            {/* Infinite scroll trigger element */}
            <div
              ref={loadMoreTriggerRef}
              className="w-full h-4"
              style={{ height: '1px' }}
            ></div>
            
            {/* Load more info */}
            {costs.length > 0 && (
              <div className="mt-4 text-center text-sm text-gray-500">
                Showing {costs.length} of {totalTasks} tasks
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* User Hourly Rates Tab */}
      {activeTab === 'userRates' && (
        <div>
          <h2 className="text-2xl font-bold mb-6">User Hourly Rates</h2>
          <div className="mb-4 flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or email..."
                className="border rounded px-3 py-2 pl-10 w-64"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hourly Rate (₹)</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8">Loading...</td></tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u._id}>
                    <td className="px-4 py-2 whitespace-nowrap">{u.firstName} {u.lastName}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{u.email}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{u.role}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        u.status === 'approved' 
                          ? 'bg-green-100 text-green-800' 
                          : u.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {u.status}
                      </span>
                    </td>
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
};

export default Cost;
