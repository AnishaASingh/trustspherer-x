import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import SkeletonLoader from '../common/SkeletonLoader';

export default function ProtectedRoute({ children, adminOnly = false, allowedRoles = null }) {
  const { user, isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-app)' }}>
        <SkeletonLoader rows={3} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const userRoleUpper = (user?.role || '').toUpperCase().trim();
    const hasAllowedRole =
      (allowedRoles.includes('ADMIN') && isAdmin) ||
      allowedRoles.map((r) => r.toUpperCase()).includes(userRoleUpper);
    if (!hasAllowedRole) {
      return <Navigate to="/dashboard" replace />;
    }
  } else if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
