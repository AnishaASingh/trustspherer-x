import React from 'react';
import { 
  BarChart3, 
  Download, 
  Printer, 
  ShieldCheck, 
  AlertTriangle, 
  Layers, 
  CheckCircle2, 
  TrendingUp,
  FileCheck,
  Sparkles,
  Cpu
} from 'lucide-react';
import { useSecurity } from '../context/SecurityContext';
import { useAuth } from '../context/AuthContext';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import TrustTrendChart from '../components/charts/TrustTrendChart';
import RiskDonutChart from '../components/charts/RiskDonutChart';
import DepartmentBarChart from '../components/charts/DepartmentBarChart';
import { exportToCSV, printExecutiveReport } from '../utils/exportUtils';
import { useToast } from '../context/ToastContext';

export default function Reports() {
  const { assets, incidents, departments, metrics } = useSecurity();
  const { organization } = useAuth();
  const { addToast } = useToast();

  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(i => i.status === 'OPEN').length;
  const investigatingIncidents = incidents.filter(i => i.status === 'UNDER INVESTIGATION').length;
  const resolvedIncidents = incidents.filter(i => i.status === 'RESOLVED').length;
  const criticalIncidents = incidents.filter(i => i.severity === 'CRITICAL').length;

  const handleExportSummaryCSV = () => {
    const summaryData = [
      { Metric: "Organization Name", Value: organization?.name || "TrustSphere Enterprise" },
      { Metric: "Overall Trust Score", Value: metrics.overallTrustScore !== null ? `${metrics.overallTrustScore}/100` : "Awaiting verification" },
      { Metric: "Total Assets", Value: metrics.totalAssets },
      { Metric: "Verified Assets", Value: metrics.verifiedAssets },
      { Metric: "High Risk Assets", Value: metrics.highRiskAssets },
      { Metric: "Total Incidents", Value: totalIncidents },
      { Metric: "Open Incidents", Value: openIncidents },
      { Metric: "Under Investigation", Value: investigatingIncidents },
      { Metric: "Resolved Incidents", Value: resolvedIncidents },
      { Metric: "Critical Severity Incidents", Value: criticalIncidents }
    ];
    exportToCSV('trustsphere_executive_report', summaryData);
    addToast("Executive report exported as CSV.", "success");
  };

  const handlePrintPDF = () => {
    addToast("Generating print-ready PDF view...", "info");
    printExecutiveReport();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Trust & Risk Reports
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Executive compliance assessment and cross-departmental risk distribution.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={handlePrintPDF} className="btn btn-secondary">
            <Printer size={16} />
            <span>Print PDF</span>
          </button>
          <button onClick={handleExportSummaryCSV} className="btn btn-primary">
            <Download size={16} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Organization Master Trust Banner */}
      <div 
        className="glass-panel"
        style={{
          padding: '1.75rem 2rem',
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          borderLeft: '4px solid var(--accent-cyan)'
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ORGANIZATION TRUST INDEX
          </span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.2rem' }}>
            {organization?.name || "TrustSphere Enterprise"}
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
            Live database metrics • Account: {organization?.email || 'Authenticated Session'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Consensus Trust</div>
            <div className="font-mono" style={{ fontSize: metrics.overallTrustScore !== null ? '2.25rem' : '1.1rem', fontWeight: 800, color: 'var(--accent-cyan)', lineHeight: 1 }}>
              {metrics.overallTrustScore !== null && metrics.overallTrustScore !== undefined ? (
                <>
                  {metrics.overallTrustScore}
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/100</span>
                </>
              ) : (
                'Awaiting verification'
              )}
            </div>
          </div>
          <TrustScoreBadge score={metrics.overallTrustScore} size="normal" />
        </div>
      </div>

      {/* Summaries 2-col Grid: Asset Summary & Incident Summary */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Asset Summary */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} color="var(--accent-cyan)" />
            Digital Asset Registry Summary
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Assets</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {metrics.totalAssets}
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified Assets</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--trust-75)', marginTop: '0.25rem' }}>
                {metrics.verifiedAssets}
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Under Review</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--trust-60)', marginTop: '0.25rem' }}>
                {assets.filter(a => a.status === 'UNDER REVIEW').length}
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>High Risk Assets</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--trust-40)', marginTop: '0.25rem' }}>
                {metrics.highRiskAssets}
              </div>
            </div>
          </div>
        </div>

        {/* Incident Summary */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--trust-0)" />
            Security Incident Summary
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Incidents</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {totalIncidents}
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Open Triage</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#EF4444', marginTop: '0.25rem' }}>
                {openIncidents}
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Under Investigation</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3B82F6', marginTop: '0.25rem' }}>
                {investigatingIncidents}
              </div>
            </div>

            <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Resolved & Closed</div>
              <div className="font-mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--trust-75)', marginTop: '0.25rem' }}>
                {resolvedIncidents}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Visual Charts Row */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Department Trust Bar Chart */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
            Department Trust Benchmarks
          </h3>
          <DepartmentBarChart departments={departments} />
        </div>

        {/* Risk Distribution Donut Chart */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', alignSelf: 'flex-start' }}>
            Enterprise Risk Distribution
          </h3>
          <RiskDonutChart data={metrics.riskCounts} />
        </div>
      </div>

      {/* Trust Trend Chart Row */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
          Organizational Trust Trajectory Trend
        </h3>
        <TrustTrendChart data={metrics.trendData} height={220} />
      </div>

      {/* Executive Recommendations */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileCheck size={20} />
          Executive Decision Recommendations
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: metrics.highRiskAssets > 0 ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)', borderLeft: `3px solid ${metrics.highRiskAssets > 0 ? 'var(--trust-0)' : 'var(--trust-75)'}` }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: metrics.highRiskAssets > 0 ? '#F87171' : '#34D399' }}>
              1. {metrics.highRiskAssets > 0 ? `Review ${metrics.highRiskAssets} high-risk asset(s) immediately` : 'Asset Trust Baseline Healthy'}
            </h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {metrics.highRiskAssets > 0 
                ? `${metrics.highRiskAssets} digital asset(s) operate below minimum trust tolerances. Prioritize manual inspection and signer re-validation.`
                : `All ${metrics.totalAssets} registered digital asset(s) meet enterprise integrity benchmarks with no critical risks.`}
            </p>
          </div>

          <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: totalIncidents > 0 ? 'rgba(245, 158, 11, 0.06)' : 'rgba(59, 130, 246, 0.06)', borderLeft: `3px solid ${totalIncidents > 0 ? 'var(--trust-60)' : 'var(--accent-blue)'}` }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: totalIncidents > 0 ? '#FBBF24' : '#60A5FA' }}>
              2. {totalIncidents > 0 ? `Triage ${openIncidents} open security incident(s)` : 'Security Incident Queue Clear'}
            </h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {totalIncidents > 0 
                ? `Currently tracking ${totalIncidents} total incident(s) (${openIncidents} open, ${investigatingIncidents} under investigation). Maintain active triage.`
                : 'Zero active incident tickets recorded. Automated policy enforcement is functioning within nominal parameters.'}
            </p>
          </div>

          <div style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(59, 130, 246, 0.06)', borderLeft: '3px solid var(--accent-blue)' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#60A5FA' }}>
              3. Department Governance & Consensus
            </h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {departments.length > 0 
                ? `${departments.length} active department(s) enrolled (${departments.slice(0, 4).map(d => d.name).join(', ')}) with organization consensus trust score of ${metrics.overallTrustScore !== null ? `${metrics.overallTrustScore}/100` : 'Awaiting verification'}.`
                : 'No departments currently registered. Onboard organizational departments to map access controls and asset ownership.'}
            </p>
          </div>
        </div>
      </div>

      {/* AI-Generated Strategic Posture Intelligence */}
      <div 
        className="glass-panel" 
        style={{ 
          padding: '1.75rem', 
          marginTop: '1.5rem',
          border: '1px solid rgba(168, 85, 247, 0.3)',
          background: 'linear-gradient(135deg, rgba(20, 15, 38, 0.8) 0%, rgba(13, 20, 36, 0.9) 100%)',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.08)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '8px', 
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(0, 240, 255, 0.25))',
                border: '1px solid rgba(168, 85, 247, 0.4)',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#C084FC'
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  AI Strategic Posture & Synthesis
                </h3>
                <span 
                  className="badge" 
                  style={{ 
                    background: 'rgba(168, 85, 247, 0.15)', 
                    color: '#C084FC', 
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em'
                  }}
                >
                  AI-generated analysis
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.2rem' }}>
                Continuous organizational risk intelligence synthesized using TrustSphere AI layer
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Cpu size={16} color="var(--accent-cyan)" />
              Executive Posture Summary
            </h4>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Organization currently maintains a consensus trust score of <strong style={{ color: 'var(--accent-cyan)' }}>{metrics.overallTrustScore !== null ? `${metrics.overallTrustScore}/100` : 'Awaiting verification'}</strong> across {metrics.totalAssets} monitored asset(s) and {departments.length} department(s). {metrics.highRiskAssets > 0 ? `Attention is required for ${metrics.highRiskAssets} asset(s) identified with elevated anomaly indicators.` : 'No critical deviations detected in recent cryptographic or structural envelopes.'}
            </p>
          </div>

          <div style={{ padding: '1.15rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#C084FC', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} color="#C084FC" />
              Automated AI Governance Guidance
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>Ensure mailbox intake rules mandate dual-layer MIME verification for external vendors.</li>
              <li>Verify isolation boundaries across high-volume departments ({departments.slice(0, 2).map(d => d.name).join(', ') || 'Finance & HR'}).</li>
              <li>Regularly review digital twin simulation metrics to anticipate credential risk drift.</li>
            </ul>
          </div>
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.75rem' }}>
          Note: Raw trust scores, anomaly boundaries, and risk classifications are evaluated by the 7-layer verification pipeline. AI layer provides cognitive intelligence and contextual recommendations.
        </div>
      </div>
    </div>
  );
}
