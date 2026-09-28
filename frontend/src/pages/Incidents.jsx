import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  Eye, 
  Download, 
  ShieldAlert,
  ArrowRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import { exportToCSV } from '../utils/exportUtils';

export default function Incidents() {
  const { incidents, loadError, refetch } = useSecurity();

  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  const filteredIncidents = useMemo(() => {
    return incidents.filter((inc) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const match = 
          inc.id.toLowerCase().includes(q) ||
          inc.title.toLowerCase().includes(q) ||
          inc.relatedAssetName.toLowerCase().includes(q) ||
          inc.reason.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Severity
      if (severityFilter !== 'ALL' && inc.severity.toUpperCase() !== severityFilter.toUpperCase()) {
        return false;
      }

      // Status
      if (statusFilter !== 'ALL' && inc.status.toUpperCase() !== statusFilter.toUpperCase()) {
        return false;
      }

      // Department
      if (deptFilter !== 'ALL' && !inc.department.toLowerCase().includes(deptFilter.toLowerCase())) {
        return false;
      }

      return true;
    });
  }, [incidents, search, severityFilter, statusFilter, deptFilter]);

  const handleExportCSV = () => {
    const data = filteredIncidents.map(inc => ({
      IncidentID: inc.id,
      Title: inc.title,
      Asset: inc.relatedAssetName,
      Severity: inc.severity,
      Department: inc.department,
      Status: inc.status,
      DetectedDate: inc.detectedDate,
      Reason: inc.reason
    }));
    exportToCSV('trustsphere_security_incidents', data);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Security Incidents Management
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Track, investigate, and resolve anomalous digital asset threats across departments.
          </p>
        </div>

        <button onClick={handleExportCSV} className="btn btn-secondary">
          <Download size={16} />
          <span>Export Incidents CSV</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search by ID, title, or asset..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '34px' }}
            />
          </div>

          <select 
            className="input-field"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select 
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="UNDER INVESTIGATION">Under Investigation</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>

          <select 
            className="input-field"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">All Departments</option>
            <option value="Finance">Finance</option>
            <option value="HR">HR</option>
            <option value="IT">IT</option>
            <option value="Operations">Operations</option>
          </select>
        </div>
      </div>

      {/* Incidents Table */}
      {filteredIncidents.length === 0 ? (
        <EmptyState 
          icon={AlertTriangle}
          title="No incidents match your filters"
          description="Try selecting a different severity or department filter."
          action={
            <button 
              onClick={() => { setSearch(''); setSeverityFilter('ALL'); setStatusFilter('ALL'); setDeptFilter('ALL'); }}
              className="btn btn-secondary btn-sm"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Incident ID</th>
                <th>Related Asset</th>
                <th>Severity</th>
                <th>Detection Reason</th>
                <th>Department</th>
                <th>Detected Date</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map((inc) => (
                <tr key={inc.id}>
                  <td>
                    <Link to={`/incidents/${inc.id}`} className="font-mono" style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'none' }}>
                      {inc.id}
                    </Link>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{inc.relatedAssetName}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{inc.title}</div>
                  </td>
                  <td>
                    <RiskBadge risk={inc.severity} size="sm" />
                  </td>
                  <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{inc.reason}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 500 }}>{inc.department}</span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {inc.detectedDate}
                  </td>
                  <td>
                    <StatusBadge status={inc.status} />
                  </td>
                  <td>
                    <Link to={`/incidents/${inc.id}`} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-cyan)' }}>
                      <Eye size={14} />
                      <span>Investigate</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
