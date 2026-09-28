import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Building2, 
  Users, 
  FileText, 
  AlertTriangle, 
  ShieldAlert, 
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';
import { Link } from 'react-router-dom';
import TrustScoreBadge from '../common/TrustScoreBadge';
import RiskBadge from '../common/RiskBadge';
import StatusBadge from '../common/StatusBadge';

export default function NetworkGraph({ 
  departments = [], 
  employees = [], 
  assets = [], 
  incidents = [] 
}) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [filterRiskOnly, setFilterRiskOnly] = useState(false);
  const [activeDeptFilter, setActiveDeptFilter] = useState('ALL');

  // Build graph nodes
  const rootNode = {
    id: "node-org",
    type: "ORGANIZATION",
    name: "TrustSphere Global Corp",
    subtitle: "Enterprise Root Node",
    trustScore: departments.length > 0 ? Math.round(departments.reduce((acc, d) => acc + (d.trustScore || 85), 0) / departments.length) : 100,
    risk: "LOW",
    status: "ACTIVE",
    x: 450,
    y: 50,
    color: "#00F0FF"
  };

  const deptNodes = departments.map((d, index) => {
    const spacing = Math.max(160, Math.min(220, 800 / (departments.length || 1)));
    const startX = Math.max(100, 450 - ((departments.length - 1) * spacing) / 2);
    return {
      id: `node-${d.id || d._id}`,
      type: "DEPARTMENT",
      data: d,
      name: d.name,
      subtitle: `${d.employeeCount || 0} Staff • ${d.assetCount || 0} Assets`,
      trustScore: d.trustScore !== undefined ? d.trustScore : 85,
      risk: d.riskLevel || 'LOW',
      status: "ACTIVE",
      x: startX + index * spacing,
      y: 190,
      color: (d.trustScore >= 80 || d.trustScore === undefined) ? "#10B981" : d.trustScore >= 60 ? "#F59E0B" : "#EF4444"
    };
  });

  // Filter top representative items for the graph
  const displayedEmployees = employees.slice(0, 6);
  const displayedAssets = assets.slice(0, 8);
  const displayedIncidents = incidents.slice(0, 4);

  // Layout calculations
  const employeeNodes = displayedEmployees.map((e, index) => {
    // Find parent dept
    const parentDept = deptNodes.find(d => d.name?.toLowerCase() === e.department?.toLowerCase()) || (deptNodes.length > 0 ? deptNodes[0] : null);
    const offsetX = (index % 3 - 1) * 60;
    const parentX = parentDept ? parentDept.x : (rootNode.x + offsetX);
    const parentId = parentDept ? parentDept.id : rootNode.id;
    return {
      id: `node-${e.id || e._id}`,
      type: "EMPLOYEE",
      data: e,
      name: e.name,
      subtitle: e.role,
      trustScore: e.trustScore !== undefined ? e.trustScore : 85,
      risk: e.riskLevel || 'LOW',
      status: e.status || 'ACTIVE',
      parentId: parentId,
      x: parentX + (parentDept ? offsetX : 0),
      y: 340 + (index % 2) * 45,
      color: (e.trustScore >= 80 || e.trustScore === undefined) ? "#10B981" : e.trustScore >= 60 ? "#F59E0B" : "#EF4444"
    };
  });

  const assetNodes = displayedAssets.map((a, index) => {
    const parentDept = deptNodes.find(d => a.department && d.name?.toLowerCase().includes(a.department.toLowerCase())) || (deptNodes.length > 0 ? deptNodes[0] : null);
    const offsetX = ((index % 4) - 1.5) * 65;
    const parentX = parentDept ? parentDept.x : (rootNode.x + offsetX);
    const parentId = parentDept ? parentDept.id : rootNode.id;
    const isCritical = a.risk === 'CRITICAL';
    const isHigh = a.risk === 'HIGH';

    return {
      id: `node-${a.id || a._id}`,
      type: "ASSET",
      data: a,
      name: a.name,
      subtitle: `${a.type} • ${a.size}`,
      trustScore: a.trustScore !== undefined ? a.trustScore : 80,
      risk: a.risk || 'LOW',
      status: a.status || 'VERIFIED',
      parentId: parentId,
      x: parentX + (parentDept ? offsetX : 0),
      y: 490 + (index % 2) * 55,
      isHighRisk: isHigh || isCritical,
      color: isCritical ? "#EF4444" : isHigh ? "#F97316" : (a.trustScore >= 75 || a.trustScore === undefined) ? "#10B981" : "#F59E0B"
    };
  });

  const incidentNodes = displayedIncidents.map((inc, index) => {
    const relatedAsset = assetNodes.find(a => (a.data?.id || a.data?.asset_id) === (inc.relatedAssetId || inc.asset_id));
    const parentX = relatedAsset ? relatedAsset.x : 450 + (index - 1.5) * 120;
    const parentY = relatedAsset ? relatedAsset.y : 480;

    return {
      id: `node-${inc.id || inc._id}`,
      type: "INCIDENT",
      data: inc,
      name: inc.id || inc.incident_id || `INC-${index + 1}`,
      subtitle: inc.title,
      trustScore: inc.severity === 'CRITICAL' ? 20 : inc.severity === 'HIGH' ? 45 : 65,
      risk: inc.severity,
      status: inc.status,
      parentId: relatedAsset ? relatedAsset.id : null,
      x: parentX,
      y: 660,
      isHighRisk: true,
      color: inc.severity === 'CRITICAL' ? "#EF4444" : "#F97316"
    };
  });

  const allNodes = [rootNode, ...deptNodes, ...employeeNodes, ...assetNodes, ...incidentNodes];

  // Filtering
  const filteredNodes = allNodes.filter(node => {
    if (filterRiskOnly && node.type !== 'ORGANIZATION' && !node.isHighRisk && node.risk === 'LOW') {
      return false;
    }
    if (activeDeptFilter !== 'ALL') {
      if (node.type === 'ORGANIZATION') return true;
      if (node.type === 'DEPARTMENT' && node.name !== activeDeptFilter) return false;
      if (node.data?.department && !node.data.department.includes(activeDeptFilter)) return false;
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', gap: '1.5rem', width: '100%' }} className="twin-container">
      {/* Visual Canvas Area */}
      <div 
        className="glass-panel" 
        style={{ 
          flex: 1, 
          minWidth: 0, 
          padding: '1.25rem', 
          position: 'relative',
          overflow: 'hidden' 
        }}
      >
        {/* Controls Toolbar */}
        <div 
          style={{
            position: 'absolute',
            top: '1.5rem',
            left: '1.5rem',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            padding: '0.4rem 0.8rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <Filter size={14} color="var(--accent-cyan)" />
          
          <select 
            value={activeDeptFilter} 
            onChange={(e) => setActiveDeptFilter(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '0.78rem',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">All Departments</option>
            {departments.map((d) => (
              <option key={d.id || d._id} value={d.name}>{d.name}</option>
            ))}
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={filterRiskOnly} 
              onChange={(e) => setFilterRiskOnly(e.target.checked)} 
              style={{ accentColor: 'var(--trust-0)' }}
            />
            <span>Highlight High Risk Only</span>
          </label>
        </div>

        {/* Legend */}
        <div 
          style={{
            position: 'absolute',
            bottom: '1.25rem',
            left: '1.5rem',
            zIndex: 10,
            display: 'flex',
            gap: '1rem',
            background: 'rgba(15, 23, 42, 0.85)',
            padding: '0.35rem 0.75rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00F0FF' }} /> Organization
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3B82F6' }} /> Department
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981' }} /> Trusted Asset
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444', boxShadow: '0 0 6px #EF4444' }} /> High Risk / Incident
          </span>
        </div>

        {/* Empty state overlay when no nodes exist */}
        {departments.length === 0 && assets.length === 0 && (
          <div
            style={{
              position: 'absolute',
              top: '52%',
              left: '50%',
              transform: 'translate(-50%, -20%)',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.92)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '1.75rem 2.25rem',
              maxWidth: '440px',
              zIndex: 5,
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
            }}
          >
            <ShieldCheck size={40} color="var(--accent-cyan)" style={{ margin: '0 auto 0.75rem', opacity: 0.85 }} />
            <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              Enterprise Digital Twin Active
            </h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
              The root organization node is operational. Add departments or verify digital assets via File Intake or Watched Folder to render automated topological telemetry.
            </p>
          </div>
        )}

        {/* SVG Graph View */}
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <svg viewBox="0 0 920 740" style={{ width: '100%', minWidth: '780px', height: 'auto', display: 'block' }}>
            <defs>
              <filter id="glow-danger" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Connecting Links */}
            {/* Org to Depts */}
            {deptNodes.map(dept => (
              <path
                key={`link-org-${dept.id}`}
                d={`M ${rootNode.x} ${rootNode.y + 25} C ${rootNode.x} ${(rootNode.y + dept.y) / 2}, ${dept.x} ${(rootNode.y + dept.y) / 2}, ${dept.x} ${dept.y - 25}`}
                fill="none"
                stroke="rgba(0, 240, 255, 0.2)"
                strokeWidth="1.5"
                strokeDasharray="4 2"
              />
            ))}

            {/* Depts to Employees */}
            {employeeNodes.map(emp => {
              const parent = deptNodes.find(d => d.id === emp.parentId);
              if (!parent) return null;
              return (
                <path
                  key={`link-emp-${emp.id}`}
                  d={`M ${parent.x} ${parent.y + 25} L ${emp.x} ${emp.y - 18}`}
                  fill="none"
                  stroke="rgba(59, 130, 246, 0.2)"
                  strokeWidth="1"
                />
              );
            })}

            {/* Depts to Assets */}
            {assetNodes.map(asset => {
              const parent = deptNodes.find(d => d.id === asset.parentId);
              if (!parent) return null;
              return (
                <path
                  key={`link-asset-${asset.id}`}
                  d={`M ${parent.x} ${parent.y + 25} C ${parent.x} ${(parent.y + asset.y) / 2}, ${asset.x} ${(parent.y + asset.y) / 2}, ${asset.x} ${asset.y - 18}`}
                  fill="none"
                  stroke={asset.isHighRisk ? "rgba(239, 68, 68, 0.4)" : "rgba(16, 185, 129, 0.2)"}
                  strokeWidth={asset.isHighRisk ? "2" : "1"}
                  strokeDasharray={asset.isHighRisk ? "3 3" : "none"}
                />
              );
            })}

            {/* Assets to Incidents */}
            {incidentNodes.map(inc => {
              const parent = assetNodes.find(a => a.id === inc.parentId);
              if (!parent) return null;
              return (
                <path
                  key={`link-inc-${inc.id}`}
                  d={`M ${parent.x} ${parent.y + 18} L ${inc.x} ${inc.y - 18}`}
                  fill="none"
                  stroke="#EF4444"
                  strokeWidth="2"
                  filter="url(#glow-danger)"
                />
              );
            })}

            {/* Render Nodes */}
            {filteredNodes.map(node => {
              const isSelected = selectedNode?.id === node.id;
              const isRisk = node.isHighRisk || node.risk === 'CRITICAL' || node.risk === 'HIGH';

              return (
                <g 
                  key={node.id} 
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => setSelectedNode(node)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Pulsing ring for high risk */}
                  {isRisk && (
                    <circle 
                      r="28" 
                      fill="none" 
                      stroke="#EF4444" 
                      strokeWidth="1.5" 
                      opacity="0.7"
                      className="animate-pulse" 
                    />
                  )}

                  {/* Node Body Card */}
                  <rect
                    x="-65"
                    y="-20"
                    width="130"
                    height="40"
                    rx="8"
                    fill={isSelected ? "rgba(0, 240, 255, 0.15)" : "#0F172A"}
                    stroke={isSelected ? "#00F0FF" : node.color}
                    strokeWidth={isSelected ? "2" : isRisk ? "2" : "1"}
                    filter={isRisk ? "url(#glow-danger)" : "none"}
                  />

                  {/* Text labels */}
                  <text
                    x="0"
                    y="-3"
                    fill="#FFF"
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.name.length > 18 ? `${node.name.substring(0, 16)}...` : node.name}
                  </text>
                  <text
                    x="0"
                    y="11"
                    fill={node.color}
                    fontSize="9"
                    fontWeight="700"
                    textAnchor="middle"
                    className="font-mono"
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.trustScore}/100 • {node.type}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Side Panel Inspector */}
      <div 
        className="glass-panel" 
        style={{ 
          width: '340px', 
          padding: '1.5rem', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between',
          flexShrink: 0 
        }}
      >
        {selectedNode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <span className="badge" style={{ background: 'rgba(0, 240, 255, 0.1)', color: 'var(--accent-cyan)', border: '1px solid rgba(0, 240, 255, 0.3)', marginBottom: '0.5rem' }}>
                {selectedNode.type} TELEMETRY
              </span>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedNode.name}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedNode.subtitle}
              </p>
            </div>

            {/* Metrics */}
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Trust Score</span>
                <TrustScoreBadge score={selectedNode.trustScore} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Risk Classification</span>
                <RiskBadge risk={selectedNode.risk} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status</span>
                <StatusBadge status={selectedNode.status} />
              </div>
            </div>

            {/* Additional details */}
            {selectedNode.data && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {selectedNode.data.department && (
                  <div><strong>Department:</strong> {selectedNode.data.department}</div>
                )}
                {selectedNode.data.source && (
                  <div><strong>Origin:</strong> {selectedNode.data.source}</div>
                )}
                {selectedNode.data.reason && (
                  <div style={{ color: '#F87171' }}><strong>Incident Cause:</strong> {selectedNode.data.reason}</div>
                )}
                {selectedNode.data.hash && (
                  <div style={{ wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <strong>Hash:</strong> {selectedNode.data.hash.substring(0, 24)}...
                  </div>
                )}
              </div>
            )}

            {/* Quick Action Navigation */}
            <div>
              {selectedNode.type === 'ASSET' && (
                <Link to={`/assets/${selectedNode.data.id}`} className="btn btn-primary" style={{ width: '100%' }}>
                  <span>Open Full Asset Analysis</span>
                  <ExternalLink size={14} />
                </Link>
              )}
              {selectedNode.type === 'INCIDENT' && (
                <Link to={`/incidents/${selectedNode.data.id}`} className="btn btn-danger" style={{ width: '100%' }}>
                  <span>Open Incident Triage</span>
                  <ExternalLink size={14} />
                </Link>
              )}
              {selectedNode.type === 'EMPLOYEE' && (
                <Link to={`/employees/${selectedNode.data.id}`} className="btn btn-secondary" style={{ width: '100%' }}>
                  <span>View Employee Profile</span>
                  <ExternalLink size={14} />
                </Link>
              )}
              {selectedNode.type === 'DEPARTMENT' && (
                <Link to={`/departments/${selectedNode.data.id}`} className="btn btn-secondary" style={{ width: '100%' }}>
                  <span>Inspect Department Governance</span>
                  <ExternalLink size={14} />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', margin: 'auto 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <Building2 size={36} color="var(--accent-cyan)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
            <p>Click any node in the topology to inspect its trust telemetry, linked assets, and incident relationships.</p>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Interactive Organization Digital Twin • Live Sync
        </div>
      </div>
    </div>
  );
}
