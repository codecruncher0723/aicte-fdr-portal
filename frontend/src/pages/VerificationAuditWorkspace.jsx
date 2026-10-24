import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { FDR_STATUSES } from '../data/mockData';
import { apiClient } from '../api/client';
import { mapFdrFromBackend } from '../App';

export default function VerificationAuditWorkspace({ fdr, onUpdateFdrStatus }) {
  const { currentRole, currentUser, setActiveRoute } = useRole();

  const isApprover = currentRole === ROLES.APPROVING_AUTHORITY;
  const isVerifier = currentRole === ROLES.VERIFICATION_OFFICER;
  const isAdmin = currentRole === ROLES.AICTE_ADMIN;

  // Queue State
  const [queueMode, setQueueMode] = useState(isApprover ? 'approval' : 'verification');
  const [pendingQueue, setPendingQueue] = useState([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(true);
  const [selectedQueueId, setSelectedQueueId] = useState(null);

  // Active FDR Detail State
  const [activeFdr, setActiveFdr] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [extraction, setExtraction] = useState(null);
  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [auditLogs, setAuditLogs] = useState([]);
  const [duplicateData, setDuplicateData] = useState(null);

  // Action Inputs & Feedback
  const [remarks, setRemarks] = useState(
    'Verified physical core banking lien registry and tripartite escrow mandate. Recommended for statutory endorsement.'
  );
  const [councilOrderRef, setCouncilOrderRef] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [actionError, setActionError] = useState(null);

  // UI Display Controls
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showOcrBoxes, setShowOcrBoxes] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [chkPhysical, setChkPhysical] = useState(true);
  const [chkTripartite, setChkTripartite] = useState(true);
  const [chkAutoDispatch, setChkAutoDispatch] = useState(false);
  const [copied, setCopied] = useState(false);

  const snippets = [
    { label: '+ APH Comp. Note', text: ' [Compliance confirmed per APH Appendix 11.4]' },
    { label: '+ Rollover Warranty', text: ' [Statutory auto-rollover clause 14(B) active]' },
    { label: '+ Core Banking Match', text: ' [Finacle core banking receipt verified against statutory lien]' },
    { label: '+ Flag Discrepancy', text: ' [Discrepancy noted in tripartite endorsement name]' }
  ];

  // 1. Fetch Queue based on Mode and Role
  const loadQueue = useCallback(async () => {
    try {
      setIsLoadingQueue(true);
      setActionError(null);

      if (queueMode === 'approval' || (isApprover && !isAdmin)) {
        // Approving Authority Queue: PENDING_APPROVAL
        const res = await apiClient.getFdrs({ status: 'PENDING_APPROVAL', limit: 50 });
        const items = res?.items || [];
        setPendingQueue(items.map(mapFdrFromBackend));
      } else {
        // Verification Officer Queue: SUBMITTED or UNDER_VERIFICATION
        const items = await apiClient.getPendingVerifications();
        setPendingQueue((items || []).map(item => ({
          ...item,
          id: item.fdr_id || item.id,
          fdrNumber: item.fdr_number,
          institutionName: item.institution_name,
          amountFormatted: '₹' + Number(item.amount || 0).toLocaleString('en-IN'),
          status: item.status,
        })));
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
      setActionError(err.message || 'Failed to load work queue from backend');
    } finally {
      setIsLoadingQueue(false);
    }
  }, [queueMode, isApprover, isAdmin]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // 2. Select initial or passed FDR
  useEffect(() => {
    if (fdr && (fdr.id || fdr.fdr_id)) {
      setSelectedQueueId(fdr.id || fdr.fdr_id);
    } else if (pendingQueue.length > 0 && !selectedQueueId) {
      setSelectedQueueId(pendingQueue[0].id || pendingQueue[0].fdr_id);
    }
  }, [fdr, pendingQueue, selectedQueueId]);

  // 3. Load Active FDR Details, Documents, Logs, and Duplicate Checks
  const loadFdrDetails = useCallback(async (fdrId) => {
    if (!fdrId) return;
    try {
      setIsLoadingDetail(true);
      setActionError(null);

      // A. FDR Detail
      const fdrRaw = await apiClient.getFdr(fdrId);
      const mapped = mapFdrFromBackend(fdrRaw);
      setActiveFdr(mapped);
      setCouncilOrderRef(`AICTE/EC/2026/04/FDR-${mapped.id}`);

      // B. Documents
      try {
        const docs = await apiClient.getFdrDocuments(fdrId);
        setDocuments(docs || []);
        setSelectedDocIndex(docs && docs.length > 0 ? docs.length - 1 : 0);
      } catch (docErr) {
        setDocuments([]);
      }

      // C. Audit Logs
      try {
        const logs = await apiClient.getAuditLogs(fdrId);
        setAuditLogs(logs || []);
      } catch (logErr) {
        setAuditLogs([]);
      }

      // D. Duplicate Candidates Check
      try {
        const dupes = await apiClient.getDuplicateCandidates(fdrId);
        setDuplicateData(dupes);
      } catch (dupErr) {
        setDuplicateData(null);
      }
    } catch (err) {
      console.error('Error loading FDR detail:', err);
      setActionError(err.message || `Failed to load FDR ${fdrId} details`);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedQueueId) {
      loadFdrDetails(selectedQueueId);
    }
  }, [selectedQueueId, loadFdrDetails]);

  // Active selected document
  const selectedDoc = documents[selectedDocIndex] || null;

  // Advisory text-extraction suggestions for the selected document version
  useEffect(() => {
    let cancelled = false;
    setExtraction(null);
    if (!selectedDoc) return undefined;
    apiClient.getDocumentExtraction(selectedDoc.id)
      .then(res => { if (!cancelled) setExtraction(res); })
      .catch(() => { if (!cancelled) setExtraction(null); });
    return () => { cancelled = true; };
  }, [selectedDoc?.id]);

  // Separation of Duties Check
  const isSubmitter = useMemo(() => {
    if (!activeFdr || !currentUser) return false;
    const actorId = currentUser.userId || currentUser.id;
    return actorId === activeFdr.created_by_id;
  }, [activeFdr, currentUser]);

  // Document Download Handler
  const handleDownloadDoc = async (docId, fileName) => {
    if (!docId) return;
    try {
      const blob = await apiClient.downloadDocumentBlob(docId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || `fdr_document_${docId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  const handleCopyRef = () => {
    if (activeFdr?.fdrNumber) {
      navigator.clipboard.writeText(activeFdr.fdrNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAddSnippet = (snippetText) => {
    setRemarks(prev => `${prev.trim()} ${snippetText}`);
  };

  // 4. Action Handlers (Verify, Return, Reject, Start, Approve)
  const handleStartVerification = async () => {
    if (!activeFdr) return;
    setIsActionSubmitting(true);
    setActionError(null);
    try {
      await apiClient.startVerification(activeFdr.id, remarks);
      setActionFeedback(`FDR ${activeFdr.fdrNumber} claimed into scrutiny review (UNDER_VERIFICATION).`);
      await loadFdrDetails(activeFdr.id);
      await loadQueue();
      if (onUpdateFdrStatus) onUpdateFdrStatus(activeFdr.id, 'Under Verification', remarks);
    } catch (err) {
      setActionError(err.message || 'Failed to claim scrutiny review.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleVerificationDecision = async (decision) => {
    if (!activeFdr) return;
    setIsActionSubmitting(true);
    setActionError(null);

    const payload = {
      decision: decision,
      remarks: remarks || `Verification decision: ${decision}`,
      discrepancy_code: decision === 'CORRECTION_REQUIRED' ? 'DOCUMENT_METADATA_MISMATCH' : null,
      discrepancy_severity: decision === 'CORRECTION_REQUIRED' ? 'REVIEW_REQUIRED' : null,
      discrepancy_note: decision === 'CORRECTION_REQUIRED' ? remarks : null,
      document_version_id: selectedDoc ? selectedDoc.id : null,
    };

    try {
      const res = await apiClient.verifyFdr(activeFdr.id, payload);
      const newStatus = res.new_status;
      setActionFeedback(`Decision recorded: ${decision}. FDR status is now ${newStatus}.`);

      if (onUpdateFdrStatus) {
        onUpdateFdrStatus(activeFdr.id, newStatus, remarks);
      }

      await loadQueue();
      // Pick next available item if available
      const remaining = pendingQueue.filter(item => (item.id || item.fdr_id) !== activeFdr.id);
      if (remaining.length > 0) {
        setSelectedQueueId(remaining[0].id || remaining[0].fdr_id);
      } else {
        setActiveFdr(null);
      }
    } catch (err) {
      setActionError(err.message || `Failed to record verification decision ${decision}`);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleApprovalDecision = async (decision) => {
    if (!activeFdr) return;
    setIsActionSubmitting(true);
    setActionError(null);

    const payload = {
      decision: decision,
      remarks: remarks || (decision === 'APPROVED' ? 'Approved by AICTE Executive Council' : 'Rejected by Council'),
      council_order_ref: councilOrderRef || `AICTE/EC/2026/04/FDR-${activeFdr.id}`,
      document_version_id: selectedDoc ? selectedDoc.id : null,
    };

    try {
      const res = await apiClient.approveFdr(activeFdr.id, payload);
      const newStatus = res.new_status;
      setActionFeedback(`Council Decision: ${decision}. Statutory lien endorsed. FDR status is now ${newStatus}.`);

      if (onUpdateFdrStatus) {
        onUpdateFdrStatus(activeFdr.id, newStatus, remarks);
      }

      await loadQueue();
      const remaining = pendingQueue.filter(item => (item.id || item.fdr_id) !== activeFdr.id);
      if (remaining.length > 0) {
        setSelectedQueueId(remaining[0].id || remaining[0].fdr_id);
      } else {
        setActiveFdr(null);
      }
    } catch (err) {
      setActionError(err.message || `Failed to record approval decision ${decision}`);
    } finally {
      setIsActionSubmitting(false);
    }
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      
      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl flex items-center justify-between text-xs shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[20px]">verified</span>
            <span><strong>Regulatory Workflow Updated:</strong> {actionFeedback}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="text-emerald-700 hover:text-emerald-900">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Action Error Alert */}
      {actionError && (
        <div className="p-4 bg-red-50 border border-red-300 text-red-900 rounded-2xl flex items-start justify-between text-xs shadow-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-red-600 text-[20px] shrink-0">error</span>
            <div>
              <span className="font-bold block">Operation Restricted</span>
              <span className="mt-0.5 block text-red-800">{actionError}</span>
            </div>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-700 hover:text-red-900">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* Breadcrumb Path & Screen Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs text-secondary flex-wrap">
          <span
            onClick={() => setActiveRoute('dashboard')}
            className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1 font-medium"
          >
            <span className="material-symbols-outlined text-[15px]">account_balance</span>
            Central Regulatory Financial Custody Division
          </span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-medium text-on-surface">
            {isApprover ? 'Statutory Council Approval' : 'Verification Scrutiny Desk'}
          </span>
        </div>

        {/* Screen Title & Top Action Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2.5">
              <span>
                {isApprover
                  ? 'AICTE Executive Council Approval & DSC Endorsement'
                  : 'Fixed Deposit Receipt Verification & Tripartite Audit'}
              </span>
              <span className="material-symbols-outlined text-teal-700 text-[24px]">
                {isApprover ? 'gavel' : 'verified_user'}
              </span>
            </h1>
            <p className="text-xs text-secondary mt-1">
              Mandatory statutory compliance under AICTE Approval Process Handbook (APH) Reg. 14(B)
            </p>
          </div>

          {/* Admin Queue Switcher Tabs */}
          {isAdmin && (
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-surface-container shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setQueueMode('verification')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  queueMode === 'verification' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
                }`}
              >
                Verification Queue
              </button>
              <button
                type="button"
                onClick={() => setQueueMode('approval')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  queueMode === 'approval' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
                }`}
              >
                Council Approval Queue
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PENDING WORK QUEUE SELECTOR RIBBON */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-700 text-[18px]">view_list</span>
            <span className="text-xs font-bold text-on-surface">
              {queueMode === 'approval' ? 'Pending Council Approvals' : 'Pending Verification Scrutiny Queue'}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
              {pendingQueue.length} {pendingQueue.length === 1 ? 'Instrument' : 'Instruments'}
            </span>
          </div>

          <button
            onClick={loadQueue}
            disabled={isLoadingQueue}
            className="text-xs text-primary hover:text-primary-container font-medium flex items-center gap-1 p-1"
            title="Refresh Queue from Backend"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoadingQueue ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* Queue Items Horizontal Scroll / Chips */}
        {isLoadingQueue ? (
          <div className="py-4 flex items-center justify-center gap-2 text-xs text-secondary">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span>Synchronizing live queue with backend database...</span>
          </div>
        ) : pendingQueue.length === 0 ? (
          <div className="py-6 text-center text-xs text-secondary bg-surface-container-low/30 rounded-xl border border-dashed border-surface-container">
            <span className="material-symbols-outlined text-[28px] text-teal-600 mb-1">task_alt</span>
            <p className="font-semibold text-on-surface">Work Queue is Clear</p>
            <p className="text-[11px] mt-0.5">There are no fixed deposit instruments currently awaiting scrutiny or approval.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {pendingQueue.map((item) => {
              const isSelected = selectedQueueId === (item.id || item.fdr_id);
              return (
                <div
                  key={item.id || item.fdr_id}
                  onClick={() => setSelectedQueueId(item.id || item.fdr_id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-1 text-xs ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                      : 'border-surface-container hover:bg-surface-container-low hover:border-surface-container-highest'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-on-surface truncate">{item.fdrNumber}</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 uppercase">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-secondary truncate">{item.institutionName}</div>
                  <div className="flex items-center justify-between pt-1 border-t border-surface-container-low text-[11px]">
                    <span className="font-mono font-semibold text-teal-800">{item.amountFormatted}</span>
                    {isSelected && <span className="text-primary font-bold text-[10px]">Inspecting &rarr;</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIVE FDR INSPECTION WORKSPACE */}
      {isLoadingDetail ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-secondary">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold">Retrieving instrument telemetry, documents & audit trail...</span>
        </div>
      ) : !activeFdr ? (
        <div className="py-12 bg-surface-container-lowest rounded-2xl border border-surface-container text-center text-secondary">
          <p className="text-sm font-semibold text-on-surface">No Instrument Selected</p>
          <p className="text-xs mt-1">Select an FDR from the queue above to inspect instrument details and make decisions.</p>
        </div>
      ) : (
        <>
          {/* Separation of Duties Warning Banner */}
          {isSubmitter && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-700 text-[22px] shrink-0">gavel</span>
              <div>
                <span className="font-bold block text-sm">Separation of Duties Restriction</span>
                <p className="mt-0.5 leading-relaxed">
                  You created this FDR record as <strong>{currentUser?.name}</strong> (User ID: {activeFdr.created_by_id}). 
                  Under Section 8.3 of AICTE Regulatory Requirements, <em>submitters are strictly barred from verifying or approving their own submissions</em>. 
                  Adjudication must be conducted independently by another authorized officer.
                </p>
              </div>
            </div>
          )}

          {/* Instrument Metadata Ribbon */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Ref No:</span>
                <span className="font-mono text-on-surface font-semibold bg-surface-container-low px-2 py-0.5 rounded-md text-xs">
                  {activeFdr.fdrNumber}
                </span>
                <button
                  onClick={handleCopyRef}
                  className="text-secondary hover:text-primary transition-colors p-0.5"
                  title="Copy FDR Reference"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {copied ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
              <div className="h-4 w-px bg-surface-container hidden sm:block"></div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Lien Status:</span>
                <span className="font-mono text-on-surface-variant text-xs font-medium">
                  {activeFdr.lien_status || 'Statutory Lien Registered'}
                </span>
              </div>
              <div className="h-4 w-px bg-surface-container hidden md:block"></div>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Institution:</span>
                <span className="text-xs text-on-surface font-medium">{activeFdr.institutionName} ({activeFdr.aictePid})</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                activeFdr.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : activeFdr.status === 'PENDING_APPROVAL'
                  ? 'bg-purple-50 text-purple-800 border border-purple-200'
                  : activeFdr.status === 'UNDER_VERIFICATION'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                <span>Status: {activeFdr.status}</span>
              </span>

              {/* Start Scrutiny Button for Submitted FDR */}
              {isVerifier && activeFdr.status === 'SUBMITTED' && !isSubmitter && (
                <button
                  type="button"
                  disabled={isActionSubmitting}
                  onClick={handleStartVerification}
                  className="px-3 py-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs flex items-center gap-1 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                  <span>Claim Scrutiny Review</span>
                </button>
              )}
            </div>
          </div>

          {/* 12-Column Responsive Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            
            {/* LEFT COLUMN: Regulatory Comparison & Documents (7 cols) */}
            <div className="xl:col-span-7 flex flex-col gap-6">
              
              {/* 4 Summary Micro-Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Card 1: Amount */}
                <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-secondary mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Deposit Principal</span>
                    <span className="material-symbols-outlined text-teal-700 text-[20px]">currency_rupee</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-2xl font-bold text-on-surface tracking-tight font-mono">
                      {activeFdr.amountFormatted}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-secondary text-xs">
                      <span>Rate: {activeFdr.interestRate}</span>
                      <span className="text-[11px] text-teal-800 font-semibold bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                        {activeFdr.auto_rollover ? 'Auto-Rollover' : 'Single Term'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Pledged Bank */}
                <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-secondary mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Issuing Bank</span>
                    <span className="material-symbols-outlined text-teal-700 text-[20px]">account_balance</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-lg font-bold text-on-surface truncate">{activeFdr.bank}</div>
                    <div className="text-xs text-secondary mt-0.5 truncate">{activeFdr.branch}</div>
                  </div>
                  <div className="mt-3 pt-2 border-t border-surface-container-low flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px] text-on-surface font-medium">IFSC: {activeFdr.ifsc}</span>
                    <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      Verified IFSC
                    </span>
                  </div>
                </div>

                {/* Card 3: Lien Category */}
                <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-secondary mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Lien Category & Mandate</span>
                    <span className="material-symbols-outlined text-teal-700 text-[20px]">lock</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="text-sm text-on-surface font-semibold leading-snug">
                      {activeFdr.mandateClause || 'Exclusive Statutory Lien under Reg 14(B)'}
                    </div>
                    <div className="text-xs text-secondary mt-1">Joint AICTE & Sponsoring Trust</div>
                  </div>
                </div>

                {/* Card 4: Tenor Horizon */}
                <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
                  <div className="flex items-center justify-between text-secondary mb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider">Tenor Horizon</span>
                    <span className="material-symbols-outlined text-teal-700 text-[20px]">calendar_clock</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-on-surface">{activeFdr.tenureYears} Years</span>
                      <span className="text-xs text-secondary font-mono">Issued: {activeFdr.issueDate}</span>
                    </div>
                    <div className="text-xs text-secondary mt-0.5 font-mono">
                      Maturity: <span className="text-on-surface font-semibold">{activeFdr.maturityDate}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real Duplicate Discrepancy Callout Banner */}
              {duplicateData && duplicateData.has_candidates ? (
                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 shadow-xs flex items-start gap-3.5">
                  <span className="material-symbols-outlined text-amber-700 text-[24px] shrink-0 mt-0.5">warning</span>
                  <div className="flex flex-col flex-1 text-xs">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="text-sm text-amber-900 font-bold">
                        {duplicateData.discrepancy?.code || 'DUPLICATE_FDR_CANDIDATE'}: Review Signal Flagged
                      </span>
                      <span className="text-[10px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                        {duplicateData.discrepancy?.severity || 'REVIEW_REQUIRED'}
                      </span>
                    </div>
                    <p className="text-amber-900 mt-1 leading-relaxed">
                      {duplicateData.discrepancy?.message || 'Configurable heuristic check detected prospective matching records.'}
                    </p>
                    <p className="text-[11px] text-amber-800 mt-1 italic">
                      Notice: FDR number uniqueness scope is TBD. This signal advises review of core banking certificates and does not enforce automatic rejection.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-2.5 text-xs text-emerald-900">
                  <span className="material-symbols-outlined text-emerald-700 text-[20px]">verified</span>
                  <span><strong>Zero Discrepancies Detected:</strong> No matching duplicate candidates found under configured uniqueness scope.</span>
                </div>
              )}

              {/* Scanned Digital Instrument Viewer Card */}
              <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs overflow-hidden flex flex-col">
                <div className="px-5 py-4 border-b border-surface-container flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-700 text-[22px]">description</span>
                    <h3 className="text-sm font-bold text-on-surface">Supporting Instrument & Document Versions</h3>
                  </div>

                  {/* Document Version Selector Pills */}
                  {documents.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {documents.map((doc, idx) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => setSelectedDocIndex(idx)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            selectedDocIndex === idx
                              ? 'bg-primary text-white shadow-xs'
                              : 'bg-surface-container-low text-secondary hover:bg-surface-container'
                          }`}
                        >
                          Version {doc.version}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {documents.length === 0 ? (
                  <div className="p-8 text-center text-xs text-secondary">
                    <span className="material-symbols-outlined text-[32px] text-slate-400 mb-1">find_in_page</span>
                    <p className="font-semibold text-slate-700">No Document Uploaded</p>
                    <p className="text-[11px] mt-0.5">This FDR does not currently have an attached scanned certificate file.</p>
                  </div>
                ) : selectedDoc ? (
                  <div className="p-5 flex flex-col gap-4">
                    {/* Document Metadata Bar */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-bold text-slate-900 truncate">{selectedDoc.original_filename || selectedDoc.file_name}</span>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span>Version {selectedDoc.version}</span>
                          <span>•</span>
                          <span>{selectedDoc.mime_type}</span>
                          <span>•</span>
                          <span>{(Number(selectedDoc.file_size || 0) / 1024).toFixed(1)} KB</span>
                        </div>
                        {selectedDoc.sha256_hash && (
                          <span className="text-[10px] font-mono text-slate-600 mt-1 truncate">
                            SHA-256: {selectedDoc.sha256_hash}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownloadDoc(selectedDoc.id, selectedDoc.original_filename || selectedDoc.file_name)}
                        className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-xs inline-flex items-center gap-1.5 shrink-0 shadow-xs transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">download</span>
                        <span>Download & Inspect</span>
                      </button>
                    </div>

                    {/* Security Watermark Preview Box */}
                    <div className="p-6 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-5 rotate-[-25deg]">
                        <span className="text-5xl font-bold tracking-widest text-[#00685f]">AICTE REGULATORY PLEDGE</span>
                      </div>
                      <span className="material-symbols-outlined text-teal-700 text-[40px] mb-2">verified_user</span>
                      <h4 className="text-xs font-bold text-slate-900">Encapsulated Document Revision {selectedDoc.version}</h4>
                      <p className="text-[11px] text-slate-600 mt-1 max-w-md">
                        Encapsulated in private storage under AICTE custody guidelines. Hash integrity verified on upload. Click 'Download & Inspect' above to view the full resolution scan.
                      </p>
                    </div>

                    {/* Extracted vs entered (advisory) */}
                    {extraction && (
                      <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="material-symbols-outlined text-teal-700 text-[18px]">text_snippet</span>
                          <h4 className="font-bold text-slate-900">Text read from document (suggestions)</h4>
                        </div>
                        {extraction.status === 'EXTRACTED' ? (
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-[10px] uppercase tracking-wide text-slate-500">
                                <th className="py-1 pr-2">Field</th>
                                <th className="py-1 pr-2">Entered</th>
                                <th className="py-1 pr-2">In document</th>
                                <th className="py-1">Result</th>
                              </tr>
                            </thead>
                            <tbody>
                              {extraction.fields.map(f => (
                                <tr key={f.field} className="border-t border-slate-100">
                                  <td className="py-1.5 pr-2 font-semibold text-slate-700">{f.field.replace(/_/g, ' ')}</td>
                                  <td className="py-1.5 pr-2 font-mono text-slate-700">{f.entered || '—'}</td>
                                  <td className="py-1.5 pr-2 font-mono text-slate-700">{f.extracted || '—'}</td>
                                  <td className="py-1.5">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      f.result === 'MATCH' ? 'bg-emerald-100 text-emerald-800'
                                        : f.result === 'MISMATCH' ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}>
                                      {f.result === 'NOT_FOUND' ? 'NOT FOUND' : f.result}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="text-slate-600">
                            {extraction.status === 'UNSUPPORTED_FORMAT' && 'No text layer to read: images and scans are not read automatically. Review the file manually.'}
                            {extraction.status === 'NO_TEXT_FOUND' && 'This PDF has no readable text layer (likely a scan). Review the file manually.'}
                            {extraction.status === 'UNAVAILABLE' && 'Text extraction is not enabled on this server. Review the file manually.'}
                            {extraction.status === 'FAILED' && 'Text could not be read from this file. Review it manually.'}
                            {extraction.status === 'NOT_RUN' && 'Not analysed (uploaded before text extraction existed). Review the file manually.'}
                          </p>
                        )}
                        <p className="mt-2 text-[10px] text-slate-500">{extraction.advisory}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

            </div>

            {/* RIGHT COLUMN: Adjudication Console & Institutional Standing (5 cols) */}
            <div className="xl:col-span-5 flex flex-col gap-6">
              
              {/* Reviewer Assessment & Statutory Remarks Card */}
              <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-700 text-[22px]">assignment_turned_in</span>
                    <h3 className="text-base text-on-surface font-bold">
                      {isApprover ? 'Statutory Council Adjudication' : 'Scrutiny Officer Remarks'}
                    </h3>
                  </div>
                  <span className="text-xs text-secondary font-medium font-mono">
                    Actor: {currentUser?.name || 'Authorized'}
                  </span>
                </div>

                {/* Council Order Ref input for Approver */}
                {isApprover && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Council Order Reference Ref <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={councilOrderRef}
                      onChange={(e) => setCouncilOrderRef(e.target.value)}
                      placeholder="e.g., AICTE/EC/2026/04/FDR-992"
                      className="w-full text-xs font-mono rounded-xl border border-surface-container bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                )}

                {/* Remarks Textarea */}
                <div className="mt-4">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Statutory Audit & Endorsement Remarks
                  </label>
                  <textarea
                    rows={4}
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter compliance findings, core banking verification check details, or correction request notes..."
                    className="w-full text-xs rounded-xl border border-surface-container bg-surface-container-low p-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  />
                </div>

                {/* Pre-approved Snippets */}
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                  {snippets.map((snip, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => handleAddSnippet(snip.text)}
                      className="text-[10px] font-semibold bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface border border-surface-container px-2 py-1 rounded-lg transition-colors"
                    >
                      {snip.label}
                    </button>
                  ))}
                </div>

                {/* Statutory Compliance Checkboxes */}
                <div className="mt-4 pt-3 border-t border-surface-container-low space-y-2.5 text-xs text-secondary">
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={chkPhysical}
                      onChange={(e) => setChkPhysical(e.target.checked)}
                      className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                    />
                    <span className="group-hover:text-primary transition-colors leading-relaxed">
                      Lien verified against core banking records; auto-rollover clause 14(B) confirmed
                    </span>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={chkTripartite}
                      onChange={(e) => setChkTripartite(e.target.checked)}
                      className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                    />
                    <span className="group-hover:text-primary transition-colors leading-relaxed">
                      Confirm tripartite escrow mandate is executed jointly with AICTE Member Secretary
                    </span>
                  </label>
                </div>

                {/* ACTION BUTTONS GROUP */}
                <div className="mt-5 pt-4 border-t border-surface-container flex flex-col gap-2.5">
                  
                  {/* Approver Action Buttons */}
                  {(isApprover || isAdmin) && activeFdr.status === 'PENDING_APPROVAL' && (
                    <>
                      <button
                        type="button"
                        disabled={isActionSubmitting || isSubmitter}
                        onClick={() => handleApprovalDecision('APPROVED')}
                        className="w-full h-11 px-4 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                        <span>Approve & Endorse Statutory Lien (Apply DSC)</span>
                      </button>

                      <button
                        type="button"
                        disabled={isActionSubmitting || isSubmitter}
                        onClick={() => handleApprovalDecision('REJECTED')}
                        className="w-full h-9 px-4 rounded-xl text-xs font-medium border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[16px]">cancel</span>
                        <span>Reject Submission</span>
                      </button>
                    </>
                  )}

                  {/* Verifier Action Buttons */}
                  {(isVerifier || isAdmin) && activeFdr.status !== 'ACTIVE' && activeFdr.status !== 'PENDING_APPROVAL' && (
                    <>
                      <button
                        type="button"
                        disabled={isActionSubmitting || isSubmitter}
                        onClick={() => handleVerificationDecision('VERIFIED')}
                        className="w-full h-11 px-4 rounded-xl text-xs font-bold bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span className="material-symbols-outlined text-[18px]">task_alt</span>
                        <span>Verify & Forward for Council Approval</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={isActionSubmitting || isSubmitter}
                          onClick={() => handleVerificationDecision('CORRECTION_REQUIRED')}
                          className="h-9 px-3 rounded-xl text-xs font-medium border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-[16px]">rate_review</span>
                          <span>Return for Correction</span>
                        </button>

                        <button
                          type="button"
                          disabled={isActionSubmitting || isSubmitter}
                          onClick={() => handleVerificationDecision('REJECTED')}
                          className="h-9 px-3 rounded-xl text-xs font-medium border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 transition-colors flex items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-[16px]">cancel</span>
                          <span>Reject</span>
                        </button>
                      </div>
                    </>
                  )}

                </div>
              </div>

              {/* Institution Profile Card */}
              <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-700 text-[22px]">domain</span>
                    <h3 className="text-sm text-on-surface font-bold">Institutional Profile</h3>
                  </div>
                  <span className="text-[10px] text-teal-800 font-bold bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                    AICTE Affiliated
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-3">
                  <div>
                    <span className="text-[11px] font-semibold text-secondary block uppercase">Institution</span>
                    <span className="font-semibold text-on-surface">{activeFdr.institutionName}</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-secondary block uppercase">PID</span>
                    <span className="font-mono font-semibold text-on-surface">{activeFdr.aictePid}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[11px] font-semibold text-secondary block uppercase">Sponsoring Trust</span>
                    <span className="text-on-surface font-medium block">{activeFdr.sponsoringTrust}</span>
                  </div>
                </div>
              </div>

              {/* Real Instrument Custody Trail from Database */}
              <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-teal-700 text-[22px]">history</span>
                    <h3 className="text-sm text-on-surface font-bold">Audit History Timeline</h3>
                  </div>
                  <span className="text-[11px] font-mono text-secondary">
                    {auditLogs.length} {auditLogs.length === 1 ? 'Event' : 'Events'}
                  </span>
                </div>

                {auditLogs.length === 0 ? (
                  <div className="py-4 text-center text-xs text-secondary">
                    No historical events logged yet.
                  </div>
                ) : (
                  <div className="relative pl-5 mt-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container text-xs">
                    {auditLogs.map((log, lIdx) => (
                      <div key={log.id || lIdx} className="relative">
                        <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full bg-teal-600 ring-4 ring-white shadow-xs"></span>
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="font-bold text-slate-900 font-mono text-[11px]">{log.action}</span>
                            <span className="font-mono text-[10px] text-secondary">
                              {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            Actor: <strong>{log.actor_name || log.actor_role}</strong> ({log.actor_role})
                          </div>
                          {log.details && (
                            <p className="text-[11px] text-slate-500 mt-0.5 italic">
                              "{log.details}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        </>
      )}

    </div>
  );
}
