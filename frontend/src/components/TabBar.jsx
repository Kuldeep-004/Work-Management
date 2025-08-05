import React, { useState } from 'react';
import './TabBar.css';

const TabBar = ({ tabs, activeTabId, onTabClick, onAddTab, onCloseTab, onRenameTab }) => {
  const [editingTabId, setEditingTabId] = useState(null);
  const [editValue, setEditValue] = useState('');

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
      {tabs.map((tab) => (
          <div
            key={tab.id}
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
              cursor: 'pointer',
              minWidth: 90,
              maxWidth: 'none',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              flexShrink: 0,
              transition: 'all 0.2s ease',
              boxShadow: tab.id === activeTabId ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
            onClick={() => onTabClick(tab.id)}
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
                  color: tab.id === activeTabId ? '#1e40af' : '#475569'
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