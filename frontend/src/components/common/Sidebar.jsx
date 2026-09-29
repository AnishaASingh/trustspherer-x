import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Layers, 
  FileSearch, 
  AlertTriangle, 
  Users, 
  Building2, 
  Share2, 
  History, 
  BarChart3, 
  Settings, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Mail
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSecurity } from '../../context/SecurityContext';

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, isAdmin, isManager, isAuditor, logout } = useAuth();
  const { metrics } = useSecurity();
  const navigate = useNavigate();
  const location = useLocation();

  const [openGroups, setOpenGroups] = useState({
    digitalTrust: true,
    monitoring: true,
    organization: true,
    governance: true
  });

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navGroups = [
    {
      key: 'digitalTrust',
      title: 'Digital Trust',
      items: [
        { label: 'Digital Assets', path: '/assets', icon: Layers, badge: metrics.totalAssets },
        { label: 'Trust Analysis', path: '/trust-analysis', icon: FileSearch },
        ...(isAdmin ? [{ label: 'Digital Twin', path: '/digital-twin', icon: Share2 }] : [])
      ]
    },
    {
      key: 'monitoring',
      title: 'Monitoring',
      items: [
        {
          label: 'Incidents',
          path: '/incidents',
          icon: AlertTriangle,
          badge: metrics.openIncidents,
          badgeCritical: metrics.openIncidents > 0
        },
        ...(isAdmin ? [{ label: 'Email Verification', path: '/email-integration', icon: Mail }] : [])
      ]
    },
    ...(isAdmin
      ? [
          {
            key: 'organization',
            title: 'Organization',
            items: [
              { label: 'Employees', path: '/employees', icon: Users },
              { label: 'Departments', path: '/departments', icon: Building2 }
            ]
          }
        ]
      : []),
    ...(isAdmin || isAuditor
      ? [
          {
            key: 'governance',
            title: 'Governance',
            items: [
              { label: 'Audit Logs', path: '/audit-logs', icon: History },
              { label: 'Trust & Risk Reports', path: '/reports', icon: BarChart3 }
            ]
          }
        ]
      : [])
  ];

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isRouteActive =
      location.pathname === item.path ||
      (item.path !== '/dashboard' && location.pathname.startsWith(`${item.path}/`));

    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={collapsed ? item.label : undefined}
        style={() => ({
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: collapsed ? '0.7rem 0' : '0.58rem 0.85rem',
          justifyContent: collapsed ? 'center' : 'flex-start',
          borderRadius: 'var(--radius-sm)',
          textDecoration: 'none',
          fontSize: '0.84rem',
          fontWeight: isRouteActive ? 600 : 450,
          color: isRouteActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
          backgroundColor: isRouteActive ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
          borderLeft: isRouteActive ? '3px solid var(--accent-cyan)' : '3px solid transparent',
          transition: 'all var(--transition-fast)'
        })}
      >
        <Icon size={18} style={{ flexShrink: 0 }} />

        {!collapsed && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
            <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {item.label}
            </span>
            {item.badge !== undefined && item.badge !== null && (
              <span
                className="font-mono"
                style={{
                  fontSize: '0.68rem',
                  padding: '0.08rem 0.42rem',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: item.badgeCritical ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                  color: item.badgeCritical ? '#EF4444' : 'var(--text-muted)',
                  border: item.badgeCritical ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid transparent'
                }}
              >
                {item.badge}
              </span>
            )}
          </div>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      style={{
        width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        backgroundColor: 'var(--bg-primary)',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width var(--transition-normal)',
        zIndex: 100,
        userSelect: 'none'
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          padding: collapsed ? '1.15rem 0.75rem' : '1.15rem 1.2rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          position: 'relative'
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(59, 130, 246, 0.2))',
            border: '1px solid var(--border-glow)',
            boxShadow: '0 0 15px rgba(0, 240, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            flexShrink: 0
          }}
        >
          <ShieldCheck size={20} />
        </div>

        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <h1 style={{ fontSize: '1.02rem', fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
              Trust<span style={{ color: 'var(--accent-cyan)' }}>Sphere</span>
            </h1>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              {isAdmin ? 'Admin Console' : isManager ? 'Manager Workspace' : isAuditor ? 'Auditor Console' : 'Employee Workspace'}
            </p>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost"
          style={{
            position: 'absolute',
            right: collapsed ? '-12px' : '10px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-medium)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--accent-cyan)',
            padding: 0,
            zIndex: 10
          }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation Sections */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.75rem 0.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem'
        }}
      >
        {/* Top-level Dashboard */}
        <div>
          {renderNavItem({ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard })}
        </div>

        {/* Logical Collapsible Groups */}
        {navGroups.map((group) => {
          const isOpen = openGroups[group.key] !== false;
          return (
            <div key={group.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
              {!collapsed && (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.35rem 0.65rem',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.07em',
                    textAlign: 'left'
                  }}
                >
                  <span>{group.title}</span>
                  <ChevronDown
                    size={13}
                    style={{
                      transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                      transition: 'transform 0.15s ease'
                    }}
                  />
                </button>
              )}

              {(collapsed || isOpen) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  {group.items.map((item) => renderNavItem(item))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Footer Section */}
      <div
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '0.65rem 0.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem'
        }}
      >
        {renderNavItem({ label: 'Settings', path: '/settings', icon: Settings })}

        <button
          onClick={handleLogout}
          className="btn-ghost"
          title={collapsed ? 'Logout' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: collapsed ? '0.7rem 0' : '0.58rem 0.85rem',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.84rem',
            color: '#F87171',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left'
          }}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
