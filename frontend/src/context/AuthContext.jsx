import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, getToken, removeToken } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore authenticated session on application startup
  useEffect(() => {
    async function restoreSession() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await authApi.getCurrentUser();
        if (res?.success && res?.data) {
          const userData = res.data;
          setUser(userData);
          setOrganization({
            id: userData.organization_id || userData.id || 'ORG-TS-01',
            name: userData.organization_name || 'TrustSphere Enterprise',
            email: userData.email,
            role: userData.role
          });
        } else {
          removeToken();
          setUser(null);
          setOrganization(null);
        }
      } catch (error) {
        console.warn('[TrustSphere Auth] Session validation error:', error.message);
        removeToken();
        setUser(null);
        setOrganization(null);
      } finally {
        setLoading(false);
      }
    }

    restoreSession();

    // Listen for unauthorized broadcast events from API client
    const handleUnauthorized = () => {
      setUser(null);
      setOrganization(null);
    };

    window.addEventListener('trustsphere:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('trustsphere:unauthorized', handleUnauthorized);
  }, []);

  // One-time initial organization setup: POST /api/auth/setup
  const completeOrganizationSetup = async (setupData) => {
    try {
      const payload = {
        organization_name: (setupData.organizationName || setupData.organization_name || '').trim(),
        organization_id: (setupData.organizationId || setupData.organization_id || '').trim().toUpperCase(),
        admin_name: (setupData.adminName || setupData.admin_name || setupData.name || '').trim(),
        admin_email: (setupData.adminEmail || setupData.admin_email || setupData.email || '').trim().toLowerCase(),
        password: setupData.password
      };

      const res = await authApi.completeSetup(payload);
      if (res?.success) {
        return { success: true, data: res.data, message: res.message };
      }
      return { success: false, message: res?.message || 'Organization setup failed.' };
    } catch (err) {
      return { success: false, message: err.message || 'Organization setup failed.' };
    }
  };

  // Backwards-compatible alias for setup page
  const registerOrganization = completeOrganizationSetup;

  // Real backend login: POST /api/auth/login
  const login = async (email, password) => {
    try {
      const res = await authApi.login({
        email: email.trim(),
        password
      });

      if (res?.success && res?.data) {
        const userData = res.data.user;
        setUser(userData);
        setOrganization({
          id: userData.organization_id || userData.id || 'ORG-TS-01',
          name: userData.organization_name || 'TrustSphere Enterprise',
          email: userData.email,
          role: userData.role
        });
        return { success: true, user: userData };
      }
      return { success: false, message: res?.message || 'Invalid credentials.' };
    } catch (err) {
      return { success: false, message: err.message || 'Authentication failed.' };
    }
  };

  // Real logout
  const logout = () => {
    authApi.logout();
    setUser(null);
    setOrganization(null);
  };

  const normalizedRole = (user?.role || '').toUpperCase().trim();
  const isAdmin = Boolean(
    user && ['ADMIN', 'SECURITY ADMINISTRATOR', 'SUPER_ADMIN'].includes(normalizedRole)
  );
  const isManager = Boolean(
    user && ['MANAGER', 'DEPARTMENT LEAD', 'AUTHORIZED USER'].includes(normalizedRole)
  );
  const isAuditor = Boolean(
    user && ['AUDITOR', 'COMPLIANCE AUDITOR'].includes(normalizedRole)
  );
  const isEmployee = Boolean(user && !isAdmin && !isManager && !isAuditor);

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        loading,
        isAuthenticated: !!user,
        isAdmin,
        isManager,
        isAuditor,
        isEmployee,
        completeOrganizationSetup,
        registerOrganization,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
