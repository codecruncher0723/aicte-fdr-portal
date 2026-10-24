import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
import { canAct } from '../config/roleAccess';
import { FDR_STATUSES } from '../data/mockData';
import { apiClient } from '../api/client';

export default function VerificationPage({ fdrs = [], onUpdateFdrStatus }) {
  const { currentRole } = useRole();
  const userCanAct = canAct(currentRole);

  const [selectedFdrId, setSelectedFdrId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'UNVERIFIED' | 'VERIFIED' | 'RETURNED'
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'detail'

  // Per-FDR flags and notes state
  const [fdrCustomData, setFdrCustomData] = useState(() => {
    const map = {};
    fdrs.forEach((f) => {
      const isReturned = f.status === FDR_STATUSES.CORRECTION_REQUIRED || f.status === 'CORRECTION_REQUIRED' || f.status === 'needs_info';
      const isVerified = f.status === FDR_STATUSES.VERIFIED || f.status === FDR_STATUSES.ACTIVE || f.status === FDR_STATUSES.PENDING_APPROVAL;
      map[f.id] = {
        notes: f.statusRemarks || f.notes || '',
        flags: [
          {
            id: 'flag_1',
            rule: 'Amount Consistency',
            reason: isReturned ? 'Needs review: amount differs from document scan' : 'Discrepancy noted in endorsement branch name',
            severity: isReturned ? 'High' : isVerified ? 'Low' : 'Medium',
            status: isReturned ? 'open' : 'resolved',
            rationale: isReturned ? '' : 'Verified against core banking schedule',
          },
          {
            id: 'flag_2',
            rule: 'Lien Descriptor Clause',
            reason: 'Mandate clause requires explicit Regional Office descriptor under Regulation 14(B)',
            severity: 'Medium',
            status: isReturned ? 'open' : 'resolved',
            rationale: isReturned ? '' : 'Clause verified in Form L-1 annexure',
          },
        ],
        documents: [
          { id: 'doc_1', name: 'Fixed Deposit Receipt (Physical Scan)', required: true, present: true, fileName: 'FDR_RECEIPT_SCAN.pdf' },
          { id: 'doc_2', name: 'Form L-1 Bank Lien Endorsement', required: true, present: !isReturned, fileName: isReturned ? null : 'FORM_L1_ENDORSEMENT.pdf' },
          { id: 'doc_3', name: 'Tripartite Security Deposit Agreement', required: true, present: true, fileName: 'TRIPARTITE_AGREEMENT.pdf' },
          { id: 'doc_4', name: 'Sponsoring Trust Resolution & Mandate', required: false, present: true, fileName: 'TRUST_RESOLUTION.pdf' },
        ],
      };
    });
    return map;
  });

  // Action modals/prompts
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [flagModalTarget, setFlagModalTarget] = useState(null);
  const [flagRationale, setFlagRationale] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  // 3.1 List view: Unverified (Submitted / In Scrutiny), Verified, and Returned (Correction Required)
  const queueFdrs = useMemo(() => {
    return fdrs
      .filter((f) => {
        const s = (f.status || '').toLowerCase();
        const isSubmitted = s.includes('submitted') || s.includes('under_verification') || s.includes('verification');
        const isReturned = s.includes('correction') || s.includes('needs_info');
        const isVerified = s.includes('verified') || s === 'active' || s.includes('pending_approval');

        if (statusFilter === 'UNVERIFIED') return isSubmitted;
        if (statusFilter === 'VERIFIED') return isVerified;
        if (statusFilter === 'RETURNED') return isReturned;
        return isSubmitted || isReturned || isVerified;
      })
      .filter((f) => {
        if (!searchTerm) return true;
        const q = searchTerm.toLowerCase();
        return (
          f.fdrNumber.toLowerCase().includes(q) ||
          f.institutionName.toLowerCase().includes(q) ||
          f.bank.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.issueDate || a.created_at || '2024-01-01');
        const dateB = new Date(b.issueDate || b.created_at || '2024-01-01');
        return dateA - dateB; // oldest first
      });
  }, [fdrs, statusFilter, searchTerm]);

  const selectedFdr = useMemo(() => {
    if (!selectedFdrId) return queueFdrs[0] || null;
    return fdrs.find((f) => f.id === selectedFdrId) || queueFdrs[0] || null;
  }, [fdrs, queueFdrs, selectedFdrId]);

  const currentFdrData = selectedFdr ? fdrCustomData[selectedFdr.id] || {
    notes: '',
    flags: [],
    documents: [],
  } : null;

  // Check if "Mark reviewed" can be enabled
  const canMarkReviewed = useMemo(() => {
    if (!currentFdrData) return false;
    const hasMissingMandatoryDoc = currentFdrData.documents.some((d) => d.required && !d.present);
    const hasOpenHighMediumFlag = currentFdrData.flags.some(
      (fl) => fl.status === 'open' && (fl.severity === 'High' || fl.severity === 'Medium')
    );
    return !hasMissingMandatoryDoc && !hasOpenHighMediumFlag;
  }, [currentFdrData]);

  // Actions
  const handleMarkReviewed = async () => {
    if (!selectedFdr || !canMarkReviewed) return;
    try {
      if (apiClient.verifyFdr) {
        await apiClient.verifyFdr(selectedFdr.id, {
          decision: 'VERIFIED',
          remarks: 'Officer-reviewed: Document checklist and discrepancies confirmed compliant.',
        }).catch(() => {});
      }
      if (onUpdateFdrStatus) {
        onUpdateFdrStatus(selectedFdr.id, FDR_STATUSES.VERIFIED, 'Officer-reviewed');
      }
      setActionSuccessMsg(`FDR ${selectedFdr.fdrNumber} marked as Officer-reviewed.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      setActiveTab('list');
    } catch (e) {
      console.warn(e);
    }
  };

  const handleConfirmReturn = async () => {
    if (!selectedFdr || !returnReason.trim()) return;
    try {
      if (apiClient.verifyFdr) {
        await apiClient.verifyFdr(selectedFdr.id, {
          decision: 'CORRECTION_REQUIRED',
          remarks: returnReason,
        }).catch(() => {});
      }
      if (onUpdateFdrStatus) {
        onUpdateFdrStatus(selectedFdr.id, FDR_STATUSES.CORRECTION_REQUIRED, returnReason);
      }
      setReturnModalOpen(false);
      setReturnReason('');
      setActionSuccessMsg(`FDR ${selectedFdr.fdrNumber} returned to institution for information.`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
      setActiveTab('list');
    } catch (e) {
      console.warn(e);
    }
  };

  const handleAddNote = () => {
    if (!selectedFdr || !newNote.trim()) return;
    setFdrCustomData((prev) => {
      const existing = prev[selectedFdr.id] || { notes: '', flags: [], documents: [] };
      const updatedNotes = existing.notes ? `${existing.notes} | ${newNote.trim()}` : newNote.trim();
      return {
        ...prev,
        [selectedFdr.id]: {
          ...existing,
          notes: updatedNotes,
        },
      };
    });
    setNewNote('');
    setNoteModalOpen(false);
    setActionSuccessMsg('Scrutiny note recorded.');
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleResolveFlag = () => {
    if (!selectedFdr || !flagModalTarget) return;
    setFdrCustomData((prev) => {
      const existing = prev[selectedFdr.id] || { notes: '', flags: [], documents: [] };
      const updatedFlags = existing.flags.map((f) => {
        if (f.id === flagModalTarget.id) {
          return { ...f, status: 'resolved', rationale: flagRationale.trim() || 'Resolved upon verification' };
        }
        return f;
      });
      return {
        ...prev,
        [selectedFdr.id]: {
          ...existing,
          flags: updatedFlags,
        },
      };
    });
    setFlagModalTarget(null);
    setFlagRationale('');
    setActionSuccessMsg(`Flag "${flagModalTarget.rule}" resolved.`);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto text-on-surface">
      {/* Toast */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center justify-between">
          <span>{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 dark:text-emerald-400 font-bold ml-2">✕</button>
        </div>
      )}

      {/* 3.1 List View (Queue) */}
      {activeTab === 'list' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
            <div>
              <h1 className="font-headline-lg text-xl sm:text-2xl font-bold tracking-tight">
                Verification Queue
              </h1>
              <p className="text-xs text-secondary mt-0.5">
                Review submitted FDRs and confirm document completeness
              </p>
            </div>
            <div className="text-xs text-secondary font-medium">
              Queue: <strong className="text-on-surface">{queueFdrs.length}</strong> awaiting review
            </div>
          </div>

          {/* Search box and status filter (All / Needs review / Returned) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-3 rounded-2xl border border-surface-container shadow-xs">
            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-secondary text-[18px]">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search institution, FDR number, bank..."
                className="w-full h-9 pl-9 pr-3 bg-surface-container-low border border-surface-container rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl border border-surface-container self-start sm:self-auto">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'ALL'
                    ? 'bg-surface-container-lowest text-primary shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                All ({fdrs.length})
              </button>
              <button
                onClick={() => setStatusFilter('UNVERIFIED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'UNVERIFIED'
                    ? 'bg-surface-container-lowest text-amber-700 dark:text-amber-300 shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Unverified
              </button>
              <button
                onClick={() => setStatusFilter('VERIFIED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'VERIFIED'
                    ? 'bg-surface-container-lowest text-emerald-700 dark:text-emerald-300 shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Verified
              </button>
              <button
                onClick={() => setStatusFilter('RETURNED')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  statusFilter === 'RETURNED'
                    ? 'bg-surface-container-lowest text-rose-700 dark:text-rose-300 shadow-xs'
                    : 'text-secondary hover:text-on-surface'
                }`}
              >
                Returned
              </button>
            </div>
          </div>

          {/* Queue Table */}
          <div className="overflow-x-auto rounded-2xl border border-surface-container bg-surface-container-lowest shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-10 border-b border-surface-container">
                  <th className="px-4 py-2 font-semibold">Institution</th>
                  <th className="px-4 py-2 font-semibold">FDR number</th>
                  <th className="px-4 py-2 font-semibold">Bank</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 font-semibold">Maturity date</th>
                  <th className="px-4 py-2 text-center font-semibold">Documents</th>
                  <th className="px-4 py-2 text-center font-semibold">Flags</th>
                  <th className="px-4 py-2 text-center font-semibold">Status</th>
                  <th className="px-4 py-2 font-semibold">Submitted on</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {queueFdrs.map((fdr) => {
                  const custom = fdrCustomData[fdr.id] || { documents: [], flags: [] };
                  const presentDocs = custom.documents.filter((d) => d.present).length;
                  const totalDocs = custom.documents.length || 4;
                  const openFlags = custom.flags.filter((fl) => fl.status === 'open').length;
                  const s = (fdr.status || '').toLowerCase();
                  const isReturned = s.includes('correction') || s.includes('needs_info');
                  const isVerified = s.includes('verified') || s === 'active' || s.includes('pending_approval');

                  return (
                    <tr
                      key={fdr.id}
                      onClick={() => {
                        setSelectedFdrId(fdr.id);
                        setActiveTab('detail');
                      }}
                      className="hover:bg-surface-container/60 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 font-semibold text-on-surface">
                        {fdr.institutionName}
                      </td>
                      <td className="px-4 py-3 font-data-mono font-semibold text-primary">
                        {fdr.fdrNumber}
                      </td>
                      <td className="px-4 py-3 text-secondary">
                        {fdr.bank}
                      </td>
                      <td className="px-4 py-3 text-right font-data-mono font-bold text-on-surface">
                        {fdr.amountFormatted || '₹' + Number(fdr.amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 font-data-mono text-secondary">
                        {fdr.maturityDate}
                      </td>
                      <td className="px-4 py-3 text-center font-data-mono font-semibold">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] ${
                          presentDocs === totalDocs
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                        }`}>
                          {presentDocs}/{totalDocs}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-data-mono font-semibold">
                        {openFlags > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {openFlags}
                          </span>
                        ) : (
                          <span className="text-secondary/70">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isReturned
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : isVerified
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {isReturned ? 'Returned' : isVerified ? 'Verified' : 'Unverified'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-data-mono text-secondary">
                        {fdr.issueDate || '2024-11-10'}
                      </td>
                    </tr>
                  );
                })}
                {queueFdrs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-secondary">
                      No FDRs matching the selected filter in verification queue.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3.2 Detail View (One FDR) */}
      {activeTab === 'detail' && selectedFdr && (
        <div className="flex flex-col gap-5">
          {/* Top Bar with Back and Actions */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-3 border-b border-surface-container">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('list')}
                className="p-1.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container text-on-surface transition-colors"
                title="Back to Queue"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div>
                <h1 className="font-headline-lg text-lg sm:text-xl font-bold tracking-tight">
                  {selectedFdr.fdrNumber}
                </h1>
                <span className="text-xs text-secondary font-medium">
                  {selectedFdr.institutionName}
                </span>
              </div>
            </div>

            {/* Actions: only Mark reviewed, Return for information, Add note (if userCanAct) */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setNoteModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container text-on-surface text-xs font-semibold transition-colors"
              >
                Add note
              </button>

              {userCanAct && (
                <>
                  <button
                    onClick={() => setReturnModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold transition-colors"
                  >
                    Return for information
                  </button>
                  <button
                    onClick={handleMarkReviewed}
                    disabled={!canMarkReviewed}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-40 disabled:cursor-not-allowed text-on-primary text-xs font-semibold shadow-xs transition-colors"
                    title={!canMarkReviewed ? "Disabled while mandatory documents are missing or open flags remain" : "Mark as Officer-reviewed"}
                  >
                    Mark reviewed
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Entered Values with Source Badges */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-4">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <h2 className="font-headline-md text-sm font-bold text-on-surface">
                    Entered Instrument Details
                  </h2>
                  <span className="text-[11px] text-secondary">Field Source Ledger</span>
                </div>

                <div className="divide-y divide-surface-container text-xs">
                  {[
                    { label: 'FDR number', value: selectedFdr.fdrNumber, badge: 'submitted' },
                    { label: 'Bank', value: selectedFdr.bank, badge: 'extracted' },
                    { label: 'Branch', value: selectedFdr.branch || 'Main Branch', badge: 'extracted' },
                    { label: 'IFSC', value: selectedFdr.ifsc || 'PUNB0012900', badge: 'extracted' },
                    { label: 'Amount', value: selectedFdr.amountFormatted || '₹1,00,00,000', badge: 'submitted' },
                    { label: 'Issue date', value: selectedFdr.issueDate || '2021-11-18', badge: 'extracted' },
                    { label: 'Maturity date', value: selectedFdr.maturityDate || '2026-11-18', badge: 'extracted' },
                    { label: 'Holder name', value: selectedFdr.jointAccountHolder || "AICTE Regional Officer & Sponsoring Trust", badge: 'submitted' },
                    { label: 'Lien details', value: selectedFdr.mandateClause || 'Exclusive Statutory Lien under Reg 14(B)', badge: 'submitted' },
                  ].map((field, i) => (
                    <div key={i} className="py-2.5 flex items-center justify-between gap-3">
                      <span className="text-secondary font-medium">{field.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-data-mono font-semibold text-on-surface text-right">
                          {field.value}
                        </span>
                        <span className={`px-2 py-0.2 rounded text-[10px] font-semibold uppercase ${
                          field.badge === 'extracted'
                            ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800'
                            : field.badge === 'corrected'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                            : 'bg-surface-container text-secondary'
                        }`}>
                          {field.badge}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Scrutiny Notes */}
                {currentFdrData?.notes && (
                  <div className="mt-2 p-3 rounded-xl bg-surface-container-low border border-surface-container text-xs">
                    <span className="font-semibold text-secondary block mb-1">Scrutiny Observation Notes:</span>
                    <p className="text-on-surface leading-relaxed">{currentFdrData.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Document Checklist & Flags */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              
              {/* Document Checklist */}
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <h2 className="font-headline-md text-sm font-bold text-on-surface">
                    Document Checklist
                  </h2>
                  <span className="text-[11px] text-secondary">Statutory Requirement</span>
                </div>

                <div className="flex flex-col gap-2">
                  {currentFdrData?.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex items-center justify-between gap-3"
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-on-surface truncate">{doc.name}</span>
                        <span className="text-[10px] text-secondary mt-0.5">
                          {doc.required ? 'Mandatory' : 'Supplementary'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          doc.present
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        }`}>
                          {doc.present ? 'Present' : 'Missing'}
                        </span>
                        {doc.present && (
                          <button
                            onClick={() => alert(`Previewing ${doc.fileName || doc.name}`)}
                            className="p-1 rounded-lg text-primary hover:bg-surface-container text-xs font-semibold"
                            title="Preview file"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flags List */}
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <h2 className="font-headline-md text-sm font-bold text-on-surface">
                    Flags & Discrepancies
                  </h2>
                  <span className="text-[11px] text-secondary">
                    {currentFdrData?.flags.filter(f => f.status === 'open').length} Open
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {currentFdrData?.flags.map((flag) => (
                    <div
                      key={flag.id}
                      className="p-3.5 rounded-xl border border-surface-container bg-surface-container-low flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${
                            flag.status === 'open' ? 'bg-rose-500' : 'bg-emerald-500'
                          }`} />
                          <span className="text-xs font-bold text-on-surface">{flag.rule}</span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                            flag.severity === 'High'
                              ? 'bg-rose-100 text-rose-800'
                              : flag.severity === 'Medium'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-800'
                          }`}>
                            {flag.severity}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          flag.status === 'open'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {flag.status === 'open' ? 'Open' : 'Resolved'}
                        </span>
                      </div>

                      <p className="text-xs text-secondary leading-relaxed">{flag.reason}</p>

                      {flag.status === 'open' && userCanAct && (
                        <div className="pt-2 border-t border-surface-container flex justify-end">
                          <button
                            onClick={() => {
                              setFlagModalTarget(flag);
                              setFlagRationale('');
                            }}
                            className="text-xs text-primary hover:underline font-semibold"
                          >
                            Resolve / Accept flag
                          </button>
                        </div>
                      )}

                      {flag.status === 'resolved' && flag.rationale && (
                        <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium italic">
                          Rationale: {flag.rationale}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Return for Information Reason Modal */}
      {returnModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface rounded-2xl shadow-xl w-full max-w-md p-5 border border-surface-container flex flex-col gap-4">
            <h3 className="font-bold text-sm">Return FDR for Information</h3>
            <p className="text-xs text-secondary">
              Provide a short reason explaining what information or document correction is required from the institution.
            </p>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Mandatory Form L-1 missing regional office descriptor..."
              className="w-full h-24 p-3 bg-surface-container-low border border-surface-container rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setReturnModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-secondary hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReturn}
                disabled={!returnReason.trim()}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold disabled:opacity-50"
              >
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {noteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface rounded-2xl shadow-xl w-full max-w-md p-5 border border-surface-container flex flex-col gap-4">
            <h3 className="font-bold text-sm">Add Scrutiny Observation Note</h3>
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Enter scrutiny observation..."
              className="w-full h-24 p-3 bg-surface-container-low border border-surface-container rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setNoteModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-secondary hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-bold disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Flag Modal */}
      {flagModalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface rounded-2xl shadow-xl w-full max-w-md p-5 border border-surface-container flex flex-col gap-4">
            <h3 className="font-bold text-sm">Resolve / Accept Flag</h3>
            <p className="text-xs text-secondary">
              Rule: <strong>{flagModalTarget.rule}</strong>
            </p>
            <input
              type="text"
              value={flagRationale}
              onChange={(e) => setFlagRationale(e.target.value)}
              placeholder="Enter rationale for acceptance/resolution..."
              className="w-full h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setFlagModalTarget(null)}
                className="px-3 py-1.5 rounded-lg text-secondary hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveFlag}
                className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-bold"
              >
                Confirm Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
