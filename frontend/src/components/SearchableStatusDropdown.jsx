import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

const SearchableStatusDropdown = ({ 
  task, 
  currentStatusOptions, 
  statusLoading, 
  getStatusColor, 
  getStatusStyles, 
  onStatusChange, 
  onClose,
  position 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState(currentStatusOptions);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    // Focus search input when dropdown opens
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    // Filter options based on search term
    const filtered = currentStatusOptions.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredOptions(filtered);
    setHighlightedIndex(-1);
  }, [searchTerm, currentStatusOptions]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          const selectedOption = filteredOptions[highlightedIndex];
          if (task.status !== selectedOption.value) {
            onStatusChange(task, selectedOption.value);
          }
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [highlightedIndex, filteredOptions, task, onStatusChange, onClose]);

  const handleOptionClick = (option) => {
    if (!statusLoading && task.status !== option.value) {
      onStatusChange(task, option.value);
    }
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        minWidth: 200,
        maxWidth: 300,
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        zIndex: 9999,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search Input */}
      <div className="p-2 border-b border-gray-200">
        <input
          ref={searchInputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search statuses..."
          className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Options List */}
      <div 
        className="max-h-90 overflow-y-auto p-1"
        style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e0 #f7fafc'
        }}
      >
        {filteredOptions.length === 0 ? (
          <div className="px-3 py-2 text-sm text-gray-500 text-center">
            No statuses found
          </div>
        ) : (
          filteredOptions.map((option, index) => (
            <div
              key={option.value}
              className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                index === highlightedIndex 
                  ? 'bg-blue-50' 
                  : task.status === option.value 
                    ? 'bg-gray-50' 
                    : 'hover:bg-gray-50'
              }`}
              style={{
                opacity: statusLoading ? 0.6 : 1,
              }}
              onClick={() => handleOptionClick(option)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <span 
                className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(option.value) || ''}`}
                style={getStatusStyles(option.value) || {}}
              >
                {option.label}
              </span>
              {task.status === option.value && (
                <svg 
                  width={16} 
                  height={16} 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth={2} 
                  viewBox="0 0 24 24"
                  className="text-green-600"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ))
        )}
      </div>

      
    </div>,
    document.body
  );
};

export default SearchableStatusDropdown;
