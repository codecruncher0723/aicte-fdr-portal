import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
import { FDR_STATUSES, STATUTORY_TEMPLATES } from '../data/mockData';

export default function InstitutionDashboard({
  fdrs,
  onOpenSubmitModal,
  onOpenScrutinyModal,
  onSelectFdr
}) {
  const { setActiveRoute, setSelectedFdrRef } = useRole();

  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [inspectedFdr, setInspectedFdr] = useState(null);

  // College-specific FDRs (St. Xavier's Engineering College, PID: 1-10928374)
  const collegeFdrs = useMemo(() => {
    return fdrs.filter(f => f.aictePid === '1-10928374');
  }, [fdrs]);

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

  const downloadCertificateMock = () => {
    alert('Generating official AICTE Custody & Lien Certificate PDF for PID 1-10928374...');
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Context Header & Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-secondary font-label-sm uppercase tracking-wider text-xs mb-1">
            <span>Institutional Financial Custody Division</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-semibold">College Overview</span>
          </div>
          <h1 className="font-headline-xl text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
            Institution Security Deposit & FDR Portfolio
          </h1>
          <p className="font-body-md text-xs text-secondary mt-1 flex flex-wrap items-center gap-x-2">
            <span className="font-semibold text-on-surface">PID: 1-10928374</span>
            <span className="inline-block w-1 h-1 rounded-full bg-outline-variant"></span>
            <span>St. Xavier's Engineering College, Pune (WRO Region)</span>
            <span className="inline-block w-1 h-1 rounded-full bg-outline-variant"></span>
            <span>Sponsoring Trust: St. Xavier's Technical Education Society</span>
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => setActiveRoute('aph_guidelines_templates')}
            className="h-9 px-3.5 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface font-label-md text-xs flex items-center gap-1.5 hover:bg-surface-container-low transition-colors shadow-xs font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-secondary">checklist</span>
            <span>APH Checklist</span>
          </button>
          <button
            onClick={downloadCertificateMock}
            className="h-9 px-3.5 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface font-label-md text-xs flex items-center gap-1.5 shadow-xs hover:bg-surface-container-low transition-colors font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-secondary">download</span>
            <span>Custody Certificate (PDF)</span>
          </button>
          <button
            onClick={onOpenSubmitModal}
            className="h-9 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs flex items-center gap-1.5 shadow-sm transition-colors font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            <span>+ Submit New FDR</span>
          </button>
        </div>
      </div>

      {/* Action Required / Urgent Notice Banner */}
      {!bannerDismissed && (
        <div className="relative overflow-hidden rounded-2xl bg-amber-50/90 border border-amber-300 p-4 sm:p-5 shadow-xs animate-in fade-in duration-200">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                <span className="material-symbols-outlined text-[22px]">priority_high</span>
              </div>
              <div className="flex flex-col max-w-4xl text-xs">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-headline-sm text-sm font-bold text-amber-900">
                    1 Action Required from AICTE Western Regional Office (WRO)
                  </span>
                  <span className="font-label-sm text-[10px] uppercase bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-bold">
                    Urgent Notice
                  </span>
                </div>
                <p className="font-body-md text-xs text-on-surface leading-relaxed">
                  <span className="font-semibold text-amber-900">Correction Requested for FDR Ref: FDR-PNB-883921</span> (UG Engineering - ₹1.00 Cr): Branch IFSC verified, but regional office endorsement text requires Form L-1 amendment or updated joint mandate descriptor.
                  <span className="font-bold text-error ml-1">Deadline for resubmission: 15 Nov 2024 (4 days remaining).</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pl-12 lg:pl-0 w-full lg:w-auto">
              <button
                onClick={onOpenScrutinyModal}
                className="h-8 px-3 rounded-xl bg-surface-container-lowest border border-amber-300 text-on-surface font-label-md text-xs hover:bg-surface-container transition-colors shadow-xs font-semibold"
                type="button"
              >
                View Scrutiny Remarks
              </button>
              <button
                onClick={onOpenScrutinyModal}
                className="h-8 px-3.5 rounded-xl bg-amber-700 text-white font-label-md text-xs hover:bg-amber-800 transition-colors shadow-xs flex items-center gap-1 font-semibold"
                type="button"
              >
                <span className="material-symbols-outlined text-[16px]">drive_file_rename_outline</span>
                <span>Review & Resubmit</span>
              </button>
              <button
                onClick={() => setBannerDismissed(true)}
                className="p-1 rounded-lg text-secondary hover:bg-amber-100 transition-colors"
                title="Dismiss Notice"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <h3 className="font-label-md text-xs text-secondary font-medium">Total Portfolio FDRs</h3>
              <span className="font-headline-xl text-xl font-bold text-on-surface mt-1">4 Instruments</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-surface-container-low text-primary flex items-center justify-center border border-surface-container">
              <span className="material-symbols-outlined text-[20px]">account_balance</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-surface-container-low flex flex-col gap-1 text-xs">
            <span className="text-secondary font-medium">₹3,50,00,000 Pledged Collateral</span>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                <span className="material-symbols-outlined text-[13px]">verified</span> 100% Met
              </span>
              <span className="font-data-mono text-[11px] text-secondary font-medium">4/4 Audited</span>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <h3 className="font-label-md text-xs text-secondary font-medium">Active & Endorsed</h3>
              <span className="font-headline-xl text-xl font-bold text-on-surface mt-1">3 Active Liens</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center border border-teal-200">
              <span className="material-symbols-outlined text-[20px]">verified_user</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-surface-container-low flex flex-col gap-1 text-xs">
            <span className="text-secondary font-medium">₹2,50,00,000 in Tripartite Custody</span>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-700"></span> Statutory Compliant
              </span>
              <span className="font-data-mono text-[11px] text-secondary">APH 2024-25</span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <h3 className="font-label-md text-xs text-secondary font-medium">Expiring Horizon</h3>
              <span className="font-headline-xl text-xl font-bold text-on-surface mt-1">1 Instrument</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center border border-amber-200">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-surface-container-low flex flex-col gap-1 text-xs">
            <span className="text-secondary font-medium truncate">FDR-SBI-440192 (₹75L) due 14 Mar 2025</span>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                <span className="material-symbols-outlined text-[13px]">sync_problem</span> Renewal Action Due
              </span>
              <span className="font-data-mono text-[11px] text-amber-800 font-bold">118 Days Left</span>
            </div>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="flex flex-col">
              <h3 className="font-label-md text-xs text-secondary font-medium">Pending Review / Scrutiny</h3>
              <span className="font-headline-xl text-xl font-bold text-on-surface mt-1">1 Resubmission</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center border border-rose-200">
              <span className="material-symbols-outlined text-[20px]">fact_check</span>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-surface-container-low flex flex-col gap-1 text-xs">
            <span className="text-secondary font-medium">₹1.00 Cr clarification with WRO</span>
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full font-bold">
                <span className="material-symbols-outlined text-[13px]">hourglass_top</span> WRO Desk
              </span>
              <span className="font-data-mono text-[11px] text-rose-700 font-bold">Due in 4 Days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Split Main Layout: 8 cols Left + 4 cols Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: FDRs Table & Reserve Breakdown (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden flex flex-col">
            {/* Table Toolbar */}
            <div className="p-5 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-headline-md text-base font-bold text-on-surface tracking-tight">
                    My Pledged Fixed Deposit Receipts (FDRs)
                  </h2>
                  <p className="font-body-sm text-xs text-secondary">
                    Legally endorsed security deposits under joint mandate with AICTE Member Secretary.
                  </p>
                </div>
                <span className="font-label-sm text-[11px] bg-surface-container px-2.5 py-1 rounded-full text-secondary font-medium self-start sm:self-auto">
                  Mandate: Joint APH Lien
                </span>
              </div>

              {/* Filter Pills & Instant Search */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
                  <button
                    onClick={() => setActiveTab('all')}
                    className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-bold transition-all ${
                      activeTab === 'all'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-secondary hover:text-on-surface'
                    }`}
                  >
                    All FDRs ({collegeFdrs.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('active')}
                    className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all ${
                      activeTab === 'active'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-secondary hover:text-on-surface'
                    }`}
                  >
                    Active Liens (3)
                  </button>
                  <button
                    onClick={() => setActiveTab('correction')}
                    className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all flex items-center gap-1 ${
                      activeTab === 'correction'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-secondary hover:text-on-surface'
                    }`}
                  >
                    <span>Clarification Due</span>
                    <span className="w-2 h-2 rounded-full bg-error"></span>
                  </button>
                  <button
                    onClick={() => setActiveTab('renewal')}
                    className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all ${
                      activeTab === 'renewal'
                        ? 'bg-primary text-on-primary shadow-xs'
                        : 'bg-surface-container-low text-secondary hover:text-on-surface'
                    }`}
                  >
                    Renewals Due (1)
                  </button>
                </div>

                <div className="relative min-w-[200px]">
                  <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[17px]">
                    search
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Filter reference, bank, course..."
                    className="w-full h-8 pl-8 pr-3 bg-surface-container-low rounded-lg text-xs text-on-surface border border-surface-container focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-10 border-b border-surface-container">
                    <th className="py-2.5 px-3">FDR Ref & Cert</th>
                    <th className="py-2.5 px-3">Programme & Approval</th>
                    <th className="py-2.5 px-3">Pledged Bank & Branch</th>
                    <th className="py-2.5 px-3 text-right">Amount (INR)</th>
                    <th className="py-2.5 px-3">Maturity Horizon</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-body-sm text-on-surface">
                  {filteredFdrs.map((fdr) => (
                    <tr key={fdr.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-data-mono font-bold text-on-surface block">{fdr.fdrNumber}</span>
                        <span className="text-[10px] text-secondary">Cert: {fdr.certNumber}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-on-surface block">{fdr.programme}</span>
                        <span className="text-[10px] text-secondary">{fdr.courseDetails}</span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-on-surface truncate max-w-[170px]">{fdr.bank}</span>
                          <span className="font-data-mono text-[10px] text-secondary">{fdr.branch.split(',')[0]}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <span className="font-data-mono font-bold text-on-surface">{fdr.amountFormatted}</span>
                        <span className="block text-[10px] text-secondary">{fdr.interestRate}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-data-mono text-on-surface font-medium block">{fdr.maturityDate}</span>
                        <span className="text-[10px] text-primary">{fdr.tenureYears}-Yr Active Period</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-[10px] font-bold ${
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
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {fdr.status === FDR_STATUSES.CORRECTION_REQUIRED && (
                            <button
                              onClick={onOpenScrutinyModal}
                              className="h-7 px-2.5 rounded bg-primary text-on-primary font-label-sm text-[11px] hover:bg-primary-container transition-colors shadow-xs font-semibold"
                            >
                              Resubmit
                            </button>
                          )}
                          {fdr.status === FDR_STATUSES.MATURING_SOON && (
                            <button
                              onClick={() => setActiveRoute('renewals')}
                              className="h-7 px-2.5 rounded bg-surface-container text-on-surface font-label-sm text-[11px] hover:bg-surface-container-high transition-colors font-medium"
                            >
                              Rollover
                            </button>
                          )}
                          <button
                            onClick={() => handleInspect(fdr)}
                            className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                            title="Inspect FDR Custody Record"
                          >
                            <span className="material-symbols-outlined text-[17px]">visibility</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="p-3 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-secondary border-t border-surface-container">
              <div className="flex items-center gap-2">
                <span>Displaying 4 institutional instruments</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant"></span>
                <span className="font-data-mono text-on-surface font-semibold">Total: ₹3.50 Crores</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <span className="flex items-center gap-1 text-primary">
                  <span className="material-symbols-outlined text-[15px]">cloud_done</span> SFMS Interconnect Synchronized
                </span>
                <span>•</span>
                <span>Last Sync: Today 11:45 AM</span>
              </div>
            </div>
          </div>

          {/* Statutory Mandate & Collateral Allocation Card */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                  Statutory Collateral Compliance Breakdown
                </h3>
                <span className="text-xs text-secondary">
                  AICTE Approval Process Handbook (APH) Reserve Norms vs. Pledged Instruments
                </span>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                Zero Shortfall
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Corpus 1 */}
              <div className="bg-surface-container-low rounded-xl p-3.5 flex flex-col justify-between border border-surface-container">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface">Faculty / Admin Corpus</span>
                  <span className="text-[11px] text-teal-800 font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                    100% Met
                  </span>
                </div>
                <div className="w-full bg-surface-container-high h-2 rounded-full my-2.5 overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
                <div className="flex justify-between text-[11px] text-secondary">
                  <span>Required: ₹1.50 Cr</span>
                  <span className="font-semibold text-on-surface">Pledged: ₹1.50 Cr</span>
                </div>
              </div>

              {/* Corpus 2 */}
              <div className="bg-surface-container-low rounded-xl p-3.5 flex flex-col justify-between border border-surface-container">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface">PG Technical Reserves</span>
                  <span className="text-[11px] text-teal-800 font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                    100% Met
                  </span>
                </div>
                <div className="w-full bg-surface-container-high h-2 rounded-full my-2.5 overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
                <div className="flex justify-between text-[11px] text-secondary">
                  <span>Required: ₹75.0 Lakh</span>
                  <span className="font-semibold text-on-surface">Pledged: ₹75.0 Lakh</span>
                </div>
              </div>

              {/* Corpus 3 */}
              <div className="bg-surface-container-low rounded-xl p-3.5 flex flex-col justify-between border border-surface-container">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-on-surface">Management / MCA Reserve</span>
                  <span className="text-[11px] text-teal-800 font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                    100% Met
                  </span>
                </div>
                <div className="w-full bg-surface-container-high h-2 rounded-full my-2.5 overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '100%' }}></div>
                </div>
                <div className="flex justify-between text-[11px] text-secondary">
                  <span>Required: ₹1.25 Cr</span>
                  <span className="font-semibold text-on-surface">Pledged: ₹1.25 Cr</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Deadlines, Updates, Templates (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Card 1: Deadlines */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">event_upcoming</span>
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">Upcoming Deadlines</h3>
              </div>
              <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                3 Actionable
              </span>
            </div>

            <div className="flex flex-col gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-error-container text-on-error-container flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">emergency</span>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-on-surface">Form L-1 Amendment</span>
                  <span className="text-secondary text-[11px]">Resubmission for FDR-PNB-883921 to WRO Desk.</span>
                  <span className="text-error font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">timer</span> Due 15 Nov 2024 (4 days)
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">autorenew</span>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-on-surface">Rollover Notice Window Opens</span>
                  <span className="text-secondary text-[11px]">For SBI FDR maturing Mar 2025 (FDR-SBI-440192).</span>
                  <span className="text-amber-800 font-semibold text-[11px] mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px]">calendar_today</span> 15 Dec 2024
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-surface-container-low flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-surface-container text-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-[16px]">file_copy</span>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-bold text-on-surface">Annual Interest Certificate</span>
                  <span className="text-secondary text-[11px]">Bank interest accrual confirmation for all active liens.</span>
                  <span className="text-secondary font-semibold text-[11px] mt-1">Due 31 Jan 2025</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Recent Status Updates */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">notifications_active</span>
                <h3 className="font-headline-sm text-sm font-bold text-on-surface">Recent Status Updates</h3>
              </div>
              <span className="text-[10px] text-secondary font-mono">Real-time</span>
            </div>

            <div className="relative pl-5 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container text-xs">
              <div className="relative flex flex-col">
                <span className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full bg-error ring-4 ring-white"></span>
                <span className="font-semibold text-on-surface">WRO Scrutiny Note received for FDR-PNB-883921</span>
                <span className="text-secondary text-[11px] mt-0.5">Regional officer requested updated joint custody text.</span>
                <span className="font-data-mono text-[10px] text-secondary mt-1">Today, 11:20 AM</span>
              </div>

              <div className="relative flex flex-col">
                <span className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-white"></span>
                <span className="font-semibold text-on-surface">Bank Confirmation via Finacle for FDR-BOB-910283</span>
                <span className="text-secondary text-[11px] mt-0.5">SFMS tripartite lock confirmation code verified.</span>
                <span className="font-data-mono text-[10px] text-secondary mt-1">Yesterday, 04:30 PM</span>
              </div>
            </div>
          </div>

          {/* Card 3: Statutory Templates & Desk */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-xs border border-surface-container flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-primary text-[20px]">policy</span>
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">Statutory Form Templates</h3>
            </div>
            <p className="text-xs text-secondary mb-3 leading-relaxed">
              Official AICTE formats required for tripartite agreements, joint lien mandates, and rollover submissions.
            </p>

            <div className="flex flex-col gap-2 text-xs">
              {STATUTORY_TEMPLATES.map(tmpl => (
                <div
                  key={tmpl.id}
                  onClick={() => alert(`Downloading official ${tmpl.code} template (${tmpl.title})...`)}
                  className="p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex items-center justify-between cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-[18px] group-hover:text-primary">
                      description
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium text-on-surface">{tmpl.code} ({tmpl.title.split(' ')[0]})</span>
                      <span className="text-[10px] text-secondary">{tmpl.fileType} • {tmpl.size}</span>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-secondary text-[17px]">download</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
