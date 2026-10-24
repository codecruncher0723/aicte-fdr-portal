import React, { useState } from 'react';
import { apiClient } from '../../api/client';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

export default function ScrutinyRemarksModal({ isOpen, onClose, fdr, onResubmitSuccess }) {
  const [remarks, setRemarks] = useState(
    'Amended Form L-1 uploaded with explicit regional office descriptor (AICTE Western Regional Office, Mumbai/Pune) and certified by Branch Manager with bank seal.'
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  if (!isOpen || !fdr) return null;

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setFileError(null);
    setErrorMessage(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    // 1. File size validation
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File size exceeds regulatory 10 MB limit (${(file.size / (1024 * 1024)).toFixed(2)} MB).`);
      setSelectedFile(null);
      return;
    }

    // 2. File extension validation
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setFileError(`Invalid file format '${ext}'. Allowed: PDF, JPEG, PNG, WEBP.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remarks.trim()) {
      setErrorMessage('Correction notes are required by AICTE regulations.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const fdrId = fdr.id || fdr.fdr_id;

      // 1. Upload new document version if selected
      if (selectedFile) {
        await apiClient.uploadDocument(fdrId, selectedFile, 'FDR_RECEIPT');
      }

      // 2. Call backend submit endpoint to transition CORRECTION_REQUIRED -> SUBMITTED
      await apiClient.submitFdr(fdrId, { remarks });

      setIsSuccess(true);
      setTimeout(() => {
        if (onResubmitSuccess) {
          onResubmitSuccess(fdrId, remarks);
        }
        setIsSuccess(false);
        setSelectedFile(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Correction resubmission failed:', err);
      setErrorMessage(err.message || 'Failed to resubmit FDR corrections to backend.');
    } finally {
      setIsSubmitting(false);
    }
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
            disabled={isSubmitting}
            className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
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
                FDR status transitioned to <strong className="text-teal-700">SUBMITTED</strong>. The regional scrutiny desk has been notified for re-verification.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Message Alert */}
              {errorMessage && (
                <div className="p-3.5 bg-red-50 rounded-xl border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-red-600 text-[18px] shrink-0 mt-0.5">error</span>
                  <div>
                    <strong className="block font-semibold">Resubmission Error:</strong>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Deficiency Notice Card */}
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200/80">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-700 text-[18px]">warning</span>
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                      Flagged Discrepancy by Verification Desk
                    </span>
                  </div>
                  <span className="text-[11px] font-medium text-amber-700">Audit Status</span>
                </div>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {fdr.statusRemarks || fdr.discrepancyNote ||
                    'Joint Account Mandate text omits regional office descriptor (AICTE Western Regional Office, Pune/Mumbai). Form L-1 amendment required.'}
                </p>
                <div className="mt-2.5 pt-2 border-t border-amber-200/60 flex items-center justify-between text-[11px] text-amber-800">
                  <span>Current Status: <strong>{fdr.status}</strong></span>
                  <span className="font-semibold">Action: Amend & Resubmit</span>
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
                  placeholder="Detail the corrections made per AICTE Approval Process Handbook..."
                  className="w-full p-3 text-xs rounded-xl border border-surface-container-high bg-surface-container-lowest text-on-surface focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  required
                />
              </div>

              {/* Replacement Document Upload */}
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Attach Corrected Supporting Document (Optional replacement)
                </label>
                <div className="border border-dashed border-surface-container-high rounded-xl p-3 bg-surface-container-low/40 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-medium inline-flex items-center gap-1.5 transition-colors">
                      <span className="material-symbols-outlined text-[16px] text-primary">upload_file</span>
                      <span>{selectedFile ? 'Change File' : 'Choose File'}</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-secondary truncate max-w-xs font-mono">
                      {selectedFile ? selectedFile.name : 'Retain existing document version'}
                    </span>
                  </div>

                  {selectedFile && (
                    <div className="flex items-center justify-between text-[11px] text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                      <span>Ready to upload: {(selectedFile.size / 1024).toFixed(1)} KB</span>
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {fileError && (
                    <span className="text-[11px] text-red-600 font-medium">{fileError}</span>
                  )}
                  <span className="text-[10px] text-secondary">
                    Max size: 10 MB. Supported: PDF, JPEG, PNG, WEBP. Immutably hashed via SHA-256 upon upload.
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-secondary hover:text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !!fileError}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-primary hover:bg-primary-container text-on-primary transition-colors shadow-xs inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting to WRO...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      <span>Resubmit for Verification</span>
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
