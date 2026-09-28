import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Shield } from 'lucide-react';
import { getTrustLevel } from '../../utils/trustCalculator';

export default function TrustScoreBadge({ score, showScore = true, size = 'normal' }) {
  const { level, badgeClass } = getTrustLevel(score);

  let Icon = ShieldCheck;
  if (score < 40) Icon = ShieldX;
  else if (score < 60) Icon = ShieldAlert;
  else if (score < 75) Icon = Shield;

  const iconSize = size === 'sm' ? 12 : 14;
  const padding = size === 'sm' ? '0.15rem 0.45rem' : '0.25rem 0.65rem';
  const fontSize = size === 'sm' ? '0.7rem' : '0.75rem';

  return (
    <span 
      className={`badge ${badgeClass}`} 
      style={{ padding, fontSize, display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
    >
      <Icon size={iconSize} />
      {showScore && <strong className="font-mono">{score}/100</strong>}
      <span>{level}</span>
    </span>
  );
}
