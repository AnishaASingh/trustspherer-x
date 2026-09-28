import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Plus, 
  Eye, 
  UserCheck, 
  Building2, 
  ShieldCheck,
  Filter
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';

export default function Employees() {
  const { employees, addEmployee, loadError, refetch } = useSecurity();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // New employee form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: 'Finance',
    role: '',
    trustScore: 88
  });

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = 
          emp.name.toLowerCase().includes(q) ||
          emp.email.toLowerCase().includes(q) ||
          emp.id.toLowerCase().includes(q) ||
          emp.role.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (deptFilter !== 'ALL' && emp.department.toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }

      if (statusFilter !== 'ALL' && emp.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      return true;
    });
  }, [employees, search, deptFilter, statusFilter]);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    setSaving(true);
    try {
      await addEmployee(formData);
      setModalOpen(false);
      setFormData({
        name: '',
        email: '',
        department: 'Finance',
        role: '',
        trustScore: 88
      });
    } catch (err) {
      console.error('[AddEmployee Error]', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Employee Security Directory
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Organizational identity registry, security roles, and individual trust evaluations.
          </p>
        </div>

        <button onClick={() => setModalOpen(true)} className="btn btn-primary">
          <Plus size={16} />
          <span>Add Employee</span>
        </button>
      </div>
      
      {loadError && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <span>{loadError}</span>
          <button onClick={refetch} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search by name, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '34px' }}
            />
          </div>

          <select 
            className="input-field"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            <option value="Finance">Finance</option>
            <option value="HR">HR</option>
            <option value="IT">IT</option>
            <option value="Operations">Operations</option>
          </select>

          <select 
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="UNDER REVIEW">Under Review</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredEmployees.length === 0 ? (
        <EmptyState 
          icon={Users}
          title="No employees found"
          description="Try modifying your search criteria or add a new employee profile."
        />
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Department</th>
                <th>Role</th>
                <th>Trust Score</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => (
                <tr key={emp.id}>
                  <td className="font-mono">
                    <Link to={`/employees/${emp.id}`} style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 600 }}>
                      {emp.id}
                    </Link>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div 
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: 'rgba(56, 189, 248, 0.1)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent-cyan)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.72rem',
                          fontWeight: 700
                        }}
                      >
                        {emp.avatar || emp.name.substring(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600 }}>{emp.name}</span>
                    </div>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{emp.email}</td>
                  <td>{emp.department}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{emp.role}</td>
                  <td>
                    <TrustScoreBadge score={emp.trustScore} size="sm" />
                  </td>
                  <td>
                    <StatusBadge status={emp.status} />
                  </td>
                  <td>
                    <Link to={`/employees/${emp.id}`} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-cyan)' }}>
                      <Eye size={14} />
                      <span>Profile</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        title="Add New Organization Employee"
      >
        <form onSubmit={handleAddEmployee}>
          <div className="input-group">
            <label className="input-label">Full Name *</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Alex Morgan" 
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required 
            />
          </div>

          <div className="input-group">
            <label className="input-label">Corporate Email *</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="a.morgan@trustsphere.corp" 
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required 
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Department</label>
              <select 
                className="input-field"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="Finance">Finance</option>
                <option value="HR">HR</option>
                <option value="IT">IT</option>
                <option value="Operations">Operations</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Initial Trust Rating (0-100)</label>
              <input 
                type="number" 
                min="30" 
                max="100" 
                className="input-field" 
                value={formData.trustScore}
                onChange={(e) => setFormData({ ...formData, trustScore: parseInt(e.target.value, 10) || 85 })}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Role Title *</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="e.g. Treasury Analyst" 
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              required 
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <UserCheck size={16} />
              <span>Save Employee</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
