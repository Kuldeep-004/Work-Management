import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Chevron down icon component
const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// Chevron up icon component
const ChevronUpIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const SearchableTaskDropdown = ({
  tasks = [],
  value = '',
  onChange,
  disabled = false,
  placeholder = 'Select task',
  className = '',
  includeSpecialTasks = true,
  selectedTaskObj = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, positioning: 'below', actualHeight: 320 });
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);

  // Special task options
  const specialTasks = includeSpecialTasks ? [
    { _id: 'other', title: 'Other' },
    { _id: 'permission', title: 'Permission' },
    { _id: 'billing', title: 'Billing' },
    { _id: 'lunch', title: 'Lunch' },
    { _id: 'infrastructure-issues', title: 'Infrastructure Issues' },
    { _id: 'discussion-with-vivek', title: 'Discussion With Vivek Sir' }
  ] : [];

  // Combine special tasks with regular tasks
  const allTasks = [...specialTasks, ...tasks];

  // Filter tasks based on search term (supports partial matching anywhere in the string)
  const filteredTasks = allTasks.filter(task => {
    if (!searchTerm.trim()) return true;
    return task.title.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate dropdown position for portal
  const updateDropdownPosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const dropdownMaxHeight = 320; // Approximate height of dropdown
      const dropdownMinHeight = 120; // Minimum viable height
      
      // Check available space
      const spaceBelow = viewportHeight - rect.bottom - 8; // 8px margin
      const spaceAbove = rect.top - 8; // 8px margin
      
      let top, positioning, actualHeight;
      
      if (spaceBelow >= dropdownMaxHeight || spaceBelow >= spaceAbove) {
        // Position below (default)
        top = rect.bottom + window.scrollY + 4;
        positioning = 'below';
        actualHeight = Math.min(dropdownMaxHeight, Math.max(dropdownMinHeight, spaceBelow - 4));
      } else {
        // Position above
        actualHeight = Math.min(dropdownMaxHeight, Math.max(dropdownMinHeight, spaceAbove - 4));
        top = rect.top + window.scrollY - actualHeight - 4;
        positioning = 'above';
      }
      
      // Handle horizontal positioning (prevent going off-screen)
      let left = rect.left + window.scrollX;
      const dropdownMinWidth = rect.width;
      const rightEdge = left + dropdownMinWidth;
      
      if (rightEdge > viewportWidth - 8) {
        left = Math.max(8, viewportWidth - dropdownMinWidth - 8);
      }
      
      if (left < 8) {
        left = 8;
      }
      
      setDropdownPosition({
        top,
        left,
        width: Math.max(dropdownMinWidth, rect.width),
        positioning,
        actualHeight
      });
    }
  };

  // Add the empty option as the first item for keyboard navigation
  const allOptions = [{ _id: '', title: placeholder, isEmpty: true }, ...filteredTasks];

  // Find selected task display name
  const getSelectedTaskDisplay = () => {
    if (!value) return placeholder;
    
    // First check if we have a populated task object
    if (selectedTaskObj && selectedTaskObj.title) {
      return truncateText(selectedTaskObj.title);
    }
    
    // Find in our task list
    const selectedTask = allTasks.find(task => task._id === value);
    if (selectedTask) {
      return truncateText(selectedTask.title);
    }
    
    // Fallback for old/completed tasks
    return '(Old/Completed Task)';
  };

  // Truncate text helper for the main button display
  const truncateText = (text, maxLength = 50) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && 
          triggerRef.current && !triggerRef.current.contains(event.target) &&
          !event.target.closest('[data-dropdown-portal]')) {
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle window resize and scroll to update position
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        updateDropdownPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      // Small delay to ensure dropdown is rendered
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < allOptions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : allOptions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < allOptions.length) {
          const selectedOption = allOptions[highlightedIndex];
          handleTaskSelect(selectedOption.isEmpty ? '' : selectedOption);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const highlightedElement = listRef.current.children[highlightedIndex];
      if (highlightedElement) {
        highlightedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        });
      }
    }
  }, [highlightedIndex]);

  const handleTaskSelect = (task) => {
    const taskId = task && typeof task === 'object' ? task._id : task;
    onChange(taskId);
    setIsOpen(false);
    setSearchTerm('');
    setHighlightedIndex(-1);
  };

  const handleDropdownToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updateDropdownPosition();
    }
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
      setHighlightedIndex(-1);
    }
  };

  // Highlight search terms in task titles
  const highlightSearchTerm = (text, term) => {
    if (!term.trim()) return text;
    
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <span key={index} className="bg-yellow-300 text-yellow-900 font-semibold px-1 rounded">
          {part}
        </span>
      ) : part
    );
  };

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        {/* Dropdown trigger */}
        <button
          ref={triggerRef}
          type="button"
          onClick={handleDropdownToggle}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`w-full border border-gray-300 rounded px-3 py-2 text-left bg-white flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'
          }`}
        >
          <span className={`block truncate ${!value ? 'text-gray-500' : 'text-gray-900'}`}>
            {getSelectedTaskDisplay()}
          </span>
          <div className="flex items-center">
            {value && (
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            )}
            {isOpen ? (
              <ChevronUpIcon className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDownIcon className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </button>
      </div>

      {/* Dropdown menu rendered as portal */}
      {isOpen && createPortal(
        <div 
          data-dropdown-portal
          className={`fixed bg-white border-2 border-gray-300 shadow-2xl rounded-lg ${
            dropdownPosition.positioning === 'above' ? 'flex flex-col-reverse' : ''
          }`}
          style={{ 
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            zIndex: 99999,
            height: `${dropdownPosition.actualHeight}px`
          }}
        >
          {/* Search input */}
          <div className={`p-3 bg-gray-50 ${
            dropdownPosition.positioning === 'above' 
              ? 'border-t border-gray-200 rounded-b-lg' 
              : 'border-b border-gray-200 rounded-t-lg'
          }`}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tasks... (middle part search supported)"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0); // Reset to first item when searching
              }}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {searchTerm.trim() && (
              <div className="text-xs text-gray-500 mt-1">
                {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} found
              </div>
            )}
          </div>

          {/* Task list */}
          <div 
            ref={listRef}
            className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 flex-1"
            style={{ 
              maxHeight: `${dropdownPosition.actualHeight - 80}px` // Reserve 80px for search input
            }}
          >
            {allOptions.length === 1 ? (
              <div className="px-4 py-3 text-gray-500 text-sm text-center">
                No tasks found
              </div>
            ) : (
              allOptions.map((task, index) => (
                <button
                  key={task._id || 'empty'}
                  type="button"
                  onClick={() => handleTaskSelect(task.isEmpty ? '' : task)}
                  className={`w-full text-left px-4 py-4 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                    highlightedIndex === index ? 'bg-blue-50' : ''
                  } ${value === task._id ? 'bg-blue-100 font-medium text-blue-900' : ''} ${
                    task.isEmpty ? 'text-gray-500 italic' : 'text-gray-900'
                  }`}
                >
                  <div className="whitespace-normal break-words leading-relaxed line-height-1.5" style={{ lineHeight: '1.4' }}>
                    {task.isEmpty ? task.title : highlightSearchTerm(task.title, searchTerm)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default SearchableTaskDropdown;