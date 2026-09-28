import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Mail,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Inbox,
  Link2,
  Unlink,
  Sliders,
  ChevronDown,
  Paperclip,
  ShieldCheck,
  FileText
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
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [oauthWorking, setOauthWorking] = useState(false);
  const [savingFilters, setSavingFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [oauthMessage, setOauthMessage] = useState(null);

  const [oauthState, setOauthState] = useState({
    organization_id: 'ORG-TRUSTSPHERE',
    provider: 'Gmail',
    email_address: null,
    status: 'Not Connected',
    is_connected: false,
    oauth_configured: false,
    last_sync_at: null
  });

  const [filterForm, setFilterForm] = useState({
    allowed_senders: '',
    subject_keywords: '',
    require_attachment: false,
    allowed_extensions: '.pdf, .docx, .xlsx, .png, .jpg, .jpeg, .txt',
    max_file_size_mb: 10
  });

  const [recentEmails, setRecentEmails] = useState([]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [oauthRes, filtersRes, recentRes] = await Promise.allSettled([
        ingestionApi.getOAuthStatus(),
        ingestionApi.getEmailFilters(),
        ingestionApi.getRecentEmails(50, false)
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
          allowed_extensions: Array.isArray(r.allowed_extensions)
            ? r.allowed_extensions.join(', ')
            : '.pdf, .docx, .xlsx, .png, .jpg, .jpeg, .txt',
          max_file_size_mb: r.max_file_size_mb || 10
        });
      }

      if (recentRes.status === 'fulfilled' && recentRes.value?.data?.recent_emails) {
        setRecentEmails(
          recentRes.value.data.recent_emails.filter(
            (item) => !(item.is_demo || item.simulated || item.ingestion_mode === 'DEMO')
          )
        );
      }
    } catch (err) {
      console.error('[EmailVerification] load error:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Automatic UI refresh every 30 seconds while connected
  useEffect(() => {
    if (!oauthState.is_connected) return undefined;
    const timer = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(timer);
  }, [oauthState.is_connected, fetchData]);

  // Handle Google OAuth 2.0 callback query parameters
  useEffect(() => {
    const oauthStatus = searchParams.get('oauth_status');
    if (!oauthStatus) return;

    const connectedEmail = searchParams.get('connected_email');
    const oauthError = searchParams.get('oauth_error');
    const oauthMsg = searchParams.get('oauth_message');

    if (oauthStatus === 'success') {
      const successText = connectedEmail
        ? `Connected Gmail account: ${connectedEmail}`
        : oauthMsg || 'Gmail account connected.';
      setOauthMessage({ type: 'success', text: successText });
      addToast(successText, 'success');
      fetchData(true);
      if (refetch) refetch();
    } else if (oauthStatus === 'error') {
      const errText = oauthMsg || oauthError || 'Gmail connection failed.';
      setOauthMessage({ type: 'error', text: errText });
      addToast(errText, 'error');
      fetchData(true);
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, addToast, fetchData, refetch]);

  const handleConnectGmail = async () => {
    setOauthWorking(true);
    setOauthMessage(null);
    try {
      const res = await ingestionApi.connectGmailOAuth();
      const data = res?.data || res;
      if (data?.authorization_url) {
        window.location.href = data.authorization_url;
      } else {
        const msg = data?.message || res?.message || 'Google OAuth credentials are not configured.';
        setOauthMessage({ type: 'error', text: msg });
        addToast(msg, 'warning');
      }
    } catch (err) {
      const msg = err.message || 'Could not initiate Gmail connection.';
      setOauthMessage({ type: 'error', text: msg });
      addToast(msg, 'error');
    } finally {
      setOauthWorking(false);
    }
  };

  const handleDisconnectGmail = async () => {
    setOauthWorking(true);
    try {
      const res = await ingestionApi.disconnectGmailOAuth();
      if (res?.success && res?.data) {
        setOauthState(res.data);
        setOauthMessage({ type: 'info', text: 'Gmail account disconnected.' });
        addToast('Gmail account disconnected.', 'info');
        if (refetch) refetch();
      }
    } catch (err) {
      addToast(err.message || 'Failed to disconnect Gmail.', 'error');
    } finally {
      setOauthWorking(false);
    }
  };

  const handleSyncGmail = async () => {
    if (!oauthState.is_connected) {
      addToast('Connect a Gmail account first to sync emails.', 'warning');
      return;
    }
    setSyncing(true);
    setOauthMessage(null);
    try {
      const res = await ingestionApi.syncGmail('Operations');
      const payload = res?.data || {};
      const count = payload.processed_count || 0;
      const msg = payload.message || `Gmail sync completed (${count} new email(s) verified).`;

      if (res?.success && payload.status !== 'ERROR' && payload.status !== 'NOT_CONNECTED') {
        setOauthMessage({ type: 'success', text: msg });
        addToast(msg, count > 0 ? 'success' : 'info');
        await fetchData(true);
        if (refetch) refetch();
      } else {
        setOauthMessage({ type: 'error', text: msg });
        addToast(msg, 'warning');
        await fetchData(true);
      }
    } catch (err) {
      const errMsg = err.message || 'Gmail synchronization failed.';
      setOauthMessage({ type: 'error', text: errMsg });
      addToast(errMsg, 'error');
    } finally {
      setSyncing(false);
    }
  };

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
        addToast('Email filtering rules saved.', 'success');
      }
    } catch (err) {
      addToast(err.message || 'Failed to save filtering rules.', 'error');
    } finally {
      setSavingFilters(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Page Header with Single Primary Action */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Email Verification
          </h1>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Connect your organization Gmail account to automatically fetch and verify incoming emails and attachments.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={handleSyncGmail}
            className="btn btn-primary"
            disabled={syncing || !oauthState.is_connected}
          >
            <RefreshCw size={15} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing Gmail...' : 'Sync Gmail'}</span>
          </button>
        </div>
      </div>

      {/* Compact Organization Email Connection Card */}
      <div className="glass-panel" style={{ padding: '1.35rem 1.5rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '10px',
                background: oauthState.is_connected ? 'rgba(16, 185, 129, 0.12)' : 'rgba(56, 189, 248, 0.1)',
                border: oauthState.is_connected
                  ? '1px solid rgba(16, 185, 129, 0.35)'
                  : '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: oauthState.is_connected ? '#10B981' : 'var(--accent-cyan)',
                flexShrink: 0
              }}
            >
              <Mail size={22} />
            </div>

            <div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Organization Email
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                  marginTop: '0.3rem',
                  fontSize: '0.84rem'
                }}
              >
                <span style={{ color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Status:</span>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: oauthState.is_connected ? '#10B981' : '#F59E0B'
                    }}
                  />
                  <strong style={{ color: oauthState.is_connected ? 'var(--trust-75)' : 'var(--trust-60)' }}>
                    {oauthState.is_connected ? 'Connected' : 'Not Connected'}
                  </strong>
                </span>

                <span style={{ color: 'var(--text-secondary)' }}>
                  Connected account:{' '}
                  <strong className="font-mono" style={{ color: 'var(--text-primary)' }}>
                    {oauthState.is_connected && oauthState.email_address ? oauthState.email_address : 'Not Connected'}
                  </strong>
                </span>

                {oauthState.last_sync_at && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    Last synced: {new Date(oauthState.last_sync_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleConnectGmail}
              disabled={oauthWorking || oauthState.is_connected}
              className="btn btn-primary"
            >
              <Link2 size={15} />
              <span>{oauthWorking ? 'Connecting...' : 'Connect Gmail'}</span>
            </button>

            <button
              type="button"
              onClick={handleDisconnectGmail}
              disabled={oauthWorking || !oauthState.is_connected}
              className="btn btn-danger"
            >
              <Unlink size={15} />
              <span>Disconnect</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((prev) => !prev)}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 0.85rem' }}
            >
              <Sliders size={14} />
              <span>Advanced Filtering</span>
              <ChevronDown
                size={14}
                style={{
                  transform: showAdvancedFilters ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s ease'
                }}
              />
            </button>
          </div>
        </div>

        {oauthMessage && (
          <div
            style={{
              marginTop: '1rem',
              padding: '0.7rem 0.95rem',
              borderRadius: 'var(--radius-sm)',
              backgroundColor:
                oauthMessage.type === 'success'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : oauthMessage.type === 'error'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : 'rgba(56, 189, 248, 0.1)',
              border:
                oauthMessage.type === 'success'
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : oauthMessage.type === 'error'
                  ? '1px solid rgba(239, 68, 68, 0.3)'
                  : '1px solid var(--border-subtle)',
              color:
                oauthMessage.type === 'success'
                  ? 'var(--trust-75)'
                  : oauthMessage.type === 'error'
                  ? 'var(--trust-0)'
                  : 'var(--text-primary)',
              fontSize: '0.82rem'
            }}
          >
            {oauthMessage.text}
          </div>
        )}

        {/* Collapsible Advanced Filtering Section */}
        {showAdvancedFilters && (
          <form
            onSubmit={handleSaveFilters}
            style={{
              marginTop: '1.25rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              alignItems: 'end'
            }}
          >
            <div>
              <label className="input-label" style={{ fontSize: '0.76rem' }}>
                Allowed Senders (comma-separated, optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="All senders allowed if empty"
                value={filterForm.allowed_senders}
                onChange={(e) => setFilterForm({ ...filterForm, allowed_senders: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" style={{ fontSize: '0.76rem' }}>
                Subject Keywords (comma-separated, optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="All subjects allowed if empty"
                value={filterForm.subject_keywords}
                onChange={(e) => setFilterForm({ ...filterForm, subject_keywords: e.target.value })}
              />
            </div>

            <div>
              <label className="input-label" style={{ fontSize: '0.76rem' }}>
                Allowed Attachment Extensions
              </label>
              <input
                type="text"
                className="input-field font-mono"
                value={filterForm.allowed_extensions}
                onChange={(e) => setFilterForm({ ...filterForm, allowed_extensions: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ flex: 1 }}>
                <label className="input-label" style={{ fontSize: '0.76rem' }}>
                  Max Attachment (MB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="input-field"
                  value={filterForm.max_file_size_mb}
                  onChange={(e) => setFilterForm({ ...filterForm, max_file_size_mb: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                disabled={savingFilters}
                style={{ marginTop: '1.1rem' }}
              >
                <span>{savingFilters ? 'Saving...' : 'Save Rules'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Recent Verified Emails Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.1rem',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Recent Verified Emails
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Click any email row to view verification analysis, linked digital assets, and technical provenance.
            </p>
          </div>
          <span className="font-mono" style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            {recentEmails.length} {recentEmails.length === 1 ? 'email' : 'emails'} verified
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Loading verified emails...
          </div>
        ) : recentEmails.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No verified emails yet"
            description={
              oauthState.is_connected
                ? 'Click "Sync Gmail" above to fetch and verify recent emails from your connected Gmail inbox.'
                : 'Connect your organization Gmail account above to start verifying incoming emails and attachments.'
            }
          />
        ) : (
          <div className="table-container">
            <table className="security-table">
              <thead>
                <tr>
                  <th>Sender</th>
                  <th>Subject</th>
                  <th>Received</th>
                  <th>Attachment</th>
                  <th>Verification Status</th>
                  <th>Risk / Trust Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEmails.map((item, idx) => {
                  const receivedStr = item.received_time
                    ? String(item.received_time).substring(0, 16).replace('T', ' ')
                    : '—';
                  const attList = Array.isArray(item.attachments) ? item.attachments : [];

                  return (
                    <tr
                      key={item.email_id || item.message_id || idx}
                      onClick={() => setSelectedEmail(item)}
                      style={{ cursor: 'pointer' }}
                      title="Click to inspect email verification details"
                    >
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)', maxWidth: '220px' }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.sender}
                        </div>
                      </td>

                      <td style={{ color: 'var(--text-primary)', maxWidth: '280px' }}>
                        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.subject}
                        </div>
                      </td>

                      <td className="font-mono" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {receivedStr}
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {attList.length > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-cyan)' }}>
                            <Paperclip size={13} />
                            <span>{attList[0]}{attList.length > 1 ? ` (+${attList.length - 1})` : ''}</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Body Verified</span>
                        )}
                      </td>

                      <td>
                        <StatusBadge status={item.status || item.processing_status || 'VERIFIED'} />
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <TrustScoreBadge score={Math.round(item.trust_score || 50)} size="sm" />
                          <StatusBadge status={item.risk_level || 'Medium Risk'} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email Detail Modal (Technical Provenance & Linked Entities) */}
      <Modal
        isOpen={Boolean(selectedEmail)}
        onClose={() => setSelectedEmail(null)}
        title="Verified Email Details"
      >
        {selectedEmail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div
              style={{
                padding: '1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem'
              }}
            >
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {selectedEmail.subject}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                <strong>From:</strong> {selectedEmail.sender}
              </div>
              {selectedEmail.recipient && (
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  <strong>To:</strong> {selectedEmail.recipient}
                </div>
              )}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <strong>Received:</strong>{' '}
                {selectedEmail.received_time
                  ? String(selectedEmail.received_time).substring(0, 19).replace('T', ' ')
                  : '—'}
              </div>
            </div>

            {/* Trust & Verification Summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.75rem'
              }}
            >
              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Verification Status
                </div>
                <div style={{ marginTop: '0.4rem' }}>
                  <StatusBadge status={selectedEmail.status || 'VERIFIED'} />
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Trust Score
                </div>
                <div style={{ marginTop: '0.4rem' }}>
                  <TrustScoreBadge score={Math.round(selectedEmail.trust_score || 50)} />
                </div>
              </div>

              <div
                style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Risk Level
                </div>
                <div style={{ marginTop: '0.4rem' }}>
                  <StatusBadge status={selectedEmail.risk_level || 'Medium Risk'} />
                </div>
              </div>
            </div>

            {selectedEmail.ai_summary && (
              <div
                style={{
                  padding: '0.9rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(56, 189, 248, 0.06)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.5
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--accent-cyan)', fontSize: '0.75rem', marginBottom: '0.25rem', textTransform: 'uppercase' }}>
                  Security & Risk Summary
                </div>
                {selectedEmail.ai_summary}
              </div>
            )}

            {/* Technical Provenance & Traceability */}
            <div
              style={{
                padding: '0.95rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.45rem'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                Provenance & Traceability
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Gmail Message ID:</span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {selectedEmail.gmail_message_id || selectedEmail.email_id || '—'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Attachments:</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {Array.isArray(selectedEmail.attachments) && selectedEmail.attachments.length > 0
                    ? selectedEmail.attachments.join(', ')
                    : 'None (Email Body Verified)'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Department:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{selectedEmail.department || 'Operations'}</span>
              </div>
              {selectedEmail.asset_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Linked Digital Asset:</span>
                  <Link
                    to={`/assets/${selectedEmail.asset_id}`}
                    className="font-mono"
                    style={{ color: 'var(--accent-cyan)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>{selectedEmail.asset_id}</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              )}
              {selectedEmail.incident_id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Linked Security Incident:</span>
                  <Link
                    to={`/incidents/${selectedEmail.incident_id}`}
                    className="font-mono"
                    style={{ color: '#F87171', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>{selectedEmail.incident_id}</span>
                    <ExternalLink size={12} />
                  </Link>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {selectedEmail.asset_id && (
                <Link to={`/assets/${selectedEmail.asset_id}`} className="btn btn-primary">
                  <FileText size={15} />
                  <span>Open Digital Asset</span>
                </Link>
              )}
              <button type="button" onClick={() => setSelectedEmail(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
