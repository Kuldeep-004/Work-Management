import React, { useState } from 'react';
import './TabBar.css';

const TabBar = ({ tabs, activeTabId, onTabClick, onAddTab, onCloseTab, onRenameTab, onReorderTabs }) => {
  const [editingTabId, setEditingTabId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [draggedTab, setDraggedTab] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDoubleClick = (tab) => {
    setEditingTabId(tab.id);
    setEditValue(tab.title);
  };

  const handleInputChange = (e) => {
    setEditValue(e.target.value);
  };

  const handleInputBlur = (tab) => {
    if (editValue.trim() && editValue !== tab.title) {
      onRenameTab(tab.id, editValue.trim());
    }
    setEditingTabId(null);
  };

  const handleInputKeyDown = (e, tab) => {
    if (e.key === 'Enter') {
      handleInputBlur(tab);
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, tab, index) => {
    setDraggedTab({ tab, index });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    
    // Add visual feedback
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedTab(null);
    setDragOverIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedTab && draggedTab.index !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    
    if (!draggedTab || draggedTab.index === dropIndex) {
      setDragOverIndex(null);
      return;
    }

    const newTabs = [...tabs];
    const draggedTabData = newTabs[draggedTab.index];
    
    // Remove the dragged tab from its original position
    newTabs.splice(draggedTab.index, 1);
    
    // Insert the dragged tab at the new position
    newTabs.splice(dropIndex, 0, draggedTabData);
    
    // Call the reorder callback if provided
    if (onReorderTabs) {
      onReorderTabs(newTabs);
    }
    
    setDraggedTab(null);
    setDragOverIndex(null);
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      borderBottom: '1px solid #e2e8f0', 
      marginBottom: 12,
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      paddingBottom: '4px',
      msOverflowStyle: 'none',  /* IE and Edge */
      scrollbarWidth: 'none',   /* Firefox */
      width: '100%',
    }}
    className="hide-scrollbar" // Add a class for custom scrollbar CSS
    >
      {tabs.map((tab, index) => (
          <div
            key={tab.id}
            draggable={!editingTabId} // Don't allow drag during editing
            onDragStart={(e) => handleDragStart(e, tab, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            style={{
              padding: '8px 12px',
              marginRight: 1,
              background: tab.id === activeTabId ? '#f8fafc' : '#f1f5f9',
              borderTop: '1px solid #cbd5e0',
              borderLeft: '1px solid #cbd5e0',
              borderRight: '1px solid #cbd5e0',
              borderBottom: tab.id === activeTabId ? '2px solid #3b82f6' : '1px solid #cbd5e0',
              borderRadius: '4px 4px 0 0',
              position: 'relative',
              cursor: editingTabId ? 'default' : (draggedTab ? 'move' : 'pointer'),
              minWidth: 90,
              maxWidth: 'none',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              flexShrink: 0,
              transition: draggedTab ? 'none' : 'all 0.2s ease',
              boxShadow: tab.id === activeTabId ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              // Add visual feedback for drag over
              transform: dragOverIndex === index && draggedTab && draggedTab.index !== index ? 'translateX(10px)' : 'translateX(0)',
              borderLeftColor: dragOverIndex === index && draggedTab && draggedTab.index !== index ? '#3b82f6' : '#cbd5e0',
              borderLeftWidth: dragOverIndex === index && draggedTab && draggedTab.index !== index ? '3px' : '1px',
            }}
            onClick={() => !editingTabId && onTabClick(tab.id)}
          >
            {editingTabId === tab.id ? (
              <input
                value={editValue}
                onChange={handleInputChange}
                onBlur={() => handleInputBlur(tab)}
                onKeyDown={(e) => handleInputKeyDown(e, tab)}
                autoFocus
                style={{ 
                  fontSize: 14, 
                  padding: '2px 6px', 
                  width: 100,
                  border: '1px solid #cbd5e0',
                  borderRadius: '3px'
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleDoubleClick(tab);
                }}
                style={{
                  fontWeight: tab.id === activeTabId ? '500' : 'normal',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  marginRight: 8,
                  color: tab.id === activeTabId ? '#1e40af' : '#475569',
                  pointerEvents: editingTabId ? 'none' : 'auto'
                }}
                title={tab.title}
              >
                {tab.title}
              </span>
            )}
            {tabs.length > 1 && (
              <span
                onClick={e => {
                  e.stopPropagation();
                  onCloseTab(tab.id);
                }}
                style={{ 
                  flexShrink: 0,
                  color: '#64748b', 
                  cursor: 'pointer', 
                  fontSize: 16,
                  width: '18px',
                  height: '18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '50%',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                title="Close tab"
              >
                ×
              </span>
            )}
          </div>
      ))}
      <button
        onClick={onAddTab}
        style={{ 
            marginLeft: 8, 
            padding: '4px 12px', 
            fontSize: 18, 
            cursor: 'pointer', 
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            background: '#f1f5f9',
            color: '#475569',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
          title="Add tab"
        >
        +
      </button>
    </div>
  );
};

export default TabBar; 