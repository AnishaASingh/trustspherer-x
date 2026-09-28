import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import FileUploader from '../components/upload/FileUploader';
import ScanningModal from '../components/upload/ScanningModal';
import { useSecurity } from '../context/SecurityContext';

export default function UploadAsset() {
  const navigate = useNavigate();
  const { uploadAndAnalyzeAsset } = useSecurity();

  const [activeAssetData, setActiveAssetData] = useState(null);
  const [scanningOpen, setScanningOpen] = useState(false);

  const handleStartAnalysis = (assetInput) => {
    setActiveAssetData(assetInput);
    setScanningOpen(true);
  };

  const handleCompleteScan = async (assetInput) => {
    return await uploadAndAnalyzeAsset(assetInput);
  };

  const handleViewDetails = (assetId) => {
    setScanningOpen(false);
    navigate(`/assets/${assetId}`);
  };

  const handleViewAssets = () => {
    setScanningOpen(false);
    navigate('/assets');
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(0, 240, 255, 0.08)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--accent-cyan)',
            fontSize: '0.78rem',
            fontWeight: 600,
            marginBottom: '0.75rem',
            letterSpacing: '0.04em'
          }}
        >
          <Sparkles size={14} />
          <span>CRYPTOGRAPHIC INGESTION & HEURISTIC SCANNER</span>
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Upload Digital Asset
        </h1>
        <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '580px', margin: '0.5rem auto 0 auto' }}>
          Upload a digital asset to perform TrustSphere security and trust analysis.
        </p>
      </div>

      {/* Main File Uploader */}
      <FileUploader onStartAnalysis={handleStartAnalysis} />

      {/* Multi-stage Cyber Security Scanning Modal */}
      <ScanningModal 
        isOpen={scanningOpen}
        assetData={activeAssetData}
        onComplete={handleCompleteScan}
        onViewDetails={handleViewDetails}
        onViewAssets={handleViewAssets}
      />
    </div>
  );
}
