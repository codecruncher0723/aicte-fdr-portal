import React, { useState, useEffect, useCallback } from 'react';
import { FDR_STATUSES } from '../../data/mockData';
import { apiClient } from '../../api/client';

export default function FdrDetailModal({ isOpen, onClose, fdr, onNavigateAudit }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'documents' | 'audit'
  const [documents, setDocuments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [downloadingDocId, setDownloadingDocId] = useState(null);

  // Load real documents and audit logs whenever modal opens for an FDR
  const loadFdrData = useCallback(async () => {
    if (!fdr) return;
    const fdrId = fdr.id || fdr.fdr_id;
    if (!fdrId) return;

    try {
      setIsLoadingDetails(true);
      setDetailError(null);

      // 1. Load real document versions
      try {
        const docs = await apiClient.getFdrDocuments(fdrId);
        setDocuments(docs || []);
      } catch (docErr) {
        console.warn('Could not load documents for FDR:', docErr.message);
        setDocuments([]);
      }

      // 2. Load real audit history
      try {
        const logs = await apiClient.getAuditLogs(fdrId);
        setAuditLogs(logs || []);
      } catch (logErr) {
        console.warn('Could not load audit logs for FDR:', logErr.message);
        setAuditLogs([]);
      }
    } catch (err) {
      setDetailError(err.message || 'Failed to load FDR details.');
    } finally {
      setIsLoadingDetails(false);
    }
  }, [fdr]);

  useEffect(() => {
    if (isOpen && fdr) {
      loadFdrData();
    } else {
      setDocuments([]);
      setAuditLogs([]);
      setActiveTab('overview');
    }
  }, [isOpen, fdr, loadFdrData]);

  if (!isOpen || !fdr) return null;

  // Authenticated Document Download
  const handleDownloadDoc = async (doc) => {
    if (!doc || !doc.id) return;
    try {
      setDownloadingDocId(doc.id);
      const blob = await apiClient.downloadDocumentBlob(doc.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.file_name || `fdr_${fdr.fdrNumber}_doc_v${doc.version}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Document download failed: ${err.message}`);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const latestDoc = documents.length > 0 ? documents[documents.length - 1] : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[24px]">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-base font-bold text-on-surface font-data-mono">
                  {fdr.fdrNumber}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  {fdr.status}
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {fdr.institutionName} • PID: <span className="font-data-mono">{fdr.aictePid}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tab Switcher Navigation */}
        <div className="px-6 bg-surface-container-low/30 border-b border-surface-container flex items-center gap-1 shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">description</span>
            <span>Certificate Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">folder</span>
            <span>Attached Documents</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-surface-container font-mono">
              {documents.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`py-3 px-3 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">history</span>
            <span>Forensic Audit Trail</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-surface-container font-mono">
              {auditLogs.length}
            </span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isLoadingDetails && (
            <div className="py-2 flex items-center gap-2 text-xs text-secondary justify-center">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Synchronizing latest regulatory custody and documents...</span>
            </div>
          )}

          {detailError && (
            <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[18px]">error</span>
              <span>{detailError}</span>
            </div>
          )}

          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Key Metric Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
                  <span className="text-[11px] text-secondary font-medium block">Principal Amount</span>
                  <span className="text-base font-bold text-primary font-data-mono">{fdr.amountFormatted}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
                  <span className="text-[11px] text-secondary font-medium block">Interest Rate</span>
                  <span className="text-sm font-bold text-on-surface font-data-mono">{fdr.interestRate}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
                  <span className="text-[11px] text-secondary font-medium block">Maturity Date</span>
                  <span className="text-sm font-bold text-on-surface font-data-mono">{fdr.maturityDate}</span>
                </div>
                <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
                  <span className="text-[11px] text-secondary font-medium block">Tenure</span>
                  <span className="text-sm font-bold text-on-surface">{fdr.tenureYears} Years</span>
                </div>
              </div>

              {/* Tripartite & Bank Custody Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">account_balance</span>
                  <span>Banking & Regulatory Custody Endorsement</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-surface-container-low/50 p-4 rounded-xl border border-surface-container">
                  <div>
                    <span className="text-secondary block">Issuing Bank</span>
                    <span className="font-semibold text-on-surface">{fdr.bank}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Branch & IFSC</span>
                    <span className="font-semibold text-on-surface">{fdr.branch} ({fdr.ifsc})</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Tripartite Ref</span>
                    <span className="font-semibold text-on-surface font-data-mono">{fdr.tripartiteRef || 'TPR-2022-WRO-091'}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Statutory Mandate Clause</span>
                    <span className="font-semibold text-teal-800">{fdr.mandateClause || 'Clause 14(B) Joint Lien'}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Lien Registration Status</span>
                    <span className="font-semibold text-emerald-700">{fdr.lienStatus || 'Statutory Lien Registered'}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Active Document Version</span>
                    <span className="font-semibold font-data-mono text-primary">
                      {latestDoc ? `Version ${latestDoc.version} (${latestDoc.file_name})` : 'Pending Upload'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sponsoring Trust & Academic Program */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
                  <span>Institution & Academic Programme Scope</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-surface-container-low/50 p-4 rounded-xl border border-surface-container">
                  <div>
                    <span className="text-secondary block">Sponsoring Trust / Society</span>
                    <span className="font-semibold text-on-surface">{fdr.sponsoringTrust}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Academic Programme</span>
                    <span className="font-semibold text-on-surface">{fdr.programme}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Regional Office</span>
                    <span className="font-semibold text-on-surface">{fdr.regionLabel}</span>
                  </div>
                  <div>
                    <span className="text-secondary block">Location</span>
                    <span className="font-semibold text-on-surface">{fdr.city}, {fdr.state}</span>
                  </div>
                </div>
              </div>

              {/* Notes / Discrepancy (if any) */}
              {(fdr.discrepancyNote || fdr.statusRemarks) && (
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0 mt-0.5">warning</span>
                  <div>
                    <strong className="block font-semibold">Active Scrutiny Remark:</strong>
                    <span>{fdr.statusRemarks || fdr.discrepancyNote}</span>
                  </div>
                </div>
              )}

              {/* Real Cryptographic Digest Display */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container text-xs text-secondary flex items-center justify-between flex-wrap gap-2">
                <span>Last Audited: <strong className="text-on-surface">{fdr.lastAuditDate || 'Today'}</strong></span>
                <span className="font-data-mono text-[11px] truncate max-w-sm">
                  SHA-256: {latestDoc?.sha256_hash ? `${latestDoc.sha256_hash.slice(0, 16)}...${latestDoc.sha256_hash.slice(-8)}` : 'No document attached'}
                </span>
              </div>
            </>
          )}

          {/* TAB 2: ATTACHED DOCUMENTS & VERSIONS */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
                    Official Fixed Deposit Receipt Documents
                  </h3>
                  <p className="text-[11px] text-secondary mt-0.5">
                    Private cryptographic storage. Download is authenticated and strictly isolated.
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800">
                  {documents.length} {documents.length === 1 ? 'Version' : 'Versions'}
                </span>
              </div>

              {documents.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-low/40 rounded-xl border border-dashed border-surface-container flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-[36px] text-secondary mb-2">draft</span>
                  <span className="text-xs font-semibold text-on-surface">No Documents Attached Yet</span>
                  <p className="text-[11px] text-secondary mt-1 max-w-xs">
                    Supporting Form L-1 or FDR certificate has not been uploaded for this instrument.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className="p-4 rounded-xl bg-surface-container-low/60 border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="material-symbols-outlined text-[20px]">description</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-on-surface truncate">{doc.file_name}</span>
                            <span className="px-2 py-0.2 rounded font-mono font-bold text-[10px] bg-primary-fixed text-on-primary-fixed">
                              v{doc.version}
                            </span>
                            <span className="text-[10px] text-secondary uppercase font-semibold">
                              {doc.document_type || 'FDR_RECEIPT'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-secondary mt-1 font-mono flex-wrap">
                            <span>Size: {(Number(doc.file_size || 0) / 1024).toFixed(1)} KB</span>
                            <span>Uploaded: {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : 'Recent'}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-1 truncate" title={doc.sha256_hash}>
                            SHA-256: <span className="text-teal-800 font-bold">{doc.sha256_hash}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadDoc(doc)}
                        disabled={downloadingDocId === doc.id}
                        className="px-3.5 py-1.5 rounded-xl bg-white border border-surface-container-high hover:bg-surface-container text-primary font-semibold text-xs inline-flex items-center gap-1.5 transition-colors shrink-0 shadow-xs self-start sm:self-center disabled:opacity-50"
                      >
                        {downloadingDocId === doc.id ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <span>Downloading...</span>
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">download</span>
                            <span>Download File</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FORENSIC AUDIT TRAIL */}
          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">
                    Immutable Audit & Decision History
                  </h3>
                  <p className="text-[11px] text-secondary mt-0.5">
                    Chronological lifecycle events recorded transactionally in the database.
                  </p>
                </div>
                <span className="text-[11px] font-mono text-secondary">
                  {auditLogs.length} {auditLogs.length === 1 ? 'Event' : 'Events'}
                </span>
              </div>

              {auditLogs.length === 0 ? (
                <div className="p-8 text-center bg-surface-container-low/40 rounded-xl border border-dashed border-surface-container flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-[36px] text-secondary mb-2">history</span>
                  <span className="text-xs font-semibold text-on-surface">No Historical Events Yet</span>
                  <p className="text-[11px] text-secondary mt-1 max-w-xs">
                    Events will appear here as this instrument moves through submission, verification, and approval.
                  </p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container text-xs">
                  {auditLogs.map((log, lIdx) => (
                    <div key={log.id || lIdx} className="relative">
                      <span className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-teal-600 ring-4 ring-white shadow-xs"></span>
                      <div className="p-3 rounded-xl bg-surface-container-low/60 border border-surface-container">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 font-mono text-[11px]">
                            {log.action}
                          </span>
                          <span className="font-mono text-[10px] text-secondary">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-600 mt-1">
                          Actor: <strong>{log.actor_name || log.actor_role}</strong> ({log.actor_role})
                        </div>
                        {log.details && (
                          <p className="text-[11px] text-slate-500 mt-1 italic bg-white/60 p-2 rounded-lg border border-surface-container-low">
                            "{log.details}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-surface-container flex items-center justify-between bg-surface-container-low/40 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            Close
          </button>

          <button
            onClick={() => {
              onClose();
              if (onNavigateAudit) onNavigateAudit(fdr);
            }}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-xs inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Open in Verification Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
}
