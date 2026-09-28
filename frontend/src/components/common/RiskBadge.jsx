import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

export default function RiskBadge({ risk = 'LOW', size = 'normal' }) {
  const r = (risk || 'LOW').toUpperCase();
  let badgeClass = 'badge-trusted';
  let Icon = CheckCircle;

  if (r === 'CRITICAL') {
    badgeClass = 'badge-critical';
    Icon = AlertCircle;
  } else if (r === 'HIGH') {
    badgeClass = 'badge-high';
    Icon = ShieldAlert;
  } else if (r === 'MEDIUM') {
    badgeClass = 'badge-medium';
    Icon = AlertTriangle;
  }

  const iconSize = size === 'sm' ? 12 : 14;
  const padding = size === 'sm' ? '0.15rem 0.45rem' : '0.2rem 0.6rem';
  const fontSize = size === 'sm' ? '0.7rem' : '0.725rem';

  return (
    <span className={`badge ${badgeClass}`} style={{ padding, fontSize }}>
      <Icon size={iconSize} />
      <span>{r}</span>
    </span>
  );
}
