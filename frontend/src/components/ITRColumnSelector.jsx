import React, { useState } from 'react';

/**
 * ITRColumnSelector for ITR format downloads (PDF and Excel)
 * Designed to look exactly like the main EnhancedPDFColumnSelector
 */
const ITRColumnSelector = ({ isOpen, onClose, onDownload, tasks }) => {
  // Define the ITR-specific columns based on the image
  const ITR_COLUMNS = [
    { id: 'no', label: 'No', defaultWidth: 50 },
    { id: 'dataReceivedOn', label: 'Data Received on', defaultWidth: 120 },
    { id: 'nameOfAssessee', label: 'Name of the Assessee', defaultWidth: 180 },
    { id: 'teamHead', label: 'Team Head', defaultWidth: 120 },
    { id: 'allotee', label: 'Allotee', defaultWidth: 120 },
    { id: 'draftFinancialsAndComputationPreparation', label: 'Draft Financials and Computation Preparation', defaultWidth: 140 },
    { id: 'accountantVerification', label: 'Accountant Verification', defaultWidth: 120 },
    { id: 'firstVerification', label: '1st Verification', defaultWidth: 120 },
    { id: 'secondVerification', label: '2nd Verification', defaultWidth: 120 },
    { id: 'hariSirVerification', label: 'Hari sir Verification', defaultWidth: 120 },
    { id: 'issuedForPartnerProprietorVerification', label: 'Issued for Partner/Proprietor Verification', defaultWidth: 160 },
    { id: 'challanPreparation', label: 'Challan Preparation', defaultWidth: 120 },
    { id: 'itrFiledOn', label: 'ITR Filed on', defaultWidth: 120 },
    { id: 'billPreparation', label: 'Bill preparation', defaultWidth: 120 }
  ];

  // All columns selected by default
  const [selectedColumns, setSelectedColumns] = useState(() => ITR_COLUMNS.map(col => col.id));
  const [draggedIdx, setDraggedIdx] = useState(null);
  const [fontSize, setFontSize] = useState(12);
  const [fontFamily, setFontFamily] = useState('tahoma');

  // Move column to selected when checked
  const handleColumnToggle = (columnId) => {
    if (columnId === 'no') return; // 'No' column is always selected and can't be unchecked
    
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

  const handleSelectAll = () => setSelectedColumns(ITR_COLUMNS.map(col => col.id));
  const handleDeselectAll = () => setSelectedColumns(['no']); // Keep 'No' column always selected

  const handleDownloadPDF = () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one column');
      return;
    }
    onDownload(selectedColumns, 'pdf');
    onClose();
  };

  const handleDownloadExcel = () => {
    if (selectedColumns.length === 0) {
      alert('Please select at least one column');
      return;
    }
    onDownload(selectedColumns, 'excel');
    onClose();
  };

  if (!isOpen) return null;

  // Get selected and unselected columns for display
  const selectedColumnDefs = selectedColumns.map(id => ITR_COLUMNS.find(col => col.id === id)).filter(Boolean);
  const unselectedDefs = ITR_COLUMNS.filter(col => !selectedColumns.includes(col.id));

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/20 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Select Columns for ITR Report</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-2xl">×</button>
        </div>
        <div className="flex gap-2 mb-3">
          <button onClick={handleSelectAll} className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">Select All</button>
          <button onClick={handleDeselectAll} className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600">Deselect All</button>
        </div>
        <p className="text-sm text-gray-600 mb-3">Selected: {selectedColumns.length} of {ITR_COLUMNS.length} columns</p>
        {/* Font options at top */}
        <div className="flex gap-4 mb-4 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Font Size</label>
            <div className="relative">
              <select
                value={fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                className="appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition shadow-sm"
              >
                {[8, 9, 10, 11, 12, 13, 14, 16, 18].map(size => (
                  <option key={size} value={size}>{size} pt</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Font Family</label>
            <div className="relative">
              <select
                value={fontFamily}
                onChange={e => setFontFamily(e.target.value)}
                className="appearance-none border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition shadow-sm"
              >
                <option value="tahoma">Tahoma (default)</option>
                <option value="helvetica">Helvetica</option>
                <option value="times">Times</option>
                <option value="courier">Courier</option>
              </select>
              <span className="pointer-events-none absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </span>
            </div>
          </div>
        </div>
        {/* Selected columns (draggable) */}
        <div className="mb-4">
          <div className="font-semibold text-gray-700 mb-1 text-sm">Selected Columns (Drag to reorder):</div>
          <div className="min-h-[40px] border border-blue-200 rounded p-2 bg-blue-50 flex flex-wrap gap-2">
            {selectedColumnDefs.length === 0 && <span className="text-gray-400 text-xs">No columns selected</span>}
            {selectedColumnDefs.map((col, idx) => (
              <div
                key={col.id}
                className={`flex items-center px-2 py-1 bg-blue-100 rounded shadow-sm cursor-move border border-blue-300 ${draggedIdx === idx ? 'opacity-60' : ''}`}
                draggable={col.id !== 'no'}
                onDragStart={() => col.id !== 'no' && handleDragStart(idx)}
                onDragOver={e => col.id !== 'no' && handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                onDrop={handleDragEnd}
                title="Drag to reorder"
              >
                {col.id !== 'no' && (
                  <span className="mr-2 cursor-pointer" onClick={() => handleColumnToggle(col.id)}>✕</span>
                )}
                <span className="text-xs font-medium text-blue-900">{col.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Unselected columns (checkboxes) */}
        <div className="max-h-48 overflow-y-auto border border-gray-200 rounded p-3 mb-4">
          <div className="font-semibold text-gray-700 mb-1 text-sm">Available Columns:</div>
          {unselectedDefs.map((column) => (
            <label key={column.id} className="flex items-center space-x-3 mb-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
              <input
                type="checkbox"
                checked={false}
                onChange={() => handleColumnToggle(column.id)}
                className="accent-blue-500"
              />
              <span className="text-sm text-gray-700">{column.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
          <button 
            onClick={handleDownloadExcel} 
            disabled={selectedColumns.length === 0} 
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Download Excel
          </button>
          <button 
            onClick={handleDownloadPDF} 
            disabled={selectedColumns.length === 0} 
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ITRColumnSelector;
