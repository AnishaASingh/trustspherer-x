import React from 'react';
import { ShieldQuestion } from 'lucide-react';

export default function EmptyState({ 
  icon: Icon = ShieldQuestion, 
  title = "No records found", 
  description = "No items match your active filters or query.", 
  action 
}) {
  return (
    <div 
      className="glass-panel"
      style={{
        padding: '3rem 2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        margin: '1.5rem 0'
      }}
    >
      <div 
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.08)',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-cyan)',
          marginBottom: '0.5rem'
        }}
      >
        <Icon size={28} />
      </div>
      <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </h4>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '420px', lineHeight: 1.5 }}>
        {description}
      </p>
      {action && (
        <div style={{ marginTop: '0.5rem' }}>
          {action}
        </div>
      )}
    </div>
  );
}
