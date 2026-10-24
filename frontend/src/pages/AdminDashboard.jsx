import React, { useState, useMemo } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { FDR_STATUSES } from '../data/mockData';
import { getAppToday, getDaysToMaturity, maturityColor } from '../utils/clock';

export default function AdminDashboard({
  fdrs = [],
  releaseRequests = [],
  onSelectFdr,
  onOpenSubmitModal,
  onOpenDetailModal,
}) {
  const { setActiveRoute, setSelectedFdrRef, currentRole } = useRole();
  const isApprover = currentRole === ROLES.APPROVING_AUTHORITY;
  const isVerifier = currentRole === ROLES.VERIFICATION_OFFICER;
  const isAdmin = currentRole === ROLES.AICTE_ADMIN;

  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Role-specific counts & KPIs
  const kpis = useMemo(() => {
    const totalCount = fdrs.length;
    const activeCount = fdrs.filter((f) => f.status === FDR_STATUSES.ACTIVE).length;
    
    // Verification Officer perspective
    const pendingReviews = fdrs.filter(
      (f) => f.status === FDR_STATUSES.SUBMITTED || f.status === FDR_STATUSES.UNDER_VERIFICATION
    ).length;
    const correctionsRequired = fdrs.filter(
      (f) => f.status === FDR_STATUSES.CORRECTION_REQUIRED
    ).length;
    // Instruments verified this month (verified or active or approved)
    const verifiedThisMonth = fdrs.filter(
      (f) => f.status === FDR_STATUSES.VERIFIED || f.status === FDR_STATUSES.ACTIVE || f.status === FDR_STATUSES.PENDING_APPROVAL
    ).length;

    // Approving Authority perspective
    const pendingApprovals = fdrs.filter(
      (f) => f.status === FDR_STATUSES.PENDING_APPROVAL
    ).length;
    const releasePending = Array.isArray(releaseRequests)
      ? releaseRequests.filter((r) =>
          ['REQUESTED', 'UNDER_VERIFICATION', 'PENDING_APPROVAL', 'RELEASE_APPROVED', 'AWAITING_CONFIRMATION'].includes(r.status)
        ).length
      : 0;
    const approvedThisMonth = fdrs.filter(
      (f) => f.status === FDR_STATUSES.ACTIVE
    ).length;
    const rejectedOrWaivers = fdrs.filter(
      (f) => f.status === FDR_STATUSES.REJECTED || f.discrepancyNote
    ).length;

    const maturing60Count = fdrs.filter(
      (f) =>
        f.status === FDR_STATUSES.MATURING_SOON ||
        f.status === FDR_STATUSES.MATURED ||
        f.status === FDR_STATUSES.RENEWAL_REQUESTED
    ).length;

    return {
      totalCount,
      totalAmountFormatted: '₹14,128.50 Cr',
      activeCount,
      pendingReviews,
      verifiedThisMonth,
      correctionsRequired,
      pendingApprovals,
      referredDecisions: pendingApprovals + releasePending,
      approvedThisMonth,
      rejectedOrWaivers,
      maturing60Count,
    };
  }, [fdrs, releaseRequests]);

  // 2. Action Required Items (filtered strictly by role)
  const actionItems = useMemo(() => {
    if (isVerifier) {
      return [
        {
          id: 'verif',
          title: 'Submitted FDRs Awaiting Review',
          count: kpis.pendingReviews,
          desc: 'New submissions in regional scrutiny queue',
          icon: 'verified',
          route: 'verification',
          badgeColor: 'bg-primary-fixed text-on-primary-fixed',
        },
        {
          id: 'corr',
          title: 'Open Discrepancies & Corrections',
          count: kpis.correctionsRequired,
          desc: 'Instruments returned with scrutiny observations',
          icon: 'warning',
          route: 'verification',
          badgeColor: 'bg-error-container text-on-error-container',
        },
        {
          id: 'renew',
          title: 'Expiring Maturities (< 60 Days)',
          count: kpis.maturing60Count,
          desc: 'Maturing statutory deposits requiring scrutiny',
          icon: 'event_repeat',
          route: 'registry',
          badgeColor: 'bg-tertiary-fixed text-on-tertiary-fixed',
        },
      ];
    }

    if (isApprover) {
      return [
        {
          id: 'approval',
          title: 'Referred Cases Awaiting Decision',
          count: kpis.referredDecisions,
          desc: 'Verified cases requiring statutory council determination',
          icon: 'gavel',
          route: 'approval',
          badgeColor: 'bg-teal-700 text-white',
        },
        {
          id: 'renew',
          title: 'Expiring Maturities (< 60 Days)',
          count: kpis.maturing60Count,
          desc: 'Deposits approaching maturity horizon',
          icon: 'event_repeat',
          route: 'registry',
          badgeColor: 'bg-tertiary-fixed text-on-tertiary-fixed',
        },
      ];
    }

    // Admin: Full action set
    return [
      {
        id: 'verif',
        title: 'Pending Verification',
        count: kpis.pendingReviews,
        desc: 'New submissions awaiting scrutiny',
        icon: 'verified',
        route: 'verification',
        badgeColor: 'bg-primary-fixed text-on-primary-fixed',
      },
      {
        id: 'approval',
        title: 'Pending Council Approval',
        count: kpis.pendingApprovals,
        desc: 'Verified instruments awaiting endorsement',
        icon: 'gavel',
        route: 'approval',
        badgeColor: 'bg-teal-700 text-white',
      },
      {
        id: 'corr',
        title: 'Deficiency Corrections',
        count: kpis.correctionsRequired,
        desc: 'Instruments with discrepancy flag',
        icon: 'warning',
        route: 'verification',
        badgeColor: 'bg-error-container text-on-error-container',
      },
      {
        id: 'release',
        title: 'Release / Refund Requests',
        count: Array.isArray(releaseRequests)
          ? releaseRequests.filter((r) => ['REQUESTED', 'UNDER_VERIFICATION', 'PENDING_APPROVAL'].includes(r.status)).length
          : 0,
        desc: 'Refund requests pending action',
        icon: 'currency_exchange',
        route: 'release_requests',
        badgeColor: 'bg-secondary-container text-on-secondary-container',
      },
    ];
  }, [isVerifier, isApprover, kpis, releaseRequests]);

  // 3. Upcoming Maturity Schedule: 6-Month Horizon with days calculated via clock utility
  const maturityHorizon = useMemo(() => {
    const today = getAppToday();
    const months = [
      { label: 'Nov 2024', days: 15, count: 12, value: '₹14.2 Cr' },
      { label: 'Dec 2024', days: 45, count: 28, value: '₹32.5 Cr' },
      { label: 'Jan 2025', days: 75, count: 45, value: '₹51.0 Cr' },
      { label: 'Feb 2025', days: 105, count: 34, value: '₹38.8 Cr' },
      { label: 'Mar 2025', days: 135, count: 82, value: '₹95.4 Cr' },
      { label: 'Apr 2025', days: 165, count: 19, value: '₹22.1 Cr' },
    ];

    return months.map((m) => {
      const colorInfo = maturityColor(m.days);
      return {
        ...m,
        colorInfo,
      };
    });
  }, []);

  // 4. Role-specific Activity Table
  const filteredFdrs = useMemo(() => {
    return fdrs.filter((fdr) => {
      // Role scope filter
      if (isVerifier) {
        // Verification Officer: focused on submitted FDRs awaiting review, open discrepancies, expiring maturities
        const isSubmitted = fdr.status === FDR_STATUSES.SUBMITTED || fdr.status === FDR_STATUSES.UNDER_VERIFICATION;
        const isDiscrepancy = fdr.status === FDR_STATUSES.CORRECTION_REQUIRED;
        const isExpiring = fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.MATURED;
        if (!isSubmitted && !isDiscrepancy && !isExpiring) return false;
      } else if (isApprover) {
        // Approving Authority: focused on referred cases awaiting decision, expiring maturities
        const isPending = fdr.status === FDR_STATUSES.PENDING_APPROVAL || fdr.status === FDR_STATUSES.RELEASE_REQUESTED;
        const isExpiring = fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.MATURED;
        if (!isPending && !isExpiring) return false;
      }

      const matchesSearch =
        !searchTerm ||
        fdr.fdrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fdr.institutionName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fdr.bank.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (fdr.aictePid && fdr.aictePid.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === 'pending') {
        return (
          fdr.status === FDR_STATUSES.SUBMITTED ||
          fdr.status === FDR_STATUSES.UNDER_VERIFICATION ||
          fdr.status === FDR_STATUSES.CORRECTION_REQUIRED ||
          fdr.status === FDR_STATUSES.PENDING_APPROVAL
        );
      }
      if (activeTab === 'active') {
        return fdr.status === FDR_STATUSES.ACTIVE;
      }
      if (activeTab === 'renewals') {
        return fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.RENEWAL_REQUESTED || fdr.status === FDR_STATUSES.MATURED;
      }
      return true;
    });
  }, [fdrs, searchTerm, activeTab, isVerifier, isApprover]);

  const handleInspect = (fdr) => {
    setSelectedFdrRef(fdr.fdrNumber);
    if (onSelectFdr) onSelectFdr(fdr);
    if (onOpenDetailModal) {
      onOpenDetailModal(fdr);
    } else if (isVerifier) {
      setActiveRoute('verification');
    } else if (isApprover) {
      setActiveRoute('approval');
    } else {
      setActiveRoute('registry');
    }
  };

  const handleRegisterAction = () => {
    if (onOpenSubmitModal) {
      onOpenSubmitModal();
    } else {
      setActiveRoute('submit_new_fdr');
    }
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto text-on-surface">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-surface-container">
        <div>
          <h1 className="font-headline-lg text-xl sm:text-2xl font-bold tracking-tight text-on-surface">
            {isVerifier
              ? 'Verification Officer Dashboard'
              : isApprover
              ? 'Approving Authority Dashboard'
              : 'FDR Monitoring & Custody Dashboard'}
          </h1>
          <p className="font-body-sm text-xs text-secondary mt-0.5">
            {isVerifier
              ? 'Regional Scrutiny & Tripartite Instrument Verification Desk'
              : isApprover
              ? 'Statutory Executive Council • Delegated Adjudication & Lien Release'
              : 'Central Regulatory Financial Custody Division • Statutory Security Deposit Monitoring (FY 2024-25)'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={handleRegisterAction}
            className="rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs px-4 py-2.5 font-semibold shadow-xs inline-flex items-center gap-2 transition-colors shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            <span>Register New FDR</span>
          </button>
        )}
      </div>

      {/* 2. Role-specific KPIs */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : isVerifier ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
        {isAdmin && (
          <>
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary font-medium">Total FDRs</span>
                <div className="w-9 h-9 rounded-xl bg-surface-container-low text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">account_balance</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-data-mono text-on-surface tracking-tight">
                  {kpis.totalCount}
                </div>
                <p className="text-[11px] text-secondary mt-1 font-medium">
                  Portfolio Value: <strong className="text-on-surface">{kpis.totalAmountFormatted}</strong>
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary font-medium">Active FDRs</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                  <span className="material-symbols-outlined text-[20px]">verified_user</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-data-mono text-emerald-800 dark:text-emerald-300 tracking-tight">
                  {kpis.activeCount}
                </div>
                <p className="text-[11px] text-secondary mt-1 font-medium">
                  Statutory Lien Registered & Active
                </p>
              </div>
            </div>
          </>
        )}

        {isVerifier && (
          <>
            {/* 1. Verifications Remaining */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary font-medium">Verifications Remaining</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-800">
                  <span className="material-symbols-outlined text-[20px]">pending_actions</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-data-mono text-amber-800 dark:text-amber-300 tracking-tight">
                  {kpis.pendingReviews}
                </div>
                <p className="text-[11px] text-secondary mt-1 font-medium">
                  Unverified instruments in scrutiny queue
                </p>
              </div>
            </div>

            {/* 2. Verified This Month */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary font-medium">Verified This Month</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                  <span className="material-symbols-outlined text-[20px]">task_alt</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-data-mono text-emerald-800 dark:text-emerald-300 tracking-tight">
                  {kpis.verifiedThisMonth}
                </div>
                <p className="text-[11px] text-secondary mt-1 font-medium">
                  Scrutiny completed & endorsed
                </p>
              </div>
            </div>

            {/* 3. Diversified / Not Accepted (Returned for correction) */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary font-medium">Diversified / Not Accepted</span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center justify-center border border-rose-100 dark:border-rose-800">
                  <span className="material-symbols-outlined text-[20px]">assignment_late</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-data-mono text-rose-800 dark:text-rose-300 tracking-tight">
                  {kpis.correctionsRequired}
                </div>
                <p className="text-[11px] text-secondary mt-1 font-medium">
                  Returned for information / deficiency correction
                </p>
              </div>
            </div>
          </>
        )}

        {isApprover && (
          <>
            {/* 1. Referred Cases Awaiting Decision */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary font-medium">Referred Cases Awaiting Decision</span>
                <div className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 flex items-center justify-center border border-teal-100 dark:border-teal-800">
                  <span className="material-symbols-outlined text-[20px]">gavel</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-data-mono text-teal-800 dark:text-teal-300 tracking-tight">
                  {kpis.referredDecisions}
                </div>
                <p className="text-[11px] text-secondary mt-1 font-medium">
                  Within delegated statutory authority limit
                </p>
              </div>
            </div>

            {/* 2. Approved This Month */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary font-medium">Approved This Month</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center border border-emerald-100 dark:border-emerald-800">
                  <span className="material-symbols-outlined text-[20px]">verified_user</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-data-mono text-emerald-800 dark:text-emerald-300 tracking-tight">
                  {kpis.approvedThisMonth}
                </div>
                <p className="text-[11px] text-secondary mt-1 font-medium">
                  Executive council ratifications
                </p>
              </div>
            </div>

            {/* 3. Cases Rejected / Exception Waivers */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs text-secondary font-medium">Rejected / Exceptions Handled</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 flex items-center justify-center border border-purple-100 dark:border-purple-800">
                  <span className="material-symbols-outlined text-[20px]">balance</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-data-mono text-purple-800 dark:text-purple-300 tracking-tight">
                  {kpis.rejectedOrWaivers}
                </div>
                <p className="text-[11px] text-secondary mt-1 font-medium">
                  Adjudicated discrepancy waivers & rejections
                </p>
              </div>
            </div>
          </>
        )}

        {isAdmin && (
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs text-secondary font-medium">Pending Verification</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center justify-center border border-amber-100 dark:border-amber-800">
                <span className="material-symbols-outlined text-[20px]">pending_actions</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-bold font-data-mono text-amber-800 dark:text-amber-300 tracking-tight">
                {kpis.pendingReviews}
              </div>
              <p className="text-[11px] text-secondary mt-1 font-medium">
                New submissions & corrections in queue
              </p>
            </div>
          </div>
        )}

        {/* Expiring Maturities (visible across all 3 official roles) */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary font-medium">Expiring Within 60 Days</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 flex items-center justify-center border border-rose-100 dark:border-rose-800">
              <span className="material-symbols-outlined text-[20px]">event_busy</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-data-mono text-rose-800 dark:text-rose-300 tracking-tight">
              {kpis.maturing60Count}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium">
              Statutory renewal or release review
            </p>
          </div>
        </div>
      </div>

      {/* 3. Action Required Section (Helper text removed per Section 8) */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-surface-container mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-800 dark:text-teal-400 text-[18px]">assignment_turned_in</span>
            <h2 className="font-headline-md text-sm font-bold text-on-surface">Action Required</h2>
          </div>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${actionItems.length === 3 ? 'lg:grid-cols-3' : actionItems.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-3`}>
          {actionItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveRoute(item.route)}
              className="flex items-start justify-between p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container hover:border-primary/40 border border-surface-container transition-all text-left cursor-pointer group"
              type="button"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-xs font-bold text-on-surface group-hover:text-primary transition-colors">
                  {item.title}
                </span>
                <span className="text-[11px] text-secondary mt-0.5 line-clamp-1">
                  {item.desc}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold font-data-mono shrink-0 ${item.badgeColor}`}>
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Upcoming Maturity Schedule (6-Month Horizon) with Section 5 threshold colors and tiny dot labels */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-surface-container">
          <div>
            <h2 className="font-headline-md text-sm font-bold text-on-surface">
              Upcoming Maturity Schedule (6-Month Horizon)
            </h2>
            <p className="font-body-sm text-[11px] text-secondary">
              Anticipated maturity volume and statutory renewal obligations
            </p>
          </div>

          {/* Section 5: Exactly three tiny coloured dots with labels "1 mo", "2-3 mo", "4-6 mo", nothing more */}
          <div className="flex items-center gap-3 text-[11px] font-medium text-secondary">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>1 mo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>2-3 mo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>4-6 mo</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          {maturityHorizon.map((h, i) => (
            <div
              key={i}
              className={`p-3 rounded-xl border flex flex-col justify-between transition-colors ${h.colorInfo.badgeClass}`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold block uppercase tracking-wider">{h.label}</span>
                  <span className={`w-2 h-2 rounded-full ${h.colorInfo.dotClass}`} />
                </div>
                <span className="text-lg font-bold font-data-mono block mt-1">{h.count} FDRs</span>
              </div>
              <div className="mt-2 pt-2 border-t border-current/15 flex items-center justify-between text-[10px]">
                <span className="font-data-mono font-medium">{h.value}</span>
                <span className="font-bold">{h.colorInfo.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Role-Specific FDR Activity Table */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
          <div>
            <h2 className="font-headline-md text-sm font-bold text-on-surface">
              {isVerifier
                ? 'Submissions & Discrepancies Awaiting Review'
                : isApprover
                ? 'Referred Instruments Awaiting Council Decision'
                : 'Recent FDR Activity'}
            </h2>
            <p className="font-body-sm text-[11px] text-secondary mt-0.5">
              {isVerifier
                ? 'Queue of submitted instruments, deficiency notices, and upcoming maturities'
                : isApprover
                ? 'Queue of referred cases, surplus releases, and upcoming maturities'
                : 'Live audit ledger of institutional term deposit certificates and pledge status'}
            </p>
          </div>

          {/* Admin Tabs */}
          {isAdmin && (
            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container flex-wrap">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'all'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                All ({fdrs.length})
              </button>
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'pending'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setActiveTab('renewals')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'renewals'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Renewals
              </button>
            </div>
          )}
        </div>

        {/* Filter sub-bar */}
        <div className="flex items-center justify-between gap-3 my-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[16px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by FDR No, Institution, or Bank..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <div className="text-xs text-secondary font-label-sm">
            Showing <strong className="text-on-surface">{filteredFdrs.length}</strong> records
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-surface-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-9 border-b border-surface-container">
                <th className="px-4 py-2 font-semibold">Receipt Number</th>
                <th className="px-4 py-2 font-semibold">Institution</th>
                <th className="px-4 py-2 font-semibold">Bank & Branch</th>
                <th className="px-4 py-2 text-right font-semibold">Amount (INR)</th>
                <th className="px-4 py-2 font-semibold">Maturity Date</th>
                <th className="px-4 py-2 text-center font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container bg-surface-container-lowest">
              {filteredFdrs.map((fdr) => (
                <tr key={fdr.id} className="hover:bg-surface-container/60 transition-colors">
                  <td className="px-4 py-3 font-data-mono font-semibold text-primary">
                    {fdr.fdrNumber}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">{fdr.institutionName}</span>
                      <span className="font-data-mono text-[10px] text-secondary">
                        PID: {fdr.aictePid} • {fdr.city || fdr.regionLabel}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    <span className="font-medium text-on-surface block">{fdr.bank}</span>
                    <span className="text-[10px] text-secondary">{fdr.branch}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-data-mono font-bold text-on-surface text-[12px]">
                    {fdr.amountFormatted}
                  </td>
                  <td className="px-4 py-3 font-data-mono text-secondary">
                    {fdr.maturityDate}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                        fdr.status === FDR_STATUSES.ACTIVE
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : fdr.status === FDR_STATUSES.CORRECTION_REQUIRED
                          ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.MATURED
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                          : 'bg-surface-container text-secondary border border-surface-container-high'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {fdr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleInspect(fdr)}
                      className="px-2.5 py-1 bg-surface-container hover:bg-primary hover:text-on-primary text-primary text-xs rounded-lg font-semibold transition-colors border border-surface-container-high cursor-pointer"
                      title="Inspect FDR"
                    >
                      {isVerifier ? 'Verify' : isApprover ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredFdrs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-secondary">
                    No matching FDR records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}