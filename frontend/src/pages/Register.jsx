import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Server, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Register() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
      background: 'radial-gradient(ellipse at top, #0d1b2a 0%, #060913 100%)'
    }}>
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '2.5rem',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'rgba(0, 240, 255, 0.1)',
            border: '1px solid var(--border-accent)',
            marginBottom: '1rem',
            color: 'var(--accent-cyan)'
          }}>
            <ShieldCheck size={32} />
          </div>

          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            TrustSphere Deployment
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            Enterprise Deployment Architecture • Single-Tenant Environment
          </p>
        </div>

        <div style={{
          padding: '1.25rem',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(0, 240, 255, 0.04)',
          border: '1px solid rgba(0, 240, 255, 0.2)',
          marginBottom: '1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.9rem' }}>
            <Server size={18} />
            <span>Dedicated Organizational Instance</span>
          </div>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Public tenant registration is disabled for this deployment. User accounts and organizational roles are provisioned directly by the System Administrator.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={14} color="var(--trust-75)" />
              <span>MongoDB Enterprise Database Connected</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={14} color="var(--trust-75)" />
              <span>Cryptographic PBKDF2 Session Security Active</span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => navigate('/login')}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.85rem', fontSize: '0.95rem', fontWeight: 700 }}
        >
          <span>Sign In with Authorized Credentials</span>
          <ArrowRight size={16} />
        </button>

        <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Need credentials? Contact your corporate IT Security Operations desk.
        </div>
      </div>
    </div>
  );
}
