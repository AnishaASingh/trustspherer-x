import React, { useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Layers, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Eye, 
  Download, 
  UploadCloud,
  FileText,
  FileCode,
  FileSpreadsheet,
  Image,
  Mail,
  ShieldAlert
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import { exportToCSV } from '../utils/exportUtils';

export default function Assets() {
  const { assets, isLoading, loadError, refetch } = useSecurity();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  const [search, setSearch] = useState(initialQuery);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('date_desc');

  // Filter and sort logic
  const filteredAssets = useMemo(() => {
    return assets
      .filter((asset) => {
        // Search match
        if (search.trim()) {
          const q = search.toLowerCase();
          const match = 
            asset.name.toLowerCase().includes(q) ||
            asset.id.toLowerCase().includes(q) ||
            asset.source.toLowerCase().includes(q) ||
            asset.hash.toLowerCase().includes(q);
          if (!match) return false;
        }

        // Type filter
        if (typeFilter !== 'ALL' && asset.type.toUpperCase() !== typeFilter.toUpperCase()) {
          return false;
        }

        // Risk filter
        if (riskFilter !== 'ALL' && asset.risk.toUpperCase() !== riskFilter.toUpperCase()) {
          return false;
        }

        // Dept filter
        if (deptFilter !== 'ALL' && !asset.department.toLowerCase().includes(deptFilter.toLowerCase())) {
          return false;
        }

        // Status filter
        if (statusFilter !== 'ALL' && asset.status.toUpperCase() !== statusFilter.toUpperCase()) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score_desc') return b.trustScore - a.trustScore;
        if (sortBy === 'score_asc') return a.trustScore - b.trustScore;
        if (sortBy === 'date_asc') return new Date(a.date) - new Date(b.date);
        return new Date(b.date) - new Date(a.date); // default date_desc
      });
  }, [assets, search, typeFilter, riskFilter, deptFilter, statusFilter, sortBy]);

  const handleExportCSV = () => {
    const exportData = filteredAssets.map(a => ({
      AssetID: a.id,
      Name: a.name,
      Type: a.type,
      Source: a.source,
      Department: a.department,
      TrustScore: a.trustScore,
      Risk: a.risk,
      Status: a.status,
      UploadDate: a.date,
      Hash: a.hash
    }));
    exportToCSV('trustsphere_digital_assets', exportData);
  };

  const getFileIcon = (type) => {
    const t = type.toLowerCase();
    if (t.includes('invoice') || t.includes('report')) return FileSpreadsheet;
    if (t.includes('cert')) return FileCode;
    if (t.includes('email')) return Mail;
    if (t.includes('image') || t.includes('screen')) return Image;
    return FileText;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Digital Assets
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {assets.length} verified and monitored assets • {filteredAssets.length} matching criteria
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/upload" className="btn btn-primary">
            <UploadCloud size={16} />
            <span>Upload Asset</span>
          </Link>
        </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          {/* Search input */}
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Search assets by name or hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '34px' }}
            />
          </div>

          {/* Type Filter */}
          <select 
            className="input-field"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="ALL">All Types</option>
            <option value="PDF">PDF</option>
            <option value="Invoice">Invoice</option>
            <option value="Contract">Contract</option>
            <option value="Certificate">Certificate</option>
            <option value="Report">Report</option>
            <option value="Email">Email</option>
            <option value="Image">Image</option>
            <option value="Screenshot">Screenshot</option>
          </select>

          {/* Risk Filter */}
          <select 
            className="input-field"
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          >
            <option value="ALL">All Risk Levels</option>
            <option value="LOW">Low Risk</option>
            <option value="MEDIUM">Medium Risk</option>
            <option value="HIGH">High Risk</option>
            <option value="CRITICAL">Critical Risk</option>
          </select>

          {/* Department Filter */}
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

          {/* Status Filter */}
          <select 
            className="input-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="VERIFIED">Verified</option>
            <option value="UNDER REVIEW">Under Review</option>
            <option value="FLAGGED">Flagged</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Sort By */}
          <select 
            className="input-field"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date_desc">Newest First</option>
            <option value="date_asc">Oldest First</option>
            <option value="score_desc">Trust Score: High to Low</option>
            <option value="score_asc">Trust Score: Low to High</option>
          </select>
        </div>
      </div>

      {/* Assets Table */}
      {filteredAssets.length === 0 ? (
        <EmptyState 
          icon={Layers}
          title={assets.length === 0 ? "No digital assets uploaded." : "No digital assets match criteria"}
          description={assets.length === 0 ? "Upload a digital asset or synchronize Gmail to verify files through the 7-layer TrustSphere pipeline." : "Try broadening your search term or clearing one of your filter dropdowns."}
          action={
            assets.length === 0 ? (
              <Link to="/upload" className="btn btn-primary btn-sm">
                <UploadCloud size={15} />
                <span>Upload Asset</span>
              </Link>
            ) : (
              <button 
                onClick={() => { setSearch(''); setTypeFilter('ALL'); setRiskFilter('ALL'); setDeptFilter('ALL'); setStatusFilter('ALL'); }}
                className="btn btn-secondary btn-sm"
              >
                Reset Filters
              </button>
            )
          }
        />
      ) : (
        <div className="table-container">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Asset Name</th>
                <th>Type</th>
                <th>Source</th>
                <th>Department</th>
                <th>Trust Score</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => {
                const IconComponent = getFileIcon(asset.type);
                return (
                  <tr key={asset.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div 
                          style={{
                            padding: '0.45rem',
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--accent-cyan)'
                          }}
                        >
                          <IconComponent size={18} />
                        </div>
                        <div>
                          <Link 
                            to={`/assets/${asset.id}`} 
                            style={{ fontWeight: 600, color: 'var(--text-primary)', textDecoration: 'none' }}
                            className="asset-link-hover"
                          >
                            {asset.name}
                          </Link>
                          <div className="font-mono" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {asset.id} • {asset.size}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                        {asset.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {asset.email_metadata || asset.source === 'email' ? (
                          <span 
                            title={`Ingested from Email: ${asset.email_metadata?.sender || 'Authorized Mailbox'}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: 'var(--accent-cyan)', fontSize: '0.78rem', background: 'rgba(0, 240, 255, 0.08)', padding: '0.15rem 0.45rem', borderRadius: '4px', border: '1px solid rgba(0, 240, 255, 0.2)' }}
                          >
                            <Mail size={12} /> Email
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{asset.source}</span>
                        )}
                        {asset.ai_insights && (
                          <span 
                            title="AI-generated security analysis available"
                            style={{ display: 'inline-flex', alignItems: 'center', color: '#C084FC', background: 'rgba(168, 85, 247, 0.12)', padding: '0.12rem 0.35rem', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '0.68rem', fontWeight: 700 }}
                          >
                            AI
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{asset.department}</span>
                    </td>
                    <td>
                      <TrustScoreBadge score={asset.trustScore} size="sm" />
                    </td>
                    <td>
                      <RiskBadge risk={asset.risk} size="sm" />
                    </td>
                    <td>
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {asset.date}
                    </td>
                    <td>
                      <Link 
                        to={`/assets/${asset.id}`} 
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--accent-cyan)' }}
                      >
                        <Eye size={14} />
                        <span>Details</span>
                      </Link>
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
