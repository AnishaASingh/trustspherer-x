import React, { useState } from 'react';

export default function TrustTrendChart({ 
  data = [
    { label: "Apr", score: 79 },
    { label: "May", score: 81 },
    { label: "Jun", score: 82 },
    { label: "Jul", score: 80 },
    { label: "Aug", score: 83 },
    { label: "Sep", score: 84 }
  ],
  height = 240
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const paddingX = 40;
  const paddingY = 30;
  const width = 580;
  const graphWidth = width - paddingX * 2;
  const graphHeight = height - paddingY * 2;

  const minScore = 50;
  const maxScore = 100;

  const points = data.map((d, index) => {
    const x = paddingX + (index / (data.length - 1)) * graphWidth;
    const y = paddingY + graphHeight - ((d.score - minScore) / (maxScore - minScore)) * graphHeight;
    return { ...d, x, y };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="trustTrendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.0" />
          </linearGradient>
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Grid lines */}
        {[60, 70, 80, 90, 100].map((level) => {
          const y = paddingY + graphHeight - ((level - minScore) / (maxScore - minScore)) * graphHeight;
          return (
            <g key={level}>
              <line 
                x1={paddingX} 
                y1={y} 
                x2={width - paddingX} 
                y2={y} 
                stroke="rgba(56, 189, 248, 0.1)" 
                strokeDasharray="4 4"
              />
              <text 
                x={paddingX - 10} 
                y={y + 4} 
                fill="#64748B" 
                fontSize="10" 
                textAnchor="end"
                className="font-mono"
              >
                {level}
              </text>
            </g>
          );
        })}

        {/* Area */}
        <path d={areaD} fill="url(#trustTrendGradient)" />

        {/* Line */}
        <path 
          d={pathD} 
          fill="none" 
          stroke="#00F0FF" 
          strokeWidth="3" 
          filter="url(#cyanGlow)"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points & Labels */}
        {points.map((p, i) => (
          <g key={i}>
            {/* X-axis label */}
            <text 
              x={p.x} 
              y={height - 10} 
              fill="#94A3B8" 
              fontSize="11" 
              textAnchor="middle"
              fontWeight="500"
            >
              {p.label}
            </text>

            {/* Hover Target & Node Circle */}
            <circle 
              cx={p.x} 
              cy={p.y} 
              r="14" 
              fill="transparent" 
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredPoint(p)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
            <circle 
              cx={p.x} 
              cy={p.y} 
              r={hoveredPoint?.label === p.label ? "6" : "4"} 
              fill="#060911" 
              stroke="#00F0FF" 
              strokeWidth="2.5"
              style={{ transition: 'all 0.15s ease' }}
            />
          </g>
        ))}

        {/* Tooltip on Hover */}
        {hoveredPoint && (
          <g transform={`translate(${hoveredPoint.x}, ${hoveredPoint.y - 32})`}>
            <rect 
              x="-35" 
              y="-18" 
              width="70" 
              height="26" 
              rx="4" 
              fill="#0F172A" 
              stroke="#00F0FF" 
              strokeWidth="1"
            />
            <text 
              x="0" 
              y="-1" 
              fill="#F8FAFC" 
              fontSize="11" 
              fontWeight="700" 
              textAnchor="middle"
              className="font-mono"
            >
              {hoveredPoint.score} / 100
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
