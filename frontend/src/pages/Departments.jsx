import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Layers, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowRight, 
  Activity, 
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import { useAuth } from '../context/AuthContext';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import { getTrustLevel } from '../utils/trustCalculator';

export default function Departments() {
  const { departments, assets, incidents, employees, metrics, loadError, refetch } = useSecurity();
  const { organization } = useAuth();

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Organizational Trust Governance
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Enterprise hierarchy, departmental risk allocations, and compliance posture.
        </p>
      </div>

      {loadError && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <span>{loadError}</span>
          <button onClick={refetch} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Organization Overview Master Card */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '2rem', 
          marginBottom: '2.5rem', 
          position: 'relative', 
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(9, 14, 26, 0.95))'
        }}
      >
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #00F0FF, #3B82F6, #10B981)'
          }} 
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <div 
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid var(--border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}
            >
              <Building2 size={32} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {organization?.name || "TrustSphere Global Corp"}
                </h2>
                <span className="badge badge-highly-trusted">SOC 2 COMPLIANT</span>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Industry: {organization?.industry || "Cybersecurity & Decision Trust"} • Tenant ID: {organization?.id || "ORG-88492"}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Overall Trust Score
              </div>
              <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--trust-75)' }}>
                {metrics.overallTrustScore}/100
              </div>
            </div>
            <TrustScoreBadge score={metrics.overallTrustScore} showScore={false} />
          </div>
        </div>

        {/* Aggregate Key Numbers */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '1rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Personnel</div>
            <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {employees.length}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Departments</div>
            <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {departments.length}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Digital Assets</div>
            <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {assets.length}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Incidents</div>
            <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: '#EF4444', marginTop: '0.2rem' }}>
              {metrics.openIncidents}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Compliance Status</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--trust-75)', marginTop: '0.2rem' }}>
              Verified In-Policy
            </div>
          </div>
        </div>
      </div>

      {/* Department Cards Grid */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
          Department Security Profiles
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {departments.map((dept) => {
            const { level, color } = getTrustLevel(dept.trustScore);
            const deptAssets = assets.filter(a => a.department.toLowerCase().includes(dept.name.toLowerCase())).length;
            const deptIncidents = incidents.filter(i => i.department.toLowerCase().includes(dept.name.toLowerCase()) && i.status !== 'RESOLVED').length;

            return (
              <div 
                key={dept.id}
                className="glass-panel glass-panel-hover"
                style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1.25rem' }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div 
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-cyan)'
                        }}
                      >
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {dept.name}
                        </h4>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Head: {dept.head}</span>
                      </div>
                    </div>

                    <RiskBadge risk={dept.riskLevel} size="sm" />
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
                    {dept.description}
                  </p>

                  {/* Score & Progress */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Trust Score</span>
                      <span className="font-mono" style={{ fontWeight: 700, color }}>
                        {dept.trustScore} / 100
                      </span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div 
                        style={{
                          width: `${dept.trustScore}%`,
                          height: '100%',
                          backgroundColor: color,
                          borderRadius: '3px',
                          boxShadow: `0 0 8px ${color}`
                        }}
                      />
                    </div>
                  </div>

                  {/* Department Telemetry Stats */}
                  <div 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '0.5rem',
                      padding: '0.75rem',
                      background: 'rgba(0,0,0,0.25)',
                      borderRadius: 'var(--radius-sm)',
                      textAlign: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Staff</div>
                      <div className="font-mono" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        {dept.employeeCount}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assets</div>
                      <div className="font-mono" style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                        {deptAssets || dept.assetCount}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Incidents</div>
                      <div className="font-mono" style={{ fontWeight: 700, color: deptIncidents > 0 ? '#EF4444' : 'var(--trust-75)', fontSize: '0.95rem' }}>
                        {deptIncidents}
                      </div>
                    </div>
                  </div>
                </div>

                <Link 
                  to={`/departments/${dept.id}`} 
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  <span>Inspect Department</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
