import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  User, 
  Building2, 
  Shield, 
  Layers, 
  AlertTriangle, 
  Clock, 
  Mail, 
  Calendar,
  ExternalLink,
  CheckCircle2,
  RotateCw
} from 'lucide-react';
import { useSecurity, mapBackendEmployee } from '../context/SecurityContext';
import { employeesApi } from '../utils/api';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employees, assets, incidents } = useSecurity();

  const [directEmployee, setDirectEmployee] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);

  const contextEmployee = employees.find((e) => e.id === id || e.employee_id === id);

  useEffect(() => {
    if (!contextEmployee && id) {
      setDirectLoading(true);
      employeesApi.getEmployee(id)
        .then(res => {
          if (res?.data) {
            setDirectEmployee(mapBackendEmployee(res.data));
          }
        })
        .catch(err => {
          console.warn('[EmployeeDetails] Direct fetch error:', err);
        })
        .finally(() => setDirectLoading(false));
    }
  }, [id, contextEmployee]);

  const employee = contextEmployee || directEmployee;

  if (directLoading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          <RotateCw size={28} color="var(--accent-cyan)" />
        </div>
        <p>Loading employee intelligence from database...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <EmptyState 
        icon={User}
        title="Employee Profile Not Found"
        description={`No profile registered under ID '${id}'.`}
        action={
          <button onClick={() => navigate('/employees')} className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Return to Directory</span>
          </button>
        }
      />
    );
  }

  // Linked assets & incidents
  const linkedAssets = assets.filter(
    (a) => (employee.associatedAssets || []).includes(a.id) || a.uploader?.toLowerCase().includes(employee.name.toLowerCase())
  );

  const linkedIncidents = incidents.filter(
    (inc) => (employee.relatedIncidents || []).includes(inc.id) || inc.assignedTo?.toLowerCase().includes(employee.name.toLowerCase())
  );

  return (
    <div>
      {/* Back button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button onClick={() => navigate('/employees')} className="btn btn-ghost">
          <ArrowLeft size={16} />
          <span>Back to Employees</span>
        </button>
      </div>

      {/* Main Profile Header */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, var(--accent-cyan), var(--accent-blue))'
          }} 
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
            <div 
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(59, 130, 246, 0.2))',
                border: '2px solid var(--border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--accent-cyan)'
              }}
            >
              {employee.avatar || employee.name.substring(0, 2).toUpperCase()}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {employee.name}
                </h1>
                <StatusBadge status={employee.status} />
              </div>
              
              <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {employee.role} • <span style={{ color: 'var(--accent-cyan)' }}>{employee.department}</span>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span className="font-mono">{employee.id}</span>
                <span>•</span>
                <span>{employee.email}</span>
                <span>•</span>
                <span>Joined {employee.joinDate}</span>
              </div>
            </div>
          </div>

          {/* Trust Rating Card */}
          <div 
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem'
            }}
          >
            <div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Individual Trust</div>
              <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {employee.trustScore}/100
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <TrustScoreBadge score={employee.trustScore} showScore={false} />
              <RiskBadge risk={employee.riskLevel} />
            </div>
          </div>
        </div>
      </div>

      {/* Associated Assets & Related Incidents */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Associated Assets */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="var(--accent-cyan)" />
              Associated Digital Assets ({linkedAssets.length})
            </h3>
          </div>

          {linkedAssets.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No digital assets currently linked to this employee identity.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {linkedAssets.map((ast) => (
                <div 
                  key={ast.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <Link to={`/assets/${ast.id}`} style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '0.875rem' }}>
                      {ast.name}
                    </Link>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {ast.id} • {ast.type} • {ast.size}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrustScoreBadge score={ast.trustScore} size="sm" />
                    <Link to={`/assets/${ast.id}`} className="btn btn-ghost btn-sm" style={{ padding: '0.3rem' }}>
                      <ExternalLink size={14} color="var(--accent-cyan)" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Incidents */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="var(--trust-0)" />
              Assigned / Flagged Incidents ({linkedIncidents.length})
            </h3>
          </div>

          {linkedIncidents.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ✓ No active security incidents connected to this identity.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {linkedIncidents.map((inc) => (
                <div 
                  key={inc.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <Link to={`/incidents/${inc.id}`} style={{ fontWeight: 600, color: '#F87171', textDecoration: 'none', fontSize: '0.875rem' }}>
                      {inc.id}: {inc.title}
                    </Link>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Detected: {inc.detectedDate}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StatusBadge status={inc.status} />
                    <Link to={`/incidents/${inc.id}`} className="btn btn-ghost btn-sm" style={{ padding: '0.3rem' }}>
                      <ExternalLink size={14} color="#F87171" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Activity History */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="var(--accent-cyan)" />
          Employee Audit & Security Activity Trail
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {(employee.activities || [
            { action: "Logged in via corporate SSO", time: "2026-09-18 09:00", status: "SUCCESS" },
            { action: "Accessed department asset repository", time: "2026-09-18 09:15", status: "SUCCESS" }
          ]).map((act, idx) => (
            <div 
              key={idx}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <CheckCircle2 size={16} color="var(--trust-75)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{act.action}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{act.time}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: act.status === 'SUCCESS' ? 'var(--trust-75)' : act.status === 'BLOCKED' ? 'var(--trust-0)' : 'var(--trust-60)' }}>
                  {act.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
