import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRole } from '../context/RoleContext';
import { apiClient } from '../api/client';

const FDR_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_VERIFICATION: 'UNDER_VERIFICATION',
  CORRECTION_REQUIRED: 'CORRECTION_REQUIRED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  MATURING_SOON: 'MATURING_SOON',
  MATURED: 'MATURED',
  RELEASED_REFUNDED: 'RELEASED_REFUNDED',
  REJECTED: 'REJECTED',
};

const REGION_LABELS = {
  wro: 'Western (WRO)',
  sro: 'Southern (SRO)',
  swro: 'South-Western (SWRO)',
  nro: 'Northern (NRO)',
  ero: 'Eastern (ERO)',
  nwro: 'North-Western (NWRO)',
  cro: 'Central (CRO)',
};

const getRegionLabel = (code) => {
  if (!code) return 'General Jurisdiction';
  const c = code.toLowerCase();
  return REGION_LABELS[c] || code.toUpperCase();
};

// Helper: Format Currency (INR)
const formatCurrency = (amt) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amt || 0);
};

// Helper: Format Date to readable 'DD Mon YYYY'
const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIdx = parseInt(month, 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        return `${parseInt(day, 10)} ${months[mIdx]} ${year}`;
      }
    }
    return dateStr;
  } catch {
    return dateStr;
  }
};

export default function InstitutionDashboard({
  fdrs = [],
  onOpenSubmitModal,
  onOpenScrutinyModal,
  onSelectFdr,
}) {
  const { setActiveRoute, setSelectedFdrRef, currentUser, fiscalYear } = useRole();

  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Dashboard API telemetry
  const [summary, setSummary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, activitiesRes] = await Promise.all([
        apiClient.getDashboardSummary(),
        apiClient.getDashboardActivities(6),
      ]);
      setSummary(summaryRes);
      setActivities(Array.isArray(activitiesRes) ? activitiesRes : []);
    } catch (err) {
      console.error('Failed to load institution dashboard telemetry:', err);
      setError(err.message || 'Unable to synchronize dashboard telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // College-specific FDRs scoped to this authenticated institution
  const collegeFdrs = useMemo(() => {
    const userInstId = currentUser?.institutionId || currentUser?.institution_id;
    const userPid = currentUser?.aictePid || currentUser?.pid;
    const userInstName = (currentUser?.institutionName || currentUser?.institution || '').toLowerCase();

    return fdrs.filter((f) => {
      const fInstId = f.institutionId || f.institution_id;
      if (userInstId && fInstId) {
        return String(fInstId) === String(userInstId);
      }
      if (userPid && f.aictePid) {
        return f.aictePid === userPid;
      }
      if (userInstName && f.institutionName) {
        return f.institutionName.toLowerCase().includes(userInstName);
      }
      // If user has no explicit ID, default to all passed fdrs (which are already scoped)
      return true;
    });
  }, [fdrs, currentUser]);

  // Aggregate monetary value
  const totalAmount = useMemo(() => {
    if (summary && summary.total_deposit_amount_inr != null) {
      return summary.total_deposit_amount_inr;
    }
    return collegeFdrs.reduce((sum, f) => sum + (Number(f.amount || f.deposit_amount) || 0), 0);
  }, [collegeFdrs, summary]);

  // Active counts for KPIs
  const activeCount = useMemo(() => {
    if (summary && summary.active_count != null) return summary.active_count;
    return collegeFdrs.filter((f) => f.status === FDR_STATUSES.ACTIVE).length;
  }, [collegeFdrs, summary]);

  const pendingReviewCount = useMemo(() => {
    if (summary && summary.pending_review_count != null) return summary.pending_review_count;
    return collegeFdrs.filter(
      (f) =>
        f.status === FDR_STATUSES.CORRECTION_REQUIRED ||
        f.status === FDR_STATUSES.SUBMITTED ||
        f.status === FDR_STATUSES.UNDER_VERIFICATION ||
        f.status === FDR_STATUSES.PENDING_APPROVAL
    ).length;
  }, [collegeFdrs, summary]);

  const maturingSoonCount = useMemo(() => {
    if (summary && summary.maturing_or_matured_count != null) return summary.maturing_or_matured_count;
    return collegeFdrs.filter(
      (f) => f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.MATURED
    ).length;
  }, [collegeFdrs, summary]);

  // Action-required FDRs
  const correctionFdr = useMemo(() => {
    return collegeFdrs.find((f) => f.status === FDR_STATUSES.CORRECTION_REQUIRED);
  }, [collegeFdrs]);

  const renewalFdr = useMemo(() => {
    return collegeFdrs.find(
      (f) => f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.MATURED
    );
  }, [collegeFdrs]);

  // Filtered FDRs based on tab and search
  const filteredFdrs = useMemo(() => {
    return collegeFdrs.filter((f) => {
      const term = (searchTerm || '').toLowerCase().trim();
      const matchesSearch =
        !term ||
        (f.fdrNumber && f.fdrNumber.toLowerCase().includes(term)) ||
        (f.programme && f.programme.toLowerCase().includes(term)) ||
        (f.bank && f.bank.toLowerCase().includes(term)) ||
        (f.branch && f.branch.toLowerCase().includes(term)) ||
        (f.certNumber && f.certNumber.toLowerCase().includes(term));

      if (!matchesSearch) return false;

      if (activeTab === 'active') return f.status === FDR_STATUSES.ACTIVE;
      if (activeTab === 'correction') return f.status === FDR_STATUSES.CORRECTION_REQUIRED;
      if (activeTab === 'renewal')
        return f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.MATURED;
      return true;
    });
  }, [collegeFdrs, searchTerm, activeTab]);

  const handleInspect = (fdr) => {
    setSelectedFdrRef(fdr.fdrNumber);
    if (onSelectFdr) onSelectFdr(fdr);
  };

  // Dynamic institution details
  const instInfo = summary?.institution_info;
  const instPid = instInfo?.aicte_pid || currentUser?.aictePid || currentUser?.pid || '1-10928374';
  const instName = instInfo?.name || currentUser?.institutionName || currentUser?.institution || "St. Xavier's Engineering College, Pune";
  const instRegion = getRegionLabel(instInfo?.region || currentUser?.region || 'wro');

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto animate-in fade-in duration-200">
      {/* 1. Header with Institution Metadata & Single Primary Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-surface-container">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              Institution FDR Portfolio
            </h1>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200/80">
              Official Custody
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-secondary">
            <span>
              PID: <strong className="text-on-surface font-semibold">{instPid}</strong> • {instName} ({instRegion})
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-teal-800 bg-teal-50/80 px-2 py-0.5 rounded-md border border-teal-200/60 text-[11px]">
              <span className="material-symbols-outlined text-[13px] leading-none shrink-0">calendar_today</span>
              FY {fiscalYear || '2024 - 2025'} Cycle
            </span>
          </div>
        </div>

        <button
          onClick={onOpenSubmitModal}
          className="rounded-xl bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white text-xs px-4 py-2.5 font-semibold shadow-xs hover:shadow-sm inline-flex items-center gap-2 transition-all shrink-0 cursor-pointer"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px] leading-none shrink-0">add_circle</span>
          <span>Submit New FDR</span>
        </button>
      </div>

      {/* Loading Banner */}
      {loading && (
        <div className="p-3 bg-surface-container-lowest rounded-xl border border-surface-container flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs text-secondary">
            <div className="w-4 h-4 border-2 border-teal-800 border-t-transparent rounded-full animate-spin"></div>
            <span>Synchronizing institutional portfolio metrics with AICTE database...</span>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && !loading && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={fetchDashboardData}
            className="px-3 py-1 bg-white border border-rose-300 rounded-lg font-bold text-rose-700 hover:bg-rose-100 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Four Polished Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Portfolio */}
        <div
          onClick={() => setActiveTab('all')}
          className={`bg-surface-container-lowest p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between ${
            activeTab === 'all'
              ? 'border-teal-700/60 ring-2 ring-teal-700/15 bg-teal-50/10'
              : 'border-surface-container hover:border-teal-700/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary font-semibold uppercase tracking-wider">
              Total Portfolio FDRs
            </span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/80 leading-none">
              <span className="material-symbols-outlined text-[18px] leading-none shrink-0">account_balance</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-data-mono text-on-surface tracking-tight">
              {summary?.total_fdrs ?? collegeFdrs.length}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium flex items-center justify-between">
              <span>
                Total Value:{' '}
                <strong className="text-on-surface font-data-mono font-semibold">
                  {formatCurrency(totalAmount)}
                </strong>
              </span>
              <span className="text-[10px] text-teal-800 font-semibold hover:underline">View All →</span>
            </p>
          </div>
        </div>

        {/* Card 2: Active Liens */}
        <div
          onClick={() => setActiveTab('active')}
          className={`bg-surface-container-lowest p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between ${
            activeTab === 'active'
              ? 'border-emerald-700/60 ring-2 ring-emerald-700/15 bg-emerald-50/10'
              : 'border-surface-container hover:border-emerald-700/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary font-semibold uppercase tracking-wider">
              Active Liens
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200/80 leading-none">
              <span className="material-symbols-outlined text-[18px] leading-none shrink-0">verified_user</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-data-mono text-emerald-800 tracking-tight">
              {activeCount}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium flex items-center justify-between">
              <span>Joint APH Lien Enforced</span>
              <span className="text-[10px] text-emerald-800 font-semibold hover:underline">Filter →</span>
            </p>
          </div>
        </div>

        {/* Card 3: Pending Review / Clarification */}
        <div
          onClick={() => setActiveTab('correction')}
          className={`bg-surface-container-lowest p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between ${
            activeTab === 'correction'
              ? 'border-amber-700/60 ring-2 ring-amber-700/15 bg-amber-50/10'
              : 'border-surface-container hover:border-amber-700/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary font-semibold uppercase tracking-wider">
              Clarification / Review
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200/80 leading-none">
              <span className="material-symbols-outlined text-[18px] leading-none shrink-0">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-data-mono text-amber-800 tracking-tight">
              {pendingReviewCount}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium flex items-center justify-between">
              <span>Awaiting Scrutiny / Resubmission</span>
              <span className="text-[10px] text-amber-800 font-semibold hover:underline">Review →</span>
            </p>
          </div>
        </div>

        {/* Card 4: Maturing Soon / Matured */}
        <div
          onClick={() => setActiveTab('renewal')}
          className={`bg-surface-container-lowest p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between ${
            activeTab === 'renewal'
              ? 'border-rose-700/60 ring-2 ring-rose-700/15 bg-rose-50/10'
              : 'border-surface-container hover:border-rose-700/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary font-semibold uppercase tracking-wider">
              Maturing / Rollover Due
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200/80 leading-none">
              <span className="material-symbols-outlined text-[18px] leading-none shrink-0">event_busy</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-data-mono text-rose-800 tracking-tight">
              {maturingSoonCount}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium flex items-center justify-between">
              <span>Rollover renewal schedule</span>
              <span className="text-[10px] text-rose-800 font-semibold hover:underline">Renewals →</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Action Required Section (Dynamic only when real tasks exist) */}
      {(correctionFdr || renewalFdr) && (
        <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-surface-container shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container-low mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/80 leading-none">
                <span className="material-symbols-outlined text-[18px] leading-none shrink-0">assignment_turned_in</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline-md text-sm sm:text-base font-bold text-on-surface">
                    Action Required
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    {Number(!!correctionFdr) + Number(!!renewalFdr)} Pending Tasks
                  </span>
                </div>
                <p className="text-xs text-secondary mt-0.5">
                  Statutory endorsements and submissions requiring immediate attention
                </p>
              </div>
            </div>

            <span className="text-[11px] text-secondary hidden md:inline-flex items-center gap-1 font-medium">
              <span className="material-symbols-outlined text-[14px]">info</span>
              Council Regulation 14(B) Compliance Invariant
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Task 1: Scrutiny Deficiency / Clarification */}
            {correctionFdr && (
              <div className="bg-gradient-to-br from-amber-50/70 to-surface-container-lowest dark:from-amber-950/25 dark:to-surface-container-lowest border border-amber-200/90 dark:border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400"></span>
                      High Priority
                    </span>
                    <span className="text-xs font-bold font-data-mono text-on-surface">
                      {correctionFdr.fdrNumber}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <h3 className="font-bold text-sm text-on-surface">
                      Joint Mandate Wording Resubmission
                    </h3>
                    <p className="text-xs text-secondary mt-0.5">
                      {correctionFdr.bank || correctionFdr.bankName} • {correctionFdr.branch} •{' '}
                      <strong className="font-data-mono text-on-surface">
                        {correctionFdr.amountFormatted || formatCurrency(correctionFdr.amount)}
                      </strong>
                    </p>
                  </div>

                  <div className="bg-surface-container-lowest/90 dark:bg-surface-container-low/80 border border-amber-200/80 dark:border-amber-500/20 rounded-xl p-3 my-3 text-xs text-amber-950 dark:text-amber-200 leading-relaxed flex items-start gap-2.5 shadow-2xs">
                    <span className="material-symbols-outlined text-[18px] text-amber-800 dark:text-amber-400 shrink-0 leading-none mt-0.5">
                      warning
                    </span>
                    <p className="text-[11px] font-medium text-amber-950 dark:text-amber-200">
                      {correctionFdr.discrepancyNote ||
                        correctionFdr.notes ||
                        'Regional scrutiny desk requested amended Form L-1 with explicit Regional Office descriptor.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-100/80 dark:border-surface-container-low flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[11px] text-secondary inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    Resubmit before scrutiny cycle cut-off
                  </span>
                  <button
                    onClick={() => onOpenScrutinyModal && onOpenScrutinyModal(correctionFdr)}
                    className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none shrink-0">upload_file</span>
                    <span>Review & Resubmit</span>
                  </button>
                </div>
              </div>
            )}

            {/* Task 2: Maturity Rollover Renewal */}
            {renewalFdr && (
              <div className="bg-gradient-to-br from-rose-50/60 to-surface-container-lowest dark:from-rose-950/25 dark:to-surface-container-lowest border border-rose-200/90 dark:border-rose-500/30 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200 border border-rose-300 dark:border-rose-700/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400"></span>
                      Due Soon
                    </span>
                    <span className="text-xs font-bold font-data-mono text-on-surface">
                      {renewalFdr.fdrNumber}
                    </span>
                  </div>

                  <div className="mt-2.5">
                    <h3 className="font-bold text-sm text-on-surface">
                      Statutory Rollover Extension Due
                    </h3>
                    <p className="text-xs text-secondary mt-0.5">
                      {renewalFdr.bank || renewalFdr.bankName} • {renewalFdr.branch} •{' '}
                      <strong className="font-data-mono text-on-surface">
                        {renewalFdr.amountFormatted || formatCurrency(renewalFdr.amount)}
                      </strong>
                    </p>
                  </div>

                  <div className="bg-surface-container-lowest/90 dark:bg-surface-container-low/80 border border-rose-200/80 dark:border-rose-500/20 rounded-xl p-3 my-3 text-xs text-rose-950 dark:text-rose-200 leading-relaxed flex items-start gap-2.5 shadow-2xs">
                    <span className="material-symbols-outlined text-[18px] text-rose-800 dark:text-rose-400 shrink-0 leading-none mt-0.5">
                      event_repeat
                    </span>
                    <p className="text-[11px] font-medium text-rose-950 dark:text-rose-200">
                      Matures on <strong>{formatDate(renewalFdr.maturityDate)}</strong>. Under APH Regulation 14(B), initiate renewal with scheduled commercial bank to prevent lien enforcement breach.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-100/80 dark:border-surface-container-low flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[11px] text-secondary inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">timelapse</span>
                    Pre-maturity window open
                  </span>
                  <button
                    onClick={() => setActiveRoute('renewals')}
                    className="px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 active:bg-teal-950 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none shrink-0">autorenew</span>
                    <span>Initiate Renewal</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Pledged FDRs Activity Table */}
      <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-surface-container-low">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-base sm:text-lg font-bold text-on-surface">
                Pledged Fixed Deposit Receipts
              </h2>
              <span className="font-label-sm text-xs text-secondary bg-surface-container px-2 py-0.5 rounded-md font-medium">
                {collegeFdrs.length} Instruments
              </span>
            </div>
            <p className="font-body-sm text-xs text-secondary mt-0.5">
              Legally endorsed security deposits under joint mandate with AICTE Member Secretary
            </p>
          </div>

          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container shrink-0">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-surface-container-lowest text-teal-800 shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              All ({collegeFdrs.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-surface-container-lowest text-emerald-800 shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setActiveTab('correction')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'correction'
                  ? 'bg-surface-container-lowest text-amber-800 shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Clarification Due ({collegeFdrs.filter((f) => f.status === FDR_STATUSES.CORRECTION_REQUIRED).length})
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center justify-between gap-3 my-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-sm">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[16px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by receipt number, bank, or branch..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-700 text-on-surface"
            />
          </div>
          <div className="text-xs text-secondary">
            Showing <strong>{filteredFdrs.length}</strong> of {collegeFdrs.length} records
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-surface-container-low">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-9 border-b border-surface-container-low">
                <th className="px-4 py-2 font-semibold">Receipt Number</th>
                <th className="px-4 py-2 font-semibold">Bank & Branch</th>
                <th className="px-4 py-2 text-right font-semibold">Amount (INR)</th>
                <th className="px-4 py-2 font-semibold">Maturity Date</th>
                <th className="px-4 py-2 text-center font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low bg-surface-container-lowest">
              {filteredFdrs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-secondary">
                    <div className="flex flex-col items-center justify-center">
                      <span className="material-symbols-outlined text-3xl mb-1 text-surface-container-high">
                        find_in_page
                      </span>
                      <p className="font-semibold text-xs text-on-surface">No FDR Records Found</p>
                      <p className="text-[11px] text-secondary mt-0.5">
                        {searchTerm
                          ? 'No records match the active search filter.'
                          : 'No FDR instruments are filed under this category yet.'}
                      </p>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="mt-2 px-3 py-1 bg-surface-container-low hover:bg-surface-container text-xs font-semibold rounded-lg border border-surface-container text-teal-800 transition-colors"
                        >
                          Clear Search Filter
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredFdrs.map((fdr) => (
                  <tr key={fdr.id} className="hover:bg-teal-50/20 transition-colors group">
                    <td className="px-4 py-3.5">
                      <span className="font-data-mono font-bold text-on-surface text-xs block group-hover:text-teal-900">
                        {fdr.fdrNumber}
                      </span>
                      <span className="text-[10px] text-secondary font-data-mono block mt-0.5">
                        {fdr.certNumber || fdr.tripartiteRef || 'Tripartite Custody'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-secondary">
                      <span className="font-medium text-on-surface block text-xs">
                        {fdr.bank || fdr.bankName}
                      </span>
                      <span className="text-[10px] text-secondary block mt-0.5">
                        {fdr.branch || 'Principal Branch'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-data-mono font-bold text-on-surface text-xs">
                      <div>{fdr.amountFormatted || formatCurrency(fdr.amount)}</div>
                      {fdr.interestRate && (
                        <span className="text-[10px] text-secondary font-normal font-sans block mt-0.5">
                          {fdr.interestRate} p.a.
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 font-data-mono text-on-surface text-xs">
                      <div>{formatDate(fdr.maturityDate)}</div>
                      <span className="text-[10px] text-secondary font-sans block mt-0.5">
                        {fdr.autoRollover ? 'Auto-Rollover Active' : 'Manual Renewal'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${
                          fdr.status === FDR_STATUSES.ACTIVE
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                            : fdr.status === FDR_STATUSES.CORRECTION_REQUIRED
                            ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                            : fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.MATURED
                            ? 'bg-rose-50 text-rose-800 border border-rose-200/80'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0"></span>
                        {fdr.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {fdr.status === FDR_STATUSES.CORRECTION_REQUIRED && (
                          <button
                            onClick={() => onOpenScrutinyModal && onOpenScrutinyModal(fdr)}
                            className="px-2.5 py-1 bg-amber-700 hover:bg-amber-800 text-white text-xs rounded-lg font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                            title="Resubmit amended document"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none shrink-0">upload</span>
                            <span>Resubmit</span>
                          </button>
                        )}
                        {fdr.status === FDR_STATUSES.MATURING_SOON && (
                          <button
                            onClick={() => setActiveRoute('renewals')}
                            className="px-2.5 py-1 bg-teal-800 hover:bg-teal-900 text-white text-xs rounded-lg font-semibold transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                            title="Initiate maturity rollover"
                          >
                            <span className="material-symbols-outlined text-[13px] leading-none shrink-0">autorenew</span>
                            <span>Renew</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleInspect(fdr)}
                          className="px-2.5 py-1 bg-surface-container-low hover:bg-teal-50 hover:text-teal-800 text-on-surface text-xs rounded-lg font-semibold transition-colors border border-surface-container cursor-pointer inline-flex items-center gap-1"
                          title="Inspect FDR certificate details"
                        >
                          <span className="material-symbols-outlined text-[13px] leading-none shrink-0">visibility</span>
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Lower Section: Real Regulatory Activities & Real Compliance Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Activity Feed (7 Cols) */}
        <div className="lg:col-span-7 bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/80 leading-none">
                  <span className="material-symbols-outlined text-[16px] leading-none shrink-0">history</span>
                </div>
                <h3 className="font-headline-md text-sm font-bold text-on-surface">
                  Recent Regulatory Activity
                </h3>
              </div>
              <span className="text-[11px] text-secondary font-medium">
                Institutional Audit Trail
              </span>
            </div>

            {activities.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center text-secondary">
                <span className="material-symbols-outlined text-3xl mb-1 text-surface-container-high">
                  history_toggle_off
                </span>
                <p className="text-xs font-semibold text-on-surface">No Recent Activities</p>
                <p className="text-[11px] text-secondary mt-0.5 max-w-sm">
                  Workflow status changes and document submissions will appear here in the tamper-evident institutional audit trail.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-surface-container-low">
                {activities.map((act) => (
                  <div key={act.id} className="py-3 flex items-start gap-3 first:pt-0 last:pb-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 leading-none ${
                        act.type === 'warning'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200/80'
                          : act.type === 'success'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
                          : 'bg-teal-50 text-teal-800 border border-teal-200/80'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[17px] leading-none shrink-0">
                        {act.icon || 'history'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-on-surface truncate">
                          {act.title}
                        </span>
                        <span className="text-[10px] text-secondary shrink-0 font-medium">
                          {act.date}
                        </span>
                      </div>

                      <p className="text-[11px] text-secondary mt-0.5 line-clamp-1">
                        {act.desc}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="font-data-mono text-[10px] font-bold text-on-surface bg-surface-container-low px-1.5 py-0.5 rounded border border-surface-container">
                          {act.target}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            act.type === 'warning'
                              ? 'bg-amber-100 text-amber-900'
                              : act.type === 'success'
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-teal-100 text-teal-900'
                          }`}
                        >
                          {act.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-surface-container-low flex items-center justify-between">
            <span className="text-[11px] text-secondary">
              Telemetry synchronized with AICTE Central Database
            </span>
            <button
              onClick={() => setActiveRoute('audit_logs')}
              className="text-xs font-semibold text-teal-800 hover:text-teal-900 hover:underline cursor-pointer"
            >
              View Full Audit Log Archive →
            </button>
          </div>
        </div>

        {/* Right: Compliance Notices & Alerts (5 Cols) */}
        <div className="lg:col-span-5 bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/80 leading-none">
                  <span className="material-symbols-outlined text-[16px] leading-none shrink-0">notifications_active</span>
                </div>
                <h3 className="font-headline-md text-sm font-bold text-on-surface">
                  Compliance Alerts & Notices
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300">
                {Number(!!correctionFdr) + Number(!!renewalFdr) + (activeCount > 0 ? 1 : 0)} Active
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {/* Alert 1: Clarification required */}
              {correctionFdr && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-500/30 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-100/90 dark:bg-amber-900/60 px-1.5 py-0.5 rounded border border-transparent dark:border-amber-700/50">
                      Action Required
                    </span>
                    <span className="font-data-mono font-bold text-[11px] text-amber-950 dark:text-amber-200">
                      {correctionFdr.fdrNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                    {correctionFdr.discrepancyNote ||
                      correctionFdr.notes ||
                      'Regional scrutiny desk requested clarification or amended document resubmission.'}
                  </p>
                  <button
                    onClick={() => onOpenScrutinyModal && onOpenScrutinyModal(correctionFdr)}
                    className="self-start text-[11px] font-bold text-amber-900 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-200 hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    <span>Open Resubmission Wizard</span>
                    <span className="material-symbols-outlined text-[12px] leading-none">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* Alert 2: Renewal due */}
              {renewalFdr && (
                <div className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-500/30 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 dark:text-rose-200 bg-rose-100/90 dark:bg-rose-900/60 px-1.5 py-0.5 rounded border border-transparent dark:border-rose-700/50">
                      Renewal Due
                    </span>
                    <span className="font-data-mono font-bold text-[11px] text-rose-950 dark:text-rose-200">
                      {renewalFdr.fdrNumber}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-900 dark:text-rose-200 leading-relaxed font-medium">
                    Deposit matures on {formatDate(renewalFdr.maturityDate)}. Rollover application must be submitted to prevent regulatory lapse.
                  </p>
                  <button
                    onClick={() => setActiveRoute('renewals')}
                    className="self-start text-[11px] font-bold text-rose-900 hover:text-rose-950 dark:text-rose-300 dark:hover:text-rose-200 hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    <span>Initiate Rollover Schedule</span>
                    <span className="material-symbols-outlined text-[12px] leading-none">arrow_forward</span>
                  </button>
                </div>
              )}

              {/* Alert 3: Active Standing */}
              {activeCount > 0 && (
                <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-500/30 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200 bg-teal-100/90 dark:bg-teal-900/60 px-1.5 py-0.5 rounded border border-transparent dark:border-teal-700/50">
                      Statutory Custody
                    </span>
                    <span className="font-data-mono font-bold text-[11px] text-teal-950 dark:text-teal-200">
                      {activeCount} Active Liens
                    </span>
                  </div>
                  <p className="text-[11px] text-teal-900 dark:text-teal-200 leading-relaxed font-medium">
                    Statutory tripartite lien registered in favor of AICTE Member Secretary. All instruments verified compliant.
                  </p>
                </div>
              )}

              {/* Clean state if 0 FDRs */}
              {collegeFdrs.length === 0 && (
                <div className="py-6 flex flex-col items-center justify-center text-center text-secondary">
                  <span className="material-symbols-outlined text-3xl mb-1 text-teal-700">info</span>
                  <p className="text-xs font-semibold text-on-surface">No Instruments Pledged</p>
                  <p className="text-[11px] text-secondary mt-0.5">
                    Click "Submit New FDR" above to register your institution's initial statutory deposit.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-surface-container-low flex items-center justify-between">
            <span className="text-[11px] text-secondary">
              Statutory Guidelines & Templates
            </span>
            <button
              onClick={() => setActiveRoute('help')}
              className="text-xs font-semibold text-teal-800 hover:text-teal-900 hover:underline cursor-pointer"
            >
              Regulatory Manuals →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
