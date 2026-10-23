import React, { useState } from 'react';
import { useRole } from '../context/RoleContext';
import { COMPLIANCE_ALERTS, AUDIT_LOGS, FDR_STATUSES } from '../data/mockData';

export default function AdminDashboard({ fdrs, onSelectFdr }) {
  const { setActiveRoute, setSelectedFdrRef } = useRole();
  const [activeLedgerTab, setActiveLedgerTab] = useState('pending');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [noticeDispatched, setNoticeDispatched] = useState(false);

  // Filtered rows for the verification ledger
  const filteredLedger = fdrs.filter(fdr => {
    const matchesSearch =
      fdr.fdrNumber.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      fdr.institutionName.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
      fdr.bank.toLowerCase().includes(ledgerSearch.toLowerCase());

    if (!matchesSearch) return false;

    if (activeLedgerTab === 'pending') {
      return (
        fdr.status === FDR_STATUSES.SUBMITTED ||
        fdr.status === FDR_STATUSES.UNDER_VERIFICATION ||
        fdr.status === FDR_STATUSES.CORRECTION_REQUIRED ||
        fdr.status === FDR_STATUSES.VERIFIED
      );
    }
    if (activeLedgerTab === 'renewals') {
      return fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.RENEWAL_REQUESTED;
    }
    if (activeLedgerTab === 'releases') {
      return fdr.status === FDR_STATUSES.RELEASE_REQUESTED || fdr.status === FDR_STATUSES.RELEASE_APPROVED;
    }
    return true;
  });

  const handleInspect = (fdr) => {
    setSelectedFdrRef(fdr.fdrNumber);
    if (onSelectFdr) onSelectFdr(fdr);
    setActiveRoute('verification_audit');
  };

  const handleIssueNotice = () => {
    setNoticeDispatched(true);
    setTimeout(() => setNoticeDispatched(false), 4000);
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Welcome & System Status Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Central Regulatory Financial Custody Division</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              Institutional FDR Monitoring & Custody Portal
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              HQ Command (FY 2024-25)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-xl text-on-surface-variant font-label-md text-xs border border-surface-container">
            <span className="material-symbols-outlined text-[18px] text-teal-700">verified_user</span>
            <span>Lien Mandate: <strong className="text-on-surface font-semibold">Active & Audited</strong></span>
          </div>
          <button
            onClick={() => setActiveRoute('submit_new_fdr')}
            className="rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs px-3.5 py-2 shadow-sm inline-flex items-center gap-1.5 transition-colors font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">add_circle</span>
            <span>Register New FDR</span>
          </button>
          <button
            onClick={() => setActiveRoute('registry')}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px]">account_balance</span>
            <span>Master Registry</span>
          </button>
        </div>
      </div>

      {/* Notice Dispatched Toast */}
      {noticeDispatched && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span>
            <span><strong>Notice Dispatched:</strong> Form D-3 statutory rollover demand notices sent via NIC-SMS daemon to 4 overdue trusts.</span>
          </div>
          <span className="font-mono text-emerald-700 font-bold">STATUS 200 OK</span>
        </div>
      )}

      {/* 1. Top KPI Row (4 clean metric cards with arc gauges) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Total FDRs */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-xs text-on-surface-variant block font-medium">Total FDRs Under Custody</span>
              <span className="font-label-sm text-[11px] text-secondary block mt-0.5">Total Value: ₹4,128.50 Cr</span>
            </div>
            <button
              onClick={() => setActiveRoute('registry')}
              className="p-1.5 bg-surface-container-low hover:bg-surface-container text-primary rounded-full transition-colors"
              title="View Registry"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
            </button>
          </div>
          <div className="flex items-end justify-between mt-4">
            <div>
              <div className="font-headline-xl text-2xl font-bold text-on-surface tracking-tight">14,820</div>
              <div className="flex items-center gap-1 mt-1 text-teal-700 font-label-sm text-[11px] font-semibold">
                <span className="material-symbols-outlined text-[15px]">trending_up</span>
                <span>+4.2% YoY growth</span>
              </div>
            </div>
            {/* Arc Gauge 88% */}
            <div className="relative w-16 h-10 flex items-end justify-center">
              <svg className="w-16 h-10 overflow-visible" viewBox="0 0 64 36">
                <path className="text-surface-container-high" d="M 6 34 A 26 26 0 0 1 58 34" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" />
                <path className="text-primary" d="M 6 34 A 26 26 0 0 1 58 34" fill="none" stroke="currentColor" strokeDasharray="81.68" strokeDashoffset="10" strokeLinecap="round" strokeWidth="6" />
              </svg>
              <span className="absolute bottom-0 text-[10px] font-data-mono font-bold text-on-surface-variant">88%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active FDRs */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-xs text-on-surface-variant block font-medium">Active Compliant FDRs</span>
              <span className="font-label-sm text-[11px] text-secondary block mt-0.5">Avg Yield 7.4% p.a. • Joint Lien</span>
            </div>
            <button
              onClick={() => setActiveRoute('registry')}
              className="p-1.5 bg-surface-container-low hover:bg-surface-container text-primary rounded-full transition-colors"
              title="View Active Liens"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
            </button>
          </div>
          <div className="flex items-end justify-between mt-4">
            <div>
              <div className="font-headline-xl text-2xl font-bold text-on-surface tracking-tight">12,945</div>
              <div className="flex items-center gap-1 mt-1 text-emerald-700 font-label-sm text-[11px] font-semibold">
                <span className="material-symbols-outlined text-[15px]">task_alt</span>
                <span>87.4% Compliant</span>
              </div>
            </div>
            {/* Arc Gauge 87% */}
            <div className="relative w-16 h-10 flex items-end justify-center">
              <svg className="w-16 h-10 overflow-visible" viewBox="0 0 64 36">
                <path className="text-surface-container-high" d="M 6 34 A 26 26 0 0 1 58 34" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" />
                <path className="text-emerald-600" d="M 6 34 A 26 26 0 0 1 58 34" fill="none" stroke="currentColor" strokeDasharray="81.68" strokeDashoffset="12" strokeLinecap="round" strokeWidth="6" />
              </svg>
              <span className="absolute bottom-0 text-[10px] font-data-mono font-bold text-on-surface-variant">87%</span>
            </div>
          </div>
        </div>

        {/* Card 3: Expiring Soon */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-xs text-on-surface-variant block font-medium">Expiring Soon (&lt; 60 Days)</span>
              <span className="font-label-sm text-[11px] text-tertiary block mt-0.5">₹142.80 Cr maturing horizon</span>
            </div>
            <button
              onClick={() => setActiveRoute('maturity_renewals')}
              className="p-1.5 bg-surface-container-low hover:bg-surface-container text-tertiary rounded-full transition-colors"
              title="View Expiring"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
            </button>
          </div>
          <div className="flex items-end justify-between mt-4">
            <div>
              <div className="font-headline-xl text-2xl font-bold text-tertiary tracking-tight">418</div>
              <div className="flex items-center gap-1 mt-1 text-on-tertiary-fixed-variant bg-tertiary-fixed px-1.5 py-0.5 rounded font-label-sm text-[10px] font-bold">
                <span className="material-symbols-outlined text-[13px]">notification_important</span>
                <span>34 notices dispatched</span>
              </div>
            </div>
            {/* Arc Gauge warning */}
            <div className="relative w-16 h-10 flex items-end justify-center">
              <svg className="w-16 h-10 overflow-visible" viewBox="0 0 64 36">
                <path className="text-surface-container-high" d="M 6 34 A 26 26 0 0 1 58 34" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" />
                <path className="text-tertiary-container" d="M 6 34 A 26 26 0 0 1 58 34" fill="none" stroke="currentColor" strokeDasharray="81.68" strokeDashoffset="52" strokeLinecap="round" strokeWidth="6" />
              </svg>
              <span className="absolute bottom-0 text-[10px] font-data-mono font-bold text-tertiary">36%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Pending Verification */}
        <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-label-md text-xs text-on-surface-variant block font-medium">Pending Verification</span>
              <span className="font-label-sm text-[11px] text-error block mt-0.5">New Submissions & Renewals</span>
            </div>
            <button
              onClick={() => setActiveRoute('verification_audit')}
              className="p-1.5 bg-surface-container-low hover:bg-surface-container text-error rounded-full transition-colors"
              title="View Queue"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_outward</span>
            </button>
          </div>
          <div className="flex items-end justify-between mt-4">
            <div>
              <div className="font-headline-xl text-2xl font-bold text-on-surface tracking-tight">164</div>
              <div className="flex items-center gap-1 mt-1 text-on-error-container bg-error-container px-1.5 py-0.5 rounded font-label-sm text-[10px] font-bold">
                <span className="material-symbols-outlined text-[13px]">priority_high</span>
                <span>12 high priority (&gt; ₹1 Cr)</span>
              </div>
            </div>
            {/* Arc Gauge error */}
            <div className="relative w-16 h-10 flex items-end justify-center">
              <svg className="w-16 h-10 overflow-visible" viewBox="0 0 64 36">
                <path className="text-surface-container-high" d="M 6 34 A 26 26 0 0 1 58 34" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6" />
                <path className="text-error" d="M 6 34 A 26 26 0 0 1 58 34" fill="none" stroke="currentColor" strokeDasharray="81.68" strokeDashoffset="62" strokeLinecap="round" strokeWidth="6" />
              </svg>
              <span className="absolute bottom-0 text-[10px] font-data-mono font-bold text-error">18%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Mid Section: Maturity Chart & Compliance Alerts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Maturity Overview Chart (7 of 12 cols) */}
        <div className="lg:col-span-7 xl:col-span-8 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-surface-container-low">
            <div>
              <h2 className="font-headline-md text-base font-bold text-on-surface tracking-tight">
                Maturity & Encashment Overview
              </h2>
              <span className="font-body-sm text-xs text-secondary">
                Scheduled security deposit roll-overs across nationalized bank branches
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded-full font-semibold">
                96.4% Compliant
              </span>
            </div>
          </div>

          {/* Stylized Column Chart with Hatched Patterns */}
          <div className="w-full mt-4">
            <div className="relative w-full h-60">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 680 220">
                <defs>
                  <pattern id="diagHatchTeal" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45 0 0)">
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#008378" strokeWidth="2" />
                  </pattern>
                  <pattern id="diagHatchAmber" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45 0 0)">
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#ffb95f" strokeWidth="2" />
                  </pattern>
                  <pattern id="diagHatchRed" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45 0 0)">
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#ba1a1a" strokeWidth="2" />
                  </pattern>
                  <linearGradient id="barGradTeal" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#00685f" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#89f5e7" stopOpacity="0.6" />
                  </linearGradient>
                  <linearGradient id="barGradAmber" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#a36700" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#ffddb8" stopOpacity="0.6" />
                  </linearGradient>
                  <linearGradient id="barGradSecondary" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#565e74" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#dae2fd" stopOpacity="0.5" />
                  </linearGradient>
                </defs>

                {/* Horizontal Gridlines */}
                <line x1="40" y1="20" x2="670" y2="20" stroke="#eff4ff" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="40" y1="60" x2="670" y2="60" stroke="#eff4ff" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="40" y1="100" x2="670" y2="100" stroke="#eff4ff" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="40" y1="140" x2="670" y2="140" stroke="#eff4ff" strokeDasharray="3 3" strokeWidth="1" />
                <line x1="40" y1="180" x2="670" y2="180" stroke="#bcc9c6" opacity="0.4" strokeWidth="1" />

                {/* Axis Labels */}
                <text x="10" y="24" className="font-data-mono fill-secondary" fontSize="10">₹120Cr</text>
                <text x="10" y="64" className="font-data-mono fill-secondary" fontSize="10">₹90Cr</text>
                <text x="10" y="104" className="font-data-mono fill-secondary" fontSize="10">₹60Cr</text>
                <text x="10" y="144" className="font-data-mono fill-secondary" fontSize="10">₹30Cr</text>
                <text x="10" y="184" className="font-data-mono fill-secondary" fontSize="10">₹0</text>

                {/* Bars */}
                <rect x="75" y="142" width="48" height="38" rx="6" fill="url(#barGradSecondary)" />
                <text x="99" y="134" textAnchor="middle" className="font-data-mono fill-on-surface font-semibold" fontSize="10">₹28Cr</text>
                <text x="99" y="200" textAnchor="middle" className="font-label-md fill-secondary" fontSize="11">Aug 24</text>

                <rect x="175" y="120" width="48" height="60" rx="6" fill="#dae2fd" />
                <rect x="175" y="120" width="48" height="60" rx="6" fill="url(#diagHatchTeal)" opacity="0.35" />
                <text x="199" y="112" textAnchor="middle" className="font-data-mono fill-on-surface font-semibold" fontSize="10">₹45Cr</text>
                <text x="199" y="200" textAnchor="middle" className="font-label-md fill-secondary" fontSize="11">Sep 24</text>

                <rect x="275" y="70" width="48" height="110" rx="6" fill="url(#barGradTeal)" />
                <text x="299" y="62" textAnchor="middle" className="font-data-mono fill-on-surface font-semibold" fontSize="10">₹82Cr</text>
                <text x="299" y="200" textAnchor="middle" className="font-label-md fill-on-surface font-bold" fontSize="11">Oct 24</text>

                <rect x="375" y="134" width="48" height="46" rx="6" fill="#ffddb8" />
                <rect x="375" y="134" width="48" height="46" rx="6" fill="url(#diagHatchAmber)" opacity="0.5" />
                <text x="399" y="126" textAnchor="middle" className="font-data-mono fill-on-surface font-semibold" fontSize="10">₹34Cr</text>
                <text x="399" y="200" textAnchor="middle" className="font-label-md fill-secondary" fontSize="11">Nov 24</text>

                <rect x="475" y="34" width="48" height="146" rx="6" fill="url(#barGradAmber)" />
                <text x="499" y="26" textAnchor="middle" className="font-data-mono fill-tertiary font-bold" fontSize="10">₹110Cr</text>
                <text x="499" y="200" textAnchor="middle" className="font-label-md fill-secondary" fontSize="11">Dec 24</text>

                <rect x="575" y="93" width="48" height="87" rx="6" fill="#ffdad6" />
                <rect x="575" y="93" width="48" height="87" rx="6" fill="url(#diagHatchRed)" opacity="0.4" />
                <text x="599" y="85" textAnchor="middle" className="font-data-mono fill-error font-semibold" fontSize="10">₹65Cr</text>
                <text x="599" y="200" textAnchor="middle" className="font-label-md fill-secondary" fontSize="11">Jan 25</text>
              </svg>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-surface-container mt-2 text-xs text-secondary font-label-sm">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-primary inline-block"></span> Public Sector Banks (72%)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-tertiary-container inline-block"></span> Scheduled Commercial (21%)</span>
              </div>
              <span>Peak Maturing Quarter: <strong className="text-on-surface">Q3 FY25 (₹226 Cr)</strong></span>
            </div>
          </div>
        </div>

        {/* Right Column: Compliance Alerts & Discrepancies (5 of 12 cols) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error text-[20px]">warning</span>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">Urgent Compliance Alerts</h2>
              </div>
              <span className="font-label-sm text-[11px] bg-error-container text-on-error-container px-2 py-0.5 rounded-full font-bold">
                04 Critical
              </span>
            </div>

            <div className="flex flex-col gap-2.5 mt-3">
              {COMPLIANCE_ALERTS.map(alert => (
                <div
                  key={alert.id}
                  className="p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors flex items-start gap-2.5 text-xs"
                >
                  <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${alert.type === 'error' ? 'text-error' : 'text-tertiary'}`}>
                    {alert.type === 'error' ? 'error' : 'assignment_late'}
                  </span>
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-label-md font-bold text-on-surface truncate">
                        {alert.institution}
                      </span>
                      <span className={`font-label-sm text-[10px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 ${
                        alert.type === 'error' ? 'bg-error-container text-on-error-container' : 'bg-tertiary-fixed text-on-tertiary-fixed'
                      }`}>
                        {alert.tag}
                      </span>
                    </div>
                    <span className="font-data-mono text-[11px] text-secondary mt-0.5">{alert.amount}</span>
                    <p className="font-body-sm text-[11px] text-secondary mt-0.5 leading-snug">
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-surface-container-low flex flex-col gap-2">
            <button
              onClick={handleIssueNotice}
              className="w-full py-2 px-3 bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
              type="button"
            >
              <span className="material-symbols-outlined text-[17px]">outgoing_mail</span>
              <span>Issue Statutory Notice (Form D-3)</span>
            </button>
            <span className="text-center font-label-sm text-[10px] text-secondary">
              Notices automatically dispatch to Regional Officers via NIC-SMS daemon
            </span>
          </div>
        </div>
      </div>

      {/* 3. Bottom Section: Institutional FDR Verification Ledger */}
      <div className="bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-surface-container-low">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-headline-md text-base font-bold text-on-surface tracking-tight">
                Institutional FDR Verification Ledger
              </h2>
              <span className="px-2 py-0.5 bg-surface-container-low rounded-full font-label-sm text-[10px] text-secondary font-medium">
                Live Audit
              </span>
            </div>
            <p className="font-body-sm text-xs text-secondary mt-0.5">
              Live audit ledger of newly pledged deposits, lien endorsements & tripartite certificates
            </p>
          </div>

          {/* Segmented Filter Pills */}
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container">
            <button
              onClick={() => setActiveLedgerTab('pending')}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all ${
                activeLedgerTab === 'pending'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Pending ({fdrs.filter(f => f.status === FDR_STATUSES.SUBMITTED || f.status === FDR_STATUSES.UNDER_VERIFICATION || f.status === FDR_STATUSES.CORRECTION_REQUIRED).length})
            </button>
            <button
              onClick={() => setActiveLedgerTab('renewals')}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all ${
                activeLedgerTab === 'renewals'
                  ? 'bg-surface-container-lowest text-primary shadow-xs'
                  : 'text-secondary hover:text-on-surface'
              }`}
            >
              Renewals ({fdrs.filter(f => f.status === FDR_STATUSES.MATURING_SOON || f.status === FDR_STATUSES.RENEWAL_REQUESTED).length})
            </button>
            <button
              onClick={() => setActiveLedgerTab('releases')}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all ${
                activeLedgerTab === 'releases'
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
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[17px]">
              search
            </span>
            <input
              type="text"
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              placeholder="Filter by Inst. code, Bank name, or Certificate..."
              className="w-full h-8 pl-8 pr-3 text-xs bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
            />
          </div>
          <div className="text-xs text-secondary font-label-sm">
            Showing <strong className="text-on-surface">{filteredLedger.length}</strong> matching records
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-surface-container-low">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-10 border-b border-surface-container-low">
                <th className="px-4 py-2 font-semibold">Institution & Code</th>
                <th className="px-4 py-2 font-semibold">FDR Reference / Bank</th>
                <th className="px-4 py-2 text-right font-semibold">Amount (INR)</th>
                <th className="px-4 py-2 font-semibold">Maturity Date</th>
                <th className="px-4 py-2 text-center font-semibold">Status</th>
                <th className="px-4 py-2 text-right font-semibold">Mandate Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low font-body-sm bg-surface-container-lowest">
              {filteredLedger.map((fdr) => (
                <tr key={fdr.id} className="hover:bg-surface-container-low/60 transition-colors">
                  <td className="px-4 py-3 font-medium text-on-surface">
                    <div className="flex flex-col">
                      <span className="font-semibold text-on-surface">{fdr.institutionName}</span>
                      <span className="font-data-mono text-[11px] text-secondary">
                        PID: {fdr.aictePid} • {fdr.city}, {fdr.state}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-data-mono text-on-surface font-semibold">{fdr.fdrNumber}</span>
                      <span className="text-[11px] text-secondary">{fdr.bank}, {fdr.branch}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-data-mono font-bold text-on-surface text-[13px]">
                    {fdr.amountFormatted}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-on-surface font-medium font-data-mono text-[12px]">{fdr.maturityDate}</span>
                      <span className="text-[10px] text-primary font-medium">{fdr.tenureYears}-Yr Security Pledged</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-[11px] font-semibold ${
                        fdr.status === FDR_STATUSES.ACTIVE
                          ? 'bg-primary-fixed text-on-primary-fixed'
                          : fdr.status === FDR_STATUSES.CORRECTION_REQUIRED
                          ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                          : fdr.status === FDR_STATUSES.MATURING_SOON || fdr.status === FDR_STATUSES.MATURED
                          ? 'bg-error-container text-on-error-container'
                          : 'bg-secondary-container text-on-secondary-container'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      {fdr.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleInspect(fdr)}
                      className="px-3 py-1 bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary font-label-sm text-xs rounded-lg font-semibold transition-colors"
                      title="Inspect Multi-source Cross-Audit Telemetry"
                    >
                      Inspect
                    </button>
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
