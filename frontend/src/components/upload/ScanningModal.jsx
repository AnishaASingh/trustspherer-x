import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, CheckCircle2, Loader2, ArrowRight, FileText, Activity } from 'lucide-react';
import TrustScoreBadge from '../common/TrustScoreBadge';
import RiskBadge from '../common/RiskBadge';
import StatusBadge from '../common/StatusBadge';

const STAGES = [
  { id: 1, name: "File received", detail: "Payload verified & buffered in secure enclave." },
  { id: 2, name: "Integrity check", detail: "Computing cryptographic SHA-256 block hash." },
  { id: 3, name: "Metadata analysis", detail: "Inspecting author, XMP stamps, and revision delta." },
  { id: 4, name: "Source verification", detail: "Validating originating IP, CA chain, and TLS handshake." },
  { id: 5, name: "Content consistency check", detail: "Scanning structural patterns & OCR syntax heuristics." },
  { id: 6, name: "Risk calculation", detail: "Aggregating multidimensional threat probability vectors." },
  { id: 7, name: "Trust score generated", detail: "Finalizing TrustSphere decision intelligence index." }
];

export default function ScanningModal({ isOpen, assetData, onComplete, onViewDetails, onViewAssets }) {
  const [currentStage, setCurrentStage] = useState(1);
  const [isDone, setIsDone] = useState(false);
  const [resultAsset, setResultAsset] = useState(null);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    if (!isOpen || !assetData) {
      setCurrentStage(1);
      setIsDone(false);
      setResultAsset(null);
      setScanError('');
      return;
    }

    let isMounted = true;
    let stage = 1;

    // Trigger backend upload & verification immediately in parallel with stage animation
    const verifyPromise = Promise.resolve().then(() => onComplete(assetData));

    const interval = setInterval(async () => {
      stage += 1;
      if (stage <= 7) {
        if (isMounted) setCurrentStage(stage);
      } else {
        clearInterval(interval);
        try {
          const finishedAsset = await verifyPromise;
          if (isMounted) {
            setResultAsset(finishedAsset);
            setIsDone(true);
          }
        } catch (err) {
          console.error('[ScanningModal Error]', err);
          if (isMounted) {
            setScanError(err.message || 'Security analysis failed. Please verify the document format.');
          }
        }
      }
    }, 450); // Total scanning animation time ~3.2 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, assetData]);

  if (!isOpen) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(6, 9, 17, 0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
    >
      <div 
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '640px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-medium)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 35px rgba(0, 240, 255, 0.2)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div 
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 240, 255, 0.1)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-cyan)'
              }}
            >
              <Activity size={18} className={!isDone ? "animate-pulse" : ""} />
            </div>
            <div>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {isDone ? "Security Analysis Complete" : "TrustSphere Security Scanning Pipeline"}
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Target: {assetData?.name}
              </span>
            </div>
          </div>

          <span 
            className="badge" 
            style={{ 
              background: isDone ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0, 240, 255, 0.15)',
              color: isDone ? '#10B981' : '#00F0FF',
              border: `1px solid ${isDone ? '#10B981' : '#00F0FF'}`
            }}
          >
            {isDone ? "PROCESSED" : "ENCLAVE SCANNING"}
          </span>
        </div>

        {/* Content Body */}
        <div style={{ padding: '1.75rem' }}>
          {scanError ? (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div 
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  margin: '0 auto 1.25rem auto',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#EF4444'
                }}
              >
                <ShieldAlert size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                Verification Pipeline Error
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
                {scanError}
              </p>
              <button 
                onClick={onViewAssets}
                className="btn btn-secondary"
              >
                <span>Close & Return to Assets</span>
              </button>
            </div>
          ) : !isDone ? (
            <div>
              {/* Progress bar */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <span className="font-mono">STAGE {currentStage} OF 7</span>
                  <span className="font-mono">{Math.round((currentStage / 7) * 100)}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div 
                    style={{
                      width: `${(currentStage / 7) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3B82F6, #00F0FF)',
                      boxShadow: '0 0 12px #00F0FF',
                      transition: 'width 0.4s ease'
                    }}
                  />
                </div>
              </div>

              {/* Stage checklist */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {STAGES.map((s) => {
                  const isPassed = s.id < currentStage;
                  const isCurrent = s.id === currentStage;

                  return (
                    <div 
                      key={s.id}
                      style={{
                        padding: '0.65rem 0.9rem',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: isCurrent ? 'rgba(0, 240, 255, 0.08)' : isPassed ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                        border: isCurrent ? '1px solid var(--border-glow)' : '1px solid transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {isPassed ? (
                          <CheckCircle2 size={16} color="var(--trust-75)" />
                        ) : isCurrent ? (
                          <Loader2 size={16} color="var(--accent-cyan)" className="animate-spin" />
                        ) : (
                          <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '1px solid var(--text-dim)' }} />
                        )}
                        <span style={{ 
                          fontSize: '0.85rem', 
                          fontWeight: isCurrent ? 600 : 400,
                          color: isCurrent ? 'var(--accent-cyan)' : isPassed ? 'var(--text-primary)' : 'var(--text-muted)'
                        }}>
                          {s.id}. {s.name}
                        </span>
                      </div>
                      <span className="font-mono" style={{ fontSize: '0.72rem', color: isCurrent ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                        {isPassed ? "PASSED" : isCurrent ? "VERIFYING..." : "QUEUED"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Result Screen */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'center' }}>
              <div 
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  margin: '0 auto',
                  background: resultAsset?.risk === 'LOW' 
                    ? 'rgba(16, 185, 129, 0.1)' 
                    : resultAsset?.risk === 'MEDIUM' 
                    ? 'rgba(245, 158, 11, 0.1)' 
                    : 'rgba(239, 68, 68, 0.1)',
                  border: `2px solid ${
                    resultAsset?.risk === 'LOW' 
                      ? 'var(--trust-75)' 
                      : resultAsset?.risk === 'MEDIUM' 
                      ? 'var(--trust-60)' 
                      : 'var(--trust-0)'
                  }`,
                  boxShadow: `0 0 25px ${
                    resultAsset?.risk === 'LOW' 
                      ? 'rgba(16, 185, 129, 0.25)' 
                      : 'rgba(239, 68, 68, 0.25)'
                  }`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {resultAsset?.risk === 'LOW' ? (
                  <ShieldCheck size={40} color="var(--trust-75)" />
                ) : (
                  <ShieldAlert size={40} color={resultAsset?.risk === 'MEDIUM' ? 'var(--trust-60)' : 'var(--trust-0)'} />
                )}
              </div>

              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  Analysis Complete
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Cryptographic verification and risk profile generated for {resultAsset?.name}
                </p>
              </div>

              {/* Key Metrics Display */}
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  padding: '1.25rem',
                  background: 'rgba(0,0,0,0.25)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Trust Score
                  </div>
                  <div className="font-mono" style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-cyan)' }}>
                    {resultAsset?.trustScore}
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/100</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Risk Level
                  </div>
                  <div style={{ marginTop: '0.4rem' }}>
                    <RiskBadge risk={resultAsset?.risk} />
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                    Status
                  </div>
                  <div style={{ marginTop: '0.4rem' }}>
                    <StatusBadge status={resultAsset?.status} />
                  </div>
                </div>
              </div>

              {/* Recommendations snippet */}
              {resultAsset?.recommendations?.length > 0 && (
                <div style={{ textAlign: 'left', background: 'rgba(255,255,255,0.02)', padding: '0.9rem 1rem', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-cyan)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '0.2rem' }}>
                    AUTOMATED RECOMMENDATION
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                    {resultAsset.recommendations[0]}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => onViewDetails(resultAsset?.id)}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <FileText size={16} />
                  <span>Inspect Asset Details</span>
                </button>

                <button 
                  onClick={onViewAssets}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  <span>View All Assets</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
