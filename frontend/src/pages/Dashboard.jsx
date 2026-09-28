import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight, 
  Clock, 
  Eye, 
  Building2,
  Activity,
  AlertCircle,
  Mail,
  Sparkles,
  Send,
  RotateCw
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import { useToast } from '../context/ToastContext';
import { aiApi } from '../utils/api';
import StatCard from '../components/common/StatCard';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import TrustTrendChart from '../components/charts/TrustTrendChart';
import RiskDonutChart from '../components/charts/RiskDonutChart';
import DepartmentBarChart from '../components/charts/DepartmentBarChart';

const QUICK_AI_PROMPTS = [
  "Which department has the highest risk?",
  "Summarize open incidents",
  "Why was this asset flagged?",
  "What should the admin review first?"
];

export default function Dashboard() {
  const { assets, incidents, departments, auditLogs, metrics, loadError, refetch } = useSecurity();
  const { addToast } = useToast();

  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState(null);

  // Top 5 recent incidents
  const recentIncidents = incidents.slice(0, 5);

  // Recent 4 activities from audit logs
  const recentActivities = auditLogs.slice(0, 4);

  const handleAskAssistant = async (qText) => {
    const query = (qText || aiQuestion).trim();
    if (!query) return;
    setAiLoading(true);
    try {
      const res = await aiApi.chat(query, 'dashboard', null);
      if (res?.success && res?.data) {
        setAiAnswer({ question: query, ...res.data });
        if (!qText) setAiQuestion('');
      }
    } catch (err) {
      addToast(`AI Assistant error: ${err.message}`, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Enterprise Decision Trust Intelligence
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Real-time security telemetry, asset provenance verification, and operational risk metrics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/upload" className="btn btn-primary">
            <Layers size={16} />
            <span>Upload Asset</span>
          </Link>
          <Link to="/email-integration" className="btn btn-secondary">
            <Mail size={16} />
            <span>Email Intake</span>
          </Link>
          <Link to="/ai-assistant" className="btn btn-secondary">
            <Sparkles size={16} />
            <span>AI Assistant</span>
          </Link>
          <Link to="/digital-twin" className="btn btn-secondary">
            <Activity size={16} />
            <span>Digital Twin</span>
          </Link>
        </div>
      </div>

      {loadError && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <span>{loadError}</span>
          <button onClick={refetch} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Top 5 KPI Stat Cards */}
      <div className="grid-stats">
        <StatCard 
          title="Overall Trust Score" 
          value={`${metrics.overallTrustScore} / 100`} 
          subtitle="Enterprise Health Index"
          icon={ShieldCheck}
          accentColor="var(--trust-75)"
          statusBadge={<TrustScoreBadge score={metrics.overallTrustScore} showScore={false} size="sm" />}
        />
        <StatCard 
          title="Total Assets" 
          value={metrics.totalAssets} 
          subtitle="Monitored in registry"
          icon={Layers}
          accentColor="var(--accent-cyan)"
          trend="+8 this week"
          trendPositive={true}
        />
        <StatCard 
          title="High Risk Assets" 
          value={metrics.highRiskAssets} 
          subtitle="Requires attention"
          icon={AlertCircle}
          accentColor="var(--trust-40)"
          trend={metrics.highRiskAssets > 10 ? "Elevated" : "Normal"}
          trendPositive={false}
        />
        <StatCard 
          title="Open Incidents" 
          value={metrics.openIncidents} 
          subtitle="Active in triage queue"
          icon={AlertTriangle}
          accentColor="var(--trust-0)"
        />
        <StatCard 
          title="Verified Assets" 
          value={metrics.verifiedAssets} 
          subtitle="Integrity confirmed"
          icon={CheckCircle2}
          accentColor="var(--trust-75)"
          trend="88.3% compliance"
          trendPositive={true}
        />
      </div>

      {/* Integrated TrustSphere AI Security Assistant Card */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem',
          marginBottom: '1.5rem',
          border: '1px solid rgba(0, 240, 255, 0.28)',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(6, 9, 17, 0.95))'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <Sparkles size={19} color="var(--accent-cyan)" />
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                TrustSphere AI Security Assistant
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Ask analytical questions grounded in live MongoDB assets, incidents, and department risk (Groq • openai/gpt-oss-20b)
              </span>
            </div>
          </div>
          <Link to="/ai-assistant" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <span>Open Full AI Assistant</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem' }}>
          {QUICK_AI_PROMPTS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              disabled={aiLoading}
              onClick={() => handleAskAssistant(q)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem' }}
            >
              {q}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskAssistant();
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            className="input-field"
            style={{ flex: 1, minWidth: '240px' }}
            placeholder="Ask TrustSphere AI about department risk, open incidents, or flagged assets..."
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            disabled={aiLoading}
          />
          <button type="submit" className="btn btn-primary" disabled={aiLoading || !aiQuestion.trim()}>
            {aiLoading ? <RotateCw size={15} className="animate-spin" /> : <Send size={15} />}
            <span>{aiLoading ? 'Analyzing...' : 'Ask AI'}</span>
          </button>
        </form>

        {aiAnswer && (
          <div
            style={{
              marginTop: '1rem',
              padding: '1rem 1.25rem',
              backgroundColor: 'rgba(0, 240, 255, 0.05)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '4px solid var(--accent-cyan)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                Q: "{aiAnswer.question}"
              </span>
              <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {aiAnswer.model_used || 'openai/gpt-oss-20b'} • Risk: {aiAnswer.risk_level}
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: '0 0 0.6rem 0' }}>
              {aiAnswer.summary}
            </p>
            {aiAnswer.recommendations && aiAnswer.recommendations.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: '#34D399' }}>Recommended Next Steps:</strong> {aiAnswer.recommendations.join(' • ')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Charts Row */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Trust Score Trend */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Trust Score Trend
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                6-month trailing organizational integrity trajectory
              </p>
            </div>
            <span className="font-mono badge badge-trusted" style={{ fontSize: '0.7rem' }}>
              +5% OVERALL GAIN
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <TrustTrendChart />
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Risk Distribution
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Multifactor threat categorization across all registered assets
              </p>
            </div>
            <Link to="/assets" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>View details</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RiskDonutChart data={metrics.riskCounts} />
          </div>
        </div>
      </div>

      {/* Secondary Row: Department Trust & Activity Feed */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Department Trust */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Department Trust Benchmarks
              </h3>
            </div>
            <Link to="/departments" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              All Departments →
            </Link>
          </div>

          <DepartmentBarChart departments={departments} />
        </div>

        {/* Recent Activity */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Real-Time Security Activity
              </h3>
            </div>
            <Link to="/audit-logs" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              Audit Trail →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {recentActivities.map((log) => (
              <div 
                key={log.id}
                style={{
                  padding: '0.75rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {log.action}: <span style={{ color: 'var(--accent-cyan)' }}>{log.resource}</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    by {log.user} • {log.details}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {log.timestamp}
                  </div>
                  <span 
                    style={{ 
                      fontSize: '0.68rem', 
                      color: log.result === 'SUCCESS' ? 'var(--trust-75)' : log.result === 'CRITICAL' ? 'var(--trust-0)' : 'var(--trust-60)',
                      fontWeight: 600 
                    }}
                  >
                    {log.result}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Security Incidents
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Latest anomalous events flagged across enterprise digital assets
            </p>
          </div>
          <Link to="/incidents" className="btn btn-secondary btn-sm">
            <span>View All Incidents</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Incident ID</th>
                <th>Asset</th>
                <th>Severity</th>
                <th>Department</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentIncidents.map((inc) => (
                <tr key={inc.id}>
                  <td>
                    <Link to={`/incidents/${inc.id}`} className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>
                      {inc.id}
                    </Link>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{inc.relatedAssetName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{inc.title}</div>
                  </td>
                  <td>
                    <RiskBadge risk={inc.severity} size="sm" />
                  </td>
                  <td>{inc.department}</td>
                  <td>
                    <StatusBadge status={inc.status} />
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {inc.detectedDate}
                  </td>
                  <td>
                    <Link to={`/incidents/${inc.id}`} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-cyan)' }}>
                      <Eye size={14} />
                      <span>Details</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
