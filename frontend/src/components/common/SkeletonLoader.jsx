import React from 'react';

export default function SkeletonLoader({ rows = 4, type = 'table' }) {
  if (type === 'cards') {
    return (
      <div className="grid-stats">
        {[...Array(4)].map((_, i) => (
          <div 
            key={i} 
            className="glass-panel animate-pulse" 
            style={{ height: '110px', background: 'rgba(255,255,255,0.02)' }} 
          />
        ))}
      </div>
    );
  }

  return (
    <div className="glass-panel" style={{ padding: '1.5rem' }}>
      <div 
        className="animate-pulse" 
        style={{ height: '28px', width: '200px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '1.5rem' }} 
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {[...Array(rows)].map((_, i) => (
          <div 
            key={i} 
            className="animate-pulse" 
            style={{ 
              height: '42px', 
              width: '100%', 
              background: 'rgba(255,255,255,0.03)', 
              borderRadius: '4px' 
            }} 
          />
        ))}
      </div>
    </div>
  );
}
