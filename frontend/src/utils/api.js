/**
 * TrustSphere Centralized API Client
 * Connects frontend React components to FastAPI backend and MongoDB.
 */

const rawBase = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_BASE_URL = rawBase.endsWith('/api') ? rawBase : `${rawBase.replace(/\/$/, '')}/api`;

// Authentication token helpers
export const TOKEN_KEY = 'trustsphere_token';

export const getToken = () => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setToken = (token) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
};

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY);
};

/**
 * Low-level request handler with authentication, multipart support, and centralized error handling.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const headers = { ...options.headers };

  const token = getToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is NOT FormData, default to application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers
    });
  } catch (netErr) {
    console.error(`[TrustSphere Network Error] ${options.method || 'GET'} ${url}:`, netErr);
    const friendlyError = new Error(
      `Unable to connect to TrustSphere backend at ${API_BASE_URL}. Ensure the FastAPI server is running on port 8000.`
    );
    friendlyError.isNetworkError = true;
    throw friendlyError;
  }

  let payload;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    payload = await res.json();
  } else {
    const text = await res.text();
    payload = { success: res.ok, message: text };
  }

  if (!res.ok) {
    if (res.status === 401) {
      removeToken();
      window.dispatchEvent(new CustomEvent('trustsphere:unauthorized'));
    }

    const errorMsg =
      payload?.message ||
      payload?.detail ||
      `Request failed with status ${res.status}: ${res.statusText}`;

    const error = new Error(errorMsg);
    error.status = res.status;
    error.data = payload;
    throw error;
  }

  return payload;
}

// ============================================================
// 1. AUTHENTICATION API
// ============================================================
export const authApi = {
  register: async (userData) => {
    return await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  login: async (credentials) => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res?.data?.access_token) {
      setToken(res.data.access_token);
    }
    return res;
  },

  getCurrentUser: async () => {
    return await request('/auth/me', {
      method: 'GET'
    });
  },

  getUsers: async () => {
    return await request('/auth/users', {
      method: 'GET'
    });
  },

  logout: () => {
    removeToken();
  }
};

// ============================================================
// 2. ASSETS API
// ============================================================
export const assetsApi = {
  getAssets: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.department && params.department !== 'ALL') query.append('department', params.department);
    if (params.risk_level && params.risk_level !== 'ALL') query.append('risk_level', params.risk_level);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.limit) query.append('limit', params.limit);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return await request(`/assets${qs}`);
  },

  getAsset: async (assetId) => {
    return await request(`/assets/${assetId}`);
  },

  verifyAsset: async (formData) => {
    // Note: Do NOT set Content-Type; browser automatically sets boundary for FormData
    return await request('/verify', {
      method: 'POST',
      body: formData
    });
  },

  reanalyzeAsset: async (assetId) => {
    return await request(`/assets/${assetId}/reanalyze`, {
      method: 'POST'
    });
  },

  getAssetRecommendations: async (assetId) => {
    return await request(`/assets/${assetId}/recommendations`);
  }
};

// ============================================================
// 3. INCIDENTS API
// ============================================================
export const incidentsApi = {
  getIncidents: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.severity && params.severity !== 'ALL') query.append('severity', params.severity);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.department && params.department !== 'ALL') query.append('department', params.department);
    if (params.limit) query.append('limit', params.limit);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return await request(`/incidents${qs}`);
  },

  getIncident: async (incidentId) => {
    return await request(`/incidents/${incidentId}`);
  },

  updateIncidentStatus: async (incidentId, status, note = '') => {
    return await request(`/incidents/${incidentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note })
    });
  }
};

// ============================================================
// 4. EMPLOYEES API
// ============================================================
export const employeesApi = {
  getEmployees: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.department && params.department !== 'ALL') query.append('department', params.department);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.limit) query.append('limit', params.limit);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return await request(`/employees${qs}`);
  },

  getEmployee: async (employeeId) => {
    return await request(`/employees/${employeeId}`);
  },

  createEmployee: async (employeeData) => {
    return await request('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData)
    });
  },

  updateEmployee: async (employeeId, updates) => {
    return await request(`/employees/${employeeId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }
};

// ============================================================
// 5. DEPARTMENTS API
// ============================================================
export const departmentsApi = {
  getDepartments: async () => {
    return await request('/departments');
  },

  getDepartment: async (deptIdOrName) => {
    return await request(`/departments/${encodeURIComponent(deptIdOrName)}`);
  },

  createDepartment: async (deptData) => {
    return await request('/departments', {
      method: 'POST',
      body: JSON.stringify(deptData)
    });
  },

  updateDepartment: async (deptIdOrName, updates) => {
    return await request(`/departments/${encodeURIComponent(deptIdOrName)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }
};

// ============================================================
// 6. AUDIT LOGS API
// ============================================================
export const auditLogsApi = {
  getAuditLogs: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.action && params.action !== 'ALL') query.append('action', params.action);
    if (params.entity_type && params.entity_type !== 'ALL') query.append('entity_type', params.entity_type);
    if (params.result && params.result !== 'ALL') query.append('result', params.result);
    if (params.limit) query.append('limit', params.limit);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return await request(`/audit-logs${qs}`);
  }
};

// ============================================================
// 7. DASHBOARD API
// ============================================================
export const dashboardApi = {
  getDashboardMetrics: async () => {
    return await request('/dashboard/metrics');
  }
};

// ============================================================
// 8. DIGITAL TWIN API
// ============================================================
export const digitalTwinApi = {
  getOverview: async () => {
    return await request('/digital-twin/overview');
  }
};

// ============================================================
// 9. USER MANAGEMENT API (ADMIN ONLY)
// ============================================================
export const usersApi = {
  getUsers: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('q', params.search);
    if (params.role && params.role !== 'ALL') query.append('role', params.role);
    if (params.department && params.department !== 'ALL') query.append('department', params.department);
    if (params.status && params.status !== 'ALL') query.append('status', params.status);
    if (params.limit) query.append('limit', params.limit);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return await request(`/users${qs}`);
  },

  getUser: async (userId) => {
    return await request(`/users/${userId}`);
  },

  createUser: async (userData) => {
    return await request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  },

  updateUser: async (userId, userData) => {
    return await request(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(userData)
    });
  },

  updateUserStatus: async (userId, status) => {
    return await request(`/users/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  resetPassword: async (userId, newPassword) => {
    return await request(`/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword })
    });
  },

  deleteUser: async (userId) => {
    return await request(`/users/${userId}`, {
      method: 'DELETE'
    });
  }
};

// ============================================================
// 10. INGESTION & EMAIL INTEGRATION API
// ============================================================
export const ingestionApi = {
  getStatus: async () => {
    return await request('/ingestion/status');
  },

  getAiStatus: async () => {
    return await request('/ingestion/ai/status');
  },

  getOAuthStatus: async () => {
    return await request('/ingestion/email/oauth/status');
  },

  connectGmailOAuth: async () => {
    return await request('/ingestion/email/oauth/connect', {
      method: 'POST'
    });
  },

  disconnectGmailOAuth: async () => {
    return await request('/ingestion/email/oauth/disconnect', {
      method: 'POST'
    });
  },

  getEmailFilters: async () => {
    return await request('/ingestion/email/filters');
  },

  updateEmailFilters: async (rules) => {
    return await request('/ingestion/email/filters', {
      method: 'PATCH',
      body: JSON.stringify(rules)
    });
  },

  getEmailSettings: async () => {
    return await request('/ingestion/email/settings');
  },

  updateEmailSettings: async (settings) => {
    return await request('/ingestion/email/settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
  },

  testEmailConnection: async (creds = {}) => {
    return await request('/ingestion/email/test-connection', {
      method: 'POST',
      body: JSON.stringify(creds)
    });
  },

  pollEmail: async (department = 'Operations') => {
    return await request(`/ingestion/email/poll?department=${encodeURIComponent(department)}`, {
      method: 'POST'
    });
  },

  ingestDemoEmail: async (formData) => {
    return await request('/ingestion/email/demo', {
      method: 'POST',
      body: formData
    });
  },

  simulateEmail: async (formData) => {
    return await request('/ingestion/email/simulate', {
      method: 'POST',
      body: formData
    });
  },

  getRecentEmails: async (limit = 25) => {
    return await request(`/ingestion/email/recent?limit=${limit}`);
  },

  triggerFolderScan: async (department = 'Operations') => {
    return await request(`/ingestion/scan?department=${encodeURIComponent(department)}`, {
      method: 'POST'
    });
  },

  getHistory: async (limit = 25) => {
    return await request(`/ingestion/history?limit=${limit}`);
  }
};

// ============================================================
// 11. GROQ AI DECISION INTELLIGENCE API (openai/gpt-oss-20b)
// ============================================================
export const aiApi = {
  getStatus: async () => {
    return await request('/ai/status');
  },

  analyzeAsset: async (assetId) => {
    return await request('/ai/analyze-asset', {
      method: 'POST',
      body: JSON.stringify({ asset_id: assetId })
    });
  },

  analyzeIncident: async (incidentId) => {
    return await request('/ai/analyze-incident', {
      method: 'POST',
      body: JSON.stringify({ incident_id: incidentId })
    });
  },

  analyzeDigitalTwin: async (departmentFilter = null) => {
    return await request('/ai/analyze-digital-twin', {
      method: 'POST',
      body: JSON.stringify({ department_filter: departmentFilter })
    });
  },

  chat: async (question, contextType = 'dashboard', entityId = null) => {
    return await request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        question,
        context_type: contextType,
        entity_id: entityId
      })
    });
  }
};

export default {
  auth: authApi,
  assets: assetsApi,
  incidents: incidentsApi,
  employees: employeesApi,
  departments: departmentsApi,
  auditLogs: auditLogsApi,
  dashboard: dashboardApi,
  digitalTwin: digitalTwinApi,
  users: usersApi,
  ingestion: ingestionApi,
  ai: aiApi
};
