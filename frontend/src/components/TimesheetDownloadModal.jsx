import React, { useState, useRef, useEffect } from "react";
import { XMarkIcon, UserIcon, CalendarIcon } from "@heroicons/react/24/outline";
import { toast } from "react-hot-toast";
import { API_BASE_URL } from "../apiConfig";
import generateTimesheetPdf from "../utils/generateTimesheetPdf";

const TimesheetDownloadModal = ({
  isOpen,
  onClose,
  subordinates = [],
  user,
  pdfFontSize = 12,
}) => {
  const [selectedUser, setSelectedUser] = useState("");
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to 7 days ago
    return date.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split("T")[0];
  });
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const dropdownRef = useRef(null);

  // Filtered subordinates for search
  const filteredSubordinates = subordinates.filter((sub) => {
    if (!searchTerm) return true;
    const name = `${sub.firstName || ""} ${sub.lastName || ""}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserDropdown(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  const getSelectedUserDisplayName = () => {
    if (!selectedUser) return "All Users";
    const sub = subordinates.find((s) => s._id === selectedUser);
    return sub
      ? `${sub.firstName} ${sub.lastName} (${sub.role})`
      : "Select User";
  };

  const handleUserSelect = (userId) => {
    setSelectedUser(userId);
    setShowUserDropdown(false);
  };

  const downloadTimesheets = async () => {
    try {
      // Validate dates
      if (!fromDate || !toDate) {
        toast.error("Please select both from and to dates");
        return;
      }

      if (fromDate > toDate) {
        toast.error("From date cannot be after to date");
        return;
      }

      setIsDownloading(true);

      // Build query parameters
      let url = `${API_BASE_URL}/api/timesheets/subordinates?startDate=${fromDate}&endDate=${toDate}&limit=1000`;

      if (selectedUser) {
        url += `&userId=${selectedUser}`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch timesheets");

      const data = await res.json();
      let timesheetsArr = Array.isArray(data.timesheets) ? data.timesheets : [];

      // Only keep timesheets with at least one entry
      timesheetsArr = timesheetsArr.filter(
        (ts) => Array.isArray(ts.entries) && ts.entries.length > 0,
      );

      if (timesheetsArr.length === 0) {
        toast.error("No timesheets found for the selected period");
        setIsDownloading(false);
        return;
      }

      // Generate PDF with date range in label
      const dateRangeLabel =
        fromDate === toDate ? fromDate : `${fromDate}_to_${toDate}`;

      const userLabel = (() => {
        if (selectedUser && timesheetsArr[0]?.user) {
          const u = timesheetsArr[0].user;
          return (
            `${u.firstName || ""}_${u.lastName || ""}`.trim() || "timesheet"
          );
        }
        return "timesheets";
      })();

      const fileLabel = `${userLabel}_${dateRangeLabel}`;

      generateTimesheetPdf({
        dateStr: `${fromDate} to ${toDate}`,
        timesheets: timesheetsArr,
        fileLabel,
        fontSize: pdfFontSize,
      });

      toast.success(`Downloaded ${timesheetsArr.length} timesheet(s)`);
      onClose();
    } catch (error) {
      console.error("Error downloading timesheets:", error);
      toast.error("Failed to download timesheets");
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full mx-auto transform transition-all duration-200 scale-100">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Download Timesheets
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Select User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UserIcon className="w-4 h-4 inline mr-1" />
              Select User
            </label>
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-left bg-white flex items-center justify-between"
              >
                <span>{getSelectedUserDisplayName()}</span>
                <svg
                  className="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showUserDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {/* Search input inside dropdown */}
                  <div className="px-3 py-2 sticky top-0 bg-white z-10">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search user..."
                      className="w-full px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>
                  <div
                    onClick={() => handleUserSelect("")}
                    className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                  >
                    All Users
                  </div>
                  {filteredSubordinates.map((sub) => (
                    <div
                      key={sub._id}
                      onClick={() => handleUserSelect(sub._id)}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                    >
                      {sub.firstName} {sub.lastName} ({sub.role})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 rounded-b-xl border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={isDownloading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={downloadTimesheets}
            disabled={isDownloading}
            className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Downloading...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="w-4 h-4"
                >
                  <path d="M12 16a1 1 0 0 1-.707-.293l-4-4 1.414-1.414L11 12.586V3h2v9.586l2.293-2.293 1.414 1.414-4 4A1 1 0 0 1 12 16z" />
                  <path d="M5 19h14v2H5z" />
                </svg>
                Download PDF
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimesheetDownloadModal;
