import React from 'react';

export default function StatusBadge({ status = 'VERIFIED' }) {
  const s = (status || 'VERIFIED').toUpperCase();

  let style = {
    background: 'rgba(100, 116, 139, 0.15)',
    color: '#94A3B8',
    border: '1px solid rgba(148, 163, 184, 0.3)'
  };

  if (s === 'VERIFIED' || s === 'RESOLVED' || s === 'ACTIVE') {
    style = {
      background: 'rgba(16, 185, 129, 0.15)',
      color: '#34D399',
      border: '1px solid rgba(16, 185, 129, 0.35)'
    };
  } else if (s === 'UNDER INVESTIGATION' || s === 'UNDER REVIEW' || s === 'INVESTIGATING') {
    style = {
      background: 'rgba(59, 130, 246, 0.15)',
      color: '#60A5FA',
      border: '1px solid rgba(59, 130, 246, 0.35)'
    };
  } else if (s === 'FLAGGED' || s === 'OPEN') {
    style = {
      background: 'rgba(249, 115, 22, 0.15)',
      color: '#FB923C',
      border: '1px solid rgba(249, 115, 22, 0.4)'
    };
  } else if (s === 'REJECTED' || s === 'CRITICAL') {
    style = {
      background: 'rgba(239, 68, 68, 0.18)',
      color: '#F87171',
      border: '1px solid rgba(239, 68, 68, 0.45)'
    };
  }

  return (
    <span 
      className="badge" 
      style={{
        ...style,
        fontSize: '0.72rem',
        padding: '0.2rem 0.55rem',
        letterSpacing: '0.04em'
      }}
    >
      <span 
        style={{ 
          width: '6px', 
          height: '6px', 
          borderRadius: '50%', 
          backgroundColor: style.color,
          boxShadow: `0 0 6px ${style.color}` 
        }} 
      />
      {s}
    </span>
  );
}
