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
            id: userData.id || 'ORG-ENTERPRISE',
            name: 'TrustSphere Enterprise',
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

  // Real backend user/organization registration: POST /api/auth/register
  const registerOrganization = async (regData) => {
    try {
      const payload = {
        name: regData.adminName || regData.name,
        email: regData.adminEmail || regData.email,
        password: regData.password,
        role: "Security Administrator"
      };

      const res = await authApi.register(payload);
      if (res?.success) {
        return { success: true, data: res.data };
      }
      return { success: false, message: res?.message || 'Registration failed.' };
    } catch (err) {
      return { success: false, message: err.message || 'Registration failed.' };
    }
  };

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
          id: userData.id || 'ORG-ENTERPRISE',
          name: 'TrustSphere Enterprise',
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

  const isAdmin = Boolean(
    user && ['ADMIN', 'SECURITY ADMINISTRATOR', 'SUPER_ADMIN'].includes((user.role || '').toUpperCase().trim())
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        loading,
        isAuthenticated: !!user,
        isAdmin,
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
