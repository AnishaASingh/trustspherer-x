import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Building2, 
  Users, 
  Layers, 
  AlertTriangle, 
  TrendingUp, 
  ShieldCheck, 
  ExternalLink,
  Lock,
  RotateCw
} from 'lucide-react';
import { useSecurity, mapBackendDepartment } from '../context/SecurityContext';
import { departmentsApi } from '../utils/api';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import TrustTrendChart from '../components/charts/TrustTrendChart';
import EmptyState from '../components/common/EmptyState';

export default function DepartmentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { departments, assets, incidents, employees } = useSecurity();

  const [directDept, setDirectDept] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);

  const contextDept = departments.find((d) => d.id === id || d.code === id || d.name.toLowerCase() === id?.toLowerCase());

  useEffect(() => {
    if (!contextDept && id) {
      setDirectLoading(true);
      departmentsApi.getDepartment(id)
        .then(res => {
          if (res?.data) {
            setDirectDept(mapBackendDepartment(res.data));
          }
        })
        .catch(err => {
          console.warn('[DepartmentDetails] Direct fetch failed:', err);
        })
        .finally(() => setDirectLoading(false));
    }
  }, [id, contextDept]);

  const dept = contextDept || directDept;

  if (directLoading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          <RotateCw size={28} color="var(--accent-cyan)" />
        </div>
        <p>Loading department intelligence from database...</p>
      </div>
    );
  }

  if (!dept) {
    return (
      <EmptyState 
        icon={Building2}
        title="Department Not Found"
        description={`No department records matching identifier '${id}'.`}
        action={
          <button onClick={() => navigate('/departments')} className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Return to Departments</span>
          </button>
        }
      />
    );
  }

  // Filtered department members, assets, incidents
  const deptEmployees = employees.filter((e) => e.department.toLowerCase().includes(dept.name.toLowerCase()));
  const deptAssets = assets.filter((a) => a.department.toLowerCase().includes(dept.name.toLowerCase()));
  const deptIncidents = incidents.filter((i) => i.department.toLowerCase().includes(dept.name.toLowerCase()));

  const trendByDate = {};
  deptAssets.forEach((a) => {
    if (a.trustScore !== null && a.trustScore !== undefined && a.uploadDate) {
      const label = String(a.uploadDate).substring(5, 10) || 'Recent';
      if (!trendByDate[label]) trendByDate[label] = [];
      trendByDate[label].push(Number(a.trustScore));
    }
  });
  const computedTrend = Object.entries(trendByDate).map(([label, scores]) => ({
    label,
    score: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
  }));
  const trendData = Array.isArray(dept.trustTrend) && dept.trustTrend.length > 0
    ? dept.trustTrend.map(t => ({ label: t.month || t.label, score: t.score }))
    : computedTrend;

  return (
    <div>
      {/* Back button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/departments')} className="btn btn-ghost">
          <ArrowLeft size={16} />
          <span>Back to Departments</span>
        </button>
      </div>

      {/* Main Department Header */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #00F0FF, #3B82F6)'
          }} 
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
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
              <Building2 size={30} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {dept.name} Department
                </h1>
                <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-cyan)' }}>
                  CODE: {dept.code}
                </span>
                <RiskBadge risk={dept.riskLevel} />
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: '650px' }}>
                {dept.description} • Led by <strong>{dept.head}</strong>
              </p>
            </div>
          </div>

          <div 
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              textAlign: 'right'
            }}
          >
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department Trust</div>
            <div className="font-mono" style={{ fontSize: dept.trustScore !== null && dept.trustScore !== undefined ? '2rem' : '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
              {dept.trustScore !== null && dept.trustScore !== undefined ? `${dept.trustScore} / 100` : 'Awaiting verification'}
            </div>
            <TrustScoreBadge score={dept.trustScore} showScore={false} size="sm" />
          </div>
        </div>

        {/* Telemetry row */}
        <div 
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '1rem',
            paddingTop: '1.5rem',
            marginTop: '1.5rem',
            borderTop: '1px solid var(--border-subtle)'
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned Staff</div>
            <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {deptEmployees.length}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Monitored Assets</div>
            <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {deptAssets.length}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Active Incidents</div>
            <div className="font-mono" style={{ fontSize: '1.3rem', fontWeight: 700, color: deptIncidents.length > 0 ? '#EF4444' : 'var(--trust-75)' }}>
              {deptIncidents.length}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Compliance Status</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
              {dept.complianceStatus || (deptAssets.length > 0 ? 'Verified' : 'Awaiting verification')}
            </div>
          </div>
        </div>
      </div>

      {/* Trust Trend & Key Policies */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Trust Trend */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={18} color="var(--accent-cyan)" />
            Department Trust Trajectory
          </h3>
          <TrustTrendChart data={trendData} height={220} />
        </div>

        {/* Security Governance Policies */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Lock size={18} color="var(--accent-cyan)" />
            Department Governance Directives
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {Array.isArray(dept.keyPolicies) && dept.keyPolicies.length > 0 ? (
              dept.keyPolicies.map((policy, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem'
                  }}
                >
                  <span style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>#{idx + 1}</span>
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {policy}
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No custom department governance directives configured. Standard 7-layer verification applies to all department assets.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assets & Employees Lists */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Department Assets */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="var(--accent-cyan)" />
              Department Assets ({deptAssets.length})
            </h3>
            <Link to="/assets" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              Full Registry →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {deptAssets.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No digital assets uploaded.
              </div>
            ) : (
              deptAssets.slice(0, 5).map((a) => (
                <div 
                  key={a.id}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <Link to={`/assets/${a.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                      {a.name}
                    </Link>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {a.id} • {a.type}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrustScoreBadge score={a.trustScore} size="sm" />
                    <Link to={`/assets/${a.id}`} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
                      <ExternalLink size={13} color="var(--accent-cyan)" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Department Personnel */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="var(--accent-cyan)" />
              Staff Members ({deptEmployees.length})
            </h3>
            <Link to="/employees" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              Full Roster →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {deptEmployees.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No employees added yet.
              </div>
            ) : (
              deptEmployees.map((e) => (
                <div 
                  key={e.id}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <Link to={`/employees/${e.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                      {e.name}
                    </Link>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {e.role}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrustScoreBadge score={e.trustScore} size="sm" />
                    <Link to={`/employees/${e.id}`} className="btn btn-ghost btn-sm" style={{ padding: '0.25rem' }}>
                      <ExternalLink size={13} color="var(--accent-cyan)" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
