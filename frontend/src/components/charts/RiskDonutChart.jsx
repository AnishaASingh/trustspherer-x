import React, { useState } from 'react';

export default function RiskDonutChart({ 
  data = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  size = 200 
}) {
  const [activeSegment, setActiveSegment] = useState(null);

  const riskMeta = [
    { key: "LOW", label: "Low Risk", color: "var(--trust-75)", value: data.LOW || 0 },
    { key: "MEDIUM", label: "Medium Risk", color: "var(--trust-60)", value: data.MEDIUM || 0 },
    { key: "HIGH", label: "High Risk", color: "var(--trust-40)", value: data.HIGH || 0 },
    { key: "CRITICAL", label: "Critical", color: "var(--trust-0)", value: data.CRITICAL || 0 }
  ];

  const rawTotal = riskMeta.reduce((acc, curr) => acc + curr.value, 0);
  const divisor = rawTotal || 1;

  // Compute SVG arc coordinates
  const radius = 75;
  const innerRadius = 52;
  const center = size / 2;

  let cumulativeAngle = -Math.PI / 2;

  const segments = riskMeta.map((item) => {
    const fraction = rawTotal > 0 ? item.value / divisor : 0;
    const angle = Math.min(fraction * 2 * Math.PI, 2 * Math.PI - 0.0001);
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const x3 = center + innerRadius * Math.cos(endAngle);
    const y3 = center + innerRadius * Math.sin(endAngle);
    const x4 = center + innerRadius * Math.cos(startAngle);
    const y4 = center + innerRadius * Math.sin(startAngle);

    const largeArcFlag = angle > Math.PI ? 1 : 0;

    const pathData = item.value > 0 ? [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ') : '';

    return {
      ...item,
      pathData,
      percentage: rawTotal > 0 ? Math.round(fraction * 100) : 0
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {rawTotal === 0 ? (
            <circle
              cx={center}
              cy={center}
              r={(radius + innerRadius) / 2}
              fill="none"
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth={radius - innerRadius}
            />
          ) : (
            segments.filter(s => s.value > 0).map((seg) => (
              <path
                key={seg.key}
                d={seg.pathData}
                fill={seg.color}
                stroke="#060911"
                strokeWidth="2"
                opacity={activeSegment && activeSegment !== seg.key ? 0.45 : 0.9}
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  filter: activeSegment === seg.key ? `drop-shadow(0 0 8px ${seg.color})` : 'none'
                }}
                onMouseEnter={() => setActiveSegment(seg.key)}
                onMouseLeave={() => setActiveSegment(null)}
              />
            ))
          )}
        </svg>

        {/* Center label */}
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none'
          }}
        >
          <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {activeSegment 
              ? segments.find(s => s.key === activeSegment)?.value 
              : rawTotal}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {activeSegment 
              ? segments.find(s => s.key === activeSegment)?.label 
              : "Total Assets"}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem', width: '100%' }}>
        {segments.map((seg) => (
          <div 
            key={seg.key}
            onMouseEnter={() => setActiveSegment(seg.key)}
            onMouseLeave={() => setActiveSegment(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.35rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              background: activeSegment === seg.key ? 'rgba(255,255,255,0.05)' : 'transparent',
              cursor: 'pointer',
              fontSize: '0.8rem',
              transition: 'background 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span 
                style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '2px', 
                  backgroundColor: seg.color,
                  boxShadow: `0 0 6px ${seg.color}`
                }} 
              />
              <span style={{ color: 'var(--text-secondary)' }}>{seg.label}</span>
            </div>
            <div className="font-mono" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {seg.value} <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({seg.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
