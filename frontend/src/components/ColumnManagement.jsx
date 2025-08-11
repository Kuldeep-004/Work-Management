import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../apiConfig';

const ColumnManagement = () => {
  const { user } = useAuth();
  const [columns, setColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state for new column
  const [newColumn, setNewColumn] = useState({
    name: '',
    label: '',
    type: 'text',
    defaultValue: '',
    options: []
  });
  const [optionInput, setOptionInput] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);

  // Fetch columns
  const fetchColumns = async () => {
    setLoadingColumns(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/custom-columns?includeInactive=true`, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch columns');
      const data = await response.json();
      setColumns(data);
    } catch (error) {
      toast.error('Failed to fetch columns');
    } finally {
      setLoadingColumns(false);
    }
  };

  // Add new column
  const handleAddColumn = async () => {
    if (!newColumn.name.trim() || !newColumn.label.trim()) {
      toast.error('Name and label are required');
      return;
    }

    if (newColumn.type === 'tags' && newColumn.options.length === 0) {
      toast.error('Tags type requires at least one option');
      return;
    }

    setAddingColumn(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/custom-columns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user.token}`,
        },
        body: JSON.stringify({
          name: newColumn.name.trim(),
          label: newColumn.label.trim(),
          type: newColumn.type,
          defaultValue: newColumn.type === 'checkbox' ? newColumn.defaultValue === 'true' : 
                       newColumn.type === 'tags' ? [] : newColumn.defaultValue,
          options: newColumn.type === 'tags' ? newColumn.options : []
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add column');
      }

      toast.success('Column added successfully');
      setNewColumn({
        name: '',
        label: '',
        type: 'text',
        defaultValue: '',
        options: []
      });
      setOptionInput('');
      setShowAddForm(false);
      fetchColumns();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAddingColumn(false);
    }
  };

  // Add option for tags type
  const addOption = () => {
    if (optionInput.trim() && !newColumn.options.includes(optionInput.trim())) {
      setNewColumn(prev => ({
        ...prev,
        options: [...prev.options, optionInput.trim()]
      }));
      setOptionInput('');
    }
  };

  // Remove option
  const removeOption = (index) => {
    setNewColumn(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  // Toggle column active status
  const toggleColumn = async (columnId) => {
    try {
      const column = columns.find(col => col._id === columnId);
      const response = await fetch(`${API_BASE_URL}/api/custom-columns/${columnId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to toggle column');
      }

      toast.success(`Column "${column?.label}" ${column?.isActive ? 'deactivated' : 'activated'} successfully`);
      fetchColumns();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Delete column
  const deleteColumn = async (columnId) => {
    if (!confirm('Are you sure you want to delete this column? This action cannot be undone.')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/custom-columns/${columnId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${user.token}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete column');
      }

      toast.success('Column deleted successfully');
      fetchColumns();
    } catch (error) {
      toast.error(error.message);
    }
  };

  // Fetch columns on component mount
  useEffect(() => {
    fetchColumns();
  }, []);

  if (user.role !== 'Admin') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Access denied. Admin role required.</p>
      </div>
    );
  }

  return (
    <div className="px-0 md:px-6 py-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold">Column Management</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add New Column'}
        </button>
      </div>

      {/* Add New Column Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <h3 className="text-md font-medium text-gray-800 mb-4">Add New Column</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name (Internal ID)
              </label>
              <input
                type="text"
                value={newColumn.name}
                onChange={(e) => setNewColumn(prev => ({
                  ...prev,
                  name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')
                }))}
                placeholder="e.g., customfield1"
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Only lowercase letters and numbers</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Label (Display Name)
              </label>
              <input
                type="text"
                value={newColumn.label}
                onChange={(e) => setNewColumn(prev => ({ ...prev, label: e.target.value }))}
                placeholder="e.g., Custom Field 1"
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type
              </label>
              <select
                value={newColumn.type}
                onChange={(e) => setNewColumn(prev => ({
                  ...prev,
                  type: e.target.value,
                  defaultValue: e.target.value === 'checkbox' ? 'false' : '',
                  options: e.target.value === 'tags' ? prev.options : []
                }))}
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="text">Text Input</option>
                <option value="checkbox">Checkbox</option>
                <option value="tags">Tags (Multiple Select)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Default Value
              </label>
              {newColumn.type === 'checkbox' ? (
                <select
                  value={newColumn.defaultValue}
                  onChange={(e) => setNewColumn(prev => ({ ...prev, defaultValue: e.target.value }))}
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="false">Unchecked</option>
                  <option value="true">Checked</option>
                </select>
              ) : newColumn.type === 'tags' ? (
                <div className="text-sm text-gray-500">No default tags selected</div>
              ) : (
                <input
                  type="text"
                  value={newColumn.defaultValue}
                  onChange={(e) => setNewColumn(prev => ({ ...prev, defaultValue: e.target.value }))}
                  placeholder="Default text value"
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
            </div>
          </div>

          {/* Tags options */}
          {newColumn.type === 'tags' && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tag Options
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  placeholder="Add tag option"
                  className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyDown={(e) => e.key === 'Enter' && addOption()}
                />
                <button
                  onClick={addOption}
                  className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 transition-colors"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {newColumn.options.map((option, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center bg-blue-100 text-blue-800 rounded-full px-3 py-1 text-sm"
                  >
                    {option}
                    <button
                      onClick={() => removeOption(index)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleAddColumn}
              disabled={addingColumn || !newColumn.name.trim() || !newColumn.label.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {addingColumn ? 'Adding...' : 'Add Column'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Default Columns Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="text-md font-medium text-blue-800 mb-2">Default Columns</h3>
        <p className="text-sm text-blue-700">
          The following columns are built-in and cannot be modified: Title, Description, Client Name, Client Group, 
          Work Type, Internal Works, Task Status, Priority, Verifications, Self Verification, Inward Entry Date, 
          Due Date, Target Date, Assigned By, Assigned To, Verifiers, Guide, Files, Comments.
        </p>
      </div>

      {/* Custom Columns List */}
      <div>
        <h3 className="text-md font-medium text-gray-800 mb-4">Custom Columns</h3>
        
        {loadingColumns ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading columns...</p>
          </div>
        ) : columns.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No custom columns found. Create your first custom column using the button above.</p>
          </div>
        ) : (
          <>
            {/* Active Columns */}
            {columns.filter(col => col.isActive).length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-green-700 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                  Active Columns ({columns.filter(col => col.isActive).length})
                </h4>
                <div className="space-y-3">
                  {columns
                    .filter(column => column.isActive)
                    .map((column) => (
                      <div
                        key={column._id}
                        className="p-4 rounded-lg border bg-white border-gray-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium text-gray-900">
                                {column.label}
                              </h4>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {column.name}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                column.type === 'text' ? 'bg-green-100 text-green-800' :
                                column.type === 'checkbox' ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {column.type === 'tags' ? 'Tags' : column.type === 'checkbox' ? 'Checkbox' : 'Text'}
                              </span>
                            </div>
                            
                            <div className="mt-2 text-sm text-gray-600">
                              <span className="font-medium">Default:</span>{' '}
                              {column.type === 'checkbox' ? (column.defaultValue ? 'Checked' : 'Unchecked') :
                               column.type === 'tags' ? 'No default tags' :
                               column.defaultValue || 'Empty'}
                            </div>
                            
                            {column.type === 'tags' && column.options.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm font-medium text-gray-600">Options:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {column.options.map((option, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center bg-purple-100 text-purple-800 rounded-full px-2 py-1 text-xs"
                                    >
                                      {option}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-2 text-xs text-gray-500">
                              Created by {column.createdBy.firstName} {column.createdBy.lastName} on{' '}
                              {new Date(column.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => toggleColumn(column._id)}
                              className="px-3 py-1 text-sm rounded transition-colors bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              Deactivate
                            </button>
                            
                            <button
                              onClick={() => deleteColumn(column._id)}
                              className="text-red-600 hover:text-red-800 transition-colors p-1"
                              title="Delete column"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Inactive Columns */}
            {columns.filter(col => !col.isActive).length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-3 flex items-center">
                  <span className="w-3 h-3 bg-gray-400 rounded-full mr-2"></span>
                  Inactive Columns ({columns.filter(col => !col.isActive).length})
                </h4>
                <div className="space-y-3">
                  {columns
                    .filter(column => !column.isActive)
                    .map((column) => (
                      <div
                        key={column._id}
                        className="p-4 rounded-lg border bg-gray-50 border-gray-300"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-medium text-gray-500">
                                {column.label}
                              </h4>
                              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {column.name}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                column.type === 'text' ? 'bg-green-100 text-green-800' :
                                column.type === 'checkbox' ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {column.type === 'tags' ? 'Tags' : column.type === 'checkbox' ? 'Checkbox' : 'Text'}
                              </span>
                              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                                Inactive
                              </span>
                            </div>
                            
                            <div className="mt-2 text-sm text-gray-500">
                              <span className="font-medium">Default:</span>{' '}
                              {column.type === 'checkbox' ? (column.defaultValue ? 'Checked' : 'Unchecked') :
                               column.type === 'tags' ? 'No default tags' :
                               column.defaultValue || 'Empty'}
                            </div>
                            
                            {column.type === 'tags' && column.options.length > 0 && (
                              <div className="mt-2">
                                <span className="text-sm font-medium text-gray-500">Options:</span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {column.options.map((option, index) => (
                                    <span
                                      key={index}
                                      className="inline-flex items-center bg-purple-100 text-purple-800 rounded-full px-2 py-1 text-xs opacity-70"
                                    >
                                      {option}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="mt-2 text-xs text-gray-400">
                              Created by {column.createdBy.firstName} {column.createdBy.lastName} on{' '}
                              {new Date(column.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => toggleColumn(column._id)}
                              className="px-3 py-1 text-sm rounded transition-colors bg-green-100 text-green-700 hover:bg-green-200"
                            >
                              Activate
                            </button>
                            
                            <button
                              onClick={() => deleteColumn(column._id)}
                              className="text-red-600 hover:text-red-800 transition-colors p-1"
                              title="Delete column"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Show message if no columns exist */}
            {columns.filter(col => col.isActive).length === 0 && columns.filter(col => !col.isActive).length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-600">No custom columns found. Create your first custom column using the button above.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ColumnManagement;
