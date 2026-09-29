import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Layers,
  AlertTriangle,
  Clock,
  ExternalLink,
  CheckCircle2,
  RotateCw,
  Edit3,
  UserCheck,
  UserX,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { useSecurity, mapBackendEmployee, mapBackendAsset, mapBackendIncident } from '../context/SecurityContext';
import { employeesApi } from '../utils/api';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { employees, assets, incidents, departments, updateEmployee, refetch } = useSecurity();

  const [directEmployee, setDirectEmployee] = useState(null);
  const [backendAssets, setBackendAssets] = useState([]);
  const [backendIncidents, setBackendIncidents] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [directLoading, setDirectLoading] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    department: 'Finance',
    role: '',
    status: 'ACTIVE',
    trustScore: 88
  });

  const contextEmployee = employees.find((e) => e.id === id || e.employee_id === id);

  const loadEmployeeFromBackend = useCallback(() => {
    if (!id) return;
    setDirectLoading(true);
    employeesApi.getEmployee(id)
      .then((res) => {
        const rawEmp = res?.data?.employee || res?.data;
        if (rawEmp) {
          setDirectEmployee(mapBackendEmployee(rawEmp));
          if (Array.isArray(rawEmp.associated_assets)) {
            setBackendAssets(rawEmp.associated_assets.map(mapBackendAsset));
          }
          if (Array.isArray(rawEmp.related_incidents)) {
            setBackendIncidents(rawEmp.related_incidents.map(mapBackendIncident));
          }
          if (Array.isArray(rawEmp.permissions)) {
            setPermissions(rawEmp.permissions);
          }
        }
      })
      .catch((err) => {
        console.warn('[EmployeeDetails] Direct fetch error:', err);
      })
      .finally(() => setDirectLoading(false));
  }, [id]);

  useEffect(() => {
    loadEmployeeFromBackend();
  }, [loadEmployeeFromBackend]);

  const employee = directEmployee || contextEmployee;

  const handleOpenEdit = () => {
    if (!employee) return;
    setEditError(null);
    setEditFormData({
      name: employee.name || '',
      email: employee.email || '',
      department: employee.department || 'Finance',
      role: employee.role || '',
      status: (employee.status || 'ACTIVE').toUpperCase(),
      trustScore: typeof employee.trustScore === 'number' ? employee.trustScore : 88
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!employee) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const updated = await updateEmployee(employee.id, editFormData);
      setDirectEmployee(updated);
      setEditModalOpen(false);
      if (refetch) refetch();
      loadEmployeeFromBackend();
    } catch (err) {
      setEditError(err.message || 'Failed to update employee.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!employee) return;
    const isInactive = (employee.status || '').toUpperCase() === 'INACTIVE';
    const nextStatus = isInactive ? 'ACTIVE' : 'INACTIVE';
    setTogglingStatus(true);
    try {
      const updated = await updateEmployee(employee.id, { status: nextStatus });
      setDirectEmployee(updated);
      if (refetch) refetch();
      loadEmployeeFromBackend();
    } catch (err) {
      console.error('[EmployeeDetails] toggle status error:', err);
    } finally {
      setTogglingStatus(false);
    }
  };

  if (directLoading && !employee) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          <RotateCw size={28} color="var(--accent-cyan)" />
        </div>
        <p>Loading employee details...</p>
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
            <span>Return to Employees</span>
          </button>
        }
      />
    );
  }

  const isInactive = (employee.status || '').toUpperCase() === 'INACTIVE';
  const effectivePermissions =
    permissions.length > 0
      ? permissions
      : ['Dashboard', 'Digital Assets', 'Trust Analysis', 'Incidents', 'Settings'];

  const contextLinkedAssets = assets.filter(
    (a) =>
      (employee.associatedAssets || []).includes(a.id) ||
      a.uploader?.toLowerCase().includes(employee.name.toLowerCase()) ||
      (a.department && employee.department && a.department.toLowerCase() === employee.department.toLowerCase())
  );
  const linkedAssets = backendAssets.length > 0 ? backendAssets : contextLinkedAssets.slice(0, 10);

  const contextLinkedIncidents = incidents.filter(
    (inc) =>
      (employee.relatedIncidents || []).includes(inc.id) ||
      inc.assignedTo?.toLowerCase().includes(employee.name.toLowerCase()) ||
      (inc.department && employee.department && inc.department.toLowerCase() === employee.department.toLowerCase())
  );
  const linkedIncidents = backendIncidents.length > 0 ? backendIncidents : contextLinkedIncidents.slice(0, 10);

  const deptOptions = Array.from(
    new Set(
      [
        'Finance',
        'Human Resources',
        'Information Technology',
        'IT',
        'HR',
        'Operations',
        'Legal & Compliance',
        'Security',
        ...(departments || []).map((d) => d.name).filter(Boolean),
        employee.department
      ].filter(Boolean)
    )
  ).sort();

  return (
    <div>
      {/* Back button & Edit / Activate-Deactivate Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button onClick={() => navigate('/employees')} className="btn btn-ghost">
          <ArrowLeft size={16} />
          <span>Back to Employees</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className="btn btn-secondary btn-sm"
            style={{
              borderColor: isInactive ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)',
              color: isInactive ? '#10B981' : '#F87171'
            }}
          >
            {isInactive ? <UserCheck size={14} /> : <UserX size={14} />}
            <span>{isInactive ? 'Activate Employee' : 'Deactivate Employee'}</span>
          </button>

          <button onClick={handleOpenEdit} className="btn btn-primary btn-sm">
            <Edit3 size={14} />
            <span>Edit Employee</span>
          </button>
        </div>
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
                background: 'var(--accent-cyan-dim)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {employee.name}
                </h1>
                <StatusBadge status={employee.status} />
              </div>

              <div style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {employee.role} • <span style={{ color: 'var(--accent-cyan)' }}>{employee.department}</span>
              </div>

              <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                <span className="font-mono">{employee.id}</span>
                <span>•</span>
                <span>{employee.email}</span>
                <span>•</span>
                <span>Joined {employee.joinDate}</span>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '1rem 1.5rem',
              backgroundColor: 'var(--bg-secondary)',
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

        {/* Employee Attributes */}
        <div
          style={{
            marginTop: '1.5rem',
            paddingTop: '1.25rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem'
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Name</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{employee.name}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Email</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{employee.email}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Role</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{employee.role}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-cyan)', marginTop: '0.2rem' }}>{employee.department}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.2rem' }}>{employee.status}</div>
          </div>
        </div>

        {/* Permissions / Access Info */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1.1rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            <ShieldCheck size={16} color="var(--accent-cyan)" />
            <span>Permitted Console Modules:</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {effectivePermissions.map((mod) => (
              <span
                key={mod}
                style={{
                  fontSize: '0.74rem',
                  padding: '0.22rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'rgba(56, 189, 248, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--accent-cyan)',
                  fontWeight: 600
                }}
              >
                {mod}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Associated Assets & Related Incidents */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Layers size={18} color="var(--accent-cyan)" />
              Associated Digital Assets ({linkedAssets.length})
            </h3>
          </div>

          {linkedAssets.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No digital assets currently linked to this employee.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {linkedAssets.map((ast) => (
                <div
                  key={ast.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'var(--bg-secondary)',
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

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="var(--trust-0)" />
              Related Incidents ({linkedIncidents.length})
            </h3>
          </div>

          {linkedIncidents.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ✓ No active security incidents connected to this employee.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {linkedIncidents.map((inc) => (
                <div
                  key={inc.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <Link to={`/incidents/${inc.id}`} style={{ fontWeight: 600, color: 'var(--trust-0)', textDecoration: 'none', fontSize: '0.875rem' }}>
                      {inc.id}: {inc.title}
                    </Link>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Detected: {inc.detectedDate}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <StatusBadge status={inc.status} />
                    <Link to={`/incidents/${inc.id}`} className="btn btn-ghost btn-sm" style={{ padding: '0.3rem' }}>
                      <ExternalLink size={14} color="var(--trust-0)" />
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
          Recent Activity
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {(employee.activities || []).length === 0 ? (
            <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No recorded activity for this employee yet.
            </div>
          ) : (
            (employee.activities || []).map((act, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-secondary)',
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
                    {act.status || act.risk || 'RECORDED'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => !editSaving && setEditModalOpen(false)}
        title={`Edit Employee — ${employee.id}`}
      >
        <form onSubmit={handleEditSubmit}>
          {editError && (
            <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#EF4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{editError}</span>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Full Name *</label>
            <input
              type="text"
              className="input-field"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Corporate Email *</label>
            <input
              type="email"
              className="input-field"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Department *</label>
              <select
                className="input-field"
                value={editFormData.department}
                onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
              >
                {deptOptions.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Status *</label>
              <select
                className="input-field"
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="UNDER REVIEW">UNDER REVIEW</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Role Title *</label>
              <input
                type="text"
                className="input-field"
                value={editFormData.role}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Trust Score (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="input-field"
                value={editFormData.trustScore}
                onChange={(e) => setEditFormData({ ...editFormData, trustScore: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setEditModalOpen(false)} className="btn btn-secondary" disabled={editSaving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={editSaving}>
              <UserCheck size={16} />
              <span>{editSaving ? 'Updating...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
