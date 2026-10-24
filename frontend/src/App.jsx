import React, { useState, useEffect, useCallback } from 'react';
import { RoleProvider, useRole, ROLES } from './context/RoleContext';
import AppLayout from './components/layout/AppLayout';
<<<<<<< HEAD
import { fdrsApi, workflowApi, documentsApi } from './api/client';

// Mock Data (used as seamless initial seed / offline fallback)
=======
import { apiClient } from './api/client';
import AicteLogo from './components/common/AicteLogo';

// Mock Data (Initial fallbacks)
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
import { INITIAL_FDRS, FDR_STATUSES, INITIAL_RELEASE_REQUESTS } from './data/mockData';

// Normalizers for full resilience and backwards compatibility
function normalizeFdr(raw) {
  if (!raw) return raw;
  const numAmount = typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount_decimal || raw.amount || raw.deposit_amount || 0);
  const formatted = raw.amountFormatted || (numAmount ? `₹${Number(numAmount).toLocaleString('en-IN')}` : '₹0.00');
  return {
    ...raw,
    id: raw.id ?? raw.fdr_id,
    fdrId: raw.id ?? raw.fdr_id,
    fdrNumber: raw.fdrNumber || raw.fdr_number || `FDR-${raw.id}`,
    certNumber: raw.certNumber || raw.cert_number || `CERT-${raw.id}`,
    tripartiteRef: raw.tripartiteRef || raw.tripartite_ref || '',
    institutionId: raw.institutionId || raw.institution_id || '',
    institutionName: raw.institutionName || raw.institution_name || raw.institution?.name || "St. Xavier's Engineering College",
    aictePid: raw.aictePid || raw.aicte_pid || raw.institution?.aicte_pid || '1-10928374',
    region: raw.region || (raw.institution?.region ? raw.institution.region.toLowerCase() : 'wro'),
    regionLabel: raw.regionLabel || (raw.institution?.region ? `${raw.institution.region} Region` : 'Western (WRO)'),
    bank: raw.bank || raw.bank_name || raw.issuing_bank || 'State Bank of India',
    bankName: raw.bank_name || raw.bank || 'State Bank of India',
    bankCode: raw.bankCode || (raw.bank_name || raw.bank || 'sbi').toLowerCase().slice(0, 3),
    branch: raw.branch || raw.branch_name || 'Main Treasury Branch',
    ifsc: raw.ifsc || 'SBIN0000300',
    amount: numAmount,
    amountFormatted: formatted,
    amountWords: raw.amountWords || `Rupees ${numAmount} Only`,
    interestRate: raw.interestRate || (raw.interest_rate ? `${raw.interest_rate}%` : '7.20% p.a.'),
    issueDate: raw.issueDate || raw.issue_date || '2022-01-01',
    maturityDate: raw.maturityDate || raw.maturity_date || '2027-01-01',
    tenureYears: raw.tenureYears || raw.tenure_years || 5,
    status: raw.status || FDR_STATUSES.SUBMITTED,
    lienStatus: raw.lienStatus || raw.lien_status || 'Statutory Lien Registered',
    autoRollover: raw.autoRollover ?? raw.auto_rollover ?? true,
    discrepancyNote: raw.discrepancyNote || raw.discrepancy_note || null,
    notes: raw.notes || ''
  };
}

function normalizeReleaseRequest(raw) {
  if (!raw) return raw;
  const numAmount = typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount_decimal || raw.amount || 0);
  const formatted = raw.amountFormatted || (numAmount ? `₹${Number(numAmount).toLocaleString('en-IN')}` : '₹0.00');
  return {
    ...raw,
    id: raw.id ?? raw.request_id,
    requestId: raw.id ?? raw.request_id,
    fdrId: raw.fdrId ?? raw.fdr_id,
    fdrNumber: raw.fdrNumber || raw.fdr_number || `FDR-${raw.fdr_id}`,
    institutionName: raw.institutionName || raw.institution_name || "St. Xavier's Engineering College",
    aictePid: raw.aictePid || raw.aicte_pid || '1-10928374',
    bank: raw.bank || raw.bank_name || 'State Bank of India',
    amount: numAmount,
    amountFormatted: formatted,
    requestType: raw.requestType || raw.request_type || 'Release / Refund Request',
    submittedDate: raw.submittedDate || raw.submitted_date || raw.submitted_at?.split('T')[0] || raw.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
    status: raw.status || 'REQUESTED',
    councilOrderRef: raw.councilOrderRef || raw.council_order_ref || null,
    approvalDate: raw.approvalDate || raw.approval_date || null,
    readinessRemarks: raw.readinessRemarks || raw.readiness_remarks || null,
    confirmationRef: raw.confirmationRef || raw.confirmation_ref || null,
    confirmationVoucher: raw.confirmationVoucher || raw.confirmation_voucher || null,
    notes: raw.notes || raw.remarks || ''
  };
}

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import MasterRegistry from './pages/MasterRegistry';
import VerificationAuditWorkspace from './pages/VerificationAuditWorkspace';
import MaturityRenewalsPage from './pages/MaturityRenewalsPage';
import ReleaseRequestsPage from './pages/ReleaseRequestsPage';
import ReportsPage from './pages/ReportsPage';
import InstitutionsPage from './pages/InstitutionsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';
import HelpManualsPage from './pages/HelpManualsPage';
import InstitutionDashboard from './pages/InstitutionDashboard';
import ProfileTrustPage from './pages/ProfileTrustPage';
import NotificationsPage from './pages/NotificationsPage';

// Modals
import SubmitFdrModal from './components/modals/SubmitFdrModal';
import ScrutinyRemarksModal from './components/modals/ScrutinyRemarksModal';
import FdrDetailModal from './components/modals/FdrDetailModal';

function formatInr(val) {
  if (val === null || val === undefined) return '₹0';
  const num = Number(val);
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN');
}

export function mapFdrFromBackend(f) {
  const fdrId = f.id || f.fdr_id;
  const fdrNumber = f.fdr_number || f.fdrNumber;
  const amount = Number(f.amount !== undefined ? f.amount : (f.deposit_amount || 0));

  let displayStatus = f.status;
  if (f.status === 'DRAFT') displayStatus = FDR_STATUSES.DRAFT;
  else if (f.status === 'SUBMITTED') displayStatus = FDR_STATUSES.SUBMITTED;
  else if (f.status === 'UNDER_VERIFICATION') displayStatus = FDR_STATUSES.UNDER_VERIFICATION;
  else if (f.status === 'CORRECTION_REQUIRED') displayStatus = FDR_STATUSES.CORRECTION_REQUIRED;
  else if (f.status === 'VERIFIED') displayStatus = FDR_STATUSES.VERIFIED;
  else if (f.status === 'PENDING_APPROVAL') displayStatus = FDR_STATUSES.PENDING_APPROVAL;
  else if (f.status === 'ACTIVE') displayStatus = FDR_STATUSES.ACTIVE;
  else if (f.status === 'REJECTED') displayStatus = FDR_STATUSES.REJECTED;

  let pid = '1-10928374';
  if (f.institution_id === 2) {
    pid = '1-28374619';
  } else if (f.institution_id) {
    pid = `1-${String(f.institution_id).padStart(8, '0')}`;
  }

  return {
    ...f,
    id: fdrId,
    fdrId: fdrId,
    fdrNumber: fdrNumber,
    certNumber: f.cert_number || f.certNumber || `CERT-${fdrId}`,
    tripartiteRef: f.tripartite_ref || f.tripartiteRef || `TPR-2024-${String(fdrId).padStart(4, '0')} / AICTE-WRO`,
    institutionId: f.institution_id ? `inst_${f.institution_id}` : (f.institutionId || 'inst_01'),
    institution_id: f.institution_id,
    institutionName: f.institution_name || f.institutionName || (f.institution_id === 2 ? 'Bharati Vidyapeeth College of Engineering' : "St. Xavier's Engineering College"),
    aictePid: pid,
    region: f.region || 'wro',
    regionLabel: f.regionLabel || 'Western (WRO)',
    city: f.city || (f.institution_id === 2 ? 'Navi Mumbai' : 'Pune'),
    state: f.state || 'Maharashtra',
    sponsoringTrust: f.sponsoringTrust || (f.institution_id === 2 ? 'Bharati Vidyapeeth Educational Trust' : "St. Xavier's Technical Education Society"),
    programme: f.programme || 'UG Engineering',
    courseDetails: f.courseDetails || 'Approved Technical Programme',
    bank: f.bank_name || f.issuing_bank || f.bank || 'Nationalized Bank',
    bankCode: (f.bank_name || f.bank || '').toLowerCase().includes('pnb') ? 'pnb' : 'sbi',
    branch: f.branch || f.branch_name || 'Main Branch',
    ifsc: f.ifsc || 'N/A',
    solId: f.solId || '1290',
    amount: amount,
    amountFormatted: formatInr(amount),
    interestRate: f.interest_rate || f.interestRate || '7.25% p.a.',
    issueDate: f.issue_date || f.issueDate,
    maturityDate: f.maturity_date || f.maturityDate,
    tenureYears: f.tenure_years || f.tenureYears || 5,
    status: displayStatus,
    rawStatus: f.status,
    lien_status: f.lien_status || 'Statutory Lien Registered',
    mandateClause: f.mandate_clause || f.mandateClause || 'Exclusive Statutory Lien under Reg 14(B)',
    jointAccountHolder: f.jointAccountHolder || 'AICTE Member Secretary & Sponsoring Trust',
  };
}

function MainRouter() {
  const { currentRole, currentUser, activeRoute, setActiveRoute, selectedFdrRef, setSelectedFdrRef } = useRole();

  // Master State for FDR records loaded from backend
  const [fdrs, setFdrs] = useState(INITIAL_FDRS);
  const [isLoadingFdrs, setIsLoadingFdrs] = useState(true);

  // Master State for Release / Refund requests across the application
  const [releaseRequests, setReleaseRequests] = useState(INITIAL_RELEASE_REQUESTS);

  // Selected FDR for detail modal & verification workspace
  const [selectedFdr, setSelectedFdr] = useState(() => {
    return INITIAL_FDRS.find(f => f.fdrNumber === selectedFdrRef) || INITIAL_FDRS[0];
  });

  // Modal States
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isScrutinyModalOpen, setIsScrutinyModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Active targets for modals
  const [scrutinyTargetFdr, setScrutinyTargetFdr] = useState(null);
  const [detailTargetFdr, setDetailTargetFdr] = useState(null);

<<<<<<< HEAD
  // Data synchronization with backend API
  const fetchAllData = useCallback(async () => {
    try {
      const [fdrsRes, reqsRes] = await Promise.allSettled([
        fdrsApi.list({ limit: 100 }),
        workflowApi.listRequests({ limit: 100 })
      ]);

      if (fdrsRes.status === 'fulfilled' && fdrsRes.value?.items && Array.isArray(fdrsRes.value.items)) {
        if (fdrsRes.value.items.length > 0) {
          const liveFdrs = fdrsRes.value.items.map(normalizeFdr);
          setFdrs(liveFdrs);
          if (selectedFdrRef) {
            const found = liveFdrs.find(f => f.fdrNumber === selectedFdrRef);
            if (found) setSelectedFdr(found);
          }
        }
      }

      if (reqsRes.status === 'fulfilled' && reqsRes.value?.items && Array.isArray(reqsRes.value.items)) {
        if (reqsRes.value.items.length > 0) {
          const liveReqs = reqsRes.value.items.map(normalizeReleaseRequest);
          setReleaseRequests(liveReqs);
        }
      }
    } catch (err) {
      console.warn('Backend sync failed, maintaining current state:', err);
    }
  }, [selectedFdrRef]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData, currentUser]);

  // Select FDR and sync ref
=======
  // Load FDRs from backend API
  const loadFdrs = useCallback(async () => {
    try {
      setIsLoadingFdrs(true);
      const data = await apiClient.getFdrs({ limit: 100 });
      if (data && data.items && data.items.length > 0) {
        const mapped = data.items.map(mapFdrFromBackend);
        setFdrs(mapped);
      }
    } catch (err) {
      console.warn('Could not load backend FDRs, using local state:', err.message);
    } finally {
      setIsLoadingFdrs(false);
    }
  }, []);

  // Load Release Requests from backend API
  const loadReleaseRequests = useCallback(async () => {
    try {
      const data = await apiClient.getRequests({ request_type: 'RELEASE_REFUND' });
      if (Array.isArray(data)) {
        setReleaseRequests(data);
      }
    } catch (err) {
      console.warn('Could not load backend release requests:', err.message);
    }
  }, []);

  useEffect(() => {
    loadFdrs();
    loadReleaseRequests();
  }, [loadFdrs, loadReleaseRequests, currentUser?.userId]);

  // Sync selected FDR when ref changes
  useEffect(() => {
    if (selectedFdrRef && fdrs.length > 0) {
      const found = fdrs.find(f => f.fdrNumber === selectedFdrRef || String(f.id) === String(selectedFdrRef));
      if (found) {
        setSelectedFdr(found);
      }
    }
  }, [selectedFdrRef, fdrs]);

>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
  const handleSelectFdr = (fdr) => {
    setSelectedFdr(fdr);
    setSelectedFdrRef(fdr.fdrNumber);
  };

  const handleOpenDetailModal = (fdr) => {
    setDetailTargetFdr(fdr);
    setIsDetailModalOpen(true);
  };

  const handleOpenScrutinyModal = (fdr) => {
    setScrutinyTargetFdr(fdr);
    setIsScrutinyModalOpen(true);
  };

<<<<<<< HEAD
  // Status transitions
  const handleUpdateFdrStatus = async (fdrId, newStatus, remarks) => {
    setFdrs(prev =>
      prev.map(item => {
        if (item.id === fdrId) {
=======
  const handleAddFdr = async (createdOrNewFdr) => {
    // Reload freshly from backend to ensure database persistence
    await loadFdrs();
  };

  const handleUpdateFdrStatus = (fdrId, newStatus, remarks = '') => {
    setFdrs(prevFdrs =>
      prevFdrs.map(fdr => {
        if (fdr.id === fdrId) {
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
          return {
            ...fdr,
            status: newStatus,
            lastAuditDate: new Date().toISOString().split('T')[0],
            statusRemarks: remarks || fdr.statusRemarks
          };
        }
<<<<<<< HEAD
        return item;
      })
    );

    // Update active selectedFdr if matched
    if (selectedFdr && selectedFdr.id === fdrId) {
      setSelectedFdr(prev => ({
        ...prev,
        status: newStatus,
        notes: remarks ? remarks : prev.notes,
        lastAuditDate: new Date().toISOString().split('T')[0]
      }));
    }

    try {
      if (newStatus === FDR_STATUSES.UNDER_VERIFICATION) {
        await fdrsApi.startVerification(fdrId);
      } else if (newStatus === FDR_STATUSES.VERIFIED) {
        await workflowApi.verifyFdr(fdrId, remarks);
      } else if (newStatus === FDR_STATUSES.ACTIVE) {
        await workflowApi.approveFdr(fdrId, remarks);
      } else if (newStatus === FDR_STATUSES.SUBMITTED) {
        await fdrsApi.submit(fdrId);
      } else if (newStatus === FDR_STATUSES.CORRECTION_REQUIRED) {
        await fdrsApi.patch(fdrId, { status: 'CORRECTION_REQUIRED', notes: remarks });
      }
      await fetchAllData();
    } catch (err) {
      console.warn('Backend status transition failed, kept optimistic state:', err);
    }
  };

  // Add new submitted FDR
  const handleAddFdr = async (newFdr) => {
    const norm = normalizeFdr(newFdr);
    setFdrs(prev => [norm, ...prev]);
    setSelectedFdr(norm);
    setSelectedFdrRef(norm.fdrNumber);
    await fetchAllData();
  };

  // Correction Resubmission
  const handleResubmitCorrection = async (fdrId, remarks, fileName) => {
    setFdrs(prev =>
      prev.map(item => {
        if (item.id === fdrId) {
          return {
            ...item,
            status: FDR_STATUSES.SUBMITTED,
            discrepancyNote: null,
            notes: `Amended document (${fileName}) resubmitted. ${remarks}`,
            lastAuditDate: new Date().toISOString().split('T')[0]
          };
        }
        return item;
=======
        return fdr;
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
      })
    );
    try {
      await fdrsApi.patch(fdrId, { notes: `Amended document (${fileName}) resubmitted. ${remarks}` });
      await fdrsApi.submit(fdrId);
      await fetchAllData();
    } catch (err) {
      console.warn('Backend resubmission failed, kept optimistic state:', err);
    }
  };

<<<<<<< HEAD
  // Release request status transition handler
  const handleUpdateReleaseRequest = async (requestId, transitionType, payload = {}) => {
    const today = new Date().toISOString().split('T')[0];
    setReleaseRequests(prev =>
      prev.map(req => {
        if (req.id !== requestId) return req;
        switch (transitionType) {
          case 'START_VERIFICATION':
            return { ...req, status: 'UNDER_VERIFICATION' };
          case 'VERIFY_APPROVE':
            return { ...req, status: 'PENDING_APPROVAL', notes: payload.remarks || req.notes };
          case 'REQUEST_CORRECTION':
            return { ...req, status: 'CORRECTION_REQUIRED', notes: payload.remarks || req.notes };
          case 'RESUBMIT':
            return { ...req, status: 'REQUESTED', notes: payload.remarks || req.notes };
          case 'APPROVE':
            return { ...req, status: 'RELEASE_APPROVED', councilOrderRef: payload.orderRef, approvalDate: today };
          case 'REJECT':
            return { ...req, status: 'REJECTED', notes: payload.reason || req.notes };
          case 'CONFIRM_READINESS':
            return { ...req, status: 'AWAITING_CONFIRMATION', readinessRemarks: payload.remarks };
          case 'CONFIRM_RELEASE':
            return {
              ...req,
              status: 'RELEASED_REFUNDED',
              confirmationRef: payload.confirmationRef,
              confirmationVoucher: payload.voucherFile
            };
          case 'CANCEL':
            return { ...req, status: 'CANCELLED', notes: payload.reason || req.notes };
          default:
            return req;
=======
  const handleResubmitCorrection = (fdrId, remarks) => {
    handleUpdateFdrStatus(fdrId, FDR_STATUSES.SUBMITTED, remarks);
    setIsScrutinyModalOpen(false);
    setScrutinyTargetFdr(null);
  };

  const handleUpdateReleaseRequest = (requestId, newStatus, remarks) => {
    setReleaseRequests(prev =>
      prev.map(req => {
        if (req.id === requestId) {
          return {
            ...req,
            status: newStatus,
            councilRemarks: remarks || req.councilRemarks,
            approvedAt: newStatus.includes('Approved') ? new Date().toISOString() : req.approvedAt
          };
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
        }
        return req;
      })
    );
<<<<<<< HEAD

    try {
      await workflowApi.transitionRequest(requestId, {
        transition_type: transitionType,
        ...payload
      });
      await fetchAllData();
    } catch (err) {
      console.warn('Backend release request transition failed, kept optimistic state:', err);
    }

    // Synchronize underlying FDR status if release confirmed
    if (transitionType === 'CONFIRM_RELEASE') {
      const targetReq = releaseRequests.find(r => r.id === requestId);
      if (targetReq) {
        handleUpdateFdrStatus(targetReq.fdrId, FDR_STATUSES.RELEASED_REFUNDED);
      }
    }
    return { success: true };
  };

  // Add new release request
  const handleCreateReleaseRequest = async (newReq) => {
    const norm = normalizeReleaseRequest(newReq);
    setReleaseRequests(prev => [norm, ...prev]);
    try {
      await workflowApi.createRelease(newReq.fdrId, {
        request_type: newReq.requestType,
        notes: newReq.notes
      });
      await fetchAllData();
    } catch (err) {
      console.warn('Backend create release failed, kept optimistic state:', err);
    }
=======
  };

  const handleCreateReleaseRequest = (newRequest) => {
    setReleaseRequests(prev => [newRequest, ...prev]);
>>>>>>> a6e3dba0f8f7bc49c3623616b53ee7a0547665a4
  };

  // Route Rendering
  const renderCurrentRoute = () => {
    const isInst = currentRole === ROLES.INSTITUTION_OFFICER || currentRole === 'INSTITUTION_OFFICER';

    if (activeRoute === 'dashboard') {
      return (
        <AdminDashboard
          fdrs={fdrs}
          releaseRequests={releaseRequests}
          onSelectFdr={handleSelectFdr}
          onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
          onOpenDetailModal={handleOpenDetailModal}
        />
      );
    }

    if (activeRoute === 'registry') {
      return (
        <MasterRegistry
          fdrs={fdrs}
          onSelectFdr={(fdr) => {
            handleSelectFdr(fdr);
            handleOpenDetailModal(fdr);
          }}
          onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        />
      );
    }

    if (activeRoute === 'verification_audit') {
      return (
        <VerificationAuditWorkspace
          fdr={selectedFdr}
          onUpdateFdrStatus={handleUpdateFdrStatus}
        />
      );
    }

    if (activeRoute === 'maturity_renewals') {
      return (
        <MaturityRenewalsPage
          fdrs={fdrs}
          onSelectFdr={(fdr) => {
            handleSelectFdr(fdr);
            handleOpenDetailModal(fdr);
          }}
        />
      );
    }

    if (activeRoute === 'release_requests') {
      return (
        <ReleaseRequestsPage
          fdrs={fdrs}
          releaseRequests={releaseRequests}
          onUpdateReleaseRequest={handleUpdateReleaseRequest}
          onCreateReleaseRequest={handleCreateReleaseRequest}
          onUpdateFdrStatus={handleUpdateFdrStatus}
        />
      );
    }

    if (activeRoute === 'reports') {
      return (
        <ReportsPage
          fdrs={fdrs}
        />
      );
    }

    if (activeRoute === 'institutions') {
      return (
        <InstitutionsPage
          fdrs={fdrs}
        />
      );
    }

    if (activeRoute === 'audit_logs') {
      return (
        <AuditLogsPage />
      );
    }

    if (activeRoute === 'settings') {
      return (
        <SettingsPage />
      );
    }

    if (activeRoute === 'help_manuals' || activeRoute === 'aph_guidelines_templates') {
      return (
        <HelpManualsPage />
      );
    }

    // Institution Officer Routes
    if (activeRoute === 'institution_dashboard') {
      return (
        <InstitutionDashboard
          fdrs={fdrs}
          onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
          onOpenScrutinyModal={handleOpenScrutinyModal}
          onSelectFdr={(fdr) => {
            handleSelectFdr(fdr);
            handleOpenDetailModal(fdr);
          }}
        />
      );
    }

    if (activeRoute === 'my_fdrs') {
      // In the real backend, list_fdrs is already scoped server-side to the institution!
      return (
        <MasterRegistry
          fdrs={fdrs}
          onSelectFdr={(fdr) => {
            handleSelectFdr(fdr);
            handleOpenDetailModal(fdr);
          }}
          onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        />
      );
    }

    if (activeRoute === 'submit_new_fdr') {
      return (
        <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1200px] mx-auto">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
                Submit New Fixed Deposit Receipt
              </h1>
              <p className="text-xs text-secondary mt-1">
                Statutory Security Deposit Registration under Regulation 14(B)
              </p>
            </div>
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Open Registration Wizard</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container">
              <span className="material-symbols-outlined text-primary text-[28px] mb-2">account_balance</span>
              <h3 className="font-bold text-sm text-on-surface">1. Joint Name Mandate</h3>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                FDR must be drawn in the joint names of "Regional Officer / Member Secretary, AICTE" and Sponsoring Trust.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container">
              <span className="material-symbols-outlined text-teal-700 text-[28px] mb-2">description</span>
              <h3 className="font-bold text-sm text-on-surface">2. Form L-1 Endorsement</h3>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                Bank Branch Manager must endorse irrevocable lien with explicit Regional Office descriptor and auto-rollover.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container">
              <span className="material-symbols-outlined text-emerald-700 text-[28px] mb-2">verified</span>
              <h3 className="font-bold text-sm text-on-surface">3. AICTE Verification</h3>
              <p className="text-xs text-secondary mt-1 leading-relaxed">
                Tripartite verification officer cross-checks physical scan against Finacle core banking lien records.
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (activeRoute === 'renewals') {
      return (
        <MaturityRenewalsPage
          fdrs={fdrs}
          onSelectFdr={(fdr) => {
            handleSelectFdr(fdr);
            handleOpenDetailModal(fdr);
          }}
        />
      );
    }

    if (activeRoute === 'release_refund_requests') {
      return (
        <ReleaseRequestsPage
          fdrs={fdrs}
          releaseRequests={releaseRequests}
          onUpdateReleaseRequest={handleUpdateReleaseRequest}
          onCreateReleaseRequest={handleCreateReleaseRequest}
          onUpdateFdrStatus={handleUpdateFdrStatus}
        />
      );
    }

    if (activeRoute === 'notifications') {
      return (
        <NotificationsPage />
      );
    }

    if (activeRoute === 'profile_trust_details') {
      return (
        <ProfileTrustPage />
      );
    }

    // Default Fallback based on Role
    if (isInst) {
      return (
        <InstitutionDashboard
          fdrs={fdrs}
          onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
          onOpenScrutinyModal={handleOpenScrutinyModal}
          onSelectFdr={(fdr) => {
            handleSelectFdr(fdr);
            handleOpenDetailModal(fdr);
          }}
        />
      );
    }

    if (currentRole === ROLES.VERIFICATION_OFFICER || currentRole === ROLES.APPROVING_AUTHORITY) {
      return (
        <VerificationAuditWorkspace
          fdr={selectedFdr}
          onUpdateFdrStatus={handleUpdateFdrStatus}
        />
      );
    }

    return (
      <AdminDashboard
        fdrs={fdrs}
        releaseRequests={releaseRequests}
        onSelectFdr={handleSelectFdr}
        onOpenSubmitModal={() => setIsSubmitModalOpen(true)}
        onOpenDetailModal={handleOpenDetailModal}
      />
    );
  };

  return (
    <>
      {renderCurrentRoute()}

      {/* Global Submit FDR Modal */}
      <SubmitFdrModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        onSubmitSuccess={handleAddFdr}
      />

      {/* Scrutiny Deficiency Correction Modal */}
      <ScrutinyRemarksModal
        isOpen={isScrutinyModalOpen}
        onClose={() => {
          setIsScrutinyModalOpen(false);
          setScrutinyTargetFdr(null);
        }}
        fdr={scrutinyTargetFdr || fdrs.find(f => f.status === FDR_STATUSES.CORRECTION_REQUIRED)}
        onResubmitSuccess={handleResubmitCorrection}
      />

      {/* FDR Full Certificate Detail Modal */}
      <FdrDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setDetailTargetFdr(null);
        }}
        fdr={detailTargetFdr || selectedFdr}
        onNavigateAudit={(fdr) => {
          handleSelectFdr(fdr);
          setActiveRoute('verification_audit');
        }}
      />
    </>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, login } = useRole();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <AicteLogo className="w-16 h-16 animate-pulse mb-4" />
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold text-slate-700">Restoring AICTE Regulatory Session...</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Verifying cryptographic bearer tokens against core authority</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={login} />;
  }

  return (
    <AppLayout>
      <MainRouter />
    </AppLayout>
  );
}

export default function App() {
  return (
    <RoleProvider>
      <AppContent />
    </RoleProvider>
  );
}
