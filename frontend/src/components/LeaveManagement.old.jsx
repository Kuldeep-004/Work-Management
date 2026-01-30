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
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showApplyForm, setShowApplyForm] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedLeaveForReject, setSelectedLeaveForReject] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [activeTab, setActiveTab] = useState("my-leaves");
  
  // Filters for My Leaves and Approve Leaves tabs
  const [filterStatus, setFilterStatus] = useState("");
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  
  // Statistics tab specific states
  const [selectedUserId, setSelectedUserId] = useState("");
  const [statsStatus, setStatsStatus] = useState("");
  const [statsDateRange, setStatsDateRange] = useState({ startDate: "", endDate: "" });
  const [userStats, setUserStats] = useState(null);
  const [userLeaves, setUserLeaves] = useState([]);
  
  const printRef = useRef(null);

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

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
      if (user.role === "Admin") {
        fetchAllUsers();
      }
    }
  }, [user]);

  useEffect(() => {
    if (
      activeTab === "approve-leaves" &&
      user &&
      (user.role === "Team Head" || user.role === "Admin")
    ) {
      fetchAllLeaves();
    }
  }, [activeTab, user]);

  const fetchAllUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/users`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setAllUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    }
  };

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
      
      // Sort leaves: Pending first, then Rejected, then Approved
      const sortedLeaves = response.data.leaves.sort((a, b) => {
        const statusOrder = { Pending: 0, Rejected: 1, Approved: 2 };
        return statusOrder[a.status] - statusOrder[b.status];
      });
      
      setAllLeaves(sortedLParams();

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
      consoleUserStatistics = async () => {
    if (!user?.token || !selectedUserId) {
      toast.error("Please select a user");
      return;
    }

    try {
      setLoading(true);
      
      // Fetch user statistics
      const statsParams = new URLSearchParams();
      if (statsDateRange.startDate) statsParams.append("startDate", statsDateRange.startDate);
      if (statsDateRange.endDate) statsParams.append("endDate", statsDateRange.endDate);
      
      const statsResponse = await axios.get(
        `${API_BASE_URL}/api/leaves/stats/${selectedUserId}?${statsParams}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );
      
      // Fetch all leaves for the selected user with filters
      const leavesParams = new URLSearchParams();
      leavesParams.append("userId", selectedUserId);
      if (statsStatus) leavesParams.append("status", statsStatus);
      if (statsDateRange.startDate) leavesParams.append("startDate", statsDateRange.startDate);
      if (statsDateRange.endDate) leavesParams.append("endDate", statsDateRange.endDate);
      
      const leavesResponse = await axios.get(
        `${API_BASE_URL}/api/leaves/all-leaves?${leavesParams}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );
      
      setUserStats(statsResponse.data);
      setUserLeaves(leavesResponse.data.leaves);
    } catch (error) {
      console.error("Error fetching user statistics:", error);
      toast.error("Failed to fetch user statistics");
    } finally {
      setLoading(false
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
      await axios.pos = async (leaveId) => {
    try {
      setLoading(true);
      await axios.patch(
        `${API_BASE_URL}/api/leaves/${leaveId}/status`,
        { status: "Approved" },
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      toast.success("Leave approved successfully!");
      fetchAllLeaves();
      fetchLeaves();
    } catch (error) {
      console.error("Error approving leave:", error);
      toast.error(
        error.response?.data?.message || "Failed to approve leave",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClick = (leave) => {
    setSelectedLeaveForReject(leave);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const handleRejectSubmit = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    try {
      setLoading(true);
      await axios.patch(
        `${API_BASE_URL}/api/leaves/${selectedLeaveForReject._id}/status`,
        { status: "Rejected", rejectionReason },
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      toast.success("Leave rejected successfully!");
      setShowRejectModal(false);
      setSelectedLeaveForReject(null);
      setRejectionReason("");
      fetchAllLeaves();
      fetchLeaves();
    } catch (error) {
      console.error("Error rejecting leave:", error);
      toast.error(
        error.response?.data?.message || "Failed to reject leave
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

    setTimeout(() => {Name || leave.userId?.firstName + ' ' + leave.userId?.lastName}
            </div>
          )}
          {showActions && leave.userId?.email && (
            <div className="leave-detail">
              <strong>Email:</strong> {leave.userId.email}
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
                onClick={() => handleApprove(leave._id)}
                disabled={loading}
              >
                ✓ Approve
              </button>
              <button
                className="btn-reject"
                onClick={() => handleRejectClick(leave)>
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
          Reject Leave Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Reject Leave Application</h2>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedLeaveForReject(null);
                  setRejectionReason("");
                }}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            {selectedLeaveForReject && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Employee:</strong> {selectedLeaveForReject.userName}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Leave Type:</strong> {selectedLeaveForReject.leaveType}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Duration:</strong> {new Date(selectedLeaveForReject.startDate).toLocaleDateString()} - {new Date(selectedLeaveForReject.endDate).toLocaleDateString()}
                </p>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows="4"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Please provide a reason for rejecting this leave application..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedLeaveForReject(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectSubmit}
                disabled={loading || !rejectionReason.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? "Rejecting..." : "Reject Leave"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* </button>

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
                  <label className="block text-sm font-pprove-leaves" ? "active" : ""}`}
              onClick={() => setActiveTab("approve-leaves")}
            >
              Approve Leaves
            </button>
          )}

          {user?.role === "Admin" && (
            <button
              className={`tab-button ${activeTab === "statistics" ? "active" : ""}`}
              onClick={() => setActiveTab("statistics")}
            >
              Statistics
            </button>
          )}bel className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
        {(activeTab === "my-leaves" || activeTab === "approve-leaves") && (
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
                } else if (activeTab === "approve-leaves") {
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
        )}assName={`tab-button ${activeTab === "statistics" ? "active" : ""}`}
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
user?.role === "Admin" && (
          <div className="statistics-section">
            <h2 className="text-2xl font-bold mb-6">Leave Statistics</h2>

            <div className="stats-filters">
              <div className="filter-group">
                <label>Select User:</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full border rounded-md px-3 py-2"
                >
                  <option value="">-- Select User --</option>
                  {allUsers.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Status:</label>
                <select
                  value={statsStatus}
                  onChange={(e) => setStatsStatus(e.target.value)}
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

              <button className="btn-filter" onClick={fetchUserStatistics}>
                Get Statistics
              </button>

              <button
                className="btn-clear-filter"
                onClick={() => {
                  setSelectedUserId("");
                  setStatsStatus("");
                  setStatsDateRange({ startDate: "", endDate: "" });
                  setUserStats(null);
                  setUserLeaves([]);
                }}
              >
                Clear
              </button>
            </div>

            {userStats && (
              <>
                <div claspproveame="stats-display">
                  <div className="stat-card">
                    <h3>Total Approved Days</h3>
                    <div className="stat-value">{userStats.totalDays}</div>
                  </div>

                  <div className="stat-card">
                    <h3>Total Approved Leaves</h3>
                    <div className="stat-value">{userStats.totalLeaves}</div>
                  </div>

                  {Object.keys(userStats.leavesByType).length > 0 && (
                    <div className="stat-card full-width">
                      <h3>Approved Leaves by Type</h3>
                      <div className="leaves-by-type">
                        {Object.entries(userStats.leavesByType).map(
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

                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4">All Leave Applications</h3>
                  {loading ? (
                    <div className="loading">Loading...</div>
                  ) : userLeaves.length === 0 ? (
                    <div className="no-leaves">No leave applications found for this user</div>
                  ) : (
                    <div className="leaves-list">
                      {userLeaves.map((leave) => renderLeaveCard(leave, true))}
                    </div>
                  )}
                </div>
              </
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
