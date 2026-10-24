import React, { useState, useEffect, useCallback } from 'react';
import { RoleProvider, useRole, ROLES } from './context/RoleContext';
import AppLayout from './components/layout/AppLayout';
import { fdrsApi, workflowApi, documentsApi } from './api/client';

// Mock Data (used as seamless initial seed / offline fallback)
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

function MainRouter() {
  const { currentRole, currentUser, activeRoute, setActiveRoute, selectedFdrRef, setSelectedFdrRef } = useRole();

  // Master State for FDR records across the application
  const [fdrs, setFdrs] = useState(INITIAL_FDRS);

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
  const [scrutinyTargetFdr, setScrutinyTargetFdr] = useState(null);
  const [detailTargetFdr, setDetailTargetFdr] = useState(null);

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
  const handleSelectFdr = (fdr) => {
    setSelectedFdr(fdr);
    setSelectedFdrRef(fdr.fdrNumber);
  };

  // Inspect FDR in Detail Modal
  const handleOpenDetailModal = (fdr) => {
    setDetailTargetFdr(fdr);
    setIsDetailModalOpen(true);
  };

  // Open Scrutiny Modal for correction
  const handleOpenScrutinyModal = (fdr) => {
    setScrutinyTargetFdr(fdr);
    setIsScrutinyModalOpen(true);
  };

  // Status transitions
  const handleUpdateFdrStatus = async (fdrId, newStatus, remarks) => {
    setFdrs(prev =>
      prev.map(item => {
        if (item.id === fdrId) {
          return {
            ...item,
            status: newStatus,
            notes: remarks ? remarks : item.notes,
            lastAuditDate: new Date().toISOString().split('T')[0]
          };
        }
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
        }
      })
    );

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
  };

  // Route Rendering
  const renderCurrentRoute = () => {
    // AICTE Admin & Officer routes
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
      // Filter FDRs for St. Xavier's Engineering College (PID: 1-10928374)
      const collegeFdrs = fdrs.filter(f => f.aictePid === '1-10928374');
      return (
        <MasterRegistry
          fdrs={collegeFdrs}
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
      const collegeFdrs = fdrs.filter(f => f.aictePid === '1-10928374');
      return (
        <MaturityRenewalsPage
          fdrs={collegeFdrs}
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

    // Default Fallback
    if (currentRole === ROLES.INSTITUTION_OFFICER) {
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

export default function App() {
  return (
    <RoleProvider>
      <AppLayout>
        <MainRouter />
      </AppLayout>
    </RoleProvider>
  );
}
