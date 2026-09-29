import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { SecurityProvider } from './context/SecurityContext';

import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Pages
import Landing from './pages/Landing';
import Register from './pages/Register';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import AssetDetails from './pages/AssetDetails';
import UploadAsset from './pages/UploadAsset';
import TrustAnalysis from './pages/TrustAnalysis';
import Incidents from './pages/Incidents';
import IncidentDetails from './pages/IncidentDetails';
import Employees from './pages/Employees';
import EmployeeDetails from './pages/EmployeeDetails';
import Departments from './pages/Departments';
import DepartmentDetails from './pages/DepartmentDetails';
import DigitalTwin from './pages/DigitalTwin';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';
import EmailIntegration from './pages/EmailIntegration';
import AIAssistant from './pages/AIAssistant';


export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <SecurityProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/setup" element={<Register />} />
              <Route path="/register" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<Login />} />

              {/* Protected Application Routes */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/assets/:id" element={<AssetDetails />} />
                <Route path="/upload" element={<UploadAsset />} />
                <Route path="/trust-analysis" element={<TrustAnalysis />} />
                <Route path="/incidents" element={<Incidents />} />
                <Route path="/incidents/:id" element={<IncidentDetails />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/ai-assistant" element={<AIAssistant />} />

                {/* Admin & Auditor Routes */}
                <Route path="/email-integration" element={<ProtectedRoute adminOnly><EmailIntegration /></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute adminOnly><Employees /></ProtectedRoute>} />
                <Route path="/employees/:id" element={<ProtectedRoute adminOnly><EmployeeDetails /></ProtectedRoute>} />
                <Route path="/departments" element={<ProtectedRoute adminOnly><Departments /></ProtectedRoute>} />
                <Route path="/departments/:id" element={<ProtectedRoute adminOnly><DepartmentDetails /></ProtectedRoute>} />
                <Route path="/digital-twin" element={<ProtectedRoute adminOnly><DigitalTwin /></ProtectedRoute>} />
                <Route path="/audit-logs" element={<ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']}><AuditLogs /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute allowedRoles={['ADMIN', 'AUDITOR']}><Reports /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute adminOnly><UserManagement /></ProtectedRoute>} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </SecurityProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
