import React, { useState, useMemo } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { FDR_STATUSES, exportToCSV } from '../data/mockData';

export default function ReleaseRequestsPage({
  fdrs = [],
  releaseRequests = [],
  onUpdateReleaseRequest,
  onCreateReleaseRequest,
  onUpdateFdrStatus
}) {
  const { currentRole, currentUser } = useRole();
  const isInstitution = currentRole === ROLES.INSTITUTION_OFFICER;
  const isApprover = currentRole === ROLES.APPROVING_AUTHORITY;
  const isVerifier = currentRole === ROLES.VERIFICATION_OFFICER;
  const isAdmin = currentRole === ROLES.AICTE_ADMIN;

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

  // Filter requests matching search and role scope
  const filteredRequests = useMemo(() => {
    return releaseRequests.filter(req => {
      // Role scope: Institution only sees own requests in strict mode
      if (isInstitution) {
        const userPid = currentUser?.aictePid || currentUser?.pid;
        const userInst = (currentUser?.institutionName || currentUser?.institution || '').toLowerCase();
        const matchesPid = userPid && req.aictePid === userPid;
        const matchesInst = userInst && req.institutionName && req.institutionName.toLowerCase().includes(userInst);
        const matchesFallback = req.aictePid === '1-10928374' || (req.institutionName && req.institutionName.includes("St. Xavier's"));
        if (!matchesPid && !matchesInst && !matchesFallback) {
          return false;
        }
      }

      const matchesSearch =
        !searchTerm ||
        req.fdrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.institutionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.bank.toLowerCase().includes(searchTerm.toLowerCase());

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
  }, [releaseRequests, searchTerm, activeTab, isInstitution, currentUser]);

  // Dynamic counts for tabs
  const counts = useMemo(() => {
    return {
      all: releaseRequests.length,
      under_review: releaseRequests.filter(r => ['REQUESTED', 'UNDER_VERIFICATION', 'CORRECTION_REQUIRED', 'PENDING_APPROVAL'].includes(r.status)).length,
      approved: releaseRequests.filter(r => r.status === 'RELEASE_APPROVED').length,
      awaiting_confirmation: releaseRequests.filter(r => r.status === 'AWAITING_CONFIRMATION').length,
      released: releaseRequests.filter(r => r.status === 'RELEASED_REFUNDED').length,
      closed: releaseRequests.filter(r => ['REJECTED', 'CANCELLED'].includes(r.status)).length,
    };
  }, [releaseRequests]);

  // Eligible FDRs for new release request
  const eligibleFdrs = useMemo(() => {
    return fdrs.filter(f => {
      // Only active FDRs that do not already have an active release request
      const hasActiveReq = releaseRequests.some(r => r.fdrNumber === f.fdrNumber && !['RELEASED_REFUNDED', 'REJECTED', 'CANCELLED'].includes(r.status));
      if (hasActiveReq) return false;
      if (isInstitution && f.aictePid !== '1-10928374') return false;
      return f.status === FDR_STATUSES.ACTIVE || f.status === 'Active' || f.status === FDR_STATUSES.MATURING_SOON;
    });
  }, [fdrs, releaseRequests, isInstitution]);

  const showNotice = (msg) => {
    setActionMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setActionMessage(null), 4500);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setActionMessage(null);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // Safe transition trigger calling parent App.jsx handler
  const triggerTransition = (requestId, transitionType, payload = {}) => {
    if (onUpdateReleaseRequest) {
      const res = onUpdateReleaseRequest(requestId, transitionType, payload);
      if (res && res.success === false) {
        showError(res.error);
        return false;
      }
    }
    return true;
  };

  // Handlers for workflow actions
  const handleStartVerification = (req) => {
    const ok = triggerTransition(req.id, 'START_VERIFICATION');
    if (ok) showNotice(`Verification initiated for ${req.fdrNumber}. Request moved to UNDER_VERIFICATION.`);
  };

  const handleVerifyApprove = (req) => {
    const ok = triggerTransition(req.id, 'VERIFY_APPROVE', {
      remarks: 'Tripartite security verification cleared. Forwarded to Council with recommendation for release.'
    });
    if (ok) showNotice(`Request ${req.id} verified. Status moved to PENDING_APPROVAL.`);
  };

  const handleOpenCorrectionModal = (req) => {
    setSelectedRequest(req);
    setCorrectionRemarks('');
    setIsCorrectionModalOpen(true);
  };

  const handleSubmitCorrection = (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const ok = triggerTransition(selectedRequest.id, 'REQUEST_CORRECTION', {
      remarks: correctionRemarks || 'Deficiency noted: Governing body program closure certificate required.'
    });
    setIsCorrectionModalOpen(false);
    setSelectedRequest(null);
    if (ok) showNotice(`Clarification requested for ${selectedRequest.fdrNumber}. Returned to institution as CORRECTION_REQUIRED.`);
  };

  const handleOpenResubmitModal = (req) => {
    setSelectedRequest(req);
    setResubmitRemarks('');
    setIsResubmitModalOpen(true);
  };

  const handleSubmitResubmission = (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const ok = triggerTransition(selectedRequest.id, 'RESUBMIT', {
      remarks: resubmitRemarks || 'Amended program closure documentation submitted.'
    });
    setIsResubmitModalOpen(false);
    setSelectedRequest(null);
    if (ok) showNotice(`Clarification resubmitted for ${selectedRequest.fdrNumber}. Request re-queued as REQUESTED.`);
  };

  const handleApproveRelease = (req) => {
    const orderRef = `AICTE/FIN/REL/2024/${Math.floor(1000 + Math.random() * 9000)}`;
    const ok = triggerTransition(req.id, 'APPROVE', { orderRef });
    if (ok) showNotice(`Council Release Sanction ratified (${orderRef}). Request is now RELEASE_APPROVED. Next: Confirm Readiness.`);
  };

  const handleOpenRejectModal = (req) => {
    setSelectedRequest(req);
    setRejectReason('');
    setIsRejectModalOpen(true);
  };

  const handleSubmitRejection = (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const ok = triggerTransition(selectedRequest.id, 'REJECT', {
      reason: rejectReason || 'Release criteria not satisfied under APH 2024-25 Clause 14.'
    });
    setIsRejectModalOpen(false);
    setSelectedRequest(null);
    if (ok) showNotice(`Release Request ${selectedRequest.id} REJECTED. Underlying FDR remains ACTIVE in accordance with regulatory invariants.`);
  };

  const handleOpenReadinessModal = (req) => {
    // Invariant check: only permitted from RELEASE_APPROVED
    if (req.status !== 'RELEASE_APPROVED') {
      showError(`Cannot confirm readiness: current status is ${req.status}, must be RELEASE_APPROVED.`);
      return;
    }
    setSelectedRequest(req);
    setReadinessRemarks(`NOC issued per Council Order ${req.councilOrderRef || '918/2024'}. Branch communication established. Supporting ledger details ready for recording.`);
    setIsReadinessModalOpen(true);
  };

  const handleSubmitReadiness = (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const ok = triggerTransition(selectedRequest.id, 'CONFIRM_READINESS', {
      remarks: readinessRemarks
    });
    setIsReadinessModalOpen(false);
    setSelectedRequest(null);
    if (ok) showNotice(`Readiness confirmed for ${selectedRequest.fdrNumber}. Status moved to AWAITING_CONFIRMATION. Bank payment advice may now be recorded.`);
  };

  const handleOpenVoucherModal = (req) => {
    // Invariant check: CANNOT skip AWAITING_CONFIRMATION!
    if (req.status !== 'AWAITING_CONFIRMATION') {
      showError(`Invalid workflow action: Cannot confirm release from ${req.status}. Readiness must be confirmed first (status must be AWAITING_CONFIRMATION).`);
      return;
    }
    setSelectedRequest(req);
    setVoucherRef(`UTR-${req.bank.slice(0, 3).toUpperCase()}-2024-${Math.floor(100000 + Math.random() * 900000)}`);
    setVoucherFile(null);
    setIsUploadVoucherModalOpen(true);
  };

  const handleSubmitVoucher = (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const ok = triggerTransition(selectedRequest.id, 'CONFIRM_RELEASE', {
      confirmationRef: voucherRef,
      voucherFile: voucherFile ? voucherFile.name : `BANK_RELEASE_ADVICE_${selectedRequest.fdrNumber}.pdf`
    });
    setIsUploadVoucherModalOpen(false);
    setSelectedRequest(null);
    if (ok) showNotice(`Release & Refund Confirmed! UTR ${voucherRef} recorded. Request and underlying FDR moved to RELEASED_REFUNDED.`);
  };

  const handleOpenCancelModal = (req) => {
    setSelectedRequest(req);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleSubmitCancel = (e) => {
    e.preventDefault();
    if (!selectedRequest) return;
    const ok = triggerTransition(selectedRequest.id, 'CANCEL', {
      reason: cancelReason || 'Withdrawn by applicant institution.'
    });
    setIsCancelModalOpen(false);
    setSelectedRequest(null);
    if (ok) showNotice(`Release request ${selectedRequest.id} cancelled. Underlying FDR reverted to ACTIVE.`);
  };

  const handleOpenViewAdvice = (req) => {
    setSelectedRequest(req);
    setIsViewAdviceModalOpen(true);
  };

  const handleCreateRequest = (e) => {
    e.preventDefault();
    const targetFdr = fdrs.find(f => f.fdrNumber === newRequestFdr) || eligibleFdrs[0];
    if (!targetFdr) {
      showError('Please select a valid FDR instrument to release.');
      return;
    }

    const newReq = {
      id: `rel_${Date.now()}`,
      fdrId: targetFdr.id,
      fdrNumber: targetFdr.fdrNumber,
      institutionName: targetFdr.institutionName,
      aictePid: targetFdr.aictePid,
      bank: targetFdr.bank,
      amount: targetFdr.amount,
      amountFormatted: targetFdr.amountFormatted,
      requestType: newRequestReason,
      submittedDate: new Date().toISOString().split('T')[0],
      status: 'REQUESTED',
      councilOrderRef: null,
      approvalDate: null,
      readinessRemarks: null,
      confirmationRef: null,
      confirmationVoucher: null,
      notes: newRequestNotes || 'Statutory compliance complete. Excess deposit refund requested per APH Regulation 14(C).'
    };

    if (onCreateReleaseRequest) {
      onCreateReleaseRequest(newReq);
    }
    setIsSubmitModalOpen(false);
    showNotice(`Release request submitted for ${newReq.fdrNumber} (Status: REQUESTED). Queued for Regional Scrutiny.`);
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
                  setNewRequestFdr(eligibleFdrs[0].fdrNumber);
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
          <span className="font-mono text-rose-800 font-bold bg-rose-100 px-2 py-0.5 rounded">INVALID TRANSITION 409</span>
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
              3. <strong>Readiness Phase:</strong> Designated Officer confirms readiness (<code className="font-mono font-semibold">AWAITING_CONFIRMATION</code>). <em>Direct confirmation from RELEASE_APPROVED is forbidden.</em><br />
              4. <strong>Settlement Phase:</strong> Bank disbursement advice and UTR are recorded (<code className="font-mono font-semibold">RELEASED_REFUNDED</code>). No actual funds are transferred.
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
              {filteredRequests.length === 0 ? (
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
                                  className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
                                  title="Take ownership of review"
                                >
                                  <span className="material-symbols-outlined text-[15px]">assignment_turned_in</span>
                                  <span>Start Review</span>
                                </button>
                              )}
                              {(isInstitution || isAdmin) && (
                                <button
                                  onClick={() => handleOpenCancelModal(req)}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition-colors inline-flex items-center gap-1"
                                  title="Cancel release request before verification"
                                >
                                  <span className="material-symbols-outlined text-[15px]">cancel</span>
                                  <span>Cancel</span>
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
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
                                    title="Recommend for Council Approval"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">thumb_up</span>
                                    <span>Verify & Recommend</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenCorrectionModal(req)}
                                    className="px-2 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition-colors inline-flex items-center gap-1"
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
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
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
                                    className="px-2.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
                                    title="Issue Council Release Sanction"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">gavel</span>
                                    <span>Approve</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenRejectModal(req)}
                                    className="px-2 py-1.5 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors inline-flex items-center gap-1"
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
                                  className="px-3 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
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
                              <button
                                onClick={() => handleOpenVoucherModal(req)}
                                className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1 transition-colors"
                                title="Upload Bank Credit Advice & UTR"
                              >
                                <span className="material-symbols-outlined text-[15px]">upload_file</span>
                                <span>Upload Voucher & UTR</span>
                              </button>
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

      {/* MODAL 1: Initiate Release Request */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-[22px]">add_circle</span>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  Initiate Security Deposit Release Request
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
                  Select Pledged Fixed Deposit Receipt <span className="text-error">*</span>
                </label>
                {eligibleFdrs.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                    No active eligible FDRs found without existing pending release petitions.
                  </div>
                ) : (
                  <select
                    value={newRequestFdr}
                    onChange={(e) => setNewRequestFdr(e.target.value)}
                    className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  >
                    {eligibleFdrs.map(f => (
                      <option key={f.id} value={f.fdrNumber}>
                        {f.fdrNumber} — {f.bank} ({f.amountFormatted})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Statutory Grounds for Release <span className="text-error">*</span>
                </label>
                <select
                  value={newRequestReason}
                  onChange={(e) => setNewRequestReason(e.target.value)}
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="Closure of Academic Programme">Closure of Academic Programme (All batches graduated)</option>
                  <option value="Excess Collateral Refund">Excess Collateral Refund (Post Statutory 8-Year Period)</option>
                  <option value="Autonomous Status Transition">Autonomous Status Transition (Reduced Collateral Requirement)</option>
                  <option value="Surplus Reserve Release">Surplus Reserve Release (APH 2024-25 Clause 14(C))</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Supporting Governing Body Resolution & NOC Letter (PDF)
                </label>
                <div className="border border-dashed border-surface-container-high rounded-xl p-3 bg-surface-container-low/40 text-center">
                  <span className="material-symbols-outlined text-secondary text-[24px]">cloud_upload</span>
                  <div className="text-xs text-secondary mt-1">Select PDF resolution document</div>
                  <input type="file" accept=".pdf" className="hidden" id="release-doc-upload" />
                  <label
                    htmlFor="release-doc-upload"
                    className="mt-2 inline-block px-3 py-1 bg-surface-container text-xs font-semibold rounded-lg cursor-pointer hover:bg-surface-container-high"
                  >
                    Choose PDF
                  </label>
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
                  disabled={eligibleFdrs.length === 0}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs disabled:opacity-50"
                >
                  Submit Release Petition
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
                  Council Release Order <strong>{selectedRequest.councilOrderRef || 'AICTE/FIN/REL/2024/918'}</strong> has been issued. Confirming readiness certifies that all institutional clearances and NOC letters are prepared. This step advances status to <strong>AWAITING_CONFIRMATION</strong>; it does not claim funds have moved.
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
                  className="px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold shadow-xs"
                >
                  Confirm Readiness Sign-off
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
                <span className="material-symbols-outlined text-purple-800 text-[22px]">receipt_long</span>
                <div>
                  <h2 className="font-headline-sm text-base font-bold text-on-surface">
                    Record Bank Disbursement & Close Custody
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
                <div>Council Order: <strong>{selectedRequest.councilOrderRef || 'AICTE/FIN/REL/2024/918'}</strong></div>
                <div className="text-[11px] text-purple-900/80">
                  Readiness confirmed on {selectedRequest.approvalDate || 'recent date'}. Upload the scheduled bank credit advice or UTR acknowledgment to finalize deposit status as <strong className="text-emerald-800">RELEASED_REFUNDED</strong>.
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Bank UTR / Transaction Reference Number <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={voucherRef}
                  onChange={(e) => setVoucherRef(e.target.value)}
                  placeholder="e.g. UTR-SBIN-2024-998122"
                  className="w-full text-xs font-mono rounded-xl border border-surface-container-high bg-surface-container-low px-3 py-2 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Bank Credit Advice / Disbursement Voucher (PDF)
                </label>
                <div className="border border-dashed border-surface-container-high rounded-xl p-3 bg-surface-container-low/40 text-center">
                  <span className="material-symbols-outlined text-secondary text-[24px]">description</span>
                  <div className="text-xs text-secondary mt-1">
                    {voucherFile ? voucherFile.name : 'Upload bank settlement confirmation PDF'}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg"
                    onChange={(e) => setVoucherFile(e.target.files[0])}
                    className="hidden"
                    id="voucher-file-upload"
                  />
                  <label
                    htmlFor="voucher-file-upload"
                    className="mt-2 inline-block px-3 py-1 bg-surface-container text-xs font-semibold rounded-lg cursor-pointer hover:bg-surface-container-high"
                  >
                    {voucherFile ? 'Change File' : 'Browse File'}
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
                  className="px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-xs"
                >
                  Confirm Release & Close Lien
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
                  className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shadow-xs"
                >
                  Confirm Rejection
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
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs"
                >
                  Return for Clarification
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
                Previous Observation: <em>{selectedRequest.notes}</em>
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
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs"
                >
                  Resubmit for Review
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
                  className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs"
                >
                  Confirm Cancellation
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
