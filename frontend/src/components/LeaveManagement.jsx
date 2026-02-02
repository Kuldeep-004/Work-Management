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

  // Get date 1 month from today
  const getOneMonthLaterDate = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.toISOString().split("T")[0];
  };

  // Date filters default to today and 1 month after
  const [dateRange, setDateRange] = useState({
    startDate: getTodayDate(),
    endDate: getOneMonthLaterDate(),
  });
  const [stats, setStats] = useState(null);
  const [statsDateRange, setStatsDateRange] = useState({
    startDate: getTodayDate(),
    endDate: getOneMonthLaterDate(),
  });
  const printRef = useRef(null);

  // For statistics tab - user selection
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [statsFilterStatus, setStatsFilterStatus] = useState("");
  const [userLeaves, setUserLeaves] = useState([]);
  const [userStats, setUserStats] = useState(null);

  // For rejection popup
  const [showRejectPopup, setShowRejectPopup] = useState(false);
  const [rejectLeaveId, setRejectLeaveId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // For delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deleteLeaveId, setDeleteLeaveId] = useState(null);

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
      activeTab === "approve-leaves" &&
      user &&
      (user.role === "Team Head" || user.role === "Admin")
    ) {
      fetchAllLeaves();
    }
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab === "statistics" && user?.role === "Admin") {
      fetchAllUsers();
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
      // Sort leaves: Pending first, then Rejected, then Approved
      const sortedLeaves = sortLeavesByStatus(response.data.leaves);
      setLeaves(sortedLeaves);
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
      // Sort leaves: Pending first, then Rejected, then Approved
      const sortedLeaves = sortLeavesByStatus(response.data.leaves);
      setAllLeaves(sortedLeaves);
    } catch (error) {
      console.error("Error fetching all leaves:", error);
      toast.error("Failed to fetch leaves");
    } finally {
      setLoading(false);
    }
  };

  const sortLeavesByStatus = (leavesArray) => {
    const statusOrder = { Pending: 0, Rejected: 1, Approved: 2 };
    return [...leavesArray].sort((a, b) => {
      const orderDiff = statusOrder[a.status] - statusOrder[b.status];
      if (orderDiff !== 0) return orderDiff;
      // Secondary sort by applied date (newest first)
      return new Date(b.appliedAt) - new Date(a.appliedAt);
    });
  };

  const fetchAllUsers = async () => {
    if (!user?.token) return;

    try {
      const response = await axios.get(`${API_BASE_URL}/api/analytics/users`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setAllUsers(response.data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to fetch users");
    }
  };

  const fetchUserStatistics = async () => {
    if (!user?.token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();

      if (statsDateRange.startDate)
        params.append("startDate", statsDateRange.startDate);
      if (statsDateRange.endDate)
        params.append("endDate", statsDateRange.endDate);
      if (statsFilterStatus) params.append("status", statsFilterStatus);
      if (selectedUserId) params.append("userId", selectedUserId);

      const response = await axios.get(
        `${API_BASE_URL}/api/leaves/all-leaves?${params}`,
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      let leaves = response.data.leaves;

      if (!selectedUserId && selectedRole !== "all") {
        const usersOfRole = allUsers
          .filter((u) => u.role === selectedRole)
          .map((u) => u._id);
        leaves = leaves.filter((l) => usersOfRole.includes(l.userId?._id));
      }

      // Calculate days instead of leave count
      const totalDays = leaves.reduce(
        (sum, l) => sum + (l.numberOfDays || 0),
        0,
      );
      const pendingDays = leaves
        .filter((l) => l.status === "Pending")
        .reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
      const approvedDays = leaves
        .filter((l) => l.status === "Approved")
        .reduce((sum, l) => sum + (l.numberOfDays || 0), 0);
      const rejectedDays = leaves
        .filter((l) => l.status === "Rejected")
        .reduce((sum, l) => sum + (l.numberOfDays || 0), 0);

      const leavesByType = leaves.reduce((acc, leave) => {
        const days = leave.numberOfDays || 0;
        if (!acc[leave.leaveType]) {
          acc[leave.leaveType] = {
            total: 0,
            approved: 0,
            pending: 0,
            rejected: 0,
          };
        }
        acc[leave.leaveType].total += days;
        if (leave.status === "Approved") acc[leave.leaveType].approved += days;
        if (leave.status === "Pending") acc[leave.leaveType].pending += days;
        if (leave.status === "Rejected") acc[leave.leaveType].rejected += days;
        return acc;
      }, {});

      setUserStats({
        totalDays,
        pendingDays,
        approvedDays,
        rejectedDays,
        leavesByType,
      });

      setUserLeaves(sortLeavesByStatus(leaves));
    } catch (error) {
      console.error("Error fetching user statistics:", error);
      toast.error("Failed to fetch user statistics");
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

  const handleApprove = async (leaveId) => {
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
      toast.error(error.response?.data?.message || "Failed to approve leave");
    } finally {
      setLoading(false);
    }
  };

  const openRejectPopup = (leaveId) => {
    setRejectLeaveId(leaveId);
    setRejectionReason("");
    setShowRejectPopup(true);
  };

  const handleReject = async () => {
    if (!rejectLeaveId) return;

    try {
      setLoading(true);
      await axios.patch(
        `${API_BASE_URL}/api/leaves/${rejectLeaveId}/status`,
        { status: "Rejected", rejectionReason },
        {
          headers: { Authorization: `Bearer ${user.token}` },
        },
      );

      toast.success("Leave rejected successfully!");
      setShowRejectPopup(false);
      setRejectLeaveId(null);
      setRejectionReason("");
      fetchAllLeaves();
      fetchLeaves();
    } catch (error) {
      console.error("Error rejecting leave:", error);
      toast.error(error.response?.data?.message || "Failed to reject leave");
    } finally {
      setLoading(false);
    }
  };

  const openDeletePopup = (leaveId) => {
    setDeleteLeaveId(leaveId);
    setShowDeletePopup(true);
  };

  const handleDeleteLeave = async () => {
    if (!deleteLeaveId) return;

    try {
      setLoading(true);
      await axios.delete(`${API_BASE_URL}/api/leaves/${deleteLeaveId}`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      toast.success("Leave application deleted successfully!");
      setShowDeletePopup(false);
      setDeleteLeaveId(null);
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
        <div class="approval-section approved-section">
          <p><strong>Status:</strong> <span class="approved">APPROVED</span></p>
          <p><strong>Approved By:</strong> ${leave.approverName}</p>
          <p><strong>Approved On:</strong> ${new Date(leave.approvedAt).toLocaleString()}</p>
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
            <div class="signature-name-line"></div>
            <div class="signature-designation">Team Head</div>
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
            .approved-section {
              background: #d1fae5;
              border-color: #059669;
            }
            .signature-box {
              margin-top: 40px;
              margin-left: auto;
              width: 200px;
              text-align: center;
            }
            .signature-name-line {
              border-bottom: 2px solid #000;
              height: 40px;
            }
            .signature-designation {
              font-weight: bold;
              font-size: 14px;
              color: #374151;
              margin-top: 8px;
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
            <div class="company-name">HAACAS Work Management System</div>
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
              <strong>Employee:</strong> {leave.userId?.firstName}{" "}
              {leave.userId?.lastName || leave.userName}
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
              <strong>Rejected On:</strong>{" "}
              {new Date(leave.approvedAt).toLocaleString()}
              {leave.rejectionReason && (
                <>
                  <br />
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
                onClick={() => openRejectPopup(leave._id)}
                disabled={loading}
              >
                ✗ Reject
              </button>
            </>
          )}

          {canDelete && (
            <button
              className="btn-delete"
              onClick={() => openDeletePopup(leave._id)}
              disabled={loading}
            >
              🗑️ Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  const getUsersByRole = (role) => {
    if (role === "all") return allUsers;
    return allUsers.filter((u) => u.role === role);
  };

  const uniqueRoles = [...new Set(allUsers.map((u) => u.role))];

  return (
    <>
      {/* Apply Leave Modal Popup */}
      {showApplyForm && (
        <div className="leave-modal-overlay">
          <div className="leave-modal">
            <div className="leave-modal-header">
              <h2>Apply for Leave</h2>
              <button
                onClick={() => setShowApplyForm(false)}
                className="leave-modal-close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleApplyLeave} className="leave-modal-body">
              <div className="form-group">
                <label>
                  Leave Type <span className="required">*</span>
                </label>
                <select
                  name="leaveType"
                  value={formData.leaveType}
                  onChange={handleInputChange}
                  required
                >
                  {leaveTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Start Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>
                    End Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  Reason <span className="required">*</span>
                </label>
                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Please provide a detailed reason for your leave..."
                  required
                />
              </div>

              <div className="leave-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowApplyForm(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="btn-submit">
                  {loading ? "Submitting..." : "Submit Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Leave Modal Popup */}
      {showRejectPopup && (
        <div className="leave-modal-overlay">
          <div className="leave-modal leave-modal-sm">
            <div className="leave-modal-header">
              <h2>Reject Leave Application</h2>
              <button
                onClick={() => {
                  setShowRejectPopup(false);
                  setRejectLeaveId(null);
                  setRejectionReason("");
                }}
                className="leave-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="leave-modal-body">
              <div className="form-group">
                <label>Rejection Reason (Optional)</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows="4"
                  placeholder="Enter reason for rejection..."
                />
              </div>

              <div className="leave-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowRejectPopup(false);
                    setRejectLeaveId(null);
                    setRejectionReason("");
                  }}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={loading}
                  className="btn-reject-confirm"
                >
                  {loading ? "Rejecting..." : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Leave Confirmation Popup */}
      {showDeletePopup && (
        <div className="leave-modal-overlay">
          <div className="leave-modal leave-modal-sm">
            <div className="leave-modal-header">
              <h2>Delete Leave Application</h2>
              <button
                onClick={() => {
                  setShowDeletePopup(false);
                  setDeleteLeaveId(null);
                }}
                className="leave-modal-close"
              >
                ✕
              </button>
            </div>

            <div className="leave-modal-body">
              <p style={{ marginBottom: "1rem", color: "#666" }}>
                Are you sure you want to delete this leave application? This
                action cannot be undone.
              </p>

              <div className="leave-modal-footer">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeletePopup(false);
                    setDeleteLeaveId(null);
                  }}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteLeave}
                  disabled={loading}
                  className="btn-reject-confirm"
                >
                  {loading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
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
              className={`tab-button ${activeTab === "approve-leaves" ? "active" : ""}`}
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
          )}
        </div>

        {/* Filters for My Leaves and Approve Leaves tabs */}
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
          </div>
        )}

        {/* Statistics Tab - Admin Only */}
        {activeTab === "statistics" && user?.role === "Admin" && (
          <div className="statistics-section">
            <h2>Leave Statistics</h2>

            <div className="stats-filters">
              <div className="filter-group">
                <label>Select Role:</label>
                <select
                  value={selectedRole}
                  onChange={(e) => {
                    setSelectedRole(e.target.value);
                    setSelectedUserId("");
                  }}
                >
                  <option value="all">All Roles</option>
                  {uniqueRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Select User:</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                >
                  <option value="">-- Select User --</option>
                  {getUsersByRole(selectedRole).map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.firstName} {u.lastName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label>Status:</label>
                <select
                  value={statsFilterStatus}
                  onChange={(e) => setStatsFilterStatus(e.target.value)}
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
            </div>

            {userStats && (
              <>
                <div className="stats-display">
                  <div className="stat-card stat-total">
                    <h3>Total Days</h3>
                    <div className="stat-value">{userStats.totalDays}</div>
                  </div>

                  <div className="stat-card stat-pending">
                    <h3>Pending Days</h3>
                    <div className="stat-value">{userStats.pendingDays}</div>
                  </div>

                  <div className="stat-card stat-approved-card">
                    <h3>Approved Days</h3>
                    <div className="stat-value">{userStats.approvedDays}</div>
                  </div>

                  <div className="stat-card stat-rejected-card">
                    <h3>Rejected Days</h3>
                    <div className="stat-value">{userStats.rejectedDays}</div>
                  </div>
                </div>

                {Object.keys(userStats.leavesByType).length > 0 && (
                  <div className="leave-type-stats-section">
                    <h3>Days by Leave Type</h3>
                    <div className="leave-type-stats-grid">
                      {Object.entries(userStats.leavesByType).map(
                        ([type, data]) => (
                          <div key={type} className="leave-type-stat-card">
                            <h4>{type}</h4>
                            <div className="leave-type-stat-details">
                              <span className="stat-item total">
                                Total: {data.total} days
                              </span>
                              <span className="stat-item pending">
                                Pending: {data.pending} days
                              </span>
                              <span className="stat-item approved">
                                Approved: {data.approved} days
                              </span>
                              <span className="stat-item rejected">
                                Rejected: {data.rejected} days
                              </span>
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {userLeaves.length > 0 && (
                  <div className="user-leaves-section">
                    <h3>Leave Applications</h3>
                    <div className="leaves-list">
                      {userLeaves.map((leave) => renderLeaveCard(leave, true))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!userStats &&
              (selectedUserId || selectedRole !== "all") &&
              !loading && (
                <div className="no-leaves">
                  Click "Get Statistics" to view leave data
                </div>
              )}

            {!userStats &&
              !selectedUserId &&
              selectedRole === "all" &&
              !loading && (
                <div className="no-leaves">
                  Click "Get Statistics" to view all users' leave data
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

        {activeTab === "approve-leaves" && (
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
