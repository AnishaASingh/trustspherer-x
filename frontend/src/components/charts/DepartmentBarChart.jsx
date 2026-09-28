import React from 'react';
import { getTrustLevel } from '../../utils/trustCalculator';

export default function DepartmentBarChart({ 
  departments = [
    { name: "Finance", trustScore: 91 },
    { name: "HR", trustScore: 88 },
    { name: "IT", trustScore: 72 },
    { name: "Operations", trustScore: 84 }
  ]
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
      {departments.map((dept) => {
        const { color, level } = getTrustLevel(dept.trustScore);
        return (
          <div key={dept.name} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.name}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>• {level}</span>
              </div>
              <span className="font-mono" style={{ fontWeight: 700, color }}>
                {dept.trustScore} / 100
              </span>
            </div>

            {/* Progress track */}
            <div 
              style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '4px',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div 
                style={{
                  width: `${dept.trustScore}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, #3B82F6, ${color})`,
                  borderRadius: '4px',
                  boxShadow: `0 0 10px ${color}`,
                  transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
