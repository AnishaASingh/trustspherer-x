import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldAlert, 
  FileText, 
  ExternalLink,
  Check,
  XCircle,
  AlertCircle,
  RotateCw,
  Sparkles
} from 'lucide-react';
import { useSecurity, mapBackendIncident } from '../context/SecurityContext';
import { useToast } from '../context/ToastContext';
import { incidentsApi, aiApi } from '../utils/api';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';

export default function IncidentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { incidents, updateIncidentStatus } = useSecurity();
  const { addToast } = useToast();

  const [directIncident, setDirectIncident] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);

  const contextIncident = incidents.find((i) => i.id === id || i.incident_id === id);

  useEffect(() => {
    if (!contextIncident && id) {
      setDirectLoading(true);
      incidentsApi.getIncident(id)
        .then(res => {
          if (res?.data) {
            setDirectIncident(mapBackendIncident(res.data));
          }
        })
        .catch(err => {
          console.warn('[IncidentDetails] Direct incident fetch failed:', err);
        })
        .finally(() => setDirectLoading(false));
    }
  }, [id, contextIncident]);

  const incident = contextIncident || directIncident;

  if (directLoading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          <RotateCw size={28} color="var(--accent-cyan)" />
        </div>
        <p>Loading incident details from database...</p>
      </div>
    );
  }

  if (!incident) {
    return (
      <EmptyState 
        icon={AlertTriangle}
        title="Incident Not Found"
        description={`The security incident with ticket '${id}' does not exist.`}
        action={
          <button onClick={() => navigate('/incidents')} className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Return to Incidents</span>
          </button>
        }
      />
    );
  }

  const handleStatusChange = (newStatus) => {
    updateIncidentStatus(incident.id, newStatus, `Action executed by operator.`);
  };

  const handleAiAnalyzeIncident = async () => {
    setAiAnalyzing(true);
    addToast(`Running Groq AI Root-Cause & Remediation Analysis on ${incident.id}...`, 'info');
    try {
      const res = await aiApi.analyzeIncident(incident.id);
      if (res?.success && res?.data) {
        setAiAnalysis(res.data);
        addToast('AI Incident root-cause analysis complete.', 'success');
      }
    } catch (err) {
      addToast(`AI Incident analysis error: ${err.message}`, 'error');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const timelineSteps = Array.isArray(incident.timeline) ? incident.timeline : [];

  return (
    <div>
      {/* Top back & actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button onClick={() => navigate('/incidents')} className="btn btn-ghost">
          <ArrowLeft size={16} />
          <span>Back to Incidents</span>
        </button>

        {/* State Transition & AI Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleAiAnalyzeIncident}
            className="btn btn-primary"
            disabled={aiAnalyzing}
          >
            <Sparkles size={16} className={aiAnalyzing ? "animate-spin" : ""} />
            <span>{aiAnalyzing ? "Analyzing Incident..." : "AI Analyze Incident"}</span>
          </button>

          {incident.status !== 'UNDER INVESTIGATION' && incident.status !== 'RESOLVED' && (
            <button 
              onClick={() => handleStatusChange('UNDER INVESTIGATION')} 
              className="btn btn-secondary"
            >
              <Clock size={16} />
              <span>Mark Under Investigation</span>
            </button>
          )}

          {incident.status !== 'RESOLVED' && (
            <button 
              onClick={() => handleStatusChange('RESOLVED')} 
              className="btn btn-success"
            >
              <CheckCircle2 size={16} />
              <span>Resolve Incident</span>
            </button>
          )}

          {incident.status !== 'DISMISSED' && (
            <button 
              onClick={() => handleStatusChange('DISMISSED')} 
              className="btn btn-ghost"
              style={{ color: 'var(--text-muted)' }}
            >
              <XCircle size={16} />
              <span>Dismiss Incident</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Incident Card */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: incident.severity === 'CRITICAL' ? 'var(--trust-0)' : incident.severity === 'HIGH' ? 'var(--trust-40)' : 'var(--trust-60)'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span className="font-mono badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.4)', fontSize: '0.8rem' }}>
                {incident.id}
              </span>
              <RiskBadge risk={incident.severity} />
              <StatusBadge status={incident.status} />
            </div>

            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              {incident.title}
            </h1>

            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span><strong>Department:</strong> {incident.department}</span>
              <span>•</span>
              <span><strong>Assigned:</strong> {incident.assignedTo || 'SOC Automated Unit'}</span>
              <span>•</span>
              <span><strong>Detected:</strong> {incident.detectedDate}</span>
            </div>
          </div>

          {/* Related Asset Link Box */}
          <div 
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'rgba(0,0,0,0.25)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}
          >
            <div 
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '8px',
                background: 'rgba(0, 240, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}
            >
              <FileText size={20} />
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Target Digital Asset
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {incident.relatedAssetName}
              </div>
              {incident.relatedAssetId && (
                <Link 
                  to={`/assets/${incident.relatedAssetId}`} 
                  style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.15rem' }}
                >
                  <span>Inspect Asset Telemetry</span>
                  <ExternalLink size={12} />
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Incident Root-Cause & Remediation Card */}
      {aiAnalysis && (
        <div
          className="glass-panel"
          style={{
            padding: '1.75rem',
            marginBottom: '1.5rem',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(6, 9, 17, 0.96))'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Sparkles size={20} color="var(--accent-cyan)" />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  AI Incident Root-Cause & Remediation Analysis
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Synthesized from incident timeline, asset verification layers, and department context
                </span>
              </div>
            </div>
            <span className="badge badge-highly-trusted font-mono" style={{ fontSize: '0.7rem' }}>
              {aiAnalysis.provider || 'Groq'} ({aiAnalysis.model_used || 'openai/gpt-oss-20b'})
            </span>
          </div>

          <div
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'rgba(0, 240, 255, 0.04)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: '4px solid var(--accent-cyan)',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Executive Root-Cause Summary
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', margin: '0.35rem 0 0 0', lineHeight: 1.5 }}>
              {aiAnalysis.summary}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Observed Facts
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {(aiAnalysis.facts || aiAnalysis.key_findings || []).map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: '#FBBF24', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Analytical Inferences & Impact
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                {aiAnalysis.reasoning}
              </p>
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: '#34D399', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>
                Recommended Remediation Steps
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {(aiAnalysis.recommendations || []).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Visual Timeline Section */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Clock size={18} color="var(--accent-cyan)" />
          Chronological Forensic Timeline
        </h3>

        <div style={{ position: 'relative', paddingLeft: '2rem' }}>
          {/* Vertical connecting line */}
          <div 
            style={{
              position: 'absolute',
              left: '7px',
              top: '10px',
              bottom: '10px',
              width: '2px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)'
            }} 
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {timelineSteps.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                No timeline events recorded for this incident.
              </div>
            ) : (
              timelineSteps.map((step, idx) => {
                const isCompleted = step.status === 'completed';
                const isActive = step.status === 'active';

                let dotColor = '#64748B';
                if (isCompleted) dotColor = 'var(--trust-75)';
                if (isActive) dotColor = 'var(--accent-cyan)';

                return (
                  <div key={idx} style={{ position: 'relative' }}>
                    {/* Timeline dot */}
                    <div 
                      style={{
                        position: 'absolute',
                        left: '-2rem',
                        top: '2px',
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: isCompleted ? 'var(--trust-75)' : isActive ? 'var(--accent-cyan)' : 'var(--bg-secondary)',
                        border: `2px solid ${dotColor}`,
                        boxShadow: isActive ? '0 0 10px var(--accent-cyan)' : 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {isCompleted && <Check size={10} color="#000" />}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isCompleted || isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {step.step}
                        </span>
                        {step.time && (
                          <span className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {step.time}
                          </span>
                        )}
                        {isActive && (
                          <span className="badge badge-medium" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                            IN PROGRESS
                          </span>
                        )}
                      </div>
                      {step.note && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          {step.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Failures & Risk Assessment */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Verification Failures */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} color="var(--trust-0)" />
            Verification Failures & Trigger Rules
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {Array.isArray(incident.verificationFailures) && incident.verificationFailures.length > 0 ? (
              incident.verificationFailures.map((failure, i) => (
                <div 
                  key={i}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#F87171',
                    fontSize: '0.825rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>{failure}</span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                No explicit verification rule failures attached; see Detection Rationale below.
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.25rem', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            <strong>Detection Rationale:</strong> {incident.reason || 'Automated verification threshold triggered.'}
          </div>
        </div>

        {/* Risk Information & Recommendations */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldAlert size={18} color="var(--accent-cyan)" />
            Risk Telemetry & Mitigation Guidance
          </h3>

          {incident.riskInformation && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Financial Exposure</div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {incident.riskInformation.financialExposure}
                </div>
              </div>
              <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Threat Classification</div>
                <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.95rem', marginTop: '0.2rem' }}>
                  {incident.riskInformation.threatActorType}
                </div>
              </div>
            </div>
          )}

          <div style={{ padding: '1rem', background: 'rgba(0, 240, 255, 0.04)', border: '1px solid var(--border-glow)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
              Authoritative Mitigation Recommendation
            </span>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.35rem', lineHeight: 1.5 }}>
              {incident.recommendation || 'Review linked digital asset verification report and execute department triage protocol.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
