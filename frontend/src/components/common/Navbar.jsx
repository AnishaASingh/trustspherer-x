import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { 
  Bell, 
  Search, 
  Shield, 
  Check, 
  ExternalLink, 
  Menu, 
  User, 
  ChevronDown, 
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSecurity } from '../../context/SecurityContext';

export default function Navbar({ onToggleSidebar }) {
  const { user, organization } = useAuth();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useSecurity();
  const location = useLocation();
  const navigate = useNavigate();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const notifRef = useRef(null);
  const profileRef = useRef(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Derive route title
  const getPageTitle = (pathname) => {
    if (pathname.startsWith('/assets/')) return 'Asset Telemetry & Trust Factors';
    if (pathname.startsWith('/incidents/')) return 'Incident Details & Triage';
    if (pathname.startsWith('/employees/')) return 'Employee Security Profile';
    if (pathname.startsWith('/departments/')) return 'Department Trust Governance';

    switch (pathname) {
      case '/dashboard': return 'Security Intelligence Dashboard';
      case '/assets': return 'Digital Assets Registry';
      case '/upload': return 'Asset Ingestion & Scanning';
      case '/trust-analysis': return 'Trust Analysis Engine';
      case '/incidents': return 'Security Incidents';
      case '/employees': return 'Employee Directory';
      case '/departments': return 'Organizational Hierarchy';
      case '/digital-twin': return 'Digital Twin Relationship Topology';
      case '/audit-logs': return 'Tamper-Evident Audit Trail';
      case '/reports': return 'Trust & Risk Reports';
      case '/settings': return 'Platform Settings';
      default: return 'TrustSphere';
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/assets?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header 
      style={{
        height: 'var(--navbar-height)',
        backgroundColor: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 90
      }}
    >
      {/* Left Title & Mobile Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onToggleSidebar}
          className="btn-ghost"
          style={{
            padding: '0.4rem',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-secondary)'
          }}
          title="Toggle navigation"
        >
          <Menu size={20} />
        </button>

        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {getPageTitle(location.pathname)}
          </h2>
        </div>
      </div>

      {/* Middle Global Search */}
      <form 
        onSubmit={handleSearchSubmit}
        style={{
          position: 'relative',
          width: '320px',
          display: 'none', // Shown on desktop
        }}
        className="nav-search-container"
      >
        <Search 
          size={15} 
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} 
        />
        <input 
          type="text" 
          placeholder="Search assets, incidents, hashes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field"
          style={{
            paddingLeft: '34px',
            paddingRight: '12px',
            paddingTop: '0.45rem',
            paddingBottom: '0.45rem',
            fontSize: '0.8rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-subtle)'
          }}
        />
      </form>

      {/* Right Controls: Org, Notifications, User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        {/* Org Badge */}
        <div 
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.75rem',
            background: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            color: 'var(--accent-cyan)'
          }}
        >
          <Shield size={13} />
          <span style={{ fontWeight: 600, maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {organization?.name || "TrustSphere Corp"}
          </span>
        </div>

        {/* Notifications Popover */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="btn-ghost"
            style={{
              position: 'relative',
              padding: '0.5rem',
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: notifOpen ? 'var(--accent-cyan)' : 'var(--text-secondary)'
            }}
            title="Notifications"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span 
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#EF4444',
                  color: '#FFF',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 8px #EF4444'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {notifOpen && (
            <div 
              className="glass-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '380px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                boxShadow: '0 15px 35px rgba(0,0,0,0.6), 0 0 20px rgba(0, 240, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                zIndex: 200,
                animation: 'fadeInScale 0.15s ease-out'
              }}
            >
              <div 
                style={{
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Security Alerts
                  </span>
                  {unreadCount > 0 && (
                    <span className="font-mono badge badge-critical" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                      {unreadCount} UNREAD
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button 
                    onClick={markAllNotificationsRead}
                    className="btn-ghost"
                    style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', border: 'none', cursor: 'pointer', padding: '2px' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No security notifications.
                  </div>
                ) : (
                  notifications.map((n) => {
                    let Icon = Info;
                    let iconColor = 'var(--accent-cyan)';
                    if (n.type === 'critical') { Icon = AlertCircle; iconColor = 'var(--trust-0)'; }
                    else if (n.type === 'high') { Icon = AlertTriangle; iconColor = 'var(--trust-40)'; }
                    else if (n.type === 'success') { Icon = CheckCircle2; iconColor = 'var(--trust-75)'; }

                    return (
                      <div 
                        key={n.id}
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.link) {
                            navigate(n.link);
                            setNotifOpen(false);
                          }
                        }}
                        style={{
                          padding: '0.85rem 1rem',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          backgroundColor: n.read ? 'transparent' : 'rgba(0, 240, 255, 0.04)',
                          cursor: 'pointer',
                          display: 'flex',
                          gap: '0.75rem',
                          alignItems: 'flex-start',
                          transition: 'background var(--transition-fast)'
                        }}
                      >
                        <div style={{ marginTop: '2px', flexShrink: 0 }}>
                          <Icon size={16} color={iconColor} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h6 style={{ fontSize: '0.825rem', fontWeight: 600, color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                              {n.title}
                            </h6>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{n.time}</span>
                          </div>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                            {n.message}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div style={{ position: 'relative' }} ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="btn-ghost"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.35rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <div 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00F0FF, #3B82F6)',
                color: '#040812',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'AS'}
            </div>

            <div style={{ textAlign: 'left', display: 'none' }} className="nav-profile-text">
              <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {user?.name || "Admin"}
              </div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                {user?.role || "Security Lead"}
              </div>
            </div>

            <ChevronDown size={14} color="var(--text-muted)" />
          </button>

          {profileOpen && (
            <div 
              className="glass-panel"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '220px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                zIndex: 200
              }}
            >
              <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name || "Anisha Sharma"}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email || "admin@trustsphere.corp"}</div>
              </div>

              <div style={{ padding: '0.4rem' }}>
                <Link
                  to="/settings"
                  onClick={() => setProfileOpen(false)}
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)'
                  }}
                  className="btn-ghost"
                >
                  Profile & Settings
                </Link>
                <Link
                  to="/audit-logs"
                  onClick={() => setProfileOpen(false)}
                  style={{
                    display: 'block',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    textDecoration: 'none',
                    borderRadius: 'var(--radius-sm)'
                  }}
                  className="btn-ghost"
                >
                  My Audit History
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
