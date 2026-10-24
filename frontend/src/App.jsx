import React, { useState } from 'react';
import { RoleProvider, useRole, ROLES } from './context/RoleContext';
import AppLayout from './components/layout/AppLayout';

// Mock Data
import { INITIAL_FDRS, FDR_STATUSES } from './data/mockData';

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
  const handleUpdateFdrStatus = (fdrId, newStatus, remarks) => {
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
  };

  // Add new submitted FDR
  const handleAddFdr = (newFdr) => {
    setFdrs(prev => [newFdr, ...prev]);
    setSelectedFdr(newFdr);
    setSelectedFdrRef(newFdr.fdrNumber);
  };

  // Correction Resubmission
  const handleResubmitCorrection = (fdrId, remarks, fileName) => {
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
  };

  // Route Rendering
  const renderCurrentRoute = () => {
    // AICTE Admin & Officer routes
    if (activeRoute === 'dashboard') {
      return (
        <AdminDashboard
          fdrs={fdrs}
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
