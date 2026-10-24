import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
import { FDR_STATUSES, STATUTORY_TEMPLATES } from '../data/mockData';

export default function InstitutionDashboard({
  fdrs,
  onOpenSubmitModal,
  onOpenScrutinyModal,
  onSelectFdr
}) {
  const { setActiveRoute, setSelectedFdrRef, currentUser } = useRole();

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

  const filteredFdrs = useMemo(() => {
    return collegeFdrs.filter(f => {
      const matchesSearch =
        !searchTerm ||
        f.fdrNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.programme.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.bank.toLowerCase().includes(searchTerm.toLowerCase());

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
    setActiveRoute('verification_audit');
  };

  const correctionFdr = collegeFdrs.find(f => f.status === FDR_STATUSES.CORRECTION_REQUIRED);
  const renewalFdr = collegeFdrs.find(f => f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.MATURED);

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* 1. Compact Header with Single Primary Action */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-surface-container">
        <div>
          <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
            Institution FDR Portfolio
          </h1>
          <p className="font-body-sm text-xs text-secondary mt-0.5">
            PID: <strong>{currentUser?.aictePid || currentUser?.pid || '1-10928374'}</strong> • {currentUser?.institutionName || "St. Xavier's Engineering College, Pune"} (WRO Region)
          </p>
        </div>

        <button
          onClick={onOpenSubmitModal}
          className="rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs px-4 py-2.5 font-semibold shadow-xs inline-flex items-center gap-2 transition-colors shrink-0"
          type="button"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          <span>Submit New FDR</span>
        </button>
      </div>

      {/* 2. Four Clean Useful KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary font-medium">Total Portfolio FDRs</span>
            <div className="w-9 h-9 rounded-xl bg-surface-container-low text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-data-mono text-on-surface tracking-tight">
              {collegeFdrs.length}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium">
              Total Value: <strong className="text-on-surface">₹3,50,00,000</strong>
            </p>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary font-medium">Active Liens</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-data-mono text-emerald-800 tracking-tight">
              {collegeFdrs.filter(f => f.status === FDR_STATUSES.ACTIVE).length}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium">
              Joint APH Lien Enforced
            </p>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary font-medium">Pending Review / Clarification</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
              <span className="material-symbols-outlined text-[20px]">pending_actions</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-data-mono text-amber-800 tracking-tight">
              {collegeFdrs.filter(f => f.status === FDR_STATUSES.CORRECTION_REQUIRED || f.status === FDR_STATUSES.SUBMITTED).length}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium">
              Awaiting Scrutiny / Resubmission
            </p>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs text-secondary font-medium">Maturing Within 60 Days</span>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center border border-rose-100">
              <span className="material-symbols-outlined text-[20px]">event_busy</span>
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-data-mono text-rose-800 tracking-tight">
              {collegeFdrs.filter(f => f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.MATURED).length}
            </div>
            <p className="text-[11px] text-secondary mt-1 font-medium">
              Rollover renewal action required
            </p>
          </div>
        </div>
      </div>

      {/* 3. Action Required Section */}
      {(correctionFdr || renewalFdr) && (
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-surface-container-low mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-teal-800 text-[18px]">assignment_turned_in</span>
              <h2 className="font-headline-md text-sm font-bold text-on-surface">Action Required</h2>
            </div>
            <span className="text-[11px] font-medium text-secondary">
              Statutory tasks requiring institution attention
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {correctionFdr && (
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-amber-700">warning</span>
                    Correction Requested: {correctionFdr.fdrNumber}
                  </span>
                  <p className="text-[11px] text-amber-800 mt-1 line-clamp-2 leading-relaxed">
                    {correctionFdr.discrepancyNote || 'WRO scrutiny desk requested Form L-1 amendment.'}
                  </p>
                </div>
                <button
                  onClick={onOpenScrutinyModal}
                  className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold shrink-0 transition-colors shadow-xs"
                >
                  Review & Resubmit
                </button>
              </div>
            )}

            {renewalFdr && (
              <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 flex items-start justify-between gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-rose-700">event_repeat</span>
                    Maturity Rollover Due: {renewalFdr.fdrNumber}
                  </span>
                  <p className="text-[11px] text-rose-800 mt-1 line-clamp-2 leading-relaxed">
                    Matures on {renewalFdr.maturityDate}. Initiate statutory term rollover.
                  </p>
                </div>
                <button
                  onClick={() => setActiveRoute('renewals')}
                  className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold shrink-0 transition-colors shadow-xs"
                >
                  Initiate Renewal
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Pledged FDRs Activity Table */}
      <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-surface-container-low">
          <div>
            <h2 className="font-headline-md text-sm font-bold text-on-surface">Pledged Fixed Deposit Receipts</h2>
            <p className="font-body-sm text-[11px] text-secondary mt-0.5">
              Legally endorsed security deposits under joint mandate with AICTE Member Secretary
            </p>
          </div>

          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'all'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              All ({collegeFdrs.length})
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'active'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Active ({collegeFdrs.filter(f => f.status === FDR_STATUSES.ACTIVE).length})
            </button>
            <button
              onClick={() => setActiveTab('correction')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'correction'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Clarification Due ({collegeFdrs.filter(f => f.status === FDR_STATUSES.CORRECTION_REQUIRED).length})
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
              placeholder="Filter by receipt number, bank, or course..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <div className="text-xs text-secondary">
            Showing <strong>{filteredFdrs.length}</strong> records
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-surface-container-low">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-9 border-b border-surface-container-low">
                <th className="px-4 py-2 font-semibold">Receipt Number</th>
                <th className="px-4 py-2 font-semibold">Programme & Approval</th>
                <th className="px-4 py-2 font-semibold">Bank & Branch</th>
                <th className="px-4 py-2 text-right font-semibold">Amount (INR)</th>
                <th className="px-4 py-2 font-semibold">Maturity Date</th>
                <th className="px-4 py-2 text-center font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low bg-surface-container-lowest">
              {filteredFdrs.map((fdr) => (
                <tr key={fdr.id} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="px-4 py-3 font-data-mono font-semibold text-on-surface">
                    {fdr.fdrNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-on-surface block">{fdr.programme}</span>
                    <span className="text-[10px] text-secondary">{fdr.courseDetails}</span>
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
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {fdr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {fdr.status === FDR_STATUSES.CORRECTION_REQUIRED && (
                        <button
                          onClick={onOpenScrutinyModal}
                          className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs rounded-lg font-semibold transition-colors"
                        >
                          Resubmit
                        </button>
                      )}
                      <button
                        onClick={() => handleInspect(fdr)}
                        className="px-2.5 py-1 bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary text-xs rounded-lg font-semibold transition-colors border border-surface-container"
                        title="View FDR details"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}