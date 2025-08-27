import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-hot-toast';
import { 
  CalendarIcon, 
  UserIcon, 
  ClockIcon, 
  EyeIcon
} from '@heroicons/react/24/outline';
import { API_BASE_URL } from '../../apiConfig';
import generateTimesheetPdf from '../../utils/generateTimesheetPdf';


const SubordinateTimesheets = () => {
  const { user, isAuthenticated } = useAuth();
  const [timesheets, setTimesheets] = useState([]);
  const [groupedTimesheets, setGroupedTimesheets] = useState({});
  const [subordinates, setSubordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [showTimesheetDetail, setShowTimesheetDetail] = useState(false);
  // Search bar state
  const [searchTerm, setSearchTerm] = useState('');

  // Filtered subordinates for search
  const filteredSubordinates = subordinates.filter(sub => {
    if (!searchTerm) return true;
    const name = `${sub.firstName || ''} ${sub.lastName || ''}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Filter timesheets by search term (if multiple subordinates)
  const filteredTimesheets = timesheets.filter(ts => {
    if (!searchTerm || subordinates.length <= 1) return true;
    const name = `${ts.user?.firstName || ''} ${ts.user?.lastName || ''}`.toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  // Group filtered timesheets by date
  const filteredGroupedTimesheets = filteredTimesheets.reduce((acc, ts) => {
    const date = new Date(ts.date).toDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(ts);
    return acc;
  }, {});

  const onDownloadPdf = () => {
    try {
      if (!timesheets || timesheets.length === 0) {
        toast.error('Nothing to download');
        return;
      }
      const label = (() => {
        if (selectedUser && timesheets[0]?.user) {
          const u = timesheets[0].user;
          return `${u.firstName || ''}_${u.lastName || ''}`.trim() || 'timesheet';
        }
        return 'timesheets';
      })();
      generateTimesheetPdf({ dateStr: selectedDate, timesheets, fileLabel: label });
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };

  useEffect(() => {
    if (isAuthenticated() && user) {
      fetchSubordinates();
    }
  }, [user, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated() && user) {
      fetchTimesheets(1); // Reset to page 1 on filter change
    }
  }, [user, isAuthenticated, selectedUser, selectedDate]);

  const fetchSubordinates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheets/subordinates-list`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch subordinates');
      const data = await res.json();
      setSubordinates(data);
    } catch (error) {
      toast.error('Failed to fetch subordinates');
    }
  };

  const fetchTimesheets = async (page = 1) => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/api/timesheets/subordinates?page=${page}&limit=20`;
      if (selectedUser) url += `&userId=${selectedUser}`;
      if (selectedDate) url += `&startDate=${selectedDate}&endDate=${selectedDate}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch timesheets');
      const data = await res.json();
      let timesheetsArr = Array.isArray(data.timesheets) ? data.timesheets : [];

      // Show only submitted timesheets (isCompleted === true)
      timesheetsArr = timesheetsArr.filter(ts => ts && ts.isCompleted);

      // If Team Head, All Users selected, fetch own timesheet using /date/:date endpoint
      // Include own timesheet only if it's submitted
      if (user.role === 'Team Head' && !selectedUser) {
        let ownUrl = `${API_BASE_URL}/api/timesheets/date/${selectedDate}`;
        const ownRes = await fetch(ownUrl, {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        if (ownRes.ok) {
          const ownData = await ownRes.json();
          if (ownData && ownData.user && ownData.isCompleted) {
            // Remove any duplicate of own timesheet (by user._id) and prepend own
            timesheetsArr = [ownData, ...timesheetsArr.filter(ts => ts.user && ts.user._id !== user._id)];
          }
        }
      }

      setTimesheets(timesheetsArr);
      const grouped = timesheetsArr.reduce((acc, ts) => {
        const date = new Date(ts.date).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(ts);
        return acc;
      }, {});
      setGroupedTimesheets(grouped);
      setCurrentPage(data.currentPage);
      setTotalPages(data.totalPages);
    } catch (error) {
      toast.error('Failed to fetch timesheets');
    } finally {
      setLoading(false);
    }
  };

  const viewTimesheetDetail = async (timesheet) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheets/subordinate/${timesheet.user._id}/${timesheet.date}`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch timesheet details');
      
      const data = await res.json();
      setSelectedTimesheet(data);
      setShowTimesheetDetail(true);
    } catch (error) {
      toast.error('Failed to fetch timesheet details');
    }
  };

  const formatTime = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'Admin': return 'bg-red-100 text-red-800';
      case 'Senior': return 'bg-purple-100 text-purple-800'; // swapped
      case 'Team Head': return 'bg-blue-100 text-blue-800'; // swapped
      case 'Fresher': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getHierarchyInfo = () => {
    switch (user.role) {
      case 'Admin':
        return 'Viewing all users\' timesheets';
      case 'Senior':
        return 'Viewing Senior\'s timesheets'; // swapped
      case 'Team Head':
        return 'Viewing Team Head\'s timesheets'; // swapped
      default:
        return 'No access to subordinate timesheets';
    }
  };

  // Helper to get minutes between two time strings (24-hour format)
  function getMinutesBetween(start, end) {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startM = sh * 60 + sm;
    let endM = eh * 60 + em;
    if (endM < startM) endM += 24 * 60;
    return endM - startM;
  }

  // Add approve/reject handlers
  const handleApproveEntry = async (entryId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheets/entry/${entryId}/approve`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Failed to approve entry');
      // Update only the relevant entry in state
      setTimesheets(prev => prev.map(ts => ({
        ...ts,
        entries: ts.entries.map(e => e._id === entryId ? { ...e, approvalStatus: 'accepted' } : e)
      })));
      setGroupedTimesheets(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(ts => ({
            ...ts,
            entries: ts.entries.map(e => e._id === entryId ? { ...e, approvalStatus: 'accepted' } : e)
          }));
        });
        return updated;
      });
    } catch (error) {
      toast.error('Failed to approve entry');
    }
  };
  const handleRejectEntry = async (entryId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheets/entry/${entryId}/reject`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Failed to reject entry');
      // Update only the relevant entry in state
      setTimesheets(prev => prev.map(ts => ({
        ...ts,
        entries: ts.entries.map(e => e._id === entryId ? { ...e, approvalStatus: 'rejected' } : e)
      })));
      setGroupedTimesheets(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].map(ts => ({
            ...ts,
            entries: ts.entries.map(e => e._id === entryId ? { ...e, approvalStatus: 'rejected' } : e)
          }));
        });
        return updated;
      });
    } catch (error) {
      toast.error('Failed to reject entry');
    }
  };

  const handleReturnTimesheet = async (timesheetId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/timesheets/${timesheetId}/return`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      if (!res.ok) throw new Error('Failed to return timesheet');
      
      // Remove the returned timesheet from the list since it's no longer submitted
      setTimesheets(prev => prev.filter(ts => ts._id !== timesheetId));
      setGroupedTimesheets(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(date => {
          updated[date] = updated[date].filter(ts => ts._id !== timesheetId);
          // Remove empty dates
          if (updated[date].length === 0) {
            delete updated[date];
          }
        });
        return updated;
      });
      
      toast.success('Timesheet returned for editing');
    } catch (error) {
      toast.error('Failed to return timesheet');
    }
  };

  if (!isAuthenticated()) {
    return <div className="p-8 text-center">Please log in to view this page.</div>;
  }

  if (user.role === 'Fresher' && !(Array.isArray(user.role2) ? user.role2.includes('TimeSheet Verifier') : user.role2 === 'TimeSheet Verifier')) {
    return (
      <div className="p-8 text-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Access Restricted</h2>
          <p className="text-yellow-700">You don't have permission to view subordinate timesheets.</p>
        </div>
      </div>
    );
  }
  if (!(user.role === 'Admin' || user.role === 'Senior' || user.role === 'Team Head' || (Array.isArray(user.role2) ? user.role2.includes('TimeSheet Verifier') : user.role2 === 'TimeSheet Verifier'))) { // swapped
    return (
      <div className="p-8 text-center">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">Access Restricted</h2>
          <p className="text-yellow-700">You don't have permission to view subordinate timesheets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">Subordinate Timesheets</h1>
        <p className="text-sm sm:text-base text-gray-600">{getHierarchyInfo()}</p>
      </div>


      {/* Filters + Search Bar */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <UserIcon className="w-4 h-4 inline mr-1" />
              Select User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Users</option>
              {(() => {
                // TimeSheet Verifiers, Team Heads, and Admins: show subordinates as returned by backend
                return subordinates.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.firstName} {sub.lastName} ({sub.role})
                  </option>
                ));
              })()}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <CalendarIcon className="w-4 h-4 inline mr-1" />
              Select Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Search bar: only show if more than 1 subordinate */}
          {subordinates.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <UserIcon className="w-4 h-4 inline mr-1" />
                Search User
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Type to search by name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}

          <div className="flex md:justify-end">
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={loading || timesheets.length === 0}
              className="mt-6 md:mt-0 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M12 16a1 1 0 0 1-.707-.293l-4-4 1.414-1.414L11 12.586V3h2v9.586l2.293-2.293 1.414 1.414-4 4A1 1 0 0 1 12 16z"/><path d="M5 19h14v2H5z"/></svg>
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Timesheets List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading timesheets...</p>
        </div>
      ) : filteredTimesheets.length === 0 ? (
        <div className="text-center py-8">
          <div className="bg-gray-50 rounded-lg p-8">
            <ClockIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No timesheets found</h3>
            <p className="text-gray-600">Try adjusting your filters, date range, or search.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(filteredGroupedTimesheets).map(([date, sheets]) => (
            <div key={date} className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">{formatDate(date)}</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {sheets.map((timesheet) => (
                  <div key={timesheet._id} className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {timesheet.user.photo?.url ? (
                            <img 
                              src={timesheet.user.photo.url} 
                              alt={`${timesheet.user.firstName} ${timesheet.user.lastName}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg font-medium text-blue-600">
                              {timesheet.user.firstName?.[0]}{timesheet.user.lastName?.[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {timesheet.user.firstName} {timesheet.user.lastName}
                          </h3>
                          <p className="text-sm text-gray-600">{timesheet.user.email}</p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full self-center ${getRoleColor(timesheet.user.role)}`}>
                          {timesheet.user.role}
                        </span>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-600">Total Time</p>
                        <p className="text-xl font-bold text-blue-600">{
                          formatTime(timesheet.entries
                            .filter(entry => entry.approvalStatus === 'pending' || entry.approvalStatus === 'accepted')
                            .reduce((sum, entry) => sum + getMinutesBetween(entry.startTime, entry.endTime), 0)
                          )
                        }</p>
                        <button
                          onClick={() => handleReturnTimesheet(timesheet._id)}
                          className="mt-2 bg-orange-500 text-white px-3 py-1 rounded-lg hover:bg-orange-600 text-sm font-medium"
                          title="Return timesheet for editing"
                        >
                          Return
                        </button>
                      </div>
                    </div>

                    <div className="overflow-x-auto w-full">
                      <table className="min-w-full divide-y divide-gray-200 border">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timeslot</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task Name</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Spent</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {timesheet.entries.length === 0 ? (
                            <tr><td colSpan="5" className="text-center text-gray-400 py-3">No Entries</td></tr>
                          ) : (
                            [...timesheet.entries]
                              .sort((a, b) => {
                                // Sort by start time (earliest to latest)
                                if (!a.startTime || !b.startTime) return 0;
                                const [aHour, aMin] = a.startTime.split(':').map(Number);
                                const [bHour, bMin] = b.startTime.split(':').map(Number);
                                const aTime = aHour * 60 + aMin;
                                const bTime = bHour * 60 + bMin;
                                return aTime - bTime;
                              })
                              .map((entry, idx) => {
                              let statusColor = '';
                              if (entry.approvalStatus === 'accepted') statusColor = 'text-green-600 font-semibold';
                              else if (entry.approvalStatus === 'rejected') statusColor = 'text-red-600 font-semibold';
                              else statusColor = 'text-gray-700';
                              return (
                                <tr key={entry._id || idx} className="cursor-pointer group" onClick={() => handleApproveEntry(entry._id)}>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-800">
                                    {entry.startTime && entry.endTime ? `${entry.startTime} - ${entry.endTime}` : 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{entry.task ? entry.task.title : (entry.manualTaskName || 'N/A')}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700 break-words min-w-[200px] max-w-[400px]" style={{ whiteSpace: 'pre-wrap' }}>{entry.workDescription || 'N/A'}</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700 font-medium">{formatTime(getMinutesBetween(entry.startTime, entry.endTime))}</td>
                                  <td className={`px-4 py-3 whitespace-nowrap text-sm ${statusColor}`}>{
                                    entry.approvalStatus === 'accepted' ? 'Accepted' : entry.approvalStatus === 'rejected' ? 'Rejected' : 'Pending'
                                  }</td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                                    {entry.approvalStatus !== 'rejected' && (
                                      <button
                                        className="text-red-500 hover:text-red-700 font-semibold"
                                        onClick={e => { e.stopPropagation(); handleRejectEntry(entry._id); }}
                                      >
                                        Reject
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <nav className="flex space-x-2">
            <button
              onClick={() => fetchTimesheets(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => fetchTimesheets(page)}
                className={`px-3 py-2 border rounded-md text-sm font-medium ${
                  currentPage === page
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {page}
              </button>
            ))}
            
            <button
              onClick={() => fetchTimesheets(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </nav>
        </div>
      )}

      {/* Timesheet Detail Modal */}
      {showTimesheetDetail && selectedTimesheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">
                  Timesheet Details - {selectedTimesheet.user.firstName} {selectedTimesheet.user.lastName}
                </h2>
                <button
                  onClick={() => setShowTimesheetDetail(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-gray-600 mt-1">{formatDate(selectedTimesheet.date)}</p>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...selectedTimesheet.entries]
                  .sort((a, b) => {
                    // Sort by start time (earliest to latest)
                    if (!a.startTime || !b.startTime) return 0;
                    const [aHour, aMin] = a.startTime.split(':').map(Number);
                    const [bHour, bMin] = b.startTime.split(':').map(Number);
                    const aTime = aHour * 60 + aMin;
                    const bTime = bHour * 60 + bMin;
                    return aTime - bTime;
                  })
                  .map((entry, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h4 className="font-medium text-gray-900">
                        {entry.task ? entry.task.title : entry.manualTaskName || 'Manual Task'}
                      </h4>
                      <span className="text-sm font-medium text-blue-600">
                        {formatTime(getMinutesBetween(entry.startTime, entry.endTime))}
                      </span>
                    </div>
                    
                    {entry.workDescription && (
                      <p className="text-sm text-gray-600 mb-3" style={{ whiteSpace: 'pre-wrap' }}>
                        {entry.workDescription}
                      </p>
                    )}
                    
                    {entry.task && (
                      <div className="space-y-1 text-xs text-gray-500">
                        <p><strong>Client:</strong> {entry.task.clientName}</p>
                        <p><strong>Work Type:</strong> {entry.task.workType}</p>
                        {entry.task.clientGroup && (
                          <p><strong>Client Group:</strong> {entry.task.clientGroup}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900">Total Time Spent</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatTime(selectedTimesheet.entries.reduce((sum, entry) => sum + getMinutesBetween(entry.startTime, entry.endTime), 0))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubordinateTimesheets; 