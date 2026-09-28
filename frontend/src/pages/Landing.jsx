import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  Layers,
  Mail,
  FileSearch,
  AlertTriangle,
  History,
  BarChart3,
  Sun,
  Moon,
  CheckCircle2,
  Building2,
  UserCheck
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  const workflowSteps = [
    { step: '01', label: 'CONNECT', desc: 'Link organization Gmail or upload files' },
    { step: '02', label: 'VERIFY', desc: '7-layer cryptographic & structure checks' },
    { step: '03', label: 'ANALYZE', desc: 'AI-assisted trust & risk scoring (0–100)' },
    { step: '04', label: 'MONITOR', desc: 'Real-time incident & anomaly tracking' },
    { step: '05', label: 'REPORT', desc: 'Audit trail & executive compliance reports' }
  ];

  const capabilities = [
    {
      title: 'Digital Asset Verification',
      icon: Layers,
      desc: 'Cryptographic SHA-256 integrity, metadata, and structural verification for enterprise documents and files.'
    },
    {
      title: 'Email Verification',
      icon: Mail,
      desc: 'Direct Google OAuth 2.0 Gmail integration to automatically ingest and verify incoming emails and attachments.'
    },
    {
      title: 'Trust & Risk Analysis',
      icon: FileSearch,
      desc: 'Multi-factor trust scoring and AI-driven anomaly detection to surface tampered or high-risk content.'
    },
    {
      title: 'Incident Monitoring',
      icon: AlertTriangle,
      desc: 'Automated security incident creation, severity triage, and investigation workflow for flagged assets.'
    },
    {
      title: 'Audit Trail',
      icon: History,
      desc: 'Complete activity logging across user actions, asset uploads, email syncs, and security events.'
    },
    {
      title: 'Reports',
      icon: BarChart3,
      desc: 'Departmental trust benchmarks and exportable executive risk reports in PDF and CSV formats.'
    }
  ];

  return (
    <div className="cyber-grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <header
        style={{
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 2.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
          backdropFilter: 'blur(10px)',
          position: 'sticky',
          top: 0,
          zIndex: 50
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(59, 130, 246, 0.2))',
              border: '1px solid var(--border-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Trust<span style={{ color: 'var(--accent-cyan)' }}>Sphere</span>
            </h1>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Enterprise Decision Trust Intelligence
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
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
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={15} color="#F59E0B" /> : <Moon size={15} color="var(--accent-cyan)" />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <Link to="/login" className="btn btn-secondary">
            <span>Login</span>
          </Link>
          <Link to="/login" className="btn btn-primary">
            <span>Get Started</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section
        className="radial-glow-top"
        style={{
          padding: '4.25rem 2rem 3rem 2rem',
          maxWidth: '1120px',
          margin: '0 auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.32rem 0.9rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0, 240, 255, 0.08)',
            border: '1px solid var(--border-glow)',
            color: 'var(--accent-cyan)',
            fontSize: '0.76rem',
            fontWeight: 600,
            marginBottom: '1.25rem',
            letterSpacing: '0.05em'
          }}
        >
          <ShieldCheck size={14} />
          <span>ENTERPRISE CYBERSECURITY & DIGITAL TRUST</span>
        </div>

        <h1
          style={{
            fontSize: '2.65rem',
            fontWeight: 800,
            lineHeight: 1.18,
            marginBottom: '0.9rem',
            maxWidth: '900px',
            letterSpacing: '-0.02em',
            color: 'var(--text-primary)'
          }}
        >
          Trust<span style={{ color: 'var(--accent-cyan)' }}>Sphere</span> — Enterprise Decision Trust Intelligence Platform
        </h1>

        <p
          style={{
            fontSize: '1.08rem',
            color: 'var(--text-secondary)',
            maxWidth: '720px',
            lineHeight: 1.55,
            marginBottom: '2rem'
          }}
        >
          Verify digital assets, incoming emails, and enterprise documents in real time to detect tampering, monitor security incidents, and govern organizational trust.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '3rem' }}>
          <Link to="/login" className="btn btn-primary btn-lg">
            <span>Get Started</span>
            <ArrowRight size={18} />
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            <span>Login to Console</span>
          </Link>
        </div>

        {/* Visual Workflow: CONNECT -> VERIFY -> ANALYZE -> MONITOR -> REPORT */}
        <div
          className="glass-panel"
          style={{
            width: '100%',
            padding: '1.75rem 1.5rem',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1.25rem' }}>
            Continuous Verification Workflow
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
              gap: '0.85rem',
              alignItems: 'stretch'
            }}
          >
            {workflowSteps.map((item, idx) => (
              <div
                key={item.label}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  textAlign: 'left',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="font-mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                    {item.step}
                  </span>
                  {idx < workflowSteps.length - 1 && (
                    <ArrowRight size={14} color="var(--text-muted)" />
                  )}
                </div>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Concise "How TrustSphere Works" Section */}
      <section style={{ padding: '1.5rem 2rem 2.5rem 2rem', maxWidth: '1120px', margin: '0 auto', width: '100%' }}>
        <div
          className="glass-panel"
          style={{
            padding: '2rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.5rem' }}>
              <ShieldCheck size={17} />
              <span>1. WHAT IS TRUSTSPHERE?</span>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              An enterprise security console that verifies files and Gmail messages through a 7-layer trust pipeline, assigns a 0–100 Trust Score, and flags threats automatically.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.5rem' }}>
              <Building2 size={17} />
              <span>2. WHO USES IT?</span>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              <strong>Security Administrators</strong> manage organization email, employees, departments, digital twin, and governance. <strong>Employees</strong> verify digital assets and track incidents.
            </p>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-cyan)', fontWeight: 700, fontSize: '0.82rem', marginBottom: '0.5rem' }}>
              <UserCheck size={17} />
              <span>3. HOW TO START?</span>
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
              Click <strong>Login</strong> to access your organization workspace, upload a digital asset or connect your organization Gmail account, and review live trust intelligence.
            </p>
          </div>
        </div>
      </section>

      {/* 6 Capability Cards */}
      <section style={{ padding: '1.5rem 2rem 4.5rem 2rem', maxWidth: '1120px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Core Platform Capabilities
          </span>
          <h2 style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.35rem' }}>
            Unified Digital Trust & Risk Operations
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '1.25rem' }}>
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div
                key={cap.title}
                className="glass-panel glass-panel-hover"
                style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
              >
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: 'rgba(0, 240, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-cyan)'
                  }}
                >
                  <Icon size={21} />
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {cap.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  {cap.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--border-subtle)',
          padding: '1.5rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.82rem'
        }}
      >
        <p>TrustSphere — Enterprise Decision Trust Intelligence Platform</p>
      </footer>
    </div>
  );
}
