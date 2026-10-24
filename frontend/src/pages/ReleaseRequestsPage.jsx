import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { apiClient } from '../api/client';
import { exportToCSV } from '../data/mockData';

const formatCurrencyINR = (val) => {
  if (val === null || val === undefined) return '₹0.00';
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (isNaN(num)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
};

export default function ReleaseRequestsPage({
  fdrs = [],
  releaseRequests: initialPropRequests = [],
  onUpdateReleaseRequest,
  onCreateReleaseRequest,
  onUpdateFdrStatus
}) {
  const { currentRole, currentUser } = useRole();
  const isInstitution = currentRole === ROLES.INSTITUTION_OFFICER || currentRole === 'INSTITUTION_OFFICER';
  const isApprover = currentRole === ROLES.APPROVING_AUTHORITY || currentRole === 'APPROVING_AUTHORITY';
  const isVerifier = currentRole === ROLES.VERIFICATION_OFFICER || currentRole === 'VERIFICATION_OFFICER';
  const isAdmin = currentRole === ROLES.AICTE_ADMIN || currentRole === 'AICTE_ADMIN';

  // Backend Data State
  const [serverRequests, setServerRequests] = useState([]);
  const [backendFdrs, setBackendFdrs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Active status filter tab
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isReadinessModalOpen, setIsReadinessModalOpen] = useState(false);
  const [isUploadVoucherModalOpen, setIsUploadVoucherModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isResubmitModalOpen, setIsResubmitModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isViewAdviceModalOpen, setIsViewAdviceModalOpen] = useState(false);

  // Active target for modal actions
  const [selectedRequest, setSelectedRequest] = useState(null);

  // Form states
  const [newRequestFdr, setNewRequestFdr] = useState('');
  const [newRequestReason, setNewRequestReason] = useState('Closure of Academic Programme');
  const [newRequestNotes, setNewRequestNotes] = useState('');
  const [readinessRemarks, setReadinessRemarks] = useState('');
  const [voucherRef, setVoucherRef] = useState('');
  const [voucherFile, setVoucherFile] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [correctionRemarks, setCorrectionRemarks] = useState('');
  const [resubmitRemarks, setResubmitRemarks] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // Action feedback toast
  const [actionMessage, setActionMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  const showNotice = (msg) => {
    setActionMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setActionMessage(null), 5000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setActionMessage(null);
    setTimeout(() => setErrorMessage(null), 6000);
  };

  // 1. Fetch real release requests and FDRs from backend
  const fetchReleaseData = useCallback(async () => {
    try {
      setIsLoading(true);
      setFetchError(null);
      const [reqData, fdrData] = await Promise.allSettled([
        apiClient.getRequests({ request_type: 'RELEASE_REFUND' }),
        apiClient.getFdrs({ limit: 100 }),
      ]);

      if (reqData.status === 'fulfilled' && Array.isArray(reqData.value)) {
        setServerRequests(reqData.value);
      } else if (reqData.status === 'rejected') {
        console.error('Failed to load release requests:', reqData.reason);
        setFetchError(reqData.reason?.message || 'Failed to load release requests from backend.');
      }

      if (fdrData.status === 'fulfilled' && fdrData.value?.items) {
        setBackendFdrs(fdrData.value.items);
      }
    } catch (err) {
      console.error('fetchReleaseData error:', err);
      setFetchError(err.message || 'Error communicating with server.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReleaseData();
  }, [fetchReleaseData]);

  // Combined available FDRs (prefer prop if provided, else backend)
  const availableFdrs = useMemo(() => {
    if (fdrs && fdrs.length > 0) return fdrs;
    return backendFdrs.map(f => ({
      ...f,
      fdrNumber: f.fdr_number,
      institutionName: f.institution_name,
      bank: f.bank_name,
      amount: f.amount,
      amountFormatted: formatCurrencyINR(f.amount),
      status: f.status,
    }));
  }, [fdrs, backendFdrs]);

  // Map server requests to display model
  const mappedRequests = useMemo(() => {
    return serverRequests.map(r => {
      const amt = r.amount !== undefined ? r.amount : (r.fdr?.amount || 0);
      return {
        id: r.id,
        fdrId: r.fdr_id,
        fdrNumber: r.fdr_number || r.fdr?.fdr_number || `FDR-${r.fdr_id}`,
        institutionName: r.institution_name || r.fdr?.institution?.name || 'N/A',
        aictePid: r.aicte_pid || r.fdr?.institution?.aicte_pid || (r.institution_id ? `1-${String(r.institution_id).padStart(8, '0')}` : 'N/A'),
        bank: r.bank_name || r.fdr?.bank_name || 'N/A',
        amount: amt,
        amountFormatted: formatCurrencyINR(amt),
        requestType: r.reason || r.request_type || 'Release & Refund',
        submittedDate: r.created_at ? r.created_at.split('T')[0] : 'N/A',
        status: r.status,
        councilOrderRef: r.council_order_ref || null,
        approvalDate: r.updated_at ? r.updated_at.split('T')[0] : null,
        readinessRemarks: r.readiness_remarks || null,
        confirmationRef: r.confirmation_reference || null,
        confirmationVoucher: r.confirmation_reference ? `BANK_RELEASE_ADVICE_${r.confirmation_reference}.pdf` : null,
        confirmationTimestamp: r.confirmation_timestamp || null,
        notes: r.applicant_notes || r.reason || 'N/A',
        officerRemarks: r.officer_remarks || null,
        raw: r,
      };
    });
  }, [serverRequests]);

  // Dynamic counts for tabs
  const counts = useMemo(() => {
    return {
      all: mappedRequests.length,
      under_review: mappedRequests.filter(r => ['REQUESTED', 'UNDER_VERIFICATION', 'CORRECTION_REQUIRED', 'PENDING_APPROVAL'].includes(r.status)).length,
      approved: mappedRequests.filter(r => r.status === 'RELEASE_APPROVED').length,
      awaiting_confirmation: mappedRequests.filter(r => r.status === 'AWAITING_CONFIRMATION').length,
      released: mappedRequests.filter(r => r.status === 'RELEASED_REFUNDED').length,
      closed: mappedRequests.filter(r => ['REJECTED', 'CANCELLED'].includes(r.status)).length,
    };
  }, [mappedRequests]);

  // Filter requests matching search and role scope
  const filteredRequests = useMemo(() => {
    return mappedRequests.filter(req => {
      const s = (searchTerm || '').toLowerCase().trim();
      const matchesSearch =
        !s ||
        (req.fdrNumber || '').toLowerCase().includes(s) ||
        (req.institutionName || '').toLowerCase().includes(s) ||
        (req.bank || '').toLowerCase().includes(s) ||
        (req.confirmationRef || '').toLowerCase().includes(s) ||
        String(req.id).includes(s);

      if (!matchesSearch) return false;

      if (activeTab === 'under_review') {
        return ['REQUESTED', 'UNDER_VERIFICATION', 'CORRECTION_REQUIRED', 'PENDING_APPROVAL'].includes(req.status);
      }
      if (activeTab === 'approved') {
        return req.status === 'RELEASE_APPROVED';
      }
      if (activeTab === 'awaiting_confirmation') {
        return req.status === 'AWAITING_CONFIRMATION';
      }
      if (activeTab === 'released') {
        return req.status === 'RELEASED_REFUNDED';
      }
      if (activeTab === 'closed') {
        return ['REJECTED', 'CANCELLED'].includes(req.status);
      }

      return true;
    });
  }, [mappedRequests, searchTerm, activeTab]);

  // Eligible FDRs for new release request
  const eligibleFdrs = useMemo(() => {
    return availableFdrs.filter(f => {
      const fdrNum = f.fdrNumber || f.fdr_number;
      const hasActiveReq = mappedRequests.some(
        r => r.fdrNumber === fdrNum && !['RELEASED_REFUNDED', 'REJECTED', 'CANCELLED'].includes(r.status)
      );
      if (hasActiveReq) return false;
      const st = (f.status || '').toUpperCase();
      return st === 'ACTIVE' || st === 'MATURING_SOON' || st === 'MATURED';
    });
  }, [availableFdrs, mappedRequests]);

  // ==========================================
  // REAL BACKEND ACTION HANDLERS
  // ==========================================

  // 1. Verification Officer: Start Review
  const handleStartVerification = async (req) => {
    try {
      setIsActionInProgress(true);
      await apiClient.startRequestVerification(req.id);
      showNotice(`Verification initiated for ${req.fdrNumber}. Request moved to UNDER_VERIFICATION.`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(req.id, 'UNDER_VERIFICATION');
    } catch (err) {
      showError(err.message || 'Failed to start review.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 2. Verification Officer: Verify & Recommend
  const handleVerifyApprove = async (req) => {
    try {
      setIsActionInProgress(true);
      await apiClient.verifyWorkflowRequest(req.id, {
        decision: 'VERIFIED',
        remarks: 'Tripartite security verification cleared. Forwarded to Council with recommendation for release.'
      });
      showNotice(`Request ${req.id} verified. Status moved to PENDING_APPROVAL.`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(req.id, 'PENDING_APPROVAL');
    } catch (err) {
      showError(err.message || 'Failed to verify request.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 3. Verification Officer: Clarify / Correction Modal
  const handleOpenCorrectionModal = (req) => {
    setSelectedRequest(req);
    setCorrectionRemarks('');
    setIsCorrectionModalOpen(true);
  };

  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!correctionRemarks.trim()) {
      showError('Please provide clarification remarks for the institution.');
      return;
    }
    try {
      setIsActionInProgress(true);
      await apiClient.verifyWorkflowRequest(selectedRequest.id, {
        decision: 'CORRECTION_REQUIRED',
        remarks: correctionRemarks.trim()
      });
      setIsCorrectionModalOpen(false);
      setSelectedRequest(null);
      showNotice(`Clarification requested for ${selectedRequest.fdrNumber}. Returned to institution as CORRECTION_REQUIRED.`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(selectedRequest.id, 'CORRECTION_REQUIRED');
    } catch (err) {
      showError(err.message || 'Failed to request clarification.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 4. Institution Officer: Resubmit Clarification
  const handleOpenResubmitModal = (req) => {
    setSelectedRequest(req);
    setResubmitRemarks('');
    setIsResubmitModalOpen(true);
  };

  const handleSubmitResubmission = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!resubmitRemarks.trim()) {
      showError('Please provide resubmission remarks / clarification response.');
      return;
    }
    try {
      setIsActionInProgress(true);
      await apiClient.resubmitWorkflowRequest(selectedRequest.id, {
        remarks: resubmitRemarks.trim()
      });
      setIsResubmitModalOpen(false);
      setSelectedRequest(null);
      showNotice(`Clarification resubmitted for ${selectedRequest.fdrNumber}. Request re-queued as REQUESTED.`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(selectedRequest.id, 'REQUESTED');
    } catch (err) {
      showError(err.message || 'Failed to resubmit clarification.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 5. Approving Authority: Approve Release
  const handleApproveRelease = async (req) => {
    try {
      setIsActionInProgress(true);
      const orderRef = `AICTE/FIN/REL/2026/${Math.floor(1000 + Math.random() * 9000)}`;
      await apiClient.approveWorkflowRequest(req.id, {
        decision: 'APPROVED',
        council_order_ref: orderRef,
        reason: 'Council Release Sanction ratified per APH Clause 14.'
      });
      showNotice(`Council Release Sanction ratified (${orderRef}). Request is now RELEASE_APPROVED. Next: Confirm Readiness.`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(req.id, 'RELEASE_APPROVED');
    } catch (err) {
      showError(err.message || 'Failed to approve release request.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 6. Approving Authority: Reject Modal
  const handleOpenRejectModal = (req) => {
    setSelectedRequest(req);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleSubmitRejection = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!rejectReason.trim()) {
      showError('Mandatory rejection reason required by AICTE statutory policy.');
      return;
    }
    try {
      setIsActionInProgress(true);
      await apiClient.approveWorkflowRequest(selectedRequest.id, {
        decision: 'REJECTED',
        reason: rejectReason.trim()
      });
      setIsRejectModalOpen(false);
      setSelectedRequest(null);
      showNotice(`Release Request ${selectedRequest.id} REJECTED. Underlying FDR status remains unchanged.`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(selectedRequest.id, 'REJECTED');
    } catch (err) {
      showError(err.message || 'Failed to reject release request.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 7. Designated Officer: Confirm Readiness (Required before confirmation)
  const handleOpenReadinessModal = (req) => {
    if (req.status !== 'RELEASE_APPROVED') {
      showError(`Cannot confirm readiness: current status is ${req.status}, must be RELEASE_APPROVED.`);
      return;
    }
    setSelectedRequest(req);
    setReadinessRemarks(`NOC issued per Council Order ${req.councilOrderRef || '918/2026'}. Branch communication established. Supporting ledger details ready for recording.`);
    setIsReadinessModalOpen(true);
  };

  const handleSubmitReadiness = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      setIsActionInProgress(true);
      await apiClient.setReleaseReadiness(selectedRequest.id, {
        remarks: readinessRemarks || 'Supporting confirmation details are ready for recording.'
      });
      setIsReadinessModalOpen(false);
      setSelectedRequest(null);
      showNotice(`Readiness confirmed for ${selectedRequest.fdrNumber}. Status moved to AWAITING_CONFIRMATION. Bank payment advice may now be recorded.`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(selectedRequest.id, 'AWAITING_CONFIRMATION');
    } catch (err) {
      showError(err.message || 'Failed to confirm release readiness.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 8. Designated Officer: Confirm Release with Bank Voucher & UTR
  const handleOpenVoucherModal = (req) => {
    if (req.status !== 'AWAITING_CONFIRMATION') {
      showError(`Invalid workflow action: Cannot confirm release from ${req.status}. Readiness must be confirmed first (status must be AWAITING_CONFIRMATION).`);
      return;
    }
    setSelectedRequest(req);
    setVoucherRef(`UTR-${(req.bank || 'SBI').slice(0, 3).toUpperCase()}-2026-${Math.floor(100000 + Math.random() * 900000)}`);
    setVoucherFile(null);
    setIsUploadVoucherModalOpen(true);
  };

  const handleSubmitVoucher = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!voucherRef.trim()) {
      showError('Please specify a valid UTR / bank voucher reference.');
      return;
    }
    try {
      setIsActionInProgress(true);
      await apiClient.confirmReleaseDisbursement(selectedRequest.id, {
        confirmation_reference: voucherRef.trim(),
        remarks: `Disbursement confirmation recorded (SIMULATED/DEMO). Ref: ${voucherRef.trim()}`
      });
      setIsUploadVoucherModalOpen(false);
      setSelectedRequest(null);
      showNotice(`Release & Refund Confirmed! UTR ${voucherRef.trim()} recorded. Request moved to RELEASED_REFUNDED (Demo Simulation).`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(selectedRequest.id, 'RELEASED_REFUNDED');
      if (onUpdateFdrStatus) onUpdateFdrStatus(selectedRequest.fdrId, 'RELEASED_REFUNDED');
    } catch (err) {
      showError(err.message || 'Failed to confirm release disbursement.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 9. Cancel Request Modal
  const handleOpenCancelModal = (req) => {
    setSelectedRequest(req);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleSubmitCancel = async (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    if (!cancelReason.trim()) {
      showError('Mandatory cancellation reason required.');
      return;
    }
    try {
      setIsActionInProgress(true);
      await apiClient.cancelWorkflowRequest(selectedRequest.id, {
        reason: cancelReason.trim()
      });
      setIsCancelModalOpen(false);
      setSelectedRequest(null);
      showNotice(`Release request ${selectedRequest.id} cancelled. Underlying FDR remains in AICTE custody.`);
      await fetchReleaseData();
      if (onUpdateReleaseRequest) onUpdateReleaseRequest(selectedRequest.id, 'CANCELLED');
    } catch (err) {
      showError(err.message || 'Failed to cancel release request.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  // 10. View Advice Modal
  const handleOpenViewAdvice = (req) => {
    setSelectedRequest(req);
    setIsViewAdviceModalOpen(true);
  };

  // 11. Create Release Request
  const handleCreateRequest = async (e) => {
    e.preventDefault();
    const targetFdr = availableFdrs.find(f => (f.fdrNumber || f.fdr_number) === newRequestFdr) || eligibleFdrs[0];
    if (!targetFdr) {
      showError('Please select a valid FDR instrument to release.');
      return;
    }

    try {
      setIsActionInProgress(true);
      await apiClient.createReleaseRequest(targetFdr.id || targetFdr.fdr_id, {
        reason: newRequestReason,
        applicant_notes: newRequestNotes || 'Statutory compliance complete. Excess deposit refund requested per APH Regulation 14(C).'
      });
      setIsSubmitModalOpen(false);
      setNewRequestNotes('');
      showNotice(`Release request submitted for ${targetFdr.fdrNumber || targetFdr.fdr_number} (Status: REQUESTED). Queued for Scrutiny.`);
      await fetchReleaseData();
    } catch (err) {
      showError(err.message || 'Failed to create release request.');
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleExportCSV = () => {
    exportToCSV('AICTE_FDR_Release_Requests.csv', filteredRequests.map(r => ({
      'Request ID': r.id,
      'FDR Number': r.fdrNumber,
      'Institution': r.institutionName,
      'PID': r.aictePid,
      'Bank': r.bank,
      'Deposit Amount': r.amount,
      'Grounds': r.requestType,
      'Submitted Date': r.submittedDate,
      'Workflow Status': r.status,
      'Council Order Ref': r.councilOrderRef || 'N/A',
      'Approval Date': r.approvalDate || 'N/A',
      'Readiness Remarks': r.readinessRemarks || 'N/A',
      'UTR Reference': r.confirmationRef || 'N/A',
      'Confirmation Voucher': r.confirmationVoucher || 'N/A'
    })));
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs text-secondary font-label-sm uppercase tracking-wider mb-1">
            <span>Regulatory Financial Custody</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-semibold">Securities Release & Refund Protocol</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              FDR Release & Refund Requests
            </h1>
            <span className="font-label-sm text-xs text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full font-semibold">
              Statutory Two-Phase Protocol
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Canonical sequence: <span className="font-mono font-semibold text-on-surface">REQUESTED → UNDER_VERIFICATION → PENDING_APPROVAL → RELEASE_APPROVED → AWAITING_CONFIRMATION → RELEASED_REFUNDED</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={fetchReleaseData}
            disabled={isLoading || isActionInProgress}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold disabled:opacity-50"
            type="button"
            title="Refresh from server"
          >
            <span className={`material-symbols-outlined text-[17px] ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span>Export Roll (CSV)</span>
          </button>

          {(isInstitution || isAdmin) && (
            <button
              onClick={() => {
                if (eligibleFdrs.length > 0) {
                  setNewRequestFdr(eligibleFdrs[0].fdrNumber || eligibleFdrs[0].fdr_number);
                }
                setIsSubmitModalOpen(true);
              }}
              className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-4 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">add_circle</span>
              <span>Initiate Release Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification Toast */}
      {actionMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span>
            <span>{actionMessage}</span>
          </div>
          <span className="font-mono text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded">STATUS 200 OK</span>
        </div>
      )}

      {/* Error Notification Toast */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-700 text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
          <span className="font-mono text-rose-800 font-bold bg-rose-100 px-2 py-0.5 rounded">ACTION FAILED</span>
        </div>
      )}

      {/* Fetch Error Banner with Retry */}
      {fetchError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center justify-between text-xs shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-700 text-[20px]">cloud_off</span>
            <span>{fetchError}</span>
          </div>
          <button
            onClick={fetchReleaseData}
            className="px-3 py-1 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Workflow Rule Explainer Alert */}
      <div className="p-4 rounded-xl bg-teal-50/80 border border-teal-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-teal-950">
        <div className="flex items-start gap-2.5">
          <span className="material-symbols-outlined text-teal-700 text-[22px] shrink-0 mt-0.5">verified_user</span>
          <div className="space-y-1">
            <div className="font-bold text-teal-900">Regulatory Safeguards under APH Regulation 14(B) & 14(C):</div>
            <div className="text-[11px] text-teal-900/90 leading-relaxed">
              1. <strong>Verification Phase:</strong> Scrutiny Officer verifies eligibility and recommends case (<code className="font-mono font-semibold">UNDER_VERIFICATION → PENDING_APPROVAL</code>).<br />
              2. <strong>Approval Phase:</strong> Approving Authority issues Council Sanction (<code className="font-mono font-semibold">RELEASE_APPROVED</code>). If rejected, the underlying FDR remains <strong>Active</strong>.<br />
              3. <strong>Readiness Phase:</strong> Designated Officer confirms readiness (<code className="font-mono font-semibold">AWAITING_CONFIRMATION</code>). <em>Direct confirmation from RELEASE_APPROVED is rejected with 409 Conflict.</em><br />
              4. <strong>Settlement Phase:</strong> Bank disbursement advice and UTR are recorded (<code className="font-mono font-semibold">RELEASED_REFUNDED</code>). <em>Disbursement confirmation is simulated for demonstration and audit recording; no real funds are transferred.</em>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-2xl border border-surface-container">
        {/* Tabs with Dynamic Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span>All Requests</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
              activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary'
            }`}>
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('under_review')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'under_review'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span>Under Review</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
              activeTab === 'under_review' ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary'
            }`}>
              {counts.under_review}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('approved')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'approved'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span>Release Approved</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
              activeTab === 'approved' ? 'bg-white/20 text-white' : 'bg-teal-100 text-teal-800'
            }`}>
              {counts.approved}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('awaiting_confirmation')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'awaiting_confirmation'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span>Awaiting Confirmation</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
              activeTab === 'awaiting_confirmation' ? 'bg-white/20 text-white' : counts.awaiting_confirmation > 0 ? 'bg-purple-100 text-purple-800' : 'bg-surface-container text-secondary'
            }`}>
              {counts.awaiting_confirmation}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('released')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'released'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span>Fully Released</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
              activeTab === 'released' ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary'
            }`}>
              {counts.released}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('closed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors inline-flex items-center gap-1.5 ${
              activeTab === 'closed'
                ? 'bg-primary text-white shadow-xs'
                : 'text-secondary hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            <span>Rejected / Cancelled</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
              activeTab === 'closed' ? 'bg-white/20 text-white' : 'bg-surface-container text-secondary'
            }`}>
              {counts.closed}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-secondary text-[18px]">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search FDR, Bank or College..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Release Requests Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-surface-container bg-surface-container-low/40 text-secondary uppercase font-label-sm text-[11px] tracking-wider">
                <th className="py-3 px-4 font-semibold">FDR / Request Ref</th>
                <th className="py-3 px-4 font-semibold">Institution & Trust</th>
                <th className="py-3 px-4 font-semibold">Issuing Bank</th>
                <th className="py-3 px-4 font-semibold">Principal Amount</th>
                <th className="py-3 px-4 font-semibold">Grounds & Submissions</th>
                <th className="py-3 px-4 font-semibold">Workflow Status</th>
                <th className="py-3 px-4 font-semibold text-right">Statutory Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-secondary">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-primary animate-spin">progress_activity</span>
                      <span className="font-semibold text-xs text-on-surface">Loading release requests from backend...</span>
                      <span className="text-[11px] text-secondary">Synchronizing regulatory state</span>
                    </div>
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-secondary">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[32px] text-secondary/60">rule_folder</span>
                      <span className="font-semibold text-xs text-on-surface">No release requests in this filter</span>
                      <span className="text-[11px] text-secondary">Try switching status tabs or search parameters</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  return (
                    <tr key={req.id} className="hover:bg-surface-container-low/50 transition-colors">
                      {/* FDR / Request Ref */}
                      <td className="py-3.5 px-4 font-data-mono font-semibold text-on-surface">
                        <div className="flex flex-col">
                          <span className="text-primary font-bold">{req.fdrNumber}</span>
                          <span className="text-[10px] text-secondary font-mono">ID: {req.id}</span>
                        </div>
                      </td>

                      {/* Institution */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-on-surface">{req.institutionName}</span>
                          <span className="text-[10px] text-secondary font-data-mono">PID: {req.aictePid}</span>
                        </div>
                      </td>

                      {/* Bank */}
                      <td className="py-3.5 px-4 text-secondary">
                        {req.bank}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 font-data-mono font-bold text-on-surface">
                        {req.amountFormatted}
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 text-secondary">
                        <div className="flex flex-col">
                          <span className="text-on-surface font-medium">{req.requestType}</span>
                          <span className="text-[10px] text-secondary">Sub: {req.submittedDate}</span>
                          {req.councilOrderRef && (
                            <span className="text-[10px] text-teal-800 font-mono font-semibold">Order: {req.councilOrderRef}</span>
                          )}
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-4">
                        {req.status === 'REQUESTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                            <span>Requested</span>
                          </span>
                        )}
                        {req.status === 'UNDER_VERIFICATION' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                            <span>Under Verification</span>
                          </span>
                        )}
                        {req.status === 'CORRECTION_REQUIRED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            <span>Correction Required</span>
                          </span>
                        )}
                        {req.status === 'PENDING_APPROVAL' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-600"></span>
                            <span>Pending Approval</span>
                          </span>
                        )}
                        {req.status === 'RELEASE_APPROVED' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-600"></span>
                              <span>Release Approved</span>
                            </span>
                            <span className="text-[10px] text-secondary font-medium">Needs Readiness Sign-off</span>
                          </div>
                        )}
                        {req.status === 'AWAITING_CONFIRMATION' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse"></span>
                              <span>Awaiting Confirmation</span>
                            </span>
                            <span className="text-[10px] text-purple-900 font-medium">Ready for Bank Voucher</span>
                          </div>
                        )}
                        {req.status === 'RELEASED_REFUNDED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            <span>Released/Refunded</span>
                          </span>
                        )}
                        {req.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            <span>Release Rejected</span>
                          </span>
                        )}
                        {req.status === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <span>Cancelled</span>
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 1. REQUESTED State Actions */}
                          {req.status === 'REQUESTED' && (
                            <>
                              {(isVerifier || isAdmin) && (
                                <button
                                  onClick={() => handleStartVerification(req)}
                                  disabled={isActionInProgress}
                                  className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                  title="Take ownership of review"
                                >
                                  <span className="material-symbols-outlined text-[15px]">assignment_turned_in</span>
                                  <span>Start Review</span>
                                </button>
                              )}
                              {(isInstitution || isAdmin) && (
                                <button
                                  onClick={() => handleOpenCancelModal(req)}
                                  disabled={isActionInProgress}
                                  className="px-2 py-1.5 rounded-lg border border-surface-container text-secondary hover:text-error hover:border-rose-300 text-xs font-medium transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                                  title="Withdraw release request"
                                >
                                  <span className="material-symbols-outlined text-[15px]">cancel</span>
                                  <span>Withdraw</span>
                                </button>
                              )}
                            </>
                          )}

                          {/* 2. UNDER_VERIFICATION State Actions */}
                          {req.status === 'UNDER_VERIFICATION' && (
                            <>
                              {(isVerifier || isAdmin) && (
                                <>
                                  <button
                                    onClick={() => handleVerifyApprove(req)}
                                    disabled={isActionInProgress}
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                    title="Recommend for Council Approval"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">thumb_up</span>
                                    <span>Verify & Recommend</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenCorrectionModal(req)}
                                    disabled={isActionInProgress}
                                    className="px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                                    title="Request clarification / return for correction"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">rate_review</span>
                                    <span>Clarify</span>
                                  </button>
                                </>
                              )}
                            </>
                          )}

                          {/* 3. CORRECTION_REQUIRED State Actions */}
                          {req.status === 'CORRECTION_REQUIRED' && (
                            <>
                              {(isInstitution || isAdmin) && (
                                <button
                                  onClick={() => handleOpenResubmitModal(req)}
                                  disabled={isActionInProgress}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                  title="Resubmit amended documents"
                                >
                                  <span className="material-symbols-outlined text-[15px]">replay</span>
                                  <span>Resubmit</span>
                                </button>
                              )}
                            </>
                          )}

                          {/* 4. PENDING_APPROVAL State Actions */}
                          {req.status === 'PENDING_APPROVAL' && (
                            <>
                              {(isApprover || isAdmin) && (
                                <>
                                  <button
                                    onClick={() => handleApproveRelease(req)}
                                    disabled={isActionInProgress}
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                    title="Issue Council Release Sanction"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">gavel</span>
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenRejectModal(req)}
                                    disabled={isActionInProgress}
                                    className="px-2 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                                    title="Reject release request"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">close</span>
                                    <span>Reject</span>
                                  </button>
                                </>
                              )}
                            </>
                          )}

                          {/* 5. RELEASE_APPROVED State Actions: Must confirm readiness first */}
                          {req.status === 'RELEASE_APPROVED' && (
                            <>
                              {(isApprover || isAdmin || isVerifier) && (
                                <button
                                  onClick={() => handleOpenReadinessModal(req)}
                                  disabled={isActionInProgress}
                                  className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                  title="Confirm release readiness (moves to AWAITING_CONFIRMATION)"
                                >
                                  <span className="material-symbols-outlined text-[15px]">rule</span>
                                  <span>Confirm Readiness</span>
                                </button>
                              )}
                            </>
                          )}

                          {/* 6. AWAITING_CONFIRMATION State Actions: Record final voucher */}
                          {req.status === 'AWAITING_CONFIRMATION' && (
                            <>
                              {(isApprover || isAdmin) && (
                                <button
                                  onClick={() => handleOpenVoucherModal(req)}
                                  disabled={isActionInProgress}
                                  className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors disabled:opacity-50"
                                  title="Upload Bank Credit Advice & UTR"
                                >
                                  <span className="material-symbols-outlined text-[15px]">upload_file</span>
                                  <span>Upload Voucher & UTR</span>
                                </button>
                              )}
                            </>
                          )}

                          {/* 7. RELEASED_REFUNDED State Actions */}
                          {req.status === 'RELEASED_REFUNDED' && (
                            <button
                              onClick={() => handleOpenViewAdvice(req)}
                              className="px-2.5 py-1.5 rounded-lg border border-surface-container bg-surface-container-low text-on-surface text-xs font-semibold hover:bg-surface-container transition-colors inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px] text-teal-700">receipt_long</span>
                              <span>View Advice</span>
                            </button>
                          )}

                          {/* 8. REJECTED / CANCELLED Details */}
                          {['REJECTED', 'CANCELLED'].includes(req.status) && (
                            <button
                              onClick={() => handleOpenViewAdvice(req)}
                              className="px-2 py-1.5 rounded-lg border border-surface-container text-secondary hover:text-on-surface hover:bg-surface-container text-xs font-medium inline-flex items-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[15px]">info</span>
                              <span>Details</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================== */}
      {/* MODALS */}
      {/* ========================================== */}

      {/* MODAL 1: Create Release Request */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">assignment_add</span>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  Initiate FDR Release & Refund Request
                </h2>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Select Pledged FDR Instrument <span className="text-error">*</span>
                </label>
                {eligibleFdrs.length === 0 ? (
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                    No active or mature FDR instruments eligible for release request. Existing instruments may already have active requests.
                  </div>
                ) : (
                  <select
                    value={newRequestFdr}
                    onChange={(e) => setNewRequestFdr(e.target.value)}
                    className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {eligibleFdrs.map(f => (
                      <option key={f.id || f.fdr_id} value={f.fdrNumber || f.fdr_number}>
                        {f.fdrNumber || f.fdr_number} — {f.bank || f.bank_name} ({f.amountFormatted || formatCurrencyINR(f.amount)})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Grounds for Release Petition <span className="text-error">*</span>
                </label>
                <select
                  value={newRequestReason}
                  onChange={(e) => setNewRequestReason(e.target.value)}
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="Closure of Academic Programme">Closure of Academic Programme (All batches graduated)</option>
                  <option value="Excess Collateral Refund">Excess Collateral Refund (Post Statutory 8-Year Period)</option>
                  <option value="Autonomous Status Transition">Autonomous Status Transition (Reduced Collateral Requirement)</option>
                  <option value="Surplus Reserve Release">Surplus Reserve Release (APH Regulation Clause 14(C))</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Supporting Governing Body Resolution & NOC Letter (PDF)
                </label>
                <div className="border border-dashed border-surface-container-high rounded-xl p-3 bg-surface-container-low/40 text-center">
                  <span className="material-symbols-outlined text-secondary text-[24px]">cloud_upload</span>
                  <div className="text-xs text-secondary mt-1">Supporting resolution registered in dossier</div>
                  <div className="text-[10px] text-secondary/80 mt-0.5">Verification officer checks governing body certificates during review</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Applicant Remarks / Justification
                </label>
                <textarea
                  rows="3"
                  value={newRequestNotes}
                  onChange={(e) => setNewRequestNotes(e.target.value)}
                  placeholder="Detail institutional justification, zero pending liabilities, student clearance, etc."
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-xs font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={eligibleFdrs.length === 0 || isActionInProgress}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isActionInProgress && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>Submit Release Petition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Confirm Release Readiness (Required before confirmation) */}
      {isReadinessModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-teal-50/60">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-teal-800 text-[22px]">rule</span>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Confirm Release Readiness
                  </h2>
                  <p className="text-xs text-secondary">
                    FDR: <span className="font-mono font-bold text-on-surface">{selectedRequest.fdrNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReadinessModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitReadiness} className="p-6 space-y-4">
              <div className="p-3.5 bg-teal-50 rounded-xl border border-teal-200 text-xs text-teal-950 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[17px] text-teal-700">info</span>
                  <span>Statutory Readiness Checkpoint:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Council Release Order <strong>{selectedRequest.councilOrderRef || 'AICTE/FIN/REL/2026/918'}</strong> has been issued. Confirming readiness certifies that all institutional clearances and NOC letters are prepared. This step advances status to <strong>AWAITING_CONFIRMATION</strong>; it explicitly records administrative readiness without moving funds.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Designated Officer Readiness Remarks <span className="text-error">*</span>
                </label>
                <textarea
                  rows="3"
                  value={readinessRemarks}
                  onChange={(e) => setReadinessRemarks(e.target.value)}
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsReadinessModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-xs font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionInProgress}
                  className="px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isActionInProgress && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>Confirm Readiness Sign-off</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Confirm Release with Bank Voucher & UTR (Only from AWAITING_CONFIRMATION) */}
      {isUploadVoucherModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-purple-50/60">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-purple-700 text-[22px]">upload_file</span>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Record Disbursement Confirmation
                  </h2>
                  <p className="text-xs text-secondary">
                    FDR: <span className="font-mono font-bold text-on-surface">{selectedRequest.fdrNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUploadVoucherModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitVoucher} className="p-6 space-y-4">
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-xs text-purple-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-purple-700">warning</span>
                  <span>Statutory Demonstration Protocol:</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  In this demonstration environment, funds transfer is simulated. Entering the bank confirmation UTR reference permanently sets request status to <strong>RELEASED_REFUNDED</strong> and closes the statutory lien in the registry.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Bank UTR / Confirmation Reference <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={voucherRef}
                  onChange={(e) => setVoucherRef(e.target.value)}
                  placeholder="e.g. UTR-SBI-2026-928471"
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 font-mono text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Upload Bank Credit Advice / Voucher Document (Optional PDF)
                </label>
                <div className="border border-dashed border-surface-container-high rounded-xl p-3 bg-surface-container-low/40 text-center">
                  <span className="material-symbols-outlined text-secondary text-[24px]">description</span>
                  <div className="text-xs text-secondary mt-1">
                    {voucherFile ? voucherFile.name : 'Voucher ledger documentation registered'}
                  </div>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    id="voucher-file-upload"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setVoucherFile(e.target.files[0]);
                      }
                    }}
                  />
                  <label
                    htmlFor="voucher-file-upload"
                    className="mt-2 inline-block px-3 py-1 bg-surface-container text-xs font-semibold rounded-lg cursor-pointer hover:bg-surface-container-high"
                  >
                    {voucherFile ? 'Change File' : 'Browse PDF'}
                  </label>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsUploadVoucherModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-xs font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionInProgress}
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isActionInProgress && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>Confirm Release & Record Voucher</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Reject Release Request */}
      {isRejectModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-rose-50/60">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-rose-700 text-[22px]">gavel</span>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Reject Security Deposit Release
                  </h2>
                  <p className="text-xs text-secondary">
                    FDR: <span className="font-mono font-bold text-on-surface">{selectedRequest.fdrNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitRejection} className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-xs text-rose-950">
                <strong>Regulatory Invariant:</strong> Rejecting this petition marks the request as <strong className="text-rose-800">REJECTED</strong>. The underlying Fixed Deposit Receipt remains <strong className="text-teal-800">ACTIVE</strong> and pledged under AICTE lien.
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Reason for Rejection <span className="text-error">*</span>
                </label>
                <textarea
                  rows="3"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="State non-compliance grounds, student dues pending, or deficiency under APH Clause 14..."
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-xs font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionInProgress}
                  className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isActionInProgress && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Request Clarification / Correction */}
      {isCorrectionModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-800 text-[22px]">rate_review</span>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Return for Correction
                  </h2>
                  <p className="text-xs text-secondary">
                    FDR: <span className="font-mono font-bold text-on-surface">{selectedRequest.fdrNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCorrectionModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Deficiency / Clarification Required Remarks <span className="text-error">*</span>
                </label>
                <textarea
                  rows="3"
                  value={correctionRemarks}
                  onChange={(e) => setCorrectionRemarks(e.target.value)}
                  placeholder="Specify missing governing body resolution, account discrepancies, etc."
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-xs font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionInProgress}
                  className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isActionInProgress && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>Return for Clarification</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Resubmit Clarification */}
      {isResubmitModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-amber-50/60">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-amber-800 text-[22px]">replay</span>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Resubmit Release Clarification
                  </h2>
                  <p className="text-xs text-secondary">
                    FDR: <span className="font-mono font-bold text-on-surface">{selectedRequest.fdrNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsResubmitModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitResubmission} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950">
                Previous Observation: <em>{selectedRequest.officerRemarks || selectedRequest.notes}</em>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Amended Details & Compliance Statement <span className="text-error">*</span>
                </label>
                <textarea
                  rows="3"
                  value={resubmitRemarks}
                  onChange={(e) => setResubmitRemarks(e.target.value)}
                  placeholder="Explain how the requested deficiencies have been rectified..."
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsResubmitModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-xs font-semibold text-secondary hover:bg-surface-container"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isActionInProgress}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isActionInProgress && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>Resubmit for Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 7: Cancel Release Request */}
      {isCancelModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-slate-700 text-[22px]">cancel</span>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Cancel Release Request
                  </h2>
                  <p className="text-xs text-secondary">
                    FDR: <span className="font-mono font-bold text-on-surface">{selectedRequest.fdrNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitCancel} className="p-6 space-y-4">
              <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-800">
                Cancelling this petition withdraws the release request. The underlying FDR will remain <strong>Active</strong> in AICTE custody.
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Reason for Cancellation <span className="text-error">*</span>
                </label>
                <textarea
                  rows="2"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Sponsoring trust elected to maintain program accreditation..."
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low p-2.5 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-xs font-semibold text-secondary hover:bg-surface-container"
                >
                  Keep Request
                </button>
                <button
                  type="submit"
                  disabled={isActionInProgress}
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isActionInProgress && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 8: View Advice & Audit Details */}
      {isViewAdviceModalOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-teal-800 text-[22px]">verified</span>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Release Audit Trail & Advice
                  </h2>
                  <p className="text-xs text-secondary">
                    FDR: <span className="font-mono font-bold text-on-surface">{selectedRequest.fdrNumber}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsViewAdviceModalOpen(false)}
                className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-[11px] text-teal-950">
                <strong>Simulated Disbursement Disclaimer:</strong> This advice record documents regulatory confirmation under the demonstration environment. No physical banking transfer occurred.
              </div>

              <div className="grid grid-cols-2 gap-3 bg-surface-container-low/50 p-4 rounded-xl border border-surface-container">
                <div>
                  <span className="text-[10px] uppercase font-bold text-secondary block">Council Sanction Ref</span>
                  <span className="font-mono font-semibold text-on-surface">{selectedRequest.councilOrderRef || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-secondary block">Sanction Date</span>
                  <span className="font-medium text-on-surface">{selectedRequest.approvalDate || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-secondary block">Bank UTR Reference</span>
                  <span className="font-mono font-bold text-emerald-800">{selectedRequest.confirmationRef || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-secondary block">Disbursement Voucher</span>
                  <span className="font-medium text-on-surface truncate block">{selectedRequest.confirmationVoucher || 'N/A'}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-secondary block mb-1">Readiness Sign-off</span>
                <p className="text-secondary bg-surface-container-low p-2.5 rounded-lg border border-surface-container leading-relaxed">
                  {selectedRequest.readinessRemarks || 'Readiness confirmed prior to voucher recording.'}
                </p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-secondary block mb-1">Audit Ledger Notes</span>
                <p className="text-secondary bg-surface-container-low p-2.5 rounded-lg border border-surface-container leading-relaxed">
                  {selectedRequest.notes}
                </p>
              </div>

              <div className="pt-2 flex justify-end border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsViewAdviceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container text-xs font-semibold text-on-surface hover:bg-surface-container-high"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
