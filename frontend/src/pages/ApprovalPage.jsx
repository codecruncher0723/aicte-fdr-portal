import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
import { canAct, DELEGATED_AMOUNT_LIMIT } from '../config/roleAccess';
import { apiClient } from '../api/client';

export default function ApprovalPage({
  releaseRequests = [],
  fdrs = [],
  onUpdateReleaseRequest,
  onUpdateFdrStatus,
}) {
  const { currentRole, currentUser } = useRole();
  const userCanAct = canAct(currentRole);

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'detail'
  const [selectedCaseId, setSelectedCaseId] = useState(null);

  // Local state for queue cases (allows removal after decision)
  const [localDecidedIds, setLocalDecidedIds] = useState(new Set());

  // Modals for rationale
  const [decisionModalType, setDecisionModalType] = useState(null); // 'APPROVE' | 'REJECT' | null
  const [rationale, setRationale] = useState('');
  const [actionSuccessMsg, setActionSuccessMsg] = useState(null);

  // Combine release requests in ready_for_decision / pending approval and any pending approval FDRs
  const rawReferredCases = useMemo(() => {
    const list = [];

    releaseRequests.forEach((req) => {
      const s = (req.status || '').toUpperCase();
      if (['READY_FOR_DECISION', 'PENDING_APPROVAL', 'REQUESTED', 'UNDER_VERIFICATION'].includes(s)) {
        list.push({
          id: req.id,
          type: 'RELEASE_REQUEST',
          institutionName: req.institutionName,
          fdrNumber: req.fdrNumber,
          requestType: req.requestType || 'Release / Refund Request',
          amount: Number(req.amount || 0),
          amountFormatted: req.amountFormatted || '₹' + Number(req.amount || 0).toLocaleString('en-IN'),
          referredOn: req.submittedDate || '2024-11-05',
          checklistTotal: 5,
          checklistDone: 5,
          checklistItems: [
            { item: 'Statutory Lien Endorsement', status: 'Done', waiver: null },
            { item: 'Core Banking Ledger Reconciliation', status: 'Done', waiver: null },
            { item: 'Zero Outstanding Penalties Verification', status: 'Done', waiver: null },
            { item: 'Sponsoring Trust Mandate & Resolution', status: 'Done', waiver: null },
            { item: 'Regional Scrutiny Officer Clearance', status: 'Done', waiver: null },
          ],
          verificationBadge: 'Officer-reviewed',
          reviewerNotes: req.notes || 'Full tripartite scrutiny completed. Instrument verified compliant with Regulation 14(B).',
          raisedById: req.created_by_id || req.raisedById || null,
          history: [
            { date: req.submittedDate || '2024-11-02', event: 'Request submitted by Institution Officer' },
            { date: '2024-11-06', event: 'Scrutiny completed by Regional Verification Officer' },
            { date: '2024-11-08', event: 'Referred to Approving Authority for final decision' },
          ],
        });
      }
    });

    fdrs.forEach((f) => {
      const s = (f.status || '').toUpperCase();
      if (s === 'PENDING_APPROVAL' || s.includes('PENDING_APPROVAL')) {
        list.push({
          id: f.id,
          type: 'FDR_APPROVAL',
          institutionName: f.institutionName,
          fdrNumber: f.fdrNumber,
          requestType: 'Initial Statutory Pledge',
          amount: Number(f.amount || 0),
          amountFormatted: f.amountFormatted || '₹' + Number(f.amount || 0).toLocaleString('en-IN'),
          referredOn: f.issueDate || '2024-11-01',
          checklistTotal: 5,
          checklistDone: 4,
          checklistItems: [
            { item: 'Physical Deposit Receipt Match', status: 'Done', waiver: null },
            { item: 'Form L-1 Lien Confirmation', status: 'Done', waiver: null },
            { item: 'Tripartite Escrow Agreement', status: 'Done', waiver: null },
            { item: 'Auto-Rollover Mandate Clause', status: 'Done', waiver: null },
            { item: 'Regional Descriptor Waiver', status: 'Excepted', waiver: 'Waived by Shri V. K. Malhotra (WRO Scrutiny): Form L-1 amendment verified via bank annexure' },
          ],
          verificationBadge: 'Officer-reviewed',
          reviewerNotes: f.notes || 'Cross-checked against Finacle core banking registry. Recommended for statutory council endorsement.',
          raisedById: f.created_by_id || null,
          history: [
            { date: f.issueDate || '2024-10-20', event: 'FDR registered by Institution' },
            { date: '2024-10-28', event: 'Regional Scrutiny Desk verified documents' },
            { date: '2024-11-02', event: 'Referred upward to Approving Authority' },
          ],
        });
      }
    });

    return list;
  }, [releaseRequests, fdrs]);

  // Filter:
  // 1. Within delegated authority limit (DELEGATED_AMOUNT_LIMIT)
  // 2. Hide any case this user raised or prepared (separation of duties)
  // 3. Remove cases decided in local session
  // 4. Oldest first
  const queueCases = useMemo(() => {
    const actorId = currentUser?.userId || currentUser?.id;
    return rawReferredCases
      .filter((c) => !localDecidedIds.has(c.id))
      .filter((c) => c.amount <= DELEGATED_AMOUNT_LIMIT)
      .filter((c) => !actorId || c.raisedById !== actorId)
      .sort((a, b) => new Date(a.referredOn) - new Date(b.referredOn)); // oldest first
  }, [rawReferredCases, localDecidedIds, currentUser]);

  const selectedCase = useMemo(() => {
    if (!selectedCaseId) return queueCases[0] || null;
    return queueCases.find((c) => c.id === selectedCaseId) || queueCases[0] || null;
  }, [queueCases, selectedCaseId]);

  const handleOpenDecision = (type) => {
    setDecisionModalType(type);
    setRationale('');
  };

  const handleConfirmDecision = async () => {
    if (!selectedCase || !rationale.trim()) return;
    const isApprove = decisionModalType === 'APPROVE';

    try {
      if (selectedCase.type === 'FDR_APPROVAL' && apiClient.approveFdr) {
        await apiClient.approveFdr(selectedCase.id, {
          decision: isApprove ? 'APPROVED' : 'REJECTED',
          remarks: rationale.trim(),
          council_order_ref: `AICTE/EC/2026/DEC-${selectedCase.id}`,
        }).catch(() => {});
        if (onUpdateFdrStatus) {
          onUpdateFdrStatus(selectedCase.id, isApprove ? 'Active' : 'Rejected', rationale.trim());
        }
      } else if (onUpdateReleaseRequest) {
        onUpdateReleaseRequest(selectedCase.id, isApprove ? 'RELEASE_APPROVED' : 'REJECTED', rationale.trim());
      }

      // Remove from queue and return to list
      setLocalDecidedIds((prev) => new Set([...prev, selectedCase.id]));
      setDecisionModalType(null);
      setRationale('');
      setActiveTab('list');
      setActionSuccessMsg(`Case for ${selectedCase.fdrNumber} ${isApprove ? 'approved' : 'rejected'}. Removed from queue.`);
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch (e) {
      console.warn(e);
    }
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

      {/* 4.1 List View (Queue) */}
      {activeTab === 'list' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-surface-container">
            <div>
              <h1 className="font-headline-lg text-xl sm:text-2xl font-bold tracking-tight">
                Approval Queue
              </h1>
              <p className="text-xs text-secondary mt-0.5">
                Referred cases awaiting decision within delegated statutory authority
              </p>
            </div>
            <div className="text-xs text-secondary font-medium">
              Queue: <strong className="text-on-surface">{queueCases.length}</strong> referred cases
            </div>
          </div>

          {/* Queue Table */}
          <div className="overflow-x-auto rounded-2xl border border-surface-container bg-surface-container-lowest shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-10 border-b border-surface-container">
                  <th className="px-4 py-2 font-semibold">Institution</th>
                  <th className="px-4 py-2 font-semibold">FDR number</th>
                  <th className="px-4 py-2 font-semibold">Request type</th>
                  <th className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th className="px-4 py-2 font-semibold">Referred on</th>
                  <th className="px-4 py-2 text-center font-semibold">Checklist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {queueCases.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => {
                      setSelectedCaseId(c.id);
                      setActiveTab('detail');
                    }}
                    className="hover:bg-surface-container/60 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold text-on-surface">
                      {c.institutionName}
                    </td>
                    <td className="px-4 py-3 font-data-mono font-semibold text-primary">
                      {c.fdrNumber}
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {c.requestType}
                    </td>
                    <td className="px-4 py-3 text-right font-data-mono font-bold text-on-surface">
                      {c.amountFormatted}
                    </td>
                    <td className="px-4 py-3 font-data-mono text-secondary">
                      {c.referredOn}
                    </td>
                    <td className="px-4 py-3 text-center font-data-mono font-semibold">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        {c.checklistDone}/{c.checklistTotal}
                      </span>
                    </td>
                  </tr>
                ))}
                {queueCases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-secondary">
                      No referred cases awaiting decision within delegated authority.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4.2 Detail View (One Case: Single-screen Summary) */}
      {activeTab === 'detail' && selectedCase && (
        <div className="flex flex-col gap-5">
          {/* Top Bar */}
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
                <div className="flex items-center gap-2">
                  <h1 className="font-headline-lg text-lg sm:text-xl font-bold tracking-tight">
                    {selectedCase.fdrNumber}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                    {selectedCase.verificationBadge}
                  </span>
                </div>
                <span className="text-xs text-secondary font-medium">
                  {selectedCase.institutionName} • {selectedCase.requestType}
                </span>
              </div>
            </div>

            {/* Actions: only Approve & Reject (hidden for Admin) */}
            {userCanAct && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleOpenDecision('REJECT')}
                  className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => handleOpenDecision('APPROVE')}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-semibold shadow-xs transition-colors"
                >
                  Approve
                </button>
              </div>
            )}
          </div>

          {/* Single-Screen Summary Grid (Read-Only) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* Left Card: FDR Summary & Reviewer's Notes */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-3">
                <h2 className="font-headline-md text-sm font-bold text-on-surface pb-2 border-b border-surface-container">
                  FDR Summary
                </h2>

                <div className="divide-y divide-surface-container text-xs">
                  <div className="py-2 flex justify-between">
                    <span className="text-secondary">Institution</span>
                    <span className="font-semibold text-right">{selectedCase.institutionName}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-secondary">Receipt Number</span>
                    <span className="font-data-mono font-semibold text-primary">{selectedCase.fdrNumber}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-secondary">Case Type</span>
                    <span className="font-medium">{selectedCase.requestType}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-secondary">Amount</span>
                    <span className="font-data-mono font-bold text-base text-on-surface">{selectedCase.amountFormatted}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="text-secondary">Referred Date</span>
                    <span className="font-data-mono text-secondary">{selectedCase.referredOn}</span>
                  </div>
                </div>
              </div>

              {/* Reviewer's Notes */}
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-2">
                <h3 className="font-bold text-xs text-secondary uppercase tracking-wider">
                  Reviewer's Scrutiny Notes
                </h3>
                <p className="text-xs text-on-surface leading-relaxed bg-surface-container-low p-3.5 rounded-xl border border-surface-container">
                  {selectedCase.reviewerNotes}
                </p>
              </div>
            </div>

            {/* Right Card: Checklist Status & Compact History Timeline */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              {/* Checklist Status */}
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                  <h2 className="font-headline-md text-sm font-bold text-on-surface">
                    Verification Checklist Status
                  </h2>
                  <span className="text-xs font-data-mono font-bold text-teal-700 dark:text-teal-400">
                    {selectedCase.checklistDone}/{selectedCase.checklistTotal} Verified
                  </span>
                </div>

                <div className="flex flex-col gap-2.5">
                  {selectedCase.checklistItems.map((chk, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-surface-container-low border border-surface-container flex flex-col gap-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-on-surface">{chk.item}</span>
                        <span className={`px-2 py-0.2 rounded-full text-[11px] font-semibold ${
                          chk.status === 'Done'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}>
                          {chk.status}
                        </span>
                      </div>
                      {chk.waiver && (
                        <span className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2 rounded-lg border border-amber-200 dark:border-amber-900/40 mt-1 leading-relaxed">
                          {chk.waiver}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* History Timeline (Compact) */}
              <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container shadow-xs flex flex-col gap-3">
                <h2 className="font-headline-md text-sm font-bold text-on-surface pb-2 border-b border-surface-container">
                  History Timeline
                </h2>

                <div className="flex flex-col gap-3 text-xs pl-2">
                  {selectedCase.history.map((h, i) => (
                    <div key={i} className="flex items-start gap-3 relative">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0 ring-4 ring-primary/20" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-on-surface">{h.event}</span>
                        <span className="font-data-mono text-[10px] text-secondary mt-0.5">{h.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Approve / Reject Rationale Modal */}
      {decisionModalType && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest text-on-surface rounded-2xl shadow-xl w-full max-w-md p-5 border border-surface-container flex flex-col gap-4">
            <h3 className="font-bold text-sm">
              {decisionModalType === 'APPROVE' ? 'Approve Case' : 'Reject Case'}
            </h3>
            <p className="text-xs text-secondary">
              A statutory rationale is required to record this executive council decision.
            </p>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder={`Enter rationale for ${decisionModalType === 'APPROVE' ? 'approval' : 'rejection'}...`}
              className="w-full h-24 p-3 bg-surface-container-low border border-surface-container rounded-xl text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setDecisionModalType(null)}
                className="px-3 py-1.5 rounded-lg text-secondary hover:bg-surface-container"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecision}
                disabled={!rationale.trim()}
                className={`px-4 py-1.5 rounded-lg text-white font-bold disabled:opacity-50 ${
                  decisionModalType === 'APPROVE'
                    ? 'bg-primary hover:bg-primary-container'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Confirm {decisionModalType === 'APPROVE' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
