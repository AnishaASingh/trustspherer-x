import React, { useState, useRef } from 'react';
import { UploadCloud, File, CheckCircle2, AlertCircle, X, ArrowRight, Shield } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'doc', 'eml', 'txt', 'crt', 'pem', 'json'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export default function FileUploader({ onStartAnalysis }) {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileProgress, setFileProgress] = useState(0);
  const [department, setDepartment] = useState('Finance');
  const [category, setCategory] = useState('Invoice');
  const [source, setSource] = useState('Enterprise ERP Gateway');
  const [errorMsg, setErrorMsg] = useState('');

  const validateAndSelectFile = (file) => {
    setErrorMsg('');
    if (!file) return;

    // Check size (10 MB limit)
    if (file.size > MAX_SIZE_BYTES) {
      const err = `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 10 MB limit.`;
      setErrorMsg(err);
      addToast(err, 'error');
      return;
    }

    // Check extension
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const err = `File type '.${ext}' is not supported. Please upload PDF, DOCX, PNG, JPG, EML, or CRT files.`;
      setErrorMsg(err);
      addToast(err, 'error');
      return;
    }

    // Guess category from name/ext
    if (ext === 'pdf') {
      if (file.name.toLowerCase().includes('invoice')) setCategory('Invoice');
      else if (file.name.toLowerCase().includes('contract') || file.name.toLowerCase().includes('sla')) setCategory('Contract');
      else setCategory('PDF');
    } else if (ext === 'eml') {
      setCategory('Email');
    } else if (ext === 'crt' || ext === 'pem') {
      setCategory('Certificate');
    } else if (['png', 'jpg', 'jpeg'].includes(ext)) {
      setCategory('Screenshot');
    }

    setSelectedFile(file);

    // Simulate instant local load progress
    setFileProgress(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 25;
      setFileProgress(Math.min(current, 100));
      if (current >= 100) clearInterval(interval);
    }, 40);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelectFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setFileProgress(0);
    setErrorMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Please select a file to upload.");
      return;
    }

    const formattedSize = selectedFile.size > 1024 * 1024 
      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(selectedFile.size / 1024)} KB`;

    onStartAnalysis({
      file: selectedFile,
      name: selectedFile.name,
      size: formattedSize,
      type: category,
      department,
      source
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <form onSubmit={handleSubmit}>
        {/* Drag & Drop Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent-cyan)' : 'var(--border-medium)'}`,
            borderRadius: 'var(--radius-lg)',
            backgroundColor: dragActive ? 'rgba(0, 240, 255, 0.05)' : 'var(--bg-glass)',
            padding: '3rem 2rem',
            textAlign: 'center',
            cursor: selectedFile ? 'default' : 'pointer',
            transition: 'all var(--transition-normal)',
            position: 'relative',
            marginBottom: '1.5rem'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleInputChange}
            style={{ display: 'none' }}
            accept=".pdf,.png,.jpg,.jpeg,.docx,.doc,.eml,.txt,.crt,.pem,.json"
          />

          {!selectedFile ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
              <div 
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(0, 240, 255, 0.1)',
                  border: '1px solid rgba(0, 240, 255, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-cyan)',
                  marginBottom: '0.5rem'
                }}
              >
                <UploadCloud size={32} />
              </div>

              <h4 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Upload Digital Asset
              </h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Drag & Drop files here, or <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, textDecoration: 'underline' }}>Browse Files</span>
              </p>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Supported: PDF, PNG, JPG, DOCX, EML, CRT • Maximum file size: 10 MB
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div 
                    style={{
                      padding: '0.75rem',
                      borderRadius: 'var(--radius-md)',
                      background: 'rgba(0, 240, 255, 0.1)',
                      border: '1px solid rgba(0, 240, 255, 0.3)',
                      color: 'var(--accent-cyan)'
                    }}
                  >
                    <File size={28} />
                  </div>
                  <div>
                    <h5 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {selectedFile.name}
                    </h5>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: '1rem', marginTop: '0.2rem' }}>
                      <span>Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                      <span>Type: {selectedFile.name.split('.').pop().toUpperCase()}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleClear}
                  className="btn-ghost"
                  style={{ padding: '0.5rem', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
                  title="Remove file"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  <span>Buffering asset into memory</span>
                  <span className="font-mono">{fileProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div 
                    style={{
                      width: `${fileProgress}%`,
                      height: '100%',
                      backgroundColor: 'var(--accent-cyan)',
                      borderRadius: '3px',
                      transition: 'width 0.1s ease'
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div 
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              color: '#F87171',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem'
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Metadata Configuration */}
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h5 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Shield size={16} color="var(--accent-cyan)" />
            Asset Metadata & Governance Classification
          </h5>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Department</label>
              <select 
                className="input-field" 
                value={department} 
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="Finance">Finance</option>
                <option value="HR">HR</option>
                <option value="IT">IT</option>
                <option value="Operations">Operations</option>
                <option value="Legal & Compliance">Legal & Compliance</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Asset Category</label>
              <select 
                className="input-field" 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="Invoice">Invoice</option>
                <option value="Contract">Contract</option>
                <option value="Certificate">Certificate</option>
                <option value="Report">Report</option>
                <option value="PDF">PDF</option>
                <option value="Email">Email</option>
                <option value="Image">Image</option>
                <option value="Screenshot">Screenshot</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Source System</label>
              <input 
                type="text" 
                className="input-field" 
                value={source} 
                onChange={(e) => setSource(e.target.value)} 
                placeholder="e.g. ERP Gateway, S3, Email Intake"
                required
              />
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="submit" 
            className="btn btn-primary btn-lg"
            disabled={!selectedFile || fileProgress < 100}
            style={{ minWidth: '200px' }}
          >
            <span>Analyze Asset</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
