import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  ExternalLink, 
  FileText, 
  Clock, 
  Building2, 
  Lock, 
  Hash, 
  Activity, 
  Layers,
  Sparkles,
  Mail
} from 'lucide-react';

import { useSecurity, mapBackendAsset } from '../context/SecurityContext';
import { useToast } from '../context/ToastContext';
import { assetsApi, aiApi } from '../utils/api';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import RiskBadge from '../components/common/RiskBadge';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';

export default function AssetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { assets, incidents, logActivity } = useSecurity();
  const { addToast } = useToast();

  const [fetchedAsset, setFetchedAsset] = useState(null);
  const [directLoading, setDirectLoading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [liveAiResult, setLiveAiResult] = useState(null);
  const [backendRecommendations, setBackendRecommendations] = useState([]);

  // Find asset in SecurityContext state
  const contextAsset = assets.find((a) => a.id === id || a.asset_id === id);

  // Fetch full verification and trust score details from MongoDB via FastAPI
  useEffect(() => {
    if (id) {
      if (!contextAsset) setDirectLoading(true);
      assetsApi.getAsset(id)
        .then((res) => {
          if (res?.data?.asset) {
            const ver = res.data.verification;
            const builtChecks = ver
              ? Object.entries(ver)
                  .filter(([k]) => k.startsWith('layer_'))
                  .map(([k, v]) => ({
                    name: k.replace(/^layer_\d+_/, '').replace(/_/g, ' ').toUpperCase(),
                    passed: (v?.score ?? v?.trust_score ?? 0) >= 60,
                    detail: v?.status || v?.message || (v?.error ? `Flagged: ${v.error}` : `Layer score: ${v?.score ?? v?.trust_score ?? 'N/A'}`)
                  }))
              : null;
            const fullDoc = {
              ...res.data.asset,
              checks: builtChecks && builtChecks.length > 0 ? builtChecks : res.data.asset.checks,
              factors: res.data.trust_score?.factors || res.data.asset.factors || null
            };
            setFetchedAsset(mapBackendAsset(fullDoc));
          }
          if (Array.isArray(res?.data?.recommendations)) {
            const list = res.data.recommendations.map(r => r.recommendation || r).filter(Boolean);
            if (list.length > 0) setBackendRecommendations(list);
          }
        })
        .catch((err) => {
          console.warn('[AssetDetails] Could not fetch asset directly:', err);
        })
        .finally(() => setDirectLoading(false));
    }
  }, [id]);

  const asset = fetchedAsset || contextAsset;

  if (directLoading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div className="animate-spin" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          <RotateCw size={28} color="var(--accent-cyan)" />
        </div>
        <p>Loading asset intelligence from TrustSphere vault...</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <EmptyState 
        icon={Layers}
        title="Asset Not Found"
        description={`The asset with identifier '${id}' could not be located in the current workspace.`}
        action={
          <button onClick={() => navigate('/assets')} className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Return to Assets Registry</span>
          </button>
        }
      />
    );
  }

  // Related incident lookup
  const relatedIncident = incidents.find(
    (inc) => inc.id === asset.relatedIncidentId || inc.relatedAssetId === asset.id || inc.incident_id === asset.relatedIncidentId
  );

  const handleReanalyze = async () => {
    setReanalyzing(true);
    addToast(`Re-running cryptographic verification and integrity pipeline on ${asset.name}...`, 'info');

    try {
      const res = await assetsApi.reanalyzeAsset(asset.id);
      if (res?.success && res?.data) {
        const reanalyzed = mapBackendAsset({ ...asset, ...res.data });
        setFetchedAsset(reanalyzed);
        addToast(`Re-analysis complete for ${asset.name}. Verified score: ${reanalyzed.trustScore}/100.`, 'success');
        logActivity('Asset re-analyzed', asset.name, `Integrity re-verified. Score: ${reanalyzed.trustScore}/100`, 'SUCCESS', asset.id);
      } else {
        throw new Error(res?.message || 'Re-analysis failed');
      }
    } catch (err) {
      addToast(`Re-analysis error: ${err.message}`, 'error');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleAiExplainAnalysis = async () => {
    setAiAnalyzing(true);
    addToast(`Generating Groq AI Decision Intelligence (openai/gpt-oss-20b) for ${asset.name}...`, 'info');
    try {
      const res = await aiApi.analyzeAsset(asset.id);
      if (res?.success && res?.data) {
        setLiveAiResult(res.data);
        addToast('AI Decision Intelligence explanation generated.', 'success');
      }
    } catch (err) {
      addToast(`AI analysis error: ${err.message}`, 'error');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const aiData = liveAiResult || asset.ai_insights;
  const isDemoEmail = Boolean(asset.is_demo || asset.email_metadata?.is_demo || asset.email_metadata?.simulated);

  const rawFactors = asset.factors || {};
  const factorList = [
    { label: "File Integrity", value: rawFactors.integrity ?? null },
    { label: "Metadata Validation", value: rawFactors.metadata ?? null },
    { label: "Document Structure", value: rawFactors.structure ?? null },
    { label: "Content Consistency", value: rawFactors.content ?? rawFactors.contentConsistency ?? null },
    { label: "Privacy / PII Check", value: rawFactors.privacy ?? rawFactors.sourceReliability ?? null },
    { label: "Anomaly Detection", value: rawFactors.anomaly ?? rawFactors.historicalBehaviour ?? null }
  ].filter(f => f.value !== null && f.value !== undefined);

  return (
    <div>
      {/* Top action bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button onClick={() => navigate('/assets')} className="btn btn-ghost">
          <ArrowLeft size={16} />
          <span>Back to Assets</span>
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {relatedIncident && (
            <Link to={`/incidents/${relatedIncident.id}`} className="btn btn-danger">
              <AlertTriangle size={16} />
              <span>View Incident ({relatedIncident.id})</span>
            </Link>
          )}

          <button 
            onClick={handleAiExplainAnalysis} 
            className="btn btn-primary"
            disabled={aiAnalyzing}
          >
            <Sparkles size={16} className={aiAnalyzing ? "animate-spin" : ""} />
            <span>{aiAnalyzing ? "Analyzing via Groq..." : "AI Explain Analysis"}</span>
          </button>

          <button 
            onClick={handleReanalyze} 
            className="btn btn-secondary"
            disabled={reanalyzing}
          >
            <RotateCw size={16} className={reanalyzing ? "animate-spin" : ""} />
            <span>{reanalyzing ? "Scanning..." : "Re-analyze Asset"}</span>
          </button>
        </div>
      </div>

      {/* Main Asset Header Card */}
      <div className="glass-panel" style={{ padding: '2rem', marginBottom: '1.5rem', position: 'relative', overflow: 'hidden' }}>
        <div 
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: asset.risk === 'LOW' 
              ? 'linear-gradient(90deg, #10B981, #00F0FF)' 
              : asset.risk === 'MEDIUM' 
              ? 'linear-gradient(90deg, #F59E0B, #3B82F6)' 
              : 'linear-gradient(90deg, #EF4444, #F97316)'
          }} 
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
            <div 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '14px',
                background: 'rgba(0, 240, 255, 0.08)',
                border: '1px solid var(--border-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}
            >
              <FileText size={32} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {asset.name}
                </h1>
                <StatusBadge status={asset.status} />
                {isDemoEmail && (
                  <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.7rem' }}>
                    DEMO EMAIL INGESTION
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                <span className="font-mono">{asset.id}</span>
                <span>•</span>
                <span>Type: {asset.type}</span>
                <span>•</span>
                <span>Size: {asset.size}</span>
                <span>•</span>
                <span>Department: {asset.department}</span>
              </div>
            </div>
          </div>

          {/* Trust Score circular display */}
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              padding: '0.85rem 1.5rem',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Trust Score
              </div>
              <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                {asset.trustScore}
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/100</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <TrustScoreBadge score={asset.trustScore} showScore={false} />
              <RiskBadge risk={asset.risk} />
            </div>
          </div>
        </div>
      </div>

      {/* AI-Generated Security Intelligence Layer */}
      {aiData && (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '1.75rem', 
            marginBottom: '1.5rem', 
            position: 'relative', 
            overflow: 'hidden',
            border: '1px solid rgba(0, 240, 255, 0.3)',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(6, 9, 17, 0.95))'
          }}
        >
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '1.25rem',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  backgroundColor: 'rgba(0, 240, 255, 0.12)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)'
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Decision Trust AI Security Intelligence
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Controlled analytical reasoning grounded in 7-layer telemetry (Facts vs Inferences vs Recommendations)
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span 
                className="badge" 
                style={{ 
                  fontSize: '0.7rem', 
                  backgroundColor: 'rgba(0, 240, 255, 0.12)', 
                  color: 'var(--accent-cyan)',
                  border: '1px solid var(--border-glow)'
                }}
              >
                <Sparkles size={11} style={{ marginRight: '4px' }} />
                AI-generated analysis
              </span>
              <span className="badge badge-highly-trusted font-mono" style={{ fontSize: '0.7rem' }}>
                {aiData.provider || 'Groq'} ({aiData.model_used || aiData.model || 'openai/gpt-oss-20b'})
              </span>
            </div>
          </div>

          {/* Security Summary Box */}
          <div 
            style={{ 
              padding: '1rem 1.25rem', 
              backgroundColor: 'rgba(0, 240, 255, 0.04)', 
              borderRadius: 'var(--radius-sm)', 
              borderLeft: '4px solid var(--accent-cyan)',
              marginBottom: '1.25rem'
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              Executive Security Summary
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5, marginTop: '0.35rem', margin: 0 }}>
              {aiData.summary || aiData.security_summary}
            </p>
          </div>

          {/* Key Findings & Reasoning */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, marginBottom: '0.5rem' }}>
                Observed Facts (Telemetry)
              </div>
              {aiData.facts && aiData.facts.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {aiData.facts.map((f, idx) => <li key={idx}>{f}</li>)}
                </ul>
              ) : (
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  {aiData.human_readable_reason || aiData.reasoning}
                </p>
              )}
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, marginBottom: '0.5rem' }}>
                Analytical Inferences & Reasoning
              </div>
              {aiData.inferences && aiData.inferences.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {aiData.inferences.map((inf, idx) => <li key={idx}>{inf}</li>)}
                </ul>
              ) : (
                <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: 0 }}>
                  {aiData.reasoning || aiData.risk_explanation}
                </p>
              )}
            </div>

            <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.72rem', color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, marginBottom: '0.5rem' }}>
                Key Findings & Recommendations
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {(aiData.recommendations || aiData.recommended_actions || aiData.key_findings || []).slice(0, 4).map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Email Ingestion Provenance Card */}
      {asset.email_metadata && (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '1.25rem 1.5rem', 
            marginBottom: '1.5rem',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            backgroundColor: 'rgba(59, 130, 246, 0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={18} color="#60A5FA" />
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Automatic Email Ingestion Provenance
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {isDemoEmail && (
                <span className="badge" style={{ fontSize: '0.68rem', backgroundColor: 'rgba(245, 158, 11, 0.18)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.35)' }}>
                  DEMO MODE RECORD
                </span>
              )}
              <span className="badge" style={{ fontSize: '0.68rem', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                TRACEABLE EMAIL GATEWAY
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', fontSize: '0.8rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Sender:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>{asset.email_metadata.sender}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Email Subject:</span>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '0.15rem' }}>{asset.email_metadata.subject}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Message ID:</span>
              <div className="font-mono" style={{ color: 'var(--accent-cyan)', marginTop: '0.15rem', wordBreak: 'break-all' }}>{asset.email_metadata.message_id}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Received Date:</span>
              <div style={{ color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{asset.email_metadata.received_time}</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Trust Factors Progress */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={18} color="var(--accent-cyan)" />
            Trust Analysis Factors
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {factorList.map((factor) => {
              const val = factor.value;
              const barColor = val >= 80 ? 'var(--trust-75)' : val >= 60 ? 'var(--trust-60)' : 'var(--trust-0)';
              return (
                <div key={factor.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', marginBottom: '0.35rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{factor.label}</span>
                    <span className="font-mono" style={{ fontWeight: 600, color: barColor }}>
                      {val} / 100
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '7px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div 
                      style={{
                        width: `${val}%`,
                        height: '100%',
                        backgroundColor: barColor,
                        borderRadius: '4px',
                        boxShadow: `0 0 8px ${barColor}`
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Verification Checks */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShieldCheck size={18} color="var(--accent-cyan)" />
            Verification Checks & Diagnostics
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            {(asset.checks || []).map((chk, i) => (
              <div 
                key={i}
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: chk.passed ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.08)',
                  border: chk.passed ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start'
                }}
              >
                {chk.passed ? (
                  <CheckCircle2 size={18} color="var(--trust-75)" style={{ flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <AlertCircle size={18} color="var(--trust-0)" style={{ flexShrink: 0, marginTop: '2px' }} />
                )}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: chk.passed ? '#34D399' : '#F87171' }}>
                    {chk.name}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem', lineHeight: 1.4 }}>
                    {chk.detail}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cryptographic Provenance & Anomalies */}
      <div className="grid-2col" style={{ marginBottom: '1.5rem' }}>
        {/* Provenance */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Hash size={18} color="var(--accent-cyan)" />
            Cryptographic Integrity & Provenance
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.825rem' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>SHA-256 Digest:</span>
              <div className="font-mono" style={{ padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--accent-cyan)', marginTop: '0.25rem', wordBreak: 'break-all' }}>
                {asset.hash}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Origin Source System:</span>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.15rem' }}>{asset.source}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Uploaded By:</span>
              <div style={{ color: 'var(--text-primary)', fontWeight: 500, marginTop: '0.15rem' }}>{asset.uploader || 'Enterprise Gateway'}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Ingestion Timestamp:</span>
              <div className="font-mono" style={{ color: 'var(--text-primary)', marginTop: '0.15rem' }}>{asset.date}</div>
            </div>
          </div>
        </div>

        {/* Anomalies & Recommendations */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--trust-60)" />
            Anomalies & Security Recommendations
          </h3>

          {asset.anomalies && asset.anomalies.length > 0 ? (
            <div style={{ marginBottom: '1.25rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F87171', textTransform: 'uppercase' }}>
                Flagged Discrepancies
              </span>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {asset.anomalies.map((anom, idx) => (
                  <li key={idx} style={{ fontSize: '0.8rem', color: '#F87171', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                    <span>⚠</span>
                    <span>{anom}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#34D399', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              ✓ No behavioral or structural anomalies discovered during analysis.
            </div>
          )}

          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
              Recommended Governance Actions
            </span>
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {(liveAiResult?.recommendations?.length > 0
                ? liveAiResult.recommendations
                : backendRecommendations.length > 0
                ? backendRecommendations
                : (asset.recommendations || [])
              ).map((rec, idx) => (
                <li key={idx} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                  <span style={{ color: 'var(--accent-cyan)' }}>•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
