import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../apiConfig';
import toast from 'react-hot-toast';

const ITRProgressTable = ({ taskId, initialData = null, onUpdate = null }) => {
  const { user } = useAuth();
  const [progressData, setProgressData] = useState({
    draftFinancialsAndComputationPreparation: false,
    accountantVerification: false,
    hariSirVerification: false,
    issuedForPartnerProprietorVerification: false,
    challanPreparation: false,
    itrFiledOn: '',
    billPreparation: false
  });
  const [isLoading, setIsLoading] = useState(false);

  // Initialize data from props or fetch from API
  useEffect(() => {
    if (initialData && initialData.itrProgress) {
      setProgressData(initialData.itrProgress);
    } else if (taskId) {
      fetchITRProgress();
    }
  }, [taskId, initialData]);

  const fetchITRProgress = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/itr-progress`, {
        headers: {
          'Authorization': `Bearer ${user.token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.itrProgress) {
          setProgressData(data.itrProgress);
        }
      }
    } catch (error) {
      console.error('Error fetching ITR progress:', error);
    }
  };

  const updateITRProgress = async (newData) => {
    if (!taskId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}/itr-progress`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
        body: JSON.stringify({ itrProgress: newData }),
      });
      
      if (response.ok) {
        const updatedTask = await response.json();
        setProgressData(newData);
        toast.success('ITR progress updated successfully');
        if (onUpdate) {
          onUpdate(updatedTask);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Server error response:', errorData);
        throw new Error(errorData.message || 'Failed to update ITR progress');
      }
    } catch (error) {
      console.error('Error updating ITR progress:', error);
      toast.error('Failed to update ITR progress');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckboxChange = (field) => {
    const newData = {
      ...progressData,
      [field]: !progressData[field]
    };
    setProgressData(newData);
    updateITRProgress(newData);
  };

  const handleDateChange = (value) => {
    const newData = {
      ...progressData,
      itrFiledOn: value
    };
    setProgressData(newData);
    updateITRProgress(newData);
  };

  const columns = [
    {
      key: 'draftFinancialsAndComputationPreparation',
      label: ['Draft Financials', 'and Computation', 'Preparation'],
      type: 'checkbox'
    },
    {
      key: 'accountantVerification',
      label: ['Accountant', 'Verification'],
      type: 'checkbox'
    },
    {
      key: 'hariSirVerification',
      label: ['Hari sir', 'Verification'],
      type: 'checkbox'
    },
    {
      key: 'issuedForPartnerProprietorVerification',
      label: ['Issued for', 'Partner/Proprietor', 'Verification'],
      type: 'checkbox'
    },
    {
      key: 'challanPreparation',
      label: ['Challan', 'Preparation'],
      type: 'checkbox'
    },
    {
      key: 'itrFiledOn',
      label: ['ITR Filed on'],
      type: 'date'
    },
    {
      key: 'billPreparation',
      label: ['Bill', 'Preparation'],
      type: 'checkbox'
    }
  ];

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">ITR Progress Tracker</h3>
        {isLoading && (
          <div className="text-sm text-blue-600">Updating...</div>
        )}
      </div>
      
      <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
        <table className="min-w-full bg-white">
          <thead className="bg-blue-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider border-r border-gray-200 last:border-r-0"
                  style={{ minWidth: '140px', maxWidth: '160px' }}
                >
                  <div className="space-y-1">
                    {Array.isArray(column.label) ? (
                      column.label.map((line, index) => (
                        <div key={index} className="leading-tight">
                          {line}
                        </div>
                      ))
                    ) : (
                      <div className="leading-tight">{column.label}</div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white hover:bg-gray-50 transition-colors">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-3 py-4 text-center border-r border-gray-200 last:border-r-0"
                  style={{ minWidth: '140px', maxWidth: '160px' }}
                >
                  {column.type === 'checkbox' ? (
                    <div className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={progressData[column.key] || false}
                        onChange={() => handleCheckboxChange(column.key)}
                        className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                        disabled={isLoading}
                      />
                    </div>
                  ) : column.type === 'date' ? (
                    <input
                      type="date"
                      value={progressData[column.key] ? progressData[column.key].split('T')[0] : ''}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isLoading}
                    />
                  ) : null}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      
      
    </div>
  );
};

export default ITRProgressTable;
