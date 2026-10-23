import React, { useState } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { FDR_STATUSES } from '../data/mockData';

export default function VerificationAuditWorkspace({ fdr, onUpdateFdrStatus }) {
  const { currentRole, currentUser, setActiveRoute } = useRole();

  // Selected or default FDR
  const activeFdr = fdr || {
    id: 'fdr_01',
    fdrNumber: 'FDR-PNB-883921',
    tripartiteRef: 'TPR-2021-098 / AICTE-WRO-1092',
    institutionName: "St. Xavier's Engineering College",
    aictePid: '1-10928374',
    bank: 'Punjab National Bank',
    branch: 'FC Road Branch, Pune',
    ifsc: 'PUNB0012900',
    amount: 10000000,
    amountFormatted: '₹1,00,00,000',
    interestRate: '7.40% p.a. Cum.',
    tenureYears: 5,
    issueDate: '18 Nov 2021',
    maturityDate: '18 Nov 2026',
    status: FDR_STATUSES.CORRECTION_REQUIRED,
  };

  const [remarks, setRemarks] = useState(
    'Verified against PNB Finacle lien registry. Auto-rollover Clause 14B verified. Regional office descriptor discrepancy noted as acceptable per Circular AICTE/FIN/2023/88. Recommended for official endorsement.'
  );
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showOcrBoxes, setShowOcrBoxes] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [chkPhysical, setChkPhysical] = useState(true);
  const [chkTripartite, setChkTripartite] = useState(true);
  const [chkAutoDispatch, setChkAutoDispatch] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const snippets = [
    { label: '+ APH Comp. Note', text: ' [Compliance confirmed per APH Appendix 11.4]' },
    { label: '+ Rollover Warranty', text: ' [Statutory auto-rollover clause 14(B) active]' },
    { label: '+ Flag to RO Pune', text: ' [Referred to Regional Officer Pune for physical check]' },
    { label: '+ Request Form D-2', text: ' [Additional indemnity undertaking Form D-2 requested]' }
  ];

  const handleAddSnippet = (snippetText) => {
    setRemarks(prev => prev + snippetText);
  };

  const handleCopyRef = () => {
    navigator.clipboard?.writeText(activeFdr.fdrNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (newStatus, feedbackMsg) => {
    if (onUpdateFdrStatus) {
      onUpdateFdrStatus(activeFdr.id, newStatus, remarks);
    }
    setActionFeedback(feedbackMsg);
    setTimeout(() => setActionFeedback(null), 5000);
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Action Toast Feedback */}
      {actionFeedback && (
        <div className="p-4 bg-teal-50 border border-teal-300 text-teal-900 rounded-2xl flex items-center justify-between text-xs shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-teal-700 text-[20px]">verified</span>
            <span><strong>Workflow Updated:</strong> {actionFeedback}</span>
          </div>
          <span className="font-mono text-teal-800 font-bold bg-teal-100 px-2 py-0.5 rounded">SIMULATED OK</span>
        </div>
      )}

      {/* Breadcrumb Path & Title */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs text-secondary flex-wrap">
          <span
            onClick={() => setActiveRoute('dashboard')}
            className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1 font-medium"
          >
            <span className="material-symbols-outlined text-[15px]">account_balance</span>
            Central Regulatory Financial Custody Division
          </span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span
            onClick={() => setActiveRoute('registry')}
            className="hover:text-primary transition-colors cursor-pointer font-medium"
          >
            Verification Queue
          </span>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-data-mono font-semibold text-teal-900 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
            {activeFdr.fdrNumber}
          </span>
          <span className="text-outline-variant">•</span>
          <span className="text-on-surface font-medium truncate max-w-xs">{activeFdr.institutionName}</span>
        </div>

        {/* Screen Title & Action Group */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight flex items-center gap-2.5">
              <span>Fixed Deposit Receipt Verification & Tripartite Audit</span>
              <span className="material-symbols-outlined text-teal-700 text-[24px]" title="Statutory Audit Verified Mode">
                verified_user
              </span>
            </h1>
            <p className="text-xs text-secondary mt-1">
              Mandatory compliance review under AICTE Approval Process Handbook (APH) Reg. 14(B) • Joint Escrow Custody
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => handleAction(FDR_STATUSES.REJECTED, `${activeFdr.fdrNumber} marked as REJECTED with officer remarks.`)}
              className="inline-flex items-center gap-1.5 border border-rose-300 bg-rose-50/70 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-semibold px-3 py-2 transition-colors shadow-xs"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              <span>Reject Instrument</span>
            </button>
            <button
              onClick={() => handleAction(FDR_STATUSES.CORRECTION_REQUIRED, `${activeFdr.fdrNumber} returned to Trust for CORRECTION_REQUIRED.`)}
              className="inline-flex items-center gap-1.5 border border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold px-3 py-2 transition-colors shadow-xs"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">rate_review</span>
              <span>Request Clarification</span>
            </button>
            <button
              onClick={() => handleAction(FDR_STATUSES.VERIFIED, `${activeFdr.fdrNumber} marked as VERIFIED and forwarded to Council for approval.`)}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-semibold text-xs px-4 py-2 transition-colors shadow-xs"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
              <span>Verify & Endorse Lien</span>
            </button>
          </div>
        </div>

        {/* Instrument Metadata Ribbon */}
        <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Ref No:</span>
              <span className="font-data-mono text-on-surface font-semibold bg-surface-container-low px-2 py-0.5 rounded-md text-xs">
                {activeFdr.fdrNumber}
              </span>
              <button
                onClick={handleCopyRef}
                className="text-secondary hover:text-primary transition-colors p-0.5"
                title="Copy FDR Reference"
              >
                <span className="material-symbols-outlined text-[15px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
            </div>
            <div className="h-4 w-px bg-surface-container hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">Lien Mandate:</span>
              <span className="font-data-mono text-on-surface-variant text-xs font-medium">
                {activeFdr.tripartiteRef || 'TPR-2021-098 / AICTE-WRO-1092'}
              </span>
            </div>
            <div className="h-4 w-px bg-surface-container hidden md:block"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">PID:</span>
              <span className="text-xs text-on-surface font-medium">{activeFdr.institutionName} ({activeFdr.aictePid})</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse"></span>
              High Priority - Tripartite Endorsement Due
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-sky-50 text-sky-800 border border-sky-200 font-medium">
              <span className="material-symbols-outlined text-[14px]">history_edu</span>
              Pending Joint Director Sign-off
            </span>
          </div>
        </div>
      </div>

      {/* 12-Column Responsive Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Regulatory Comparison Workspace (7 cols) */}
        <div className="xl:col-span-7 flex flex-col gap-6">
          {/* 4 Summary Micro-Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Amount */}
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Pledged Security Amount</span>
                <span className="material-symbols-outlined text-teal-700 text-[20px]">currency_rupee</span>
              </div>
              <div className="flex flex-col">
                <div className="text-2xl font-bold text-on-surface tracking-tight font-data-mono">
                  {activeFdr.amountFormatted}
                </div>
                <div className="flex items-center justify-between mt-1 text-secondary text-xs">
                  <span>{activeFdr.amountWords || 'INR One Crore Only'}</span>
                  <span className="text-[11px] text-teal-800 font-semibold bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                    {activeFdr.interestRate}
                  </span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-surface-container-low flex items-center justify-between text-xs">
                <span className="text-[11px] text-secondary">Statutory Minimum: {activeFdr.amountFormatted}</span>
                <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span> 100% Satisfied
                </span>
              </div>
            </div>

            {/* Card 2: Pledged Bank */}
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Pledged Scheduled Bank</span>
                <span className="material-symbols-outlined text-teal-700 text-[20px]">account_balance</span>
              </div>
              <div className="flex flex-col">
                <div className="text-lg font-bold text-on-surface truncate">{activeFdr.bank}</div>
                <div className="text-xs text-secondary mt-0.5 truncate">{activeFdr.branch}</div>
              </div>
              <div className="mt-3 pt-2 border-t border-surface-container-low flex items-center justify-between text-xs">
                <span className="font-data-mono text-[11px] text-on-surface font-medium">IFSC: {activeFdr.ifsc}</span>
                <span className="text-[11px] text-teal-800 font-semibold bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">
                  PFMS Integrated
                </span>
              </div>
            </div>

            {/* Card 3: Lien Category */}
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Lien Category & Mandate</span>
                <span className="material-symbols-outlined text-teal-700 text-[20px]">lock</span>
              </div>
              <div className="flex flex-col">
                <div className="text-base text-on-surface font-semibold leading-snug">Exclusive Statutory Lien</div>
                <div className="text-xs text-secondary mt-1 truncate">Favoring Member Secretary, AICTE New Delhi</div>
              </div>
              <div className="mt-3 pt-2 border-t border-surface-container-low flex items-center justify-between text-xs">
                <span className="text-[11px] text-secondary">Lien Registration Status</span>
                <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Confirmed in Finacle
                </span>
              </div>
            </div>

            {/* Card 4: Tenor Horizon */}
            <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between text-secondary mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Tenor Horizon</span>
                <span className="material-symbols-outlined text-teal-700 text-[20px]">calendar_clock</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-on-surface">{activeFdr.tenureYears} Years</span>
                  <span className="text-xs text-secondary">Auto-Rollover</span>
                </div>
                <div className="text-xs text-secondary mt-0.5">
                  Maturity: <span className="text-on-surface font-semibold font-data-mono">{activeFdr.maturityDate}</span>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-surface-container-low">
                <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                  <div className="h-full bg-teal-700 rounded-full" style={{ width: '66%' }}></div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-secondary font-data-mono mt-1">
                  <span>{activeFdr.issueDate}</span>
                  <span className="font-semibold text-teal-700">Active Period</span>
                  <span>{activeFdr.maturityDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Discrepancy Callout Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs flex items-start gap-3.5">
            <span className="material-symbols-outlined text-amber-700 text-[24px] shrink-0 mt-0.5">warning</span>
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between flex-wrap gap-1.5">
                <span className="text-sm text-amber-900 font-bold">1 Statutory Discrepancy Flagged by Rules Engine</span>
                <span className="text-[11px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                  Regulatory Review Required
                </span>
              </div>
              <p className="text-xs text-amber-900/90 mt-1 leading-relaxed">
                Branch IFSC code on scanned receipt (<span className="font-data-mono font-semibold text-on-surface">PUNB0012900</span>) matches RBI master list. However, Joint Account Mandate text is formatted as <em>“AICTE New Delhi”</em> omitting explicit Regional Office descriptor (<em>AICTE Western Regional Office, Pune/Mumbai</em>). Officer endorsement requires confirmation under APH Appendix 11.4.
              </p>
            </div>
          </div>

          {/* Tripartite Comparison Ledger Table Card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs overflow-hidden flex flex-col">
            <div className="p-4 bg-surface-container-low border-b border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm text-on-surface font-bold flex items-center gap-2">
                  <span className="material-symbols-outlined text-teal-700 text-[18px]">difference</span>
                  Multi-Source Telemetry Cross-Audit
                </h2>
                <p className="text-xs text-secondary">
                  Discrepancy validation between Institution Portal Entry, OCR Parse, and Bank Gateway API
                </p>
              </div>
              <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl">
                <span className="px-2.5 py-1 text-xs rounded-lg bg-surface-container-lowest text-on-surface font-semibold shadow-xs">
                  Consolidated
                </span>
                <span className="px-2.5 py-1 text-xs rounded-lg text-secondary font-medium">
                  Audit Diffs (1)
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-secondary text-[11px] uppercase font-bold tracking-wider border-b border-surface-container">
                    <th className="py-2.5 px-3">Instrument Parameter</th>
                    <th className="py-2.5 px-3">Institute Submission</th>
                    <th className="py-2.5 px-3">OCR Document Extraction</th>
                    <th className="py-2.5 px-3">Bank Core / PFMS API</th>
                    <th className="py-2.5 px-3 text-right">Audit Match</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low font-body-sm">
                  <tr className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Fixed Deposit No.</td>
                    <td className="py-2.5 px-3 font-data-mono font-medium text-on-surface">883921004921</td>
                    <td className="py-2.5 px-3 font-data-mono font-medium text-on-surface">
                      883921004921
                      <span className="text-[10px] text-teal-700 block font-sans font-semibold">100% Confidence</span>
                    </td>
                    <td className="py-2.5 px-3 font-data-mono text-teal-800 font-semibold">883921004921 (PNB Nodal)</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[13px]">check</span> MATCH
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Deposit Principal</td>
                    <td className="py-2.5 px-3 font-data-mono font-medium text-on-surface">{activeFdr.amountFormatted}</td>
                    <td className="py-2.5 px-3 font-data-mono font-medium text-on-surface">
                      {activeFdr.amountFormatted}
                      <span className="text-[10px] text-secondary block font-sans">INR ONE CRORE</span>
                    </td>
                    <td className="py-2.5 px-3 font-data-mono text-teal-800 font-semibold">{activeFdr.amountFormatted}.00</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[13px]">check</span> MATCH
                      </span>
                    </td>
                  </tr>
                  <tr className="bg-amber-50/50 hover:bg-amber-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Mandate & Lien Clause</td>
                    <td className="py-2.5 px-3 text-on-surface">Principal, SXEC & Member Sec AICTE</td>
                    <td className="py-2.5 px-3 text-on-surface font-medium">Principal SXEC A/C AICTE ND</td>
                    <td className="py-2.5 px-3 text-teal-800 font-semibold">JOINT: AICTE MEM SEC & SXEC</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-amber-50 text-amber-800 border border-amber-200 font-bold px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[13px]">warning</span> ADVISORY
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Auto-Renewal Mandate</td>
                    <td className="py-2.5 px-3 text-secondary">Statutory Auto-Rollover</td>
                    <td className="py-2.5 px-3 text-secondary">Clause 14B: Auto-Renewed</td>
                    <td className="py-2.5 px-3 font-data-mono text-teal-800 font-semibold">FLAG_ROLLOVER_TRUE</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[13px]">check</span> MATCH
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Branch IFSC & Sol</td>
                    <td className="py-2.5 px-3 font-data-mono text-on-surface">PUNB0012900 (1290)</td>
                    <td className="py-2.5 px-3 font-data-mono text-on-surface">PUNB0012900</td>
                    <td className="py-2.5 px-3 font-data-mono text-teal-800 font-semibold">RBI: PUNB0012900 (Active)</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[13px]">check</span> MATCH
                      </span>
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-on-surface">Non-Encashment Undertaking</td>
                    <td className="py-2.5 px-3 text-secondary">Form L-2 Attached</td>
                    <td className="py-2.5 px-3 text-secondary">Sol Manager Seal Verified</td>
                    <td className="py-2.5 px-3 font-data-mono text-teal-800 font-semibold">ENCASHMENT_BLOCKED</td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                        <span className="material-symbols-outlined text-[13px]">check</span> MATCH
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Scanned Digital Instrument Viewer Card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-xs flex flex-col overflow-hidden">
            <div className="p-4 bg-surface-container-low border-b border-surface-container flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-teal-700 text-[22px]">document_scanner</span>
                <div>
                  <div className="text-sm text-on-surface font-bold">Statutory Instrument & Bank Lien Certificate Scan</div>
                  <div className="text-xs text-secondary">Page 1 of 2 • High Resolution 300 DPI Legal Document Archive</div>
                </div>
              </div>

              {/* Document Toolbar */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  onClick={() => setZoomLevel(z => Math.max(75, z - 10))}
                  className="rounded-lg border border-surface-container bg-surface-container-lowest p-1.5 text-secondary hover:bg-surface-container shadow-xs transition-colors"
                  title="Zoom Out"
                >
                  <span className="material-symbols-outlined text-[17px]">zoom_out</span>
                </button>
                <span className="font-data-mono text-xs text-secondary px-2 font-medium">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(z => Math.min(150, z + 10))}
                  className="rounded-lg border border-surface-container bg-surface-container-lowest p-1.5 text-secondary hover:bg-surface-container shadow-xs transition-colors"
                  title="Zoom In"
                >
                  <span className="material-symbols-outlined text-[17px]">zoom_in</span>
                </button>
                <div className="h-4 w-px bg-surface-container mx-0.5"></div>
                <button
                  onClick={() => setRotation(r => (r + 90) % 360)}
                  className="rounded-lg border border-surface-container bg-surface-container-lowest p-1.5 text-secondary hover:bg-surface-container shadow-xs transition-colors"
                  title="Rotate"
                >
                  <span className="material-symbols-outlined text-[17px]">rotate_right</span>
                </button>
                <button
                  onClick={() => setShowOcrBoxes(!showOcrBoxes)}
                  className={`rounded-lg border p-1.5 shadow-xs transition-colors ${
                    showOcrBoxes
                      ? 'border-teal-300 bg-teal-50 text-teal-800'
                      : 'border-surface-container bg-surface-container-lowest text-secondary'
                  }`}
                  title="Toggle OCR Detection Boxes"
                >
                  <span className="material-symbols-outlined text-[17px]">crop_free</span>
                </button>
              </div>
            </div>

            {/* Simulated Security Document Sheet Container */}
            <div className="p-6 bg-slate-100 flex items-center justify-center overflow-auto">
              <div
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'top center',
                  transition: 'transform 0.2s ease'
                }}
                className="w-full max-w-2xl bg-[#fffefc] text-[#131b2e] rounded-xl border border-slate-300 shadow-md p-6 relative overflow-hidden select-none"
              >
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-5 rotate-[-25deg]">
                  <span className="text-6xl font-bold tracking-widest text-[#00685f]">AICTE REGULATORY PLEDGE</span>
                </div>

                <div className="flex items-start justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-700 text-white flex items-center justify-center font-bold text-lg tracking-tighter shadow-xs">
                      pnb
                    </div>
                    <div>
                      <div className="text-sm tracking-tight font-bold text-[#800000]">PUNJAB NATIONAL BANK</div>
                      <div className="text-[11px] text-slate-500">FC Road Branch, Pune 411005 (MH) • IFSC: PUNB0012900</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-data-mono text-[11px] font-semibold text-slate-600 block">ORIGINAL FOR LIEN HOLDER</span>
                    <span className="text-[10px] text-slate-400">Date of Issue: 18/11/2021</span>
                  </div>
                </div>

                <div className="my-3 text-center py-1 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-xs uppercase tracking-wider font-bold text-slate-800">
                    Special Term Deposit Receipt (Cumulative)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs my-4">
                  <div className={showOcrBoxes ? 'p-1 rounded ring-1 ring-teal-500 bg-teal-50/20' : ''}>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Receipt / Account Number</span>
                    <span className="font-data-mono font-bold text-sm text-slate-900 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                      883921004921
                    </span>
                  </div>
                  <div className={showOcrBoxes ? 'p-1 rounded ring-1 ring-teal-500 bg-teal-50/20' : ''}>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Deposit Amount</span>
                    <span className="font-data-mono font-bold text-sm text-slate-900">₹1,00,00,000/-</span>
                    <span className="text-[10px] text-slate-500 block">(Rupees One Crore Only)</span>
                  </div>
                  <div className={showOcrBoxes ? 'p-1 rounded ring-1 ring-amber-500 bg-amber-50/30' : ''}>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Depositor / Trust Mandate</span>
                    <span className="font-medium text-slate-800 block">St. Xavier's Technical Education Society</span>
                    <span className="text-[10px] text-amber-800 font-semibold">Joint: A/C AICTE New Delhi [Advisory]</span>
                  </div>
                  <div className={showOcrBoxes ? 'p-1 rounded ring-1 ring-teal-500 bg-teal-50/20' : ''}>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">Tenor & Interest Rate</span>
                    <span className="font-medium text-slate-800 block">60 Months @ 7.40% p.a.</span>
                    <span className="text-[10px] text-slate-500">Maturity Date: 18/11/2026</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 flex flex-col items-center text-center max-w-[240px]">
                    <span className="material-symbols-outlined text-teal-800 text-[20px]">gavel</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">STATUTORY LIEN ENDORSED</span>
                    <span className="text-[9px] leading-tight text-teal-800/80 mt-0.5">
                      In favor of Member Secretary AICTE under Reg 14(B).
                    </span>
                  </div>
                  <div className="flex flex-col items-end text-xs">
                    <div className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[11px] font-semibold mb-1">
                      <span className="material-symbols-outlined text-[13px]">verified</span>
                      <span>Digitally Co-Signed (PFMS)</span>
                    </div>
                    <span className="font-medium text-slate-700">Sr. Branch Manager (Sol ID 1290)</span>
                    <span className="text-[9px] text-slate-400 font-data-mono">DSC-PNB-BRANCH-PN-7721A</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 px-4 bg-surface-container-low border-t border-surface-container flex items-center justify-between text-xs text-secondary">
              <span>SHA-256 Checksum: <code className="font-data-mono font-semibold text-on-surface">c8f2a930b...89e1</code></span>
              <span className="text-teal-700 font-semibold cursor-pointer hover:underline">Historical Renewals (2)</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Adjudication Console & Institutional Standing (5 cols) */}
        <div className="xl:col-span-5 flex flex-col gap-6">
          {/* Reviewer Assessment & Statutory Remarks Card */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700 text-[22px]">draw</span>
                <h2 className="text-base text-on-surface font-bold">Reviewer Adjudication Console</h2>
              </div>
              <span className="text-xs text-teal-800 font-semibold bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-md">
                {currentUser.roleLabel}
              </span>
            </div>

            <div className="mt-4">
              <label className="text-[11px] font-bold text-secondary block uppercase tracking-wider mb-1.5">
                Statutory Endorsement Remarks & Ledger Notes
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={4}
                className="w-full bg-surface-container-low rounded-xl border border-surface-container p-3 text-xs text-on-surface placeholder:text-outline focus:outline-none focus:ring-1 focus:ring-primary focus:bg-white transition-colors"
                placeholder="Enter statutory notes or select pre-approved regulatory snippets below..."
              />
            </div>

            {/* Pre-approved Snippets */}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {snippets.map((snip, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddSnippet(snip.text)}
                  className="rounded-lg border border-surface-container bg-surface-container-lowest hover:bg-surface-container text-on-surface-variant text-[11px] px-2.5 py-1 font-medium transition-colors shadow-xs"
                >
                  {snip.label}
                </button>
              ))}
            </div>

            {/* Statutory Compliance Checkboxes */}
            <div className="mt-4 pt-3 border-t border-surface-container-low space-y-2.5 text-xs text-on-surface">
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={chkPhysical}
                  onChange={(e) => setChkPhysical(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                />
                <span className="group-hover:text-primary transition-colors leading-relaxed">
                  Confirm physical verification of watermarked bond paper / digital e-FDR signature
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={chkTripartite}
                  onChange={(e) => setChkTripartite(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                />
                <span className="group-hover:text-primary transition-colors leading-relaxed">
                  Confirm tripartite agreement Form D-1 is co-signed by Trust Secretary
                </span>
              </label>
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={chkAutoDispatch}
                  onChange={(e) => setChkAutoDispatch(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4 border-slate-300"
                />
                <span className="group-hover:text-primary transition-colors leading-relaxed">
                  Authorize auto-dispatch of Form L-1 Lien Confirmation to PNB Nodal Branch
                </span>
              </label>
            </div>

            {/* Execution Buttons */}
            <div className="mt-5 pt-3 border-t border-surface-container-low flex flex-col gap-2">
              <button
                onClick={() => handleAction(FDR_STATUSES.ACTIVE, `DSC Signature applied. ${activeFdr.fdrNumber} is now ACTIVE.`)}
                className="w-full h-10 px-4 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-container text-on-primary transition-colors shadow-xs flex items-center justify-center gap-1.5"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">verified</span>
                <span>Approve & Apply Digital DSC Signature</span>
              </button>
              <button
                onClick={() => handleAction(FDR_STATUSES.CORRECTION_REQUIRED, `${activeFdr.fdrNumber} returned with remarks: ${remarks.substring(0, 50)}...`)}
                className="w-full h-9 px-4 rounded-xl text-xs font-medium border border-surface-container bg-surface-container-low hover:bg-surface-container text-on-surface transition-colors flex items-center justify-center gap-1.5"
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
                <span>Return to Trust with Remarks</span>
              </button>
            </div>
          </div>

          {/* Institution Quick Profile */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700 text-[22px]">domain</span>
                <h3 className="text-base text-on-surface font-bold">Institutional Standing</h3>
              </div>
              <span className="text-xs text-teal-800 font-bold bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                Grade A Regulatory
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs pt-3">
              <div>
                <span className="text-[11px] font-semibold text-secondary block uppercase">AICTE PID</span>
                <span className="font-data-mono font-semibold text-on-surface">{activeFdr.aictePid}</span>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-secondary block uppercase">Jurisdiction</span>
                <span className="text-on-surface font-medium truncate block">WRO, Mumbai</span>
              </div>
              <div className="col-span-2">
                <span className="text-[11px] font-semibold text-secondary block uppercase">Sponsoring Body</span>
                <span className="text-on-surface font-medium block">St. Xavier's Technical Education Society</span>
              </div>
              <div className="col-span-2 pt-2 border-t border-surface-container-low">
                <span className="text-[11px] font-semibold text-secondary block uppercase">Total AICTE Custody Portfolio</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-lg font-bold text-on-surface font-data-mono">₹3,50,00,000</span>
                  <span className="text-xs text-secondary">4 Active Programmes</span>
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded-md text-secondary font-medium">UG Engg (₹1.00 Cr)</span>
                  <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded-md text-secondary font-medium">PG Tech (₹75 Lakhs)</span>
                  <span className="text-[10px] bg-surface-container px-2 py-0.5 rounded-md text-secondary font-medium">Management (₹1.25 Cr)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Instrument Custody Trail */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container p-5 shadow-xs flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-teal-700 text-[22px]">policy</span>
                <h3 className="text-base text-on-surface font-bold">Instrument Custody Trail</h3>
              </div>
              <span className="text-xs text-secondary font-medium">5 Events Logged</span>
            </div>

            <div className="relative pl-5 mt-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container text-xs">
              <div className="relative">
                <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full bg-teal-600 ring-4 ring-white shadow-xs"></span>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-900">PNB Finacle Nodal API</span>
                    <span className="font-data-mono text-[10px] text-secondary">Today 11:42 AM</span>
                  </div>
                  <p className="text-secondary mt-0.5">
                    Bank Gateway confirmed lien attachment. Response: <code className="font-data-mono text-teal-900 bg-teal-50 px-1 py-0.2 rounded border border-teal-200">PNB_200_LIEN_CONFIRMED</code>
                  </p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full bg-slate-400 ring-4 ring-white shadow-xs"></span>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface">OCR Extraction Engine</span>
                    <span className="font-data-mono text-[10px] text-secondary">Today 09:15 AM</span>
                  </div>
                  <p className="text-secondary mt-0.5">
                    Document scanned at 99.2% accuracy. Minor mandate descriptor discrepancy identified.
                  </p>
                </div>
              </div>

              <div className="relative">
                <span className="absolute -left-5 top-1 w-3.5 h-3.5 rounded-full bg-slate-300 ring-4 ring-white shadow-xs"></span>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-on-surface">Trust Secretary (SXEC)</span>
                    <span className="font-data-mono text-[10px] text-secondary">Yesterday 04:30 PM</span>
                  </div>
                  <p className="text-secondary mt-0.5">
                    Renewed instrument uploaded with Form L-2 signed by PNB branch manager.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
