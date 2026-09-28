import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  User, 
  Building2, 
  Lock, 
  Palette, 
  ShieldCheck, 
  Save, 
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Storage } from '../utils/storage';

export default function Settings() {
  const { user, organization } = useAuth();
  const { addToast } = useToast();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('profile');

  // Profile Form
  const [profileName, setProfileName] = useState(user?.name || "Anisha Sharma");
  const [profileEmail, setProfileEmail] = useState(user?.email || "admin@trustsphere.corp");
  const [profileRole, setProfileRole] = useState(user?.role || "Chief Trust Officer & Security Admin");

  // Organization Form
  const [orgName, setOrgName] = useState(organization?.name || "TrustSphere Global Corp");
  const [orgIndustry, setOrgIndustry] = useState(organization?.industry || "Cybersecurity & Financial Intelligence");

  // Security Settings
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [sessionTimeout, setSessionTimeout] = useState('60');

  // Appearance
  const [compactMode, setCompactMode] = useState(() => Boolean(Storage.getSettings()?.compactMode));
  const [glowIntensity, setGlowIntensity] = useState(() => Storage.getSettings()?.glowIntensity || 'normal');

  const handleSaveProfile = (e) => {
    e.preventDefault();
    addToast("Profile information updated successfully.", "success");
  };

  const handleSaveOrg = (e) => {
    e.preventDefault();
    addToast("Organization parameters updated.", "success");
  };

  const handleUpdatePassword = (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      addToast("New password must be at least 6 characters.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast("Passwords do not match.", "error");
      return;
    }
    addToast("Security credentials updated successfully.", "success");
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSaveAppearance = (e) => {
    e.preventDefault();
    Storage.setSettings({ theme, compactMode, glowIntensity });
    addToast(`Appearance preferences saved (${theme === 'light' ? 'Light' : 'Dark'} mode active).`, "success");
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          Platform Settings
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Configure tenant governance, operator credentials, security policies, and interface appearance.
        </p>
      </div>

      {/* Tabs */}
      <div 
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '2rem',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'profile', label: 'Operator Profile', icon: User },
          { id: 'org', label: 'Organization Details', icon: Building2 },
          { id: 'security', label: 'Security & Access', icon: Lock },
          { id: 'appearance', label: 'Theme & Appearance', icon: Palette },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.25rem',
                borderRadius: '0',
                borderBottom: isActive ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.875rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '650px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
            Operator Profile Information
          </h3>

          <form onSubmit={handleSaveProfile}>
            <div className="input-group">
              <label className="input-label">Full Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Corporate Email</label>
              <input 
                type="email" 
                className="input-field" 
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Security Role Title</label>
              <input 
                type="text" 
                className="input-field" 
                value={profileRole}
                onChange={(e) => setProfileRole(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              <Save size={16} />
              <span>Save Profile</span>
            </button>
          </form>
        </div>
      )}

      {/* Organization Tab */}
      {activeTab === 'org' && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '650px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
            Organization Enterprise Configuration
          </h3>

          <form onSubmit={handleSaveOrg}>
            <div className="input-group">
              <label className="input-label">Organization Name</label>
              <input 
                type="text" 
                className="input-field" 
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Industry Classification</label>
              <input 
                type="text" 
                className="input-field" 
                value={orgIndustry}
                onChange={(e) => setOrgIndustry(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <label className="input-label">Security Standards Enforced</label>
              <input 
                type="text" 
                className="input-field" 
                value="SOC 2 Type II, ISO 27001, NIST 800-53"
                disabled
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              <Save size={16} />
              <span>Update Organization</span>
            </button>
          </form>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '650px' }}>
          {/* Password Change */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Change Authentication Password
            </h3>

            <form onSubmit={handleUpdatePassword}>
              <div className="input-group">
                <label className="input-label">Current Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">New Password (min 6 characters)</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label className="input-label">Confirm New Password</label>
                <input 
                  type="password" 
                  className="input-field" 
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary">
                <Lock size={16} />
                <span>Update Password</span>
              </button>
            </form>
          </div>

          {/* Session Settings */}
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Session & Access Control Policies
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Hardware Token / MFA</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Require FIDO2 or TOTP second factor upon login</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={mfaEnabled} 
                  onChange={(e) => setMfaEnabled(e.target.checked)} 
                  style={{ accentColor: 'var(--accent-cyan)', width: '18px', height: '18px' }}
                />
              </div>

              <div className="input-group" style={{ marginBottom: 0 }}>
                <label className="input-label">Inactive Session Timeout</label>
                <select 
                  className="input-field"
                  value={sessionTimeout}
                  onChange={(e) => setSessionTimeout(e.target.value)}
                >
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">60 Minutes (Standard)</option>
                  <option value="120">2 Hours</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appearance Tab */}
      {activeTab === 'appearance' && (
        <div className="glass-panel" style={{ padding: '2rem', maxWidth: '650px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
            Visual Interface & Dashboard Theme
          </h3>

          <form onSubmit={handleSaveAppearance}>
            <div className="input-group">
              <label className="input-label">Theme</label>
              <select 
                className="input-field"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="dark">Dark (Default TrustSphere Cybersecurity Theme)</option>
                <option value="light">Light (Clean High-Contrast Light Theme)</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Border Glow Intensity</label>
              <select 
                className="input-field"
                value={glowIntensity}
                onChange={(e) => setGlowIntensity(e.target.value)}
              >
                <option value="low">Subtle</option>
                <option value="normal">Normal Cyber Glow</option>
                <option value="high">High Intensity</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Compact Data Grid Mode</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Condense row padding on high-resolution monitor screens</div>
              </div>
              <input 
                type="checkbox" 
                checked={compactMode} 
                onChange={(e) => setCompactMode(e.target.checked)} 
                style={{ accentColor: 'var(--accent-cyan)', width: '18px', height: '18px' }}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              <Save size={16} />
              <span>Save Display Preferences</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
