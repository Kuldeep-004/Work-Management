import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../apiConfig';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const TaskStatusDropdown = ({ 
  value, 
  onChange, 
  disabled = false,
  excludeCompleted = false,
  className = "w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
}) => {
  const { user: loggedInUser } = useAuth();
  const [statuses, setStatuses] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddStatusModalOpen, setIsAddStatusModalOpen] = useState(false);
  const [newStatusData, setNewStatusData] = useState({
    name: '',
    color: 'bg-purple-100 text-purple-800'
  });
  const dropdownRef = useRef(null);

  // Color options for new status
  const colorOptions = [
    { value: 'bg-red-100 text-red-800', label: 'Red', preview: 'bg-red-100' },
    { value: 'bg-yellow-100 text-yellow-800', label: 'Yellow', preview: 'bg-yellow-100' },
    { value: 'bg-green-100 text-green-800', label: 'Green', preview: 'bg-green-100' },
    { value: 'bg-blue-100 text-blue-800', label: 'Blue', preview: 'bg-blue-100' },
    { value: 'bg-indigo-100 text-indigo-800', label: 'Indigo', preview: 'bg-indigo-100' },
    { value: 'bg-purple-100 text-purple-800', label: 'Purple', preview: 'bg-purple-100' },
    { value: 'bg-pink-100 text-pink-800', label: 'Pink', preview: 'bg-pink-100' },
    { value: 'bg-orange-100 text-orange-800', label: 'Orange', preview: 'bg-orange-100' },
    { value: 'bg-teal-100 text-teal-800', label: 'Teal', preview: 'bg-teal-100' },
    { value: 'bg-cyan-100 text-cyan-800', label: 'Cyan', preview: 'bg-cyan-100' },
    { value: 'bg-gray-100 text-gray-800', label: 'Gray', preview: 'bg-gray-100' },
  ];

  // Fetch task statuses
  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/task-statuses`, {
          headers: {
            Authorization: `Bearer ${loggedInUser.token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch task statuses');
        }

        const statusList = await response.json();
        
        // Filter out completed status if excludeCompleted is true
        const filteredStatuses = excludeCompleted 
          ? statusList.filter(status => status.name !== 'completed')
          : statusList;
        
        setStatuses(filteredStatuses);
      } catch (error) {
        console.error('Error fetching task statuses:', error);
        toast.error('Failed to load task statuses');
      }
    };

    if (loggedInUser?.token) {
      fetchStatuses();
    }
  }, [loggedInUser, excludeCompleted]);

  // Filter statuses based on search term
  const filteredStatuses = statuses.filter(status =>
    status.name.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase())
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        setSearchTerm('');
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Format status name for display
  const formatStatusName = (name) => {
    return name.replace(/_/g, ' ')
               .split(' ')
               .map(word => word.charAt(0).toUpperCase() + word.slice(1))
               .join(' ');
  };

  // Helper function to get status color classes for consistent styling
  const getStatusColor = (statusName) => {
    // Find the status in statuses first for dynamic colors
    const statusObj = statuses.find(s => s.name === statusName);
    if (statusObj) {
      // If it's a Tailwind class, return it directly
      if (statusObj.color && !statusObj.color.startsWith('#')) {
        return statusObj.color;
      }
      // If it's a hex color, return null to use inline styles
      if (statusObj.color && statusObj.color.startsWith('#')) {
        return null;
      }
    }
    
    // Fallback to hardcoded colors for default statuses
    switch (statusName) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'yet_to_start':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Get inline styles for status colors (only for hex colors)
  const getStatusStyles = (statusName) => {
    const statusObj = statuses.find(s => s.name === statusName);
    if (statusObj && statusObj.color && statusObj.color.startsWith('#')) {
      const hex = statusObj.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const brightness = ((r * 299) + (g * 587) + (b * 114)) / 1000;
      const textColor = brightness > 128 ? '#000000' : '#FFFFFF';
      
      return {
        backgroundColor: hex,
        color: textColor
      };
    }
    return null;
  };

  // Get selected status display
  const selectedStatus = statuses.find(status => status.name === value);
  const selectedStatusDisplay = selectedStatus 
    ? formatStatusName(selectedStatus.name)
    : 'Select Status';

  // Handle status selection
  const handleStatusSelect = (status) => {
    onChange(status.name);
    setIsDropdownOpen(false);
    setSearchTerm('');
  };

  // Handle add new status
  const handleAddStatus = async () => {
    
    if (!newStatusData.name.trim()) {
      toast.error('Status name is required');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/task-statuses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${loggedInUser.token}`,
        },
        body: JSON.stringify({
          name: newStatusData.name.toLowerCase().replace(/\s+/g, '_'),
          color: newStatusData.color,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create status');
      }

      const newStatus = await response.json();
      
      // Add to statuses list if it should be included
      if (!excludeCompleted || newStatus.name !== 'completed') {
        setStatuses(prev => [...prev, newStatus]);
      }
      
      // Select the newly created status
      onChange(newStatus.name);
      
      // Reset form and close modal
      setNewStatusData({ name: '', color: 'bg-purple-100 text-purple-800' });
      setIsAddStatusModalOpen(false);
      setIsDropdownOpen(false);
      
      toast.success('Status created successfully');
    } catch (error) {
      console.error('Error creating status:', error);
      toast.error(error.message);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Status Dropdown */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !disabled && setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled}
          className={`${className} ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer hover:bg-gray-50'} flex items-center justify-between`}
        >
          <div className="flex items-center gap-2">
            {selectedStatus ? (
              <span 
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedStatus.name) || ''}`}
                style={getStatusStyles(selectedStatus.name) || {}}
              >
                {formatStatusName(selectedStatus.name)}
              </span>
            ) : (
              <span className="text-gray-500">{selectedStatusDisplay}</span>
            )}
          </div>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isDropdownOpen ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Add Status Button */}
        <button
          type="button"
          onClick={() => setIsAddStatusModalOpen(true)}
          className="px-3 py-2 text-sm bg-gray-100 text-gray-800 border border-gray-300 rounded-md hover:bg-gray-200 whitespace-nowrap"
          disabled={disabled}
        >
          + Add Status
        </button>
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {/* Search Input */}
          <div className="sticky top-0 bg-white p-2 border-b">
            <input
              type="text"
              placeholder="Search statuses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {/* Status Options */}
          <div className="py-1">
            {filteredStatuses.length > 0 ? (
              filteredStatuses.map((status) => (
                <button
                  key={status._id}
                  type="button"
                  onClick={() => handleStatusSelect(status)}
                  className={`w-full px-4 py-2 text-left hover:bg-blue-50 focus:outline-none focus:bg-blue-50 ${
                    value === status.name ? 'bg-blue-50' : ''
                  }`}
                >
                  <span 
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status.name) || ''}`}
                    style={getStatusStyles(status.name) || {}}
                  >
                    {formatStatusName(status.name)}
                  </span>
                  {value === status.name && (
                    <span className="float-right text-blue-600">✓</span>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-2 text-gray-500 text-center">
                No statuses found
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Status Modal */}
      {isAddStatusModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Status</h3>
              <button
                onClick={() => setIsAddStatusModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newStatusData.name}
                  onChange={(e) => setNewStatusData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter status name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setNewStatusData(prev => ({ ...prev, color: color.value }))}
                      className={`p-2 rounded-md border-2 ${
                        newStatusData.color === color.value 
                          ? 'border-blue-500 ring-2 ring-blue-200' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-full h-6 rounded ${color.preview} border`}></div>
                      <span className="text-xs mt-1 block">{color.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              {newStatusData.name && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Preview</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${newStatusData.color}`}>
                    {formatStatusName(newStatusData.name)}
                  </span>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddStatusModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddStatus}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  Add Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskStatusDropdown;
