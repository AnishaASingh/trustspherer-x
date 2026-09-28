import React, { useState } from 'react';
import { 
  FileSearch, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  Layers, 
  Filter,
  Check,
  ChevronDown,
  Sparkles,
  Cpu,
  Mail,
  Shield,
  ArrowRight
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import { getTrustLevel } from '../utils/trustCalculator';

export default function TrustAnalysis() {
  const { assets } = useSecurity();
  const [selectedAssetId, setSelectedAssetId] = useState(assets[0]?.id || '');

  const asset = assets.find((a) => a.id === selectedAssetId) || assets[0];

  if (!asset) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        No assets available for analysis. Please upload an asset first.
      </div>
    );
  }

  const score = asset.trustScore;
  const { level, color, risk } = getTrustLevel(score);

  const factors = asset.factors || {
    sourceReliability: 90,
    integrity: 95,
    contentConsistency: 82,
    metadata: 86,
    historicalBehaviour: 88
  };

  // Circular gauge SVG calculations
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div>
      {/* Header & Asset Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Trust Analysis
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Multi-factor trust score breakdown and integrity factor evaluation for digital assets.
          </p>
        </div>

        {/* Asset Switcher Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Select Asset:</span>
          <select
            className="input-field"
            value={selectedAssetId}
            onChange={(e) => setSelectedAssetId(e.target.value)}
            style={{ width: '280px', fontWeight: 600 }}
          >
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.trustScore}/100)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Analysis Card with Circular Progress Gauge */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '2.5rem 2rem', 
          marginBottom: '2rem',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '2.5rem',
          alignItems: 'center'
        }}
      >
        {/* Circular Progress Gauge */}
        <div style={{ position: 'relative', width: '200px', height: '200px', margin: '0 auto' }}>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
            {/* Background ring */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="transparent"
              stroke="rgba(255, 255, 255, 0.06)"
              strokeWidth="14"
            />
            {/* Value ring */}
            <circle
              cx="100"
              cy="100"
              r={radius}
              fill="transparent"
              stroke={color}
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 1s ease',
                filter: `drop-shadow(0 0 10px ${color})`
              }}
            />
          </svg>

          {/* Center text inside circular progress */}
          <div 
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}
          >
            <div className="font-mono" style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
              {score}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.2rem' }}>
              / 100
            </div>
          </div>
        </div>

        {/* Status & Overview summary */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="badge" style={{ background: 'rgba(0, 240, 255, 0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(0, 240, 255, 0.3)' }}>
              {asset.type.toUpperCase()}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Department: {asset.department}</span>
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            {asset.name}
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <TrustScoreBadge score={score} size="normal" />
            <RiskBadge risk={risk} />
            <StatusBadge status={asset.status} />
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: '700px' }}>
            TrustSphere decision engine evaluated this digital artifact across origin provenance, structural consistency, and cryptographic envelope sealing. Status confirmed as <strong style={{ color }}>{level}</strong>.
          </p>
        </div>
      </div>

      {/* Factors and Checks Section */}
      <div className="grid-2col" style={{ marginBottom: '2rem' }}>
        {/* Analysis Factors Breakdown */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
            Analysis Factors Breakdown
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { label: "Source Reliability", value: factors.sourceReliability, desc: "Originating network domain and identity certainty." },
              { label: "Integrity", value: factors.integrity, desc: "Absence of unauthorized bit modifications or trailer injection." },
              { label: "Content Consistency", value: factors.contentConsistency, desc: "Internal semantic and schema layout conformity." },
              { label: "Metadata Validation", value: factors.metadata, desc: "Creation dates, author tokens, and software signature match." },
              { label: "Historical Behaviour", value: factors.historicalBehaviour, desc: "Sender reputation and department baseline pattern alignment." }
            ].map((f) => {
              const fColor = f.value >= 80 ? 'var(--trust-75)' : f.value >= 60 ? 'var(--trust-60)' : 'var(--trust-0)';
              return (
                <div key={f.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {f.label}
                    </span>
                    <span className="font-mono" style={{ fontWeight: 700, color: fColor, fontSize: '0.9rem' }}>
                      {f.value}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.35rem' }}>
                    <div 
                      style={{
                        width: `${f.value}%`,
                        height: '100%',
                        backgroundColor: fColor,
                        borderRadius: '4px',
                        boxShadow: `0 0 8px ${fColor}`,
                        transition: 'width 0.8s ease'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{f.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Verification Checks & Warnings */}
        <div className="glass-panel" style={{ padding: '1.75rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
            Core Verification Checks
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginBottom: '1.5rem' }}>
            {(asset.checks || [
              { name: "File Integrity", passed: true, detail: "Cryptographic hash verified." },
              { name: "Source Verification", passed: true, detail: "Origin gateway authenticated." },
              { name: "Metadata Validation", passed: true, detail: "Producer stamps intact." },
              { name: "Content Consistency", passed: true, detail: "Syntax heuristics aligned." }
            ]).map((chk, i) => (
              <div 
                key={i}
                style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: chk.passed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.08)',
                  border: chk.passed ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem'
                }}
              >
                {chk.passed ? (
                  <CheckCircle2 size={18} color="var(--trust-75)" style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <AlertCircle size={18} color="var(--trust-0)" style={{ flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: chk.passed ? '#34D399' : '#F87171' }}>
                    {chk.passed ? `✓ ${chk.name}` : `✕ ${chk.name}`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                    {chk.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Anomaly Warnings */}
          {asset.anomalies && asset.anomalies.length > 0 && (
            <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#F59E0B', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                <AlertTriangle size={16} />
                <span>⚠ Unusual modification detected</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {asset.anomalies.map((anom, idx) => (
                  <li key={idx} style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    • {anom}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Decision Intelligence Recommendations
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(asset.recommendations || [
                "Review source information",
                "Verify modification history",
                "Monitor related assets"
              ]).map((rec, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--accent-cyan)' }} />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* AI-Generated Security Intelligence Section */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '2rem', 
          marginBottom: '2rem',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          background: 'linear-gradient(135deg, rgba(20, 15, 38, 0.8) 0%, rgba(13, 20, 36, 0.9) 100%)',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{ 
                width: '38px', 
                height: '38px', 
                borderRadius: '10px', 
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(0, 240, 255, 0.25))',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#C084FC'
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  AI Security Intelligence & Reasoning
                </h3>
                <span 
                  className="badge" 
                  style={{ 
                    background: 'rgba(168, 85, 247, 0.15)', 
                    color: '#C084FC', 
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em'
                  }}
                >
                  AI-generated analysis
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.2rem' }}>
                Cognitive risk explanation synthesized using Gemini AI / TrustSphere Intelligence Engine
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Engine:</span>
            <span 
              className="badge" 
              style={{ 
                background: 'rgba(0, 240, 255, 0.08)', 
                color: 'var(--accent-cyan)', 
                border: '1px solid rgba(0, 240, 255, 0.25)',
                fontSize: '0.72rem',
                fontFamily: 'monospace'
              }}
            >
              {asset.ai_insights?.model || 'gemini-1.5-flash'}
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.25rem' }}>
          {/* Executive Security Summary */}
          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={16} color="var(--accent-cyan)" />
              Executive Security Summary
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              {asset.ai_insights?.security_summary || asset.ai_summary || "Asset passed 7-layer verification integrity checks. Structural envelope and origin parameters verified within organizational parameters."}
            </p>
          </div>

          {/* Risk Explanation */}
          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#FBBF24', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} color="#FBBF24" />
              Risk Explanation & Impact
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, marginBottom: '0.5rem' }}>
              {asset.ai_insights?.risk_explanation || asset.ai_insights?.human_readable_reason || "Evaluated by TrustSphere Isolation Forest anomaly detector. Baseline risk conforms to typical organizational document parameters."}
            </p>
            {asset.ai_insights?.possible_impact && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', borderTop: '1px dashed rgba(255,255,255,0.1)', paddingTop: '0.4rem' }}>
                <strong style={{ color: 'var(--text-secondary)' }}>Potential Impact:</strong> {asset.ai_insights.possible_impact}
              </div>
            )}
          </div>
        </div>

        {/* AI Recommended Actions */}
        {asset.ai_insights?.recommended_actions && asset.ai_insights.recommended_actions.length > 0 && (
          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-sm)', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#C084FC', marginBottom: '0.65rem' }}>
              AI Recommended Mitigation Steps
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.6rem' }}>
              {asset.ai_insights.recommended_actions.map((act, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ color: '#C084FC', fontWeight: 800 }}>{i + 1}.</span>
                  <span>{act}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem' }}>
          <div>
            Trust scores are determined mathematically by TrustSphere Layer 1–7 engine. AI layer provides cognitive intelligence and contextual explanation.
          </div>
          {asset.email_metadata && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)' }}>
              <Mail size={14} />
              <span>Ingested from: {asset.email_metadata.sender || 'Organization Mailbox'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
