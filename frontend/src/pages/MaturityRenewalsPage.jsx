import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRole, ROLES } from '../context/RoleContext';
import { apiClient } from '../api/client';

export default function MaturityRenewalsPage({ fdrs = [], onSelectFdr }) {
  const { setActiveRoute, setSelectedFdrRef, currentRole, currentUser } = useRole();

  // Active top-level tab: 'surveillance' (Maturity Horizons) or 'requests' (Renewal Workflow Queue)
  const [activeTab, setActiveTab] = useState('surveillance');

  // Horizon Filter for Surveillance
  const [horizonFilter, setHorizonFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Renewal Requests state from Real Backend
  const [renewalRequests, setRenewalRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsError, setRequestsError] = useState(null);
  const [requestFilter, setRequestFilter] = useState('all'); // all, REQUESTED, UNDER_VERIFICATION, PENDING_APPROVAL, APPROVED, COMPLETED

  // Modals state
  const [selectedFdrForRenewal, setSelectedFdrForRenewal] = useState(null);
  const [selectedReqForCompletion, setSelectedReqForCompletion] = useState(null);

  // Form states for Initiate Renewal
  const [proposedMaturityDate, setProposedMaturityDate] = useState('');
  const [proposedFdrNumber, setProposedFdrNumber] = useState('');
  const [proposedInterestRate, setProposedInterestRate] = useState('');
  const [renewalReason, setRenewalReason] = useState('FDR approaching scheduled maturity horizon; requesting 3-year term rollover.');
  const [applicantNotes, setApplicantNotes] = useState('');
  const [isSubmittingRenewal, setIsSubmittingRenewal] = useState(false);
  const [modalError, setModalError] = useState(null);

  // Form states for Complete Renewal
  const [completeFdrNumber, setCompleteFdrNumber] = useState('');
  const [completeMaturityDate, setCompleteMaturityDate] = useState('');
  const [completeInterestRate, setCompleteInterestRate] = useState('');
  const [completeRemarks, setCompleteRemarks] = useState('Renewal ratified and confirmed by authorized officer.');
  const [isCompletingRenewal, setIsCompletingRenewal] = useState(false);
  const [completeError, setCompleteError] = useState(null);

  // Global notification banner
  const [successToast, setSuccessToast] = useState(null);

  const showToast = (msg) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 5000);
  };

  // 1. Fetch real renewal requests from backend
  const fetchRenewalRequests = useCallback(async () => {
    try {
      setRequestsLoading(true);
      setRequestsError(null);
      const data = await apiClient.getRequests({ request_type: 'RENEWAL' });
      setRenewalRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load renewal requests:', err);
      setRequestsError(err.message || 'Failed to fetch renewal requests from server.');
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRenewalRequests();
  }, [fetchRenewalRequests]);

  // 2. Surveillance calculations on real FDRs
  const recordsWithMaturity = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (fdrs || []).map((f) => {
      let diffDays = 0;
      if (f.maturityDate) {
        const matDate = new Date(f.maturityDate);
        matDate.setHours(0, 0, 0, 0);
        const diffTime = matDate - today;
        diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      return {
        ...f,
        daysRemaining: diffDays,
        isOverdue: diffDays < 0,
        isWithin30: diffDays >= 0 && diffDays <= 30,
        isWithin60: diffDays > 30 && diffDays <= 60,
        isWithin90: diffDays > 60 && diffDays <= 90,
      };
    });
  }, [fdrs]);

  const searchMatchedRecords = useMemo(() => {
    if (!search.trim()) return recordsWithMaturity;
    const s = search.toLowerCase().trim();
    return recordsWithMaturity.filter(
      (item) =>
        (item.fdrNumber || '').toLowerCase().includes(s) ||
        (item.institutionName || '').toLowerCase().includes(s) ||
        (item.bank || '').toLowerCase().includes(s) ||
        (item.branch || '').toLowerCase().includes(s)
    );
  }, [recordsWithMaturity, search]);

  const horizonCounts = useMemo(() => {
    return {
      all: searchMatchedRecords.length,
      overdue: searchMatchedRecords.filter((r) => r.isOverdue).length,
      '30days': searchMatchedRecords.filter((r) => r.isWithin30).length,
      '60days': searchMatchedRecords.filter((r) => r.isWithin60).length,
      '90days': searchMatchedRecords.filter((r) => r.isWithin90).length,
    };
  }, [searchMatchedRecords]);

  const filteredFdrRecords = useMemo(() => {
    return searchMatchedRecords.filter((item) => {
      if (horizonFilter === 'overdue') return item.isOverdue;
      if (horizonFilter === '30days') return item.isWithin30;
      if (horizonFilter === '60days') return item.isWithin60;
      if (horizonFilter === '90days') return item.isWithin90;
      return true;
    });
  }, [searchMatchedRecords, horizonFilter]);

  // 3. Filtered Renewal Requests
  const filteredRequests = useMemo(() => {
    return renewalRequests.filter((r) => {
      if (requestFilter === 'all') return true;
      return r.status === requestFilter;
    });
  }, [renewalRequests, requestFilter]);

  // 4. Modal Triggers
  const openInitiateRenewalModal = (fdr) => {
    setSelectedFdrForRenewal(fdr);
    setProposedFdrNumber(fdr.fdrNumber || '');
    setProposedInterestRate(fdr.interestRate || '7.25%');

    // Default proposed maturity date: 3 years after current maturity date
    let defaultNewDate = '';
    if (fdr.maturityDate) {
      const curMat = new Date(fdr.maturityDate);
      curMat.setFullYear(curMat.getFullYear() + 3);
      defaultNewDate = curMat.toISOString().split('T')[0];
    }
    setProposedMaturityDate(defaultNewDate);
    setRenewalReason('FDR approaching scheduled maturity horizon; requesting 3-year term rollover.');
    setApplicantNotes('');
    setModalError(null);
  };

  const openCompleteRenewalModal = (reqItem) => {
    setSelectedReqForCompletion(reqItem);
    const propDetails = reqItem.proposed_details || {};
    setCompleteFdrNumber(propDetails.proposed_fdr_number || reqItem.fdr_number || '');
    setCompleteMaturityDate(propDetails.proposed_maturity_date || reqItem.current_maturity_date || '');
    setCompleteInterestRate(propDetails.proposed_interest_rate || reqItem.current_interest_rate || '7.25%');
    setCompleteRemarks('Renewal ratified and confirmed by authorized officer.');
    setCompleteError(null);
  };

  // Live Differ Flag calculation inside Initiate Modal
  const isInitiateDiffering = useMemo(() => {
    if (!selectedFdrForRenewal) return false;
    const numDiff = proposedFdrNumber.trim() !== (selectedFdrForRenewal.fdrNumber || '').trim();
    const dateDiff = proposedMaturityDate !== selectedFdrForRenewal.maturityDate;
    const rateDiff = proposedInterestRate.trim() !== (selectedFdrForRenewal.interestRate || '').trim();
    return numDiff || dateDiff || rateDiff;
  }, [selectedFdrForRenewal, proposedFdrNumber, proposedMaturityDate, proposedInterestRate]);

  // 5. Submit Renewal Request Handler
  const handleSubmitRenewal = async (e) => {
    e.preventDefault();
    if (!selectedFdrForRenewal) return;

    if (!proposedMaturityDate) {
      setModalError('Please specify a valid proposed maturity date.');
      return;
    }
    if (selectedFdrForRenewal.maturityDate && proposedMaturityDate <= selectedFdrForRenewal.maturityDate) {
      setModalError('Proposed maturity date must extend beyond the current maturity date.');
      return;
    }

    try {
      setIsSubmittingRenewal(true);
      setModalError(null);

      const payload = {
        reason: renewalReason,
        proposed_maturity_date: proposedMaturityDate,
        proposed_fdr_number: proposedFdrNumber.trim() || undefined,
        proposed_interest_rate: proposedInterestRate.trim() || undefined,
        applicant_notes: applicantNotes.trim() || undefined,
      };

      const result = await apiClient.createRenewalRequest(selectedFdrForRenewal.id, payload);
      showToast(`Renewal request #${result.request_id} submitted for ${selectedFdrForRenewal.fdrNumber} into scrutiny review.`);
      setSelectedFdrForRenewal(null);

      // Refresh requests and switch to requests tab
      await fetchRenewalRequests();
      setActiveTab('requests');
    } catch (err) {
      console.error('Renewal initiation error:', err);
      setModalError(err.message || 'Failed to submit renewal request.');
    } finally {
      setIsSubmittingRenewal(false);
    }
  };

  // 6. Complete Renewal Handler
  const handleCompleteRenewal = async (e) => {
    e.preventDefault();
    if (!selectedReqForCompletion) return;

    if (!completeFdrNumber.trim()) {
      setCompleteError('Please provide the renewed FDR certificate number.');
      return;
    }
    if (!completeMaturityDate) {
      setCompleteError('Please specify the confirmed renewed maturity date.');
      return;
    }

    try {
      setIsCompletingRenewal(true);
      setCompleteError(null);

      const payload = {
        renewed_fdr_number: completeFdrNumber.trim(),
        renewed_maturity_date: completeMaturityDate,
        renewed_interest_rate: completeInterestRate.trim() || undefined,
        remarks: completeRemarks.trim() || undefined,
      };

      const res = await apiClient.completeRenewalRequest(selectedReqForCompletion.id, payload);
      showToast(`Renewal for FDR ${res.renewed_fdr_number} successfully completed! FDR status updated to ACTIVE.`);
      setSelectedReqForCompletion(null);

      // Refresh requests
      await fetchRenewalRequests();
    } catch (err) {
      console.error('Renewal completion error:', err);
      setCompleteError(err.message || 'Failed to complete renewal.');
    } finally {
      setIsCompletingRenewal(false);
    }
  };

  // Claim verification for verifier
  const handleClaimVerification = async (reqItem) => {
    try {
      await apiClient.startRequestVerification(reqItem.id);
      showToast(`Renewal request #${reqItem.id} claimed for scrutiny review.`);
      fetchRenewalRequests();
    } catch (err) {
      console.error('Claim verification error:', err);
      showToast(`Error: ${err.message}`);
    }
  };

  const handleInspect = (item) => {
    if (item.fdrNumber && setSelectedFdrRef) {
      setSelectedFdrRef(item.fdrNumber);
    }
    if (onSelectFdr) onSelectFdr(item);
  };

  const isInstitutionOfficer =
    currentRole === ROLES.INSTITUTION_OFFICER || currentRole === 'institution_officer';
  const isVerifier =
    currentRole === ROLES.VERIFICATION_OFFICER || currentRole === 'verification_officer';
  const isAdmin = currentRole === ROLES.AICTE_ADMIN || currentRole === 'aicte_admin';

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 lg:p-6 rounded-2xl border border-surface-container shadow-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-primary font-label-sm uppercase tracking-wider text-xs">
            <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
            <span>Maturity Horizon Surveillance & Rollover Division</span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <h1 className="font-headline-lg text-xl sm:text-2xl text-on-surface font-bold tracking-tight">
              Maturity Horizons & Renewal Workflows
            </h1>
            <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded-full font-medium">
              Statutory 3-Year Cycles
            </span>
          </div>
          <p className="text-xs text-secondary mt-1">
            Authoritative tracking of FDR maturities, automated discrepancy flags, and end-to-end renewal completion.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              fetchRenewalRequests();
              showToast('Reloaded maturity and renewal data from authoritative backend.');
            }}
            disabled={requestsLoading}
            className="rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface hover:bg-surface-container-low font-label-md text-xs px-3.5 py-2 shadow-xs inline-flex items-center gap-1.5 transition-colors font-semibold"
          >
            <span className={`material-symbols-outlined text-[17px] ${requestsLoading ? 'animate-spin' : ''}`}>
              refresh
            </span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Success Toast */}
      {successToast && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl flex items-center justify-between text-xs animate-in fade-in duration-200 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-700 text-[18px]">check_circle</span>
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="font-bold text-emerald-700 hover:text-emerald-900">
            &times;
          </button>
        </div>
      )}

      {/* Main Top Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-surface-container pb-1">
        <button
          onClick={() => setActiveTab('surveillance')}
          className={`pb-2.5 px-3 font-semibold text-xs transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'surveillance'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">radar</span>
          <span>Maturity Surveillance ({recordsWithMaturity.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`pb-2.5 px-3 font-semibold text-xs transition-colors flex items-center gap-2 border-b-2 ${
            activeTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[17px]">change_circle</span>
          <span>Renewal Requests & Completions ({renewalRequests.length})</span>
          {renewalRequests.filter((r) => r.status === 'APPROVED').length > 0 && (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
              {renewalRequests.filter((r) => r.status === 'APPROVED').length} Ready to Complete
            </span>
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MATURITY SURVEILLANCE & HORIZONS                                    */}
      {/* ========================================================================= */}
      {activeTab === 'surveillance' && (
        <div className="flex flex-col gap-4">
          {/* Horizon Filters & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-3 rounded-2xl border border-surface-container">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setHorizonFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  horizonFilter === 'all'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                <span>All Horizons</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono bg-white/20 text-white">
                  {horizonCounts.all}
                </span>
              </button>

              <button
                onClick={() => setHorizonFilter('overdue')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  horizonFilter === 'overdue'
                    ? 'bg-rose-700 text-white shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                <span>Overdue (&lt; 0d)</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
                  horizonCounts.overdue > 0 ? 'bg-rose-100 text-rose-800' : 'bg-surface-container text-secondary'
                }`}>
                  {horizonCounts.overdue}
                </span>
              </button>

              <button
                onClick={() => setHorizonFilter('30days')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  horizonFilter === '30days'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                <span>1–30 Days</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono bg-surface-container text-secondary">
                  {horizonCounts['30days']}
                </span>
              </button>

              <button
                onClick={() => setHorizonFilter('60days')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  horizonFilter === '60days'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                <span>31–60 Days</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono bg-surface-container text-secondary">
                  {horizonCounts['60days']}
                </span>
              </button>

              <button
                onClick={() => setHorizonFilter('90days')}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all inline-flex items-center gap-2 ${
                  horizonFilter === '90days'
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container-low text-secondary hover:text-on-surface'
                }`}
              >
                <span>61–90 Days</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono bg-surface-container text-secondary">
                  {horizonCounts['90days']}
                </span>
              </button>
            </div>

            <div className="relative min-w-[240px] w-full sm:w-auto">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[17px]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search FDR, bank, institution..."
                className="w-full h-8 pl-8 pr-3 text-xs bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
              />
            </div>
          </div>

          {/* FDR Surveillance Table */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-surface-container overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container-low text-secondary font-label-sm uppercase tracking-wider text-[11px] h-10 border-b border-surface-container">
                    <th className="py-2.5 px-4 font-semibold">FDR & Mandate</th>
                    <th className="py-2.5 px-4 font-semibold">Institution & Region</th>
                    <th className="py-2.5 px-4 font-semibold">Bank Branch</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Deposit Value</th>
                    <th className="py-2.5 px-4 font-semibold">Maturity Date</th>
                    <th className="py-2.5 px-4 text-center font-semibold">Horizon / Days</th>
                    <th className="py-2.5 px-4 text-center font-semibold">FDR Status</th>
                    <th className="py-2.5 pr-4 pl-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container font-body-sm text-on-surface">
                  {filteredFdrRecords.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center text-secondary">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="material-symbols-outlined text-[32px] text-secondary/60">search_off</span>
                          <span className="font-semibold text-xs">No maturity records found</span>
                          <span className="text-[11px] text-secondary">
                            Try adjusting your horizon filter or search query
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredFdrRecords.map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low/60 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-data-mono font-bold text-on-surface block">{item.fdrNumber}</span>
                          <span className="text-[10px] text-secondary">{item.tripartiteRef || 'Tripartite Lien'}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-on-surface block">{item.institutionName}</span>
                          <span className="text-[10px] text-secondary">
                            ID: {item.institutionId || item.institution_id || 'AICTE-INST'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-on-surface block">{item.bank}</span>
                          <span className="text-[10px] text-secondary">{item.branch}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-data-mono font-bold text-on-surface text-[13px]">
                          {item.amountFormatted || `₹${Number(item.amount || 0).toLocaleString('en-IN')}`}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-data-mono font-medium block">{item.maturityDate}</span>
                          <span className="text-[10px] text-secondary">3-Year Term Rollover</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.isOverdue ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-rose-800 bg-rose-100 px-2 py-0.5 rounded">
                              {Math.abs(item.daysRemaining)}d OVERDUE
                            </span>
                          ) : item.daysRemaining <= 30 ? (
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                              {item.daysRemaining}d Left
                            </span>
                          ) : (
                            <span className="font-mono text-secondary text-[11px]">
                              {item.daysRemaining}d Left
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.status === 'MATURING_SOON'
                              ? 'bg-amber-100 text-amber-800'
                              : item.status === 'MATURED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-surface-container text-on-surface'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 pl-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(isInstitutionOfficer || isAdmin) && (
                              <button
                                onClick={() => openInitiateRenewalModal(item)}
                                className="h-7 px-2.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary-container text-on-primary transition-colors flex items-center gap-1 shadow-xs"
                                title="Initiate formal 3-year term rollover"
                              >
                                <span className="material-symbols-outlined text-[14px]">autorenew</span>
                                <span>Renew</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleInspect(item)}
                              className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container"
                              title="View Telemetry & Details"
                            >
                              <span className="material-symbols-outlined text-[16px]">visibility</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RENEWAL REQUESTS & COMPLETIONS QUEUE                                */}
      {/* ========================================================================= */}
      {activeTab === 'requests' && (
        <div className="flex flex-col gap-4">
          {/* Request Status Filter Tabs */}
          <div className="flex items-center gap-2 bg-surface-container-lowest p-3 rounded-2xl border border-surface-container overflow-x-auto">
            <button
              onClick={() => setRequestFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                requestFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              All Requests ({renewalRequests.length})
            </button>
            <button
              onClick={() => setRequestFilter('REQUESTED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                requestFilter === 'REQUESTED' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              Pending Scrutiny ({renewalRequests.filter((r) => r.status === 'REQUESTED').length})
            </button>
            <button
              onClick={() => setRequestFilter('UNDER_VERIFICATION')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                requestFilter === 'UNDER_VERIFICATION' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              Under Verification ({renewalRequests.filter((r) => r.status === 'UNDER_VERIFICATION').length})
            </button>
            <button
              onClick={() => setRequestFilter('PENDING_APPROVAL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                requestFilter === 'PENDING_APPROVAL' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              Pending Approval ({renewalRequests.filter((r) => r.status === 'PENDING_APPROVAL').length})
            </button>
            <button
              onClick={() => setRequestFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                requestFilter === 'APPROVED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              Approved / Ready to Complete ({renewalRequests.filter((r) => r.status === 'APPROVED').length})
            </button>
            <button
              onClick={() => setRequestFilter('COMPLETED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 ${
                requestFilter === 'COMPLETED' ? 'bg-primary text-white shadow-xs' : 'text-secondary hover:text-on-surface'
              }`}
            >
              Completed ({renewalRequests.filter((r) => r.status === 'COMPLETED').length})
            </button>
          </div>

          {requestsError && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl flex items-center justify-between text-xs">
              <span>{requestsError}</span>
              <button onClick={fetchRenewalRequests} className="font-bold underline hover:text-rose-950">
                Retry
              </button>
            </div>
          )}

          {requestsLoading && (
            <div className="p-12 text-center text-secondary text-xs flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <span>Fetching live renewal requests from backend...</span>
            </div>
          )}

          {!requestsLoading && filteredRequests.length === 0 && (
            <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-surface-container flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[32px] text-secondary/60">change_circle</span>
              <span className="font-bold text-sm text-on-surface">No Renewal Requests In Queue</span>
              <p className="text-xs text-secondary max-w-sm">
                No requests currently match the selected status filter ({requestFilter}). Initiate a renewal from the
                Surveillance tab when an FDR approaches its maturity threshold.
              </p>
            </div>
          )}

          {/* List of Renewal Request Cards with Current vs Proposed Comparison */}
          {!requestsLoading && filteredRequests.length > 0 && (
            <div className="space-y-4">
              {filteredRequests.map((reqItem) => {
                const propDetails = reqItem.proposed_details || {};
                const hasDifferFlag =
                  (reqItem.discrepancy_flags || []).includes('RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD') ||
                  propDetails.differ_flag;

                return (
                  <div
                    key={reqItem.id}
                    className="p-5 rounded-2xl bg-surface-container-lowest border border-surface-container shadow-xs flex flex-col gap-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-container pb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-lg bg-surface-container text-on-surface font-mono text-xs font-bold">
                          REQ #{reqItem.id}
                        </span>
                        <span className="font-bold text-sm text-on-surface">
                          {reqItem.fdr_number}
                        </span>
                        <span className="text-xs text-secondary">
                          • {reqItem.institution_name || `Institution #${reqItem.institution_id}`}
                        </span>
                        <span className="text-xs text-secondary">
                          • {reqItem.bank_name} ({reqItem.branch})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          reqItem.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : reqItem.status === 'COMPLETED'
                            ? 'bg-teal-100 text-teal-800'
                            : reqItem.status === 'UNDER_VERIFICATION'
                            ? 'bg-blue-100 text-blue-800'
                            : reqItem.status === 'PENDING_APPROVAL'
                            ? 'bg-purple-100 text-purple-800'
                            : reqItem.status === 'CORRECTION_REQUIRED'
                            ? 'bg-amber-100 text-amber-800'
                            : reqItem.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-surface-container text-on-surface'
                        }`}>
                          {reqItem.status}
                        </span>

                        {reqItem.council_order_ref && (
                          <span className="text-[10px] font-mono font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Order: {reqItem.council_order_ref}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Discrepancy Alert Banner */}
                    {hasDifferFlag && (
                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl flex items-start gap-2.5 text-xs">
                        <span className="material-symbols-outlined text-amber-700 text-[18px] shrink-0 mt-0.5">
                          flag
                        </span>
                        <div className="flex flex-col">
                          <span className="font-bold uppercase tracking-wider text-[11px] font-mono text-amber-800">
                            RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD
                          </span>
                          <span className="text-[11px] mt-0.5 leading-relaxed text-amber-800">
                            Proposed renewal attributes (FDR number, extended maturity date, or interest rate) differ
                            from the active record. Historical record and previous document versions are preserved
                            immutably upon completion.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Comparison Table: Current vs Proposed */}
                    <div className="bg-surface-container-low/60 rounded-xl p-3 border border-surface-container overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="text-secondary font-semibold text-[10px] uppercase tracking-wider border-b border-surface-container pb-1">
                            <th className="py-1 px-2">Attribute</th>
                            <th className="py-1 px-2">Current Active Record</th>
                            <th className="py-1 px-2">Proposed Renewal</th>
                            <th className="py-1 px-2 text-center">Discrepancy Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-container/60 font-body-sm">
                          <tr>
                            <td className="py-1.5 px-2 font-medium text-secondary">FDR Certificate Number</td>
                            <td className="py-1.5 px-2 font-mono font-bold text-on-surface">{reqItem.fdr_number}</td>
                            <td className="py-1.5 px-2 font-mono font-bold text-primary">
                              {propDetails.proposed_fdr_number || reqItem.fdr_number}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              {propDetails.proposed_fdr_number && propDetails.proposed_fdr_number !== reqItem.fdr_number ? (
                                <span className="text-[10px] text-amber-700 bg-amber-100 font-bold px-1.5 py-0.5 rounded">
                                  Changed
                                </span>
                              ) : (
                                <span className="text-[10px] text-secondary">Identical</span>
                              )}
                            </td>
                          </tr>

                          <tr>
                            <td className="py-1.5 px-2 font-medium text-secondary">Maturity Date</td>
                            <td className="py-1.5 px-2 font-mono text-on-surface">{reqItem.current_maturity_date || 'N/A'}</td>
                            <td className="py-1.5 px-2 font-mono font-bold text-primary">
                              {propDetails.proposed_maturity_date || 'N/A'}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              {propDetails.proposed_maturity_date !== reqItem.current_maturity_date ? (
                                <span className="text-[10px] text-emerald-800 bg-emerald-100 font-bold px-1.5 py-0.5 rounded">
                                  Extended
                                </span>
                              ) : (
                                <span className="text-[10px] text-secondary">Identical</span>
                              )}
                            </td>
                          </tr>

                          <tr>
                            <td className="py-1.5 px-2 font-medium text-secondary">Interest Rate</td>
                            <td className="py-1.5 px-2 font-mono text-on-surface">{reqItem.current_interest_rate || 'N/A'}</td>
                            <td className="py-1.5 px-2 font-mono font-bold text-primary">
                              {propDetails.proposed_interest_rate || reqItem.current_interest_rate || 'N/A'}
                            </td>
                            <td className="py-1.5 px-2 text-center">
                              {propDetails.proposed_interest_rate && propDetails.proposed_interest_rate !== reqItem.current_interest_rate ? (
                                <span className="text-[10px] text-amber-700 bg-amber-100 font-bold px-1.5 py-0.5 rounded">
                                  Adjusted
                                </span>
                              ) : (
                                <span className="text-[10px] text-secondary">Identical</span>
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Justification & Remarks Footer */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pt-1">
                      <div className="flex flex-col text-secondary leading-tight">
                        <span className="font-medium text-on-surface">Reason: {reqItem.reason}</span>
                        {propDetails.applicant_notes && (
                          <span className="text-[11px] text-secondary mt-0.5">Note: {propDetails.applicant_notes}</span>
                        )}
                        {reqItem.officer_remarks && (
                          <span className="text-[11px] text-primary mt-0.5 font-medium">Scrutiny Note: {reqItem.officer_remarks}</span>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* 1. Complete Renewal Action (When APPROVED) */}
                        {reqItem.status === 'APPROVED' && (isInstitutionOfficer || isAdmin) && (
                          <button
                            onClick={() => openCompleteRenewalModal(reqItem)}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-xs inline-flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                            <span>Complete Renewal & Roll Over FDR</span>
                          </button>
                        )}

                        {/* 2. Verifier claim action (When REQUESTED) */}
                        {reqItem.status === 'REQUESTED' && (isVerifier || isAdmin) && (
                          <button
                            onClick={() => handleClaimVerification(reqItem)}
                            className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-white font-semibold text-xs transition-colors shadow-xs inline-flex items-center gap-1.5"
                          >
                            <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
                            <span>Claim for Scrutiny</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: INITIATE RENEWAL REQUEST                                         */}
      {/* ========================================================================= */}
      {selectedFdrForRenewal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-surface-container-low border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[20px]">autorenew</span>
                <span className="font-bold text-sm text-on-surface">
                  Initiate Term Rollover / Renewal Request
                </span>
              </div>
              <button
                onClick={() => setSelectedFdrForRenewal(null)}
                className="text-secondary hover:text-on-surface p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSubmitRenewal} className="p-5 flex flex-col gap-4 text-xs">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl">
                  {modalError}
                </div>
              )}

              {/* Current FDR Context */}
              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container flex flex-col gap-1">
                <div className="flex items-center justify-between font-mono font-bold text-xs text-on-surface">
                  <span>{selectedFdrForRenewal.fdrNumber}</span>
                  <span>{selectedFdrForRenewal.amountFormatted}</span>
                </div>
                <div className="text-[11px] text-secondary flex items-center justify-between">
                  <span>{selectedFdrForRenewal.bank} ({selectedFdrForRenewal.branch})</span>
                  <span>Current Maturity: {selectedFdrForRenewal.maturityDate}</span>
                </div>
              </div>

              {/* Form Input: Proposed Maturity Date */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">
                  Proposed New Maturity Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={proposedMaturityDate}
                  onChange={(e) => setProposedMaturityDate(e.target.value)}
                  required
                  className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono"
                />
                <span className="text-[10px] text-secondary">
                  Must be after current maturity date ({selectedFdrForRenewal.maturityDate}).
                </span>
              </div>

              {/* Form Input: Proposed FDR Number */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">
                  Proposed Renewed Certificate Number (if re-issued)
                </label>
                <input
                  type="text"
                  value={proposedFdrNumber}
                  onChange={(e) => setProposedFdrNumber(e.target.value)}
                  placeholder="e.g. FDR-SBI-123456"
                  className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono"
                />
              </div>

              {/* Form Input: Proposed Interest Rate */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Proposed Renewed Interest Rate</label>
                <input
                  type="text"
                  value={proposedInterestRate}
                  onChange={(e) => setProposedInterestRate(e.target.value)}
                  placeholder="e.g. 7.25%"
                  className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono"
                />
              </div>

              {/* Form Input: Reason */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">
                  Renewal Justification / Mandate Note <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={renewalReason}
                  onChange={(e) => setRenewalReason(e.target.value)}
                  required
                  className="p-2.5 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              {/* Form Input: Additional Applicant Notes */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Applicant Notes (Optional)</label>
                <input
                  type="text"
                  value={applicantNotes}
                  onChange={(e) => setApplicantNotes(e.target.value)}
                  placeholder="Any additional remarks for scrutiny officers"
                  className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              {/* Discrepancy Live Indicator */}
              {isInitiateDiffering && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-[11px] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-amber-700">info</span>
                  <span>
                    Details differ from current record. Will be submitted with flag{' '}
                    <strong className="font-mono">RENEWAL_DETAILS_DIFFER_FROM_CURRENT_RECORD</strong>.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setSelectedFdrForRenewal(null)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-secondary hover:text-on-surface font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRenewal}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isSubmittingRenewal ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      <span>Submit Renewal Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: COMPLETE APPROVED RENEWAL                                        */}
      {/* ========================================================================= */}
      {selectedReqForCompletion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
            <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-emerald-950">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-700 text-[20px]">task_alt</span>
                <span className="font-bold text-sm">
                  Complete Ratified Renewal (REQ #{selectedReqForCompletion.id})
                </span>
              </div>
              <button
                onClick={() => setSelectedReqForCompletion(null)}
                className="text-emerald-800 hover:text-emerald-950 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCompleteRenewal} className="p-5 flex flex-col gap-4 text-xs">
              {completeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl">
                  {completeError}
                </div>
              )}

              <p className="text-secondary leading-relaxed">
                This renewal was ratified by the Approving Authority (Order:{' '}
                <strong className="font-mono text-on-surface">
                  {selectedReqForCompletion.council_order_ref || 'Official Council Order'}
                </strong>
                ). Completing this request transactionally updates the active FDR record to the new maturity date and
                archives previous details in the permanent immutable renewal history.
              </p>

              {/* Form Input: Renewed Certificate Number */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">
                  Confirmed Renewed FDR Number <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  value={completeFdrNumber}
                  onChange={(e) => setCompleteFdrNumber(e.target.value)}
                  required
                  className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono font-bold"
                />
              </div>

              {/* Form Input: Renewed Maturity Date */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">
                  Confirmed Renewed Maturity Date <span className="text-rose-600">*</span>
                </label>
                <input
                  type="date"
                  value={completeMaturityDate}
                  onChange={(e) => setCompleteMaturityDate(e.target.value)}
                  required
                  className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono font-bold"
                />
              </div>

              {/* Form Input: Renewed Interest Rate */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Confirmed Renewed Interest Rate</label>
                <input
                  type="text"
                  value={completeInterestRate}
                  onChange={(e) => setCompleteInterestRate(e.target.value)}
                  className="h-9 px-3 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono"
                />
              </div>

              {/* Form Input: Completion Remarks */}
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface">Completion Remarks / Transaction Note</label>
                <textarea
                  rows={2}
                  value={completeRemarks}
                  onChange={(e) => setCompleteRemarks(e.target.value)}
                  className="p-2.5 bg-surface-container-low border border-surface-container rounded-xl focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setSelectedReqForCompletion(null)}
                  className="px-4 py-2 rounded-xl border border-surface-container text-secondary hover:text-on-surface font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCompletingRenewal}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {isCompletingRenewal ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Updating FDR...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">task_alt</span>
                      <span>Ratify & Complete Renewal</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
