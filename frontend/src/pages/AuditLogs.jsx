import React, { useState, useMemo } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle,
  Clock
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import EmptyState from '../components/common/EmptyState';
import { exportToCSV } from '../utils/exportUtils';

export default function AuditLogs() {
  const { auditLogs, loadError, refetch } = useSecurity();

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [resultFilter, setResultFilter] = useState('ALL');

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = 
          log.user.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q) ||
          log.resource.toLowerCase().includes(q) ||
          log.id.toLowerCase().includes(q) ||
          (log.details && log.details.toLowerCase().includes(q));
        if (!match) return false;
      }

      if (actionFilter !== 'ALL' && log.action.toLowerCase() !== actionFilter.toLowerCase()) {
        return false;
      }

      if (resultFilter !== 'ALL' && log.result.toUpperCase() !== resultFilter.toUpperCase()) {
        return false;
      }

      return true;
    });
  }, [auditLogs, search, actionFilter, resultFilter]);

  const handleExportCSV = () => {
    const data = filteredLogs.map(l => ({
      LogID: l.id,
      User: l.user,
      UserEmail: l.userEmail,
      Action: l.action,
      Resource: l.resource,
      Timestamp: l.timestamp,
      Result: l.result,
      IPAddress: l.ipAddress,
      Details: l.details
    }));
    exportToCSV('trustsphere_audit_trail', data);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            TrustSphere Audit Logs
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Track system activities, user actions, uploads, and security events.
          </p>
        </div>

        <button onClick={handleExportCSV} className="btn btn-secondary">
          <Download size={16} />
          <span>Export Audit Log CSV</span>
        </button>
      </div>

      {loadError && (
        <div style={{ padding: '0.85rem 1.25rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: '#F87171', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <span>{loadError}</span>
          <button onClick={refetch} className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.75rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search by user, action, resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '34px' }}
            />
          </div>

          <select 
            className="input-field"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="ALL">All Actions</option>
            <option value="Login">Login</option>
            <option value="Logout">Logout</option>
            <option value="Asset uploaded">Asset uploaded</option>
            <option value="Asset analyzed">Asset analyzed</option>
            <option value="Asset re-analyzed">Asset re-analyzed</option>
            <option value="Viewed Asset">Viewed Asset</option>
            <option value="Incident created">Incident created</option>
            <option value="Incident updated">Incident updated</option>
            <option value="Employee added">Employee added</option>
          </select>

          <select 
            className="input-field"
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
          >
            <option value="ALL">All Results</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="FLAGGED">Flagged</option>
            <option value="CRITICAL">Critical</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <EmptyState 
          icon={History}
          title={auditLogs.length === 0 ? "No audit activity yet." : "No audit entries found"}
          description={auditLogs.length === 0 ? "System activities, user actions, uploads, and security events will appear here." : "No activity entries match your current search criteria."}
        />
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Log ID</th>
                <th>User Identity</th>
                <th>Action</th>
                <th>Target Resource</th>
                <th>Timestamp</th>
                <th>Result</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => {
                let badgeClass = 'badge-trusted';
                if (log.result === 'CRITICAL' || log.result === 'FAILED') badgeClass = 'badge-critical';
                else if (log.result === 'WARNING' || log.result === 'FLAGGED') badgeClass = 'badge-medium';

                return (
                  <tr key={log.id}>
                    <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                      {log.id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{log.user}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{log.userEmail}</div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.08)', color: 'var(--accent-cyan)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {log.resource}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {log.timestamp}
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        {log.result}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', maxWidth: '300px', whiteSpace: 'normal' }}>
                      {log.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
