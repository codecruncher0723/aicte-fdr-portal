import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
import { FDR_STATUSES } from '../data/mockData';

export default function AdminDashboard({
  fdrs,
  onSelectFdr,
  onOpenSubmitModal,
  onOpenDetailModal
}) {
  const { setActiveRoute, setSelectedFdrRef } = useRole();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Four Core Useful KPIs calculated from active dataset
  const kpis = useMemo(() => {
    const totalCount = fdrs.length;
    const activeCount = fdrs.filter(f => f.status === FDR_STATUSES.ACTIVE).length;
    const pendingVerificationCount = fdrs.filter(f =>
      f.status === FDR_STATUSES.SUBMITTED ||
      f.status === FDR_STATUSES.UNDER_VERIFICATION ||
      f.status === FDR_STATUSES.CORRECTION_REQUIRED ||
      f.status === FDR_STATUSES.PENDING_APPROVAL
    ).length;
    const maturing60Count = fdrs.filter(f =>
      f.status === FDR_STATUSES.MATURING_SOON ||
      f.status === FDR_STATUSES.MATURED ||
      f.status === FDR_STATUSES.RENEWAL_REQUESTED
    ).length;

    return {
      totalCount,
      totalAmountFormatted: '₹14,128.50 Cr', // Master institutional portfolio aggregate
      activeCount,
      pendingVerificationCount,
      maturing60Count
    };
  }, [fdrs]);

  // 2. Action Required Counts
  const actionItems = useMemo(() => {
    const pendingReviews = fdrs.filter(f => f.status === FDR_STATUSES.SUBMITTED || f.status === FDR_STATUSES.UNDER_VERIFICATION).length;
    const correctionsRequired = fdrs.filter(f => f.status === FDR_STATUSES.CORRECTION_REQUIRED).length;
    const renewalsDue = fdrs.filter(f => f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.RENEWAL_REQUESTED).length;
    const releasePending = (releaseRequests && releaseRequests.length > 0)
      ? releaseRequests.filter(r => ['REQUESTED', 'UNDER_VERIFICATION', 'PENDING_APPROVAL', 'RELEASE_APPROVED', 'AWAITING_CONFIRMATION'].includes(r.status)).length
      : fdrs.filter(f => f.status === FDR_STATUSES.RELEASE_REQUESTED || f.status === FDR_STATUSES.RELEASE_APPROVED).length;

    return [
      {
        id: 'verif',
        title: 'Pending Verification',
        count: pendingReviews,
        desc: 'New submissions awaiting scrutiny',
        icon: 'verified',
        route: 'verification_audit',
        badgeColor: 'bg-primary-fixed text-on-primary-fixed'
      },
      {
        id: 'corr',
        title: 'Deficiency Corrections',
        count: correctionsRequired,
        desc: 'Instruments with discrepancy flag',
        icon: 'warning',
        route: 'verification_audit',
        badgeColor: 'bg-error-container text-on-error-container'
      },
      {
        id: 'renew',
        title: 'Renewals Due (< 60 Days)',
        count: renewalsDue,
        desc: 'Maturing deposits requiring rollover',
        icon: 'event_repeat',
        route: 'maturity_renewals',
        badgeColor: 'bg-tertiary-fixed text-on-tertiary-fixed'
      },
      {
        id: 'release',
        title: 'Release / Refund Requests',
        count: releasePending,
        desc: 'Refund requests pending action',
        icon: 'currency_exchange',
        route: 'release_requests',
        badgeColor: 'bg-secondary-container text-on-secondary-container'
      }
    ];
  }, [fdrs]);

  // 3. Filtered Recent FDR Activity Table
  const filteredFdrs = useMemo(() => {
    return fdrs.filter(fdr => {
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
      if (activeTab === 'releases') {
        return fdr.status === FDR_STATUSES.RELEASE_REQUESTED || fdr.status === FDR_STATUSES.RELEASE_APPROVED || fdr.status === FDR_STATUSES.RELEASED_REFUNDED;
      }
      return true;
    });
  }, [fdrs, searchTerm, activeTab]);

  const handleInspect = (fdr) => {
    setSelectedFdrRef(fdr.fdrNumber);
    if (onSelectFdr) onSelectFdr(fdr);
    if (onOpenDetailModal) {
      onOpenDetailModal(fdr);
    } else {
      setActiveRoute('verification_audit');
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
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* 1. Compact Page Header with One Primary Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-surface-container">
        <div>
          <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
            FDR Monitoring & Custody Dashboard
          </h1>
          <p className="font-body-sm text-xs text-secondary mt-0.5">
            Central Regulatory Financial Custody Division • Statutory Security Deposit Monitoring (FY 2024-25)
          </p>
        </div>

        <button
          onClick={handleRegisterAction}
          className="rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs px-4 py-2.5 font-semibold shadow-xs inline-flex items-center gap-2 transition-colors shrink-0"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Register New FDR</span>
        </button>
      </div>

      {/* 2. Four Clean Useful KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total FDRs */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs text-secondary font-medium">Total FDRs</span>
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

        {/* KPI 2: Active FDRs */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs text-secondary font-medium">Active FDRs</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-data-mono text-emerald-800 tracking-tight">
              {kpis.activeCount}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium">
              Statutory Lien Registered & Active
            </p>
          </div>
        </div>

        {/* KPI 3: Pending Verification */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs text-secondary font-medium">Pending Verification</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <span className="material-symbols-outlined text-[20px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-data-mono text-amber-800 tracking-tight">
              {kpis.pendingVerificationCount}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium">
              New submissions & corrections in queue
            </p>
          </div>
        </div>

        {/* KPI 4: Maturing Within 60 Days */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-xs text-secondary font-medium">Maturing Within 60 Days</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
              <span className="material-symbols-outlined text-[20px]">event_busy</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-data-mono text-rose-800 tracking-tight">
              {kpis.maturing60Count}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium">
              Requires renewal or release review
            </p>
          </div>
        </div>
      </div>

      {/* 3. Action Required Section (Clickable counts for pending work) */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-surface-container-low mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-800 text-[18px]">assignment_turned_in</span>
            <h2 className="font-headline-md text-sm font-bold text-on-surface">Action Required</h2>
          </div>
          <span className="text-[11px] font-medium text-secondary">
            Click an item to open the corresponding workflow queue
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {actionItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveRoute(item.route)}
              className="flex items-start justify-between p-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container hover:border-primary/30 border border-surface-container transition-all text-left group"
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

      {/* 4. Compact Maturity Horizon Schedule (Informative without dominating the page) */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-surface-container-low">
          <div>
            <h2 className="font-headline-md text-sm font-bold text-on-surface">
              Upcoming Maturity Schedule (6-Month Horizon)
            </h2>
            <p className="font-body-sm text-[11px] text-secondary">
              Anticipated maturity volume and statutory renewal obligations
            </p>
          </div>
          <button
            onClick={() => setActiveRoute('maturity_renewals')}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Open Maturity Manager</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
          {[
            { month: 'Nov 2024', count: 12, value: '₹14.2 Cr', status: 'Urgent Action', color: 'bg-rose-50 text-rose-800 border-rose-200' },
            { month: 'Dec 2024', count: 28, value: '₹32.5 Cr', status: 'Notices Sent', color: 'bg-amber-50 text-amber-800 border-amber-200' },
            { month: 'Jan 2025', count: 45, value: '₹51.0 Cr', status: 'Tracking', color: 'bg-surface-container-low text-on-surface border-surface-container' },
            { month: 'Feb 2025', count: 34, value: '₹38.8 Cr', status: 'Tracking', color: 'bg-surface-container-low text-on-surface border-surface-container' },
            { month: 'Mar 2025', count: 82, value: '₹95.4 Cr', status: 'Peak Horizon', color: 'bg-teal-50 text-teal-800 border-teal-200' },
            { month: 'Apr 2025', count: 19, value: '₹22.1 Cr', status: 'Upcoming', color: 'bg-surface-container-low text-on-surface border-surface-container' },
          ].map((h, i) => (
            <div key={i} className={`p-3 rounded-xl border flex flex-col justify-between ${h.color}`}>
              <div>
                <span className="text-[11px] font-semibold block uppercase tracking-wider">{h.month}</span>
                <span className="text-lg font-bold font-data-mono block mt-1">{h.count} FDRs</span>
              </div>
              <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-between text-[10px]">
                <span className="font-data-mono font-medium">{h.value}</span>
                <span className="font-semibold">{h.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Recent FDR Activity Table */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-surface-container-low">
          <div>
            <h2 className="font-headline-md text-sm font-bold text-on-surface">Recent FDR Activity</h2>
            <p className="font-body-sm text-[11px] text-secondary mt-0.5">
              Live audit ledger of institutional term deposit certificates and pledge status
            </p>
          </div>

          {/* Segmented Filter Tabs */}
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
              Pending ({fdrs.filter(f => f.status === FDR_STATUSES.SUBMITTED || f.status === FDR_STATUSES.UNDER_VERIFICATION || f.status === FDR_STATUSES.CORRECTION_REQUIRED).length})
            </button>
            <button
              onClick={() => setActiveTab('renewals')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'renewals'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Renewals ({fdrs.filter(f => f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.RENEWAL_REQUESTED).length})
            </button>
            <button
              onClick={() => setActiveTab('releases')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'releases'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Releases ({fdrs.filter(f => f.status === FDR_STATUSES.RELEASE_REQUESTED || f.status === FDR_STATUSES.RELEASE_APPROVED).length})
            </button>
          </div>
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

        {/* High-Density Government-Style Table */}
        <div className="overflow-x-auto rounded-xl border border-surface-container-low">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-9 border-b border-surface-container-low">
                <th className="px-4 py-2 font-semibold">Receipt Number</th>
                <th className="px-4 py-2 font-semibold">Institution</th>
                <th className="px-4 py-2 font-semibold">Bank & Branch</th>
                <th className="px-4 py-2 text-right font-semibold">Amount (INR)</th>
                <th className="px-4 py-2 font-semibold">Maturity Date</th>
                <th className="px-4 py-2 text-center font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low bg-surface-container-lowest">
              {filteredFdrs.map((fdr) => (
                <tr key={fdr.id} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="px-4 py-3 font-data-mono font-semibold text-on-surface">
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
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : fdr.status === FDR_STATUSES.CORRECTION_REQUIRED
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.MATURED
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-surface-container-low text-secondary border border-surface-container'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {fdr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleInspect(fdr)}
                      className="px-2.5 py-1 bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary text-xs rounded-lg font-semibold transition-colors border border-surface-container"
                      title="View FDR details"
                    >
                      View
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