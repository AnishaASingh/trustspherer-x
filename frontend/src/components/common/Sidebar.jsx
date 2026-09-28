import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Layers, 
  UploadCloud, 
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
  Shield,
  UserCheck,
  Mail,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSecurity } from '../../context/SecurityContext';

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user, organization, logout } = useAuth();
  const { metrics, incidents } = useSecurity();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN';

  const navItems = [
    { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { label: "Digital Assets", path: "/assets", icon: Layers, badge: metrics.totalAssets },
    { label: "Upload Asset", path: "/upload", icon: UploadCloud, highlight: true },
    { label: "Email Integration", path: "/email-integration", icon: Mail },
    { label: "AI Assistant", path: "/ai-assistant", icon: Sparkles },
    { label: "Trust Analysis", path: "/trust-analysis", icon: FileSearch },
    { 
      label: "Incidents", 
      path: "/incidents", 
      icon: AlertTriangle, 
      badge: metrics.openIncidents, 
      badgeCritical: metrics.openIncidents > 0 
    },
    { label: "Employees", path: "/employees", icon: Users },
    { label: "Departments", path: "/departments", icon: Building2 },
    { label: "Digital Twin", path: "/digital-twin", icon: Share2 },
    { label: "Audit Logs", path: "/audit-logs", icon: History },
    { label: "Reports", path: "/reports", icon: BarChart3 },
    ...(isAdmin ? [{ label: "User Management", path: "/users", icon: UserCheck }] : []),
  ];


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
          padding: collapsed ? '1.2rem 0.75rem' : '1.25rem 1.25rem',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          position: 'relative'
        }}
      >
        <div 
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(0, 240, 255, 0.2), rgba(59, 130, 246, 0.2))',
            border: '1px solid var(--border-glow)',
            boxShadow: '0 0 15px rgba(0, 240, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            flexShrink: 0
          }}
        >
          <ShieldCheck size={22} />
        </div>

        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 800, letterSpacing: '-0.01em', color: '#FFF' }}>
              Trust<span style={{ color: 'var(--accent-cyan)' }}>Sphere</span>
            </h1>
            <p style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
              Decision Trust Intel
            </p>
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="btn-ghost"
          style={{
            position: 'absolute',
            right: collapsed ? '-14px' : '10px',
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
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Navigation list */}
      <div 
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.85rem 0.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.8rem',
                padding: collapsed ? '0.75rem 0' : '0.65rem 0.85rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 'var(--radius-sm)',
                textDecoration: 'none',
                fontSize: '0.85rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--accent-cyan)' : '3px solid transparent',
                transition: 'all var(--transition-fast)'
              })}
            >
              <Icon size={19} style={{ flexShrink: 0 }} />
              
              {!collapsed && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', overflow: 'hidden' }}>
                  <span style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {item.label}
                  </span>
                  {item.badge !== undefined && item.badge !== null && (
                    <span 
                      className="font-mono"
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.45rem',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: item.badgeCritical ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                        color: item.badgeCritical ? '#EF4444' : 'var(--text-muted)',
                        border: item.badgeCritical ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid transparent'
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Bottom Footer Section */}
      <div 
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '0.75rem 0.6rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}
      >
        <NavLink
          to="/settings"
          title={collapsed ? "Settings" : undefined}
          style={({ isActive }) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            padding: collapsed ? '0.75rem 0' : '0.65rem 0.85rem',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 'var(--radius-sm)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            backgroundColor: isActive ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
            transition: 'all var(--transition-fast)'
          })}
        >
          <Settings size={18} style={{ flexShrink: 0 }} />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        <button
          onClick={handleLogout}
          className="btn-ghost"
          title={collapsed ? "Logout" : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.8rem',
            padding: collapsed ? '0.75rem 0' : '0.65rem 0.85rem',
            justifyContent: collapsed ? 'center' : 'flex-start',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.85rem',
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
