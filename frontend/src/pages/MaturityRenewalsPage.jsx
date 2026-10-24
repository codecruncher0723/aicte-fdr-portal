import React, { useState, useMemo } from 'react';
import { useRole } from '../context/RoleContext';
import { FDR_STATUSES, exportToCSV } from '../data/mockData';
import { workflowApi } from '../api/client';

export default function MaturityRenewalsPage({ fdrs = [], onSelectFdr }) {
  const { setActiveRoute, setSelectedFdrRef } = useRole();
  const [horizonFilter, setHorizonFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dispatchedNotices, setDispatchedNotices] = useState([]);
  const [renewingId, setRenewingId] = useState(null);
  const [renewalNotice, setRenewalNotice] = useState(null);

  const handleInitiateRenewal = async (fdr) => {
    try {
      setRenewingId(fdr.id);
      await workflowApi.createRenewal(fdr.id, {
        extension_years: 3,
        notes: `Statutory 3-year extension submitted for ${fdr.fdrNumber}`
      });
      setRenewalNotice(`Renewal request lodged for ${fdr.fdrNumber}. Tripartite rollover submitted to verifier.`);
      setTimeout(() => setRenewalNotice(null), 4000);
    } catch (err) {
      console.warn('Renewal API request failed, lodging simulated request:', err);
      setRenewalNotice(`Renewal request recorded for ${fdr.fdrNumber}.`);
      setTimeout(() => setRenewalNotice(null), 4000);
    } finally {
      setRenewingId(null);
    }
  };

  // Calculate maturity days remaining
  const recordsWithMaturity = useMemo(() => {
    return (fdrs || []).map(f => {
      const matDate = new Date(f.maturityDate);
      const now = new Date('2024-11-15'); // Current simulation epoch
      const diffTime = matDate - now;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

  // Filter records matching the current search query
  const searchMatchedRecords = useMemo(() => {
    if (!search.trim()) return recordsWithMaturity;
    const s = search.toLowerCase().trim();
    return recordsWithMaturity.filter(
      item =>
        item.fdrNumber.toLowerCase().includes(s) ||
        item.institutionName.toLowerCase().includes(s) ||
        item.bank.toLowerCase().includes(s)
    );
  }, [recordsWithMaturity, search]);

  // Dynamic counts for each horizon filter tab based on searchMatchedRecords
  const counts = useMemo(() => {
    return {
      all: searchMatchedRecords.length,
      overdue: searchMatchedRecords.filter(r => r.isOverdue).length,
      '30days': searchMatchedRecords.filter(r => r.isWithin30).length,
      '60days': searchMatchedRecords.filter(r => r.isWithin60).length,
      '90days': searchMatchedRecords.filter(r => r.isWithin90).length,
    };
  }, [searchMatchedRecords]);

  // Apply horizon filter on top of search
  const filtered = useMemo(() => {
    return searchMatchedRecords.filter(item => {
      if (horizonFilter === 'overdue') return item.isOverdue;
      if (horizonFilter === '30days') return item.isWithin30;
      if (horizonFilter === '60days') return item.isWithin60;
      if (horizonFilter === '90days') return item.isWithin90;
      if (horizonFilter === 'upcoming') return item.daysRemaining <= 180;
      return true;
    }).sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [searchMatchedRecords, horizonFilter]);

  const handleDispatchNotice = (fdrNumber) => {
    setDispatchedNotices(prev => [...prev, fdrNumber]);
    setTimeout(() => {
      setDispatchedNotices(prev => prev.filter(x => x !== fdrNumber));
    }, 4000);
  };

  const handleInspect = (fdr) => {
    setSelectedFdrRef(fdr.fdrNumber);
    if (onSelectFdr) onSelectFdr(fdr);
    setActiveRoute('verification_audit');
  };

  const handleExportCSV = () => {
    exportToCSV('aicte_maturity_renewals_report.csv', filtered.map(f => ({
      'FDR Number': f.fdrNumber,
      'Institution': f.institutionName,
      'PID': f.aictePid,
      'Bank': f.bank,
      'Deposit Amount': f.amount,
      'Maturity Date': f.maturityDate,
      'Days Remaining': f.daysRemaining,
      'Status': f.status,
      'Auto Rollover': f.autoRollover ? 'Enabled' : 'Manual Renewal Required'
    })));
  };

  return (
    <div className="w-full flex-1 p-4 sm:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      {/* Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-secondary font-label-sm uppercase tracking-wider mb-1">
            <span>Regulatory Financial Custody</span>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-primary font-semibold">Maturity Horizon & Rollovers</span>
          </div>
          <h1 className="font-headline-xl text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
            Maturity & Renewal Surveillance
          </h1>
          <p className="font-body-md text-xs text-secondary mt-0.5">
            Automated monitoring of 30, 60, and 90-day expiry thresholds under APH Clause 14(B).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="h-9 px-3.5 rounded-xl bg-surface-container-lowest border border-surface-container text-on-surface font-label-md text-xs flex items-center gap-1.5 shadow-xs hover:bg-surface-container transition-colors font-semibold"
            type="button"
          >
            <span className="material-symbols-outlined text-[17px] text-secondary">file_download</span>
            <span>Export Roll (CSV)</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 border border-surface-container shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
          <button
            onClick={() => setHorizonFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all inline-flex items-center gap-2 ${
              horizonFilter === 'all'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-low text-secondary hover:text-on-surface'
            }`}
          >
            <span>All Horizons</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
                horizonFilter === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-container text-secondary'
              }`}
            >
              {counts.all}
            </span>
          </button>

          <button
            onClick={() => setHorizonFilter('overdue')}
            className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all inline-flex items-center gap-2 ${
              horizonFilter === 'overdue'
                ? 'bg-error text-on-error shadow-xs'
                : 'bg-surface-container-low text-secondary hover:text-on-surface'
            }`}
          >
            <span>Matured Overdue</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
                horizonFilter === 'overdue'
                  ? 'bg-white/20 text-white'
                  : 'bg-error-container text-error'
              }`}
            >
              {counts.overdue}
            </span>
          </button>

          <button
            onClick={() => setHorizonFilter('30days')}
            className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold transition-all inline-flex items-center gap-2 ${
              horizonFilter === '30days'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface-container-low text-secondary hover:text-on-surface'
            }`}
          >
            <span>&lt; 30 Days</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
                horizonFilter === '30days'
                  ? 'bg-white/20 text-white'
                  : counts['30days'] > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-surface-container text-secondary'
              }`}
            >
              {counts['30days']}
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
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
                horizonFilter === '60days'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-container text-secondary'
              }`}
            >
              {counts['60days']}
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
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold font-data-mono ${
                horizonFilter === '90days'
                  ? 'bg-white/20 text-white'
                  : 'bg-surface-container text-secondary'
              }`}
            >
              {counts['90days']}
            </span>
          </button>
        </div>

        <div className="relative min-w-[220px] w-full sm:w-auto">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-secondary text-[17px]">
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reference, bank, college..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-surface-container-low border border-surface-container rounded-lg focus:outline-none focus:ring-1 focus:ring-primary text-on-surface"
          />
        </div>
      </div>

      {/* Table */}
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
                <th className="py-2.5 px-4 text-center font-semibold">Status</th>
                <th className="py-2.5 pr-4 pl-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container font-body-sm text-on-surface">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-secondary">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[28px] text-secondary/60">search_off</span>
                      <span className="font-semibold text-xs">No maturity records found</span>
                      <span className="text-[11px] text-secondary">Try adjusting your horizon filter or search query</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-data-mono font-bold text-on-surface block">{item.fdrNumber}</span>
                      <span className="text-[10px] text-secondary">{item.tripartiteRef?.split(' / ')[0]}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-on-surface block">{item.institutionName}</span>
                      <span className="text-[10px] text-secondary">PID: {item.aictePid} • {item.regionLabel}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-on-surface block">{item.bank}</span>
                      <span className="text-[10px] text-secondary">{item.branch}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-data-mono font-bold text-on-surface text-[13px]">
                      {item.amountFormatted}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-data-mono font-medium block">{item.maturityDate}</span>
                      <span className="text-[10px] text-secondary">{item.autoRollover ? 'Auto-Rollover' : 'Manual Renewal'}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {item.isOverdue ? (
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] text-error bg-error-container px-2 py-0.5 rounded">
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
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-surface-container text-on-surface">
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 pl-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleDispatchNotice(item.fdrNumber)}
                          className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 ${
                            dispatchedNotices.includes(item.fdrNumber)
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-primary hover:bg-primary-container text-on-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">outgoing_mail</span>
                          <span>{dispatchedNotices.includes(item.fdrNumber) ? 'Sent' : 'Notice'}</span>
                        </button>
                        <button
                          onClick={() => handleInspect(item)}
                          className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container"
                          title="View Telemetry"
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
  );
}
