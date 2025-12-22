import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { toast } from "react-toastify";
import {
  PencilSquareIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import { API_BASE_URL, saveTabState, fetchTabState } from "../../apiConfig";
import jsPDF from "jspdf";
import "jspdf-autotable";

const Cost = () => {
  const { user, token } = useAuth();
  const [users, setUsers] = useState([]);
  const [editingUserId, setEditingUserId] = useState(null);
  const [hourlyRateInput, setHourlyRateInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [costs, setCosts] = useState([]); // Array of tasks
  const [search, setSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [costLoading, setCostLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("billedTaskCosting");
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
  const [completedBilledVisibleColumns, setCompletedBilledVisibleColumns] =
    useState([]);
  const [completedUnbilledVisibleColumns, setCompletedUnbilledVisibleColumns] =
    useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const columnsDropdownRef = useRef(null);

  // User filtering state - separate for each tab
  const [billedSelectedUserId, setBilledSelectedUserId] = useState(null);
  const [unbilledSelectedUserId, setUnbilledSelectedUserId] = useState(null);
  const [completedBilledSelectedUserId, setCompletedBilledSelectedUserId] =
    useState(null);
  const [completedUnbilledSelectedUserId, setCompletedUnbilledSelectedUserId] =
    useState(null);
  const [showUsersDropdown, setShowUsersDropdown] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const usersDropdownRef = useRef(null);
  const [allUsers, setAllUsers] = useState([]);

  // All available columns for Cost page
  const ALL_COLUMNS = [
    { id: "taskTitle", label: "Task", type: "text" },
    { id: "assignedBy", label: "Assigned By", type: "user" },
    { id: "assignedTo", label: "Assigned To", type: "user" },
    { id: "firstVerifier", label: "First Verifier", type: "user" },
    { id: "secondVerifier", label: "Second Verifier", type: "user" },
    { id: "thirdVerifier", label: "Third Verifier", type: "user" },
    { id: "fourthVerifier", label: "Fourth Verifier", type: "user" },
    { id: "fifthVerifier", label: "Fifth Verifier", type: "user" },
    { id: "guides", label: "Guide", type: "guides" },
  ];

  // Default visible columns
  const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.map((col) => col.id);

  useEffect(() => {
    if (user?.role === "Admin") {
      fetchUsers();
    }
  }, [user]);

  // Fetch all users for the dropdown filter
  useEffect(() => {
    const fetchAllUsers = async () => {
      if (!user?.token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/except-me`, {
          headers: {
            Authorization: `Bearer ${user.token}`,
          },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch users");
        }

        const data = await res.json();
        setAllUsers(data);
      } catch (err) {
        console.error("Error fetching users:", err);
        toast.error("Failed to fetch users for filter");
      }
    };

    if (user && user.token && ["Admin", "Team Head"].includes(user?.role)) {
      fetchAllUsers();
    }
  }, [user]);

  // Load tab state (visible columns) on mount - separate for each tab
  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    (async () => {
      try {
        console.log("Loading tab states for all Task management tabs...");
        const [
          billedTabState,
          unbilledTabState,
          completedBilledTabState,
          completedUnbilledTabState,
        ] = await Promise.all([
          fetchTabState("costManagementBilled", user.token),
          fetchTabState("costManagementUnbilled", user.token),
          fetchTabState("costManagementCompletedBilled", user.token),
          fetchTabState("costManagementCompletedUnbilled", user.token),
        ]);
        console.log("Loaded cost management tab states:", {
          billedTabState,
          unbilledTabState,
          completedBilledTabState,
          completedUnbilledTabState,
        });
        if (isMounted) {
          // Set billed columns and selectedUserId
          if (
            billedTabState &&
            billedTabState.visibleColumns &&
            Array.isArray(billedTabState.visibleColumns) &&
            billedTabState.visibleColumns.length > 0
          ) {
            console.log(
              "Setting billed columns from saved state:",
              billedTabState.visibleColumns
            );
            setBilledVisibleColumns(billedTabState.visibleColumns);
          } else {
            console.log(
              "Using default visible columns for billed:",
              DEFAULT_VISIBLE_COLUMNS
            );
            setBilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          }
          if (billedTabState && billedTabState.selectedUserId !== undefined) {
            setBilledSelectedUserId(billedTabState.selectedUserId);
          }

          // Set unbilled columns and selectedUserId
          if (
            unbilledTabState &&
            unbilledTabState.visibleColumns &&
            Array.isArray(unbilledTabState.visibleColumns) &&
            unbilledTabState.visibleColumns.length > 0
          ) {
            console.log(
              "Setting unbilled columns from saved state:",
              unbilledTabState.visibleColumns
            );
            setUnbilledVisibleColumns(unbilledTabState.visibleColumns);
          } else {
            console.log(
              "Using default visible columns for unbilled:",
              DEFAULT_VISIBLE_COLUMNS
            );
            setUnbilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          }
          if (
            unbilledTabState &&
            unbilledTabState.selectedUserId !== undefined
          ) {
            setUnbilledSelectedUserId(unbilledTabState.selectedUserId);
          }

          // Set completed billed columns and selectedUserId
          if (
            completedBilledTabState &&
            completedBilledTabState.visibleColumns &&
            Array.isArray(completedBilledTabState.visibleColumns) &&
            completedBilledTabState.visibleColumns.length > 0
          ) {
            console.log(
              "Setting completed billed columns from saved state:",
              completedBilledTabState.visibleColumns
            );
            setCompletedBilledVisibleColumns(
              completedBilledTabState.visibleColumns
            );
          } else {
            console.log(
              "Using default visible columns for completed billed:",
              DEFAULT_VISIBLE_COLUMNS
            );
            setCompletedBilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          }
          if (
            completedBilledTabState &&
            completedBilledTabState.selectedUserId !== undefined
          ) {
            setCompletedBilledSelectedUserId(
              completedBilledTabState.selectedUserId
            );
          }

          // Set completed unbilled columns and selectedUserId
          if (
            completedUnbilledTabState &&
            completedUnbilledTabState.visibleColumns &&
            Array.isArray(completedUnbilledTabState.visibleColumns) &&
            completedUnbilledTabState.visibleColumns.length > 0
          ) {
            console.log(
              "Setting completed unbilled columns from saved state:",
              completedUnbilledTabState.visibleColumns
            );
            setCompletedUnbilledVisibleColumns(
              completedUnbilledTabState.visibleColumns
            );
          } else {
            console.log(
              "Using default visible columns for completed unbilled:",
              DEFAULT_VISIBLE_COLUMNS
            );
            setCompletedUnbilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          }
          if (
            completedUnbilledTabState &&
            completedUnbilledTabState.selectedUserId !== undefined
          ) {
            setCompletedUnbilledSelectedUserId(
              completedUnbilledTabState.selectedUserId
            );
          }
        }
      } catch (error) {
        console.error("Error loading tab state:", error);
        if (isMounted) {
          console.log("Error occurred, setting default columns for all tabs");
          setBilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          setUnbilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          setCompletedBilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
          setCompletedUnbilledVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
        }
      } finally {
        if (isMounted) {
          console.log("Tab state loading complete, setting tabsLoaded to true");
          setTabsLoaded(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Save visible columns to backend whenever they change - separate for each tab
  useEffect(() => {
    if (!user?.token || !tabsLoaded || billedVisibleColumns.length === 0)
      return;
    console.log(
      "Saving billed visible columns to backend:",
      billedVisibleColumns
    );
    saveTabState(
      "costManagementBilled",
      {
        visibleColumns: billedVisibleColumns,
        selectedUserId: billedSelectedUserId,
      },
      user.token
    )
      .then(() => {
        console.log("Successfully saved billed tab state");
      })
      .catch((error) => {
        console.error("Error saving billed tab state:", error);
      });
  }, [billedVisibleColumns, billedSelectedUserId, user, tabsLoaded]);

  useEffect(() => {
    if (!user?.token || !tabsLoaded || unbilledVisibleColumns.length === 0)
      return;
    console.log(
      "Saving unbilled visible columns to backend:",
      unbilledVisibleColumns
    );
    saveTabState(
      "costManagementUnbilled",
      {
        visibleColumns: unbilledVisibleColumns,
        selectedUserId: unbilledSelectedUserId,
      },
      user.token
    )
      .then(() => {
        console.log("Successfully saved unbilled tab state");
      })
      .catch((error) => {
        console.error("Error saving unbilled tab state:", error);
      });
  }, [unbilledVisibleColumns, unbilledSelectedUserId, user, tabsLoaded]);

  useEffect(() => {
    if (
      !user?.token ||
      !tabsLoaded ||
      completedBilledVisibleColumns.length === 0
    )
      return;
    console.log(
      "Saving completed billed visible columns to backend:",
      completedBilledVisibleColumns
    );
    saveTabState(
      "costManagementCompletedBilled",
      {
        visibleColumns: completedBilledVisibleColumns,
        selectedUserId: completedBilledSelectedUserId,
      },
      user.token
    )
      .then(() => {
        console.log("Successfully saved completed billed tab state");
      })
      .catch((error) => {
        console.error("Error saving completed billed tab state:", error);
      });
  }, [
    completedBilledVisibleColumns,
    completedBilledSelectedUserId,
    user,
    tabsLoaded,
  ]);

  useEffect(() => {
    if (
      !user?.token ||
      !tabsLoaded ||
      completedUnbilledVisibleColumns.length === 0
    )
      return;
    console.log(
      "Saving completed unbilled visible columns to backend:",
      completedUnbilledVisibleColumns
    );
    saveTabState(
      "costManagementCompletedUnbilled",
      {
        visibleColumns: completedUnbilledVisibleColumns,
        selectedUserId: completedUnbilledSelectedUserId,
      },
      user.token
    )
      .then(() => {
        console.log("Successfully saved completed unbilled tab state");
      })
      .catch((error) => {
        console.error("Error saving completed unbilled tab state:", error);
      });
  }, [
    completedUnbilledVisibleColumns,
    completedUnbilledSelectedUserId,
    user,
    tabsLoaded,
  ]);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        columnsDropdownRef.current &&
        !columnsDropdownRef.current.contains(event.target)
      ) {
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle click outside users dropdown
  useEffect(() => {
    if (!showUsersDropdown) {
      setUserSearchTerm(""); // Clear search when dropdown closes
      return;
    }
    const handleClickOutside = (event) => {
      if (
        usersDropdownRef.current &&
        !usersDropdownRef.current.contains(event.target)
      ) {
        setShowUsersDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUsersDropdown]);

  // Combined effect for initial load and search with debouncing
  useEffect(() => {
    if (
      activeTab === "billedTaskCosting" ||
      activeTab === "unbilledTaskCosting" ||
      activeTab === "completedBilledTaskCosting" ||
      activeTab === "completedUnbilledTaskCosting"
    ) {
      // Clear the previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // For initial load (no search), fetch immediately only if not already loaded
      if (!search.trim() && !initialLoadCompletedRef.current) {
        initialLoadCompletedRef.current = true;
        setCurrentPage(1);
        setCosts([]);
        fetchCosts("", 1, true);
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
  }, [
    search,
    activeTab,
    billedSelectedUserId,
    unbilledSelectedUserId,
    completedBilledSelectedUserId,
    completedUnbilledSelectedUserId,
  ]);

  // Reset initial load flag when switching away from task costing tabs
  useEffect(() => {
    if (
      activeTab !== "billedTaskCosting" &&
      activeTab !== "unbilledTaskCosting" &&
      activeTab !== "completedBilledTaskCosting" &&
      activeTab !== "completedUnbilledTaskCosting"
    ) {
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
      toast.error("Failed to load users");
    }
    setLoading(false);
  };

  const fetchCosts = useCallback(
    async (searchQuery = "", page = 1, reset = false) => {
      if (reset) {
        setCostLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: TASKS_PER_PAGE.toString(),
        });

        if (searchQuery && searchQuery.trim()) {
          params.append("search", searchQuery);
        }

        // Get the current selected user ID for this tab
        const selectedUserId = getCurrentSelectedUserId();

        // Determine which API endpoint to use based on active tab and selectedUserId
        let endpoint = `${API_BASE_URL}/api/timesheets/task-costs`;

        if (activeTab === "billedTaskCosting") {
          if (selectedUserId) {
            endpoint = `${API_BASE_URL}/api/timesheets/task-costs/billed/user/${selectedUserId}`;
          } else {
            endpoint = `${API_BASE_URL}/api/timesheets/task-costs/billed`;
          }
        } else if (activeTab === "unbilledTaskCosting") {
          if (selectedUserId) {
            endpoint = `${API_BASE_URL}/api/timesheets/task-costs/unbilled/user/${selectedUserId}`;
          } else {
            endpoint = `${API_BASE_URL}/api/timesheets/task-costs/unbilled`;
          }
        } else if (activeTab === "completedBilledTaskCosting") {
          if (selectedUserId) {
            endpoint = `${API_BASE_URL}/api/timesheets/task-costs/completed-billed/user/${selectedUserId}`;
          } else {
            endpoint = `${API_BASE_URL}/api/timesheets/task-costs/completed-billed`;
          }
        } else if (activeTab === "completedUnbilledTaskCosting") {
          if (selectedUserId) {
            endpoint = `${API_BASE_URL}/api/timesheets/task-costs/completed-unbilled/user/${selectedUserId}`;
          } else {
            endpoint = `${API_BASE_URL}/api/timesheets/task-costs/completed-unbilled`;
          }
        }

        const res = await fetch(`${endpoint}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();

        if (reset) {
          setCosts(data.tasks || []);
        } else {
          setCosts((prev) => [...prev, ...(data.tasks || [])]);
        }

        setCurrentPage(data.pagination?.current || page);
        setHasNextPage(data.pagination?.hasNext || false);
        setTotalTasks(data.pagination?.total || 0);
      } catch (e) {
        toast.error("Failed to load costs");
        if (reset) {
          setCosts([]);
        }
      } finally {
        setCostLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      token,
      activeTab,
      billedSelectedUserId,
      unbilledSelectedUserId,
      completedBilledSelectedUserId,
      completedUnbilledSelectedUserId,
    ]
  );

  // Load more tasks function
  const loadMoreTasks = useCallback(() => {
    if (hasNextPage && !isLoadingMore && !costLoading) {
      fetchCosts(search, currentPage + 1, false);
    }
  }, [
    hasNextPage,
    isLoadingMore,
    costLoading,
    fetchCosts,
    search,
    currentPage,
  ]);

  // Infinite scroll implementation
  useEffect(() => {
    const triggerElement = loadMoreTriggerRef.current;
    if (!triggerElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          hasNextPage &&
          !isLoadingMore &&
          !costLoading
        ) {
          loadMoreTasks();
        }
      },
      {
        root: null,
        rootMargin: "200px", // Load more when 200px from bottom
        threshold: 0.01,
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
      const timeslotsRes = await fetch(
        `${API_BASE_URL}/api/timesheets/task/${taskId}/timeslots`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const timeslots = await timeslotsRes.json();
      setTaskTimeslots(timeslots);
    } catch (e) {
      toast.error("Failed to load task details");
      console.error("Error fetching task details:", e);
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
      const res = await fetch(
        `${API_BASE_URL}/api/users/${userId}/hourly-rate`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ hourlyRate: Number(hourlyRateInput) }),
        }
      );
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Hourly rate updated");
      setEditingUserId(null);
      setHourlyRateInput("");
      fetchUsers();
      // Refresh costs data to reflect rate changes
      if (
        activeTab === "billedTaskCosting" ||
        activeTab === "unbilledTaskCosting" ||
        activeTab === "completedBilledTaskCosting" ||
        activeTab === "completedUnbilledTaskCosting"
      ) {
        setCurrentPage(1);
        setCosts([]);
        fetchCosts(search, 1, true);
      }
    } catch (e) {
      toast.error("Update failed");
    }
    setLoading(false);
  };

  // Column management functions - works with current active tab's columns
  const getCurrentVisibleColumns = () => {
    if (activeTab === "billedTaskCosting") {
      return billedVisibleColumns;
    } else if (activeTab === "unbilledTaskCosting") {
      return unbilledVisibleColumns;
    } else if (activeTab === "completedBilledTaskCosting") {
      return completedBilledVisibleColumns;
    } else if (activeTab === "completedUnbilledTaskCosting") {
      return completedUnbilledVisibleColumns;
    }
    return [];
  };

  const setCurrentVisibleColumns = (newColumns) => {
    if (activeTab === "billedTaskCosting") {
      setBilledVisibleColumns(newColumns);
    } else if (activeTab === "unbilledTaskCosting") {
      setUnbilledVisibleColumns(newColumns);
    } else if (activeTab === "completedBilledTaskCosting") {
      setCompletedBilledVisibleColumns(newColumns);
    } else if (activeTab === "completedUnbilledTaskCosting") {
      setCompletedUnbilledVisibleColumns(newColumns);
    }
  };

  // User filtering functions - works with current active tab's selectedUserId
  const getCurrentSelectedUserId = () => {
    if (activeTab === "billedTaskCosting") {
      return billedSelectedUserId;
    } else if (activeTab === "unbilledTaskCosting") {
      return unbilledSelectedUserId;
    } else if (activeTab === "completedBilledTaskCosting") {
      return completedBilledSelectedUserId;
    } else if (activeTab === "completedUnbilledTaskCosting") {
      return completedUnbilledSelectedUserId;
    }
    return null;
  };

  const setCurrentSelectedUserId = (userId) => {
    if (activeTab === "billedTaskCosting") {
      setBilledSelectedUserId(userId);
    } else if (activeTab === "unbilledTaskCosting") {
      setUnbilledSelectedUserId(userId);
    } else if (activeTab === "completedBilledTaskCosting") {
      setCompletedBilledSelectedUserId(userId);
    } else if (activeTab === "completedUnbilledTaskCosting") {
      setCompletedUnbilledSelectedUserId(userId);
    }
  };

  const toggleColumn = (columnId) => {
    console.log("Toggling column:", columnId);
    const currentColumns = getCurrentVisibleColumns();
    console.log("Previous visible columns:", currentColumns);

    if (currentColumns.includes(columnId)) {
      // Don't allow hiding all columns
      if (currentColumns.length <= 1) {
        console.log("Cannot hide last column");
        return;
      }
      const newColumns = currentColumns.filter((id) => id !== columnId);
      console.log("New visible columns (removed):", newColumns);
      setCurrentVisibleColumns(newColumns);
    } else {
      const newColumns = [...currentColumns, columnId];
      console.log("New visible columns (added):", newColumns);
      setCurrentVisibleColumns(newColumns);
    }
  };

  // Function to render table cell content based on column type
  const renderCellContent = (task, columnId) => {
    switch (columnId) {
      case "taskTitle":
        return (
          <div
            className="max-w-[320px] overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 cursor-pointer hover:text-blue-600 font-semibold"
            onClick={() => handleTaskClick(task)}
          >
            <span className="inline-block min-w-full align-middle">
              {task.title}
            </span>
          </div>
        );
      case "assignedBy":
      case "assignedTo":
      case "firstVerifier":
      case "secondVerifier":
      case "thirdVerifier":
      case "fourthVerifier":
      case "fifthVerifier":
        const user = task[columnId];
        return user ? (
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="inline-block bg-blue-100 text-blue-700 rounded px-2 py-0.5 text-xs mt-1">
              {user.hours} hr
            </div>
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        );
      case "guides":
        return task.guides && task.guides.length > 0 ? (
          <div className="space-y-1">
            {task.guides.map((guide, idx) => (
              <div key={idx}>
                <div className="font-medium text-sm">{guide.name}</div>
                <div className="inline-block bg-purple-100 text-purple-700 rounded px-2 py-0.5 text-xs">
                  {guide.hours} hr
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        );
      default:
        return "-";
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

  const filteredUsers = users.filter(
    (u) =>
      u.firstName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.lastName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const generatePDF = () => {
    if (!selectedTask || !taskDetails) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPosition = 20;

    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text("Task Report", pageWidth / 2, yPosition, { align: "center" });
    yPosition += 10;

    // Task Title
    doc.setFontSize(14);
    doc.setFont(undefined, "bold");
    doc.text("Task: ", 14, yPosition);
    doc.setFont(undefined, "normal");
    const taskTitle = selectedTask.title || "N/A";
    const titleLines = doc.splitTextToSize(taskTitle, pageWidth - 50);
    doc.text(titleLines, 35, yPosition);
    yPosition += titleLines.length * 7 + 5;

    // Task Overview Section
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("Task Overview", 14, yPosition);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    const overviewData = [
      ["Client:", taskDetails.clientName || "N/A"],
      ["Work Type:", taskDetails.workType || "N/A"],
      ["Status:", taskDetails.status || "N/A"],
      ["Priority:", taskDetails.priority || "N/A"],
    ];

    overviewData.forEach(([label, value]) => {
      doc.setFont(undefined, "bold");
      doc.text(label, 20, yPosition);
      doc.setFont(undefined, "normal");
      doc.text(value, 60, yPosition);
      yPosition += 6;
    });

    if (taskDetails.description) {
      yPosition += 2;
      doc.setFont(undefined, "bold");
      doc.text("Description:", 20, yPosition);
      yPosition += 6;
      doc.setFont(undefined, "normal");
      const descLines = doc.splitTextToSize(
        taskDetails.description,
        pageWidth - 40
      );
      doc.text(descLines, 20, yPosition);
      yPosition += descLines.length * 6 + 8;
    } else {
      yPosition += 8;
    }

    // Hours Breakdown Section
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("Hours Breakdown", 14, yPosition);
    yPosition += 8;

    const hoursData = [];
    if (selectedTask.assignedBy) {
      hoursData.push([
        "Assigned By",
        selectedTask.assignedBy.name,
        `${selectedTask.assignedBy.hours}h`,
      ]);
    }
    if (selectedTask.assignedTo) {
      hoursData.push([
        "Assigned To",
        selectedTask.assignedTo.name,
        `${selectedTask.assignedTo.hours}h`,
      ]);
    }
    if (selectedTask.firstVerifier) {
      hoursData.push([
        "First Verifier",
        selectedTask.firstVerifier.name,
        `${selectedTask.firstVerifier.hours}h`,
      ]);
    }
    if (selectedTask.secondVerifier) {
      hoursData.push([
        "Second Verifier",
        selectedTask.secondVerifier.name,
        `${selectedTask.secondVerifier.hours}h`,
      ]);
    }
    if (selectedTask.thirdVerifier) {
      hoursData.push([
        "Third Verifier",
        selectedTask.thirdVerifier.name,
        `${selectedTask.thirdVerifier.hours}h`,
      ]);
    }
    if (selectedTask.fourthVerifier) {
      hoursData.push([
        "Fourth Verifier",
        selectedTask.fourthVerifier.name,
        `${selectedTask.fourthVerifier.hours}h`,
      ]);
    }
    if (selectedTask.fifthVerifier) {
      hoursData.push([
        "Fifth Verifier",
        selectedTask.fifthVerifier.name,
        `${selectedTask.fifthVerifier.hours}h`,
      ]);
    }
    if (selectedTask.guides && selectedTask.guides.length > 0) {
      selectedTask.guides.forEach((guide, idx) => {
        hoursData.push([`Guide ${idx + 1}`, guide.name, `${guide.hours}h`]);
      });
    }

    if (hoursData.length > 0) {
      doc.autoTable({
        startY: yPosition,
        head: [["Role", "Name", "Hours"]],
        body: hoursData,
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], fontSize: 10 },
        styles: { fontSize: 9 },
        margin: { left: 14 },
      });
      yPosition = doc.lastAutoTable.finalY + 10;
    }

    // Timeslots Section
    if (yPosition > 200) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text("Timeslots", 14, yPosition);
    yPosition += 8;

    if (taskTimeslots.length > 0) {
      const timeslotData = taskTimeslots.map((slot) => [
        slot.userName,
        slot.userRole,
        new Date(slot.date).toLocaleDateString(),
        `${slot.startTime} - ${slot.endTime}`,
        formatTime(slot.duration),
        slot.workDescription || "-",
      ]);

      doc.autoTable({
        startY: yPosition,
        head: [
          ["User", "Role", "Date", "Time Slot", "Duration", "Description"],
        ],
        body: timeslotData,
        theme: "grid",
        headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14 },
        columnStyles: {
          5: { cellWidth: 45 },
        },
      });
    } else {
      doc.setFontSize(10);
      doc.setFont(undefined, "normal");
      doc.text("No timeslots found for this task", 20, yPosition);
    }

    // Save PDF
    const fileName = `TaskReport_${selectedTask.taskId}_${
      taskDetails.clientName || "Report"
    }_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(fileName);
    toast.success("PDF downloaded successfully!");
  };

  const TaskDetailModal = () => {
    if (!showTaskModal || !selectedTask) return null;

    return (
      <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">
              Task Analysis: {selectedTask.title}
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={generatePDF}
                className="text-blue-600 hover:text-blue-800 transition-colors"
                title="Download PDF"
              >
                <ArrowDownTrayIcon className="w-6 h-6" />
              </button>
              <button
                onClick={() => {
                  setShowTaskModal(false);
                  setSelectedTask(null);
                  setTaskDetails(null);
                  setTaskTimeslots([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
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
                        <p className="font-medium whitespace-nowrap">
                          {taskDetails.description}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="text-lg font-semibold mb-3">Cost Breakdown</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedTask.assignedBy && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Assigned By</p>
                      <p className="font-medium">
                        {selectedTask.assignedBy.name}
                      </p>
                      <p className="text-sm text-blue-600">
                        {selectedTask.assignedBy.hours}h
                      </p>
                    </div>
                  )}
                  {selectedTask.assignedTo && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Assigned To</p>
                      <p className="font-medium">
                        {selectedTask.assignedTo.name}
                      </p>
                      <p className="text-sm text-blue-600">
                        {selectedTask.assignedTo.hours}h
                      </p>
                    </div>
                  )}
                  {selectedTask.firstVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">First Verifier</p>
                      <p className="font-medium">
                        {selectedTask.firstVerifier.name}
                      </p>
                      <p className="text-sm text-blue-600">
                        {selectedTask.firstVerifier.hours}h
                      </p>
                    </div>
                  )}
                  {selectedTask.secondVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Second Verifier</p>
                      <p className="font-medium">
                        {selectedTask.secondVerifier.name}
                      </p>
                      <p className="text-sm text-blue-600">
                        {selectedTask.secondVerifier.hours}h
                      </p>
                    </div>
                  )}
                  {selectedTask.thirdVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Third Verifier</p>
                      <p className="font-medium">
                        {selectedTask.thirdVerifier.name}
                      </p>
                      <p className="text-sm text-blue-600">
                        {selectedTask.thirdVerifier.hours}h
                      </p>
                    </div>
                  )}
                  {selectedTask.fourthVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Fourth Verifier</p>
                      <p className="font-medium">
                        {selectedTask.fourthVerifier.name}
                      </p>
                      <p className="text-sm text-blue-600">
                        {selectedTask.fourthVerifier.hours}h
                      </p>
                    </div>
                  )}
                  {selectedTask.fifthVerifier && (
                    <div className="bg-white rounded p-3">
                      <p className="text-sm text-gray-600">Fifth Verifier</p>
                      <p className="font-medium">
                        {selectedTask.fifthVerifier.name}
                      </p>
                      <p className="text-sm text-blue-600">
                        {selectedTask.fifthVerifier.hours}h
                      </p>
                    </div>
                  )}
                  {selectedTask.guides &&
                    selectedTask.guides.length > 0 &&
                    selectedTask.guides.map((guide, idx) => (
                      <div key={idx} className="bg-white rounded p-3">
                        <p className="text-sm text-gray-600">Guide {idx + 1}</p>
                        <p className="font-medium">{guide.name}</p>
                        <p className="text-sm text-purple-600">{guide.hours}</p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Timeslots */}
              <div className="bg-white rounded-lg border">
                <h4 className="text-lg font-semibold p-4 border-b">
                  All Timeslots
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          User
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Time Slot
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Duration
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Description
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {taskTimeslots.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-4 py-8 text-center text-gray-500"
                          >
                            No timeslots found for this task
                          </td>
                        </tr>
                      ) : (
                        taskTimeslots.map((slot, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="font-medium">{slot.userName}</div>
                              <div className="text-sm text-gray-500">
                                {slot.userRole}
                              </div>
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
                              {slot.workDescription || "-"}
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Task Management</h1>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => {
              setActiveTab("billedTaskCosting");
              setCosts([]); // Clear costs when switching to this tab
              initialLoadCompletedRef.current = false; // Reset initial load flag
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "billedTaskCosting"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Billed Tasks
          </button>
          <button
            onClick={() => {
              setActiveTab("unbilledTaskCosting");
              setCosts([]); // Clear costs when switching to this tab
              initialLoadCompletedRef.current = false; // Reset initial load flag
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "unbilledTaskCosting"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Unbilled Tasks
          </button>
          <button
            onClick={() => {
              setActiveTab("completedBilledTaskCosting");
              setCosts([]); // Clear costs when switching to this tab
              initialLoadCompletedRef.current = false; // Reset initial load flag
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "completedBilledTaskCosting"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Completed Billed Tasks
          </button>
          <button
            onClick={() => {
              setActiveTab("completedUnbilledTaskCosting");
              setCosts([]); // Clear costs when switching to this tab
              initialLoadCompletedRef.current = false; // Reset initial load flag
            }}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "completedUnbilledTaskCosting"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Completed Unbilled Tasks
          </button>
        </nav>
      </div>

      {/* Billed Task Costing Tab */}
      {activeTab === "billedTaskCosting" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Billed Tasks</h2>
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Users dropdown - only show for Admin and Team Head */}
            {["Admin", "Team Head"].includes(user?.role) && (
              <div className="relative" ref={usersDropdownRef}>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
                  onClick={() => setShowUsersDropdown((v) => !v)}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                    />
                  </svg>
                  <span className="font-semibold">
                    {getCurrentSelectedUserId()
                      ? (() => {
                          const selectedUser = allUsers.find(
                            (u) => u._id === getCurrentSelectedUserId()
                          );
                          return selectedUser
                            ? `${selectedUser.firstName} ${selectedUser.lastName}`
                            : "Users";
                        })()
                      : "Users"}
                  </span>
                </button>
                {showUsersDropdown && (
                  <div className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-48 animate-fade-in max-h-64 overflow-y-auto">
                    <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">
                      View Tasks For
                    </div>

                    {/* Search input */}
                    <div className="px-3 pb-2">
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <button
                      className={`block w-full text-left px-4 py-2 rounded ${
                        !getCurrentSelectedUserId()
                          ? "bg-blue-100 text-blue-800 font-semibold"
                          : "hover:bg-blue-50 text-gray-700"
                      }`}
                      onClick={() => {
                        setCurrentSelectedUserId(null);
                        setShowUsersDropdown(false);
                        setUserSearchTerm("");
                      }}
                    >
                      None (All Tasks)
                    </button>
                    {allUsers
                      .filter((u) => {
                        if (!userSearchTerm) return true;
                        const fullName =
                          `${u.firstName} ${u.lastName}`.toLowerCase();
                        return fullName.includes(userSearchTerm.toLowerCase());
                      })
                      .map((user) => (
                        <button
                          key={user._id}
                          className={`block w-full text-left px-4 py-2 rounded ${
                            getCurrentSelectedUserId() === user._id
                              ? "bg-blue-100 text-blue-800 font-semibold"
                              : "hover:bg-blue-50 text-gray-700"
                          }`}
                          onClick={() => {
                            setCurrentSelectedUserId(user._id);
                            setShowUsersDropdown(false);
                            setUserSearchTerm("");
                          }}
                        >
                          {user.firstName} {user.lastName}
                        </button>
                      ))}
                    {allUsers.filter((u) => {
                      if (!userSearchTerm) return true;
                      const fullName =
                        `${u.firstName} ${u.lastName}`.toLowerCase();
                      return fullName.includes(userSearchTerm.toLowerCase());
                    }).length === 0 &&
                      userSearchTerm && (
                        <div className="px-4 py-2 text-gray-500 text-sm">
                          No users found
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}

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
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                      Show/Hide Columns
                    </div>
                    {ALL_COLUMNS.map((column) => (
                      <label
                        key={column.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={getCurrentVisibleColumns().includes(
                            column.id
                          )}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {column.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!tabsLoaded && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center py-8">
                Loading table configuration...
              </div>
            </div>
          )}
          {tabsLoaded && getCurrentVisibleColumns().length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {ALL_COLUMNS.filter((col) =>
                      getCurrentVisibleColumns().includes(col.id)
                    ).map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-white"
                        style={{
                          width: `${100 / getCurrentVisibleColumns().length}%`,
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {costLoading && costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getCurrentVisibleColumns().length}
                        className="text-center py-8"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getCurrentVisibleColumns().length}
                        className="text-center py-8"
                      >
                        No billed tasks found.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {costs.map((task) => (
                        <tr key={task.taskId} className="hover:bg-gray-50">
                          {ALL_COLUMNS.filter((col) =>
                            getCurrentVisibleColumns().includes(col.id)
                          ).map((column) => (
                            <td
                              key={column.id}
                              className="px-4 py-2 whitespace-nowrap"
                              style={{
                                width: `${
                                  100 / getCurrentVisibleColumns().length
                                }%`,
                              }}
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
                style={{ height: "1px" }}
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
      {activeTab === "unbilledTaskCosting" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Unbilled Tasks</h2>
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Users dropdown - only show for Admin and Team Head */}
            {["Admin", "Team Head"].includes(user?.role) && (
              <div className="relative" ref={usersDropdownRef}>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
                  onClick={() => setShowUsersDropdown((v) => !v)}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                    />
                  </svg>
                  <span className="font-semibold">
                    {getCurrentSelectedUserId()
                      ? (() => {
                          const selectedUser = allUsers.find(
                            (u) => u._id === getCurrentSelectedUserId()
                          );
                          return selectedUser
                            ? `${selectedUser.firstName} ${selectedUser.lastName}`
                            : "Users";
                        })()
                      : "Users"}
                  </span>
                </button>
                {showUsersDropdown && (
                  <div className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-48 animate-fade-in max-h-64 overflow-y-auto">
                    <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">
                      View Tasks For
                    </div>

                    {/* Search input */}
                    <div className="px-3 pb-2">
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <button
                      className={`block w-full text-left px-4 py-2 rounded ${
                        !getCurrentSelectedUserId()
                          ? "bg-blue-100 text-blue-800 font-semibold"
                          : "hover:bg-blue-50 text-gray-700"
                      }`}
                      onClick={() => {
                        setCurrentSelectedUserId(null);
                        setShowUsersDropdown(false);
                        setUserSearchTerm("");
                      }}
                    >
                      None (All Tasks)
                    </button>
                    {allUsers
                      .filter((u) => {
                        if (!userSearchTerm) return true;
                        const fullName =
                          `${u.firstName} ${u.lastName}`.toLowerCase();
                        return fullName.includes(userSearchTerm.toLowerCase());
                      })
                      .map((user) => (
                        <button
                          key={user._id}
                          className={`block w-full text-left px-4 py-2 rounded ${
                            getCurrentSelectedUserId() === user._id
                              ? "bg-blue-100 text-blue-800 font-semibold"
                              : "hover:bg-blue-50 text-gray-700"
                          }`}
                          onClick={() => {
                            setCurrentSelectedUserId(user._id);
                            setShowUsersDropdown(false);
                            setUserSearchTerm("");
                          }}
                        >
                          {user.firstName} {user.lastName}
                        </button>
                      ))}
                    {allUsers.filter((u) => {
                      if (!userSearchTerm) return true;
                      const fullName =
                        `${u.firstName} ${u.lastName}`.toLowerCase();
                      return fullName.includes(userSearchTerm.toLowerCase());
                    }).length === 0 &&
                      userSearchTerm && (
                        <div className="px-4 py-2 text-gray-500 text-sm">
                          No users found
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}

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
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                      Show/Hide Columns
                    </div>
                    {ALL_COLUMNS.map((column) => (
                      <label
                        key={column.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={getCurrentVisibleColumns().includes(
                            column.id
                          )}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {column.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!tabsLoaded && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center py-8">
                Loading table configuration...
              </div>
            </div>
          )}
          {tabsLoaded && getCurrentVisibleColumns().length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {ALL_COLUMNS.filter((col) =>
                      getCurrentVisibleColumns().includes(col.id)
                    ).map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-white"
                        style={{
                          width: `${100 / getCurrentVisibleColumns().length}%`,
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {costLoading && costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getCurrentVisibleColumns().length}
                        className="text-center py-8"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getCurrentVisibleColumns().length}
                        className="text-center py-8"
                      >
                        No unbilled tasks found.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {costs.map((task) => (
                        <tr key={task.taskId} className="hover:bg-gray-50">
                          {ALL_COLUMNS.filter((col) =>
                            getCurrentVisibleColumns().includes(col.id)
                          ).map((column) => (
                            <td
                              key={column.id}
                              className="px-4 py-2 whitespace-nowrap"
                              style={{
                                width: `${
                                  100 / getCurrentVisibleColumns().length
                                }%`,
                              }}
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
                style={{ height: "1px" }}
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
      {activeTab === "completedBilledTaskCosting" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Completed Billed Tasks</h2>
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Users dropdown - only show for Admin and Team Head */}
            {["Admin", "Team Head"].includes(user?.role) && (
              <div className="relative" ref={usersDropdownRef}>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
                  onClick={() => setShowUsersDropdown((v) => !v)}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                    />
                  </svg>
                  <span className="font-semibold">
                    {getCurrentSelectedUserId()
                      ? (() => {
                          const selectedUser = allUsers.find(
                            (u) => u._id === getCurrentSelectedUserId()
                          );
                          return selectedUser
                            ? `${selectedUser.firstName} ${selectedUser.lastName}`
                            : "Users";
                        })()
                      : "Users"}
                  </span>
                </button>
                {showUsersDropdown && (
                  <div className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-48 animate-fade-in max-h-64 overflow-y-auto">
                    <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">
                      View Tasks For
                    </div>

                    {/* Search input */}
                    <div className="px-3 pb-2">
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <button
                      className={`block w-full text-left px-4 py-2 rounded ${
                        !getCurrentSelectedUserId()
                          ? "bg-blue-100 text-blue-800 font-semibold"
                          : "hover:bg-blue-50 text-gray-700"
                      }`}
                      onClick={() => {
                        setCurrentSelectedUserId(null);
                        setShowUsersDropdown(false);
                        setUserSearchTerm("");
                      }}
                    >
                      None (All Tasks)
                    </button>
                    {allUsers
                      .filter((u) => {
                        if (!userSearchTerm) return true;
                        const fullName =
                          `${u.firstName} ${u.lastName}`.toLowerCase();
                        return fullName.includes(userSearchTerm.toLowerCase());
                      })
                      .map((user) => (
                        <button
                          key={user._id}
                          className={`block w-full text-left px-4 py-2 rounded ${
                            getCurrentSelectedUserId() === user._id
                              ? "bg-blue-100 text-blue-800 font-semibold"
                              : "hover:bg-blue-50 text-gray-700"
                          }`}
                          onClick={() => {
                            setCurrentSelectedUserId(user._id);
                            setShowUsersDropdown(false);
                            setUserSearchTerm("");
                          }}
                        >
                          {user.firstName} {user.lastName}
                        </button>
                      ))}
                    {allUsers.filter((u) => {
                      if (!userSearchTerm) return true;
                      const fullName =
                        `${u.firstName} ${u.lastName}`.toLowerCase();
                      return fullName.includes(userSearchTerm.toLowerCase());
                    }).length === 0 &&
                      userSearchTerm && (
                        <div className="px-4 py-2 text-gray-500 text-sm">
                          No users found
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}

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
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                      Show/Hide Columns
                    </div>
                    {ALL_COLUMNS.map((column) => (
                      <label
                        key={column.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={getCurrentVisibleColumns().includes(
                            column.id
                          )}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {column.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!tabsLoaded && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center py-8">
                Loading table configuration...
              </div>
            </div>
          )}
          {tabsLoaded && getCurrentVisibleColumns().length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {ALL_COLUMNS.filter((col) =>
                      getCurrentVisibleColumns().includes(col.id)
                    ).map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-white"
                        style={{
                          width: `${100 / getCurrentVisibleColumns().length}%`,
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {costLoading && costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getCurrentVisibleColumns().length}
                        className="text-center py-8"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getCurrentVisibleColumns().length}
                        className="text-center py-8"
                      >
                        No completed billed tasks found.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {costs.map((task) => (
                        <tr key={task.taskId} className="hover:bg-gray-50">
                          {ALL_COLUMNS.filter((col) =>
                            getCurrentVisibleColumns().includes(col.id)
                          ).map((column) => (
                            <td
                              key={column.id}
                              className="px-4 py-2 whitespace-nowrap"
                              style={{
                                width: `${
                                  100 / getCurrentVisibleColumns().length
                                }%`,
                              }}
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
                style={{ height: "1px" }}
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
      {activeTab === "completedUnbilledTaskCosting" && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Completed Unbilled Tasks</h2>
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
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {/* Users dropdown - only show for Admin and Team Head */}
            {["Admin", "Team Head"].includes(user?.role) && (
              <div className="relative" ref={usersDropdownRef}>
                <button
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
                  onClick={() => setShowUsersDropdown((v) => !v)}
                  type="button"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                    />
                  </svg>
                  <span className="font-semibold">
                    {getCurrentSelectedUserId()
                      ? (() => {
                          const selectedUser = allUsers.find(
                            (u) => u._id === getCurrentSelectedUserId()
                          );
                          return selectedUser
                            ? `${selectedUser.firstName} ${selectedUser.lastName}`
                            : "Users";
                        })()
                      : "Users"}
                  </span>
                </button>
                {showUsersDropdown && (
                  <div className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-48 animate-fade-in max-h-64 overflow-y-auto">
                    <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">
                      View Tasks For
                    </div>

                    {/* Search input */}
                    <div className="px-3 pb-2">
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    <button
                      className={`block w-full text-left px-4 py-2 rounded ${
                        !getCurrentSelectedUserId()
                          ? "bg-blue-100 text-blue-800 font-semibold"
                          : "hover:bg-blue-50 text-gray-700"
                      }`}
                      onClick={() => {
                        setCurrentSelectedUserId(null);
                        setShowUsersDropdown(false);
                        setUserSearchTerm("");
                      }}
                    >
                      None (All Tasks)
                    </button>
                    {allUsers
                      .filter((u) => {
                        if (!userSearchTerm) return true;
                        const fullName =
                          `${u.firstName} ${u.lastName}`.toLowerCase();
                        return fullName.includes(userSearchTerm.toLowerCase());
                      })
                      .map((user) => (
                        <button
                          key={user._id}
                          className={`block w-full text-left px-4 py-2 rounded ${
                            getCurrentSelectedUserId() === user._id
                              ? "bg-blue-100 text-blue-800 font-semibold"
                              : "hover:bg-blue-50 text-gray-700"
                          }`}
                          onClick={() => {
                            setCurrentSelectedUserId(user._id);
                            setShowUsersDropdown(false);
                            setUserSearchTerm("");
                          }}
                        >
                          {user.firstName} {user.lastName}
                        </button>
                      ))}
                    {allUsers.filter((u) => {
                      if (!userSearchTerm) return true;
                      const fullName =
                        `${u.firstName} ${u.lastName}`.toLowerCase();
                      return fullName.includes(userSearchTerm.toLowerCase());
                    }).length === 0 &&
                      userSearchTerm && (
                        <div className="px-4 py-2 text-gray-500 text-sm">
                          No users found
                        </div>
                      )}
                  </div>
                )}
              </div>
            )}

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
                    <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">
                      Show/Hide Columns
                    </div>
                    {ALL_COLUMNS.map((column) => (
                      <label
                        key={column.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={getCurrentVisibleColumns().includes(
                            column.id
                          )}
                          onChange={() => toggleColumn(column.id)}
                          className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {column.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {!tabsLoaded && (
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-center py-8">
                Loading table configuration...
              </div>
            </div>
          )}
          {tabsLoaded && getCurrentVisibleColumns().length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {ALL_COLUMNS.filter((col) =>
                      getCurrentVisibleColumns().includes(col.id)
                    ).map((column) => (
                      <th
                        key={column.id}
                        className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase bg-white"
                        style={{
                          width: `${100 / getCurrentVisibleColumns().length}%`,
                        }}
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {costLoading && costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getCurrentVisibleColumns().length}
                        className="text-center py-8"
                      >
                        Loading...
                      </td>
                    </tr>
                  ) : costs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={getCurrentVisibleColumns().length}
                        className="text-center py-8"
                      >
                        No completed unbilled tasks found.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {costs.map((task) => (
                        <tr key={task.taskId} className="hover:bg-gray-50">
                          {ALL_COLUMNS.filter((col) =>
                            getCurrentVisibleColumns().includes(col.id)
                          ).map((column) => (
                            <td
                              key={column.id}
                              className="px-4 py-2 whitespace-nowrap"
                              style={{
                                width: `${
                                  100 / getCurrentVisibleColumns().length
                                }%`,
                              }}
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
                style={{ height: "1px" }}
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

      {/* Task Detail Modal */}
      <TaskDetailModal />
    </div>
  );
};

export default Cost;
