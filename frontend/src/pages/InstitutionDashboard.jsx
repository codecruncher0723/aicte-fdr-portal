import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
import { FDR_STATUSES } from '../data/mockData';

// Helper: Format Currency (INR)
const formatCurrency = (amt) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
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
  onSelectFdr
}) {
  const { setActiveRoute, setSelectedFdrRef, currentUser, fiscalYear } = useRole();

  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // College-specific FDRs for current institution
  const collegeFdrs = useMemo(() => {
    const userPid = currentUser?.aictePid || currentUser?.pid || '1-10928374';
    const userInst = (currentUser?.institutionName || currentUser?.institution || '').toLowerCase();

    return fdrs.filter(f => {
      if (f.aictePid === userPid) return true;
      if (userInst && f.institutionName && f.institutionName.toLowerCase().includes(userInst)) return true;
      if (f.aictePid === '1-10928374' || (f.institutionName && f.institutionName.includes("St. Xavier's"))) return true;
      return false;
    });
  }, [fdrs, currentUser]);

  // Aggregate monetary value
  const totalAmountFormatted = useMemo(() => {
    const total = collegeFdrs.reduce((sum, f) => sum + (f.amount || 0), 0);
    return formatCurrency(total);
  }, [collegeFdrs]);

  // Active counts for KPIs
  const activeCount = useMemo(() => {
    return collegeFdrs.filter(f => f.status === FDR_STATUSES.ACTIVE).length;
  }, [collegeFdrs]);

  const pendingReviewCount = useMemo(() => {
    return collegeFdrs.filter(f =>
      f.status === FDR_STATUSES.CORRECTION_REQUIRED ||
      f.status === FDR_STATUSES.SUBMITTED ||
      f.status === FDR_STATUSES.UNDER_VERIFICATION
    ).length;
  }, [collegeFdrs]);

  const maturingSoonCount = useMemo(() => {
    return collegeFdrs.filter(f =>
      f.status === FDR_STATUSES.MATURING_SOON ||
      f.status === FDR_STATUSES.MATURED
    ).length;
  }, [collegeFdrs]);

  // Action-required FDRs
  const correctionFdr = useMemo(() => {
    return collegeFdrs.find(f => f.status === FDR_STATUSES.CORRECTION_REQUIRED);
  }, [collegeFdrs]);

  const renewalFdr = useMemo(() => {
    return collegeFdrs.find(f => f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.MATURED);
  }, [collegeFdrs]);

  // Filtered FDRs based on tab and search
  const filteredFdrs = useMemo(() => {
    return collegeFdrs.filter(f => {
      const matchesSearch =
        !searchTerm ||
        f.fdrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.programme.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.bank.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (f.certNumber && f.certNumber.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (activeTab === 'active') return f.status === FDR_STATUSES.ACTIVE;
      if (activeTab === 'correction') return f.status === FDR_STATUSES.CORRECTION_REQUIRED;
      if (activeTab === 'renewal') return f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.MATURED;
      return true;
    });
  }, [collegeFdrs, searchTerm, activeTab]);

  const handleInspect = (fdr) => {
    setSelectedFdrRef(fdr.fdrNumber);
    if (onSelectFdr) onSelectFdr(fdr);
  };

  // Recent Institution Activities (Institutional Scope)
  const recentActivities = [
    {
      id: 'act_1',
      title: 'Form L-1 Amendment Prepared',
      target: 'FDR-PNB-883921',
      date: 'Today, 12:10 PM',
      desc: 'Branch Manager signature stamp affixed. Awaiting digital re-upload for WRO Scrutiny Desk.',
      type: 'warning',
      badge: 'Clarification Pending',
      icon: 'edit_document'
    },
    {
      id: 'act_2',
      title: '3-Year Rollover Extension Drafted',
      target: 'FDR-SBI-440192',
      date: '10 Nov 2024, 11:15 AM',
      desc: 'Renewal application generated for March 2025 maturity rollover under Regulation 14(B).',
      type: 'info',
      badge: 'Renewal Draft',
      icon: 'autorenew'
    },
    {
      id: 'act_3',
      title: 'Core Banking Lien Confirmed',
      target: 'FDR-BOB-910283',
      date: '03 Nov 2024, 02:40 PM',
      desc: 'Bank of Baroda FC Road branch acknowledged tripartite irrevocable statutory lien in Finacle.',
      type: 'success',
      badge: 'Lien Active',
      icon: 'verified'
    },
    {
      id: 'act_4',
      title: 'Annual Collateral Audit Cleared',
      target: 'FDR-HDFC-992014',
      date: '28 Oct 2024, 09:30 AM',
      desc: 'Statutory minimum deposit of ₹1.25 Cr validated against AICTE approved MBA intake capacity.',
      type: 'success',
      badge: 'Compliant',
      icon: 'check_circle'
    }
  ];

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
              PID: <strong className="text-on-surface font-semibold">{currentUser?.aictePid || currentUser?.pid || '1-10928374'}</strong> • {currentUser?.institutionName || "St. Xavier's Engineering College, Pune"} (WRO Region)
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
              {collegeFdrs.length}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium flex items-center justify-between">
              <span>Total Value: <strong className="text-on-surface font-data-mono font-semibold">{totalAmountFormatted}</strong></span>
              <span className="text-[10px] text-teal-800 font-semibold hover:underline">View All →</span>
            </p>
          </div>
        </div>

        {/* Card 2: Active Liens */}
        <div
          onClick={() => setActiveTab('active')}
          className={`bg-surface-container-lowest p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between ${
            activeTab === 'active'
              ? 'border-emerald-600/60 ring-2 ring-emerald-600/15 bg-emerald-50/10'
              : 'border-surface-container hover:border-emerald-600/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary font-semibold uppercase tracking-wider">
              Active Liens
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200/80 leading-none">
              <span className="material-symbols-outlined text-[18px] leading-none shrink-0">verified_user</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-data-mono text-emerald-800 tracking-tight">
              {activeCount}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium flex items-center justify-between">
              <span className="inline-flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                Joint APH Lien Enforced
              </span>
              <span className="text-[10px] text-emerald-800 font-semibold hover:underline">Filter →</span>
            </p>
          </div>
        </div>

        {/* Card 3: Pending Review */}
        <div
          onClick={() => setActiveTab('correction')}
          className={`bg-surface-container-lowest p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between ${
            activeTab === 'correction'
              ? 'border-amber-600/60 ring-2 ring-amber-600/15 bg-amber-50/15'
              : 'border-surface-container hover:border-amber-600/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary font-semibold uppercase tracking-wider">
              Pending Review
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200/80 leading-none">
              <span className="material-symbols-outlined text-[18px] leading-none shrink-0">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-data-mono text-amber-900 tracking-tight">
              {pendingReviewCount}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium flex items-center justify-between">
              <span className="text-amber-800 font-medium">Clarification Required</span>
              <span className="text-[10px] text-amber-800 font-semibold hover:underline">Filter →</span>
            </p>
          </div>
        </div>

        {/* Card 4: Maturing Within 60 Days */}
        <div
          onClick={() => setActiveTab('renewal')}
          className={`bg-surface-container-lowest p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-xs hover:shadow-sm flex flex-col justify-between ${
            activeTab === 'renewal'
              ? 'border-rose-600/60 ring-2 ring-rose-600/15 bg-rose-50/15'
              : 'border-surface-container hover:border-rose-600/30'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-secondary font-semibold uppercase tracking-wider">
              Maturing Soon
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center shrink-0 border border-rose-200/80 leading-none">
              <span className="material-symbols-outlined text-[18px] leading-none shrink-0">event_busy</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-bold font-data-mono text-rose-900 tracking-tight">
              {maturingSoonCount}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium flex items-center justify-between">
              <span className="text-rose-800 font-medium">Rollover Action Due</span>
              <span className="text-[10px] text-rose-800 font-semibold hover:underline">Filter →</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Action Required Section (Highest Priority Tasks for Officer) */}
      {(correctionFdr || renewalFdr) && (
        <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl border border-surface-container shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-surface-container-low mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0 border border-teal-200/80 leading-none">
                <span className="material-symbols-outlined text-[16px] leading-none shrink-0">task_alt</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline-md text-sm sm:text-base font-bold text-on-surface">
                    Action Required
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 uppercase tracking-wider">
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
              <div className="bg-gradient-to-br from-amber-50/70 to-white border border-amber-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-900 border border-amber-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
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
                      {correctionFdr.bank} • {correctionFdr.branch} • <strong className="font-data-mono text-on-surface">{correctionFdr.amountFormatted}</strong>
                    </p>
                  </div>

                  <div className="bg-white/90 border border-amber-200/80 rounded-xl p-3 my-3 text-xs text-amber-950 leading-relaxed flex items-start gap-2.5 shadow-2xs">
                    <span className="material-symbols-outlined text-[18px] text-amber-800 shrink-0 leading-none mt-0.5">
                      warning
                    </span>
                    <p className="text-[11px] font-medium text-amber-950">
                      {correctionFdr.discrepancyNote || 'WRO Scrutiny Desk requested amended Form L-1 with explicit Western Regional Office descriptor.'}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-amber-100/80 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[11px] text-secondary inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    Resubmit before scrutiny cycle cut-off
                  </span>
                  <button
                    onClick={onOpenScrutinyModal}
                    className="px-4 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 active:bg-amber-900 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
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
              <div className="bg-gradient-to-br from-rose-50/60 to-white border border-rose-200/90 rounded-2xl p-4 sm:p-5 flex flex-col justify-between shadow-xs transition-shadow hover:shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-rose-100 text-rose-900 border border-rose-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
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
                      {renewalFdr.bank} • {renewalFdr.branch} • <strong className="font-data-mono text-on-surface">{renewalFdr.amountFormatted}</strong>
                    </p>
                  </div>

                  <div className="bg-white/90 border border-rose-200/80 rounded-xl p-3 my-3 text-xs text-rose-950 leading-relaxed flex items-start gap-2.5 shadow-2xs">
                    <span className="material-symbols-outlined text-[18px] text-rose-800 shrink-0 leading-none mt-0.5">
                      event_repeat
                    </span>
                    <p className="text-[11px] font-medium text-rose-950">
                      Matures on <strong>{formatDate(renewalFdr.maturityDate)}</strong>. Under APH Regulation 14(B), initiate renewal with scheduled commercial bank to prevent lien enforcement breach.
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-rose-100/80 flex items-center justify-between gap-3 flex-wrap">
                  <span className="text-[11px] text-secondary inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">timelapse</span>
                    Pre-maturity window open
                  </span>
                  <button
                    onClick={() => setActiveRoute('renewals')}
                    className="px-4 py-2 rounded-xl bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white text-xs font-semibold shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
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
              <h2 className="font-headline-md text-sm sm:text-base font-bold text-on-surface">
                Pledged Fixed Deposit Receipts
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-secondary">
                {filteredFdrs.length} Instruments
              </span>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Legally endorsed security deposits under joint mandate with AICTE Member Secretary
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-surface-container-lowest text-teal-800 shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              All ({collegeFdrs.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'active'
                  ? 'bg-surface-container-lowest text-teal-800 shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setActiveTab('correction')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'correction'
                  ? 'bg-surface-container-lowest text-teal-800 shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Clarification Due ({collegeFdrs.filter(f => f.status === FDR_STATUSES.CORRECTION_REQUIRED).length})
            </button>
            <button
              onClick={() => setActiveTab('renewal')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'renewal'
                  ? 'bg-surface-container-lowest text-teal-800 shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Renewal Due ({maturingSoonCount})
            </button>
          </div>
        </div>

        {/* Filter sub-bar with Search & Count */}
        <div className="flex items-center justify-between gap-3 my-3.5 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[16px] leading-none shrink-0 pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by receipt number, programme, or bank..."
              className="w-full h-8.5 pl-9 pr-8 text-xs bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-teal-700 text-on-surface placeholder:text-outline"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-secondary hover:text-on-surface p-0.5 cursor-pointer"
                title="Clear Search"
              >
                <span className="material-symbols-outlined text-[14px] leading-none shrink-0">close</span>
              </button>
            )}
          </div>
          <div className="text-xs text-secondary font-medium">
            Showing <strong className="text-on-surface font-semibold">{filteredFdrs.length}</strong> of {collegeFdrs.length} FDR records
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto rounded-xl border border-surface-container-low">
          <table className="w-full text-left border-collapse text-xs min-w-[900px]">
            <thead>
              <tr className="bg-surface-container-low/70 text-secondary uppercase tracking-wider text-[11px] h-10 border-b border-surface-container-low">
                <th className="px-4 py-2.5 font-semibold">Receipt Number</th>
                <th className="px-4 py-2.5 font-semibold">Programme & Approval</th>
                <th className="px-4 py-2.5 font-semibold">Bank & Branch</th>
                <th className="px-4 py-2.5 text-right font-semibold">Amount (INR)</th>
                <th className="px-4 py-2.5 font-semibold">Maturity Date</th>
                <th className="px-4 py-2.5 font-semibold">Last Audited</th>
                <th className="px-4 py-2.5 text-center font-semibold">Status</th>
                <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low bg-surface-container-lowest">
              {filteredFdrs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-secondary">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[32px] text-outline">search_off</span>
                      <p className="font-semibold text-xs text-on-surface">No matching FDRs found</p>
                      <p className="text-[11px]">Try adjusting your search query or switching active status filter tabs.</p>
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
                        {fdr.certNumber || fdr.tripartiteRef?.split('/')[0]?.trim()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-on-surface block text-xs">{fdr.programme}</span>
                      <span className="text-[11px] text-secondary block mt-0.5">{fdr.courseDetails}</span>
                    </td>
                    <td className="px-4 py-3.5 text-secondary">
                      <span className="font-medium text-on-surface block text-xs">{fdr.bank}</span>
                      <span className="text-[10px] text-secondary block mt-0.5">{fdr.branch}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-data-mono font-bold text-on-surface text-xs">
                      <div>{fdr.amountFormatted}</div>
                      <span className="text-[10px] text-secondary font-normal font-sans block mt-0.5">
                        {fdr.interestRate}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-data-mono text-on-surface text-xs">
                      <div>{formatDate(fdr.maturityDate)}</div>
                      <span className="text-[10px] text-secondary font-sans block mt-0.5">
                        {fdr.tenureYears} Years Tenure
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-data-mono text-secondary text-xs">
                      {formatDate(fdr.lastAuditDate || fdr.issueDate)}
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
                            onClick={onOpenScrutinyModal}
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

      {/* 5. Lower Section: Recent Activity & Compliance Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Recent Activity (7 Cols) */}
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

            <div className="divide-y divide-surface-container-low">
              {recentActivities.map((act) => (
                <div key={act.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 leading-none ${
                      act.type === 'warning'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : act.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-teal-50 text-teal-800 border border-teal-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] leading-none shrink-0">
                      {act.icon}
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-xs text-on-surface truncate">
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
                      <span className="font-data-mono text-[10px] font-bold text-on-surface bg-surface-container-low px-1.5 py-0.2 rounded border border-surface-container">
                        {act.target}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.2 rounded-full ${
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
          </div>

          <div className="pt-3 mt-3 border-t border-surface-container-low flex items-center justify-between">
            <span className="text-[11px] text-secondary">
              Telemetry synchronized with AICTE Central Database
            </span>
            <button
              onClick={() => setActiveRoute('my_fdrs')}
              className="text-xs font-semibold text-teal-800 hover:text-teal-900 hover:underline cursor-pointer"
            >
              View Full Portfolio Archive →
            </button>
          </div>
        </div>

        {/* Right: Compliance Notices & Regulatory Guidelines (5 Cols) */}
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
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                2 Active
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {/* Alert 1 */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded">
                    Action Required
                  </span>
                  <span className="font-data-mono font-bold text-[11px] text-amber-950">
                    FDR-PNB-883921
                  </span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                  Regional scrutiny desk requested Form L-1 joint descriptor amendment. Please re-upload with official bank manager seal.
                </p>
                <button
                  onClick={onOpenScrutinyModal}
                  className="self-start text-[11px] font-bold text-amber-900 hover:text-amber-950 hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer"
                >
                  <span>Open Resubmission Wizard</span>
                  <span className="material-symbols-outlined text-[12px] leading-none">arrow_forward</span>
                </button>
              </div>

              {/* Alert 2 */}
              <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-900 bg-rose-100/90 px-1.5 py-0.5 rounded">
                    Renewal Due
                  </span>
                  <span className="font-data-mono font-bold text-[11px] text-rose-950">
                    FDR-SBI-440192
                  </span>
                </div>
                <p className="text-[11px] text-rose-900 leading-relaxed font-medium">
                  Deposit enters 120-day pre-maturity window on 14 Mar 2025. Mandatory rollover application ready for submission.
                </p>
                <button
                  onClick={() => setActiveRoute('renewals')}
                  className="self-start text-[11px] font-bold text-rose-900 hover:text-rose-950 hover:underline inline-flex items-center gap-1 mt-1 cursor-pointer"
                >
                  <span>Initiate Rollover Schedule</span>
                  <span className="material-symbols-outlined text-[12px] leading-none">arrow_forward</span>
                </button>
              </div>

              {/* Alert 3 */}
              <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/80 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-900 bg-teal-100/90 px-1.5 py-0.5 rounded">
                    Submission Accepted
                  </span>
                  <span className="font-data-mono font-bold text-[11px] text-teal-950">
                    FDR-BOB-910283
                  </span>
                </div>
                <p className="text-[11px] text-teal-900 leading-relaxed font-medium">
                  Bank of Baroda statutory non-encashment lien successfully attested in Finacle core banking registry.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-surface-container-low flex items-center justify-between">
            <span className="text-[11px] text-secondary">
              Statutory Form Templates Available
            </span>
            <button
              onClick={() => setActiveRoute('aph_guidelines_templates')}
              className="text-xs font-semibold text-teal-800 hover:text-teal-900 hover:underline cursor-pointer"
            >
              Download Form L-1 & BG Schedule →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}