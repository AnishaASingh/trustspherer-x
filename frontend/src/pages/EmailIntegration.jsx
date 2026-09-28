import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Mail, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles, 
  Play, 
  Sliders,
  ExternalLink,
  Inbox,
  Link2,
  Unlink,
  Filter
} from 'lucide-react';
import { ingestionApi } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useSecurity } from '../context/SecurityContext';
import Modal from '../components/common/Modal';
import StatusBadge from '../components/common/StatusBadge';
import TrustScoreBadge from '../components/common/TrustScoreBadge';
import EmptyState from '../components/common/EmptyState';

export default function EmailIntegration() {
  const { addToast } = useToast();
  const { refetch } = useSecurity();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [polling, setPolling] = useState(false);
  const [savingFilters, setSavingFilters] = useState(false);
  const [oauthWorking, setOauthWorking] = useState(false);

  // OAuth Connection State (`email_integrations` MongoDB collection)
  const [oauthState, setOauthState] = useState({
    organization_id: 'ORG-TRUSTSPHERE',
    provider: 'gmail',
    email_address: null,
    status: 'Not Connected',
    is_connected: false,
    oauth_configured: false,
    last_sync_at: null
  });

  // Email Safety & Filtering Rules State
  const [filterForm, setFilterForm] = useState({
    allowed_senders: '',
    subject_keywords: '',
    require_attachment: false,
    allowed_extensions: '.pdf, .docx, .xlsx, .png, .jpg, .jpeg, .txt',
    max_file_size_mb: 10
  });

  // AI & Telemetry status
  const [aiStatus, setAiStatus] = useState(null);
  const [recentEmails, setRecentEmails] = useState([]);
  const [oauthMessage, setOauthMessage] = useState(null);

  // Demo Email Ingestion Modal
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simForm, setSimForm] = useState({
    sender: 'partner.vendor@external-domain.com',
    subject: 'Urgent Wire Transfer & Compliance Documentation',
    body_text: 'Attached is the urgent documentation requested by the executive team. Please confirm immediate processing.',
    department: 'Finance',
    message_id: '',
    file: null
  });

  // Fetch all initial data
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [oauthRes, filtersRes, statusRes, recentRes] = await Promise.allSettled([
        ingestionApi.getOAuthStatus(),
        ingestionApi.getEmailFilters(),
        ingestionApi.getStatus(),
        ingestionApi.getRecentEmails(30)
      ]);

      if (oauthRes.status === 'fulfilled' && oauthRes.value?.data) {
        setOauthState(oauthRes.value.data);
      }

      if (filtersRes.status === 'fulfilled' && filtersRes.value?.data) {
        const r = filtersRes.value.data;
        setFilterForm({
          allowed_senders: Array.isArray(r.allowed_senders) ? r.allowed_senders.join(', ') : '',
          subject_keywords: Array.isArray(r.subject_keywords) ? r.subject_keywords.join(', ') : '',
          require_attachment: Boolean(r.require_attachment),
          allowed_extensions: Array.isArray(r.allowed_extensions) ? r.allowed_extensions.join(', ') : '.pdf, .docx, .xlsx, .png, .jpg, .jpeg, .txt',
          max_file_size_mb: r.max_file_size_mb || 10
        });
      }

      if (statusRes.status === 'fulfilled' && statusRes.value?.data?.ai_intelligence) {
        setAiStatus(statusRes.value.data.ai_intelligence);
      }

      if (recentRes.status === 'fulfilled' && recentRes.value?.data?.recent_emails) {
        setRecentEmails(recentRes.value.data.recent_emails);
      }
    } catch (err) {
      console.error('[EmailIntegration] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Connect Gmail OAuth (REAL MODE)
  const handleConnectGmail = async () => {
    setOauthWorking(true);
    setOauthMessage(null);
    try {
      const res = await ingestionApi.connectGmailOAuth();
      const data = res?.data || res;
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        setOauthMessage({
          type: 'warning',
          text: data?.message || res?.message || 'Google OAuth credentials are not configured in backend/.env. Use Demo Email Ingestion mode below.'
        });
        addToast('Google OAuth credentials not configured in backend/.env. Demo Email Ingestion is ready.', 'info');
      }
    } catch (err) {
      setOauthMessage({
        type: 'warning',
        text: err.message
      });
      addToast(err.message || 'Could not initiate Gmail OAuth.', 'warning');
    } finally {
      setOauthWorking(false);
    }
  };

  // Disconnect Gmail OAuth
  const handleDisconnectGmail = async () => {
    setOauthWorking(true);
    try {
      const res = await ingestionApi.disconnectGmailOAuth();
      if (res?.success && res?.data) {
        setOauthState(res.data);
        setOauthMessage({
          type: 'info',
          text: 'Mailbox disconnected. Status is now Not Connected.'
        });
        addToast('Organization Gmail mailbox disconnected.', 'info');
      }
    } catch (err) {
      addToast(err.message || 'Failed to disconnect mailbox.', 'error');
    } finally {
      setOauthWorking(false);
    }
  };

  // Save Email Safety & Filtering Rules
  const handleSaveFilters = async (e) => {
    e.preventDefault();
    setSavingFilters(true);
    try {
      const res = await ingestionApi.updateEmailFilters({
        allowed_senders: filterForm.allowed_senders,
        subject_keywords: filterForm.subject_keywords,
        require_attachment: filterForm.require_attachment,
        allowed_extensions: filterForm.allowed_extensions,
        max_file_size_mb: parseInt(filterForm.max_file_size_mb, 10) || 10
      });
      if (res?.success) {
        addToast('Email safety & filtering rules updated in MongoDB.', 'success');
      }
    } catch (err) {
      addToast(err.message || 'Failed to update filter rules.', 'error');
    } finally {
      setSavingFilters(false);
    }
  };

  // Trigger manual mailbox poll
  const handlePollMailbox = async () => {
    setPolling(true);
    try {
      const res = await ingestionApi.pollEmail('Operations');
      if (res?.success) {
        const count = res.data?.processed_count || 0;
        const msg = res.data?.message || `Mailbox check completed (${count} emails processed).`;
        addToast(msg, count > 0 ? 'success' : 'info');
        fetchData(true);
      }
    } catch (err) {
      addToast(err.message || 'Mailbox scan failed.', 'error');
    } finally {
      setPolling(false);
    }
  };

  // Submit Demo Email Ingestion
  const handleDemoEmailIngestion = async (e) => {
    e.preventDefault();
    setSimulating(true);

    const formData = new FormData();
    formData.append('sender', simForm.sender);
    formData.append('subject', simForm.subject);
    formData.append('body_text', simForm.body_text);
    formData.append('department', simForm.department);
    if (simForm.message_id.trim()) {
      formData.append('message_id', simForm.message_id.trim());
    }
    if (simForm.file) {
      formData.append('file', simForm.file);
    }

    try {
      const res = await ingestionApi.ingestDemoEmail(formData);
      if (res?.success) {
        addToast('[DEMO MODE] Email verified through 7-layer pipeline + Groq AI!', 'success');
        setDemoModalOpen(false);
        setSimForm({
          sender: 'partner.vendor@external-domain.com',
          subject: 'Urgent Wire Transfer & Compliance Documentation',
          body_text: 'Attached is the urgent documentation requested by the executive team. Please confirm immediate processing.',
          department: 'Finance',
          message_id: '',
          file: null
        });
        fetchData(true);
        if (refetch) refetch();
      } else {
        addToast(res?.message || 'Email rejected by safety & filtering rules.', 'warning');
      }
    } catch (err) {
      addToast(err.message || 'Demo email ingestion failed.', 'error');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '2rem', 
          flexWrap: 'wrap', 
          gap: '1rem' 
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Organization Email Integration
            </h1>
            <span className="badge badge-verified" style={{ fontSize: '0.7rem' }}>
              <Mail size={12} style={{ marginRight: '4px' }} />
              OAUTH + DEMO GATEWAY
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Authorize an organization Gmail mailbox via Google OAuth 2.0 or use clearly labelled Demo Email Ingestion to test the full 7-layer verification + Groq AI pipeline.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            onClick={() => fetchData(true)} 
            className="btn btn-secondary"
            disabled={refreshing || loading}
          >
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button 
            onClick={handlePollMailbox} 
            className="btn btn-secondary"
            disabled={polling}
          >
            <Play size={15} className={polling ? 'spin' : ''} />
            <span>{polling ? 'Checking...' : 'Check Mailbox'}</span>
          </button>

          <button 
            onClick={() => setDemoModalOpen(true)} 
            className="btn btn-primary"
          >
            <Send size={15} />
            <span>Demo Email Ingestion</span>
          </button>
        </div>
      </div>

      {/* Status Overview Metric Cards */}
      <div 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
          gap: '1.25rem', 
          marginBottom: '2rem' 
        }}
      >
        {/* Card 1: OAuth Mailbox Status */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            REAL MODE: Gmail OAuth Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span 
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: oauthState.is_connected ? '#10B981' : '#F59E0B',
                boxShadow: oauthState.is_connected ? '0 0 10px #10B981' : '0 0 10px #F59E0B'
              }}
            />
            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {oauthState.status}
            </span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Connected Email: <strong>{oauthState.email_address || 'None'}</strong>
          </div>
        </div>

        {/* Card 2: Demo Mode Status */}
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
          <div style={{ fontSize: '0.75rem', color: '#FBBF24', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>
            DEMO MODE: Prototype Simulator
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem' }}>
            Ready & Active
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Runs identical 7-Layer + Groq AI pipeline
          </div>
        </div>

        {/* Card 3: AI Intelligence Engine */}
        <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(0, 240, 255, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              AI Intelligence Layer
            </div>
            <span 
              className="badge" 
              style={{ 
                fontSize: '0.65rem', 
                backgroundColor: 'rgba(0, 240, 255, 0.1)', 
                color: 'var(--accent-cyan)',
                border: '1px solid var(--border-glow)'
              }}
            >
              <Sparkles size={11} style={{ marginRight: '4px' }} />
              Groq AI
            </span>
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFF', marginTop: '0.5rem' }}>
            {aiStatus?.provider || 'Groq Cloud API'}
          </div>
          <div className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '0.35rem' }}>
            Model: {aiStatus?.model || 'openai/gpt-oss-20b'}
          </div>
        </div>

        {/* Card 4: Ingested Count */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Processed Email Events
          </div>
          <div className="font-mono" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--trust-75)', marginTop: '0.5rem' }}>
            {recentEmails.length} Events Logged
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Traceable in MongoDB & Digital Twin
          </div>
        </div>
      </div>

      {/* Main Grid: OAuth + Safety Rules on Left, Traceable Activity on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(330px, 430px) 1fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: OAuth Connection + Safety & Filtering Rules */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Card A: Organization Email Integration (OAuth) */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={18} color="var(--accent-cyan)" />
              <span>Organization Email Integration</span>
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.45 }}>
              Connect an authorized corporate mailbox using Google OAuth 2.0. Note: <code className="font-mono">admin@trustsphere.com</code> is a TrustSphere platform login and is never automatically treated as a monitored mailbox. No email passwords are requested or stored.
            </p>

            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.82rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.55rem',
                marginBottom: '1.1rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span style={{ fontWeight: 700, color: oauthState.is_connected ? '#34D399' : '#FBBF24' }}>
                  {oauthState.status}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Connected Email:</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {oauthState.email_address || 'Not Connected'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Provider:</span>
                <span style={{ color: 'var(--accent-cyan)', fontWeight: 600, textTransform: 'uppercase' }}>
                  {oauthState.provider || 'Gmail'} (OAuth 2.0)
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Last Sync:</span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {oauthState.last_sync_at ? new Date(oauthState.last_sync_at).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={handleConnectGmail}
                disabled={oauthWorking || oauthState.is_connected}
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Link2 size={15} />
                <span>{oauthWorking ? 'Checking OAuth...' : 'Connect Gmail'}</span>
              </button>

              <button
                type="button"
                onClick={handleDisconnectGmail}
                disabled={oauthWorking || !oauthState.is_connected}
                className="btn btn-secondary"
                style={{ justifyContent: 'center' }}
              >
                <Unlink size={15} />
                <span>Disconnect</span>
              </button>
            </div>

            {oauthMessage && (
              <div
                style={{
                  marginTop: '0.9rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  color: '#FBBF24',
                  fontSize: '0.78rem',
                  lineHeight: 1.45
                }}
              >
                {oauthMessage.text}
              </div>
            )}
          </div>

          {/* Card B: Email Safety & Filtering Rules */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={18} color="var(--accent-cyan)" />
              <span>Email Safety & Filtering Policy</span>
            </h2>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
              TrustSphere filters incoming emails before processing to reject personal mail, unsafe extensions, oversized attachments, and duplicate Message-IDs.
            </p>

            <form onSubmit={handleSaveFilters}>
              <div className="input-group">
                <label className="input-label">Allowed Senders / Domains (Optional, comma-separated)</label>
                <input
                  type="text"
                  className="input-field"
                  value={filterForm.allowed_senders}
                  onChange={(e) => setFilterForm({ ...filterForm, allowed_senders: e.target.value })}
                  placeholder="Leave blank for any, or e.g. @external-domain.com, vendor@corp.com"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Subject Keywords Filter (Optional, comma-separated)</label>
                <input
                  type="text"
                  className="input-field"
                  value={filterForm.subject_keywords}
                  onChange={(e) => setFilterForm({ ...filterForm, subject_keywords: e.target.value })}
                  placeholder="Leave blank for any, or e.g. invoice, audit, contract, urgent"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Allowed Attachment Extensions</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  style={{ fontSize: '0.78rem' }}
                  value={filterForm.allowed_extensions}
                  onChange={(e) => setFilterForm({ ...filterForm, allowed_extensions: e.target.value })}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <label className="input-label">Max File Size (MB)</label>
                  <input
                    type="number"
                    className="input-field"
                    min={1}
                    max={50}
                    value={filterForm.max_file_size_mb}
                    onChange={(e) => setFilterForm({ ...filterForm, max_file_size_mb: e.target.value })}
                  />
                </div>

                <div style={{ paddingTop: '1.1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                    <input
                      type="checkbox"
                      checked={filterForm.require_attachment}
                      onChange={(e) => setFilterForm({ ...filterForm, require_attachment: e.target.checked })}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--accent-cyan)' }}
                    />
                    <span>Require Attachment</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={savingFilters}
              >
                {savingFilters ? 'Saving Policy...' : 'Save Filtering Rules'}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Traceability & Recent Ingested Emails */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Inbox size={18} color="var(--accent-cyan)" />
                <span>Recent Ingested Emails & Traceability</span>
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Full provenance: Mode (REAL vs DEMO), Message-ID, Sender, Subject, Attachments, and Groq AI Verdicts.
              </p>
            </div>
            <button onClick={() => setDemoModalOpen(true)} className="btn btn-primary btn-sm">
              <Send size={14} />
              <span>Run Demo Email Ingestion</span>
            </button>
          </div>

          {recentEmails.length === 0 ? (
            <EmptyState 
              icon={Mail}
              title="No Ingested Emails Yet"
              description="Use 'Demo Email Ingestion' to simulate an incoming organization email with an attachment and run the full 7-layer verification + Groq AI pipeline."
              action={
                <button onClick={() => setDemoModalOpen(true)} className="btn btn-primary btn-sm">
                  <Send size={14} />
                  <span>Demo Email Ingestion</span>
                </button>
              }
            />
          ) : (
            <div className="table-container">
              <table className="cyber-table">
                <thead>
                  <tr>
                    <th>Mode & Sender</th>
                    <th>Subject & Dept</th>
                    <th>Attachments</th>
                    <th>Trust Score</th>
                    <th>Status</th>
                    <th>Groq AI Summary</th>
                    <th>Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEmails.map((item, idx) => {
                    const isDemo = Boolean(item.is_demo || item.simulated || item.ingestion_mode === 'DEMO');
                    return (
                      <tr key={idx}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.62rem',
                                  padding: '0.1rem 0.4rem',
                                  backgroundColor: isDemo ? 'rgba(245, 158, 11, 0.16)' : 'rgba(16, 185, 129, 0.16)',
                                  color: isDemo ? '#FBBF24' : '#34D399',
                                  border: isDemo ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)'
                                }}
                              >
                                {isDemo ? 'DEMO' : 'REAL'}
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                                {item.sender}
                              </span>
                            </div>
                            <span className="font-mono" style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)' }}>
                              {item.message_id || item.email_id}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ maxWidth: '190px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
                            {item.subject}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Dept: {item.department || 'Operations'}
                          </div>
                        </td>

                        <td>
                          {item.attachments && item.attachments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              {item.attachments.map((att, i) => (
                                <span key={i} className="font-mono" style={{ fontSize: '0.74rem', color: 'var(--text-primary)' }}>
                                  📎 {att}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              Body text only
                            </span>
                          )}
                        </td>

                        <td>
                          <TrustScoreBadge score={item.trust_score} size="sm" />
                        </td>

                        <td>
                          <StatusBadge status={item.status} />
                        </td>

                        <td>
                          <div 
                            style={{ 
                              fontSize: '0.76rem', 
                              color: 'var(--text-secondary)', 
                              maxWidth: '250px', 
                              lineHeight: 1.35
                            }}
                          >
                            {item.ai_summary || "Automated 7-layer + Groq AI analysis completed."}
                          </div>
                        </td>

                        <td>
                          {item.asset_id && (
                            <Link 
                              to={`/assets/${item.asset_id}`} 
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--accent-cyan)', padding: '0.35rem 0.6rem' }}
                              title="Inspect full asset verification & Groq AI details"
                            >
                              <ExternalLink size={14} />
                              <span>Asset</span>
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* DEMO EMAIL INGESTION MODAL (SECTION 10) */}
      {/* ============================================================ */}
      <Modal 
        isOpen={demoModalOpen} 
        onClose={() => !simulating && setDemoModalOpen(false)}
        title="DEMO MODE: Simulate Incoming Organization Email"
        maxWidth="640px"
      >
        <form onSubmit={handleDemoEmailIngestion}>
          <div style={{ padding: '0.85rem 1rem', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.35)', borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#FBBF24', lineHeight: 1.45 }}>
            <strong>DEMO EMAIL INGESTION MODE:</strong> Simulates an incoming organization email without requiring external Google Cloud OAuth credentials. Processes the message and attachment through the exact same Email Filter → File Validator → 7-Layer Verification Pipeline → Groq AI (<code className="font-mono">openai/gpt-oss-20b</code>) → Incident & Digital Twin update, and tags the record as <code className="font-mono">DEMO</code>.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Sender Email Address *</label>
              <input 
                type="email" 
                className="input-field" 
                value={simForm.sender}
                onChange={(e) => setSimForm({ ...simForm, sender: e.target.value })}
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Target Department *</label>
              <select 
                className="input-field"
                value={simForm.department}
                onChange={(e) => setSimForm({ ...simForm, department: e.target.value })}
                required
              >
                <option value="Finance">Finance</option>
                <option value="Operations">Operations</option>
                <option value="HR">HR</option>
                <option value="IT">IT</option>
                <option value="Security">Security</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem' }}>
            <div className="input-group">
              <label className="input-label">Email Subject *</label>
              <input 
                type="text" 
                className="input-field" 
                value={simForm.subject}
                onChange={(e) => setSimForm({ ...simForm, subject: e.target.value })}
                required 
              />
            </div>

            <div className="input-group">
              <label className="input-label">Custom Message-ID (Optional)</label>
              <input 
                type="text" 
                className="input-field font-mono" 
                value={simForm.message_id}
                onChange={(e) => setSimForm({ ...simForm, message_id: e.target.value })}
                placeholder="Auto-generated if blank"
              />
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Email Body Content (Optional)</label>
            <textarea 
              className="input-field" 
              rows={3}
              value={simForm.body_text}
              onChange={(e) => setSimForm({ ...simForm, body_text: e.target.value })}
              placeholder="Paste email message body text here..."
            />
          </div>

          <div className="input-group">
            <label className="input-label">Attachment Upload (PDF, DOCX, XLSX, PNG, JPG, TXT)</label>
            <input 
              type="file" 
              className="input-field"
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.txt"
              onChange={(e) => setSimForm({ ...simForm, file: e.target.files[0] || null })}
              style={{ paddingTop: '0.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button 
              type="button" 
              onClick={() => setDemoModalOpen(false)} 
              className="btn btn-secondary"
              disabled={simulating}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={simulating}
            >
              {simulating ? 'Verifying via 7-Layer + Groq AI...' : 'Ingest Demo Email'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
