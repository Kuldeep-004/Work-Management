import React, { useState, useEffect, useRef } from "react";
import AdvancedTaskTable from "../../components/AdvancedTaskTable";
import { useAuth } from "../../context/AuthContext";
import { API_BASE_URL, fetchTabState, saveTabState } from "../../apiConfig";
import ErrorBoundary from "../../components/ErrorBoundary";

const ALL_COLUMNS = [
  { id: "title", label: "Client Name & Work In Brief", defaultWidth: 256 },
  { id: "description", label: "Description", defaultWidth: 180 },
  { id: "clientName", label: "Client Name", defaultWidth: 150 },
  { id: "clientGroup", label: "Client Group", defaultWidth: 150 },
  { id: "workType", label: "Work Type", defaultWidth: 150 },
  { id: "billed", label: "Internal Works", defaultWidth: 80 },
  { id: "status", label: "Task Status", defaultWidth: 120 },
  { id: "verificationStatus", label: "Verification Status", defaultWidth: 120 },
  { id: "priority", label: "Priority", defaultWidth: 120 },
  { id: "inwardEntryDate", label: "Inward Entry Date", defaultWidth: 150 },
  { id: "dueDate", label: "Due Date", defaultWidth: 120 },
  { id: "targetDate", label: "Target Date", defaultWidth: 120 },
  { id: "assignedBy", label: "Assigned By", defaultWidth: 150 },
  { id: "assignedTo", label: "Assigned To", defaultWidth: 150 },
  { id: "verificationAssignedTo", label: "First Verifier", defaultWidth: 150 },
  {
    id: "secondVerificationAssignedTo",
    label: "Second Verifier",
    defaultWidth: 150,
  },
  { id: "files", label: "Files", defaultWidth: 120 },
  { id: "comments", label: "Comments", defaultWidth: 120 },
];

const BilledTasks = () => {
  const { user, isAuthenticated } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleColumns, setVisibleColumns] = useState(() =>
    ALL_COLUMNS.map((col) => col.id),
  );
  const [columnOrder, setColumnOrder] = useState(() =>
    ALL_COLUMNS.map((col) => col.id),
  );
  const [columnWidths, setColumnWidths] = useState(() =>
    Object.fromEntries(
      ALL_COLUMNS.map((col) => [col.id, col.defaultWidth || 150]),
    ),
  );
  const [sortBy, setSortBy] = useState("");
  const [tableStateLoaded, setTableStateLoaded] = useState(false);
  const [showGroupByDropdown, setShowGroupByDropdown] = useState(false);
  const [rowOrder, setRowOrder] = useState([]);
  const tableRef = useRef(null);
  const tabId = "billedTasksMain";

  // Fetch full table state from backend on mount
  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    (async () => {
      try {
        const state = await fetchTabState("billedTasks", user.token);
        if (isMounted && state) {
          setVisibleColumns(
            Array.isArray(state.visibleColumns)
              ? state.visibleColumns
              : ALL_COLUMNS.map((col) => col.id),
          );
          setColumnOrder(
            Array.isArray(state.columnOrder)
              ? state.columnOrder
              : ALL_COLUMNS.map((col) => col.id),
          );
          setColumnWidths(
            state.columnWidths && typeof state.columnWidths === "object"
              ? state.columnWidths
              : Object.fromEntries(
                  ALL_COLUMNS.map((col) => [col.id, col.defaultWidth || 150]),
                ),
          );
          setSortBy(
            typeof state.sortBy === "string" ? state.sortBy : "createdAt",
          );
          setRowOrder(Array.isArray(state.rowOrder) ? state.rowOrder : []);
        } else if (isMounted) {
          setVisibleColumns(ALL_COLUMNS.map((col) => col.id));
          setColumnOrder(ALL_COLUMNS.map((col) => col.id));
          setColumnWidths(
            Object.fromEntries(
              ALL_COLUMNS.map((col) => [col.id, col.defaultWidth || 150]),
            ),
          );
          setSortBy("createdAt");
          setRowOrder([]);
        }
      } catch {
        if (isMounted) {
          setVisibleColumns(ALL_COLUMNS.map((col) => col.id));
          setColumnOrder(ALL_COLUMNS.map((col) => col.id));
          setColumnWidths(
            Object.fromEntries(
              ALL_COLUMNS.map((col) => [col.id, col.defaultWidth || 150]),
            ),
          );
          setSortBy("createdAt");
          setRowOrder([]);
        }
      } finally {
        if (isMounted) setTableStateLoaded(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user]);

  // Save full table state to backend whenever any part changes (after initial load)
  useEffect(() => {
    if (!user?.token || !tableStateLoaded) return;
    if (!visibleColumns || !columnOrder || !columnWidths) return;
    saveTabState(
      "billedTasks",
      { visibleColumns, columnOrder, columnWidths, sortBy, rowOrder },
      user.token,
    ).catch(() => {});
  }, [
    visibleColumns,
    columnOrder,
    columnWidths,
    sortBy,
    rowOrder,
    user,
    tableStateLoaded,
  ]);

  const applyRowOrder = (tasks, order) => {
    if (!order || order.length === 0) return tasks;

    const taskMap = new Map(tasks.map((task) => [task._id, task]));
    const orderedTasks = [];
    const remainingTasks = new Set(tasks.map((task) => task._id));

    // Add tasks in the specified order
    order.forEach((id) => {
      if (taskMap.has(id)) {
        orderedTasks.push(taskMap.get(id));
        remainingTasks.delete(id);
      }
    });

    // Add any remaining tasks that weren't in the rowOrder
    remainingTasks.forEach((id) => {
      orderedTasks.push(taskMap.get(id));
    });

    return orderedTasks;
  };

  // Fetch both tasks and rowOrder together to avoid flicker
  useEffect(() => {
    if (!user?.token) return;
    let isMounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch both tab state and tasks in parallel
        const [state, response] = await Promise.all([
          fetchTabState("billedTasks", user.token),
          fetch(`${API_BASE_URL}/api/tasks/all`, {
            headers: { Authorization: `Bearer ${user.token}` },
          }),
        ]);
        if (!response.ok) throw new Error("Failed to fetch tasks");
        let data = await response.json();
        data = data.filter(
          (task) => task.billed === false && task.status !== "completed",
        );
        let order = Array.isArray(state?.rowOrder) ? state.rowOrder : [];
        if (order.length > 0) {
          data = applyRowOrder(data, order);
        }
        if (isMounted) setTasks(data);
      } catch (err) {
        if (isMounted) {
          setError(err.message);
          setTasks([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [user, tableStateLoaded]);

  if (!isAuthenticated() || user.role !== "Admin") return null;
  if (!tableStateLoaded || !visibleColumns || !columnOrder || !columnWidths) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  if (loading)
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  if (error)
    return <div className="text-red-500 text-center p-4">Error: {error}</div>;

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Billed Tasks</h2>
      <div className="flex flex-row gap-4 mb-4">
        <input
          type="text"
          placeholder="Search tasks..."
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {/* Replace the old <select> with the dashboard-style Group By dropdown */}
        <div className="relative flex items-center gap-2">
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700 text-sm font-medium h-11 min-w-[120px] transition-colors"
            onClick={() => setShowGroupByDropdown((v) => !v)}
            type="button"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <rect x="3" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="3" width="7" height="7" rx="2" />
              <rect x="14" y="14" width="7" height="7" rx="2" />
              <rect x="3" y="14" width="7" height="7" rx="2" />
            </svg>
            <span className="font-semibold">Group By</span>
          </button>
          {showGroupByDropdown && (
            <div
              className="absolute left-0 top-full z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-2 w-44 animate-fade-in"
              style={{ minWidth: "160px" }}
            >
              <div className="font-semibold text-gray-700 mb-2 text-sm px-3 pt-3">
                Group By
              </div>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${!sortBy || sortBy === "" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("");
                  setShowGroupByDropdown(false);
                }}
              >
                None
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "createdAt" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("createdAt");
                  setShowGroupByDropdown(false);
                }}
              >
                Assigned On
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "priority" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("priority");
                  setShowGroupByDropdown(false);
                }}
              >
                Priority
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "status" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("status");
                  setShowGroupByDropdown(false);
                }}
              >
                Stages
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "clientName" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("clientName");
                  setShowGroupByDropdown(false);
                }}
              >
                Client Name
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "clientGroup" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("clientGroup");
                  setShowGroupByDropdown(false);
                }}
              >
                Client Group
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "workType" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("workType");
                  setShowGroupByDropdown(false);
                }}
              >
                Work Type
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "billed" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("billed");
                  setShowGroupByDropdown(false);
                }}
              >
                Billed
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "assignedBy" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("assignedBy");
                  setShowGroupByDropdown(false);
                }}
              >
                Assigned By
              </button>
              <button
                className={`block w-full text-left px-4 py-2 rounded ${sortBy === "assignedTo" ? "bg-blue-100 text-blue-800 font-semibold" : "hover:bg-blue-50 text-gray-700"}`}
                onClick={() => {
                  setSortBy("assignedTo");
                  setShowGroupByDropdown(false);
                }}
              >
                Assigned To
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Responsive table wrapper - hide scrollbar */}
      <div className="table-wrapper-no-scrollbar w-full" ref={tableRef}>
        <AdvancedTaskTable
          tasks={
            sortBy
              ? tasks
                  .filter((task) =>
                    task.title.toLowerCase().includes(searchTerm.toLowerCase()),
                  )
                  .sort((a, b) => {
                    let aValue = a[sortBy];
                    let bValue = b[sortBy];
                    if (sortBy === "createdAt") {
                      aValue = new Date(aValue);
                      bValue = new Date(bValue);
                    } else if (sortBy === "priority") {
                      const priorityOrder = {
                        urgent: 1,
                        today: 2,
                        lessThan3Days: 3,
                        thisWeek: 4,
                        thisMonth: 5,
                        regular: 6,
                        filed: 7,
                        dailyWorksOffice: 8,
                        monthlyWorks: 9,
                      };
                      aValue = priorityOrder[aValue] || 999;
                      bValue = priorityOrder[bValue] || 999;
                    } else if (sortBy === "assignedBy") {
                      aValue = a.assignedBy
                        ? `${a.assignedBy.firstName} ${a.assignedBy.lastName}`
                        : "";
                      bValue = b.assignedBy
                        ? `${b.assignedBy.firstName} ${b.assignedBy.lastName}`
                        : "";
                    } else if (sortBy === "assignedTo") {
                      aValue = a.assignedTo
                        ? Array.isArray(a.assignedTo)
                          ? a.assignedTo
                              .map((u) => `${u.firstName} ${u.lastName}`)
                              .join(", ")
                          : `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
                        : "";
                      bValue = b.assignedTo
                        ? Array.isArray(b.assignedTo)
                          ? b.assignedTo
                              .map((u) => `${u.firstName} ${u.lastName}`)
                              .join(", ")
                          : `${b.assignedTo.firstName} ${b.assignedTo.lastName}`
                        : "";
                    }
                    if (aValue < bValue) return -1;
                    if (aValue > bValue) return 1;
                    return 0;
                  })
              : tasks.filter((task) =>
                  task.title.toLowerCase().includes(searchTerm.toLowerCase()),
                )
          }
          viewType="billed"
          externalTableRef={tableRef}
          visibleColumns={visibleColumns}
          setVisibleColumns={setVisibleColumns}
          columnOrder={columnOrder}
          setColumnOrder={setColumnOrder}
          columnWidths={columnWidths}
          setColumnWidths={setColumnWidths}
          currentUser={user}
          sortBy={sortBy}
          storageKeyPrefix="billedtasks"
          tabKey="billedTasks"
          tabId="billedTasksMain"
        />
      </div>
    </div>
  );
};

export default BilledTasks;
