import React, { useState } from 'react';

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
    <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee', marginBottom: 12 }}>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{
            padding: '6px 16px',
            marginRight: 4,
            background: tab.id === activeTabId ? '#f0f0f0' : '#fff',
            border: '1px solid #ccc',
            borderBottom: tab.id === activeTabId ? '2px solid #007bff' : '1px solid #ccc',
            borderRadius: '6px 6px 0 0',
            position: 'relative',
            cursor: 'pointer',
            minWidth: 80,
            display: 'flex',
            alignItems: 'center',
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
              style={{ fontSize: 14, padding: '2px 6px', width: 70 }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleDoubleClick(tab);
              }}
              style={{
                fontWeight: tab.id === activeTabId ? 'bold' : 'normal',
                fontSize: 14,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 70,
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
              style={{ marginLeft: 8, color: '#888', cursor: 'pointer', fontSize: 16 }}
              title="Close tab"
            >
              ×
            </span>
          )}
        </div>
      ))}
      <button
        onClick={onAddTab}
        style={{ marginLeft: 8, padding: '2px 10px', fontSize: 18, cursor: 'pointer', border: 'none', background: 'transparent' }}
        title="Add tab"
      >
        +
      </button>
    </div>
  );
};

export default TabBar; 