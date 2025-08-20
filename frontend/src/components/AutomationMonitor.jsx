import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import toast from 'react-hot-toast';

const AutomationMonitor = () => {
  const { user } = useAuth();
  const [automationStatus, setAutomationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAutomationStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/automations/status`, {
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch automation status');
      }
      
      const data = await response.json();
      setAutomationStatus(data);
    } catch (error) {
      console.error('Error fetching automation status:', error);
      toast.error('Failed to fetch automation status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const forceRunAutomation = async (automationId, automationName) => {
    if (!window.confirm(`Are you sure you want to force run "${automationName}"? This will create tasks immediately.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/automations/${automationId}/force-run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to force run automation');
      }
      
      const data = await response.json();
      toast.success(data.message);
      
      // Refresh status after force run
      setRefreshing(true);
      setTimeout(fetchAutomationStatus, 2000);
    } catch (error) {
      console.error('Error force running automation:', error);
      toast.error('Failed to force run automation');
    }
  };

  const triggerManualCheck = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/automations/check-trigger`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to trigger manual check');
      }
      
      const data = await response.json();
      toast.success(data.message);
      
      // Refresh status after manual check
      setRefreshing(true);
      setTimeout(fetchAutomationStatus, 2000);
    } catch (error) {
      console.error('Error triggering manual check:', error);
      toast.error('Failed to trigger manual check');
    }
  };

  const resetAutomationStatus = async (automationId, automationName) => {
    if (!window.confirm(`Are you sure you want to reset the run status for "${automationName}"? This will allow it to run again immediately.`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/automations/${automationId}/reset-status`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset automation status');
      }
      
      const data = await response.json();
      toast.success(data.message);
      
      // Refresh status after reset
      setRefreshing(true);
      setTimeout(fetchAutomationStatus, 1000);
    } catch (error) {
      console.error('Error resetting automation status:', error);
      toast.error('Failed to reset automation status');
    }
  };

  useEffect(() => {
    if (user?.role === 'Admin') {
      fetchAutomationStatus();
    }
  }, [user]);

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed this month':
      case 'Completed this quarter':
      case 'Completed this period':
      case 'Completed this year':
        return 'bg-green-100 text-green-800';
      case 'Pending this month':
      case 'Pending':
      case 'Pending this year':
        return 'bg-yellow-100 text-yellow-800';
      case 'Scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'Completed/Deleted':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (user?.role !== 'Admin') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Access denied. Admin role required.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading automation status...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Automation Monitor</h2>
          <p className="text-gray-600">Monitor and control automation execution</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setRefreshing(true);
              fetchAutomationStatus();
            }}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={triggerManualCheck}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Trigger Check
          </button>
        </div>
      </div>

      {automationStatus && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">Total Automations</h3>
              <p className="text-2xl font-bold text-gray-900">{automationStatus.totalAutomations}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">Active This Month</h3>
              <p className="text-2xl font-bold text-green-600">
                {automationStatus.statusReport.filter(a => 
                  a.status.includes('Completed this') || a.status.includes('Pending this')
                ).length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">Scheduled</h3>
              <p className="text-2xl font-bold text-blue-600">
                {automationStatus.statusReport.filter(a => a.status === 'Scheduled').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow border">
              <h3 className="text-sm font-medium text-gray-500">Last Check</h3>
              <p className="text-sm font-bold text-gray-900">
                {formatDate(automationStatus.currentTime)}
              </p>
            </div>
          </div>

          {/* Automation List */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Automation Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Automation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Templates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Run
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {automationStatus.statusReport.map((automation) => (
                    <tr key={automation._id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{automation.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          {automation.triggerType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(automation.status)}`}>
                          {automation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex space-x-2">
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            {automation.approvedTemplates} approved
                          </span>
                          <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                            {automation.templateCount} total
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(automation.nextRunDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(automation.lastRunDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => forceRunAutomation(automation._id, automation.name)}
                            className="text-indigo-600 hover:text-indigo-900 text-xs bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded"
                          >
                            Force Run
                          </button>
                          <button
                            onClick={() => resetAutomationStatus(automation._id, automation.name)}
                            className="text-orange-600 hover:text-orange-900 text-xs bg-orange-50 hover:bg-orange-100 px-2 py-1 rounded"
                          >
                            Reset Status
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationMonitor;
