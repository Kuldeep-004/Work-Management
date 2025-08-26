import React from 'react';
import { XMarkIcon, TrashIcon } from '@heroicons/react/24/solid';

const FilterPopup = ({ 
  isOpen, 
  onClose, 
  filters, 
  setFilters, 
  users,
  clientNames,
  clientGroups,
  workTypes,
  priorities = []
}) => {
  if (!isOpen) return null;

  const filterableColumns = [
    { value: 'title', label: 'Title' },
    { value: 'status', label: 'Status', options: ['yet_to_start', 'in_progress', 'completed'] },
    { value: 'priority', label: 'Priority', options: priorities.map(p => p.name) },
    { value: 'assignedTo', label: 'Assigned To', options: users.map(u => ({ value: u._id, label: `${u.firstName} ${u.lastName}` })) },
    { value: 'assignedBy', label: 'Assigned By', options: users.map(u => ({ value: u._id, label: `${u.firstName} ${u.lastName}` })) },
    { value: 'clientName', label: 'Client Name', options: clientNames },
    { value: 'clientGroup', label: 'Client Group', options: clientGroups },
    { value: 'workType', label: 'Work Type', options: workTypes },
  ];

  const operators = [
    { value: 'is', label: 'Is' },
    { value: 'is_not', label: 'Is Not' },
    { value: 'contains', label: 'Contains' },
    { value: 'does_not_contain', label: 'Does Not Contain' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
  ];

  // Local state for editing filters, but only commit to parent on Save
  const [editingFilters, setEditingFilters] = React.useState([]);

  React.useEffect(() => {
    if (isOpen) {
      setEditingFilters(filters.map(f => ({ ...f })));
    }
  }, [isOpen, filters]);

  const handleAddFilter = () => {
    setEditingFilters([...editingFilters, { column: 'title', operator: 'contains', value: '', saved: false }]);
  };

  const handleSaveFilter = (index) => {
    const newFilters = [...editingFilters];
    newFilters[index].saved = true;
    setEditingFilters(newFilters);
    // Only update parent with saved filters
    setFilters(newFilters.filter(f => f.saved));
  };

  const handleRemoveFilter = (index) => {
    const newFilters = editingFilters.filter((_, i) => i !== index);
    setEditingFilters(newFilters);
    // Only update parent with saved filters
    setFilters(newFilters.filter(f => f.saved));
  };

  const handleFilterChange = (index, field, value) => {
    const newFilters = [...editingFilters];
    newFilters[index][field] = value;
    if (field === 'column') {
      newFilters[index].value = '';
    }
    newFilters[index].saved = false; // Mark as unsaved if changed
    setEditingFilters(newFilters);
  };

  const renderValueInput = (filter, index) => {
    const selectedColumn = filterableColumns.find(c => c.value === filter.column);
    if (!selectedColumn || filter.operator === 'is_empty' || filter.operator === 'is_not_empty') {
      return <div className="flex-1"></div>;
    }

    // For contains and does_not_contain, always show text input regardless of column type
    if (filter.operator === 'contains' || filter.operator === 'does_not_contain') {
      return (
        <input
          type="text"
          value={filter.value}
          onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Enter text to search..."
        />
      );
    }

    // For other operators, show dropdown if column has options, otherwise text input
    if (selectedColumn.options) {
      return (
        <select
          value={filter.value}
          onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
          className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        >
          <option value="">Select...</option>
          {selectedColumn.options.map(opt => (
            typeof opt === 'object' 
              ? <option key={opt.value} value={opt.value}>{opt.label}</option>
              : <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    }

    return (
      <input
        type="text"
        value={filter.value}
        onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
        className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        placeholder="Value"
      />
    );
  };

  return (
    <div className="absolute top-full mt-2 bg-white rounded-md shadow-lg border border-gray-200 z-50 p-4 left-0 right-0 mx-2 sm:mx-0 sm:w-[820px] sm:right-auto max-w-[calc(100vw-1rem)] overflow-visible">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-semibold text-gray-800">Filters</h3>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 flex-shrink-0">
          <XMarkIcon className="h-5 w-5 text-gray-500" />
        </button>
      </div>
      <div className="space-y-3 max-h-[70vh] overflow-y-auto scrollbar-hide">
        {editingFilters.map((filter, index) => (
          <div key={index} className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <span className="text-sm text-gray-600 w-12 flex-shrink-0">{index === 0 ? 'Where' : ''}</span>
            {index > 0 && (
              <select
                value={filter.logic || 'AND'}
                onChange={e => handleFilterChange(index, 'logic', e.target.value)}
                className="w-16 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-xs"
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            )}
            <select
              value={filter.column}
              onChange={(e) => handleFilterChange(index, 'column', e.target.value)}
              className="w-full sm:w-40 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {filterableColumns.map(col => <option key={col.value} value={col.value}>{col.label}</option>)}
            </select>
            <select
              value={filter.operator}
              onChange={(e) => handleFilterChange(index, 'operator', e.target.value)}
              className="w-full sm:w-40 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
            </select>
            {renderValueInput(filter, index)}
            <div className="flex justify-end sm:justify-start gap-2">
              {filter.saved ? (
                <span className="text-sm font-medium text-green-600 w-20 text-center">Saved</span>
              ) : (
                <button onClick={() => handleSaveFilter(index)} className="w-20 p-1 rounded-md bg-blue-500 text-white text-sm hover:bg-blue-600">
                  Save
                </button>
              )}
              <button onClick={() => handleRemoveFilter(index)} className="p-1 rounded-full hover:bg-gray-200">
                <TrashIcon className="h-5 w-5 text-gray-500 hover:text-red-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={handleAddFilter} className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-800">
        + New Filter
      </button>
    </div>
  );
};

export default FilterPopup; 