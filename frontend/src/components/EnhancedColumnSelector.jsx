import React, { useState } from 'react';

/**
 * Enhanced ColumnSelector for both PDF and Excel downloads
 */
const EnhancedColumnSelector = ({ isOpen, onClose, onDownloadPDF, onDownloadExcel, availableColumns, title = "Download Options" }) => {
  // All columns start deselected
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [fontSize, setFontSize] = useState(12);
  const [fontFamily, setFontFamily] = useState('tahoma');

  // Move column to selected (top) when checked
  const handleColumnToggle = (columnId) => {
    if (selectedColumns.includes(columnId)) {
      setSelectedColumns(selectedColumns.filter(id => id !== columnId));
    } else {
      setSelectedColumns([...selectedColumns, columnId]);
    }
  };

  // Drag and drop handlers for selected columns
  const handleDragStart = (idx) => setDraggedIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newOrder = [...selectedColumns];
    const [removed] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(idx, 0, removed);
    setSelectedColumns(newOrder);
    setDraggedIdx(idx);
  };
  const handleDragEnd = () => setDraggedIdx(null);

  const handleSelectAll = () => setSelectedColumns(availableColumns.map(col => col.id));
  const handleDeselectAll = () => setSelectedColumns([]);

  const handleDownloadPDF = () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one column');
      return;
    }
    const selectedColumnData = selectedColumns.map(id => availableColumns.find(col => col.id === id)).filter(Boolean);
    onDownloadPDF(selectedColumnData, fontSize, fontFamily);
    onClose();
  };

  const handleDownloadExcel = () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one column');
      return;
    }
    const selectedColumnData = selectedColumns.map(id => availableColumns.find(col => col.id === id)).filter(Boolean);
    onDownloadExcel(selectedColumnData, fontSize, fontFamily);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-600 mt-1">
            Select columns and drag to reorder them for your download.
          </p>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
            >
              Select All
            </button>
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
            >
              Deselect All
            </button>
          </div>

          {/* Selected columns section */}
          {selectedColumns.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">
                Selected Columns (Drag to reorder)
              </h3>
              <div className="space-y-2">
                {selectedColumns.map((columnId, idx) => {
                  const column = availableColumns.find(col => col.id === columnId);
                  return (
                    <div
                      key={columnId}
                      className={`flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded cursor-move ${
                        draggedIdx === idx ? 'opacity-50' : ''
                      }`}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900">{idx + 1}.</span>
                        <span className="ml-2 text-gray-800">{column?.label}</span>
                      </div>
                      <button
                        onClick={() => handleColumnToggle(columnId)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove from selection"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Available columns section */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Available Columns</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {availableColumns.map((column) => {
                const isSelected = selectedColumns.includes(column.id);
                return (
                  <label
                    key={column.id}
                    className={`flex items-center p-3 border rounded cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-green-50 border-green-300'
                        : 'bg-white border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleColumnToggle(column.id)}
                      className="mr-3 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{column.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* PDF-specific settings */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-900 mb-3">PDF Settings</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Font Size</label>
              <select
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={8}>8px</option>
                <option value={9}>9px</option>
                <option value={10}>10px</option>
                <option value={11}>11px</option>
                <option value={12}>12px</option>
                <option value={14}>14px</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Font Family</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="helvetica">Helvetica</option>
                <option value="times">Times</option>
                <option value="courier">Courier</option>
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Excel
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedColumnSelector;
