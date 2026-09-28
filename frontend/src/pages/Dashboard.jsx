import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Layers,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Eye,
  Building2,
  Activity,
  AlertCircle,
  Mail,
  UploadCloud
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import { useAuth } from '../context/AuthContext';
import StatCard from '../components/common/StatCard';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import TrustTrendChart from '../components/charts/TrustTrendChart';
import RiskDonutChart from '../components/charts/RiskDonutChart';
import DepartmentBarChart from '../components/charts/DepartmentBarChart';

export default function Dashboard() {
  const { assets, incidents, departments, auditLogs, metrics, loadError, refetch } = useSecurity();
  const { isAdmin } = useAuth();

  const recentIncidents = incidents.slice(0, 5);

  // Derive Recent Activity from audit logs (Admin) or recent verified assets (Employee fallback)
  const recentActivities =
    auditLogs.length > 0
      ? auditLogs.slice(0, 5)
      : assets.slice(0, 5).map((a) => ({
          id: a.id,
          action: 'ASSET_VERIFIED',
          resource: a.name,
          user: a.uploader || a.department,
          details: `Trust Score ${a.trustScore}/100 (${a.risk} Risk)`,
          timestamp: a.date,
          result: a.risk === 'HIGH' || a.risk === 'CRITICAL' ? 'WARNING' : 'SUCCESS'
        }));

  return (
    <div>
      {/* Page Header — Single Clear Primary Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.75rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Organization trust score, verified digital assets, active incidents, and real-time security activity.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link to="/upload" className="btn btn-primary">
            <UploadCloud size={16} />
            <span>Upload Asset</span>
          </Link>
        </div>
      </div>

      {loadError && (
        <div
          style={{
            padding: '0.85rem 1.25rem',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            color: '#F87171',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            fontSize: '0.875rem'
          }}
        >
          <span>{loadError}</span>
          <button onClick={refetch} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Top 5 Summary Metrics */}
      <div className="grid-stats">
        <StatCard
          title="Trust Score"
          value={`${metrics.overallTrustScore} / 100`}
          subtitle="Organization Trust Index"
          icon={ShieldCheck}
          accentColor="var(--trust-75)"
          statusBadge={<TrustScoreBadge score={metrics.overallTrustScore} showScore={false} size="sm" />}
        />
        <StatCard
          title="Assets Verified"
          value={metrics.verifiedAssets}
          subtitle={`${metrics.totalAssets} total digital assets`}
          icon={CheckCircle2}
          accentColor="var(--accent-cyan)"
        />
        <StatCard
          title="Active Incidents"
          value={metrics.openIncidents}
          subtitle="Open & under investigation"
          icon={AlertTriangle}
          accentColor="var(--trust-0)"
        />
        <StatCard
          title="Emails Verified"
          value={metrics.emailsVerified || 0}
          subtitle="Ingested via Gmail OAuth"
          icon={Mail}
          accentColor="var(--trust-75)"
        />
        <StatCard
          title="High-Risk Items"
          value={metrics.highRiskAssets}
          subtitle="Flagged for security review"
          icon={AlertCircle}
          accentColor="var(--trust-40)"
        />
      </div>

      {/* Main Charts Row */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Trust Score Trend
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                6-month organizational trust trajectory
              </p>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
            <TrustTrendChart />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Risk Distribution
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Risk breakdown across all verified digital assets
              </p>
            </div>
            <Link
              to="/assets"
              style={{
                fontSize: '0.78rem',
                color: 'var(--accent-cyan)',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              <span>View Assets</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RiskDonutChart data={metrics.riskCounts} />
          </div>
        </div>
      </div>

      {/* Secondary Row: Department Trust / Verified Assets & Recent Activity */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building2 size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Department Trust Overview
              </h3>
            </div>
            {isAdmin && (
              <Link to="/departments" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                All Departments →
              </Link>
            )}
          </div>

          <DepartmentBarChart departments={departments} />
        </div>

        {/* Recent Activity */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Recent Activity
              </h3>
            </div>
            {isAdmin && (
              <Link to="/audit-logs" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                Audit Logs →
              </Link>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {recentActivities.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.84rem' }}>
                No recent activity recorded.
              </div>
            ) : (
              recentActivities.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '0.7rem 0.9rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {log.action}: <span style={{ color: 'var(--accent-cyan)' }}>{log.resource}</span>
                    </div>
                    <div
                      style={{
                        fontSize: '0.72rem',
                        color: 'var(--text-muted)',
                        marginTop: '0.15rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {log.user} • {log.details}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {log.timestamp}
                    </div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color:
                          log.result === 'SUCCESS'
                            ? 'var(--trust-75)'
                            : log.result === 'CRITICAL'
                            ? 'var(--trust-0)'
                            : 'var(--trust-60)',
                        fontWeight: 600
                      }}
                    >
                      {log.result}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Incidents
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Latest security incidents flagged across digital assets
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
                    <Link
                      to={`/incidents/${inc.id}`}
                      className="font-mono"
                      style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}
                    >
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
