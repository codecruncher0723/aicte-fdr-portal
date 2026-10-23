import React, { useState } from 'react';
import { FDR_STATUSES } from '../../data/mockData';

export default function ScrutinyRemarksModal({ isOpen, onClose, fdr, onResubmitSuccess }) {
  const [remarks, setRemarks] = useState(
    'Amended Form L-1 uploaded with explicit regional office descriptor (AICTE Western Regional Office, Mumbai/Pune) and certified by Branch Manager with bank seal.'
  );
  const [fileName, setFileName] = useState('Form_L1_Signed_Endorsement_Amended.pdf');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen || !fdr) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
      setTimeout(() => {
        if (onResubmitSuccess) {
          onResubmitSuccess(fdr.id, remarks, fileName);
        }
        setIsSuccess(false);
        onClose();
      }, 1400);
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-on-surface/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between bg-surface-container-low/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">assignment_late</span>
            </div>
            <div>
              <h2 className="font-headline-sm text-base font-bold text-on-surface">
                WRO Scrutiny Deficiency & Resubmission
              </h2>
              <p className="text-xs text-secondary">
                FDR Ref: <span className="font-data-mono font-semibold text-on-surface">{fdr.fdrNumber}</span>
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

        {/* Content */}
        <div className="p-6">
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-[32px]">check_circle</span>
              </div>
              <h3 className="text-base font-bold text-on-surface">Corrections Resubmitted</h3>
              <p className="text-xs text-secondary max-w-xs mt-1">
                FDR status transitioned to <strong className="text-teal-700">SUBMITTED</strong>. The WRO desk has been notified for re-verification.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Deficiency Notice Card */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-[18px]">warning</span>
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Flagged Discrepancy by WRO Desk
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-amber-700">12 Nov 2024</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {fdr.discrepancyNote ||
                    'Joint Account Mandate text omits regional office descriptor (AICTE Western Regional Office, Pune/Mumbai). Form L-1 amendment required.'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800">
                  <span>Assigned Officer: Shri V. K. Malhotra (WRO)</span>
                  <span className="font-semibold">Remedy: Amend Form L-1</span>
                </div>
              </div>

              {/* Resolution Form */}
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Institution Officer Correction Notes <span className="text-error">*</span>
                </label>
                <textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Detail how the discrepancy was rectified with the bank branch..."
                  className="w-full text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest p-3 text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                  required
                />
              </div>

              {/* File Re-upload */}
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Attach Corrected Document (Amended Form L-1 / Endorsement)
                </label>
                <div className="flex items-center justify-between p-3 rounded-xl border border-surface-container bg-surface-container-low">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="material-symbols-outlined text-primary text-[20px] shrink-0">description</span>
                    <span className="text-xs font-medium text-on-surface truncate">{fileName}</span>
                  </div>
                  <label className="cursor-pointer text-xs font-semibold text-primary hover:underline shrink-0">
                    Replace
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setFileName(e.target.files[0].name);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-surface-container flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary-container transition-colors shadow-sm inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">sync</span>
                      <span>Resubmit Correction</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
