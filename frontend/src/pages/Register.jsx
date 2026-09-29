import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Building2,
  Hash,
  User,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Sun,
  Moon,
  ArrowLeft,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { authApi } from '../utils/api';

export default function Register() {
  const { completeOrganizationSetup } = useAuth();
  const { addToast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [setupStatus, setSetupStatus] = useState({
    is_configured: false,
    organization_name: null,
    organization_id: null
  });

  const [formData, setFormData] = useState({
    organizationName: '',
    organizationId: '',
    adminName: '',
    adminEmail: '',
    password: '',
    confirmPassword: ''
  });

  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkSetup() {
      setCheckingStatus(true);
      try {
        const res = await authApi.getSetupStatus();
        if (mounted && res?.success && res?.data) {
          setSetupStatus({
            is_configured: Boolean(res.data.is_configured),
            organization_name: res.data.organization_name || null,
            organization_id: res.data.organization_id || null
          });
        }
      } catch (err) {
        console.warn('[TrustSphere Setup] Status check error:', err.message);
      } finally {
        if (mounted) setCheckingStatus(false);
      }
    }
    checkSetup();
    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (
      !formData.organizationName.trim() ||
      !formData.organizationId.trim() ||
      !formData.adminName.trim() ||
      !formData.adminEmail.trim() ||
      !formData.password
    ) {
      setError('Please complete all required organization setup fields.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Administrator password must be at least 6 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await completeOrganizationSetup(formData);
    setSubmitting(false);

    if (result.success) {
      addToast(
        result.message || 'Organization setup completed! Sign in with your Administrator credentials.',
        'success'
      );
      navigate('/login', {
        state: {
          registeredEmail: formData.adminEmail.trim().toLowerCase()
        }
      });
    } else {
      setError(result.message || 'Unable to complete organization setup.');
      if ((result.message || '').toLowerCase().includes('already configured')) {
        setSetupStatus((prev) => ({ ...prev, is_configured: true }));
      }
    }
  };

  return (
    <div className="cyber-grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 2rem'
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 500
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to TrustSphere</span>
        </Link>

        <button
          onClick={toggleTheme}
          className="btn-ghost"
          style={{
            padding: '0.45rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-primary)',
            fontSize: '0.75rem',
            fontWeight: 600
          }}
        >
          {theme === 'dark' ? <Sun size={15} color="#F59E0B" /> : <Moon size={15} color="var(--accent-cyan)" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
        <div
          className="glass-panel"
          style={{
            width: '100%',
            maxWidth: '540px',
            padding: '2.35rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(59, 130, 246, 0.2))',
                border: '1px solid var(--border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)',
                margin: '0 auto 0.9rem auto'
              }}
            >
              <ShieldCheck size={25} />
            </div>
            <h2 style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Organization Initial <span style={{ color: 'var(--accent-cyan)' }}>Setup</span>
            </h2>
            <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              One-time enterprise deployment configuration and initial Administrator provisioning.
            </p>
          </div>

          {checkingStatus ? (
            <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin" style={{ margin: '0 auto 0.85rem', color: 'var(--accent-cyan)' }} />
              <div style={{ fontSize: '0.88rem' }}>Checking organization deployment status...</div>
            </div>
          ) : setupStatus.is_configured ? (
            <div style={{ textAlign: 'center', padding: '0.75rem 0.25rem' }}>
              <div
                style={{
                  padding: '1.35rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(16, 185, 129, 0.09)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  marginBottom: '1.5rem'
                }}
              >
                <CheckCircle2
                  size={34}
                  style={{ color: '#10B981', margin: '0 auto 0.75rem auto', display: 'block' }}
                />
                <div
                  style={{
                    fontSize: '1.02rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.45rem'
                  }}
                >
                  TrustSphere is already configured.
                </div>
                <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  TrustSphere is already configured for this organization. One-time initial organization setup has been completed—new
                  employee, manager, and auditor accounts are provisioned by the Organization Administrator after sign-in.
                </p>

                {(setupStatus.organization_name || setupStatus.organization_id) && (
                  <div
                    className="font-mono"
                    style={{
                      marginTop: '1rem',
                      padding: '0.55rem 0.85rem',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--bg-primary)',
                      border: '1px solid var(--border-subtle)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                      fontSize: '0.76rem',
                      color: 'var(--accent-cyan)'
                    }}
                  >
                    <Building2 size={14} />
                    <span>{setupStatus.organization_name || 'TrustSphere Enterprise'}</span>
                    {setupStatus.organization_id && (
                      <span style={{ color: 'var(--text-muted)' }}>({setupStatus.organization_id})</span>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="btn btn-primary btn-lg"
                style={{ width: '100%' }}
              >
                <span>Go to Login</span>
                <ArrowRight size={18} />
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid rgba(239, 68, 68, 0.32)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#F87171',
                    fontSize: '0.84rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '1.25rem'
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0.95rem' }}>
                  <div className="input-group">
                    <label className="input-label">Organization Name *</label>
                    <div style={{ position: 'relative' }}>
                      <Building2
                        size={16}
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
                        name="organizationName"
                        className="input-field"
                        style={{ paddingLeft: '36px' }}
                        placeholder="Acme Global Security"
                        value={formData.organizationName}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Organization ID / Code *</label>
                    <div style={{ position: 'relative' }}>
                      <Hash
                        size={16}
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
                        name="organizationId"
                        className="input-field font-mono"
                        style={{ paddingLeft: '36px', textTransform: 'uppercase' }}
                        placeholder="ORG-ACME-01"
                        value={formData.organizationId}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Initial Administrator Name *</label>
                  <div style={{ position: 'relative' }}>
                    <User
                      size={16}
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
                      name="adminName"
                      className="input-field"
                      style={{ paddingLeft: '36px' }}
                      placeholder="Alex Mercer"
                      value={formData.adminName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label">Initial Administrator Email *</label>
                  <div style={{ position: 'relative' }}>
                    <Mail
                      size={16}
                      style={{
                        position: 'absolute',
                        left: '12px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-muted)'
                      }}
                    />
                    <input
                      type="email"
                      name="adminEmail"
                      className="input-field"
                      style={{ paddingLeft: '36px' }}
                      placeholder="admin@organization.com"
                      value={formData.adminEmail}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.95rem' }}>
                  <div className="input-group">
                    <label className="input-label">Password *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)'
                        }}
                      />
                      <input
                        type="password"
                        name="password"
                        className="input-field"
                        style={{ paddingLeft: '36px' }}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Confirm Password *</label>
                    <div style={{ position: 'relative' }}>
                      <Lock
                        size={16}
                        style={{
                          position: 'absolute',
                          left: '12px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'var(--text-muted)'
                        }}
                      />
                      <input
                        type="password"
                        name="confirmPassword"
                        className="input-field"
                        style={{ paddingLeft: '36px' }}
                        placeholder="••••••••"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', marginTop: '0.5rem' }}
                  disabled={submitting}
                >
                  <span>{submitting ? 'Completing Setup...' : 'Complete Organization Setup'}</span>
                  <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
