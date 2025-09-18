import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';
import avatarImage from '../assets/avatar.jpg';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut, Pie } from 'react-chartjs-2';
import { format, parseISO, differenceInDays } from 'date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const UserAnalytics = ({ userId, userName, onClose }) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  // Set default date range (last 30 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    setDateRange({
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    });
  }, []);

  const fetchAnalytics = async () => {
    if (!userId || !dateRange.startDate || !dateRange.endDate) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/analytics/user/${userId}?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
        {
          headers: { Authorization: `Bearer ${user.token}` }
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [userId, dateRange.startDate, dateRange.endDate]);

  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTimeDecimal = (minutes) => {
    return (minutes / 60).toFixed(1);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-100 bg-opacity-95 flex items-center justify-center z-50">
        <div className="bg-white shadow-lg border border-gray-200 p-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin border-4 border-indigo-200 border-t-indigo-600 h-8 w-8"></div>
            <span className="text-lg font-medium text-gray-700">Loading analytics...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  // Chart configurations
  const timeBreakdownData = {
    labels: ['Task Hours', 'Permission', 'Lunch', 'Billing', 'Other', 'Infrastructure', 'Discussion w/ Vivek'],
    datasets: [{
      label: 'Hours',
      data: [
        analytics.summary.taskHours / 60,
        analytics.summary.permissionHours / 60,
        analytics.summary.lunchHours / 60,
        analytics.summary.billingHours / 60,
        analytics.summary.otherHours / 60,
        (analytics.summary.infrastructureHours || 0) / 60,
        (analytics.summary.discussionWithVivekHours || 0) / 60
      ],
      backgroundColor: [
        '#10B981', // Task Hours - Green
        '#EF4444', // Permission - Red
        '#F59E0B', // Lunch - Yellow
        '#3B82F6', // Billing - Blue
        '#8B5CF6', // Other - Purple
        '#6366F1', // Infrastructure - Indigo
        '#10D9B4'  // Discussion with Vivek - Emerald
      ],
      borderWidth: 0
    }]
  };

  const dailyTrendData = {
    labels: analytics.dailyBreakdown.map(day => format(parseISO(day.date), 'MMM dd')),
    datasets: [{
      label: 'Working Hours',
      data: analytics.dailyBreakdown.map(day => day.workingHours / 60),
      borderColor: '#10B981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      tension: 0.4
    }, {
      label: 'Permission Hours',
      data: analytics.dailyBreakdown.map(day => day.permissionHours / 60),
      borderColor: '#EF4444',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      fill: false,
      tension: 0.4
    }]
  };

  const taskBreakdownData = {
    labels: analytics.taskBreakdown.slice(0, 8).map(task => 
      task.task?.title?.substring(0, 20) + (task.task?.title?.length > 20 ? '...' : '') || 'Unknown Task'
    ),
    datasets: [{
      data: analytics.taskBreakdown.slice(0, 8).map(task => task.totalMinutes / 60),
      backgroundColor: [
        '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
        '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'
      ],
      borderWidth: 0
    }]
  };

  const weeklyTrendData = {
    labels: analytics.weeklyTrend.map(week => week.week),
    datasets: [{
      label: 'Weekly Hours',
      data: analytics.weeklyTrend.map(week => week.totalHours / 60),
      backgroundColor: '#3B82F6',
      borderColor: '#2563EB',
      borderWidth: 1
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: window.innerWidth < 640 ? 10 : 15,
          font: { size: window.innerWidth < 640 ? 10 : 12 },
          usePointStyle: true,
          boxWidth: window.innerWidth < 640 ? 10 : 12
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}h`;
          }
        },
        titleFont: { size: window.innerWidth < 640 ? 12 : 14 },
        bodyFont: { size: window.innerWidth < 640 ? 11 : 13 }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            return value + 'h';
          },
          font: { size: window.innerWidth < 640 ? 10 : 12 }
        }
      },
      x: {
        ticks: {
          font: { size: window.innerWidth < 640 ? 10 : 12 },
          maxRotation: window.innerWidth < 640 ? 45 : 0
        }
      }
    }
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: window.innerWidth < 640 ? 'bottom' : 'right',
        labels: {
          padding: window.innerWidth < 640 ? 10 : 20,
          font: { size: window.innerWidth < 640 ? 10 : 11 },
          usePointStyle: true,
          boxWidth: window.innerWidth < 640 ? 10 : 12
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const value = context.parsed;
            return `${context.label}: ${value.toFixed(1)}h`;
          }
        },
        titleFont: { size: window.innerWidth < 640 ? 12 : 14 },
        bodyFont: { size: window.innerWidth < 640 ? 11 : 13 }
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/25 bg-opacity-95 flex items-center justify-center z-50 p-2 sm:p-6">
      <div className="bg-white shadow-2xl w-full h-full sm:w-[95vw] sm:h-[90vh] sm:max-w-7xl overflow-hidden border border-gray-200 sm:rounded-lg">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-3 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            <div className="flex items-center space-x-3 sm:space-x-4">
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-gray-200 shadow-sm flex-shrink-0">
                <img 
                  src={analytics.user.photo?.url || avatarImage} 
                  alt={analytics.user.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = avatarImage;
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-2xl font-bold text-gray-900 mb-1 truncate">{analytics.user.name}</h2>
                <p className="text-gray-600 text-sm sm:text-base font-medium truncate">{analytics.user.role}</p>
                <p className="text-gray-500 text-xs sm:text-sm truncate">{analytics.user.email}</p>
                <p className="text-gray-400 text-xs mt-1 truncate">Team: {analytics.user.team || 'Not assigned'}</p>
              </div>
            </div>
            
            {/* Date Range Selector - Mobile optimized */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-6 bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">From:</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="bg-white text-gray-800 border border-gray-300 rounded px-2 sm:px-3 py-1 sm:py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 min-w-0"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">To:</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="bg-white text-gray-800 border border-gray-300 rounded px-2 sm:px-3 py-1 sm:py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex-1 min-w-0"
                  />
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="bg-red-500 hover:bg-red-600 p-2 sm:p-2 rounded transition-all duration-200 border border-red-400 hover:border-red-500 self-end sm:self-auto"
                title="Close"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto p-3 sm:p-6 bg-gray-50">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-4 sm:mb-6">

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 sm:p-4 border-l-4 border-green-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-green-700 text-xs font-semibold uppercase tracking-wide">TOTAL WORKING</div>
                  <div className="text-xl sm:text-2xl font-bold text-green-900 mt-1">{formatTime(analytics.summary.totalWorkingHours)}</div>
                  <div className="text-green-600 text-xs mt-1">{formatTimeDecimal(analytics.summary.totalWorkingHours)}h decimal</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-3 sm:p-4 border-l-4 border-indigo-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-indigo-700 text-xs font-semibold uppercase tracking-wide">TOTAL SALARY</div>
                  <div className="text-xl sm:text-2xl font-bold text-indigo-900 mt-1">₹{analytics.summary.totalSalary ? analytics.summary.totalSalary.toFixed(2) : '0.00'}</div>
                  <div className="text-indigo-600 text-xs mt-1">for selected period</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-3 sm:p-4 border-l-4 border-teal-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-teal-700 text-xs font-semibold uppercase tracking-wide">TASK HOURS</div>
                  <div className="text-xl sm:text-2xl font-bold text-teal-900 mt-1">{formatTime(analytics.summary.taskHours)}</div>
                  <div className="text-teal-600 text-xs mt-1">{formatTimeDecimal(analytics.summary.taskHours)}h decimal</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-teal-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 p-3 sm:p-4 border-l-4 border-red-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-red-700 text-xs font-semibold uppercase tracking-wide">PERMISSION</div>
                  <div className="text-xl sm:text-2xl font-bold text-red-900 mt-1">{formatTime(analytics.summary.permissionHours)}</div>
                  <div className="text-red-600 text-xs mt-1">{formatTimeDecimal(analytics.summary.permissionHours)}h decimal</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-3 sm:p-4 border-l-4 border-yellow-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-yellow-700 text-xs font-semibold uppercase tracking-wide">LUNCH BREAK</div>
                  <div className="text-xl sm:text-2xl font-bold text-yellow-900 mt-1">{formatTime(analytics.summary.lunchHours)}</div>
                  <div className="text-yellow-600 text-xs mt-1">{formatTimeDecimal(analytics.summary.lunchHours)}h decimal</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 sm:p-4 border-l-4 border-blue-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-blue-700 text-xs font-semibold uppercase tracking-wide">BILLING</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-900 mt-1">{formatTime(analytics.summary.billingHours)}</div>
                  <div className="text-blue-600 text-xs mt-1">{formatTimeDecimal(analytics.summary.billingHours)}h decimal</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 sm:p-4 border-l-4 border-purple-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-purple-700 text-xs font-semibold uppercase tracking-wide">OTHER</div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-900 mt-1">{formatTime(analytics.summary.otherHours)}</div>
                  <div className="text-purple-600 text-xs mt-1">{formatTimeDecimal(analytics.summary.otherHours)}h decimal</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-3 sm:p-4 border-l-4 border-indigo-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-indigo-700 text-xs font-semibold uppercase tracking-wide">INFRASTRUCTURE</div>
                  <div className="text-xl sm:text-2xl font-bold text-indigo-900 mt-1">{formatTime(analytics.summary.infrastructureHours || 0)}</div>
                  <div className="text-indigo-600 text-xs mt-1">{formatTimeDecimal(analytics.summary.infrastructureHours || 0)}h decimal</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-3 sm:p-4 border-l-4 border-emerald-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-emerald-700 text-xs font-semibold uppercase tracking-wide">DISCUSSION WITH VIVEK</div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-900 mt-1">{formatTime(analytics.summary.discussionWithVivekHours || 0)}</div>
                  <div className="text-emerald-600 text-xs mt-1">{formatTimeDecimal(analytics.summary.discussionWithVivekHours || 0)}h decimal</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-emerald-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-3 sm:p-4 border-l-4 border-pink-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-pink-700 text-xs font-semibold uppercase tracking-wide">AVG DAILY</div>
                  <div className="text-xl sm:text-2xl font-bold text-pink-900 mt-1">{formatTimeDecimal(analytics.productivity.averageDailyHours)}h</div>
                  <div className="text-pink-600 text-xs mt-1">per timesheet day</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-pink-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 sm:p-4 border-l-4 border-orange-500 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-orange-700 text-xs font-semibold uppercase tracking-wide">HOURLY RATE</div>
                  <div className="text-xl sm:text-2xl font-bold text-orange-900 mt-1">₹{analytics.user.hourlyRate || 0}</div>
                  <div className="text-orange-600 text-xs mt-1">per hour</div>
                </div>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 flex items-center justify-center rounded flex-shrink-0">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
            {/* Time Breakdown Chart */}
            <div className="bg-white shadow-lg border border-gray-200 p-4 sm:p-5 rounded-lg">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center border-b border-gray-200 pb-2">
                <div className="w-1 h-4 sm:h-6 bg-green-500 mr-2 sm:mr-3"></div>
                <span className="truncate">Time Distribution</span>
              </h3>
              <div className="h-48 sm:h-64">
                <Doughnut 
                  data={timeBreakdownData} 
                  options={{
                    ...pieOptions,
                    plugins: {
                      ...pieOptions.plugins,
                      legend: {
                        position: window.innerWidth < 640 ? 'bottom' : 'right',
                        labels: {
                          padding: window.innerWidth < 640 ? 10 : 20,
                          font: { size: window.innerWidth < 640 ? 10 : 11 }
                        }
                      },
                      title: {
                        display: true,
                        text: 'Task vs. Other Time Categories',
                        font: {
                          size: window.innerWidth < 640 ? 14 : 16
                        }
                      }
                    }
                  }} 
                />
              </div>
            </div>

            {/* Daily Trend Chart */}
            <div className="bg-white shadow-lg border border-gray-200 p-4 sm:p-5 rounded-lg">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center border-b border-gray-200 pb-2">
                <div className="w-1 h-4 sm:h-6 bg-blue-500 mr-2 sm:mr-3"></div>
                <span className="truncate">Daily Productivity</span>
              </h3>
              <div className="h-48 sm:h-64">
                <Line data={dailyTrendData} options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: {
                      position: 'bottom',
                      labels: {
                        padding: window.innerWidth < 640 ? 10 : 15,
                        font: { size: window.innerWidth < 640 ? 10 : 12 }
                      }
                    }
                  }
                }} />
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Task Breakdown */}
            <div className="bg-white shadow-lg border border-gray-200 p-4 sm:p-5 rounded-lg">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center border-b border-gray-200 pb-2">
                <div className="w-1 h-4 sm:h-6 bg-purple-500 mr-2 sm:mr-3"></div>
                <span className="truncate">Task Analytics</span>
              </h3>
              <div className="max-h-48 sm:max-h-48 overflow-y-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 sm:p-3 font-semibold text-gray-700 border-b border-gray-200">Task</th>
                      <th className="text-right p-2 sm:p-3 font-semibold text-gray-700 border-b border-gray-200">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.taskBreakdown.slice(0, 8).map((task, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="p-2 sm:p-3">
                          <div className="font-medium text-gray-900 truncate text-xs sm:text-sm">
                            {task.task?.title || 'Unknown Task'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {task.task?.clientName && `${task.task.clientName} • `}
                            {task.task?.workType}
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 text-right font-semibold text-blue-600 text-xs sm:text-sm">
                          {formatTime(task.totalMinutes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Productivity Insights */}
            <div className="bg-white shadow-lg border border-gray-200 p-4 sm:p-5 rounded-lg">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-3 sm:mb-4 flex items-center border-b border-gray-200 pb-2">
                <div className="w-1 h-4 sm:h-6 bg-orange-500 mr-2 sm:mr-3"></div>
                <span className="truncate">Productivity Insights</span>
              </h3>
              <div className="space-y-3 sm:space-y-4">
                {analytics.productivity.mostProductiveDay && (
                  <div className="bg-gradient-to-r from-green-50 to-green-100 border-l-4 border-green-500 p-3 sm:p-4 rounded">
                    <div className="font-semibold text-green-800 text-xs uppercase tracking-wide">Most Productive Day</div>
                    <div className="text-green-700 font-medium mt-1 text-sm sm:text-base">
                      {format(parseISO(analytics.productivity.mostProductiveDay.date), 'MMMM dd, yyyy')}
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-green-900 mt-1">
                      {formatTime(analytics.productivity.mostProductiveDay.workingHours)}
                    </div>
                  </div>
                )}
                
                {analytics.productivity.leastProductiveDay && (
                  <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-l-4 border-yellow-500 p-3 sm:p-4 rounded">
                    <div className="font-semibold text-yellow-800 text-xs uppercase tracking-wide">Least Productive Day</div>
                    <div className="text-yellow-700 font-medium mt-1 text-sm sm:text-base">
                      {format(parseISO(analytics.productivity.leastProductiveDay.date), 'MMMM dd, yyyy')}
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-yellow-900 mt-1">
                      {formatTime(analytics.productivity.leastProductiveDay.workingHours)}
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-l-4 border-gray-500 p-3 sm:p-4 rounded">
                  <div className="font-semibold text-gray-800 text-xs uppercase tracking-wide">Analysis Period</div>
                  <div className="text-gray-700 font-medium mt-1 text-sm sm:text-base">
                    {format(parseISO(analytics.dateRange.start), 'MMM dd')} - {format(parseISO(analytics.dateRange.end), 'MMM dd, yyyy')}
                  </div>
                  <div className="text-xs sm:text-sm text-gray-600 mt-1">
                    {differenceInDays(parseISO(analytics.dateRange.end), parseISO(analytics.dateRange.start)) + 1} days analyzed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserAnalytics;
