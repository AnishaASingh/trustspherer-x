import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  ArrowRight, 
  Layers, 
  FileSearch, 
  AlertTriangle, 
  Eye, 
  Share2, 
  BarChart3, 
  Lock, 
  Zap, 
  CheckCircle2,
  Cpu
} from 'lucide-react';

export default function Landing() {
  const features = [
    {
      title: "Digital Asset Verification",
      icon: Layers,
      desc: "Instant cryptographic integrity analysis for PDFs, contracts, certificates, and invoices with SHA-256 validation."
    },
    {
      title: "Trust Analysis",
      icon: FileSearch,
      desc: "Multidimensional trust scoring evaluating source reliability, metadata integrity, and behavioral anomalies."
    },
    {
      title: "Risk Detection",
      icon: AlertTriangle,
      desc: "Autonomous discovery of suspicious document alteration, punycode spoofing, and forged credentials."
    },
    {
      title: "Incident Monitoring",
      icon: Eye,
      desc: "Coordinated incident response queue featuring forensic timeline recreation and automated triage."
    },
    {
      title: "Digital Twin",
      icon: Share2,
      desc: "Live graph topology mapping organizations to departments, personnel, digital assets, and threats."
    },
    {
      title: "Trust & Risk Reports",
      icon: BarChart3,
      desc: "Executive decision intelligence dashboards with department benchmarking and one-click PDF/CSV exports."
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
          background: 'rgba(6, 9, 17, 0.8)',
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
            <h1 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF' }}>
              Trust<span style={{ color: 'var(--accent-cyan)' }}>Sphere</span>
            </h1>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Enterprise Decision Trust Intelligence
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/login" className="btn btn-secondary">
            <span>Login</span>
          </Link>
          <Link to="/register" className="btn btn-primary">
            <span>Get Started</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="radial-glow-top"
        style={{
          padding: '5rem 2rem 4rem 2rem',
          maxWidth: '1200px',
          margin: '0 auto',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.35rem 1rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0, 240, 255, 0.08)',
            border: '1px solid var(--border-glow)',
            color: 'var(--accent-cyan)',
            fontSize: '0.8rem',
            fontWeight: 600,
            marginBottom: '1.75rem',
            letterSpacing: '0.04em'
          }}
        >
          <Zap size={14} />
          <span>CYBER-SECURITY & DIGITAL TRUST PLATFORM</span>
        </div>

        <h1 style={{ fontSize: '3.25rem', fontWeight: 800, lineHeight: 1.15, marginBottom: '1.25rem', maxWidth: '850px', letterSpacing: '-0.02em' }}>
          Trust<span style={{ color: 'var(--accent-cyan)' }}>Sphere</span>
        </h1>
        
        <h2 style={{ fontSize: '1.5rem', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '750px' }}>
          Enterprise Decision Trust Intelligence Platform
        </h2>

        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', maxWidth: '680px', lineHeight: 1.6, marginBottom: '2.5rem' }}>
          Verify digital assets, identify risks, monitor incidents, and understand organizational trust from a unified security platform.
        </p>

        <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/register" className="btn btn-primary btn-lg">
            <span>Get Started</span>
            <ArrowRight size={18} />
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            <span>Access Console (Login)</span>
          </Link>
        </div>

        {/* Security Connected Nodes Visualization */}
        <div 
          className="glass-panel"
          style={{
            marginTop: '4.5rem',
            padding: '2.5rem 1.5rem',
            width: '100%',
            maxWidth: '1050px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              TrustSphere End-to-End Relationship Chain
            </span>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-primary)', marginTop: '0.25rem' }}>
              Connected Security Node Topology
            </h3>
          </div>

          <svg viewBox="0 0 960 180" style={{ width: '100%', height: 'auto' }}>
            <defs>
              <linearGradient id="cyberLineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#00F0FF" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
              <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Connecting backbone line */}
            <line x1="80" y1="90" x2="880" y2="90" stroke="url(#cyberLineGrad)" strokeWidth="3" strokeDasharray="6 4" />

            {/* Node 1: Organization */}
            <g transform="translate(80, 90)">
              <circle r="36" fill="#0D1527" stroke="#00F0FF" strokeWidth="2" filter="url(#nodeGlow)" />
              <text y="4" fill="#00F0FF" fontSize="11" fontWeight="700" textAnchor="middle">Organization</text>
              <text y="54" fill="#94A3B8" fontSize="10" textAnchor="middle">Global Root</text>
            </g>

            {/* Node 2: Departments */}
            <g transform="translate(240, 90)">
              <circle r="36" fill="#0D1527" stroke="#3B82F6" strokeWidth="2" filter="url(#nodeGlow)" />
              <text y="4" fill="#60A5FA" fontSize="11" fontWeight="700" textAnchor="middle">Departments</text>
              <text y="54" fill="#94A3B8" fontSize="10" textAnchor="middle">Finance / IT / HR</text>
            </g>

            {/* Node 3: Employees */}
            <g transform="translate(400, 90)">
              <circle r="36" fill="#0D1527" stroke="#8B5CF6" strokeWidth="2" filter="url(#nodeGlow)" />
              <text y="4" fill="#A78BFA" fontSize="11" fontWeight="700" textAnchor="middle">Employees</text>
              <text y="54" fill="#94A3B8" fontSize="10" textAnchor="middle">Actors & Roles</text>
            </g>

            {/* Node 4: Assets */}
            <g transform="translate(560, 90)">
              <circle r="36" fill="#0D1527" stroke="#10B981" strokeWidth="2" filter="url(#nodeGlow)" />
              <text y="4" fill="#34D399" fontSize="11" fontWeight="700" textAnchor="middle">Assets</text>
              <text y="54" fill="#94A3B8" fontSize="10" textAnchor="middle">PDF / Invoices / Certs</text>
            </g>

            {/* Node 5: Trust */}
            <g transform="translate(720, 90)">
              <circle r="36" fill="#0D1527" stroke="#00F0FF" strokeWidth="2" filter="url(#nodeGlow)" />
              <text y="4" fill="#00F0FF" fontSize="11" fontWeight="700" textAnchor="middle">Trust Score</text>
              <text y="54" fill="#94A3B8" fontSize="10" textAnchor="middle">0 - 100 Index</text>
            </g>

            {/* Node 6: Incidents */}
            <g transform="translate(880, 90)">
              <circle r="36" fill="#0D1527" stroke="#EF4444" strokeWidth="2" filter="url(#nodeGlow)" />
              <text y="4" fill="#F87171" fontSize="11" fontWeight="700" textAnchor="middle">Incidents</text>
              <text y="54" fill="#94A3B8" fontSize="10" textAnchor="middle">Triage & Resolve</text>
            </g>
          </svg>
        </div>
      </section>

      {/* Features Grid */}
      <section style={{ padding: '4rem 2rem 6rem 2rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Comprehensive Architecture
          </span>
          <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            Engineered for High-Assurance Decision Security
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {features.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div 
                key={idx} 
                className="glass-panel glass-panel-hover"
                style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}
              >
                <div 
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '10px',
                    background: 'rgba(0, 240, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-cyan)'
                  }}
                >
                  <Icon size={24} />
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {feat.title}
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {feat.desc}
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
          padding: '2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem'
        }}
      >
        <p>TrustSphere — Enterprise Decision Trust Intelligence Platform • College Demonstration Edition</p>
      </footer>
    </div>
  );
}
