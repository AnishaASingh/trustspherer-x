import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Share2,
  LayoutDashboard,
  CheckCircle2,
  RotateCw,
  HelpCircle
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import { useToast } from '../context/ToastContext';
import { aiApi } from '../utils/api';
import RiskBadge from '../components/common/RiskBadge';

const PRESET_QUESTIONS = [
  {
    label: "Which department has the highest risk?",
    question: "Which department currently has the highest risk and lowest trust score in TrustSphere?",
    context: "digital_twin"
  },
  {
    label: "Summarize open incidents",
    question: "Summarize the open and active security incidents and their severity across the organization.",
    context: "dashboard"
  },
  {
    label: "Why was the highest-risk asset flagged?",
    question: "Why was the highest-risk or most recently flagged asset classified as risky, and what layers failed?",
    context: "asset"
  },
  {
    label: "What should the admin review first?",
    question: "Based on current assets, open incidents, and department trust scores, what should the security administrator review first?",
    context: "dashboard"
  }
];

export default function AIAssistant() {
  const { assets, incidents } = useSecurity();
  const { addToast } = useToast();

  const [aiStatus, setAiStatus] = useState(null);
  const [contextType, setContextType] = useState('dashboard');
  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    aiApi.getStatus()
      .then((res) => {
        if (res?.data) setAiStatus(res.data);
      })
      .catch(() => {});
  }, []);

  // Auto-select first asset or incident when switching contextType
  useEffect(() => {
    if (contextType === 'asset' && assets.length > 0 && !selectedEntityId) {
      const flagged = assets.find((a) => a.risk === 'HIGH' || a.risk === 'CRITICAL') || assets[0];
      setSelectedEntityId(flagged.id);
    } else if (contextType === 'incident' && incidents.length > 0 && !selectedEntityId) {
      setSelectedEntityId(incidents[0].id);
    } else if (contextType === 'dashboard' || contextType === 'digital_twin') {
      setSelectedEntityId('');
    }
  }, [contextType, assets, incidents, selectedEntityId]);

  const executeQuery = async (queryText, overrideContext = null, overrideEntity = null) => {
    const q = (queryText || question).trim();
    if (!q) return;

    const activeContext = overrideContext || contextType;
    let activeEntity = overrideEntity !== null ? overrideEntity : selectedEntityId;
    if (activeContext === 'asset' && !activeEntity && assets.length > 0) {
      const flagged = assets.find((a) => a.risk === 'HIGH' || a.risk === 'CRITICAL') || assets[0];
      activeEntity = flagged.id;
    } else if (activeContext === 'incident' && !activeEntity && incidents.length > 0) {
      activeEntity = incidents[0].id;
    }

    setLoading(true);
    try {
      const res = await aiApi.chat(q, activeContext, activeEntity || null);
      if (res?.success && res?.data) {
        setHistory((prev) => [
          {
            id: Date.now(),
            question: q,
            contextType: activeContext,
            entityId: activeEntity,
            response: res.data,
            timestamp: new Date().toLocaleTimeString()
          },
          ...prev
        ]);
        setQuestion('');
      }
    } catch (err) {
      addToast(`AI Assistant error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    executeQuery(question);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              TrustSphere AI Security Assistant
            </h1>
            <span
              className="badge"
              style={{
                fontSize: '0.7rem',
                backgroundColor: 'rgba(0, 240, 255, 0.12)',
                color: 'var(--accent-cyan)',
                border: '1px solid var(--border-glow)'
              }}
            >
              <Sparkles size={12} style={{ marginRight: '4px' }} />
              DECISION INTELLIGENCE
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Context-grounded enterprise security intelligence powered by Groq (<code className="font-mono">openai/gpt-oss-20b</code>). Strictly bound to verified TrustSphere MongoDB telemetry.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: '0.65rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span
            style={{
              width: '9px',
              height: '9px',
              borderRadius: '50%',
              backgroundColor: aiStatus?.live_llm_enabled ? '#10B981' : '#F59E0B',
              boxShadow: aiStatus?.live_llm_enabled ? '0 0 8px #10B981' : '0 0 8px #F59E0B'
            }}
          />
          <div style={{ fontSize: '0.78rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
              {aiStatus?.provider || 'Groq Cloud API'}
            </div>
            <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>
              {aiStatus?.model || 'openai/gpt-oss-20b'}
            </div>
          </div>
        </div>
      </div>

      {/* Query Composer & Scope Controls */}
      <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '1.5rem', border: '1px solid rgba(0, 240, 255, 0.25)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label className="input-label">Telemetry Context Scope</label>
            <select
              className="input-field"
              value={contextType}
              onChange={(e) => {
                setContextType(e.target.value);
                setSelectedEntityId('');
              }}
            >
              <option value="dashboard">Organization Overview & Dashboard</option>
              <option value="digital_twin">Digital Twin Topology & Departments</option>
              <option value="asset">Specific Digital Asset</option>
              <option value="incident">Specific Security Incident</option>
            </select>
          </div>

          {contextType === 'asset' && (
            <div>
              <label className="input-label">Target Digital Asset</label>
              <select
                className="input-field"
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id} — {a.name} (Score: {a.trustScore}/100, {a.risk})
                  </option>
                ))}
              </select>
            </div>
          )}

          {contextType === 'incident' && (
            <div>
              <label className="input-label">Target Security Incident</label>
              <select
                className="input-field"
                value={selectedEntityId}
                onChange={(e) => setSelectedEntityId(e.target.value)}
              >
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    {inc.id} — {inc.title} ({inc.severity}, {inc.status})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Quick Preset Questions */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem', fontWeight: 600 }}>
            One-Click Analytical Prompts
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
            {PRESET_QUESTIONS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                disabled={loading}
                onClick={() => {
                  setContextType(preset.context);
                  executeQuery(preset.question, preset.context);
                }}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', padding: '0.45rem 0.85rem' }}
              >
                <HelpCircle size={13} color="var(--accent-cyan)" />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Question Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="input-field"
            style={{ flex: 1, minWidth: '260px' }}
            placeholder="Ask about department risk, asset verification failures, open incidents, or governance priorities..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !question.trim()}>
            {loading ? <RotateCw size={16} className="animate-spin" /> : <Send size={16} />}
            <span>{loading ? 'Analyzing Telemetry...' : 'Ask TrustSphere AI'}</span>
          </button>
        </form>
      </div>

      {/* Responses Feed */}
      {history.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Sparkles size={32} color="var(--accent-cyan)" style={{ marginBottom: '0.75rem' }} />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
            Ready for Security Telemetry Analysis
          </h3>
          <p style={{ fontSize: '0.85rem', maxWidth: '560px', margin: '0 auto' }}>
            Select one of the analytical prompts above or ask a question about any asset, incident, or department. All answers distinguish observed facts from inferences and actionable recommendations.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {history.map((item) => {
            const res = item.response;
            return (
              <div
                key={item.id}
                className="glass-panel"
                style={{
                  padding: '1.75rem',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(6, 9, 17, 0.95))'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Analyst Query • Context: {item.contextType.toUpperCase()} {item.entityId ? `(${item.entityId})` : ''}
                    </div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
                      "{item.question}"
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RiskBadge risk={res.risk_level || 'MEDIUM'} size="sm" />
                    <span className="font-mono badge badge-highly-trusted" style={{ fontSize: '0.68rem' }}>
                      {res.model_used || 'openai/gpt-oss-20b'} • {item.timestamp}
                    </span>
                  </div>
                </div>

                {/* Executive Answer */}
                <div
                  style={{
                    padding: '1rem 1.25rem',
                    backgroundColor: 'rgba(0, 240, 255, 0.05)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: '4px solid var(--accent-cyan)',
                    marginBottom: '1.25rem'
                  }}
                >
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Executive Summary
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.55, margin: '0.35rem 0 0 0' }}>
                    {res.summary}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.45rem' }}>
                      Facts (Observed from MongoDB)
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {(res.facts || res.key_findings || []).map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#FBBF24', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.45rem' }}>
                      Inferences & Reasoning
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      {res.reasoning}
                    </p>
                  </div>

                  <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '0.72rem', color: '#34D399', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.45rem' }}>
                      Recommended Actions
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {(res.recommendations || []).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
