import React from 'react';
import { FDR_STATUSES } from '../../data/mockData';

export default function FdrDetailModal({ isOpen, onClose, fdr, onNavigateAudit }) {
  if (!isOpen || !fdr) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-3xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-headline-sm text-base font-bold text-on-surface font-data-mono">
                  {fdr.fdrNumber}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  {fdr.status}
                </span>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                {fdr.institutionName} • PID: <span className="font-data-mono">{fdr.aictePid}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="text-[11px] text-secondary font-medium block">Principal Amount</span>
              <span className="text-base font-bold text-primary font-data-mono">{fdr.amountFormatted}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="text-[11px] text-secondary font-medium block">Interest Rate</span>
              <span className="text-sm font-bold text-on-surface font-data-mono">{fdr.interestRate}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="text-[11px] text-secondary font-medium block">Maturity Date</span>
              <span className="text-sm font-bold text-on-surface font-data-mono">{fdr.maturityDate}</span>
            </div>
            <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="text-[11px] text-secondary font-medium block">Tenure</span>
              <span className="text-sm font-bold text-on-surface">{fdr.tenureYears} Years</span>
            </div>
          </div>

          {/* Tripartite & Bank Custody Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">account_balance</span>
              <span>Banking & Regulatory Custody Endorsement</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-surface-container-low/50 p-4 rounded-xl border border-surface-container">
              <div>
                <span className="text-secondary block">Issuing Bank</span>
                <span className="font-semibold text-on-surface">{fdr.bank}</span>
              </div>
              <div>
                <span className="text-secondary block">Branch & IFSC</span>
                <span className="font-semibold text-on-surface">{fdr.branch} ({fdr.ifsc})</span>
              </div>
              <div>
                <span className="text-secondary block">Tripartite Ref</span>
                <span className="font-semibold text-on-surface font-data-mono">{fdr.tripartiteRef || 'TPR-2022-WRO-091'}</span>
              </div>
              <div>
                <span className="text-secondary block">Statutory Mandate Clause</span>
                <span className="font-semibold text-teal-800">{fdr.mandateClause || 'Clause 14(B) Joint Lien'}</span>
              </div>
              <div>
                <span className="text-secondary block">Lien Registration Status</span>
                <span className="font-semibold text-emerald-700">{fdr.lienStatus || 'Statutory Lien Registered'}</span>
              </div>
              <div>
                <span className="text-secondary block">OCR Cross-Check Confidence</span>
                <span className="font-semibold font-data-mono text-primary">{fdr.ocrConfidence || '99.8%'}</span>
              </div>
            </div>
          </div>

          {/* Sponsoring Trust & Academic Program */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
              <span>Institution & Academic Programme Scope</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-surface-container-low/50 p-4 rounded-xl border border-surface-container">
              <div>
                <span className="text-secondary block">Sponsoring Trust / Society</span>
                <span className="font-semibold text-on-surface">{fdr.sponsoringTrust}</span>
              </div>
              <div>
                <span className="text-secondary block">Academic Programme</span>
                <span className="font-semibold text-on-surface">{fdr.programme}</span>
              </div>
              <div>
                <span className="text-secondary block">Regional Office</span>
                <span className="font-semibold text-on-surface">{fdr.regionLabel}</span>
              </div>
              <div>
                <span className="text-secondary block">Location</span>
                <span className="font-semibold text-on-surface">{fdr.city}, {fdr.state}</span>
              </div>
            </div>
          </div>

          {/* Notes / Discrepancy (if any) */}
          {fdr.discrepancyNote && (
            <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0 mt-0.5">warning</span>
              <div>
                <strong className="block font-semibold">Active Scrutiny Remark:</strong>
                <span>{fdr.discrepancyNote}</span>
              </div>
            </div>
          )}

          {/* System Audit Details */}
          <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container text-xs text-secondary flex items-center justify-between">
            <span>Last Audited: <strong className="text-on-surface">{fdr.lastAuditDate}</strong></span>
            <span className="font-data-mono text-[11px]">SHA256: 8a7c29b...41e0</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-surface-container flex items-center justify-between bg-surface-container-low/40 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
          >
            Close
          </button>

          <button
            onClick={() => {
              onClose();
              if (onNavigateAudit) onNavigateAudit(fdr);
            }}
            className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-xs inline-flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>Open in Verification Workspace</span>
          </button>
        </div>
      </div>
    </div>
  );
}
