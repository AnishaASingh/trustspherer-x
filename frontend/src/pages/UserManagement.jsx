import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  UserCheck, 
  Search, 
  Plus, 
  Edit3, 
  Key, 
  Trash2, 
  Shield, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  AlertTriangle, 
  Building2, 
  Users as UsersIcon,
  Lock,
  UserX,
  Mail,
  BadgeCheck
} from 'lucide-react';
import { usersApi } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';

const SYSTEM_ROLES = [
  "ADMIN",
  "MANAGER",
  "EMPLOYEE",
  "AUDITOR",
  "Security Administrator",
  "Security Analyst"
];

const DEPARTMENTS = [
  "Finance",
  "HR",
  "IT",
  "Operations",
  "Security",
  "Compliance",
  "Executive"
];

export default function UserManagement() {
  const { user: currentAdmin } = useAuth();
  const { addToast } = useToast();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Search & Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Target User selections
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [addForm, setAddForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Security Analyst',
    department: 'Finance',
    employee_id: '',
    status: 'ACTIVE'
  });

  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    department: '',
    employee_id: '',
    status: 'ACTIVE'
  });

  const [resetPasswordForm, setResetPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  // Verify Admin privilege
  const isAdmin = currentAdmin?.role?.toUpperCase() === 'ADMIN';

  const isCurrentAdmin = (target) => {
    if (!target || !currentAdmin) return false;
    return target.id === currentAdmin.id || target.email?.toLowerCase() === currentAdmin.email?.toLowerCase();
  };

  // Fetch Users
  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (!isAdmin) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await usersApi.getUsers();
      if (res?.success && res?.data?.users) {
        setUsers(res.data.users);
      } else {
        setError(res?.message || 'Failed to retrieve user registry.');
      }
    } catch (err) {
      console.error('[UserManagement] fetch error:', err);
      setError(err.message || 'Failed to connect to User Management API.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = 
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.employee_id && u.employee_id.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (roleFilter !== 'ALL' && u.role.toLowerCase() !== roleFilter.toLowerCase()) {
        return false;
      }

      if (deptFilter !== 'ALL' && (!u.department || u.department.toLowerCase() !== deptFilter.toLowerCase())) {
        return false;
      }

      if (statusFilter !== 'ALL' && u.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      return true;
    });
  }, [users, search, roleFilter, deptFilter, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'ACTIVE').length;
    const inactive = users.filter((u) => u.status === 'INACTIVE').length;
    const admins = users.filter((u) => u.role.toUpperCase() === 'ADMIN').length;
    return { total, active, inactive, admins };
  }, [users]);

  // 1. Add User Handler
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password) {
      addToast('Please fill in all required fields.', 'warning');
      return;
    }
    if (addForm.password.length < 6) {
      addToast('Password must be at least 6 characters.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await usersApi.createUser(addForm);
      if (res?.success) {
        addToast(res.message || `User '${addForm.email}' created successfully!`, 'success');
        setAddModalOpen(false);
        setAddForm({
          name: '',
          email: '',
          password: '',
          role: 'Security Analyst',
          department: 'Finance',
          employee_id: '',
          status: 'ACTIVE'
        });
        fetchUsers(true);
      }
    } catch (err) {
      addToast(err.message || 'Failed to create user account.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Open Edit Modal
  const openEditModal = (target) => {
    setSelectedUser(target);
    setEditForm({
      name: target.name || '',
      role: target.role || 'Security Analyst',
      department: target.department || '',
      employee_id: target.employee_id || '',
      status: target.status || 'ACTIVE'
    });
    setEditModalOpen(true);
  };

  // Submit Edit User
  const handleEditUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      const res = await usersApi.updateUser(selectedUser.id, editForm);
      if (res?.success) {
        addToast(`User '${selectedUser.email}' updated successfully.`, 'success');
        setEditModalOpen(false);
        fetchUsers(true);
      }
    } catch (err) {
      addToast(err.message || 'Failed to update user.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Toggle Status (Activate / Deactivate)
  const handleToggleStatus = async (target) => {
    if (isCurrentAdmin(target)) {
      addToast('Safety lock: You cannot deactivate your own administrator account.', 'warning');
      return;
    }

    const newStatus = target.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      const res = await usersApi.updateUserStatus(target.id, newStatus);
      if (res?.success) {
        addToast(`User '${target.email}' is now ${newStatus}.`, 'success');
        fetchUsers(true);
      }
    } catch (err) {
      addToast(err.message || 'Failed to change user status.', 'error');
    }
  };

  // 4. Open Reset Password Modal
  const openResetModal = (target) => {
    setSelectedUser(target);
    setResetPasswordForm({ newPassword: '', confirmPassword: '' });
    setResetModalOpen(true);
  };

  // Submit Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (!resetPasswordForm.newPassword || resetPasswordForm.newPassword.length < 6) {
      addToast('Password must be at least 6 characters long.', 'warning');
      return;
    }
    if (resetPasswordForm.newPassword !== resetPasswordForm.confirmPassword) {
      addToast('Passwords do not match.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const res = await usersApi.resetPassword(selectedUser.id, resetPasswordForm.newPassword);
      if (res?.success) {
        addToast(res.message || `Password for '${selectedUser.email}' has been reset.`, 'success');
        setResetModalOpen(false);
      }
    } catch (err) {
      addToast(err.message || 'Failed to reset password.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Open Delete Modal
  const openDeleteModal = (target) => {
    if (isCurrentAdmin(target)) {
      addToast('Safety lock: You cannot delete your own administrator account.', 'warning');
      return;
    }
    setSelectedUser(target);
    setDeleteModalOpen(true);
  };

  // Submit Delete User
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await usersApi.deleteUser(selectedUser.id);
      if (res?.success) {
        addToast(`User account '${selectedUser.email}' permanently deleted.`, 'success');
        setDeleteModalOpen(false);
        fetchUsers(true);
      }
    } catch (err) {
      addToast(err.message || 'Failed to delete user account.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Unauthorized View
  if (!isAdmin) {
    return (
      <div style={{ padding: '3rem 1rem', display: 'flex', justifyContent: 'center' }}>
        <div 
          className="glass-panel" 
          style={{ 
            maxWidth: '560px', 
            width: '100%', 
            padding: '2.5rem', 
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.4)' 
          }}
        >
          <div 
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              color: '#EF4444'
            }}
          >
            <ShieldAlert size={36} />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
            Administrative Privileges Required
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            The User Management module is restricted strictly to users with the <span className="badge badge-critical font-mono">ADMIN</span> role. 
            Your current assigned role is <strong style={{ color: 'var(--accent-cyan)' }}>{currentAdmin?.role || 'Restricted User'}</strong>.
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            If you require elevated permissions, please contact your TrustSphere organization administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem', 
          flexWrap: 'wrap', 
          gap: '1rem' 
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Enterprise User Administration
            </h1>
            <span className="badge badge-highly-trusted" style={{ fontSize: '0.7rem' }}>
              <Shield size={12} style={{ marginRight: '4px' }} />
              ADMIN ONLY
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Manage platform operator identities, role assignments, authentication credentials, and account statuses.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button 
            onClick={() => fetchUsers(true)} 
            className="btn btn-secondary"
            disabled={refreshing || loading}
            title="Refresh user list"
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button 
            onClick={() => setAddModalOpen(true)} 
            className="btn btn-primary"
          >
            <Plus size={16} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={() => fetchUsers(true)} className="btn btn-secondary btn-sm">
            Retry
          </button>
        </div>
      )}

      {/* Metric Cards Banner */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        <div className="glass-panel" style={{ padding: '1.25rem', position: 'relative' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total Registered Users
          </div>
          <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Across all organizational domains
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Accounts
          </div>
          <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--trust-75)', marginTop: '0.35rem' }}>
            {stats.active}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Permitted system access
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Suspended / Inactive
          </div>
          <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: stats.inactive > 0 ? '#F87171' : 'var(--text-muted)', marginTop: '0.35rem' }}>
            {stats.inactive}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Access blocked by policy
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Administrators
          </div>
          <div className="font-mono" style={{ fontSize: '1.85rem', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '0.35rem' }}>
            {stats.admins}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            Full system governance access
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search 
              size={15} 
              style={{ 
                position: 'absolute', 
                left: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-muted)' 
              }} 
            />
            <input 
              type="text"
              placeholder="Search by name, email, employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '34px' }}
            />
          </div>

          <select 
            className="input-field"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="ALL">All Roles</option>
            {SYSTEM_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select 
            className="input-field"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select 
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="glass-panel" style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} className="spin" style={{ margin: '0 auto 1rem', color: 'var(--accent-cyan)' }} />
          <div>Loading authenticated users from TrustSphereDB...</div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState 
          icon={UsersIcon}
          title="No users found"
          description="Adjust your search parameters or register a new administrative or operator account."
        />
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>User / Operator</th>
                <th>Email Address</th>
                <th>Role & Scope</th>
                <th>Department</th>
                <th>Employee Link</th>
                <th>Status</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSelf = isCurrentAdmin(u);
                const roleUpper = u.role.toUpperCase();
                const isAdm = roleUpper === 'ADMIN';

                return (
                  <tr key={u.id} style={isSelf ? { backgroundColor: 'rgba(0, 240, 255, 0.03)' } : undefined}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div 
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: isAdm 
                              ? 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(59, 130, 246, 0.3))' 
                              : 'rgba(100, 116, 139, 0.15)',
                            border: isAdm ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                            color: isAdm ? 'var(--accent-cyan)' : 'var(--text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            flexShrink: 0
                          }}
                        >
                          {u.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                            {isSelf && (
                              <span 
                                className="badge" 
                                style={{ 
                                  fontSize: '0.65rem', 
                                  padding: '0.1rem 0.4rem', 
                                  backgroundColor: 'rgba(0, 240, 255, 0.12)', 
                                  color: 'var(--accent-cyan)',
                                  border: '1px solid rgba(0, 240, 255, 0.3)'
                                }}
                              >
                                YOU (ACTIVE SESSION)
                              </span>
                            )}
                          </div>
                          <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            ID: {u.id.substring(0, 10)}...
                          </span>
                        </div>
                      </div>
                    </td>

                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Mail size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        <span>{u.email}</span>
                      </div>
                    </td>

                    <td>
                      <span 
                        className="badge" 
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.55rem',
                          backgroundColor: isAdm ? 'rgba(0, 240, 255, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                          color: isAdm ? 'var(--accent-cyan)' : '#60A5FA',
                          border: isAdm ? '1px solid rgba(0, 240, 255, 0.35)' : '1px solid rgba(59, 130, 246, 0.35)'
                        }}
                      >
                        {isAdm ? <Shield size={11} style={{ marginRight: '4px' }} /> : null}
                        {u.role}
                      </span>
                    </td>

                    <td>
                      {u.department ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem' }}>
                          <Building2 size={13} style={{ color: 'var(--text-muted)' }} />
                          <span>{u.department}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>

                    <td>
                      {u.employee_id ? (
                        <span className="font-mono" style={{ fontSize: '0.78rem', color: 'var(--accent-cyan)' }}>
                          {u.employee_id}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Unlinked</span>
                      )}
                    </td>

                    <td>
                      <StatusBadge status={u.status} />
                    </td>

                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>

                    {/* Actions Column */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        {/* Edit Button */}
                        <button
                          onClick={() => openEditModal(u)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.35rem 0.5rem', color: 'var(--accent-cyan)' }}
                          title="Edit user details and role"
                        >
                          <Edit3 size={14} />
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => openResetModal(u)}
                          className="btn btn-ghost btn-sm"
                          style={{ padding: '0.35rem 0.5rem', color: '#FBBF24' }}
                          title="Reset user password"
                        >
                          <Key size={14} />
                        </button>

                        {/* Activate / Deactivate Button */}
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isSelf}
                          className="btn btn-ghost btn-sm"
                          style={{ 
                            padding: '0.35rem 0.5rem', 
                            color: isSelf ? 'var(--text-muted)' : u.status === 'ACTIVE' ? '#F87171' : 'var(--trust-75)',
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSelf ? 0.4 : 1
                          }}
                          title={
                            isSelf 
                              ? "Safety lock: Cannot deactivate your own administrator account" 
                              : u.status === 'ACTIVE' ? "Deactivate account" : "Activate account"
                          }
                        >
                          {u.status === 'ACTIVE' ? <UserX size={14} /> : <CheckCircle2 size={14} />}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => openDeleteModal(u)}
                          disabled={isSelf}
                          className="btn btn-ghost btn-sm"
                          style={{ 
                            padding: '0.35rem 0.5rem', 
                            color: isSelf ? 'var(--text-muted)' : '#EF4444',
                            cursor: isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSelf ? 0.4 : 1
                          }}
                          title={
                            isSelf 
                              ? "Safety lock: Cannot delete your own administrator account" 
                              : "Permanently delete account"
                          }
                        >
                          <Trash2 size={14} />
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

      {/* ============================================================ */}
      {/* 1. ADD USER MODAL */}
      {/* ============================================================ */}
      <Modal 
        isOpen={addModalOpen} 
        onClose={() => !submitting && setAddModalOpen(false)}
        title="Add New Organization User"
        maxWidth="600px"
      >
        <form onSubmit={handleAddUser}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Full Name *</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. Elena Rostova" 
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Corporate Email *</label>
              <input 
                type="email" 
                className="input-field" 
                placeholder="elena.r@trustsphere.corp" 
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                required 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Temporary Password * (min 6 chars)</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="SecurePass123!" 
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                minLength={6}
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Assigned Role *</label>
              <select 
                className="input-field"
                value={addForm.role}
                onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                required
              >
                {SYSTEM_ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Department Association</label>
              <select 
                className="input-field"
                value={addForm.department}
                onChange={(e) => setAddForm({ ...addForm, department: e.target.value })}
              >
                <option value="">Unassigned</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Employee ID (Optional)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="e.g. EMP-10492" 
                value={addForm.employee_id}
                onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value })}
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Initial Account Status</label>
            <select 
              className="input-field"
              value={addForm.status}
              onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
            >
              <option value="ACTIVE">ACTIVE (Immediate Access Permitted)</option>
              <option value="INACTIVE">INACTIVE (Staged / Suspended)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button 
              type="button" 
              onClick={() => setAddModalOpen(false)} 
              className="btn btn-secondary"
              disabled={submitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? 'Creating Account...' : 'Create Account'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ============================================================ */}
      {/* 2. EDIT USER MODAL */}
      {/* ============================================================ */}
      <Modal 
        isOpen={editModalOpen} 
        onClose={() => !submitting && setEditModalOpen(false)}
        title={`Edit User: ${selectedUser?.email || ''}`}
        maxWidth="600px"
      >
        {selectedUser && (
          <form onSubmit={handleEditUser}>
            {isCurrentAdmin(selectedUser) && (
              <div 
                style={{ 
                  padding: '0.75rem 1rem', 
                  backgroundColor: 'rgba(0, 240, 255, 0.08)', 
                  border: '1px solid rgba(0, 240, 255, 0.3)', 
                  borderRadius: 'var(--radius-sm)', 
                  marginBottom: '1rem',
                  fontSize: '0.8rem',
                  color: 'var(--accent-cyan)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <Shield size={16} />
                <span>You are editing your active administrator account. Role and status are safety-locked.</span>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Full Name *</label>
              <input 
                type="text" 
                className="input-field" 
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Role</label>
                <select 
                  className="input-field"
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  disabled={isCurrentAdmin(selectedUser)}
                  title={isCurrentAdmin(selectedUser) ? "Cannot change own role away from ADMIN" : undefined}
                >
                  {SYSTEM_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Account Status</label>
                <select 
                  className="input-field"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  disabled={isCurrentAdmin(selectedUser)}
                  title={isCurrentAdmin(selectedUser) ? "Cannot deactivate own account" : undefined}
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">Department Association</label>
                <select 
                  className="input-field"
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">Employee ID</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. EMP-99201" 
                  value={editForm.employee_id}
                  onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                onClick={() => setEditModalOpen(false)} 
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ============================================================ */}
      {/* 3. RESET PASSWORD MODAL */}
      {/* ============================================================ */}
      <Modal 
        isOpen={resetModalOpen} 
        onClose={() => !submitting && setResetModalOpen(false)}
        title={`Reset Password: ${selectedUser?.email || ''}`}
        maxWidth="500px"
      >
        {selectedUser && (
          <form onSubmit={handleResetPassword}>
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.3)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.85rem', color: '#FCD34D' }}>
              Setting a new password will immediately update the PBKDF2-HMAC-SHA256 hash in TrustSphereDB and require the user to authenticate with the new credential.
            </div>

            <div className="input-group">
              <label className="input-label">New Password * (min 6 chars)</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Enter new password" 
                value={resetPasswordForm.newPassword}
                onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, newPassword: e.target.value })}
                minLength={6}
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Confirm New Password *</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Repeat new password" 
                value={resetPasswordForm.confirmPassword}
                onChange={(e) => setResetPasswordForm({ ...resetPasswordForm, confirmPassword: e.target.value })}
                minLength={6}
                required 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button 
                type="button" 
                onClick={() => setResetModalOpen(false)} 
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ backgroundColor: '#D97706', borderColor: '#F59E0B' }}
                disabled={submitting}
              >
                {submitting ? 'Resetting Password...' : 'Confirm Reset Password'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ============================================================ */}
      {/* 4. CONFIRM DELETION MODAL */}
      {/* ============================================================ */}
      <Modal 
        isOpen={deleteModalOpen} 
        onClose={() => !submitting && setDeleteModalOpen(false)}
        title="Confirm User Account Deletion"
        maxWidth="500px"
      >
        {selectedUser && (
          <div>
            <div 
              style={{ 
                padding: '1.25rem', 
                backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                border: '1px solid rgba(239, 68, 68, 0.35)', 
                borderRadius: 'var(--radius-sm)', 
                color: '#F87171',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                marginBottom: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 700 }}>
                <AlertTriangle size={18} />
                <span>Permanent Deletion Warning</span>
              </div>
              Are you sure you want to permanently delete the user account for:
              <div style={{ margin: '0.5rem 0', fontWeight: 700, color: '#FFF' }}>
                {selectedUser.name} ({selectedUser.email})
              </div>
              This action cannot be undone. An administrative audit log will be permanently stored in MongoDB.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button 
                type="button" 
                onClick={() => setDeleteModalOpen(false)} 
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleDeleteUser} 
                className="btn btn-danger"
                disabled={submitting}
              >
                {submitting ? 'Deleting Account...' : 'Permanently Delete User'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
