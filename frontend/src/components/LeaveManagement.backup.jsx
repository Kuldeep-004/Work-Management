import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { API_BASE_URL } from "../apiConfig";
import { useAuth } from "../context/AuthContext";
import "./LeaveManagement.css";

const LeaveManagement = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [activeTab, setActiveTab] = useState("my-leaves");
  const [filterStatus, setFilterStatus] = useState("");

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Date filters should be empty by default - only apply when user clicks "Apply Filters"
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const [stats, setStats] = useState(null);
  const [statsDateRange, setStatsDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const printRef = useRef(null);

  const [formData, setFormData] = useState({
    leaveType: "Sick Leave",
    startDate: getTodayDate(),
    endDate: getTodayDate(),
    reason: "",
  });

  const leaveTypes = [
    "Sick Leave",
    "Casual Leave",
    "Vacation Leave",
    "Personal Leave",
    "Emergency Leave",
    "Other",
  ];

  useEffect(() => {
    if (user) {
      fetchLeaves();
    }
  }, [user]);

  useEffect(() => {
    if (
      activeTab === "all-leaves" &&
      user &&
      (user.role === "Team Head" || user.role === "Admin")
    ) {
      fetchAllLeaves();
    }
  }, [activeTab, user]);

  const fetchLeaves = async () => {
    if (!user?.token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filterStatus) params.append("status", filterStatus);
      if (dateRange.startDate) params.append("startDate", dateRange.startDate);
      if (dateRange.endDate) params.append("endDate", dateRange.endDate);

      const response = await axios.get(
        `${API_BASE_URL}/api/leaves/my-leaves?${params}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );
      setLeaves(response.data.leaves);
    } catch (error) {
      console.error("Error fetching leaves:", error);
      toast.error("Failed to fetch leaves");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllLeaves = async () => {
    if (!user?.token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (filterStatus) params.append("status", filterStatus);
      if (dateRange.startDate) params.append("startDate", dateRange.startDate);
      if (dateRange.endDate) params.append("endDate", dateRange.endDate);

      const response = await axios.get(
        `${API_BASE_URL}/api/leaves/all-leaves?${params}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );
      setAllLeaves(response.data.leaves);
    } catch (error) {
      console.error("Error fetching all leaves:", error);
      toast.error("Failed to fetch leaves");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user?.token) return;

    try {
      const params = new URLSearchParams();

      if (statsDateRange.startDate)
        params.append("startDate", statsDateRange.startDate);
      if (statsDateRange.endDate)
        params.append("endDate", statsDateRange.endDate);

      const response = await axios.get(
        `${API_BASE_URL}/api/leaves/stats/me?${params}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching stats:", error);
      toast.error("Failed to fetch leave statistics");
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate || !formData.reason) {
      toast.error("Please fill all required fields");
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      toast.error("End date cannot be before start date");
      return;
    }

    try {
      setLoading(true);
      await axios.post(`${API_BASE_URL}/api/leaves/apply`, formData, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      toast.success("Leave application submitted successfully!");
      setShowApplyForm(false);
      setFormData({
        leaveType: "Sick Leave",
        startDate: getTodayDate(),
        endDate: getTodayDate(),
        reason: "",
      });
      fetchLeaves();
    } catch (error) {
      console.error("Error applying for leave:", error);
      toast.error(error.response?.data?.message || "Failed to apply for leave");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReject = async (leaveId, status, rejectionReason = "") => {
    try {
      setLoading(true);
      await axios.patch(
        `${API_BASE_URL}/api/leaves/${leaveId}/status`,
        { status, rejectionReason },
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      toast.success(`Leave ${status.toLowerCase()} successfully!`);
      fetchAllLeaves();
      fetchLeaves();
    } catch (error) {
      console.error("Error updating leave status:", error);
      toast.error(
        error.response?.data?.message || "Failed to update leave status",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (
      !window.confirm("Are you sure you want to delete this leave application?")
    ) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/api/leaves/${leaveId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      toast.success("Leave application deleted successfully!");
      fetchLeaves();
    } catch (error) {
      console.error("Error deleting leave:", error);
      toast.error(
        error.response?.data?.message || "Failed to delete leave application",
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePrintLeave = async (leaveId) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/leaves/${leaveId}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      const leave = response.data.leave;
      printLeaveApplication(leave);
    } catch (error) {
      console.error("Error fetching leave for print:", error);
      toast.error("Failed to fetch leave details");
    }
  };

  const printLeaveApplication = (leave) => {
    const printWindow = window.open("", "", "height=600,width=800");

    const approvalSection =
      leave.status === "Approved"
        ? `
        <div class="approval-section">
          <p><strong>Status:</strong> <span class="approved">APPROVED</span></p>
          <p><strong>Approved By:</strong> ${leave.approverName}</p>
          <p><strong>Approved On:</strong> ${new Date(leave.approvedAt).toLocaleString()}</p>
          <div class="signature-box">
            <p>Signature of Team Head</p>
            <div class="signature-line">${leave.approverName}</div>
          </div>
        </div>
      `
        : leave.status === "Rejected"
          ? `
        <div class="approval-section">
          <p><strong>Status:</strong> <span class="rejected">REJECTED</span></p>
          <p><strong>Rejected By:</strong> ${leave.approverName}</p>
          <p><strong>Rejected On:</strong> ${new Date(leave.approvedAt).toLocaleString()}</p>
          ${leave.rejectionReason ? `<p><strong>Reason:</strong> ${leave.rejectionReason}</p>` : ""}
        </div>
      `
          : `
        <div class="approval-section pending-approval">
          <p><strong>Status:</strong> <span class="pending">PENDING APPROVAL</span></p>
          <div class="signature-box">
            <p>Signature of Team Head</p>
            <div class="signature-line">_______________________</div>
            <p class="signature-note">Date: _______________________</p>
          </div>
        </div>
      `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Leave Application - ${leave.userId?.name || leave.userName}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              line-height: 1.6;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 3px solid #2563eb;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #2563eb;
              font-size: 28px;
              margin-bottom: 10px;
            }
            .company-name {
              font-size: 18px;
              color: #666;
              margin-top: 5px;
            }
            .application-details {
              margin: 30px 0;
            }
            .detail-row {
              display: flex;
              margin-bottom: 15px;
              padding: 10px;
              background: #f9fafb;
              border-left: 4px solid #2563eb;
            }
            .detail-label {
              font-weight: bold;
              width: 200px;
              color: #374151;
            }
            .detail-value {
              flex: 1;
              color: #1f2937;
            }
            .reason-box {
              margin: 20px 0;
              padding: 15px;
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
            }
            .reason-box strong {
              display: block;
              margin-bottom: 10px;
              color: #374151;
            }
            .approval-section {
              margin-top: 40px;
              padding: 20px;
              border: 2px solid #e5e7eb;
              border-radius: 8px;
              background: #f9fafb;
            }
            .approval-section p {
              margin-bottom: 10px;
            }
            .signature-box {
              margin-top: 60px;
              padding: 20px;
            }
            .signature-line {
              margin-top: 50px;
              padding-top: 10px;
              border-top: 2px solid #000;
              text-align: center;
              font-weight: bold;
            }
            .signature-note {
              margin-top: 20px;
              font-size: 14px;
              color: #666;
            }
            .approved {
              color: #059669;
              font-weight: bold;
              font-size: 18px;
            }
            .rejected {
              color: #dc2626;
              font-weight: bold;
              font-size: 18px;
            }
            .pending {
              color: #d97706;
              font-weight: bold;
              font-size: 18px;
            }
            .footer {
              margin-top: 60px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>LEAVE APPLICATION</h1>
            <div class="company-name">Work Management System</div>
          </div>
          
          <div class="application-details">
            <div class="detail-row">
              <div class="detail-label">Employee Name:</div>
              <div class="detail-value">${leave.userId?.name || leave.userName}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Employee Email:</div>
              <div class="detail-value">${leave.userId?.email || "N/A"}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Team:</div>
              <div class="detail-value">${leave.teamId?.name || "N/A"}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Leave Type:</div>
              <div class="detail-value">${leave.leaveType}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Start Date:</div>
              <div class="detail-value">${new Date(leave.startDate).toLocaleDateString()}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">End Date:</div>
              <div class="detail-value">${new Date(leave.endDate).toLocaleDateString()}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Number of Days:</div>
              <div class="detail-value">${leave.numberOfDays}</div>
            </div>
            
            <div class="detail-row">
              <div class="detail-label">Applied On:</div>
              <div class="detail-value">${new Date(leave.appliedAt).toLocaleString()}</div>
            </div>
          </div>
          
          <div class="reason-box">
            <strong>Reason for Leave:</strong>
            <div>${leave.reason}</div>
          </div>
          
          ${approvalSection}
          
          <div class="footer">
            <p>This is a computer-generated document. Generated on ${new Date().toLocaleString()}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Approved":
        return "status-approved";
      case "Rejected":
        return "status-rejected";
      case "Pending":
        return "status-pending";
      default:
        return "";
    }
  };

  const renderLeaveCard = (leave, showActions = false) => {
    const canApprove =
      showActions &&
      (user?.role === "Team Head" || user?.role === "Admin") &&
      leave.status === "Pending";

    const canDelete = !showActions && leave.status === "Pending";

    return (
      <div key={leave._id} className="leave-card">
        <div className="leave-header">
          <div className="leave-type-badge">{leave.leaveType}</div>
          <div className={`leave-status ${getStatusBadgeClass(leave.status)}`}>
            {leave.status}
          </div>
        </div>

        <div className="leave-details">
          {showActions && (
            <div className="leave-detail">
              <strong>Employee:</strong> {leave.userId?.name || leave.userName}
            </div>
          )}
          {showActions && leave.teamId && (
            <div className="leave-detail">
              <strong>Team:</strong> {leave.teamId.name}
            </div>
          )}
          <div className="leave-detail">
            <strong>Duration:</strong>{" "}
            {new Date(leave.startDate).toLocaleDateString()} -{" "}
            {new Date(leave.endDate).toLocaleDateString()}
          </div>
          <div className="leave-detail">
            <strong>Days:</strong> {leave.numberOfDays}
          </div>
          <div className="leave-detail">
            <strong>Applied On:</strong>{" "}
            {new Date(leave.appliedAt).toLocaleDateString()}
          </div>
          <div className="leave-detail">
            <strong>Reason:</strong> {leave.reason}
          </div>

          {leave.status === "Approved" && leave.approverName && (
            <div className="leave-detail approval-info">
              <strong>Approved By:</strong> {leave.approverName}
              <br />
              <strong>Approved On:</strong>{" "}
              {new Date(leave.approvedAt).toLocaleString()}
            </div>
          )}

          {leave.status === "Rejected" && (
            <div className="leave-detail rejection-info">
              <strong>Rejected By:</strong> {leave.approverName}
              <br />
              {leave.rejectionReason && (
                <>
                  <strong>Reason:</strong> {leave.rejectionReason}
                </>
              )}
            </div>
          )}
        </div>

        <div className="leave-actions">
          <button
            className="btn-print"
            onClick={() => handlePrintLeave(leave._id)}
          >
            🖨️ Print
          </button>

          {canApprove && (
            <>
              <button
                className="btn-approve"
                onClick={() => handleApproveReject(leave._id, "Approved")}
                disabled={loading}
              >
                ✓ Approve
              </button>
              <button
                className="btn-reject"
                onClick={() => {
                  const reason = prompt("Enter rejection reason (optional):");
                  handleApproveReject(leave._id, "Rejected", reason || "");
                }}
                disabled={loading}
              >
                ✗ Reject
              </button>
            </>
          )}

          {canDelete && (
            <button
              className="btn-delete"
              onClick={() => handleDeleteLeave(leave._id)}
              disabled={loading}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Apply Leave Modal Popup */}
      {showApplyForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Apply for Leave</h2>
              <button
                onClick={() => setShowApplyForm(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leave Type <span className="text-red-500">*</span>
                </label>
                <select
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                  className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows="4"
                  className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Please provide a detailed reason for your leave..."
                  required
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="leave-management">
        <div className="leave-header-section">
          <h1>Leave Management</h1>
          <button
            className="btn-apply-leave"
            onClick={() => setShowApplyForm(true)}
          >
            + Apply for Leave
          </button>
        </div>

        <div className="leave-tabs">
          <button
            className={`tab-button ${activeTab === "my-leaves" ? "active" : ""}`}
            onClick={() => setActiveTab("my-leaves")}
          >
            My Leaves
          </button>

          {(user?.role === "Team Head" || user?.role === "Admin") && (
            <button
              className={`tab-button ${activeTab === "all-leaves" ? "active" : ""}`}
              onClick={() => setActiveTab("all-leaves")}
            >
              {user?.role === "Admin" ? "All Leaves" : "Team Leaves"}
            </button>
          )}

          <button
            className={`tab-button ${activeTab === "statistics" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("statistics");
              if (!stats) fetchStats();
            }}
          >
            Statistics
          </button>
        </div>

        <div className="filters-section">
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="filter-group">
            <label>From:</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, startDate: e.target.value })
              }
            />
          </div>

          <div className="filter-group">
            <label>To:</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange({ ...dateRange, endDate: e.target.value })
              }
            />
          </div>

          <button
            className="btn-filter"
            onClick={() => {
              if (activeTab === "my-leaves") {
                fetchLeaves();
              } else if (activeTab === "all-leaves") {
                fetchAllLeaves();
              }
            }}
          >
            Apply Filters
          </button>

          <button
            className="btn-clear-filter"
            onClick={() => {
              setFilterStatus("");
              setDateRange({ startDate: "", endDate: "" });
            }}
          >
            Clear
          </button>
        </div>

        {activeTab === "statistics" && (
          <div className="statistics-section">
            <h2>Leave Statistics</h2>

            <div className="stats-filters">
              <div className="filter-group">
                <label>From:</label>
                <input
                  type="date"
                  value={statsDateRange.startDate}
                  onChange={(e) =>
                    setStatsDateRange({
                      ...statsDateRange,
                      startDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="filter-group">
                <label>To:</label>
                <input
                  type="date"
                  value={statsDateRange.endDate}
                  onChange={(e) =>
                    setStatsDateRange({
                      ...statsDateRange,
                      endDate: e.target.value,
                    })
                  }
                />
              </div>

              <button className="btn-filter" onClick={fetchStats}>
                Get Statistics
              </button>
            </div>

            {stats && (
              <div className="stats-display">
                <div className="stat-card">
                  <h3>Total Leave Days</h3>
                  <div className="stat-value">{stats.totalDays}</div>
                </div>

                <div className="stat-card">
                  <h3>Total Leaves</h3>
                  <div className="stat-value">{stats.totalLeaves}</div>
                </div>

                {Object.keys(stats.leavesByType).length > 0 && (
                  <div className="stat-card full-width">
                    <h3>Leaves by Type</h3>
                    <div className="leaves-by-type">
                      {Object.entries(stats.leavesByType).map(
                        ([type, days]) => (
                          <div key={type} className="leave-type-stat">
                            <span className="type-name">{type}:</span>
                            <span className="type-days">{days} days</span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "my-leaves" && (
          <div className="leaves-list">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : leaves.length === 0 ? (
              <div className="no-leaves">No leave applications found</div>
            ) : (
              leaves.map((leave) => renderLeaveCard(leave, false))
            )}
          </div>
        )}

        {activeTab === "all-leaves" && (
          <div className="leaves-list">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : allLeaves.length === 0 ? (
              <div className="no-leaves">No leave applications found</div>
            ) : (
              allLeaves.map((leave) => renderLeaveCard(leave, true))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default LeaveManagement;
