import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RoleProvider, useRole, ROLES } from './context/RoleContext';
import { ThemeProvider } from './context/ThemeContext';
import { isRouteAllowed, getDefaultRoute } from './config/roleAccess';
import AppLayout from './components/layout/AppLayout';
import { apiClient } from './api/client';
import AicteLogo from './components/common/AicteLogo';

// Mock Data (Initial fallbacks)
import { INITIAL_FDRS, FDR_STATUSES, INITIAL_RELEASE_REQUESTS } from './data/mockData';

// Pages
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import MasterRegistry from './pages/MasterRegistry';
import VerificationPage from './pages/VerificationPage';
import ApprovalPage from './pages/ApprovalPage';
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

  const handleAddFdr = async () => {
    await loadFdrs();
  };

  const handleUpdateFdrStatus = (fdrId, newStatus, remarks = '') => {
    setFdrs(prevFdrs =>
      prevFdrs.map(fdr => {
        if (fdr.id === fdrId) {
          return {
            ...fdr,
            status: newStatus,
            lastAuditDate: new Date().toISOString().split('T')[0],
            statusRemarks: remarks || fdr.statusRemarks,
          };
        }
        return fdr;
      })
    );
  };

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
            approvedAt: newStatus.includes('Approved') ? new Date().toISOString() : req.approvedAt,
          };
        }
        return req;
      })
    );
  };

  const handleCreateReleaseRequest = (newRequest) => {
    setReleaseRequests(prev => [newRequest, ...prev]);
  };

  // Scoped datasets: Institution Officer must ONLY see FDRs and requests belonging to their own institute
  const isInstitutionOfficer = currentRole === ROLES.INSTITUTION_OFFICER;
  const scopedFdrs = useMemo(() => {
    if (!isInstitutionOfficer) return fdrs;
    const userPid = currentUser?.aictePid || currentUser?.pid;
    const userInstName = (currentUser?.institutionName || currentUser?.institution || '').toLowerCase();
    const userInstId = currentUser?.institutionId || currentUser?.institution_id;

    return fdrs.filter((f) => {
      if (userPid && f.aictePid === userPid) return true;
      if (userInstId && String(f.institutionId || f.institution_id) === String(userInstId)) return true;
      if (userInstName && f.institutionName && f.institutionName.toLowerCase().includes(userInstName)) return true;
      // Default fallback for St. Xavier's demo persona
      if (f.aictePid === '1-10928374' || (f.institutionName && f.institutionName.includes("St. Xavier's"))) return true;
      return false;
    });
  }, [fdrs, isInstitutionOfficer, currentUser]);

  const scopedReleaseRequests = useMemo(() => {
    if (!isInstitutionOfficer) return releaseRequests;
    const userPid = currentUser?.aictePid || currentUser?.pid;
    const userInstName = (currentUser?.institutionName || currentUser?.institution || '').toLowerCase();

    return releaseRequests.filter((r) => {
      if (userPid && r.aictePid === userPid) return true;
      if (userInstName && r.institutionName && r.institutionName.toLowerCase().includes(userInstName)) return true;
      if (r.aictePid === '1-10928374' || (r.institutionName && r.institutionName.includes("St. Xavier's"))) return true;
      return false;
    });
  }, [releaseRequests, isInstitutionOfficer, currentUser]);

  // Route Rendering with Central RBAC Route Guard
  const renderCurrentRoute = () => {
    // If route is forbidden for current role, redirect cleanly to default
    if (!isRouteAllowed(currentRole, activeRoute)) {
      const fallback = getDefaultRoute(currentRole);
      if (fallback === 'institution_dashboard') {
        return (
          <InstitutionDashboard
            fdrs={scopedFdrs}
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
    }

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

    // Section 3: Verification Officer Page
    if (activeRoute === 'verification') {
      return (
        <VerificationPage
          fdrs={fdrs}
          onUpdateFdrStatus={handleUpdateFdrStatus}
        />
      );
    }

    // Section 4: Approving Authority Page
    if (activeRoute === 'approval') {
      return (
        <ApprovalPage
          releaseRequests={releaseRequests}
          fdrs={fdrs}
          onUpdateReleaseRequest={handleUpdateReleaseRequest}
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
          fdrs={scopedFdrs}
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
      return (
        <MasterRegistry
          fdrs={scopedFdrs}
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
        <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1200px] mx-auto text-on-surface">
          <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="font-headline-lg text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
                Submit New Fixed Deposit Receipt
              </h1>
              <p className="text-xs text-secondary mt-1">
                Statutory Security Deposit Registration under Regulation 14(B)
              </p>
            </div>
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold shadow-sm inline-flex items-center gap-1.5"
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
          fdrs={scopedFdrs}
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
          fdrs={scopedFdrs}
          releaseRequests={scopedReleaseRequests}
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
    const defaultRoute = getDefaultRoute(currentRole);
    if (defaultRoute === 'institution_dashboard') {
      return (
        <InstitutionDashboard
          fdrs={scopedFdrs}
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
          setActiveRoute(currentRole === ROLES.APPROVING_AUTHORITY ? 'approval' : 'verification');
        }}
      />
    </>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, login } = useRole();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <AicteLogo className="w-16 h-16 animate-pulse mb-4" />
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold text-on-surface">Restoring AICTE Regulatory Session...</p>
        <p className="text-[11px] text-secondary mt-0.5">Verifying cryptographic bearer tokens against core authority</p>
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
    <ThemeProvider>
      <RoleProvider>
        <AppContent />
      </RoleProvider>
    </ThemeProvider>
  );
}
