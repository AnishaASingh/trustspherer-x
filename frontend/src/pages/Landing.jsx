import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  ArrowRight,
  Layers,
  Mail,
  AlertTriangle,
  History,
  Sun,
  Moon,
  Link2,
  FileCheck,
  BarChart3,
  CheckCircle2,
  Building2,
  UserCheck,
  Users,
  Lock
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Landing() {
  const { theme, toggleTheme } = useTheme();

  const howItWorksSteps = [
    {
      step: '01',
      title: 'Connect',
      icon: Link2,
      desc: 'Organization connects its trusted data sources and internal users.'
    },
    {
      step: '02',
      title: 'Verify',
      icon: FileCheck,
      desc: 'Digital assets, documents and incoming emails are analyzed.'
    },
    {
      step: '03',
      title: 'Assess',
      icon: BarChart3,
      desc: 'Trust and risk indicators are generated from the verification results.'
    },
    {
      step: '04',
      title: 'Decide',
      icon: CheckCircle2,
      desc: 'Authorized users review findings, incidents, audit history and recommendations.'
    }
  ];

  const protectionItems = [
    {
      title: 'Digital Assets',
      icon: Layers,
      desc: 'Verify documents, certificates, reports and other organizational files.'
    },
    {
      title: 'Email Intelligence',
      icon: Mail,
      desc: 'Monitor authorized organizational mailboxes and verify incoming email evidence.'
    },
    {
      title: 'Risk & Incidents',
      icon: AlertTriangle,
      desc: 'Identify suspicious assets and track security incidents.'
    },
    {
      title: 'Audit & Governance',
      icon: History,
      desc: 'Maintain traceable records of important organizational actions.'
    }
  ];

  const roleCards = [
    {
      role: 'ADMIN',
      badge: 'Full Governance',
      icon: ShieldCheck,
      items: [
        'Manage organization',
        'Manage employees',
        'Configure integrations',
        'Review all trust and risk information',
        'View audit logs'
      ]
    },
    {
      role: 'MANAGER / AUTHORIZED USER',
      badge: 'Department Oversight',
      icon: UserCheck,
      items: [
        'Review assigned assets',
        'Monitor incidents',
        'View department-level information',
        'Review verification results'
      ]
    },
    {
      role: 'EMPLOYEE',
      badge: 'Scoped Access',
      icon: Users,
      items: [
        'Access only authorized information',
        'Submit/handle assigned assets',
        'View relevant verification results'
      ]
    }
  ];

  const systemFlowNodes = [
    'Organization',
    'TrustSphere',
    'Assets + Emails + Evidence',
    'Verification & Risk Analysis',
    'Trust Intelligence',
    'Authorized Decision Makers'
  ];

  return (
    <div className="cyber-grid-bg" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Minimal Enterprise Header */}
      <header
        style={{
          minHeight: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem clamp(1.25rem, 4vw, 3rem)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
          backdropFilter: 'blur(12px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          gap: '1rem',
          flexWrap: 'wrap'
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
              color: 'var(--accent-cyan)',
              flexShrink: 0
            }}
          >
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              Trust<span style={{ color: 'var(--accent-cyan)' }}>Sphere</span>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
              Enterprise Decision Trust Intelligence
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={toggleTheme}
            className="btn-ghost"
            style={{
              padding: '0.45rem 0.8rem',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-secondary)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              color: 'var(--text-primary)',
              fontSize: '0.76rem',
              fontWeight: 600
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={15} color="#F59E0B" /> : <Moon size={15} color="var(--accent-cyan)" />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          <Link to="/login" className="btn btn-primary" style={{ padding: '0.5rem 1.15rem' }}>
            <span>Sign In</span>
          </Link>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        {/* Hero Section */}
        <section
          className="radial-glow-top"
          style={{
            padding: 'clamp(3rem, 6vw, 5rem) clamp(1.25rem, 4vw, 2.5rem) clamp(2.5rem, 4vw, 3.5rem)',
            maxWidth: '1080px',
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
              padding: '0.32rem 0.9rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(0, 240, 255, 0.08)',
              border: '1px solid var(--border-glow)',
              color: 'var(--accent-cyan)',
              fontSize: '0.75rem',
              fontWeight: 600,
              marginBottom: '1.25rem',
              letterSpacing: '0.04em'
            }}
          >
            <Building2 size={14} />
            <span>ORGANIZATIONAL DIGITAL TRUST PLATFORM</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 4.5vw, 3.1rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              marginBottom: '1rem',
              maxWidth: '820px',
              letterSpacing: '-0.02em',
              color: 'var(--text-primary)'
            }}
          >
            Enterprise Decision Trust Intelligence
          </h1>

          <p
            style={{
              fontSize: 'clamp(0.98rem, 1.8vw, 1.12rem)',
              color: 'var(--text-secondary)',
              maxWidth: '680px',
              lineHeight: 1.6,
              marginBottom: '2rem'
            }}
          >
            Verify digital assets, incoming emails, and enterprise documents to detect tampering, identify risks, and maintain organizational trust.
          </p>

          <Link to="/login" className="btn btn-primary btn-lg" style={{ padding: '0.8rem 1.75rem', fontSize: '0.95rem' }}>
            <span>Sign In to TrustSphere →</span>
          </Link>
        </section>

        {/* Section 2: How TrustSphere Works */}
        <section
          style={{
            padding: '2rem clamp(1.25rem, 4vw, 2.5rem) 3rem',
            maxWidth: '1120px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Workflow
            </span>
            <h2 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.75rem)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.3rem' }}>
              How TrustSphere Works
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
              gap: '1.25rem'
            }}
          >
            {howItWorksSteps.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="glass-panel glass-panel-hover"
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--accent-cyan)',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(0, 240, 255, 0.08)',
                        border: '1px solid var(--border-subtle)'
                      }}
                    >
                      {item.step} — {item.title}
                    </span>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        background: 'rgba(0, 240, 255, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent-cyan)'
                      }}
                    >
                      <Icon size={18} />
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {item.title}
                  </h3>

                  <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 3: What TrustSphere Protects */}
        <section
          style={{
            padding: '2rem clamp(1.25rem, 4vw, 2.5rem) 3rem',
            maxWidth: '1120px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Protection Scope
            </span>
            <h2 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.75rem)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.3rem' }}>
              What TrustSphere Protects
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(235px, 1fr))',
              gap: '1.25rem'
            }}
          >
            {protectionItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="glass-panel glass-panel-hover"
                  style={{
                    padding: '1.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(0, 240, 255, 0.08)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--accent-cyan)'
                    }}
                  >
                    <Icon size={20} />
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    {item.title}
                  </h3>

                  <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 4: Built for Every Role */}
        <section
          style={{
            padding: '2rem clamp(1.25rem, 4vw, 2.5rem) 3rem',
            maxWidth: '1120px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Role-Based Access Control
            </span>
            <h2 style={{ fontSize: 'clamp(1.4rem, 2.5vw, 1.75rem)', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.3rem' }}>
              Built for Every Role
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', maxWidth: '640px', margin: '0.5rem auto 0' }}>
              TrustSphere is a managed organizational platform with no public sign-up. Users are created and assigned permissions by the organization&apos;s administrator.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem'
            }}
          >
            {roleCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.role}
                  className="glass-panel"
                  style={{
                    padding: '1.6rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '9px',
                          background: 'rgba(0, 240, 255, 0.08)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--accent-cyan)',
                          flexShrink: 0
                        }}
                      >
                        <Icon size={19} />
                      </div>
                      <h3 style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '0.02em' }}>
                        {card.role}
                      </h3>
                    </div>
                    <span
                      className="badge"
                      style={{
                        background: 'rgba(56, 189, 248, 0.08)',
                        color: 'var(--accent-cyan)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.68rem',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {card.badge}
                    </span>
                  </div>

                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '1.15rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      lineHeight: 1.5
                    }}
                  >
                    {card.items.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 5: Simple System Flow */}
        <section
          style={{
            padding: '1.5rem clamp(1.25rem, 4vw, 2.5rem) 3rem',
            maxWidth: '1120px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '1.75rem 1.5rem',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.35rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                End-to-End Trust Flow
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '0.6rem'
              }}
            >
              {systemFlowNodes.map((node, index) => (
                <React.Fragment key={node}>
                  <div
                    style={{
                      padding: '0.65rem 1rem',
                      borderRadius: 'var(--radius-sm)',
                      background: index === 1 ? 'rgba(0, 240, 255, 0.1)' : 'var(--bg-secondary)',
                      border: index === 1 ? '1px solid var(--border-glow)' : '1px solid var(--border-subtle)',
                      color: index === 1 ? 'var(--accent-cyan)' : 'var(--text-primary)',
                      fontSize: '0.82rem',
                      fontWeight: index === 1 ? 700 : 600,
                      textAlign: 'center'
                    }}
                  >
                    {node}
                  </div>
                  {index < systemFlowNodes.length - 1 && (
                    <ArrowRight size={15} color="var(--accent-cyan)" style={{ flexShrink: 0 }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </section>

        {/* Section 6: Single Final CTA */}
        <section
          style={{
            padding: '1rem clamp(1.25rem, 4vw, 2.5rem) 4rem',
            maxWidth: '760px',
            margin: '0 auto',
            width: '100%'
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '2.25rem 1.75rem',
              textAlign: 'center',
              border: '1px solid var(--border-glow)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.65rem'
            }}
          >
            <h2 style={{ fontSize: 'clamp(1.35rem, 2.5vw, 1.65rem)', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Ready to access TrustSphere?
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '0 0 0.75rem 0' }}>
              Sign in to your organization&apos;s TrustSphere environment.
            </p>
            <Link to="/login" className="btn btn-primary" style={{ padding: '0.7rem 1.6rem' }}>
              <span>Sign In →</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        style={{
          marginTop: 'auto',
          borderTop: '1px solid var(--border-subtle)',
          padding: '1.35rem 2rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.8rem'
        }}
      >
        TrustSphere — Enterprise Decision Trust Intelligence
      </footer>
    </div>
  );
}
