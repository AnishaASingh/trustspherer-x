import React from 'react';

export default function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendPositive, 
  accentColor = 'var(--accent-cyan)',
  statusBadge
}) {
  return (
    <div 
      className="glass-panel glass-panel-hover" 
      style={{
        padding: '1.25rem',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Subtle top indicator bar */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: `linear-gradient(90deg, ${accentColor}, transparent)`
        }} 
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {Icon && (
          <div 
            style={{
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-subtle)',
              color: accentColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Icon size={20} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.35rem' }}>
        <h3 className="font-mono" style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          {value}
        </h3>
        {statusBadge}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>{subtitle}</span>
        {trend && (
          <span style={{ color: trendPositive ? 'var(--trust-75)' : 'var(--trust-0)', fontWeight: 600 }}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
