import React, { useState, useEffect } from 'react';
import { Share2, Sparkles, AlertTriangle, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import NetworkGraph from '../components/twin/NetworkGraph';
import { useSecurity } from '../context/SecurityContext';
import { useToast } from '../context/ToastContext';
import { aiApi } from '../utils/api';

export default function DigitalTwin() {
  const { departments, employees, assets, incidents, refreshData } = useSecurity();
  const { addToast } = useToast();
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [twinAiResult, setTwinAiResult] = useState(null);

  useEffect(() => {
    setLastSync(new Date().toLocaleTimeString());
  }, [departments, employees, assets, incidents]);

  const handleManualSync = async () => {
    setIsRefreshing(true);
    if (refreshData) {
      await refreshData();
    }
    setLastSync(new Date().toLocaleTimeString());
    setIsRefreshing(false);
  };

  const handleAiAnalyzeOrganization = async () => {
    setAiAnalyzing(true);
    addToast('Running Groq AI Digital Twin posture analysis across all departments...', 'info');
    try {
      const res = await aiApi.analyzeDigitalTwin();
      if (res?.success && res?.data) {
        setTwinAiResult(res.data);
        addToast('AI Digital Twin posture analysis complete.', 'success');
      }
    } catch (err) {
      addToast(`AI Digital Twin analysis error: ${err.message}`, 'error');
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(0, 240, 255, 0.08)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--accent-cyan)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: '0.04em'
              }}
            >
              <Sparkles size={13} />
              <span>CYBER RECONNAISSANCE TOPOLOGY</span>
            </div>

            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10B981',
                fontSize: '0.75rem',
                fontWeight: 600
              }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block', boxShadow: '0 0 6px #10B981' }} className="animate-pulse" />
              <span>Live Digital Twin</span>
            </div>
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Organizational Digital Twin Topology
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Interactive multi-tier graph visualizer mapping Enterprise Root → Departments → Personnel → Digital Assets → Threat Incidents.
          </p>
        </div>

        {/* Sync & AI telemetry toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleAiAnalyzeOrganization}
            disabled={aiAnalyzing}
            className="btn btn-primary"
          >
            <Sparkles size={15} className={aiAnalyzing ? "animate-spin" : ""} />
            <span>{aiAnalyzing ? "Analyzing Organization..." : "AI Analyze Organization"}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={14} color="var(--accent-cyan)" />
              <span>Last synchronized: <strong style={{ color: 'var(--text-primary)' }}>{lastSync}</strong></span>
            </div>

            <button
              onClick={handleManualSync}
              disabled={isRefreshing}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--accent-cyan)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                padding: '0.2rem',
                borderRadius: '4px'
              }}
              title="Force synchronization with MongoDB telemetry"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* AI Organizational Digital Twin Analysis Card */}
      {twinAiResult && (
        <div
          className="glass-panel"
          style={{
            padding: '1.75rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(6, 9, 17, 0.96))'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Sparkles size={20} color="var(--accent-cyan)" />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  AI Organizational Digital Twin Posture
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Cross-department risk propagation, asset anomalies, and incident prioritization
                </span>
              </div>
            </div>
            <span className="badge badge-highly-trusted font-mono" style={{ fontSize: '0.7rem' }}>
              {twinAiResult.provider || 'Groq'} ({twinAiResult.model_used || 'openai/gpt-oss-20b'})
            </span>
          </div>

          <div
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'rgba(0, 240, 255, 0.04)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '4px solid var(--accent-cyan)',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Executive Topology Summary ({twinAiResult.risk_level || 'MEDIUM'} RISK)
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0.35rem 0 0 0', lineHeight: 1.5 }}>
              {twinAiResult.summary}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Observed Organizational Facts
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {(twinAiResult.facts || twinAiResult.key_findings || []).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: '#FBBF24', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Risk Distribution Reasoning
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {twinAiResult.reasoning}
              </p>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: '#34D399', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Recommended Executive Actions
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {(twinAiResult.recommendations || []).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Network Graph */}
      <NetworkGraph 
        departments={departments}
        employees={employees}
        assets={assets}
        incidents={incidents}
      />
    </div>
  );
}
