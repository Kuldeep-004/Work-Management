import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import CreateTask from './CreateTask';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import defaultProfile from '../assets/avatar.jpg';
import FileUpload from './FileUpload';
import FileList from './FileList';
import TaskComments from './TaskComments';
import VerificationRemarksModal from './VerificationRemarksModal';
import SearchableStatusDropdown from './SearchableStatusDropdown';
import { API_BASE_URL } from '../apiConfig';
import ReactDOM from 'react-dom';
import React from 'react';
import { useAdvancedTaskTableLogic } from './AdvancedTaskTableLogic.jsx';
import { useAdvancedTableHandlers } from '../hooks/useAdvancedTableHandlers';

// Custom hook for virtualizing the task list
const useVirtualization = (items, itemHeight = 50, containerHeight = window.innerHeight) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 25 });
  const containerRef = useRef(null);

  const updateVisibleRange = useCallback((scrollTop) => {
    const start = Math.floor(scrollTop / itemHeight);
    const numVisible = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + numVisible + 10, items.length); // +10 for buffer
    setVisibleRange({ start: Math.max(0, start - 10), end }); // -10 for buffer
  }, [items.length, itemHeight, containerHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      updateVisibleRange(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [updateVisibleRange]);

  return { visibleRange, containerRef };
};

const AdvancedTaskTable = React.memo(({ 
  tasks, 
  viewType, 
  taskType, 
  showControls = true,
  onTaskUpdate,
  onTaskDelete,
  onStatusChange,
  onVerificationStatusChange,
  shouldDisableActions,
  shouldDisableFileActions,
  taskHours = [],
  visibleColumns,
  setVisibleColumns,
  columnWidths,
  setColumnWidths,
  columnOrder,
  setColumnOrder,
  storageKeyPrefix = 'advancedtasktable',
  users = [],
  currentUser = null,
  refetchTasks,
  sortBy,
  tabKey = 'defaultTabKey',
  tabId,
  allColumns,
  highlightedTaskId,
  enableBulkSelection = false,
  selectedTasks = [],
  onTaskSelect,
  isAllSelected = false,
  onSelectAll,
  externalTableRef = null,
}) => {
  // Core state
  const [tableWidth, setTableWidth] = useState(0);
  const [scrollbarLeft, setScrollbarLeft] = useState(0);
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  
  // All refs before any other hooks
  const permanentScrollbarRef = useRef(null);

  // Use our custom hook for all task-related state and handlers
  const {
    editModalOpen,
    setEditModalOpen,
    editTask,
    setEditTask,
    handleStatusChange,
    handleVerificationStatusChange,
    handleTaskSelect,
    handleEditTask,
    handleTaskSubmit
  } = useAdvancedTableHandlers({
    onStatusChange,
    onVerificationStatusChange,
    onTaskSelect,
    onTaskUpdate,
    refetchTasks
  });

  // Memoize column-related props before using them
  const memoizedColumns = useMemo(() => ({
    visibleColumns,
    columnWidths,
    columnOrder,
  }), [visibleColumns, columnWidths, columnOrder]);


  const logic = useAdvancedTaskTableLogic({
    tasks, viewType, taskType, showControls, onTaskUpdate, onTaskDelete,
    onStatusChange, onVerificationStatusChange, shouldDisableActions,
    shouldDisableFileActions, taskHours, visibleColumns, setVisibleColumns,
    columnWidths, setColumnWidths, columnOrder, setColumnOrder,
    storageKeyPrefix, users, currentUser, refetchTasks,
    sortBy, tabKey, tabId, allColumns, highlightedTaskId,
    enableBulkSelection, selectedTasks, onTaskSelect, isAllSelected, onSelectAll,
    onEditTask: handleEditTask
  });

  // Destructure everything we need from logic
  const {
    formatDate, formatDateTime, BASE_COLUMNS, VERIFICATION_OPTIONS,
    STATUS_OPTIONS, DRAG_ROW_CLASS, prevColumnOrder, setPrevColumnOrder,
    dynamicPriorities, setDynamicPriorities, prioritiesLoaded, setPrioritiesLoaded,
    dynamicTaskStatuses, setDynamicTaskStatuses, taskStatusesLoaded, setTaskStatusesLoaded,
    customColumns, setCustomColumns, customColumnsLoaded, setCustomColumnsLoaded,
    showDeleteDropdown, setShowDeleteDropdown, deleteDropdownPosition, setDeleteDropdownPosition,
    deleteDropdownRef, deleteConfirmTask, setDeleteConfirmTask, loadedTasksCount,
    setLoadedTasksCount, TASKS_PER_BATCH, ALL_COLUMNS, getExtendedColumns,
    getCurrentPriorityOptions, getStatusColor, getStatusStyles, currentStatusOptions,
    getPriorityColor, getVerificationColor, getUserTaskHours, draggedColumn,
    setDraggedColumn, dragOverColumn, setDragOverColumn, isResizing, setIsResizing,
    resizingColumn, setResizingColumn, resizeStartX, setResizeStartX, resizeStartWidth,
    setResizeStartWidth, draggedGroup, setDraggedGroup, dragOverGroup, setDragOverGroup,
    isResizingRef, resizingColumnRef, resizeStartXRef, resizeStartWidthRef, tableRef,
    selectedTask, setSelectedTask, showFileUpload, setShowFileUpload, showComments,
    setShowComments, editingDescriptionTaskId, setEditingDescriptionTaskId,
    editingDescriptionValue, setEditingDescriptionValue, showRemarksModal,
    setShowRemarksModal, remarksModalTask, setRemarksModalTask, remarksModalType,
    setRemarksModalType, remarksModalLoading, setRemarksModalLoading,
    editingCustomTextTaskId, setEditingCustomTextTaskId, editingCustomTextColumnName,
    setEditingCustomTextColumnName, editingCustomTextValue, setEditingCustomTextValue,
    editingCustomTagsTaskId, setEditingCustomTagsTaskId, editingCustomTagsColumnName,
    setEditingCustomTagsColumnName, editingPriorityTaskId, setEditingPriorityTaskId,
    priorityLoading, setPriorityLoading, priorityDropdownRef, editingVerificationTaskId,
    setEditingVerificationTaskId, verificationLoading, setVerificationLoading,
    verificationDropdownRef, dropdownPosition, setDropdownPosition, editingStatusTaskId,
    setEditingStatusTaskId, statusLoading, setStatusLoading, statusDropdownRef,
    editingVerifierTaskId, setEditingVerifierTaskId, verifierDropdownPosition,
    setVerifierDropdownPosition, verifierLoading, setVerifierLoading, verifierDropdownRef,
    verifierSearch, setVerifierSearch, guideDropdownRef, openGuideDropdownTaskId,
    setOpenGuideDropdownTaskId, draggedTaskId, setDraggedTaskId, dragOverTaskId,
    setDragOverTaskId, dragOverGroupKey, setDragOverGroupKey, orderedTasks,
    setOrderedTasks, orderLoaded, setOrderLoaded, lastTaskIdsRef, lastGroupFieldRef,
    isControlled, isColumnOrderControlled, isUpdating, setIsUpdating, isUpdating2,
    setIsUpdating2, loadMoreTriggerRef, handleDragStart, handleDragOver,
    handleDragLeave, handleDrop, handleResizeStart, handleResizeMove, handleResizeEnd,
    getOrderedVisibleColumns, handleTaskClick, handleFileUploaded, handleFileDeleted,
    handleDescriptionEditSave, handleCustomTextEditSave, handleCustomTagsChange,
    handlePriorityChange, getVerificationOptions, handleVerificationChange,
    handleVerificationWithRemarks, closeRemarksModal, handleStatusChangeLocal,
    handleDeleteTask, handleNoColumnLeftClick, handleNoColumnRightClick,
    handleDeleteFromDropdown, handleConfirmDelete, handleCancelDelete, closeDeleteDropdown,
    groupTasksBy, handleRowDragStart, handleRowDragOver, handleRowDrop, handleRowDragEnd,
    handleGroupDrop, startAutoScroll, updateAutoScroll, stopAutoScroll, saveOrder, saveGroupOrder, getAssignedVerifierIds, getGroupKey, loadMoreTasks,
    shouldShowLoadMore, groupField, shouldGroup, groupedTasks, renderGroupedTasks, user,
    groupOrder, groupOrderLoaded, isGroupedModeLoading, taskTransitions, hiddenTaskIds,
    startTaskTransition, completeTaskTransition, updateTaskWithTransition
  } = logic;

  // Permanent scrollbar synchronization
  useEffect(() => {
    // Use external table ref if provided (for AdminDashboard), otherwise use internal ref
    const activeTableRef = externalTableRef || tableRef;
    let scrollContainer = null;
    
    const getScrollContainer = () => {
      if (!activeTableRef.current) return null;
      
      let container = activeTableRef.current;
      
      // If we have an external ref, find the actual scrolling container
      if (externalTableRef) {
        const innerContainer = container.querySelector('.table-wrapper-no-scrollbar');
        if (innerContainer) {
          container = innerContainer;
        }
      }
      
      return container;
    };
    
    const updateScrollbarDimensions = () => {
      const container = getScrollContainer();
      if (container) {
        const table = container.querySelector('table');
        
        if (table) {
          const containerRect = container.getBoundingClientRect();
          const tableScrollWidth = table.scrollWidth;
          const containerWidth = container.clientWidth;
          
          // Only show scrollbar if table is wider than container
          // For grouped tables, we need to ensure the scrollbar still works
          if (tableScrollWidth > containerWidth) {
            setTableWidth(tableScrollWidth);
            setScrollbarLeft(containerRect.left);
            setScrollbarWidth(containerWidth);
          } else {
            setTableWidth(0); // Hide scrollbar
          }
        }
      }
    };

    const handleTableScroll = () => {
      const container = getScrollContainer();
      if (container && permanentScrollbarRef.current) {
        permanentScrollbarRef.current.scrollLeft = container.scrollLeft;
      }
    };

    const handlePermanentScroll = () => {
      const container = getScrollContainer();
      if (container && permanentScrollbarRef.current) {
        container.scrollLeft = permanentScrollbarRef.current.scrollLeft;
      }
    };

    // Set up event listeners
    scrollContainer = getScrollContainer();
    
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleTableScroll);
    }
    if (permanentScrollbarRef.current) {
      permanentScrollbarRef.current.addEventListener('scroll', handlePermanentScroll);
    }

    // Update dimensions on mount, resize, and content changes
    updateScrollbarDimensions();
    window.addEventListener('resize', updateScrollbarDimensions);
    
    // Update after a short delay to ensure DOM is rendered
    const timeoutId = setTimeout(updateScrollbarDimensions, 100);

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleTableScroll);
      }
      if (permanentScrollbarRef.current) {
        permanentScrollbarRef.current.removeEventListener('scroll', handlePermanentScroll);
      }
      window.removeEventListener('resize', updateScrollbarDimensions);
      clearTimeout(timeoutId);
    };
  }, [tasks, visibleColumns, columnWidths, externalTableRef, shouldGroup, groupedTasks]);
  

  // Handle loading state for grouped mode
  if (isGroupedModeLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* CSS for smooth task transitions */}
      <style>{`
        .task-row-transition {
          transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
        }
        .task-row-hidden {
          opacity: 0;
          transform: translateY(-5px);
        }
        .task-row-visible {
          opacity: 1;
          transform: translateY(0);
        }
      `}</style>
      
      <div className="pt-4 bg-gray-50 min-h-screen">
        {/* Responsive table wrapper - hide scrollbar */}
        <div className="table-wrapper-no-scrollbar w-full" ref={tableRef}>
          <table className={`min-w-full divide-y divide-gray-200 ${isResizing ? 'select-none' : ''}`} style={{ minWidth: 'max-content' }}> 
            {/* Only render thead at the top if not grouping */}
            {!shouldGroup && (
              <thead className="border-b border-gray-200">
                <tr>
                  {enableBulkSelection && (
                    <th className="px-2 py-1 text-left text-sm font-normal bg-white tracking-wider select-none whitespace-nowrap border-r border-gray-200" style={{width: '48px', minWidth: '48px'}} title="Select All">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={(e) => onSelectAll && onSelectAll(e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                  )}
                  <th className="px-2 py-1 text-left text-sm font-normal bg-white tracking-wider select-none whitespace-nowrap border-r border-gray-200" style={{width: '48px', minWidth: '48px'}}>No</th>
                  {getOrderedVisibleColumns().map((colId, idx, arr) => {
                    const col = ALL_COLUMNS.find(c => c.id === colId);
                    if (!col) return null;
                    const isLast = idx === arr.length - 1;
                    return (
                      <th
                        key={colId}
                        className={`px-2 py-1 text-left text-sm font-normal bg-white tracking-wider relative select-none whitespace-nowrap ${!isLast ? 'border-r border-gray-200' : ''}`}
                        style={{
                          width: (columnWidths[colId] || 150) + 'px',
                          minWidth: (columnWidths[colId] || 150) + 'px',
                          background: dragOverColumn === colId ? '#f0f6ff' : 'white',
                          boxShadow: dragOverColumn === colId ? 'inset 2px 0 0 0 #60a5fa' : undefined,
                          borderBottom: '1px solid #e5e7eb',
                          position: 'relative',
                        }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, colId)}
                        onDragOver={(e) => handleDragOver(e, colId)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, colId)}
                      >
                        <span style={{fontWeight: 500}} className="whitespace-nowrap overflow-hidden text-ellipsis block">{col.label}</span>
                        {!isLast && (
                          <span
                            onMouseDown={e => handleResizeStart(e, colId)}
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              height: '100%',
                              width: 8,
                              cursor: 'col-resize',
                              zIndex: 10,
                              userSelect: 'none',
                              background: 'transparent',
                              pointerEvents: 'auto',
                              display: 'block',
                            }}
                            onClick={e => e.stopPropagation()}
                            title="Resize column"
                            tabIndex={-1}
                          ></span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
            )}
            <tbody>
              {shouldGroup ? (
                (() => {
                  // For grouped view, we need to count tasks across all groups and limit to loadedTasksCount
                  let totalTasksShown = 0;
                  return Object.entries(renderGroupedTasks).map(([group, groupTasks]) => {
                    // Only show groups and tasks if we haven't exceeded the limit
                    const tasksToShow = groupTasks.slice(0, Math.max(0, loadedTasksCount - totalTasksShown));
                    const shouldShowGroup = totalTasksShown < loadedTasksCount && tasksToShow.length > 0;
                    totalTasksShown += tasksToShow.length;
                    
                    if (!shouldShowGroup) return null;
                    
                    return (
                      <React.Fragment key={group}>
                    <tr 
                      key={group + '-header'} 
                      className={`group-header ${dragOverGroup === group && draggedGroup ? 'bg-blue-100' : ''} cursor-grab`}
                      draggable={true}
                      onDragStart={(e) => {
                        setDraggedGroup(group);
                        e.dataTransfer.setData('text/plain', group);
                        e.dataTransfer.effectAllowed = 'move';
                        startAutoScroll(e);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (draggedGroup && draggedGroup !== group) {
                          setDragOverGroup(group);
                        }
                        updateAutoScroll(e);
                      }}
                      onDragLeave={() => {
                        if (dragOverGroup === group) {
                          setDragOverGroup(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        stopAutoScroll();
                        if (draggedGroup && draggedGroup !== group) {
                          handleGroupDrop(draggedGroup, group);
                        }
                        setDraggedGroup(null);
                        setDragOverGroup(null);
                      }}
                      onDragEnd={() => {
                        stopAutoScroll();
                        setDraggedGroup(null);
                        setDragOverGroup(null);
                      }}
                    >
                      <td colSpan={getOrderedVisibleColumns().length + ((viewType === 'assigned' || viewType === 'admin') ? 2 : 1) + (enableBulkSelection ? 1 : 0)} 
                          className={`bg-gray-100 text-gray-800 font-semibold px-4 py-2 border-t border-b border-gray-300 ${draggedGroup === group ? 'opacity-50' : ''}`}>
                        <div className="flex items-center">
                          <svg className="h-4 w-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                          </svg>
                          {group}
                        </div>
                      </td>
                    </tr>
                    <tr key={group + '-columns'} className="border-b border-gray-200">
                      {enableBulkSelection && (
                        <th className="px-2 py-1 text-left text-sm font-normal bg-white tracking-wider select-none whitespace-nowrap border-r border-gray-200" style={{width: '48px', minWidth: '48px'}}>
                          {/* Empty header for group - no select all */}
                        </th>
                      )}
                      <th className="px-2 py-1 text-left text-sm font-normal bg-white tracking-wider select-none whitespace-nowrap border-r border-gray-200" style={{width: '48px', minWidth: '48px'}}>No</th>
                      {getOrderedVisibleColumns().map((colId, idx, arr) => {
                        const col = ALL_COLUMNS.find(c => c.id === colId);
                        if (!col) return null;
                        const isLast = idx === arr.length - 1;
                        return (
                          <th
                            key={colId}
                            className={`px-2 py-1 text-left text-sm font-normal bg-white tracking-wider relative select-none whitespace-nowrap ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{
                              width: (columnWidths[colId] || 150) + 'px',
                              minWidth: (columnWidths[colId] || 150) + 'px',
                              background: dragOverColumn === colId ? '#f0f6ff' : 'white',
                              boxShadow: dragOverColumn === colId ? 'inset 2px 0 0 0 #60a5fa' : undefined,
                              borderBottom: '1px solid #e5e7eb',
                              position: 'relative',
                            }}
                            draggable
                            onDragStart={(e) => handleDragStart(e, colId)}
                            onDragOver={(e) => handleDragOver(e, colId)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, colId)}
                          >
                            <span style={{fontWeight: 500}} className="whitespace-nowrap overflow-hidden text-ellipsis block">{col.label}</span>
                            {!isLast && (
                              <span
                                onMouseDown={e => handleResizeStart(e, colId)}
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 0,
                                  height: '100%',
                                  width: 8,
                                  cursor: 'col-resize',
                                  zIndex: 10,
                                  userSelect: 'none',
                                  background: 'transparent',
                                  pointerEvents: 'auto',
                                  display: 'block',
                                }}
                                onClick={e => e.stopPropagation()}
                                title="Resize column"
                                tabIndex={-1}
                              ></span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                    {tasksToShow.map((task, idx) => (
                      <tr
                        key={task._id}
                        className={`task-row-transition border-b border-gray-200 hover:bg-gray-50 transition-none ${dragOverTaskId === task._id && draggedTaskId ? DRAG_ROW_CLASS : ''} ${enableBulkSelection && selectedTasks.includes(task._id) ? 'bg-blue-50' : ''} ${highlightedTaskId === task._id ? 'bg-blue-100 shadow-lg ring-2 ring-blue-400 animate-pulse' : ''} ${hiddenTaskIds.has(task._id) ? 'task-row-hidden' : 'task-row-visible'}`}
                        draggable
                        onDragStart={e => handleRowDragStart(e, task._id)}
                        onDragOver={e => handleRowDragOver(e, task._id)}
                        onDrop={e => handleRowDrop(e, task._id)}
                        onDragEnd={handleRowDragEnd}
                        style={{ opacity: draggedTaskId === task._id ? 0.5 : 1 }}
                      >
                        {enableBulkSelection && (
                          <td className="px-2 py-1 text-sm font-normal align-middle bg-white border-r border-gray-200" style={{width: '48px', minWidth: '48px'}}>
                            <input
                              type="checkbox"
                              checked={selectedTasks.includes(task._id)}
                              onChange={(e) => onTaskSelect && onTaskSelect(task._id, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              onClick={(e) => e.stopPropagation()}
                              title={selectedTasks.includes(task._id) ? "Deselect task" : "Select task"}
                            />
                          </td>
                        )}
                        <td
                          className="px-2 py-1 text-sm font-normal align-middle bg-white border-r border-gray-200 text-gray-500 cursor-pointer hover:bg-gray-100"
                          style={{width: '48px', minWidth: '48px', textAlign: 'right'}}
                          title="Left click to edit, right click for delete option"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNoColumnLeftClick(task);
                          }}
                          onContextMenu={(e) => {
                            e.stopPropagation();
                            handleNoColumnRightClick(e, task);
                          }}
                        >
                          {idx + 1}
                        </td>
                        {getOrderedVisibleColumns().map((colId, idx2, arr) => {
                          const col = ALL_COLUMNS.find(c => c.id === colId);
                          if (!col) return null;
                          const isLast = idx2 === arr.length - 1;
                          
                          switch (colId) {
                            case 'title':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{verticalAlign: 'middle', width: (columnWidths[colId] || 256) + 'px', minWidth: (columnWidths[colId] || 256) + 'px', maxWidth: (columnWidths[colId] || 256) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.title}</span></div></td>;
                            
                            case 'description':
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white border-0 ${!isLast ? 'border-r border-gray-200' : ''}`} style={{verticalAlign: 'middle', width: (columnWidths[colId] || 180) + 'px', minWidth: (columnWidths[colId] || 180) + 'px', maxWidth: (columnWidths[colId] || 180) + 'px', background: 'white', overflow: 'hidden'}}>
                                  {editingDescriptionTaskId === task._id ? (
                                    <input
                                      type="text"
                                      value={editingDescriptionValue}
                                      autoFocus
                                      onChange={e => setEditingDescriptionValue(e.target.value)}
                                      onBlur={() => handleDescriptionEditSave(task)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          handleDescriptionEditSave(task);
                                        }
                                      }}
                                      className="no-border-input w-full bg-white px-1 py-1 rounded"
                                      style={{fontSize: 'inherit', height: '28px'}}
                                    />
                                  ) : (
                                    <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                      <span
                                        className="cursor-pointer block"
                                        onClick={() => {
                                          setEditingDescriptionTaskId(task._id);
                                          setEditingDescriptionValue(task.description || '');
                                        }}
                                        title="Click to edit"
                                        style={{ minHeight: '14px', color: !task.description ? '#aaa' : undefined, fontSize: 'inherit' }}
                                      >
                                        {task.description && task.description.trim() !== '' ? task.description : <span style={{fontStyle: 'italic', fontSize: 'inherit'}}></span>}
                                      </span>
                                    </div>
                                  )}
                                </td>
                              );
                            
                            case 'clientName':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span className="text-sm font-medium text-gray-900">{task.clientName}</span></div></td>;
                            
                            case 'clientGroup':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span className="text-sm text-gray-500">{task.clientGroup}</span></div></td>;
                            
                            case 'workType':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex gap-1">{task.workType && task.workType.map((type, index) => (<span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">{type}</span>))}</div></div></td>;
                            
                            case 'billed':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 80) + 'px', minWidth: (columnWidths[colId] || 80) + 'px', maxWidth: (columnWidths[colId] || 80) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.billed ? 'Yes' : 'No'}</span></div></td>;
                            
                            case 'status':
                              // Editable for admin dashboard, keep received logic unchanged
                              if (
                                viewType === 'received' &&
                                (taskType === 'issuedVerification' || taskType === 'guidance')
                              ) {
                                return (
                                  <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                    style={{ width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden' }}>
                                  <div className="overflow-x-auto whitespace-nowrap" style={{ width: '100%', maxWidth: '100%' }}>
                                    <span 
                                      className={`inline-block px-2 py-1 rounded-4xl text-xs font-semibold ${getStatusColor(task.status) || ''}`}
                                      style={getStatusStyles(task.status) || {}}
                                    >
                                      {currentStatusOptions.find(opt => opt.value === task.status)?.label || task.status}
                                    </span>
                                  </div>
                                </td>
                              );
                            }
                            const canEditStatus = viewType === 'admin' || viewType === 'received';
                            return (
                              <td
                                key={colId}
                                className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                style={{
                                  width: (columnWidths[colId] || 120) + 'px',
                                  minWidth: (columnWidths[colId] || 120) + 'px',
                                  maxWidth: (columnWidths[colId] || 120) + 'px',
                                  background: 'white',
                                  overflow: 'visible',
                                  cursor: canEditStatus ? 'pointer' : 'default',
                                  position: 'relative',
                                  zIndex: editingStatusTaskId === task._id ? 50 : 'auto',
                                }}
                                onClick={e => {
                                  if (canEditStatus) {
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setDropdownPosition({
                                      top: rect.bottom + window.scrollY,
                                      left: rect.left + window.scrollX,
                                    });
                                    setEditingStatusTaskId(task._id);
                                  }
                                }}
                              >
                                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                                  <span
                                    className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status) || ''}`}
                                    style={{
                                      display: 'inline-block',
                                      whiteSpace: 'nowrap',
                                      ...getStatusStyles(task.status),
                                      overflowX: 'auto',
                                      textOverflow: 'ellipsis',
                                      maxWidth: '100%',
                                      verticalAlign: 'middle',
                                      scrollbarWidth: 'thin',
                                      msOverflowStyle: 'auto',
                                    }}
                                    title={currentStatusOptions.find(opt => opt.value === task.status)?.label || task.status}
                                  >
                                    {currentStatusOptions.find(opt => opt.value === task.status)?.label || task.status}
                                  </span>
                                  {/* Show dropdown as portal if open */}
                                  {editingStatusTaskId === task._id && canEditStatus && (
                                    <SearchableStatusDropdown
                                      task={task}
                                      currentStatusOptions={
                                        (viewType === 'received' && taskType === 'execution')
                                          ? currentStatusOptions.filter(opt => opt.value !== 'reject')
                                          : currentStatusOptions
                                      }
                                      statusLoading={statusLoading}
                                      getStatusColor={getStatusColor}
                                      getStatusStyles={getStatusStyles}
                                      onStatusChange={handleStatusChangeLocal}
                                      onClose={() => setEditingStatusTaskId(null)}
                                      position={dropdownPosition}
                                    />
                                  )}
                                </div>
                              </td>
                            );
                          
                            case 'priority':
                              // Editable for admin dashboard, keep received logic unchanged
                              const canEditPriority = (viewType === 'admin') || (viewType === 'received' && (taskType === 'execution' || taskType === 'receivedVerification'));
                              return (
                                <td
                                  key={colId}
                                  className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{
                                    width: (columnWidths[colId] || 120) + 'px',
                                    minWidth: (columnWidths[colId] || 120) + 'px',
                                    maxWidth: (columnWidths[colId] || 120) + 'px',
                                    background: 'white',
                                    overflow: 'visible',
                                    cursor: canEditPriority ? 'pointer' : 'default',
                                    position: 'relative',
                                    zIndex: editingPriorityTaskId === task._id ? 50 : 'auto',
                                  }}
                                  onClick={e => {
                                    if (canEditPriority) {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setDropdownPosition({
                                        top: rect.bottom + window.scrollY,
                                        left: rect.left + window.scrollX,
                                      });
                                      setEditingPriorityTaskId(task._id);
                                    }
                                  }}
                                >
                                  <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                    <span className={`inline-block px-2 py-1 rounded-4xl text-xs font-semibold ${getPriorityColor(task.priority)}`}>{getCurrentPriorityOptions().find(opt => opt.value === task.priority)?.label || task.priority}</span>
                                  </div>
                                  {/* Show dropdown as portal if open and canEditPriority */}
                                  {editingPriorityTaskId === task._id && canEditPriority && ReactDOM.createPortal(
                                    <div
                                      ref={priorityDropdownRef}
                                      style={{
                                        position: 'absolute',
                                        top: dropdownPosition.top,
                                        left: dropdownPosition.left,
                                        minWidth: 160,
                                        background: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                        padding: 8,
                                        zIndex: 9999,
                                      }}
                                    >
                                      {getCurrentPriorityOptions().map(opt => (
                                        <div
                                          key={opt.value}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '5px 12px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            background: task.priority === opt.value ? '#f3f4f6' : 'transparent',
                                            marginBottom: 2,
                                            transition: 'background 0.15s',
                                            opacity: priorityLoading ? 0.6 : 1,
                                          }}
                                          onClick={e => {
                                            e.stopPropagation();
                                            if (!priorityLoading && task.priority !== opt.value) handlePriorityChange(task, opt.value);
                                            setEditingPriorityTaskId(null);
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                          onMouseLeave={e => e.currentTarget.style.background = task.priority === opt.value ? '#f3f4f6' : 'transparent'}
                                        >
                                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(opt.value)}`}>{opt.label}</span>
                                          {task.priority === opt.value && (
                                            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                          )}
                                        </div>
                                      ))}
                                    </div>,
                                    document.body
                                  )}
                                </td>
                              );            
                              
                            case 'verification':
                              // Allow any user to edit verification in received tasks page
                              const canEditVerification = viewType === 'received';
                              return (
                                <td
                                  key={colId}
                                  className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{
                                    width: (columnWidths[colId] || 130) + 'px',
                                    minWidth: (columnWidths[colId] || 130) + 'px',
                                    maxWidth: (columnWidths[colId] || 130) + 'px',
                                    background: 'white',
                                    overflow: 'visible',
                                    cursor: canEditVerification ? 'pointer' : 'default',
                                    position: 'relative',
                                    zIndex: editingVerificationTaskId === task._id ? 50 : 'auto',
                                  }}
                                  onClick={e => {
                                    if (canEditVerification) {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setDropdownPosition({
                                        top: rect.bottom + window.scrollY,
                                        left: rect.left + window.scrollX,
                                      });
                                      setEditingVerificationTaskId(task._id);
                                    }
                                  }}
                                >
                                  <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getVerificationColor(task.verification || 'pending')}`}>
                                      {VERIFICATION_OPTIONS.find(opt => opt.value === (task.verification || 'pending'))?.label || (task.verification || 'pending')}
                                    </span>
                                  </div>
                                  {/* Show dropdown as portal if open and canEditVerification */}
                                  {editingVerificationTaskId === task._id && canEditVerification && ReactDOM.createPortal(
                                    <div
                                      ref={verificationDropdownRef}
                                      style={{
                                        position: 'absolute',
                                        top: dropdownPosition.top,
                                        left: dropdownPosition.left,
                                        minWidth: 160,
                                        background: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                        padding: 8,
                                        zIndex: 9999,
                                      }}
                                    >
                                      {getVerificationOptions(task, currentUser).map(opt => (
                                        <div
                                          key={opt.value}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '5px 12px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            background: (task.verification || 'pending') === opt.value ? '#f3f4f6' : 'transparent',
                                            marginBottom: 2,
                                            transition: 'background 0.15s',
                                            opacity: verificationLoading ? 0.6 : 1,
                                          }}
                                          onClick={e => {
                                            e.stopPropagation();
                                            if (!verificationLoading && (task.verification || 'pending') !== opt.value) {
                                              handleVerificationChange(task, opt.value);
                                            }
                                            setEditingVerificationTaskId(null);
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                          onMouseLeave={e => e.currentTarget.style.background = (task.verification || 'pending') === opt.value ? '#f3f4f6' : 'transparent'}
                                        >
                                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getVerificationColor(opt.value)}`}>
                                            {opt.label}
                                          </span>
                                          {(task.verification || 'pending') === opt.value && (
                                            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </div>
                                      ))}
                                    </div>,
                                    document.body
                                  )}
                                </td>
                              );            
                              
                            case 'selfVerification':
                              // Editable for admin dashboard, keep received logic unchanged
                              const canEditSelfVerification = (viewType === 'admin') || (viewType === 'received' && taskType === 'execution');
                              
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                                <div className="flex justify-center items-center">
                                  <input
                                    type="checkbox"
                                    checked={!!task.selfVerification}
                                    disabled={!!task.selfVerification || !canEditSelfVerification || isUpdating}
                                    onChange={(!task.selfVerification && canEditSelfVerification) ? async (e) => {
                                      const checked = e.target.checked;
                                      setIsUpdating(true);
                                      try {
                                        const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}`, {
                                          method: 'PUT',
                                          headers: {
                                            'Content-Type': 'application/json',
                                            Authorization: `Bearer ${user.token}`,
                                          },
                                          body: JSON.stringify({ selfVerification: checked }),
                                        });
                                        if (!response.ok) throw new Error('Failed to update self verification');
                                        const updatedTask = await response.json();
                                        console.log('Updated task received:', updatedTask);
                                        // Update task in state immediately - no refetch needed
                                        if (onTaskUpdate) {
                                          onTaskUpdate(task._id, (prevTask) => ({
                                            ...prevTask,
                                            selfVerification: updatedTask.selfVerification
                                          }));
                                        }
                                        // No refetchTasks() call - use local updates for smooth UX
                                        
                                        toast.success('Self Verification updated');
                                      } catch (err) {
                                        console.error('Error updating self verification:', err);
                                        toast.error('Failed to update Self Verification');
                                        // On error, revert using local state update instead of refetch
                                        if (onTaskUpdate) {
                                          onTaskUpdate(task._id, (prevTask) => ({
                                            ...prevTask,
                                            selfVerification: !checked // revert the change
                                          }));
                                        }
                                      } finally {
                                        setIsUpdating(false);
                                      }
                                    } : undefined}
                                  />
                                </div>
                              </td>
                            );
                          
                            case 'inwardEntryDate':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDateTime(task.inwardEntryDate)}</span></div></td>;
                          
                            case 'dueDate':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDate(task.dueDate)}</span></div></td>;
                          
                            case 'targetDate':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDate(task.targetDate)}</span></div></td>;
                          
                            case 'assignedBy':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex items-center"><img src={task.assignedBy?.photo?.url || defaultProfile} alt={task.assignedBy?.firstName || 'User'} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} /><span className="ml-2">{task.assignedBy?.firstName || 'Unknown'} {task.assignedBy?.lastName || 'User'}</span></div></div></td>;
                          
                            case 'assignedTo':
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex items-center"><img src={task.assignedTo?.photo?.url || defaultProfile} alt={task.assignedTo?.firstName || 'User'} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} /><span className="ml-2">{task.assignedTo?.firstName || 'Unknown'} {task.assignedTo?.lastName || 'User'}<span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">{getUserTaskHours(task._id, task.assignedTo?._id)}</span></span></div></div></td>;
                          
                            case 'verificationAssignedTo':
                            case 'secondVerificationAssignedTo':
                            case 'thirdVerificationAssignedTo':
                            case 'fourthVerificationAssignedTo':
                            case 'fifthVerificationAssignedTo': {
                              // Map column to index (0-based)
                              const verifierFields = [
                                'verificationAssignedTo',
                                'secondVerificationAssignedTo',
                                'thirdVerificationAssignedTo',
                                'fourthVerificationAssignedTo',
                                'fifthVerificationAssignedTo',
                              ];
                              const colIdx = verifierFields.indexOf(colId);
                              const currVerifierField = verifierFields[colIdx];
                              const prevVerifierField = verifierFields[colIdx - 1];

                              // Show dropdown if:
                              // 1. For first verifier: selfVerification must be true (for execution tab)
                              // 2. For receivedVerification tab: if current user is the first verifier, allow dropdown
                              // 3. Current user is the assigned verifier for this column (nth)
                              // 4. OR, current user is the previous verifier and this column is unassigned (N+1th)
                              let userIsThisVerifier = task[currVerifierField]?._id === currentUser?._id;
                              let userIsPrevVerifier = colIdx > 0 && task[prevVerifierField]?._id === currentUser?._id && !task[currVerifierField];
                              let canEditThisVerifier =
                                viewType === 'received' &&
                                (userIsThisVerifier || userIsPrevVerifier) &&
                                taskType !== 'completed' &&
                                taskType !== 'guidance' &&
                                taskType !== 'issuedVerification';
                              
                              // For first verifier, require selfVerification (for execution tab)
                              if (colId === 'verificationAssignedTo') {
                                canEditThisVerifier =
                                  (viewType === 'received' && taskType === 'execution' && !!task.selfVerification)
                                  || (viewType === 'received' && taskType === 'receivedVerification' && userIsThisVerifier)
                                  || (viewType === 'received' && taskType === 'issuedVerification' && task.assignedBy && task.assignedBy._id === currentUser?._id);
                              }
                              
                              // NEW: For issuedVerification tab, only allow editing the latest non-empty verifier
                              if (taskType === 'issuedVerification' && task.assignedBy && task.assignedBy._id === currentUser?._id) {
                                // Find the latest non-empty verifier
                                let latestNonEmptyVerifierIndex = -1;
                                for (let i = verifierFields.length - 1; i >= 0; i--) {
                                  if (task[verifierFields[i]]) {
                                    latestNonEmptyVerifierIndex = i;
                                    break;
                                  }
                                }
                                
                                // Only allow editing the latest non-empty verifier
                                if (latestNonEmptyVerifierIndex !== -1 && colIdx === latestNonEmptyVerifierIndex) {
                                  canEditThisVerifier = true;
                                } else if (latestNonEmptyVerifierIndex !== -1) {
                                  canEditThisVerifier = false; // Don't allow editing other verifiers
                                }
                              }
                              
                              // NEW: For execution tab with verification accepted, allow next empty verifier assignment
                              if (taskType === 'execution' && task.verification === 'accepted') {
                                // Find the next empty verifier position
                                let nextEmptyVerifierIndex = -1;
                                for (let i = 0; i < verifierFields.length; i++) {
                                  if (!task[verifierFields[i]]) {
                                    nextEmptyVerifierIndex = i;
                                    break;
                                  }
                                }
                                
                                // Only allow dropdown for the next empty verifier position
                                if (colIdx === nextEmptyVerifierIndex && nextEmptyVerifierIndex !== -1) {
                                  canEditThisVerifier = true;
                                } else if (task.verification === 'accepted') {
                                  canEditThisVerifier = false; // Don't allow editing other verifiers when verification is accepted
                                }
                              }
                              
                              // NEW: For receivedVerification tab, handle verification status logic
                              if (taskType === 'receivedVerification') {
                                // Always allow current verifier to reassign themselves
                                if (userIsThisVerifier) {
                                  canEditThisVerifier = true;
                                }
                                // For "next verification", allow assigning the next verifier in sequence
                                else if (task.verification === 'next verification') {
                                  // Find current verifier
                                  let currentVerifierIndex = -1;
                                  verifierFields.forEach((field, idx) => {
                                    if (task[field]?._id === currentUser?._id) {
                                      currentVerifierIndex = idx;
                                    }
                                  });
                                  
                                  // Only allow dropdown for the next verifier after current verifier
                                  const nextVerifierIndex = currentVerifierIndex + 1;
                                  if (colIdx === nextVerifierIndex && nextVerifierIndex < verifierFields.length) {
                                    canEditThisVerifier = true;
                                  } else {
                                    canEditThisVerifier = false;
                                  }
                                }
                                // For other verification statuses, don't allow next verifier assignment
                                else if (!userIsThisVerifier) {
                                  canEditThisVerifier = false;
                                }
                              }

                              // Exclude assignedTo and all already assigned verifiers
                              const assignedVerifierIds = getAssignedVerifierIds(task);
                              const dropdownUsers = users.filter(
                                (u) =>
                                  u._id !== task.assignedTo?._id &&
                                  !assignedVerifierIds.includes(u._id) &&
                                  u._id !== currentUser?._id &&
                                  (`${u.firstName} ${u.lastName}`.toLowerCase().includes(verifierSearch.toLowerCase()))
                              );

                              if (canEditThisVerifier) {
                                return (
                                  <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                    style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden', cursor: 'pointer', position: 'relative', zIndex: editingVerifierTaskId === `${task._id}-${colId}` ? 50 : 'auto'}}
                                    onClick={e => {
                                      e.stopPropagation();
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      setVerifierDropdownPosition({
                                        top: rect.bottom + window.scrollY,
                                        left: rect.left + window.scrollX,
                                      });
                                      setEditingVerifierTaskId(`${task._id}-${colId}`);
                                      setVerifierSearch('');
                                    }}
                                  >
                                    <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                      <div className="flex items-center ">
                                        {task[colId] ? (
                                          <>
                                            <img
                                              src={task[colId]?.photo?.url || defaultProfile}
                                              alt={`${task[colId]?.firstName || 'User'} ${task[colId]?.lastName || ''}`}
                                              className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                                              onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }}
                                            />
                                            <span className="ml-2">
                                              {task[colId]?.firstName || 'Unknown'} {task[colId]?.lastName || 'User'}
                                              <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                                {getUserTaskHours(task._id, task[colId]?._id)}h
                                              </span>
                                            </span>
                                          </>
                                        ) : (
                                          <span style={{fontStyle: 'italic', fontSize: 'inherit'}}>NA</span>
                                        )}
                                        <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="ml-1 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                      </div>
                                      {/* Dropdown for selecting verifier */}
                                      {editingVerifierTaskId === `${task._id}-${colId}` && ReactDOM.createPortal(
                                        <div
                                          ref={verifierDropdownRef}
                                          style={{
                                            position: 'absolute',
                                            top: verifierDropdownPosition.top,
                                            left: verifierDropdownPosition.left,
                                            minWidth: 200,
                                            background: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 8,
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                            padding: 8,
                                            zIndex: 9999,
                                            maxHeight: 300,
                                            overflowY: 'auto',
                                          }}
                                        >
                                          {dropdownUsers.length === 0 ? (
                                            <div className="text-gray-400 text-sm px-2 py-2">No users found</div>
                                          ) : (
                                            dropdownUsers.map(u => (
                                              <div
                                                key={u._id}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 8,
                                                  padding: '6px 8px',
                                                  borderRadius: 6,
                                                  cursor: 'pointer',
                                                  background: task[colId] && task[colId]._id === u._id ? '#f3f4f6' : 'transparent',
                                                  marginBottom: 2,
                                                  transition: 'background 0.15s',
                                                  opacity: verifierLoading ? 0.6 : 1,
                                                }}
                                                onClick={async e => {
                                                  e.stopPropagation();
                                                  if (verifierLoading || (task[colId] && task[colId]._id === u._id)) return;
                                                  setVerifierLoading(true);
                                                  try {
                                                    // Prepare the request body
                                                    const requestBody = { [colId]: u._id };
                                                    
                                                    // If this is execution tab with verification accepted, also set verification to pending
                                                    if (taskType === 'execution' && task.verification === 'accepted') {
                                                      requestBody.verification = 'pending';
                                                    }
                                                    
                                                    const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/verifier`, {
                                                      method: 'PATCH',
                                                      headers: {
                                                        'Content-Type': 'application/json',
                                                        Authorization: `Bearer ${currentUser.token}`,
                                                      },
                                                      body: JSON.stringify(requestBody),
                                                    });
                                                    if (!response.ok) throw new Error('Failed to update verifier');
                                                    const updatedTask = await response.json();
                                                    if (onTaskUpdate) onTaskUpdate(task._id, () => updatedTask);
                                                    toast.success(`${col.label} updated`);
                                                    if (refetchTasks) refetchTasks();
                                                  } catch (err) {
                                                    toast.error(`Failed to update ${col.label.toLowerCase()}`);
                                                  }
                                                  setVerifierLoading(false);
                                                  setEditingVerifierTaskId(null);
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                                onMouseLeave={e => e.currentTarget.style.background = (task[colId] && task[colId]._id === u._id) ? '#f3f4f6' : 'transparent'}
                                              >
                                                <img src={u?.photo?.url || defaultProfile} alt={`${u.firstName} ${u.lastName}`} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" style={{minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24}} />
                                                <span style={{fontSize: '14px'}}>{u.firstName} {u.lastName}</span>
                                                {task[colId] && task[colId]._id === u._id && (
                                                  <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                )}
                                              </div>
                                            ))
                                          )}
                                        </div>,
                                        document.body
                                      )}
                                    </div>
                                  </td>
                                );
                              }
                              // Otherwise, just show the value
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}>
                                  <div className="overflow-x-auto whitespace-nowrap flex items-center" style={{width: '100%', maxWidth: '100%'}}>
                                    {task[colId] ? (
                                      <>
                                        <img src={task[colId]?.photo?.url || defaultProfile} alt={`${task[colId].firstName} ${task[colId].lastName}`} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                                        <span className="ml-2">
                                          {task[colId].firstName} {task[colId].lastName}
                                          <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                            {getUserTaskHours(task._id, task[colId]._id)}h
                                          </span>
                                        </span>
                                      </>
                                    ) : (
                                      <span style={{fontStyle: 'italic', fontSize: 'inherit'}}>NA</span>
                                    )}
                                  </div>
                                </td>
                              );
                            }
                            case 'guides':
                              // Editable for admin dashboard, keep received logic unchanged
                              const isAdmin = viewType === 'admin';
                              const guideChipsClass = (viewType === 'received' || isAdmin) ? 'pr-6' : 'pr-0';
                              const guideChipsMaxWidth = (viewType === 'received' || isAdmin) ? 'calc(100% - 28px)' : '100%';
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                                  style={{width: (columnWidths[colId] || 200) + 'px', minWidth: (columnWidths[colId] || 200) + 'px', maxWidth: (columnWidths[colId] || 200) + 'px', background: 'white', overflow: 'hidden'}}>
                                <div className="flex items-center relative" style={{width: '100%', maxWidth: '100%'}}>
                                  {/* Scrollable chips */}
                                  <div className={`flex items-center gap-1 overflow-x-auto whitespace-nowrap ${guideChipsClass}`} style={{maxWidth: guideChipsMaxWidth}}>
                                    {Array.isArray(task.guides) && task.guides.length > 0 ? (
                                      task.guides.map(u => (
                                        <span key={u._id} className="flex items-center bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs font-medium mr-1">
                                          <img src={u?.photo?.url || defaultProfile} alt={u.firstName} className="w-5 h-5 rounded-full object-cover mr-1" style={{minWidth: 20, minHeight: 20}} onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} />
                                          {u.firstName} {u.lastName}
                                          {viewType === 'received' && (
                                            <button
                                              className="ml-1 text-red-500 hover:text-red-700 focus:outline-none"
                                              style={{fontSize: '12px'}}
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const newGuides = task.guides.filter(g => g._id !== u._id).map(g => g._id);
                                                try {
                                                  const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/guides`, {
                                                    method: 'PUT',
                                                    headers: {
                                                      'Content-Type': 'application/json',
                                                      Authorization: `Bearer ${currentUser.token}`,
                                                    },
                                                    body: JSON.stringify({ guides: newGuides }),
                                                  });
                                                  if (!response.ok) throw new Error('Failed to update guides');
                                                  const updatedTask = await response.json();
                                                  if (onTaskUpdate) onTaskUpdate(task._id, (prevTask) => ({ ...prevTask, guides: updatedTask.guides }));
                                                  toast.success('Guide removed');
                                                } catch (err) {
                                                  toast.error('Failed to update guides');
                                                }
                                              }}
                                              title="Remove guide"
                                            >×</button>
                                          )}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="italic text-gray-400">No guide</span>
                                    )}
                                  </div>
                                  {/* Fixed dropdown icon at end, only in received viewType */}
                                  {(viewType === 'received' || isAdmin) && (
                                    <button
                                      className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-white rounded-full border border-gray-200 hover:bg-blue-100 hover:border-blue-400 transition-colors cursor-pointer z-10"
                                      style={{boxShadow: '0 1px 4px rgba(0,0,0,0.04)'}}
                                      onClick={e => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDropdownPosition({
                                          top: rect.bottom + window.scrollY,
                                          left: rect.left + window.scrollX,
                                        });
                                        setOpenGuideDropdownTaskId(task._id);
                                      }}
                                      title="Add/Remove Guides"
                                    >
                                      <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="text-gray-500 group-hover:text-blue-600 transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                  )}
                                  {/* Dropdown for selecting guides */}
                                  {(viewType === 'received' || isAdmin) && openGuideDropdownTaskId === task._id && ReactDOM.createPortal(
                                    <div
                                      ref={guideDropdownRef}
                                      style={{
                                        position: 'absolute',
                                        top: dropdownPosition.top,
                                        left: dropdownPosition.left,
                                        minWidth: 220,
                                        background: '#fff',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 8,
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                        padding: 8,
                                        zIndex: 9999,
                                        maxHeight: 300,
                                        overflowY: 'auto',
                                      }}
                                    >
                                      {users.filter(u => !task.guides?.some(g => g._id === u._id)).length === 0 ? (
                                        <div className="text-gray-400 text-sm px-2 py-2">No users available</div>
                                      ) : (
                                        users.filter(u => !task.guides?.some(g => g._id === u._id)).map(u => (
                                          <div
                                            key={u._id}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 8,
                                              padding: '6px 8px',
                                              borderRadius: 6,
                                              cursor: 'pointer',
                                              background: 'transparent',
                                              marginBottom: 2,
                                              transition: 'background 0.15s',
                                            }}
                                            onClick={async e => {
                                              e.stopPropagation();
                                              const newGuides = [...(task.guides?.map(g => g._id) || []), u._id];
                                              try {
                                                const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/guides`, {
                                                  method: 'PUT',
                                                  headers: {
                                                    'Content-Type': 'application/json',
                                                    Authorization: `Bearer ${currentUser.token}`,
                                                  },
                                                  body: JSON.stringify({ guides: newGuides }),
                                                });
                                                if (!response.ok) throw new Error('Failed to update guides');
                                                const updatedTask = await response.json();
                                                if (onTaskUpdate) onTaskUpdate(task._id, (prevTask) => ({ ...prevTask, guides: updatedTask.guides }));
                                                toast.success('Guide added');
                                              } catch (err) {
                                                toast.error('Failed to update guides');
                                              }
                                            }}
                                          >
                                            <img src={u?.photo?.url || defaultProfile} alt={`${u.firstName} ${u.lastName}`} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" style={{minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24}} />
                                            <span style={{fontSize: '14px'}}>{u.firstName} {u.lastName}</span>
                                          </div>
                                        ))
                                      )}
                                    </div>,
                                    document.body
                                  )}
                                </div>
                              </td>
                            );
                          
                            case 'files':
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                                  <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                    <div className="flex items-center">
                                      {task.files && task.files.length > 0 ? (
                                        <div className="flex items-center space-x-2">
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.files.length}</span>
                                          <button onClick={() => handleTaskClick(task)} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center">
                                          <span className="text-gray-400 text-sm italic">No files</span>
                                          <button onClick={() => handleTaskClick(task)} className="ml-2 text-blue-600 hover:text-blue-800 text-sm">Upload</button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              );
                            
                            case 'comments':
                              return (
                                <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                                  <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.comments ? task.comments.length : 0} </span>
                                      <button onClick={() => { setSelectedTask(task); setShowComments(true); }} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                                    </div>
                                  </div>
                                </td>
                              );
                            
                            default:
                              // Check if this is a custom column
                              if (colId.startsWith('custom_')) {
                                const customColumnName = colId.replace('custom_', '');
                                const columnDef = customColumns.find(col => col.name === customColumnName);
                                const customValue = task.customFields?.[customColumnName];
                                
                                if (columnDef) {
                                  return (
                                    <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} 
                                        style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}>
                                      <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                        {columnDef.type === 'checkbox' ? (
                                          <input 
                                            type="checkbox" 
                                            checked={customValue || false}
                                            onChange={async (e) => {
                                              const newValue = e.target.checked;
                                              const prevValue = customValue;
                                              // Optimistically update local state
                                              if (onTaskUpdate) {
                                                onTaskUpdate(task._id, (prevTask) => ({
                                                  ...prevTask,
                                                  customFields: {
                                                    ...prevTask.customFields,
                                                    [customColumnName]: newValue
                                                  }
                                                }));
                                              }
                                              // Save to MongoDB
                                              try {
                                                const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/custom-fields`, {
                                                  method: 'PATCH',
                                                  headers: {
                                                    'Content-Type': 'application/json',
                                                    Authorization: `Bearer ${user.token}`,
                                                  },
                                                  body: JSON.stringify({
                                                    customFields: {
                                                      ...task.customFields,
                                                      [customColumnName]: newValue
                                                    }
                                                  })
                                                });
                                                if (!response.ok) {
                                                  // Revert local state if failed
                                                  if (onTaskUpdate) {
                                                    onTaskUpdate(task._id, (prevTask) => ({
                                                      ...prevTask,
                                                      customFields: {
                                                        ...prevTask.customFields,
                                                        [customColumnName]: prevValue
                                                      }
                                                    }));
                                                  }
                                                  toast.error('Failed to save changes');
                                                }
                                              } catch (error) {
                                                // Revert local state if error
                                                if (onTaskUpdate) {
                                                  onTaskUpdate(task._id, (prevTask) => ({
                                                    ...prevTask,
                                                    customFields: {
                                                      ...prevTask.customFields,
                                                      [customColumnName]: prevValue
                                                    }
                                                  }));
                                                }
                                                toast.error('Failed to save changes');
                                              }
                                            }}
                                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                          />
                                        ) : columnDef.type === 'tags' ? (
                                          // Tags dropdown (similar to priority)
                                          <div 
                                            style={{ 
                                              cursor: 'pointer',
                                              position: 'relative',
                                              zIndex: (editingCustomTagsTaskId === task._id && editingCustomTagsColumnName === customColumnName) ? 50 : 'auto',
                                            }}
                                            onClick={e => {
                                              e.stopPropagation();
                                              const rect = e.currentTarget.getBoundingClientRect();
                                              setDropdownPosition({
                                                top: rect.bottom + window.scrollY,
                                                left: rect.left + window.scrollX,
                                              });
                                              setEditingCustomTagsTaskId(task._id);
                                              setEditingCustomTagsColumnName(customColumnName);
                                            }}
                                          >
                                            <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                              {customValue || columnDef.defaultValue || 'Select...'}
                                            </span>
                                            
                                            {/* Show dropdown as portal if open */}
                                            {editingCustomTagsTaskId === task._id && editingCustomTagsColumnName === customColumnName && ReactDOM.createPortal(
                                              <div
                                                ref={priorityDropdownRef}
                                                style={{
                                                  position: 'absolute',
                                                  top: dropdownPosition.top,
                                                  left: dropdownPosition.left,
                                                  minWidth: 160,
                                                  background: '#fff',
                                                  border: '1px solid #e5e7eb',
                                                  borderRadius: 8,
                                                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                                  padding: 8,
                                                  zIndex: 9999,
                                                }}
                                              >
                                                {columnDef.options && columnDef.options.map(option => (
                                                  <div
                                                    key={option}
                                                    style={{
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      gap: 8,
                                                      padding: '5px 12px',
                                                      borderRadius: 6,
                                                      cursor: 'pointer',
                                                      background: customValue === option ? '#f3f4f6' : 'transparent',
                                                      marginBottom: 2,
                                                      transition: 'background 0.15s',
                                                    }}
                                                    onClick={e => {
                                                      e.stopPropagation();
                                                      if (customValue !== option) {
                                                        handleCustomTagsChange(task, customColumnName, option);
                                                      }
                                                      setEditingCustomTagsTaskId(null);
                                                      setEditingCustomTagsColumnName('');
                                                    }}
                                                    onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                                    onMouseLeave={e => e.currentTarget.style.background = customValue === option ? '#f3f4f6' : 'transparent'}
                                                  >
                                                    <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                      {option}
                                                    </span>
                                                    {customValue === option && (
                                                      <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                      </svg>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>,
                                              document.body
                                            )}
                                          </div>
                                        ) : (
                                          // Text field with click-to-edit (similar to description)
                                          <>
                                            {editingCustomTextTaskId === task._id && editingCustomTextColumnName === customColumnName ? (
                                              <input
                                                type="text"
                                                className="w-full text-sm border-none outline-none bg-white p-1"
                                                value={editingCustomTextValue}
                                                style={{ height: '28px' }}
                                                onChange={e => setEditingCustomTextValue(e.target.value)}
                                                onBlur={() => handleCustomTextEditSave(task, customColumnName)}
                                                onKeyDown={(e) => {
                                                  if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleCustomTextEditSave(task, customColumnName);
                                                  } else if (e.key === 'Escape') {
                                                    setEditingCustomTextTaskId(null);
                                                    setEditingCustomTextColumnName('');
                                                    setEditingCustomTextValue('');
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <div
                                                className="cursor-pointer min-h-[28px] p-1 flex items-center"
                                                onClick={() => {
                                                  setEditingCustomTextTaskId(task._id);
                                                  setEditingCustomTextColumnName(customColumnName);
                                                  setEditingCustomTextValue(customValue || columnDef.defaultValue || '');
                                                }}
                                              >
                                                {customValue || columnDef.defaultValue || ''}
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  );
                                }
                              }
                              
                              // Default column handling
                              let cellValue = task[colId];
                              if ([
                                'thirdVerificationAssignedTo',
                                'fourthVerificationAssignedTo',
                                'fifthVerificationAssignedTo'
                              ].includes(colId)) {
                                cellValue = cellValue ? (cellValue.firstName ? `${cellValue.firstName} ${cellValue.lastName}` : cellValue) : 'NA';
                              }
                              return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{cellValue}</span></div></td>;
                          }
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                    );
                  }).filter(Boolean);
                })()
              ) : (
                orderedTasks.slice(0, loadedTasksCount).map((task, idx) => (
                  <tr
                    key={task._id}
                    className={`task-row-transition border-b border-gray-200 hover:bg-gray-50 transition-none ${dragOverTaskId === task._id && draggedTaskId ? DRAG_ROW_CLASS : ''} ${enableBulkSelection && selectedTasks.includes(task._id) ? 'bg-blue-50' : ''} ${highlightedTaskId === task._id ? 'bg-blue-100 shadow-lg ring-2 ring-blue-400 animate-pulse' : ''} ${hiddenTaskIds.has(task._id) ? 'task-row-hidden' : 'task-row-visible'}`}
                    draggable
                    onDragStart={e => handleRowDragStart(e, task._id)}
                    onDragOver={e => handleRowDragOver(e, task._id)}
                    onDrop={e => handleRowDrop(e, task._id)}
                    onDragEnd={handleRowDragEnd}
                    style={{ opacity: draggedTaskId === task._id ? 0.5 : 1 }}
                  >
                    {enableBulkSelection && (
                      <td className="px-2 py-1 text-sm font-normal align-middle bg-white border-r border-gray-200" style={{width: '48px', minWidth: '48px'}}>
                        <input
                          type="checkbox"
                          checked={selectedTasks.includes(task._id)}
                          onChange={(e) => onTaskSelect && onTaskSelect(task._id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          onClick={(e) => e.stopPropagation()}
                          title={selectedTasks.includes(task._id) ? "Deselect task" : "Select task"}
                        />
                      </td>
                    )}
                    <td
                      className="px-2 py-1 text-sm font-normal align-middle bg-white border-r border-gray-200 text-gray-500 cursor-pointer hover:bg-gray-100"
                      style={{width: '48px', minWidth: '48px', textAlign: 'right'}}
                      title="Left click to edit, right click for delete option"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditTask(task);
                          }}
                      onContextMenu={(e) => {
                        e.stopPropagation();
                        handleNoColumnRightClick(e, task);
                      }}
                    >
                      {idx + 1}
                    </td>
                  {/* ...existing code... */}
                    {getOrderedVisibleColumns().map((colId, idx2, arr) => {
                      const col = ALL_COLUMNS.find(c => c.id === colId);
                      if (!col) return null;
                      const isLast = idx2 === arr.length - 1;
                      
                      switch (colId) {
                        case 'title':
                          return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{verticalAlign: 'middle', width: (columnWidths[colId] || 256) + 'px', minWidth: (columnWidths[colId] || 256) + 'px', maxWidth: (columnWidths[colId] || 256) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.title}</span></div></td>;
                      
                        case 'description':
                          return (
                            <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white border-0 ${!isLast ? 'border-r border-gray-200' : ''}`} style={{verticalAlign: 'middle', width: (columnWidths[colId] || 180) + 'px', minWidth: (columnWidths[colId] || 180) + 'px', maxWidth: (columnWidths[colId] || 180) + 'px', background: 'white', overflow: 'hidden'}}>
                              {editingDescriptionTaskId === task._id ? (
                                <input
                                  type="text"
                                  value={editingDescriptionValue}
                                  autoFocus
                                  onChange={e => setEditingDescriptionValue(e.target.value)}
                                  onBlur={() => handleDescriptionEditSave(task)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      handleDescriptionEditSave(task);
                                    }
                                  }}
                                  className="no-border-input w-full bg-white px-1 py-1 rounded"
                                  style={{fontSize: 'inherit', height: '28px'}}
                                />
                              ) : (
                                <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                  <span
                                    className="cursor-pointer block"
                                    onClick={() => {
                                      setEditingDescriptionTaskId(task._id);
                                      setEditingDescriptionValue(task.description || '');
                                    }}
                                    title="Click to edit"
                                    style={{ minHeight: '14px', color: !task.description ? '#aaa' : undefined, fontSize: 'inherit' }}
                                  >
                                    {task.description && task.description.trim() !== '' ? task.description : <span style={{fontStyle: 'italic', fontSize: 'inherit'}}></span>}
                                  </span>
                                </div>
                              )}
                            </td>
                          );
                      
                      case 'clientName':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span className="text-sm font-medium text-gray-900">{task.clientName}</span></div></td>;
                      
                      case 'clientGroup':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span className="text-sm text-gray-500">{task.clientGroup}</span></div></td>;
                      
                      case 'workType':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex gap-1">{task.workType && task.workType.map((type, index) => (<span key={index} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">{type}</span>))}</div></div></td>;
                      
                      case 'billed':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 80) + 'px', minWidth: (columnWidths[colId] || 80) + 'px', maxWidth: (columnWidths[colId] || 80) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{task.billed ? 'Yes' : 'No'}</span></div></td>;
                      
                      case 'status':
                        // Show colored status but disable interaction in 'Task Issued For Verification' and 'Task For Guidance' tabs in Received Tasks
                        // Allow interaction in 'completed' tab
                        if (
                          viewType === 'received' &&
                          (taskType === 'issuedVerification' || taskType === 'guidance')
                        ) {
                          return (
                            <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                              style={{ width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden' }}>
                              <div className="overflow-x-auto whitespace-nowrap" style={{ width: '100%', maxWidth: '100%' }}>
                                <span 
                                  className={`inline-block px-2 py-1 rounded-4xl text-xs font-semibold ${getStatusColor(task.status) || ''}`}
                                  style={getStatusStyles(task.status) || {}}
                                >
                                  {currentStatusOptions.find(opt => opt.value === task.status)?.label || task.status}
                                </span>
              </div>
                            </td>
                          );
                        }
                        return (
                          <td
                            key={colId}
                            className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{
                              width: (columnWidths[colId] || 120) + 'px',
                              minWidth: (columnWidths[colId] || 120) + 'px',
                              maxWidth: (columnWidths[colId] || 120) + 'px',
                              background: 'white',
                              overflow: 'visible',
                              cursor: viewType === 'received' ? 'pointer' : 'default',
                              position: 'relative',
                              zIndex: editingStatusTaskId === task._id ? 50 : 'auto',
                            }}
                            onClick={e => {
                              if (viewType === 'received') {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.left + window.scrollX,
                                });
                                setEditingStatusTaskId(task._id);
                              }
                            }}
                          >
                            <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status) || ''}`}
                                style={{
                                  display: 'inline-block',
                                  whiteSpace: 'nowrap',
                                  overflowX: 'auto',
                                  ...getStatusStyles(task.status),
                                  textOverflow: 'ellipsis',
                                  maxWidth: '100%',
                                  verticalAlign: 'middle',
                                  scrollbarWidth: 'thin',
                                  msOverflowStyle: 'auto',
                                }}
                                title={currentStatusOptions.find(opt => opt.value === task.status)?.label || task.status}
                              >
                                {currentStatusOptions.find(opt => opt.value === task.status)?.label || task.status}
                              </span>
                              {/* Show dropdown as portal if open */}
                              {editingStatusTaskId === task._id && viewType === 'received' && (
                                <SearchableStatusDropdown
                                  task={task}
                                  currentStatusOptions={
                                    viewType === 'received' && taskType === 'execution'
                                      ? currentStatusOptions.filter(opt => opt.value !== 'reject')
                                      : currentStatusOptions
                                  }
                                  statusLoading={statusLoading}
                                  getStatusColor={getStatusColor}
                                  getStatusStyles={getStatusStyles}
                                  onStatusChange={handleStatusChangeLocal}
                                  onClose={() => setEditingStatusTaskId(null)}
                                  position={dropdownPosition}
                                />
                              )}
                            </div>
                          </td>
                        );
                      
                      case 'priority':
                        // Only allow editing if not in guidance or issuedVerification tab
                        const canEditPriority = viewType === 'received' && (taskType === 'execution' || taskType === 'receivedVerification');
                        return (
                          <td
                            key={colId}
                            className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{
                              width: (columnWidths[colId] || 120) + 'px',
                              minWidth: (columnWidths[colId] || 120) + 'px',
                              maxWidth: (columnWidths[colId] || 120) + 'px',
                              background: 'white',
                              overflow: 'visible',
                              cursor: canEditPriority ? 'pointer' : 'default',
                              position: 'relative',
                              zIndex: editingPriorityTaskId === task._id ? 50 : 'auto',
                            }}
                            onClick={e => {
                              if (canEditPriority) {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.left + window.scrollX,
                                });
                                setEditingPriorityTaskId(task._id);
                              }
                            }}
                          >
                            <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                              <span className={`inline-block px-2 py-1 rounded-4xl text-xs font-semibold ${getPriorityColor(task.priority)}`}>{getCurrentPriorityOptions().find(opt => opt.value === task.priority)?.label || task.priority}</span>
                            </div>
                            {/* Show dropdown as portal if open and canEditPriority */}
                            {editingPriorityTaskId === task._id && canEditPriority && ReactDOM.createPortal(
                              <div
                                ref={priorityDropdownRef}
                                style={{
                                  position: 'absolute',
                                  top: dropdownPosition.top,
                                  left: dropdownPosition.left,
                                  minWidth: 160,
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 8,
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                  padding: 8,
                                  zIndex: 9999,
                                }}
                              >
                                {getCurrentPriorityOptions().map(opt => (
                                  <div
                                    key={opt.value}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      background: task.priority === opt.value ? '#f3f4f6' : 'transparent',
                                      marginBottom: 2,
                                      transition: 'background 0.15s',
                                      opacity: priorityLoading ? 0.6 : 1,
                                    }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (!priorityLoading && task.priority !== opt.value) handlePriorityChange(task, opt.value);
                                      setEditingPriorityTaskId(null);
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                    onMouseLeave={e => e.currentTarget.style.background = task.priority === opt.value ? '#f3f4f6' : 'transparent'}
                                  >
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(opt.value)}`}>{opt.label}</span>
                                    {task.priority === opt.value && (
                                      <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    )}
                                  </div>
                                ))}
                              </div>,
                              document.body
                            )}
                          </td>
                        );
                      
                      case 'verification':
                        // Allow any user to edit verification in received tasks page
                        const canEditVerification = viewType === 'received';
                        return (
                          <td
                            key={colId}
                            className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{
                              width: (columnWidths[colId] || 130) + 'px',
                              minWidth: (columnWidths[colId] || 130) + 'px',
                              maxWidth: (columnWidths[colId] || 130) + 'px',
                              background: 'white',
                              overflow: 'visible',
                              cursor: canEditVerification ? 'pointer' : 'default',
                              position: 'relative',
                              zIndex: editingVerificationTaskId === task._id ? 50 : 'auto',
                            }}
                            onClick={e => {
                              if (canEditVerification) {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.left + window.scrollX,
                                });
                                setEditingVerificationTaskId(task._id);
                              }
                            }}
                          >
                            <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getVerificationColor(task.verification || 'pending')}`}>
                                {VERIFICATION_OPTIONS.find(opt => opt.value === (task.verification || 'pending'))?.label || (task.verification || 'pending')}
                              </span>
                            </div>
                            {/* Show dropdown as portal if open and canEditVerification */}
                            {editingVerificationTaskId === task._id && canEditVerification && ReactDOM.createPortal(
                              <div
                                ref={verificationDropdownRef}
                                style={{
                                  position: 'absolute',
                                  top: dropdownPosition.top,
                                  left: dropdownPosition.left,
                                  minWidth: 160,
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 8,
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                  padding: 8,
                                  zIndex: 9999,
                                }}
                              >
                                {getVerificationOptions(task, currentUser).map(opt => (
                                  <div
                                    key={opt.value}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '5px 12px',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      background: (task.verification || 'pending') === opt.value ? '#f3f4f6' : 'transparent',
                                      marginBottom: 2,
                                      transition: 'background 0.15s',
                                      opacity: verificationLoading ? 0.6 : 1,
                                    }}
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (!verificationLoading && (task.verification || 'pending') !== opt.value) {
                                        handleVerificationChange(task, opt.value);
                                      }
                                      setEditingVerificationTaskId(null);
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                    onMouseLeave={e => e.currentTarget.style.background = (task.verification || 'pending') === opt.value ? '#f3f4f6' : 'transparent'}
                                  >
                                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getVerificationColor(opt.value)}`}>
                                      {opt.label}
                                    </span>
                                    {(task.verification || 'pending') === opt.value && (
                                      <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                ))}
                              </div>,
                              document.body
                            )}
                          </td>
                        );
                      
                      case 'selfVerification':
                        const canEditSelfVerification = viewType === 'received' && taskType === 'execution';
                        
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                            <div className="flex justify-center items-center">
                              <input
                                type="checkbox"
                                checked={!!task.selfVerification}
                                disabled={!!task.selfVerification || !canEditSelfVerification || isUpdating2}
                                onChange={(!task.selfVerification && canEditSelfVerification) ? async (e) => {
                                  const checked = e.target.checked;
                                  setIsUpdating2(true);
                                  try {
                                    const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}`, {
                                      method: 'PUT',
                                      headers: {
                                        'Content-Type': 'application/json',
                                        Authorization: `Bearer ${user.token}`,
                                      },
                                      body: JSON.stringify({ selfVerification: checked }),
                                    });
                                    if (!response.ok) throw new Error('Failed to update self verification');
                                    const updatedTask = await response.json();
                                    console.log('Updated task received:', updatedTask);
                                    // Update task in state immediately
                                    if (onTaskUpdate) {
                                      onTaskUpdate(task._id, (prevTask) => ({
                                        ...prevTask,
                                        selfVerification: updatedTask.selfVerification
                                      }));
                                    }
                                    // Also force refresh of tasks if refetchTasks is available
                                    if (refetchTasks) {
                                      setTimeout(() => refetchTasks(), 200);
                                    }
                                    
                                    toast.success('Self Verification updated');
                                  } catch (err) {
                                    console.error('Error updating self verification:', err);
                                    toast.error('Failed to update Self Verification');
                                    // Revert checkbox state on error by forcing a re-render
                                    if (refetchTasks) {
                                      refetchTasks();
                                    }
                                  } finally {
                                    setIsUpdating2(false);
                                  }
                                } : undefined}
                              />
                            </div>
                          </td>
                        );
                      
                      case 'inwardEntryDate':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDateTime(task.inwardEntryDate)}</span></div></td>;
                      
                      case 'dueDate':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDate(task.dueDate)}</span></div></td>;
                      
                      case 'targetDate':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{formatDate(task.targetDate)}</span></div></td>;
                      
                      case 'assignedBy':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex items-center"><img src={task?.assignedBy?.photo?.url || defaultProfile} alt={task?.assignedBy?.firstName} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} /><span className="ml-2">{task?.assignedBy?.firstName} {task?.assignedBy?.lastName}</span></div></div></td>;
                      
                      case 'assignedTo':
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><div className="flex items-center"><img src={task?.assignedTo?.photo?.url || defaultProfile} alt={task?.assignedTo?.firstName} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} /><span className="ml-2">{task?.assignedTo?.firstName} {task?.assignedTo?.lastName}<span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">{getUserTaskHours(task?._id, task?.assignedTo?._id)}h</span></span></div></div></td>;
                      
                      case 'verificationAssignedTo':
                      case 'secondVerificationAssignedTo':
                      case 'thirdVerificationAssignedTo':
                      case 'fourthVerificationAssignedTo':
                      case 'fifthVerificationAssignedTo': {
                        // Map column to index (0-based)
                        const verifierFields = [
                          'verificationAssignedTo',
                          'secondVerificationAssignedTo',
                          'thirdVerificationAssignedTo',
                          'fourthVerificationAssignedTo',
                          'fifthVerificationAssignedTo',
                        ];
                        const colIdx = verifierFields.indexOf(colId);
                        const currVerifierField = verifierFields[colIdx];
                        const prevVerifierField = verifierFields[colIdx - 1];

                        // Show dropdown if:
                        // 1. For first verifier: selfVerification must be true (for execution tab)
                        // 2. For receivedVerification tab: if current user is the first verifier, allow dropdown
                        // 3. Current user is the assigned verifier for this column (nth)
                        // 4. OR, current user is the previous verifier and this column is unassigned (N+1th)
                        let userIsThisVerifier = task[currVerifierField]?._id === currentUser?._id;
                        let userIsPrevVerifier = colIdx > 0 && task[prevVerifierField]?._id === currentUser?._id && !task[currVerifierField];
                        let canEditThisVerifier =
                          viewType === 'received' &&
                          (userIsThisVerifier || userIsPrevVerifier) &&
                          taskType !== 'completed' &&
                          taskType !== 'guidance' &&
                          taskType !== 'issuedVerification';
                        
                        // For first verifier, require selfVerification (for execution tab)
                        if (colId === 'verificationAssignedTo') {
                          canEditThisVerifier =
                            (viewType === 'received' && taskType === 'execution' && !!task.selfVerification)
                            || (viewType === 'received' && taskType === 'receivedVerification' && userIsThisVerifier)
                            || (viewType === 'received' && taskType === 'issuedVerification' && task.assignedBy && task.assignedBy._id === currentUser?._id);
                        }
                        
                        // NEW: For issuedVerification tab, only allow editing the latest non-empty verifier
                        if (taskType === 'issuedVerification' && task.assignedBy && task.assignedBy._id === currentUser?._id) {
                          // Find the latest non-empty verifier
                          let latestNonEmptyVerifierIndex = -1;
                          for (let i = verifierFields.length - 1; i >= 0; i--) {
                            if (task[verifierFields[i]]) {
                              latestNonEmptyVerifierIndex = i;
                              break;
                            }
                          }
                          
                          // Only allow editing the latest non-empty verifier
                          if (latestNonEmptyVerifierIndex !== -1 && colIdx === latestNonEmptyVerifierIndex) {
                            canEditThisVerifier = true;
                          } else if (latestNonEmptyVerifierIndex !== -1) {
                            canEditThisVerifier = false; // Don't allow editing other verifiers
                          }
                        }
                        
                        // NEW: For execution tab with verification accepted, allow next empty verifier assignment
                        if (taskType === 'execution' && task.verification === 'accepted') {
                          // Find the next empty verifier position
                          let nextEmptyVerifierIndex = -1;
                          for (let i = 0; i < verifierFields.length; i++) {
                            if (!task[verifierFields[i]]) {
                              nextEmptyVerifierIndex = i;
                              break;
                            }
                          }
                          
                          // Only allow dropdown for the next empty verifier position
                          if (colIdx === nextEmptyVerifierIndex && nextEmptyVerifierIndex !== -1) {
                            canEditThisVerifier = true;
                          } else if (task.verification === 'accepted') {
                            canEditThisVerifier = false; // Don't allow editing other verifiers when verification is accepted
                          }
                        }
                        
                        // NEW: For receivedVerification tab, handle verification status logic
                        if (taskType === 'receivedVerification') {
                          // Always allow current verifier to reassign themselves
                          if (userIsThisVerifier) {
                            canEditThisVerifier = true;
                          }
                          // For "next verification", allow assigning the next verifier in sequence
                          else if (task.verification === 'next verification') {
                            // Find current verifier
                            let currentVerifierIndex = -1;
                            verifierFields.forEach((field, idx) => {
                              if (task[field]?._id === currentUser?._id) {
                                currentVerifierIndex = idx;
                              }
                            });
                            
                            // Only allow dropdown for the next verifier after current verifier
                            const nextVerifierIndex = currentVerifierIndex + 1;
                            if (colIdx === nextVerifierIndex && nextVerifierIndex < verifierFields.length) {
                              canEditThisVerifier = true;
                            } else {
                              canEditThisVerifier = false;
                            }
                          }
                          // For other verification statuses, don't allow next verifier assignment
                          else if (!userIsThisVerifier) {
                            canEditThisVerifier = false;
                          }
                        }

                        // Exclude assignedTo and all already assigned verifiers
                        const assignedVerifierIds = getAssignedVerifierIds(task);
                        const dropdownUsers = users.filter(
                          (u) =>
                            u._id !== task.assignedTo?._id &&
                            !assignedVerifierIds.includes(u._id) &&
                            u._id !== currentUser?._id &&
                            (`${u.firstName} ${u.lastName}`.toLowerCase().includes(verifierSearch.toLowerCase()))
                        );

                        if (canEditThisVerifier) {
                          return (
                            <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                              style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden', cursor: 'pointer', position: 'relative', zIndex: editingVerifierTaskId === `${task._id}-${colId}` ? 50 : 'auto'}}
                              onClick={e => {
                                e.stopPropagation();
                                const rect = e.currentTarget.getBoundingClientRect();
                                setVerifierDropdownPosition({
                                  top: rect.bottom + window.scrollY,
                                  left: rect.left + window.scrollX,
                                });
                                setEditingVerifierTaskId(`${task._id}-${colId}`);
                                setVerifierSearch('');
                              }}
                            >
                              <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                <div className="flex items-center ">
                                  {task[colId] ? (
                                    <>
                                      <img
                                        src={task[colId]?.photo?.url || defaultProfile}
                                        alt={`${task[colId].firstName} ${task[colId].lastName}`}
                                        className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
                                        onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }}
                                      />
                                      <span className="ml-2">
                                        {task[colId].firstName} {task[colId].lastName}
                                        <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                          {getUserTaskHours(task._id, task[colId]._id)}h
                                        </span>
                                      </span>
                                    </>
                                  ) : (
                                    <span style={{fontStyle: 'italic', fontSize: 'inherit'}}>NA</span>
                                  )}
                                  <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="ml-1 text-gray-400"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                                {/* Dropdown for selecting verifier */}
                                {editingVerifierTaskId === `${task._id}-${colId}` && ReactDOM.createPortal(
                                  <div
                                    ref={verifierDropdownRef}
                                    style={{
                                      position: 'absolute',
                                      top: verifierDropdownPosition.top,
                                      left: verifierDropdownPosition.left,
                                      minWidth: 200,
                                      background: '#fff',
                                      border: '1px solid #e5e7eb',
                                      borderRadius: 8,
                                      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                      padding: 8,
                                      zIndex: 9999,
                                      maxHeight: 300,
                                      overflowY: 'auto',
                                    }}
                                  >
                                    {dropdownUsers.length === 0 ? (
                                      <div className="text-gray-400 text-sm px-2 py-2">No users found</div>
                                    ) : (
                                      dropdownUsers.map(u => (
                                        <div
                                          key={u._id}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            padding: '6px 8px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            background: task[colId] && task[colId]._id === u._id ? '#f3f4f6' : 'transparent',
                                            marginBottom: 2,
                                            transition: 'background 0.15s',
                                            opacity: verifierLoading ? 0.6 : 1,
                                          }}
                                          onClick={async e => {
                                            e.stopPropagation();
                                            if (verifierLoading || (task[colId] && task[colId]._id === u._id)) return;
                                            setVerifierLoading(true);
                                            try {
                                              // Prepare the request body
                                              const requestBody = { [colId]: u._id };
                                              
                                              // If this is execution tab with verification accepted, also set verification to pending
                                              if (taskType === 'execution' && task.verification === 'accepted') {
                                                requestBody.verification = 'pending';
                                              }
                                              
                                              const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/verifier`, {
                                                method: 'PATCH',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  Authorization: `Bearer ${currentUser.token}`,
                                                },
                                                body: JSON.stringify(requestBody),
                                              });
                                              if (!response.ok) throw new Error('Failed to update verifier');
                                              const updatedTask = await response.json();
                                              if (onTaskUpdate) onTaskUpdate(task._id, () => updatedTask);
                                              toast.success(`${col.label} updated`);
                                              if (refetchTasks) refetchTasks();
                                            } catch (err) {
                                              toast.error(`Failed to update ${col.label.toLowerCase()}`);
                                            }
                                            setVerifierLoading(false);
                                            setEditingVerifierTaskId(null);
                                          }}
                                          onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                          onMouseLeave={e => e.currentTarget.style.background = (task[colId] && task[colId]._id === u._id) ? '#f3f4f6' : 'transparent'}
                                        >
                                          <img src={u?.photo?.url || defaultProfile} alt={`${u.firstName} ${u.lastName}`} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" style={{minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24}} />
                                          <span style={{fontSize: '14px'}}>{u.firstName} {u.lastName}</span>
                                          {task[colId] && task[colId]._id === u._id && (
                                            <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                          )}
                                        </div>
                                      ))
                                    )}
                                  </div>,
                                  document.body
                                )}
                              </div>
                            </td>
                          );
                        }
                        // Otherwise, just show the value
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}>
                            <div className="overflow-x-auto whitespace-nowrap flex items-center" style={{width: '100%', maxWidth: '100%'}}>
                              {task[colId] ? (
                                <>
                                  <img src={task[colId]?.photo?.url || defaultProfile} alt={`${task[colId].firstName} ${task[colId].lastName}`} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                                  <span className="ml-2">
                                    {task[colId].firstName} {task[colId].lastName}
                                    <span className="ml-1 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                      {getUserTaskHours(task._id, task[colId]._id)}h
                                    </span>
                                  </span>
                                </>
                              ) : (
                                <span style={{fontStyle: 'italic', fontSize: 'inherit'}}>NA</span>
                              )}
                            </div>
                          </td>
                        );
                      }
                      case 'guides':
                        const guideChipsClass = viewType === 'received' ? 'pr-6' : 'pr-0';
                        const guideChipsMaxWidth = viewType === 'received' ? 'calc(100% - 28px)' : '100%';
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`}
                            style={{width: (columnWidths[colId] || 200) + 'px', minWidth: (columnWidths[colId] || 200) + 'px', maxWidth: (columnWidths[colId] || 200) + 'px', background: 'white', overflow: 'hidden'}}>
                          <div className="flex items-center relative" style={{width: '100%', maxWidth: '100%'}}>
                            {/* Scrollable chips */}
                            <div className={`flex items-center gap-1 overflow-x-auto whitespace-nowrap ${guideChipsClass}`} style={{maxWidth: guideChipsMaxWidth}}>
                              {Array.isArray(task.guides) && task.guides.length > 0 ? (
                                task.guides.map(u => (
                                  <span key={u._id} className="flex items-center bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 text-xs font-medium mr-1">
                                    <img src={u?.photo?.url || defaultProfile} alt={u.firstName} className="w-5 h-5 rounded-full object-cover mr-1" style={{minWidth: 20, minHeight: 20}} onError={e => { e.target.onerror = null; e.target.src = defaultProfile; }} />
                                    {u.firstName} {u.lastName}
                                    {viewType === 'received' && (
                                      <button
                                        className="ml-1 text-red-500 hover:text-red-700 focus:outline-none"
                                        style={{fontSize: '12px'}}
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const newGuides = task.guides.filter(g => g._id !== u._id).map(g => g._id);
                                          try {
                                            const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/guides`, {
                                              method: 'PUT',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${currentUser.token}`,
                                              },
                                              body: JSON.stringify({ guides: newGuides }),
                                            });
                                            if (!response.ok) throw new Error('Failed to update guides');
                                            const updatedTask = await response.json();
                                            if (onTaskUpdate) onTaskUpdate(task._id, (prevTask) => ({ ...prevTask, guides: updatedTask.guides }));
                                            toast.success('Guide removed');
                                          } catch (err) {
                                            toast.error('Failed to update guides');
                                          }
                                        }}
                                        title="Remove guide"
                                      >×</button>
                                    )}
                                  </span>
                                ))
                              ) : (
                                <span className="italic text-gray-400">No guide</span>
                              )}
                            </div>
                            {/* Fixed dropdown icon at end, only in received viewType */}
                            {viewType === 'received' && (
                              <button
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1 bg-white rounded-full border border-gray-200 hover:bg-blue-100 hover:border-blue-400 transition-colors cursor-pointer z-10"
                                style={{boxShadow: '0 1px 4px rgba(0,0,0,0.04)'}}
                                onClick={e => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDropdownPosition({
                                    top: rect.bottom + window.scrollY,
                                    left: rect.left + window.scrollX,
                                  });
                                  setOpenGuideDropdownTaskId(task._id);
                                }}
                                title="Add/Remove Guides"
                              >
                                <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" className="text-gray-500 group-hover:text-blue-600 transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                              </button>
                            )}
                            {/* Dropdown for selecting guides */}
                            {viewType === 'received' && openGuideDropdownTaskId === task._id && ReactDOM.createPortal(
                              <div
                                ref={guideDropdownRef}
                                style={{
                                  position: 'absolute',
                                  top: dropdownPosition.top,
                                  left: dropdownPosition.left,
                                  minWidth: 220,
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 8,
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                  padding: 8,
                                  zIndex: 9999,
                                  maxHeight: 300,
                                  overflowY: 'auto',
                                }}
                              >
                                {users.filter(u => !task.guides?.some(g => g._id === u._id)).length === 0 ? (
                                  <div className="text-gray-400 text-sm px-2 py-2">No users available</div>
                                ) : (
                                  users.filter(u => !task.guides?.some(g => g._id === u._id)).map(u => (
                                    <div
                                      key={u._id}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: '6px 8px',
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                        background: 'transparent',
                                        marginBottom: 2,
                                        transition: 'background 0.15s',
                                      }}
                                      onClick={async e => {
                                        e.stopPropagation();
                                        const newGuides = [...(task.guides?.map(g => g._id) || []), u._id];
                                        try {
                                          const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/guides`, {
                                            method: 'PUT',
                                            headers: {
                                              'Content-Type': 'application/json',
                                              Authorization: `Bearer ${currentUser.token}`,
                                            },
                                            body: JSON.stringify({ guides: newGuides }),
                                          });
                                          if (!response.ok) throw new Error('Failed to update guides');
                                          const updatedTask = await response.json();
                                          if (onTaskUpdate) onTaskUpdate(task._id, (prevTask) => ({ ...prevTask, guides: updatedTask.guides }));
                                          toast.success('Guide added');
                                        } catch (err) {
                                          toast.error('Failed to update guides');
                                        }
                                      }}
                                    >
                                      <img src={u.photo?.url || defaultProfile} alt={`${u.firstName} ${u.lastName}`} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" style={{minWidth: 24, minHeight: 24, maxWidth: 24, maxHeight: 24}} />
                                      <span style={{fontSize: '14px'}}>{u.firstName} {u.lastName}</span>
                                    </div>
                                  ))
                                )}
                              </div>,
                              document.body
                            )}
                          </div>
                        </td>
                      );
                    
                      case 'files':
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                            <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                              <div className="flex items-center">
                                {task.files && task.files.length > 0 ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.files.length}</span>
                                    <button onClick={() => handleTaskClick(task)} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                                  </div>
                                ) : (
                                  <div className="flex items-center">
                                    <span className="text-gray-400 text-sm italic">No files</span>
                                    <button onClick={() => handleTaskClick(task)} className="ml-2 text-blue-600 hover:text-blue-800 text-sm">Upload</button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      
                      case 'comments':
                        return (
                          <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}>
                            <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{task.comments ? task.comments.length : 0} </span>
                                <button onClick={() => { setSelectedTask(task); setShowComments(true); }} className="text-blue-600 hover:text-blue-800 text-sm">View</button>
                              </div>
                            </div>
                          </td>
                        );
                      
                      default:
                        // Check if this is a custom column
                        if (colId.startsWith('custom_')) {
                          const customColumnName = colId.replace('custom_', '');
                          const columnDef = customColumns.find(col => col.name === customColumnName);
                          const customValue = task.customFields?.[customColumnName];
                          
                          if (columnDef) {
                            return (
                              <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} 
                                  style={{width: (columnWidths[colId] || 150) + 'px', minWidth: (columnWidths[colId] || 150) + 'px', maxWidth: (columnWidths[colId] || 150) + 'px', background: 'white', overflow: 'hidden'}}>
                                <div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}>
                                  {columnDef.type === 'checkbox' ? (
                                    <input 
                                      type="checkbox" 
                                      checked={customValue || false}
                                      onChange={async (e) => {
                                        // Handle checkbox change
                                        const newValue = e.target.checked;
                                        if (onTaskUpdate) {
                                          // Update local state immediately
                                          onTaskUpdate(task._id, (prevTask) => ({
                                            ...prevTask,
                                            customFields: {
                                              ...prevTask.customFields,
                                              [customColumnName]: newValue
                                            }
                                          }));
                                          
                                          // Update backend
                                          try {
                                            const response = await fetch(`${API_BASE_URL}/api/tasks/${task._id}/custom-fields`, {
                                              method: 'PATCH',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                Authorization: `Bearer ${user.token}`,
                                              },
                                              body: JSON.stringify({
                                                customFields: { [customColumnName]: newValue }
                                              }),
                                            });
                                            if (!response.ok) {
                                              throw new Error('Failed to update custom field');
                                            }
                                          } catch (error) {
                                            console.error('Error updating custom field:', error);
                                            // Revert the change on error
                                            onTaskUpdate(task._id, (prevTask) => ({
                                              ...prevTask,
                                              customFields: {
                                                ...prevTask.customFields,
                                                [customColumnName]: !newValue
                                              }
                                            }));
                                          }
                                        }
                                      }}
                                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                  ) : columnDef.type === 'tags' ? (
                                    // Tags dropdown (similar to priority)
                                    <div 
                                      style={{ 
                                        cursor: 'pointer',
                                        position: 'relative',
                                        zIndex: (editingCustomTagsTaskId === task._id && editingCustomTagsColumnName === customColumnName) ? 50 : 'auto',
                                      }}
                                      onClick={e => {
                                        e.stopPropagation();
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setDropdownPosition({
                                          top: rect.bottom + window.scrollY,
                                          left: rect.left + window.scrollX,
                                        });
                                        setEditingCustomTagsTaskId(task._id);
                                        setEditingCustomTagsColumnName(customColumnName);
                                      }}
                                    >
                                      <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                        {customValue || columnDef.defaultValue || 'Select...'}
                                      </span>
                                      
                                      {/* Show dropdown as portal if open */}
                                      {editingCustomTagsTaskId === task._id && editingCustomTagsColumnName === customColumnName && ReactDOM.createPortal(
                                        <div
                                          ref={priorityDropdownRef}
                                          style={{
                                            position: 'absolute',
                                            top: dropdownPosition.top,
                                            left: dropdownPosition.left,
                                            minWidth: 160,
                                            background: '#fff',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: 8,
                                            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                                            padding: 8,
                                            zIndex: 9999,
                                          }}
                                        >
                                          {columnDef.options && columnDef.options.map(option => (
                                            <div
                                              key={option}
                                              style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '5px 12px',
                                                borderRadius: 6,
                                                cursor: 'pointer',
                                                background: customValue === option ? '#f3f4f6' : 'transparent',
                                                marginBottom: 2,
                                                transition: 'background 0.15s',
                                              }}
                                              onClick={e => {
                                                e.stopPropagation();
                                                if (customValue !== option) {
                                                  handleCustomTagsChange(task, customColumnName, option);
                                                }
                                                setEditingCustomTagsTaskId(null);
                                                setEditingCustomTagsColumnName('');
                                              }}
                                              onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                                              onMouseLeave={e => e.currentTarget.style.background = customValue === option ? '#f3f4f6' : 'transparent'}
                                            >
                                              <span className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                {option}
                                              </span>
                                              {customValue === option && (
                                                <svg width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </div>
                                          ))}
                                        </div>,
                                        document.body
                                      )}
                                    </div>
                                  ) : (
                                    // Text field with click-to-edit (similar to description)
                                    <>
                                      {editingCustomTextTaskId === task._id && editingCustomTextColumnName === customColumnName ? (
                                        <input
                                          type="text"
                                          className="w-full text-sm border-none outline-none bg-white p-1"
                                          value={editingCustomTextValue}
                                          style={{ height: '28px' }}
                                          onChange={e => setEditingCustomTextValue(e.target.value)}
                                          onBlur={() => handleCustomTextEditSave(task, customColumnName)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              handleCustomTextEditSave(task, customColumnName);
                                            } else if (e.key === 'Escape') {
                                              setEditingCustomTextTaskId(null);
                                              setEditingCustomTextColumnName('');
                                              setEditingCustomTextValue('');
                                            }
                                          }}
                                          autoFocus
                                        />
                                      ) : (
                                        <div
                                          className="cursor-pointer min-h-[28px] p-1 flex items-center"
                                          onClick={() => {
                                            setEditingCustomTextTaskId(task._id);
                                            setEditingCustomTextColumnName(customColumnName);
                                            setEditingCustomTextValue(customValue || columnDef.defaultValue || '');
                                          }}
                                        >
                                          {customValue || columnDef.defaultValue || ''}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            );
                          }
                        }
                        
                        // Default column handling
                        let cellValue = task[colId];
                        if ([
                          'thirdVerificationAssignedTo',
                          'fourthVerificationAssignedTo',
                          'fifthVerificationAssignedTo'
                        ].includes(colId)) {
                          cellValue = cellValue ? (cellValue.firstName ? `${cellValue.firstName} ${cellValue.lastName}` : cellValue) : 'NA';
                        }
                        return <td key={colId} className={`px-2 py-1 text-sm font-normal align-middle bg-white ${!isLast ? 'border-r border-gray-200' : ''}`} style={{width: (columnWidths[colId] || 120) + 'px', minWidth: (columnWidths[colId] || 120) + 'px', maxWidth: (columnWidths[colId] || 120) + 'px', background: 'white', overflow: 'hidden'}}><div className="overflow-x-auto whitespace-nowrap" style={{width: '100%', maxWidth: '100%'}}><span>{cellValue}</span></div></td>;
                    }
                  })}
                </tr>
              )))}
            </tbody>
          </table>
        </div>


        {/* Invisible trigger for auto-loading more tasks - moved above the Load More button for earlier triggering */}
        <div 
          ref={loadMoreTriggerRef} 
          className="w-full"
          style={{ height: '0px', marginTop: '0px', marginBottom: '0px' }}
        ></div>

        {/* Load More Button */}
        {(() => {
          const totalTasks = shouldGroup 
            ? Object.values(groupedTasks || {}).reduce((sum, tasks) => sum + tasks.length, 0)
            : orderedTasks.length;
          
          return shouldShowLoadMore(totalTasks) && (
            <div className="flex justify-center">
              
            </div>
          );
        })()}

        {/* File Upload and Comments Modal */}
        {selectedTask && (showFileUpload || showComments) && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">
                  {showFileUpload ? 'Task Files' : 'Task Comments'}
                </h2>
                <button
                  onClick={() => {
                    setSelectedTask(null);
                    setShowFileUpload(false);
                    setShowComments(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-6">
                {showFileUpload ? (
                  <>
                    <FileUpload
                      taskId={selectedTask._id}
                      onFileUploaded={handleFileUploaded}
                      onFileDeleted={handleFileDeleted}
                    />
                    {selectedTask.files && selectedTask.files.length > 0 && (
                      <div className="mt-4">
                        <FileList
                          taskId={selectedTask._id}
                          files={selectedTask.files}
                          onFileDeleted={handleFileDeleted}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <TaskComments taskId={selectedTask._id} />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Verification Remarks Modal */}
        <VerificationRemarksModal
          isOpen={showRemarksModal}
          onClose={closeRemarksModal}
          onSubmit={handleVerificationWithRemarks}
          task={remarksModalTask}
          verificationType={remarksModalType}
          loading={remarksModalLoading}
        />
        
        {/* Delete Dropdown for No Column */}
        {showDeleteDropdown && (
          <div
            ref={deleteDropdownRef}
            className="fixed bg-white border border-gray-200 rounded-md shadow-lg z-50"
            style={{
              top: deleteDropdownPosition.y,
              left: deleteDropdownPosition.x,
              minWidth: '120px'
            }}
          >
            <button
              onClick={() => {
                // Find task in orderedTasks first, then in original tasks array
                const task = orderedTasks.find(t => t._id === showDeleteDropdown) || 
                           tasks.find(t => t._id === showDeleteDropdown);
                if (task) handleDeleteFromDropdown(task);
              }}
              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors"
            >
              Delete Task
            </button>
          </div>
        )}

        {/* Custom Delete Confirmation Modal */}
        {deleteConfirmTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-xs mx-2">
              <div className="text-lg font-semibold text-gray-800 mb-4 text-center">Are you sure you want to delete this task?</div>
              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors font-semibold"
                >
                  Confirm
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Edit Task Modal (now local, not in parent) */}
      {editModalOpen && (
        <CreateTask
          users={users}
          mode="edit"
          initialData={editTask}
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          onSubmit={handleTaskSubmit}
          hideFileSection={true}
        />
      )}

      {/* Permanent horizontal scrollbar */}
      {tableWidth > 0 && (
        <div 
          className="permanent-bottom-scrollbar"
          ref={permanentScrollbarRef}
          style={{
            left: scrollbarLeft,
            width: scrollbarWidth,
          }}
        >
          <div className="scrollbar-content" style={{ width: tableWidth }}></div>
        </div>
      )}
    </>
  );
;

});

export default AdvancedTaskTable; 