import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Eye,
  Edit3,
  UserCheck,
  UserX,
  AlertCircle
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import StatusBadge from '../components/common/StatusBadge';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';

const DEFAULT_DEPARTMENTS = [
  'Finance',
  'Human Resources',
  'Information Technology',
  'IT',
  'HR',
  'Operations',
  'Legal & Compliance',
  'Security'
];

export default function Employees() {
  const { employees, departments, addEmployee, updateEmployee, loadError, refetch } = useSecurity();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [togglingId, setTogglingId] = useState(null);

  // Add Employee Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    department: 'Finance',
    role: '',
    access_role: 'EMPLOYEE',
    password: '',
    status: 'ACTIVE',
    trustScore: 88
  });

  // Edit Employee Modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    department: 'Finance',
    role: '',
    access_role: 'EMPLOYEE',
    password: '',
    status: 'ACTIVE',
    trustScore: 88
  });

  const departmentOptions = useMemo(() => {
    const set = new Set(DEFAULT_DEPARTMENTS);
    (departments || []).forEach((d) => {
      if (d?.name) set.add(d.name);
    });
    (employees || []).forEach((e) => {
      if (e?.department) set.add(e.department);
    });
    return Array.from(set).sort();
  }, [departments, employees]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          (emp.name || '').toLowerCase().includes(q) ||
          (emp.email || '').toLowerCase().includes(q) ||
          (emp.id || '').toLowerCase().includes(q) ||
          (emp.role || '').toLowerCase().includes(q) ||
          (emp.department || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      if (deptFilter !== 'ALL' && (emp.department || '').toLowerCase() !== deptFilter.toLowerCase()) {
        return false;
      }

      if (statusFilter !== 'ALL' && (emp.status || '').toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      return true;
    });
  }, [employees, search, deptFilter, statusFilter]);

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;

    setSaving(true);
    setAddError(null);
    try {
      await addEmployee(formData);
      setModalOpen(false);
      setFormData({
        name: '',
        email: '',
        department: 'Finance',
        role: '',
        access_role: 'EMPLOYEE',
        password: '',
        status: 'ACTIVE',
        trustScore: 88
      });
      if (refetch) refetch();
    } catch (err) {
      setAddError(err.message || 'Failed to add employee.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditModal = (emp) => {
    setEditingEmployee(emp);
    setEditError(null);
    setEditFormData({
      name: emp.name || '',
      email: emp.email || '',
      department: emp.department || 'Finance',
      role: emp.role || '',
      access_role: (emp.role || '').toUpperCase().includes('ADMIN') ? 'ADMIN' : 'EMPLOYEE',
      password: '',
      status: (emp.status || 'ACTIVE').toUpperCase(),
      trustScore: typeof emp.trustScore === 'number' ? emp.trustScore : 88
    });
    setEditModalOpen(true);
  };

  const handleEditEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (!editFormData.name.trim() || !editFormData.email.trim() || !editFormData.role.trim()) {
      setEditError('Name, email, and role are required.');
      return;
    }

    setEditSaving(true);
    setEditError(null);
    try {
      await updateEmployee(editingEmployee.id, editFormData);
      setEditModalOpen(false);
      setEditingEmployee(null);
      if (refetch) refetch();
    } catch (err) {
      setEditError(err.message || 'Failed to update employee in MongoDB.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleToggleEmployeeStatus = async (emp) => {
    const isInactive = (emp.status || '').toUpperCase() === 'INACTIVE';
    const nextStatus = isInactive ? 'ACTIVE' : 'INACTIVE';
    setTogglingId(emp.id);
    try {
      await updateEmployee(emp.id, { status: nextStatus });
      if (refetch) refetch();
    } catch (err) {
      console.error('[Employees] toggle status error:', err);
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div>
      {/* Header with Single Primary Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Employees
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Manage organization employees, department assignments, roles, and console access status.
          </p>
        </div>

        <button onClick={() => { setAddError(null); setModalOpen(true); }} className="btn btn-primary">
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
              placeholder="Search by name, email, ID, or role..."
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
            {departmentOptions.map((dept) => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="UNDER REVIEW">Under Review</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {filteredEmployees.length === 0 ? (
        <EmptyState
          icon={Users}
          title={employees.length === 0 ? "No employees added yet." : "No employees found"}
          description={employees.length === 0 ? "Add your first organization employee to manage roles, department assignments, and console access." : "Try modifying your search criteria or add a new employee profile."}
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
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.map((emp) => {
                const isInactive = (emp.status || '').toUpperCase() === 'INACTIVE';
                return (
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
                            background: 'var(--accent-cyan-dim)',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <Link
                          to={`/employees/${emp.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.3rem 0.6rem' }}
                          title="View employee details"
                        >
                          <Eye size={13} />
                          <span>View</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(emp)}
                          className="btn btn-ghost btn-sm"
                          style={{
                            color: 'var(--accent-cyan)',
                            border: '1px solid var(--border-subtle)',
                            padding: '0.3rem 0.6rem'
                          }}
                          title="Edit employee information"
                        >
                          <Edit3 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleEmployeeStatus(emp)}
                          disabled={togglingId === emp.id}
                          className="btn btn-ghost btn-sm"
                          style={{
                            color: isInactive ? '#10B981' : '#F87171',
                            border: '1px solid var(--border-subtle)',
                            padding: '0.3rem 0.6rem'
                          }}
                          title={isInactive ? 'Activate employee account' : 'Deactivate employee account'}
                        >
                          {isInactive ? <UserCheck size={13} /> : <UserX size={13} />}
                          <span>{isInactive ? 'Activate' : 'Deactivate'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Employee Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="Add New Organization Employee"
      >
        <form onSubmit={handleAddEmployee}>
          {addError && (
            <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#EF4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{addError}</span>
            </div>
          )}

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
                {departmentOptions.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Access Level</label>
              <select
                className="input-field"
                value={formData.access_role}
                onChange={(e) => setFormData({ ...formData, access_role: e.target.value })}
              >
                <option value="EMPLOYEE">EMPLOYEE (Work Modules)</option>
                <option value="ADMIN">ADMIN (Full Console)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '1rem' }}>
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

            <div className="input-group">
              <label className="input-label">Initial Trust Rating (0-100)</label>
              <input
                type="number"
                min="0"
                max="100"
                className="input-field"
                value={formData.trustScore}
                onChange={(e) => setFormData({ ...formData, trustScore: parseInt(e.target.value, 10) || 85 })}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Initial Login Password (defaults to Employee@123 if blank)</label>
            <input
              type="password"
              className="input-field"
              placeholder="Employee@123"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary" disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <UserCheck size={16} />
              <span>{saving ? 'Saving...' : 'Save Employee'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => !editSaving && setEditModalOpen(false)}
        title={`Edit Employee — ${editingEmployee?.id || ''}`}
      >
        <form onSubmit={handleEditEmployeeSubmit}>
          {editError && (
            <div style={{ padding: '0.75rem 1rem', marginBottom: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#EF4444', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={16} />
              <span>{editError}</span>
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Employee ID</label>
            <input
              type="text"
              className="input-field font-mono"
              value={editingEmployee?.id || ''}
              disabled
            />
          </div>

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
                {departmentOptions.map((dept) => (
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Access Level</label>
              <select
                className="input-field"
                value={editFormData.access_role}
                onChange={(e) => setEditFormData({ ...editFormData, access_role: e.target.value })}
              >
                <option value="EMPLOYEE">EMPLOYEE</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Reset Password (optional)</label>
              <input
                type="password"
                className="input-field"
                placeholder="Leave blank to keep current"
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="btn btn-secondary"
              disabled={editSaving}
            >
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
