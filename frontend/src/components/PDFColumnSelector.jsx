import React, { useState } from 'react';

const PDFColumnSelector = ({ isOpen, onClose, onDownload, availableColumns }) => {
  const [selectedColumns, setSelectedColumns] = useState(
    availableColumns.map(col => col.id)
  );

  const handleColumnToggle = (columnId) => {
    setSelectedColumns(prev => 
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    );
  };

  const handleSelectAll = () => {
    setSelectedColumns(availableColumns.map(col => col.id));
  };

  const handleDeselectAll = () => {
    setSelectedColumns([]);
  };

  const handleDownload = () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one column');
      return;
    }
    onDownload(selectedColumns);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/20 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Select Columns for PDF</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="mb-4">
          <div className="flex gap-2 mb-3">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Deselect All
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-3">
            Selected: {selectedColumns.length} of {availableColumns.length} columns
          </p>
        </div>

        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded p-3">
          {availableColumns.map((column) => (
            <label
              key={column.id}
              className="flex items-center space-x-3 mb-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
            >
              <input
                type="checkbox"
                checked={selectedColumns.includes(column.id)}
                onChange={() => handleColumnToggle(column.id)}
                className="accent-blue-500"
              />
              <span className="text-sm text-gray-700">{column.label}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={selectedColumns.length === 0}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFColumnSelector; 