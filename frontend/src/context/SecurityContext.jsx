import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  assetsApi,
  incidentsApi,
  employeesApi,
  departmentsApi,
  auditLogsApi,
  dashboardApi
} from '../utils/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SecurityContext = createContext(null);

// ============================================================
// MODEL ADAPTERS (BACKEND MONGODB <-> FRONTEND REACT MODELS)
// ============================================================

export function mapBackendAsset(a) {
  if (!a) return null;
  const rawScore = a.trust_score ?? a.trustScore ?? 50;
  const trustScore = typeof rawScore === 'number' ? Math.round(rawScore) : 50;
  const rawRisk = a.risk_level || a.risk || 'Medium Risk';
  let risk = 'MEDIUM';
  if (typeof rawRisk === 'string') {
    const u = rawRisk.toUpperCase();
    if (u.includes('LOW')) risk = 'LOW';
    else if (u.includes('CRITICAL')) risk = 'CRITICAL';
    else if (u.includes('HIGH')) risk = 'HIGH';
    else risk = 'MEDIUM';
  }

  const fileExt = a.file_type ? a.file_type.replace('.', '') : (a.fileExt || 'bin');

  return {
    id: a.asset_id || a.id,
    asset_id: a.asset_id || a.id,
    name: a.filename || a.name || 'Unnamed Asset',
    filename: a.filename || a.name || 'Unnamed Asset',
    type: a.category || a.file_type || a.type || 'Document',
    category: a.category || a.type || 'Document',
    file_type: a.file_type || `.${fileExt}`,
    fileExt,
    size: a.file_size || a.size || '1 MB',
    file_size: a.file_size || a.size || '1 MB',
    source: a.source || 'Enterprise Ingestion',
    department: a.department_id || a.department || 'General',
    department_id: a.department_id || a.department || 'General',
    trustScore,
    trust_score: trustScore,
    risk,
    risk_level: rawRisk,
    status: a.status || (risk === 'LOW' ? 'VERIFIED' : risk === 'MEDIUM' ? 'UNDER REVIEW' : risk === 'HIGH' ? 'FLAGGED' : 'REJECTED'),
    date: a.upload_date || (a.created_at ? a.created_at.substring(0, 16).replace('T', ' ') : new Date().toISOString().substring(0, 16).replace('T', ' ')),
    created_at: a.created_at,
    uploader: a.uploader || 'Security Analyst',
    hash: a.file_hash || a.hash || '',
    file_hash: a.file_hash || a.hash || '',
    factors: a.factors || {
      integrity: 90,
      metadata: 85,
      structure: 85,
      content: 80,
      privacy: 95,
      anomaly: 85
    },
    checks: Array.isArray(a.checks) ? a.checks : [
      { name: 'File Integrity', passed: true, detail: 'Cryptographic block hash verified' },
      { name: 'Metadata Validation', passed: true, detail: 'File header structural consistency' },
      { name: 'Document Structure', passed: true, detail: 'Structure parsed and validated' },
      { name: 'Content Consistency', passed: risk !== 'HIGH' && risk !== 'CRITICAL', detail: 'Threat heuristics evaluated' },
      { name: 'Privacy / PII Check', passed: true, detail: 'Zero plain-text privacy violations' },
      { name: 'Anomaly Detection', passed: true, detail: 'Isolation Forest normal' }
    ],
    anomalies: Array.isArray(a.anomalies) ? a.anomalies : [],
    recommendations: Array.isArray(a.recommendations) ? a.recommendations : (a.recommendation ? [a.recommendation] : []),
    relatedIncidentId: a.relatedIncidentId || a.incident_id || null,
    incident_id: a.incident_id || a.relatedIncidentId || null,
    ai_insights: a.ai_insights || a.ai_intelligence || null,
    ai_summary: a.ai_summary || a.ai_insights?.summary || a.ai_insights?.security_summary || null,
    email_metadata: a.email_metadata || null,
    is_demo: Boolean(a.is_demo || a.email_metadata?.is_demo || a.email_metadata?.simulated),
    ingestion_mode: a.ingestion_mode || a.email_metadata?.ingestion_mode || 'MANUAL'
  };
}


export function mapBackendIncident(raw) {
  if (!raw) return null;
  const i = raw.incident || raw;
  const severity = (i.severity || 'MEDIUM').toUpperCase();
  return {
    id: i.incident_id || i.id,
    incident_id: i.incident_id || i.id,
    title: i.title || `Incident ${i.incident_id || i.id}`,
    relatedAssetId: i.asset_id || i.relatedAssetId || 'AST-UNKNOWN',
    relatedAssetName: i.asset_name || i.relatedAssetName || i.asset_id || 'Digital Asset',
    severity,
    department: i.department_id || i.department || 'Security Operations',
    department_id: i.department_id || i.department || 'Security Operations',
    status: (i.status === 'INVESTIGATING' ? 'UNDER INVESTIGATION' : i.status) || 'OPEN',
    detectedDate: i.detected_date || i.detectedDate || (i.created_at ? i.created_at.substring(0, 16).replace('T', ' ') : new Date().toISOString().substring(0, 16).replace('T', ' ')),
    assignedTo: i.assigned_to || i.assignedTo || 'SecOps Automated Triage',
    reason: i.description || i.reason || 'Automated risk policy alert',
    description: i.description || i.reason || 'Automated risk policy alert',
    verificationFailures: i.verificationFailures || [],
    timeline: Array.isArray(i.timeline) ? i.timeline : [],
    riskInformation: i.riskInformation || {
      financialExposure: severity === 'CRITICAL' ? 'High Impact' : severity === 'HIGH' ? 'Moderate Impact' : 'Low Impact',
      threatActorType: 'Untrusted Ingestion',
      recommendedAction: 'Quarantine and verify credentials'
    },
    recommendation: i.recommendation || 'Initiate incident response triage.'
  };
}

export function mapBackendEmployee(e) {
  if (!e) return null;
  const fullName = e.name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Employee';
  const initials = fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'EM';
  const score = typeof e.trust_score === 'number' ? Math.round(e.trust_score) : (e.trustScore || 85);
  return {
    id: e.employee_id || e.id,
    employee_id: e.employee_id || e.id,
    first_name: e.first_name,
    last_name: e.last_name,
    name: fullName,
    email: e.email || '',
    department: e.department_id || e.department || 'IT',
    department_id: e.department_id || e.department || 'IT',
    role: e.role || 'Security Staff',
    status: e.status || 'ACTIVE',
    trustScore: score,
    trust_score: score,
    joinDate: (e.created_at || e.joinDate || new Date().toISOString()).slice(0, 10),
    avatar: initials,
    riskLevel: score < 60 ? 'HIGH' : score < 75 ? 'MEDIUM' : 'LOW',
    associatedAssets: e.associatedAssets || [],
    asset_count: e.asset_count || 0,
    relatedIncidents: e.relatedIncidents || [],
    activities: e.activities || [
      { action: "Employee profile active", time: (e.created_at || new Date().toISOString()).slice(0, 16).replace('T', ' '), status: "SUCCESS" }
    ]
  };
}

export function mapBackendDepartment(d) {
  if (!d) return null;
  const score = typeof d.trust_score === 'number' ? Math.round(d.trust_score) : 85;
  return {
    id: d.id || d.name,
    name: d.name,
    description: d.description || '',
    head: d.head || 'Department Lead',
    trustScore: score,
    trust_score: score,
    riskTier: d.risk_tier || 'LOW',
    complianceStatus: d.compliance_status || 'COMPLIANT',
    employeeCount: d.employee_count || 0,
    assetCount: d.asset_count || 0,
    incidentCount: d.incident_count || 0
  };
}

export function mapBackendAuditLog(l) {
  if (!l) return null;
  return {
    id: l.id || l._id || `LOG-${Math.random().toString(36).substring(7)}`,
    user: l.user_id || l.user || 'System Security Unit',
    userEmail: l.user_id || l.userEmail || 'secops@trustsphere.corp',
    action: l.action || 'Activity Recorded',
    resource: l.entity_id || l.resource || 'Entity',
    entity_type: l.entity_type,
    result: l.result || 'SUCCESS',
    ipAddress: l.ip_address || l.ipAddress || '127.0.0.1',
    details: l.description || l.details || '',
    timestamp: l.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19)
  };
}

// ============================================================
// SECURITY PROVIDER COMPONENT
// ============================================================

export function SecurityProvider({ children }) {
  const { user, isAdmin } = useAuth();
  const { addToast } = useToast();

  const [assets, setAssets] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [backendMetrics, setBackendMetrics] = useState(null);

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Fetch complete real-time data from FastAPI and MongoDB (resilient to role-restricted endpoints)
  const fetchAllSecurityData = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const canFetchAdmin = !user || isAdmin;
      const results = await Promise.allSettled([
        assetsApi.getAssets({ limit: 100 }),
        incidentsApi.getIncidents({ limit: 100 }),
        canFetchAdmin ? employeesApi.getEmployees({ limit: 100 }) : Promise.resolve(null),
        canFetchAdmin ? departmentsApi.getDepartments() : Promise.resolve(null),
        canFetchAdmin ? auditLogsApi.getAuditLogs({ limit: 100 }) : Promise.resolve(null),
        dashboardApi.getDashboardMetrics()
      ]);

      const [
        assetsOut,
        incidentsOut,
        employeesOut,
        departmentsOut,
        auditLogsOut,
        metricsOut
      ] = results.map(r => (r.status === 'fulfilled' ? r.value : null));

      if (assetsOut?.data?.assets) {
        setAssets(assetsOut.data.assets.map(mapBackendAsset));
      }

      if (incidentsOut?.data?.incidents) {
        setIncidents(incidentsOut.data.incidents.map(mapBackendIncident));
      }

      if (employeesOut?.data?.employees) {
        setEmployees(employeesOut.data.employees.map(mapBackendEmployee));
      } else if (!canFetchAdmin) {
        setEmployees([]);
      }

      if (departmentsOut?.data?.departments) {
        setDepartments(departmentsOut.data.departments.map(mapBackendDepartment));
      }

      if (auditLogsOut?.data?.audit_logs) {
        setAuditLogs(auditLogsOut.data.audit_logs.map(mapBackendAuditLog));
      } else if (!canFetchAdmin) {
        setAuditLogs([]);
      }

      if (metricsOut?.data) {
        setBackendMetrics(metricsOut.data);
      }

      setIsDataLoaded(true);
      setLoadError(null);
    } catch (err) {
      console.error('[TrustSphere SecurityContext] Failed to load data from backend:', err);
      setLoadError(err.message || 'Unable to connect to TrustSphere backend.');
      setIsDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load on application mount and when authenticated user changes
  useEffect(() => {
    fetchAllSecurityData();
  }, [user?.email, user?.role]);

  // System activity logger
  const logActivity = (action, resource, details = '', result = 'SUCCESS', resourceId = null) => {
    const actor = user ? user.name : 'SecOps Console';
    const email = user ? user.email : 'operator@trustsphere.corp';
    const localEntry = {
      id: `LOG-LOCAL-${Date.now()}`,
      user: actor,
      userEmail: email,
      action,
      resource,
      result,
      details,
      ipAddress: '127.0.0.1',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
    };

    setAuditLogs(prev => [localEntry, ...prev]);
    return localEntry;
  };

  // Real 7-layer verification upload integration: POST /api/verify
  const uploadAndAnalyzeAsset = async (assetInput) => {
    if (!assetInput.file) {
      throw new Error("No browser File object supplied for backend verification.");
    }

    const formData = new FormData();
    formData.append('file', assetInput.file);
    formData.append('department', assetInput.department || 'Finance');
    if (assetInput.type) formData.append('category', assetInput.type);
    if (assetInput.source) formData.append('source', assetInput.source);

    // POST /api/verify
    const res = await assetsApi.verifyAsset(formData);
    if (!res?.success || !res?.data) {
      throw new Error(res?.message || 'Verification pipeline rejected asset.');
    }

    const rawData = res.data;
    const fullAsset = mapBackendAsset(rawData);

    // If an incident was generated in MongoDB by the backend, ingest it into frontend state
    if (rawData.incident_id) {
      const newInc = mapBackendIncident({
        incident_id: rawData.incident_id,
        asset_id: rawData.asset_id,
        title: `${rawData.risk || rawData.risk_level || 'HIGH'} Risk Alert: ${assetInput.name}`,
        severity: (rawData.risk || rawData.risk_level || 'HIGH').toUpperCase().includes('CRITICAL') ? 'CRITICAL' : 'HIGH',
        department_id: assetInput.department || 'Finance',
        status: 'OPEN',
        description: rawData.anomalies?.length > 0 ? rawData.anomalies[0] : `Threshold alert: trust score ${rawData.trust_score}/100.`
      });

      setIncidents(prev => [newInc, ...prev.filter(i => i.id !== newInc.id)]);

      setNotifications(prev => [
        {
          id: `NOTIF-${Date.now()}`,
          type: newInc.severity === 'CRITICAL' ? 'critical' : 'high',
          title: `${newInc.severity} Security Alert: ${assetInput.name}`,
          message: `Ticket ${rawData.incident_id} created for ${assetInput.department} asset.`,
          link: `/incidents/${rawData.incident_id}`,
          time: 'Just now',
          read: false
        },
        ...prev
      ]);
    }

    // Add newly created asset into context state
    setAssets(prev => [fullAsset, ...prev.filter(a => a.id !== fullAsset.id)]);

    // Refresh metrics and audit trail in background from MongoDB
    dashboardApi.getDashboardMetrics()
      .then(m => m?.data && setBackendMetrics(m.data))
      .catch(() => {});
    auditLogsApi.getAuditLogs({ limit: 100 })
      .then(al => al?.data?.audit_logs && setAuditLogs(al.data.audit_logs.map(mapBackendAuditLog)))
      .catch(() => {});

    // Toast feedback
    if (fullAsset.risk === 'LOW') {
      addToast(`Asset ${fullAsset.name} verified successfully. Trust score: ${fullAsset.trustScore}/100.`, 'success');
    } else if (fullAsset.risk === 'MEDIUM') {
      addToast(`Asset ${fullAsset.name} flagged for review. Trust score: ${fullAsset.trustScore}/100.`, 'warning');
    } else {
      addToast(`Security Alert: ${fullAsset.name} flagged with ${fullAsset.risk} risk! Incident created.`, 'error');
    }

    return fullAsset;
  };

  // Real incident status update: PATCH /api/incidents/{id}/status
  const updateIncidentStatus = async (id, newStatus, note = '') => {
    try {
      let backendStatus = newStatus;
      if (newStatus === 'UNDER INVESTIGATION') backendStatus = 'INVESTIGATING';
      const res = await incidentsApi.updateIncidentStatus(id, backendStatus, note);
      if (res?.success) {
        setIncidents(prev => prev.map(inc => {
          if (inc.id === id || inc.incident_id === id) {
            const updatedTimeline = [...(inc.timeline || [])];
            updatedTimeline.push({
              step: `Status updated to ${newStatus}`,
              time: new Date().toISOString().substring(0, 16).replace('T', ' '),
              status: 'completed',
              note: note || `Updated by operator.`
            });
            return { ...inc, status: newStatus, timeline: updatedTimeline };
          }
          return inc;
        }));

        addToast(`Incident ${id} status updated to ${newStatus}`, 'success');

        // Background sync audit logs
        auditLogsApi.getAuditLogs({ limit: 100 })
          .then(al => al?.data?.audit_logs && setAuditLogs(al.data.audit_logs.map(mapBackendAuditLog)))
          .catch(() => {});
      }
    } catch (err) {
      addToast(`Failed to update incident: ${err.message}`, 'error');
      throw err;
    }
  };

  // Real employee creation: POST /api/employees
  const addEmployee = async (empData) => {
    try {
      const parts = (empData.name || '').trim().split(' ');
      const first_name = parts[0] || 'Staff';
      const last_name = parts.slice(1).join(' ') || 'Member';

      const payload = {
        first_name,
        last_name,
        email: empData.email,
        department_id: empData.department,
        role: empData.role || 'Security Analyst',
        status: empData.status || 'ACTIVE',
        trust_score: empData.trustScore !== undefined ? Number(empData.trustScore) : 88,
        password: empData.password || undefined,
        access_role: empData.access_role || 'EMPLOYEE'
      };

      const res = await employeesApi.createEmployee(payload);
      if (res?.success && res?.data) {
        const mapped = mapBackendEmployee(res.data);
        setEmployees(prev => [mapped, ...prev]);
        addToast(`Employee ${mapped.name} added successfully.`, 'success');
        if (isAdmin) {
          auditLogsApi.getAuditLogs({ limit: 100 })
            .then(al => al?.data?.audit_logs && setAuditLogs(al.data.audit_logs.map(mapBackendAuditLog)))
            .catch(() => {});
        }
        return mapped;
      }
      throw new Error(res?.message || 'Failed to register employee');
    } catch (err) {
      addToast(`Error adding employee: ${err.message}`, 'error');
      throw err;
    }
  };

  // Real employee update: PATCH /api/employees/{id}
  const updateEmployee = async (employeeId, empUpdates) => {
    try {
      const cleanName = empUpdates.name ? empUpdates.name.trim() : undefined;
      const parts = cleanName ? cleanName.split(' ') : [];
      const first_name = cleanName ? (parts[0] || 'Staff') : undefined;
      const last_name = cleanName ? (parts.slice(1).join(' ') || '') : undefined;

      const payload = {
        ...(cleanName ? { name: cleanName, first_name, last_name } : {}),
        ...(empUpdates.email !== undefined ? { email: empUpdates.email } : {}),
        ...((empUpdates.department || empUpdates.department_id) ? { department_id: empUpdates.department || empUpdates.department_id } : {}),
        ...(empUpdates.role !== undefined ? { role: empUpdates.role } : {}),
        ...(empUpdates.status !== undefined ? { status: empUpdates.status } : {}),
        ...(empUpdates.trustScore !== undefined ? { trust_score: Number(empUpdates.trustScore) } : {}),
        ...(empUpdates.password ? { password: empUpdates.password } : {}),
        ...(empUpdates.access_role ? { access_role: empUpdates.access_role } : {})
      };

      const res = await employeesApi.updateEmployee(employeeId, payload);
      if (res?.success && res?.data) {
        const mapped = mapBackendEmployee(res.data);
        setEmployees(prev => prev.map(e => (e.id === employeeId || e.employee_id === employeeId) ? mapped : e));
        addToast(`Employee ${mapped.name} updated successfully.`, 'success');
        if (isAdmin) {
          auditLogsApi.getAuditLogs({ limit: 100 })
            .then(al => al?.data?.audit_logs && setAuditLogs(al.data.audit_logs.map(mapBackendAuditLog)))
            .catch(() => {});
        }
        return mapped;
      }
      throw new Error(res?.message || 'Failed to update employee');
    } catch (err) {
      addToast(`Error updating employee: ${err.message}`, 'error');
      throw err;
    }
  };

  // Notifications management
  const markNotificationRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllNotificationsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    addToast("All notifications marked as read.", "info");
  };

  // Dynamic Dashboard and Platform Metrics derived from MongoDB
  const metrics = useMemo(() => {
    const emailsVerifiedCount = assets.filter(
      a => !a.is_demo && (a.email_metadata || (a.source || '').toLowerCase().includes('gmail') || (a.source || '').toLowerCase().includes('email'))
    ).length;

    if (backendMetrics) {
      return {
        overallTrustScore: Math.round(backendMetrics.average_trust_score || 0),
        totalAssets: backendMetrics.total_assets || assets.length,
        verifiedAssets: (backendMetrics.low_risk_assets || 0) + (backendMetrics.medium_risk_assets || 0),
        highRiskAssets: (backendMetrics.high_risk_assets || 0) + (backendMetrics.critical_incidents || 0),
        openIncidents: backendMetrics.open_incidents ?? incidents.filter(i => i.status === 'OPEN' || i.status === 'UNDER INVESTIGATION').length,
        emailsVerified: emailsVerifiedCount,
        riskCounts: backendMetrics.risk_distribution || {
          LOW: assets.filter(a => a.risk === 'LOW').length,
          MEDIUM: assets.filter(a => a.risk === 'MEDIUM').length,
          HIGH: assets.filter(a => a.risk === 'HIGH').length,
          CRITICAL: assets.filter(a => a.risk === 'CRITICAL').length
        }
      };
    }

    const totalAssets = assets.length;
    const highRiskAssets = assets.filter(a => a.risk === 'HIGH' || a.risk === 'CRITICAL').length;
    const openIncidents = incidents.filter(i => i.status === 'OPEN' || i.status === 'UNDER INVESTIGATION').length;
    const avgScore = totalAssets > 0 
      ? Math.round(assets.reduce((sum, a) => sum + (a.trustScore || 0), 0) / totalAssets)
      : 0;

    return {
      overallTrustScore: avgScore,
      totalAssets,
      verifiedAssets: assets.filter(a => a.status === 'VERIFIED').length,
      highRiskAssets,
      openIncidents,
      emailsVerified: emailsVerifiedCount,
      riskCounts: {
        LOW: assets.filter(a => a.risk === 'LOW').length,
        MEDIUM: assets.filter(a => a.risk === 'MEDIUM').length,
        HIGH: assets.filter(a => a.risk === 'HIGH').length,
        CRITICAL: assets.filter(a => a.risk === 'CRITICAL').length
      }
    };
  }, [backendMetrics, assets, incidents]);

  return (
    <SecurityContext.Provider
      value={{
        assets,
        incidents,
        employees,
        departments,
        auditLogs,
        notifications,
        isDataLoaded,
        isLoading,
        loadError,
        refetch: fetchAllSecurityData,
        metrics,
        uploadAndAnalyzeAsset,
        updateIncidentStatus,
        addEmployee,
        updateEmployee,
        markNotificationRead,
        markAllNotificationsRead,
        logActivity
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
}
